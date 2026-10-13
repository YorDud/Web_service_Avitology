// Проверка скорости прокси для бид-менеджера.
// Запуск из корня проекта:
//   node scripts/proxy-speed-test.mjs "https://www.avito.ru/moskva?q=airpods"
// Ссылку поиска возьмите из настроек вашего бидера (любую поисковую выдачу Авито).
// Прокси читаются из .env (строка BIDDER_PROXIES), так же, как их использует сайт.
// Пароли в вывод не попадают. Скрипт ничего не меняет в проекте и базе.
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

function loadEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();

const searchUrl = process.argv[2];
const runs = Number(process.argv[3] ?? 3);
if (!searchUrl || !/avito\.ru/i.test(searchUrl)) {
  console.log('Укажите ссылку поиска Авито: node scripts/proxy-speed-test.mjs "https://www.avito.ru/moskva?q=airpods" [число_проверок]');
  process.exit(1);
}

function parseProxy(raw) {
  let text = raw.trim();
  if (!text) return null;
  let scheme = "http";
  const sm = text.match(/^(https?|socks5h?|socks4):\/\//i);
  if (sm) { scheme = sm[1].toLowerCase(); text = text.slice(sm[0].length); }
  let host, port, username, password;
  if (text.includes("@")) {
    const at = text.lastIndexOf("@");
    const cred = text.slice(0, at); const addr = text.slice(at + 1).split(":");
    host = addr[0]; port = addr[1];
    const c = cred.indexOf(":"); username = c >= 0 ? cred.slice(0, c) : cred; password = c >= 0 ? cred.slice(c + 1) : undefined;
  } else {
    const p = text.split(":"); host = p[0]; port = p[1];
    if (p.length >= 3) username = p[2];
    if (p.length >= 4) password = p.slice(3).join(":");
  }
  if (!host || !/^\d{2,5}$/.test(port ?? "")) return null;
  return { label: `${host}:${port}`, server: `${scheme}://${host}:${port}`, username, password };
}

const proxies = ((process.env.BIDDER_PROXIES ?? "") + ";" + (process.env.BIDDER_ROTATING_PROXIES ?? "")).split(/[;\n\r]+/).map(parseProxy).filter(Boolean);
if (proxies.length === 0) { console.log("В .env не найдена строка BIDDER_PROXIES или BIDDER_ROTATING_PROXIES."); process.exit(1); }

const sec = (ms) => (ms / 1000).toFixed(1) + " с";
const CAPTCHA = /captcha|проверка\s+безопасности|доступ\s+ограничен|не\s+робот|access\s+denied|проблема с ip/i;

async function oneRun(proxy) {
  const out = { launch: null, home: null, search: null, firstCard: null, cards: 0, mb: 0, captcha: false, error: null, snippet: "" };
  let browser;
  try {
    let t = Date.now();
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BIDDER_CHROME_EXECUTABLE_PATH ? { executablePath: process.env.BIDDER_CHROME_EXECUTABLE_PATH } : process.platform === "win32" ? { channel: "chrome" } : {}),
      proxy: { server: proxy.server, ...(proxy.username ? { username: proxy.username } : {}), ...(proxy.password ? { password: proxy.password } : {}) },
    });
    const context = await browser.newContext({ locale: "ru-RU", timezoneId: "Europe/Moscow", viewport: { width: 1440, height: 900 } });
    // как на сайте: картинки и шрифты через прокси не грузим
    await context.route("**/*", (route) => ["image", "font", "media", "websocket"].includes(route.request().resourceType()) ? route.abort() : route.continue());
    const page = await context.newPage();
    page.setDefaultTimeout(120_000);
    const sizes = [];
    page.on("requestfinished", (req) => { sizes.push(req.sizes().then((s) => (s.responseBodySize ?? 0) + (s.responseHeadersSize ?? 0)).catch(() => 0)); });
    out.launch = Date.now() - t;

    t = Date.now();
    await page.goto("https://www.avito.ru", { waitUntil: "domcontentloaded", timeout: 120_000 }).catch((e) => { out.error = "главная: " + String(e.message).split("\n")[0]; });
    out.home = Date.now() - t;

    t = Date.now();
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    out.search = Date.now() - t;
    const t2 = Date.now();
    await page.locator('[data-marker="item"]').first().waitFor({ state: "attached", timeout: 60_000 }).then(() => { out.firstCard = Date.now() - t2; }).catch(() => {});
    out.cards = await page.locator('[data-marker="item"]').count().catch(() => 0);
    const text = await page.locator("body").innerText().catch(() => "");
    out.captcha = CAPTCHA.test(text);
    if (out.cards === 0) out.snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
    out.mb = (await Promise.all(sizes)).reduce((a, b) => a + b, 0) / 1048576;
  } catch (e) {
    out.error = String(e.message).split("\n")[0];
  } finally {
    await browser?.close().catch(() => {});
  }
  return out;
}

console.log(`Проверяем ${proxies.length} прокси, по ${runs} раз(а) каждый. Это займёт несколько минут...\n`);
const totals = [];
for (const proxy of proxies) {
  console.log(`=== ${proxy.label} ===`);
  for (let i = 1; i <= runs; i++) {
    const r = await oneRun(proxy);
    const total = (r.launch ?? 0) + (r.home ?? 0) + (r.search ?? 0) + (r.firstCard ?? 0);
    if (!r.error && r.cards > 0) totals.push(total);
    console.log(
      `  #${i}: запуск ${r.launch !== null ? sec(r.launch) : "—"}, главная ${r.home !== null ? sec(r.home) : "—"}, выдача ${r.search !== null ? sec(r.search) : "—"}, ` +
      `карточки ${r.firstCard !== null ? "через " + sec(r.firstCard) : "не появились"} (найдено ${r.cards}), трафик ${r.mb.toFixed(2)} МБ, итого ${sec(total)}` +
      (r.captcha ? "  ← КАПЧА/ОГРАНИЧЕНИЕ" : "") + (r.error ? `  ← ошибка: ${r.error}` : "") + (r.snippet ? `\n      Что показал Авито: «${r.snippet}»` : "")
    );
  }
}
console.log("");
if (totals.length === 0) {
  console.log("Ни одна проверка не дошла до карточек. Дело не во времени: смотрите строки «Что показал Авито» и «ошибка» выше и пришлите их.");
} else {
  const worst = Math.max(...totals);
  const attempt = Math.min(180_000, Math.max(60_000, Math.ceil((worst * 2) / 5000) * 5000));
  const nav = Math.min(60_000, Math.max(30_000, Math.ceil((worst * 1.2) / 5000) * 5000));
  console.log(`Самая долгая успешная проверка: ${sec(worst)}.`);
  console.log("Рекомендуемые значения с запасом ×2 для .env:");
  console.log(`  BIDDER_POSITION_TIMEOUT_MS=${nav}`);
  console.log(`  BIDDER_POSITION_ATTEMPT_DEADLINE_MS=${attempt}`);
}
