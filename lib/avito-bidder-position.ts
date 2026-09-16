import { chromium } from "playwright";

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

function getMaxPages() {
  // Bidder анализирует строго первую страницу выдачи.
  // Если объявления нет среди первых 50 результатов,
  // для алгоритма используется техническая позиция 51.
  return 1;
}

function getTimeoutMs() {
  const value = Number(process.env.BIDDER_POSITION_TIMEOUT_MS ?? "30000");

  if (!Number.isInteger(value)) {
    return 30_000;
  }

  return Math.min(Math.max(value, 10_000), 60_000);
}

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

async function launchBrowser() {
  const executablePath = process.env.BIDDER_CHROME_EXECUTABLE_PATH?.trim();

  if (executablePath) {
    return chromium.launch({
      executablePath,
      headless: true,
    });
  }

  if (process.platform === "win32") {
    return chromium.launch({
      channel: "chrome",
      headless: true,
    });
  }

  return chromium.launch({
    headless: true,
  });
}

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
        "У bidder-а не указана ссылка поиска Авито. Добавьте ссылку поисковой выдачи в настройках bidder-а.",
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
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser();

    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const pageUrl = getSearchUrlForPage(normalizedSearchUrl, pageNumber);

      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      await page.waitForTimeout(1500);

      const pageText = await page.locator("body").innerText().catch(() => "");

      if (
        /captcha|проверка безопасности|доступ ограничен|подтвердите, что вы не робот/i.test(
          pageText,
        )
      ) {
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

      await page
        .locator('[data-marker="item"]')
        .first()
        .waitFor({ state: "attached", timeout: Math.min(timeoutMs, 15_000) })
        .catch(() => null);

      const cards = await page.locator('[data-marker="item"]').evaluateAll(
        (elements) =>
          elements.map((element) => {
            const anchors = Array.from(
              element.querySelectorAll<HTMLAnchorElement>("a[href]"),
            );

            const href =
              anchors.find((anchor) =>
                /_\d+(?:[/?#]|$)/.test(anchor.href),
              )?.href ?? "";

            return { href };
          }),
      );

      const validCards: SerpCard[] = cards
        .map((card) => ({
          href: card.href,
          itemId: extractAvitoItemId(card.href),
        }))
        .filter((card) => Boolean(card.itemId));

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
  // На первой странице выдачи Авито 50 карточек.
  // Если объявление не найдено, оно находится ниже первой страницы.
  // Для decision engine это консервативно считается позицией 51.
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