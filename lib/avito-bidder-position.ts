import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export type PositionSource =
  | "avito_serp_playwright"
  | "avito_serp_first_page_not_found"
  | "avito_serp_error";

export type BidderPositionResult = {
  position: number | null;
  source: PositionSource;
  page: number | null;
  searchUrl: string;
  details: string;
  error: string | null;
};

type SerpCard = {
  href: string;
  itemId: string | null;
};

// ---------------------------------------------------------------------------
// Конфигурация
// ---------------------------------------------------------------------------

function getMaxPages() {
  return 1;
}

function getTimeoutMs() {
  const value = Number(process.env.BIDDER_POSITION_TIMEOUT_MS ?? "45000");
  if (!Number.isInteger(value)) return 45_000;
  return Math.min(Math.max(value, 10_000), 90_000);
}

// ---------------------------------------------------------------------------
// Пул прокси: перебор по очереди, пока не получим позицию
// ---------------------------------------------------------------------------
//
// ГДЕ ДОБАВЛЯТЬ ПРОКСИ: в файле .env (и в переменных окружения на хостинге) в строке
//
//   BIDDER_PROXIES="91.221.70.204:24015:логин:пароль;ещё_адрес:порт:логин:пароль;ещё_один:порт:логин:пароль"
//
// Прокси разделяются точкой с запятой «;» (или переносом строки). Формат каждого — как выдаёт
// продавец: адрес:порт:логин:пароль. Допустимы и другие записи: адрес:порт (без логина),
// логин:пароль@адрес:порт, а также с префиксом http:// или socks5://.
// Чтобы добавить ещё прокси — просто допишите его в конец строки через «;» и перезапустите сайт.
// Код менять не нужно, количество прокси не ограничено.
//
// Если BIDDER_PROXIES пустая, а задан старый вариант (BIDDER_PROXY_SERVER / _USERNAME / _PASSWORD),
// используется он, как раньше. Если не задано ничего — проверка идёт без прокси, как раньше.
//
// Как работает перебор: проверка пробует прокси по очереди. Если на одном получили капчу,
// блокировку или ошибку соединения — сразу берём следующий и так до первой успешной проверки.
// Прокси, на котором была капча, «отдыхает» несколько минут и пропускается (если не отдыхают
// все — пробуем всё равно). Стартовый прокси каждый раз сдвигается, чтобы нагрузка шла поровну.

type BidderProxy = {
  /** Для логов и ошибок — только адрес:порт, без логина и пароля */
  label: string;
  server: string;
  username?: string;
  password?: string;
  /** Ротационный шлюз: каждый новый запрос идёт с нового IP, поэтому его можно пробовать несколько раз подряд */
  rotating?: boolean;
  /** Ссылка смены IP у продавца прокси. СЕКРЕТ: никогда не пишем в логи и ошибки. */
  reconnectUrl?: string;
};

/** Сколько минут прокси «отдыхает» после капчи/блокировки/ошибки */
const PROXY_COOLDOWN_MS = 10 * 60 * 1000;

const proxyCooldownUntil = new Map<string, number>();
let proxyRotationCounter = 0;

function parseProxyEntry(raw: string): BidderProxy | null {
  let text = raw.trim();
  if (!text) return null;

  // Необязательная ссылка смены IP после символа «|»:  адрес:порт:логин:пароль|https://…/reconnect-link/…
  let reconnectUrl: string | undefined;
  const bar = text.indexOf("|");
  if (bar >= 0) {
    const link = text.slice(bar + 1).trim();
    if (/^https?:\/\//i.test(link)) reconnectUrl = link;
    text = text.slice(0, bar).trim();
  }

  let scheme = "http";
  const schemeMatch = text.match(/^(https?|socks5h?|socks4):\/\//i);
  if (schemeMatch) {
    scheme = schemeMatch[1].toLowerCase().replace("socks5h", "socks5");
    text = text.slice(schemeMatch[0].length);
  }

  let host = "";
  let port = "";
  let username: string | undefined;
  let password: string | undefined;

  if (text.includes("@")) {
    // логин:пароль@адрес:порт
    const at = text.lastIndexOf("@");
    const cred = text.slice(0, at);
    const addr = text.slice(at + 1).split(":");
    host = addr[0] ?? "";
    port = addr[1] ?? "";
    const colon = cred.indexOf(":");
    username = colon >= 0 ? cred.slice(0, colon) : cred;
    password = colon >= 0 ? cred.slice(colon + 1) : undefined;
  } else {
    // адрес:порт[:логин:пароль]  (пароль может содержать двоеточия — берём всё после логина)
    const parts = text.split(":");
    host = parts[0] ?? "";
    port = parts[1] ?? "";
    if (parts.length >= 3) username = parts[2];
    if (parts.length >= 4) password = parts.slice(3).join(":");
  }

  if (!host || !/^\d{2,5}$/.test(port)) return null;
  return {
    label: `${host}:${port}`,
    server: `${scheme}://${host}:${port}`,
    username: username || undefined,
    password: password || undefined,
    reconnectUrl,
  };
}

/** Сколько раз подряд пробовать один ротационный шлюз (каждая попытка — новый IP). */
function getRotatingAttempts() {
  const value = Number(process.env.BIDDER_ROTATING_ATTEMPTS ?? "4");
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), 10) : 4;
}

function getProxyPool(): BidderProxy[] {
  const pool: BidderProxy[] = [];

  // РОТАЦИОННЫЕ ШЛЮЗЫ (домашние/мобильные прокси с оплатой за трафик, где IP меняется на каждый запрос).
  // Вносятся в отдельной переменной .env в том же формате адрес:порт:логин:пароль, через «;»:
  //   BIDDER_ROTATING_PROXIES="gate.example.com:8000:логин:пароль"
  // Каждый такой шлюз пробуется до BIDDER_ROTATING_ATTEMPTS раз подряд (по умолчанию 4) — на каждой попытке новый IP.
  for (const entry of (process.env.BIDDER_ROTATING_PROXIES ?? "").split(/[;\n\r]+/)) {
    const proxy = parseProxyEntry(entry);
    if (proxy && !pool.some((item) => item.server === proxy.server)) pool.push({ ...proxy, rotating: true });
  }

  const list = process.env.BIDDER_PROXIES ?? "";
  for (const entry of list.split(/[;\n\r]+/)) {
    const proxy = parseProxyEntry(entry);
    if (proxy && !pool.some((item) => item.server === proxy.server)) pool.push(proxy);
  }

  // Старый вариант с одним прокси — остаётся рабочим
  const legacyServer = process.env.BIDDER_PROXY_SERVER?.trim();
  if (legacyServer && !pool.some((item) => item.server === legacyServer)) {
    pool.push({
      label: legacyServer.replace(/^[a-z0-9]+:\/\//i, ""),
      server: legacyServer,
      username: process.env.BIDDER_PROXY_USERNAME?.trim() || undefined,
      password: process.env.BIDDER_PROXY_PASSWORD?.trim() || undefined,
      reconnectUrl: process.env.BIDDER_PROXY_RECONNECT_URL?.trim() || undefined,
    });
  }

  // Ссылка смены IP отдельной переменной: подходит к ПЕРВОМУ прокси без своей ссылки
  // (удобно, когда прокси один):  BIDDER_PROXY_RECONNECT_URL="https://…/reconnect-link/…"
  const sharedLink = process.env.BIDDER_PROXY_RECONNECT_URL?.trim();
  if (sharedLink && /^https?:\/\//i.test(sharedLink)) {
    const first = pool.find((item) => !item.reconnectUrl && !item.rotating);
    if (first) first.reconnectUrl = sharedLink;
  }
  return pool;
}

/** Порядок перебора: сначала «отдохнувшие», начиная с каждый раз нового (по кругу). */
function orderProxies(pool: BidderProxy[]): BidderProxy[] {
  const start = proxyRotationCounter % pool.length;
  proxyRotationCounter += 1;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  const now = Date.now();
  const ready = rotated.filter((proxy) => (proxyCooldownUntil.get(proxy.server) ?? 0) <= now);
  const resting = rotated.filter((proxy) => (proxyCooldownUntil.get(proxy.server) ?? 0) > now);
  return [...ready, ...resting];
}

// ---------------------------------------------------------------------------
// Смена IP по ссылке продавца прокси (reconnect-link)
// ---------------------------------------------------------------------------
//
// ГДЕ УКАЗЫВАТЬ ССЫЛКУ: в .env, сразу после данных прокси через символ «|»:
//
//   BIDDER_PROXIES="213.21.50.171:20417:логин:пароль|https://lk.lte-center.ru/api/proxies/…/reconnect-link/…;второй:порт:логин:пароль|https://ссылка_второго"
//
// Либо, если прокси один, отдельной строкой (как логин и пароль):
//   BIDDER_PROXY_RECONNECT_URL="https://lk.lte-center.ru/api/proxies/…/reconnect-link/…"
//
// Как работает: если проверка через прокси не получила выдачу (капча, блокировка, нет карточек,
// ошибка соединения, таймаут) — открываем эту ссылку, ждём пока модем переподключится и получит
// новый IP, и повторяем проверку. Всего попыток на один прокси: 1 + BIDDER_RECONNECT_RETRIES (по умолчанию 2).
// Для прокси без ссылки поведение прежнее (сразу следующий прокси).
// Сама ссылка нигде не печатается — в логах только адрес:порт.

function getReconnectRetries() {
  const value = Number(process.env.BIDDER_RECONNECT_RETRIES ?? "2");
  return Number.isInteger(value) ? Math.min(Math.max(value, 0), 5) : 2;
}

/** Сколько ждать после смены IP (мс), пока модем переподключится. */
function getReconnectWaitMs() {
  const value = Number(process.env.BIDDER_RECONNECT_WAIT_MS ?? "12000");
  return Number.isInteger(value) ? Math.min(Math.max(value, 3_000), 60_000) : 12_000;
}

/** Не чаще одного вызова ссылки на прокси за это время (провайдеры ограничивают частоту). */
const RECONNECT_MIN_GAP_MS = 20_000;
const lastReconnectAt = new Map<string, number>();

/** Вызывает ссылку смены IP. Возвращает true, если сервер ответил успехом. Ссылку и ответ не логируем. */
async function reconnectProxy(proxy: BidderProxy): Promise<boolean> {
  if (!proxy.reconnectUrl) return false;
  const last = lastReconnectAt.get(proxy.server) ?? 0;
  const gap = Date.now() - last;
  if (gap < RECONNECT_MIN_GAP_MS) await sleep(RECONNECT_MIN_GAP_MS - gap);
  lastReconnectAt.set(proxy.server, Date.now());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(proxy.reconnectUrl, { method: "GET", signal: controller.signal, cache: "no-store" });
    console.log(`[bidder-position] ${proxy.label}: смена IP, ответ ${response.status}`);
    return response.ok;
  } catch (error) {
    // Текст ошибки может содержать адрес со ссылкой — пишем только тип
    console.log(`[bidder-position] ${proxy.label}: смена IP не удалась (${error instanceof Error ? error.name : "ошибка"})`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function markProxyFailed(proxy: BidderProxy) {
  // Ротационный шлюз «отдыхает» недолго (2 мин): следующий запрос всё равно пойдёт с нового IP
  proxyCooldownUntil.set(proxy.server, Date.now() + (proxy.rotating ? 2 * 60 * 1000 : PROXY_COOLDOWN_MS));
}

function markProxyOk(proxy: BidderProxy) {
  proxyCooldownUntil.delete(proxy.server);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// Псевдо-человеческая задержка вместо фиксированного 1500ms
function humanDelay(min = 1200, max = 3500) {
  return sleep(randomInt(min, max));
}

// ---------------------------------------------------------------------------
// User-Agent пул — реальные десктопные UA, ротация на каждый запуск
// ---------------------------------------------------------------------------

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function pickUserAgent() {
  return USER_AGENTS[randomInt(0, USER_AGENTS.length - 1)];
}

// ---------------------------------------------------------------------------
// Локали и Viewport
// ---------------------------------------------------------------------------

const LOCALES = ["ru-RU", "ru"];
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
];

function pickViewport() {
  return VIEWPORTS[randomInt(0, VIEWPORTS.length - 1)];
}

// ---------------------------------------------------------------------------
// Утилиты URL
// ---------------------------------------------------------------------------

function extractAvitoItemId(value: string) {
  const match = String(value).match(/_(\d+)(?:[/?#]|$)/);
  return match?.[1] ?? null;
}

function getSearchUrlForPage(searchUrl: string, pageNumber: number) {
  const url = new URL(searchUrl);
  if (pageNumber <= 1) {
    url.searchParams.delete("p");
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("p", String(pageNumber));
    url.searchParams.delete("page");
  }
  return url.toString();
}

function validateAvitoSearchUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Укажите корректную ссылку поисковой выдачи Авито.");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "avito.ru" && !hostname.endsWith(".avito.ru")) {
    throw new Error(
      "Ссылка поиска должна вести на сайт avito.ru, например https://www.avito.ru/moskva?q=airpods.",
    );
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Stealth: инъекция скриптов для маскировки автоматизации
// ---------------------------------------------------------------------------

async function applyStealth(page: Page) {
  await page.addInitScript(() => {
    // navigator.webdriver = false
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
      configurable: true,
    });

    // Маскируем plugins
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format" },
        { name: "Chrome PDF Viewer", filename: "internal-pdf-viewer", description: "" },
        { name: "Native Client", filename: "internal-nacl-plugin", description: "" },
      ],
      configurable: true,
    });

    Object.defineProperty(navigator, "languages", {
      get: () => ["ru", "ru-RU", "en-US", "en"],
      configurable: true,
    });

    // WebGL vendor / renderer
        // WebGL vendor / renderer
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (this: WebGLRenderingContext, parameter: number) {
      if (parameter === 37445) return "Intel Inc.";
      if (parameter === 37446) return "Intel Iris OpenGL Engine";
      return getParameter.call(this, parameter);
    } as typeof WebGLRenderingContext.prototype.getParameter;


    // Chrome runtime
    (window as any).chrome = { runtime: {} };

    // Permissions API
    const originalQuery = (window as any).navigator.permissions?.query;
    if (originalQuery) {
      (window as any).navigator.permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: "denied" })
          : originalQuery(parameters);
    }
  });
}

// ---------------------------------------------------------------------------
// Запуск браузера
// ---------------------------------------------------------------------------

async function launchBrowser(proxy?: BidderProxy): Promise<Browser> {
  const executablePath = process.env.BIDDER_CHROME_EXECUTABLE_PATH?.trim();

  const launchOptions: Record<string, unknown> = {
    headless: true,
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  } else if (process.platform === "win32") {
    launchOptions.channel = "chrome";
  }

  if (proxy) {
    launchOptions.proxy = {
      server: proxy.server,
      ...(proxy.username ? { username: proxy.username } : {}),
      ...(proxy.password ? { password: proxy.password } : {}),
    };
  }

  return chromium.launch(launchOptions as any);
}

async function createContext(browser: Browser, lightweight = false): Promise<BrowserContext> {
  const userAgent = pickUserAgent();
  const viewport = pickViewport();
  const locale = LOCALES[randomInt(0, LOCALES.length - 1)];

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale,
    timezoneId: "Europe/Moscow",
    extraHTTPHeaders: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": userAgent.includes("Mac") ? '"macOS"' : userAgent.includes("Linux") ? '"Linux"' : '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    ignoreHTTPSErrors: true,
  });

  // Блокируем аналитику и трекинг — не нужны для парсинга и fingerprint-ят
  await context.route("**/*", (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();

    if (
      resourceType === "media" ||
      resourceType === "websocket" ||
      // Через прокси канал медленный (≈1,6 Мбит/с): картинки и шрифты для чтения карточек не нужны
      (lightweight && (resourceType === "image" || resourceType === "font")) ||
      url.includes("googletagmanager") ||
      url.includes("google-analytics") ||
      url.includes("googlesyndication") ||
      url.includes("doubleclick") ||
      url.includes("yandex.ru/metrika") ||
      url.includes("facebook.com/tr") ||
      url.includes("vk.com/rtrg")
    ) {
      return route.abort();
    }

    return route.continue();
  });

  return context;
}

// ---------------------------------------------------------------------------
// Имитация человеческого поведения
// ---------------------------------------------------------------------------

async function humanScroll(page: Page) {
  const viewportHeight = page.viewportSize()?.height ?? 1080;

  const steps = randomInt(3, 6);
  for (let i = 0; i < steps; i++) {
    const scrollY = Math.round(viewportHeight * (i + 1) * randomFloat(0.6, 1.2));
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await sleep(randomInt(300, 800));
  }

  await page.evaluate((y) => window.scrollTo(0, y), Math.round(viewportHeight * 0.3));
  await sleep(randomInt(200, 500));
}

async function humanMouseMove(page: Page) {
  const viewport = page.viewportSize();
  if (!viewport) return;

  for (let i = 0; i < randomInt(2, 5); i++) {
    const x = randomInt(100, viewport.width - 100);
    const y = randomInt(100, viewport.height - 100);
    await page.mouse.move(x, y, { steps: randomInt(5, 15) });
    await sleep(randomInt(100, 400));
  }
}

// ---------------------------------------------------------------------------
// Проверка на капчу / блокировку
// ---------------------------------------------------------------------------

const CAPTCHA_PATTERNS = [
  /captcha/i,
  /проверка\s+безопасности/i,
  /доступ\s+ограничен/i,
  /подтвердите.*что\s+вы\s+не\s+робот/i,
  /bot\s+detection/i,
  /access\s+denied/i,
  /403\s*forbidden/i,
  /доступ\s+к\s+разделу\s+ограничен/i,
  /verify\s+you\s+are\s+human/i,
];

function isCaptchaPage(text: string): boolean {
  return CAPTCHA_PATTERNS.some((pattern) => pattern.test(text));
}

// ---------------------------------------------------------------------------
// Ретрай с повторным запуском при капче
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
// Когда прокси несколько, внутри одного прокси повторяем меньше — быстрее переходим к следующему.
const MAX_RETRIES_WITH_POOL = 1; // у прокси IP тот же — повтор через пару секунд не поможет, быстрее берём следующий прокси

async function fetchWithRetry(
  context: BrowserContext,
  pageUrl: string,
  pageNumber: number,
  timeoutMs: number,
  maxRetries: number = MAX_RETRIES,
): Promise<{ cards: SerpCard[]; captcha: boolean; pageText: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    try {
      await applyStealth(page);

      // 1. Сначала «заходим» на главную Avito — получаем cookies
      if (attempt === 1) {
        await page.goto("https://www.avito.ru", {
          waitUntil: "domcontentloaded",
          timeout: Math.min(timeoutMs, 15_000),
        }).catch(() => {});
        await humanDelay(800, 2000);
        await humanMouseMove(page);
      }

      // 2. Переходим на страницу поиска
      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      // 3. Ждём рендер с псевдо-человеческой задержкой
      await humanDelay();

      // 4. Имитируем поведение
      await humanMouseMove(page);
      await humanScroll(page);
      await humanDelay(500, 1500);

      // 5. Проверяем на капчу
      const pageText = await page.locator("body").innerText().catch(() => "");

      if (isCaptchaPage(pageText)) {
        await page.close().catch(() => {});
        if (attempt < maxRetries) {
          await sleep(randomInt(3000, 6000) * attempt);
          continue;
        }
        return { cards: [], captcha: true, pageText };
      }

      // 6. Ждём появления карточек
      await page
        .locator('[data-marker="item"]')
        .first()
        .waitFor({ state: "attached", timeout: Math.min(timeoutMs, 15_000) })
        .catch(() => null);

      // 7. Парсим карточки
      const cards = await page.locator('[data-marker="item"]').evaluateAll(
        (elements) =>
          elements.map((element) => {
            const anchors = Array.from(
              element.querySelectorAll<HTMLAnchorElement>("a[href]"),
            );
            const href =
              anchors.find((anchor) => /_\d+(?:[/?#]|$)/.test(anchor.href))?.href ?? "";
            return { href };
          }),
      );

      const validCards: SerpCard[] = cards
        .map((card) => ({
          href: card.href,
          itemId: extractAvitoItemId(card.href),
        }))
        .filter((card) => Boolean(card.itemId));

      await page.close().catch(() => {});

      if (validCards.length === 0 && attempt < maxRetries) {
        await sleep(randomInt(2000, 4000) * attempt);
        continue;
      }

      return { cards: validCards, captcha: false, pageText };
    } catch {
      await page.close().catch(() => {});
      if (attempt < maxRetries) {
        await sleep(randomInt(2000, 5000) * attempt);
        continue;
      }
      return { cards: [], captcha: false, pageText: "" };
    }
  }

  return { cards: [], captcha: false, pageText: "" };
}

// ---------------------------------------------------------------------------
// Главная функция
// ---------------------------------------------------------------------------

export async function getBidderPosition(params: {
  searchUrl: string | null;
  avitoItemId: string;
}): Promise<BidderPositionResult> {
  if (!params.searchUrl?.trim()) {
    return {
      position: null,
      source: "avito_serp_error",
      page: null,
      searchUrl: "",
      details: "Проверка позиции не выполнена.",
      error:
        "У bidder-а не указана ссылка поиска Авито. Добавьте ссылку поисковой выдачи в настройки bidder-а.",
    };
  }

  let normalizedSearchUrl: string;

  try {
    normalizedSearchUrl = validateAvitoSearchUrl(params.searchUrl);
  } catch (error) {
    return {
      position: null,
      source: "avito_serp_error",
      page: null,
      searchUrl: params.searchUrl,
      details: "Проверка позиции не выполнена.",
      error:
        error instanceof Error
          ? error.message
          : "Некорректная ссылка поисковой выдачи Авито.",
    };
  }

  const targetItemId = String(params.avitoItemId).trim();

  if (!/^\d+$/.test(targetItemId)) {
    return {
      position: null,
      source: "avito_serp_error",
      page: null,
      searchUrl: normalizedSearchUrl,
      details: "Проверка позиции не выполнена.",
      error: "Avito itemId должен быть числом.",
    };
  }

  const maxPages = getMaxPages();
  const timeoutMs = getTimeoutMs();
  const pool = getProxyPool();

  // Нет прокси — одна попытка напрямую, как раньше
  if (pool.length === 0) {
    const outcome = await checkWithProxy(null, normalizedSearchUrl, targetItemId, maxPages, timeoutMs, MAX_RETRIES);
    return outcome.result;
  }

  // Есть пул — пробуем прокси по очереди, пока не получим позицию
  const failures: string[] = [];
  let lastFailure: BidderPositionResult | null = null;

  for (const proxy of orderProxies(pool)) {
    // Ротационный шлюз — несколько попыток (каждая с новым IP).
    // Прокси со ссылкой смены IP — 1 + BIDDER_RECONNECT_RETRIES попыток, между ними меняем IP по ссылке.
    const reconnectRetries = proxy.reconnectUrl ? getReconnectRetries() : 0;
    const attempts = proxy.rotating ? getRotatingAttempts() : 1 + reconnectRetries;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const outcome = await checkWithProxy(proxy, normalizedSearchUrl, targetItemId, maxPages, timeoutMs, MAX_RETRIES_WITH_POOL);
      if (outcome.done) {
        markProxyOk(proxy);
        return outcome.result;
      }
      lastFailure = outcome.result;

      if (proxy.reconnectUrl) {
        // Меняем IP (и после последней неудачи тоже — чтобы следующая проверка шла уже с новым адресом)
        const changed = await reconnectProxy(proxy);
        if (attempt < attempts) await sleep(changed ? getReconnectWaitMs() : randomInt(3000, 6000));
        else if (changed) await sleep(Math.min(getReconnectWaitMs(), 8000));
      } else if (attempt < attempts) {
        await sleep(randomInt(1500, 3500)); // небольшая пауза перед следующим IP
      }

      if (attempt >= attempts) {
        markProxyFailed(proxy);
        failures.push(proxy.rotating || attempts > 1 ? `${proxy.label} ×${attempts}` : proxy.label);
      }
    }
  }

  // ЗАПАСНОЙ ВАРИАНТ: все прокси перебраны и выдачу получить не удалось (капча, блок, сбой прокси) —
  // последняя попытка напрямую, с IP самого VPS-сервера, как это было раньше без прокси.
  // Отключить можно строкой BIDDER_DIRECT_FALLBACK=false в .env.
  if ((process.env.BIDDER_DIRECT_FALLBACK ?? "true").trim().toLowerCase() !== "false") {
    console.log("[bidder-position] все прокси не дали выдачу — пробуем напрямую с IP сервера");
    const direct = await checkWithProxy(null, normalizedSearchUrl, targetItemId, maxPages, timeoutMs, MAX_RETRIES);
    if (direct.done) return direct.result;
    lastFailure = direct.result;
    failures.push("напрямую с сервера");
  }

  const base = lastFailure ?? {
    position: null,
    source: "avito_serp_error" as const,
    page: null,
    searchUrl: normalizedSearchUrl,
    details: "Проверка позиции завершилась с ошибкой.",
    error: "Не удалось проверить выдачу Авито.",
  };
  return {
    ...base,
    details: `${base.details} Перебрано прокси: ${failures.length} (${failures.join(", ")}).`,
    error: `${base.error ?? "Не удалось проверить выдачу Авито."} Ни один из способов (${failures.length}) не получил выдачу.`,
  };
}

/**
 * Одна проверка через один прокси (или напрямую, если proxy = null).
 * done = true — результат окончательный (позиция найдена, либо честно «не в первых 50»);
 * done = false — капча, блокировка или ошибка соединения: нужно пробовать следующий прокси.
 */
async function checkWithProxyInner(
  holder: { browser: Browser | null },
  proxy: BidderProxy | null,
  normalizedSearchUrl: string,
  targetItemId: string,
  maxPages: number,
  timeoutMs: number,
  maxRetries: number,
): Promise<{ done: boolean; result: BidderPositionResult }> {
  let browser: Browser | null = null;

  try {
    browser = await launchBrowser(proxy ?? undefined);
    holder.browser = browser;
    const context = await createContext(browser, Boolean(proxy));

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const pageUrl = getSearchUrlForPage(normalizedSearchUrl, pageNumber);

      const { cards: validCards, captcha, pageText } = await fetchWithRetry(
        context,
        pageUrl,
        pageNumber,
        timeoutMs,
        maxRetries,
      );

      if (captcha) {
        return {
          done: false,
          result: {
            position: null,
            source: "avito_serp_error",
            page: pageNumber,
            searchUrl: pageUrl,
            details: "Авито не предоставил поисковую выдачу.",
            error: "Авито запросил CAPTCHA или ограничил доступ к выдаче. CPX-ставка не изменялась.",
          },
        };
      }

      if (pageNumber === 1 && validCards.length === 0) {
        return {
          done: false,
          result: {
            position: null,
            source: "avito_serp_error",
            page: 1,
            searchUrl: pageUrl,
            details: `Карточки объявлений не найдены в HTML выдачи.${pageText.trim() ? ` Что показал Авито: «${pageText.replace(/\s+/g, " ").trim().slice(0, 160)}».` : " Страница пришла пустой или не загрузилась."}`,
            error: "Не удалось прочитать карточки поиска Авито. CPX-ставка не изменялась.",
          },
        };
      }

      const itemIndex = validCards.findIndex((card) => card.itemId === targetItemId);

      if (itemIndex >= 0) {
        const position = (pageNumber - 1) * validCards.length + itemIndex + 1;
        return {
          done: true,
          result: {
            position,
            source: "avito_serp_playwright",
            page: pageNumber,
            searchUrl: pageUrl,
            details: `Объявление найдено в поисковой выдаче Авито: позиция ${position}, страница ${pageNumber}.`,
            error: null,
          },
        };
      }
    }

    return {
      done: true,
      result: {
        position: 51,
        source: "avito_serp_first_page_not_found",
        page: 1,
        searchUrl: normalizedSearchUrl,
        details:
          "Объявление не найдено среди первых 50 карточек первой страницы выдачи Авито. " +
          "Для алгоритма bidder-а используется позиция 51 (ниже первой страницы).",
        error: null,
      },
    };
  } catch (error) {
    // В сообщение об ошибке пароль прокси попасть не должен: берём только текст ошибки браузера
    const reason = error instanceof Error ? error.message.split("\n")[0] : "";
    return {
      done: false,
      result: {
        position: null,
        source: "avito_serp_error",
        page: null,
        searchUrl: normalizedSearchUrl,
        details: "Проверка позиции завершилась с ошибкой.",
        error: reason
          ? `Не удалось проверить выдачу Авито: ${reason}`
          : "Не удалось проверить выдачу Авито. CPX-ставка не изменялась.",
      },
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

/** Жёсткий предел времени на одну попытку через один прокси (мс). Зависший браузер принудительно закрывается. */
function getAttemptDeadlineMs() {
  const value = Number(process.env.BIDDER_POSITION_ATTEMPT_DEADLINE_MS ?? "110000");
  return Number.isInteger(value) ? Math.min(Math.max(value, 30_000), 240_000) : 110_000;
}

/**
 * Одна проверка через один прокси с жёстким ограничением по времени.
 * Если страница «зависла» (медленный канал, прокси не отвечает) — попытка прерывается,
 * браузер закрывается, и проверка переходит к следующему прокси. Так worker не может «повиснуть».
 */
async function checkWithProxy(
  proxy: BidderProxy | null,
  normalizedSearchUrl: string,
  targetItemId: string,
  maxPages: number,
  timeoutMs: number,
  maxRetries: number,
): Promise<{ done: boolean; result: BidderPositionResult }> {
  const holder: { browser: Browser | null } = { browser: null };
  const deadlineMs = getAttemptDeadlineMs();
  const startedAt = Date.now();
  const label = proxy ? proxy.label : "без прокси";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<{ done: boolean; result: BidderPositionResult }>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve({
        done: false,
        result: {
          position: null,
          source: "avito_serp_error",
          page: null,
          searchUrl: normalizedSearchUrl,
          details: "Проверка позиции прервана по времени.",
          error: `Прокси ${label} не успел получить выдачу за ${Math.round(deadlineMs / 1000)} с.`,
        },
      });
    }, deadlineMs);
  });

  const outcome = await Promise.race([
    checkWithProxyInner(holder, proxy, normalizedSearchUrl, targetItemId, maxPages, timeoutMs, maxRetries),
    timeoutPromise,
  ]);
  if (timer) clearTimeout(timer);

  if (timedOut) {
    // Принудительно закрываем зависший браузер (но не ждём его дольше 5 секунд)
    await Promise.race([holder.browser?.close().catch(() => undefined), sleep(5000)]);
  }
  // Пароль прокси в лог не попадает — только адрес:порт
  console.log(`[bidder-position] ${label}: ${outcome.done ? "готово" : "неудача"} за ${Math.round((Date.now() - startedAt) / 1000)} с${timedOut ? " (прервано по времени)" : ""}`);
  return outcome;
}
