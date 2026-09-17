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
  const value = Number(process.env.BIDDER_POSITION_TIMEOUT_MS ?? "30000");
  if (!Number.isInteger(value)) return 30_000;
  return Math.min(Math.max(value, 10_000), 60_000);
}

function getProxyConfig() {
  const server = process.env.BIDDER_PROXY_SERVER?.trim();
  if (!server) return undefined;
  const proxy: { server: string; username?: string; password?: string } = { server };
  const username = process.env.BIDDER_PROXY_USERNAME?.trim();
  const password = process.env.BIDDER_PROXY_PASSWORD?.trim();
  if (username) proxy.username = username;
  if (password) proxy.password = password;
  return proxy;
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

async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.BIDDER_CHROME_EXECUTABLE_PATH?.trim();
  const proxy = getProxyConfig();

  const launchOptions: Record<string, unknown> = {
    headless: true,
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  } else if (process.platform === "win32") {
    launchOptions.channel = "chrome";
  }

  if (proxy) {
    launchOptions.proxy = proxy;
  }

  return chromium.launch(launchOptions as any);
}

async function createContext(browser: Browser): Promise<BrowserContext> {
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

async function fetchWithRetry(
  context: BrowserContext,
  pageUrl: string,
  pageNumber: number,
  timeoutMs: number,
): Promise<{ cards: SerpCard[]; captcha: boolean; pageText: string }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    try {
      await applyStealth(page);

      // 1. Сначала «заходим» на главную Avito — получаем cookies
      if (attempt === 1) {
        await page.goto("https://www.avito.ru", {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
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
        if (attempt < MAX_RETRIES) {
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

      if (validCards.length === 0 && attempt < MAX_RETRIES) {
        await sleep(randomInt(2000, 4000) * attempt);
        continue;
      }

      return { cards: validCards, captcha: false, pageText };
    } catch {
      await page.close().catch(() => {});
      if (attempt < MAX_RETRIES) {
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
  let browser: Browser | null = null;

  try {
    browser = await launchBrowser();
    const context = await createContext(browser);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const pageUrl = getSearchUrlForPage(normalizedSearchUrl, pageNumber);

      const { cards: validCards, captcha, pageText } = await fetchWithRetry(
        context,
        pageUrl,
        pageNumber,
        timeoutMs,
      );

      if (captcha) {
        return {
          position: null,
          source: "avito_serp_error",
          page: pageNumber,
          searchUrl: pageUrl,
          details: "Авито не предоставил поисковую выдачу.",
          error:
            "Авито запросил CAPTCHA или ограничил доступ к выдаче. CPX-ставка не изменялась.",
        };
      }

      if (pageNumber === 1 && validCards.length === 0) {
        return {
          position: null,
          source: "avito_serp_error",
          page: 1,
          searchUrl: pageUrl,
          details: "Карточки объявлений не найдены в HTML выдачи.",
          error:
            "Не удалось прочитать карточки поиска Авито. CPX-ставка не изменялась.",
        };
      }

      const itemIndex = validCards.findIndex(
        (card) => card.itemId === targetItemId,
      );

      if (itemIndex >= 0) {
        const position = (pageNumber - 1) * validCards.length + itemIndex + 1;

        return {
          position,
          source: "avito_serp_playwright",
          page: pageNumber,
          searchUrl: pageUrl,
          details: `Объявление найдено в поисковой выдаче Авито: позиция ${position}, страница ${pageNumber}.`,
          error: null,
        };
      }
    }

    return {
      position: 51,
      source: "avito_serp_first_page_not_found",
      page: 1,
      searchUrl: normalizedSearchUrl,
      details:
        "Объявление не найдено среди первых 50 карточек первой страницы выдачи Авито. " +
        "Для алгоритма bidder-а используется позиция 51 (ниже первой страницы).",
      error: null,
    };
  } catch (error) {
    return {
      position: null,
      source: "avito_serp_error",
      page: null,
      searchUrl: normalizedSearchUrl,
      details: "Проверка позиции завершилась с ошибкой.",
      error:
        error instanceof Error
          ? `Не удалось проверить выдачу Авито: ${error.message}`
          : "Не удалось проверить выдачу Авито. CPX-ставка не изменялась.",
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
