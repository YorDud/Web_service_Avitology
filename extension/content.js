let avitologyPanel = null;
let avitologyToggleBtn = null;
let avitologyInlineContainer = null;
let lastUrl = location.href;
let autoSearchTimer = null;

let currentRows = [];
let currentSellerRows = [];
let currentTab = "sellers";

let checkedPositionIds = new Set();
let checkedSellerIds = new Set();
const highlightedAccounts = new Set();

let tableScrollTopByTab = {
  positions: 0,
  sellers: 0
};

let lastRowsSignature = "";
let extraPanelOpen = false;
let avitologyTableExpanded = false;

let isBuildingAvitology = false;
let hasBuiltTableForThisPage = false;
let initialLoadingVisible = false;

let filters = {
  positions: {
    search: "",
    onlyChecked: false,
    sortBy: "position",
    sortDir: "asc"
  },
  sellers: {
    search: "",
    onlyChecked: false,
    sortBy: "firstPosition",
    sortDir: "asc"
  }
};

const AVITO_PROMO_ICONS = {
  promoted: "https://avito.st/static/ims/6ba093ad-c4a4-4287-bcea-6a820b9112f1_cpx_promo_common.svg",
  placement: "https://www.avito.st/s/common/components/monetization/icons/web/bbip.svg",
  highlight: "https://www.avito.st/s/common/components/monetization/icons/web/highlight.svg",
  xl: "https://www.avito.st/s/common/components/monetization/icons/web/xl.svg"
};

function isSearchPage() {
  const url = location.href;
  return (
    url.includes("/all?") ||
    url.includes("?q=") ||
    !!document.querySelector('[data-marker="catalog-serp"]') ||
    !!document.querySelector('[data-marker="item"]')
  );
}

function getStatusEl() {
  return document.querySelector("#avitology-status");
}

function findInsertionPoint() {
  const serp = document.querySelector('[data-marker="catalog-serp"]');
  if (serp) return serp;

  const main = document.querySelector("main");
  if (main) return main;

  return null;
}

function removeInlineContainerIfExists() {
  const existing = document.querySelector("#avitology-inline-container");
  if (existing) existing.remove();
  avitologyInlineContainer = null;
}

function ensureInlineLoadingContainer() {
  if (!isSearchPage()) return null;

  let existing = document.querySelector("#avitology-inline-loading-container");
  if (existing) return existing;

  const insertionPoint = findInsertionPoint();
  if (!insertionPoint) return null;

  existing = document.createElement("div");
  existing.id = "avitology-inline-loading-container";
  existing.innerHTML = `
    <div class="avitology-inline-loading-box">
      <div class="avitology-inline-loading-inner">
        <img
          src="https://avitology.site/logo.png"
          alt="Авитология"
          class="avitology-inline-loading-logo"
        />
        <div class="avitology-inline-loading-texts">
          <div class="avitology-inline-loading-title">Авитология загружает данные</div>
          <div class="avitology-inline-loading-subtitle">Это занимает совсем немного времени</div>
        </div>
        <div class="avitology-inline-loading-spinner"></div>
      </div>
    </div>
  `;

  insertionPoint.prepend(existing);
  initialLoadingVisible = true;
  return existing;
}

function removeInlineLoadingContainerIfExists() {
  const el = document.querySelector("#avitology-inline-loading-container");
  if (el) el.remove();
  initialLoadingVisible = false;
}

function showInitialLoadingIfNeeded() {
  if (!isSearchPage()) return;
  if (hasBuiltTableForThisPage) return;
  ensureInlineLoadingContainer();
}

function hideInitialLoading() {
  removeInlineLoadingContainerIfExists();
}

function ensurePanel() {
  if (avitologyPanel) return avitologyPanel;

  avitologyPanel = document.createElement("div");
  avitologyPanel.id = "avitology-panel";
  avitologyPanel.innerHTML = `
    <div class="avitology-panel-header">
      <div class="avitology-panel-title">Авитология</div>
      <div class="avitology-panel-subtitle">Управление инструментом</div>
    </div>
    <div class="avitology-panel-content">
      <div id="avitology-status" class="avitology-status warning">
        Ожидание страницы поиска Авито...
      </div>

      <div class="avitology-actions">
        <button id="avitology-load-btn" class="avitology-btn primary">Обновить анализ</button>
        <button id="avitology-hide-btn" class="avitology-btn secondary">Скрыть</button>
      </div>
    </div>
  `;

  document.body.appendChild(avitologyPanel);
  avitologyPanel.style.display = "none";

  const hideBtn = avitologyPanel.querySelector("#avitology-hide-btn");
  hideBtn.addEventListener("click", () => {
    hidePanel();
  });

  const loadBtn = avitologyPanel.querySelector("#avitology-load-btn");
  loadBtn.addEventListener("click", async () => {
    await forceReloadData();
  });

  document.addEventListener("click", handleOutsideClick, true);

  return avitologyPanel;
}

function handleOutsideClick(event) {
  if (!avitologyPanel || avitologyPanel.style.display === "none") return;
  if (avitologyPanel.contains(event.target)) return;
  if (avitologyToggleBtn && avitologyToggleBtn.contains(event.target)) return;
  hidePanel();
}

function hidePanel() {
  if (!avitologyPanel) return;
  avitologyPanel.style.display = "none";
  ensureToggleButton().style.display = "flex";
}

function showPanel() {
  const panel = ensurePanel();
  panel.style.display = "block";
  ensureToggleButton().style.display = "flex";
}

function ensureToggleButton() {
  if (avitologyToggleBtn) return avitologyToggleBtn;

  avitologyToggleBtn = document.createElement("button");
  avitologyToggleBtn.id = "avitology-toggle-btn";
  avitologyToggleBtn.textContent = "Avitology";
  avitologyToggleBtn.style.position = "fixed";
  avitologyToggleBtn.style.right = "20px";
  avitologyToggleBtn.style.bottom = "20px";
  avitologyToggleBtn.style.zIndex = "999999";
  avitologyToggleBtn.style.background = "linear-gradient(180deg, #10d95c 0%, #03bd48 100%)";
  avitologyToggleBtn.style.color = "#fff";
  avitologyToggleBtn.style.border = "none";
  avitologyToggleBtn.style.borderRadius = "14px";
  avitologyToggleBtn.style.padding = "12px 16px";
  avitologyToggleBtn.style.fontSize = "14px";
  avitologyToggleBtn.style.fontWeight = "700";
  avitologyToggleBtn.style.cursor = "pointer";
  avitologyToggleBtn.style.boxShadow = "0 12px 20px rgba(3, 189, 72, 0.22)";
  avitologyToggleBtn.style.display = "flex";

  avitologyToggleBtn.addEventListener("click", () => {
    if (avitologyPanel && avitologyPanel.style.display !== "none") {
      hidePanel();
    } else {
      showPanel();
    }
  });

  document.body.appendChild(avitologyToggleBtn);
  return avitologyToggleBtn;
}

async function getSavedAccessState() {
  if (!globalThis.extApi) return null;
  const result = await globalThis.extApi.storage.local.get("avitologyAccessState");
  return result.avitologyAccessState || null;
}

async function checkAccess() {
  const statusEl = getStatusEl();
  if (!statusEl) return false;

  statusEl.className = "avitology-status warning";
  statusEl.textContent = "Проверяем сохраненный статус доступа...";

  try {
    const state = await getSavedAccessState();

    if (!state) {
      statusEl.className = "avitology-status warning";
      statusEl.textContent =
        "Нет данных о доступе. Откройте popup расширения и нажмите «Обновить статус».";
      return false;
    }

    if (!state.authenticated) {
      statusEl.className = "avitology-status error";
      statusEl.textContent =
        "Расширение не видит авторизацию. Откройте popup и обновите статус после входа на сайт.";
      return false;
    }

    if (!state.access) {
      statusEl.className = "avitology-status warning";
      statusEl.textContent =
        "Нет доступа к услуге. Нужна подписка Basic или Admin.";
      return false;
    }

    if (!isSearchPage()) {
      statusEl.className = "avitology-status warning";
      statusEl.textContent =
        "Таблицы работают только на страницах поиска Авито.";
      return false;
    }

    statusEl.className = "avitology-status success";
    statusEl.textContent =
      "Доступ подтвержден. Можно анализировать результаты поиска.";
    return true;
  } catch (error) {
    console.error("Avitology storage access error:", error);
    statusEl.className = "avitology-status error";
    statusEl.textContent = "Ошибка доступа к данным расширения.";
    return false;
  }
}

function getAvitoCards() {
  const selectors = [
    '[data-marker="item"]',
    '[data-marker="catalog-serp"] > *',
    '[itemtype="http://schema.org/Product"]',
    "div[data-item-id]",
    "article"
  ];

  let bestNodes = [];

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector)).filter((el) => {
      return isLikelyAdCard(el);
    });

    if (nodes.length > bestNodes.length) {
      bestNodes = nodes;
    }
  }

  return bestNodes;
}

function extractText(selectors, root) {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function extractLink(root) {
  const linkEl =
    root.querySelector('a[href*="/item"]') ||
    root.querySelector('a[itemprop="url"]') ||
    root.querySelector("a[href]");

  if (!linkEl) return "";

  const href = linkEl.getAttribute("href") || "";
  if (!href) return "";

  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `https://www.avito.ru${href}`;
  return href;
}

function extractPrice(root) {
  const strictCandidates = [
    '[data-marker="item-price"]',
    '[itemprop="price"]'
  ];

  for (const selector of strictCandidates) {
    const el = root.querySelector(selector);
    const text = normalizeWhitespace(el?.textContent || "");
    if (text && /₽|руб/i.test(text)) {
      return text;
    }
  }

  const softCandidates = [
    '[class*="price"]',
    '[class*="cost"]',
    "strong",
    "span"
  ];

  for (const selector of softCandidates) {
    const elements = Array.from(root.querySelectorAll(selector));
    for (const el of elements) {
      const text = normalizeWhitespace(el.textContent || "");
      if (text && /₽|руб/i.test(text)) {
        return text;
      }
    }
  }

  const fullText = normalizeWhitespace(root.textContent || "");
  const match = fullText.match(/\d[\d\s]{1,15}(₽|руб)/i);
  return match ? normalizeWhitespace(match[0]) : "—";
}

function extractSeller(root) {
  const strictCandidates = [
    '[data-marker="seller-info/name"]',
    '[data-marker="sellerName"]',
    '[data-marker="item-sellerInfo"] a',
    '[data-marker="item-sellerInfo"] span',
    'a[href*="/user/"]',
    'a[href*="/profile"]'
  ];

  for (const selector of strictCandidates) {
    const elements = Array.from(root.querySelectorAll(selector));
    for (const el of elements) {
      const raw = (el.textContent || "").trim();
      const text = normalizeSellerName(raw);

      if (isLikelySellerName(text)) {
        return text;
      }
    }
  }

  const sellerContainers = [
    '[data-marker="item-sellerInfo"]',
    '[class*="seller"]',
    '[class*="profile"]',
    '[class*="owner"]'
  ];

  for (const selector of sellerContainers) {
    const containers = Array.from(root.querySelectorAll(selector));

    for (const container of containers) {
      const directChildrenTexts = Array.from(container.querySelectorAll("*"))
        .map((el) => (el.textContent || "").trim())
        .map((text) => normalizeSellerName(text))
        .filter((text) => isLikelySellerName(text));

      if (directChildrenTexts.length) {
        directChildrenTexts.sort((a, b) => a.length - b.length);
        return directChildrenTexts[0];
      }

      const raw = (container.textContent || "").trim();

      const splitCandidates = raw
        .replace(/([^\s])(\d[.,]\d)/g, "$1|$2")
        .replace(/([^\s])(яПомогаю)/gi, "$1|$2")
        .replace(/([^\s])(Над[её]жный продавец)/gi, "$1|$2")
        .replace(/([^\s])(Реквизиты проверены)/gi, "$1|$2")
        .split(/[|\n]| {2,}/)
        .map((item) => normalizeSellerName(item))
        .filter((item) => isLikelySellerName(item));

      if (splitCandidates.length) {
        splitCandidates.sort((a, b) => a.length - b.length);
        return splitCandidates[0];
      }
    }
  }

  const allTexts = Array.from(root.querySelectorAll("a, span, div"))
    .map((el) => (el.textContent || "").trim())
    .filter(Boolean)
    .map((text) => normalizeSellerName(text))
    .filter((text) => isLikelySellerName(text));

  if (allTexts.length) {
    allTexts.sort((a, b) => a.length - b.length);
    return allTexts[0];
  }

  return "Без имени";
}

function extractRating(root) {
  const strictCandidates = [
    '[data-marker="seller-rating"]',
    '[aria-label*="рейтинг"]'
  ];

  for (const selector of strictCandidates) {
    const elements = Array.from(root.querySelectorAll(selector));
    for (const el of elements) {
      const raw = normalizeWhitespace(
        el.getAttribute("aria-label") || el.textContent || ""
      );
      const match = raw.match(/(\d+[.,]\d+|\d+)/);
      if (match) {
        const value = match[1].replace(",", ".");
        const num = Number(value);
        if (num >= 0 && num <= 5) {
          return value;
        }
      }
    }
  }

  const allText = normalizeWhitespace(root.textContent || "");
  const pairMatch = allText.match(/(\d+[.,]\d+)\s*[·•]?\s*(\d[\d\s]*)\s*(отзыв|отзыва|отзывов)/i);

  if (pairMatch) {
    const value = pairMatch[1].replace(",", ".");
    const num = Number(value);
    if (num >= 0 && num <= 5) {
      return value;
    }
  }

  return "—";
}

function extractReviews(root) {
  const strictCandidates = [
    '[data-marker="seller-review"]',
    '[aria-label*="отзыв"]'
  ];

  for (const selector of strictCandidates) {
    const elements = Array.from(root.querySelectorAll(selector));
    for (const el of elements) {
      const raw = normalizeWhitespace(
        el.getAttribute("aria-label") || el.textContent || ""
      );
      const match = raw.match(/(\d[\d\s]*)\s*(отзыв|отзыва|отзывов)/i);
      if (match) {
        return match[1].replace(/\s+/g, "");
      }
    }
  }

  const allText = normalizeWhitespace(root.textContent || "");
  const pairMatch = allText.match(/(\d+[.,]\d+)\s*[·•]?\s*(\d[\d\s]*)\s*(отзыв|отзыва|отзывов)/i);
  if (pairMatch) {
    return pairMatch[2].replace(/\s+/g, "");
  }

  const match = allText.match(/(\d[\d\s]*)\s*(отзыв|отзыва|отзывов)/i);
  if (match) {
    return match[1].replace(/\s+/g, "");
  }

  return "—";
}

function normalizePriceNumber(priceText) {
  const onlyDigits = String(priceText || "").replace(/[^\d]/g, "");
  return onlyDigits ? Number(onlyDigits) : null;
}

function normalizeNumberValue(value) {
  if (value === "—" || value == null || value === "") return -1;
  const num = Number(String(value).replace(",", "."));
  return Number.isFinite(num) ? num : -1;
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeSellerName(value) {
  let text = String(value || "");

  if (!text) return "Без имени";

  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/[|•·]+/g, " ").trim();

  const hardCutPatterns = [
    /(\S)(\d[.,]\d)/g,
    /(\D)(\d{2,}\s*(?:отзыв|отзыва|отзывов))/gi,
    /(\D)(яПомогаю)/gi,
    /(\D)(Над[её]жный продавец)/gi,
    /(\D)(Реквизиты проверены)/gi,
    /(\D)(Документы проверены)/gi
  ];

  hardCutPatterns.forEach((pattern) => {
    text = text.replace(pattern, "$1 $2");
  });

  text = text.replace(/\s+/g, " ").trim();

  const stopPatterns = [
    /\b\d[.,]\d\b.*$/i,
    /\b\d+\s*(отзыв|отзыва|отзывов)\b.*$/i,
    /\bяПомогаю\b.*$/i,
    /\bНад[её]жный продавец\b.*$/i,
    /\bРеквизиты проверены\b.*$/i,
    /\bДокументы проверены\b.*$/i,
    /\bПроверенный продавец\b.*$/i,
    /\bПроверенный профиль\b.*$/i,
    /\bДоставка\b.*$/i,
    /\bКомпания\b.*$/i,
    /\bМагазин\b.*$/i,
    /\bОнлайн\b.*$/i,
    /\bСегодня\b.*$/i,
    /\bВчера\b.*$/i,
    /\bПоиск\b.*$/i,
    /\bФильтры\b.*$/i,
    /\bСохранить поиск\b.*$/i,
    /\bОбъявления\b.*$/i
  ];

  for (const pattern of stopPatterns) {
    text = text.replace(pattern, "").trim();
  }

  text = text.replace(/\b\d+\b$/g, "").trim();
  text = text.replace(/\s+/g, " ").trim();

  const garbagePatterns = [
    /над[её]жный продавец/gi,
    /реквизиты проверены/gi,
    /документы проверены/gi,
    /проверенный продавец/gi,
    /проверенный профиль/gi,
    /отзыв(?:а|ов)?/gi,
    /рейтинг/gi,
    /яПомогаю/gi,
    /онлайн/gi,
    /сегодня/gi,
    /вчера/gi,
    /доставка/gi,
    /компания/gi,
    /магазин/gi,
    /поиск/gi,
    /фильтры/gi,
    /сохранить поиск/gi,
    /объявления/gi
  ];

  garbagePatterns.forEach((pattern) => {
    text = text.replace(pattern, " ");
  });

  text = text.replace(/[0-9]+[.,]?[0-9]*/g, " ").trim();
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return "Без имени";

  const badExact = new Set([
    "поиск",
    "фильтры",
    "объявления",
    "сегодня",
    "вчера",
    "доставка",
    "магазин",
    "компания",
    "онлайн"
  ]);

  if (badExact.has(text.toLowerCase())) {
    return "Без имени";
  }

  const parts = text
    .split(/ {2,}|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  const bestPart =
    parts.find(
      (item) =>
        item.length >= 2 &&
        item.length <= 40 &&
        !/отзыв|рейтинг|проверен|продавец|помогаю|поиск|фильтр|объявлен/i.test(item)
    ) || text;

  text = bestPart.trim();

  if (text.length > 40) {
    const words = text.split(" ");
    text = words.slice(0, 3).join(" ").trim();
  }

  text = text.replace(/[^\p{L}\p{N}\s\-_.]/gu, "").trim();
  text = text.replace(/\s+/g, " ").trim();

  if (!text || text.length < 2) return "Без имени";
  if (badExact.has(text.toLowerCase())) return "Без имени";

  return text;
}

function isLikelySellerName(value) {
  const text = normalizeSellerName(value);

  if (!text || text === "Без имени") return false;
  if (text.length < 2 || text.length > 40) return false;
  if (/^\d+$/.test(text)) return false;
  if (/отзыв|рейтинг|помогаю|проверен|доставка/i.test(text)) return false;
  if (/₽|руб/i.test(text)) return false;

  return true;
}

function isLikelyAdCard(element) {
  const text = normalizeWhitespace(element.textContent || "");

  if (!text || text.length < 20) return false;

  const hasTitle =
    !!element.querySelector('[data-marker="item-title"]') ||
    !!element.querySelector("h3") ||
    !!element.querySelector("a[href]");

  const hasLink = !!element.querySelector("a[href]");
  const hasPrice =
    !!element.querySelector('[data-marker="item-price"]') ||
    /₽|руб/i.test(text);

  return hasTitle && hasLink && hasPrice;
}

function makeRowFingerprint(row) {
  return [
    normalizeWhitespace(row.title).toLowerCase(),
    normalizeWhitespace(row.price).toLowerCase(),
    normalizeWhitespace(row.seller).toLowerCase()
  ].join(" | ");
}

function detectPromotionIconsFromCard(card) {
  const className = String(card.className || "");
  const icons = [];

  const hasPromoted =
    !!card.querySelector('[class*="arrow-_7e8a483d725ed77f"]') ||
    !!card.querySelector('[class*="arrow-"] img[src*="ca5e4a9966826af1.svg"]');

  const hasXL = /\bxl-[^\s]+/.test(className);
  const hasHighlight = !!card.querySelector('[class*="yellowHighlight"]');

  if (hasPromoted) {
    icons.push(AVITO_PROMO_ICONS.promoted);
  }

  if (hasHighlight) {
    icons.push(AVITO_PROMO_ICONS.highlight);
  }

  if (hasXL) {
    icons.push(AVITO_PROMO_ICONS.xl);
  }

  return {
    icons,
    loaded: true
  };
}

function buildRows(cards) {
  if (!cards.length) return [];

  const rows = cards.slice(0, 100).map((card, index) => {
    const title =
      extractText(
        [
          '[data-marker="item-title"]',
          "h3",
          '[itemprop="name"]',
          'a[title]',
          "a[href]"
        ],
        card
      ) || `Объявление ${index + 1}`;

    const link = extractLink(card);
    const price = extractPrice(card);
    const promotions = detectPromotionIconsFromCard(card);
    const seller = normalizeSellerName(extractSeller(card)) || "Без имени";
    const rating = extractRating(card);
    const reviews = extractReviews(card);

    return {
      id: `row-${index + 1}`,
      title: normalizeWhitespace(title),
      link,
      price: normalizeWhitespace(price),
      priceNumber: normalizePriceNumber(price),
      seller,
      position: index + 1,
      rating,
      reviews,
      promotions,
      card
    };
  });

  const filtered = rows.filter((row) => {
    const title = normalizeWhitespace(row.title || "");
    const price = normalizeWhitespace(row.price || "");
    const seller = normalizeWhitespace(row.seller || "");

    if (!title) return false;
    if (/^\d+$/.test(title)) return false;
    if (title.length < 3) return false;
    if (price && title === price) return false;
    if (/^\d[\d\s₽руб.,-]*$/i.test(title)) return false;

    const badTitlePatterns = [
      /^поиск$/i,
      /^сортировка$/i,
      /^фильтры$/i,
      /^написать$/i,
      /^ещ[её] фото$/i,
      /^показать телефон$/i,
      /^позвонить$/i,
      /^контакты$/i,
      /^описание$/i,
      /^объявления$/i
    ];

    if (badTitlePatterns.some((pattern) => pattern.test(title))) return false;
    if (!row.link) return false;
    if (/^\d+(\s+\d+){2,}/.test(title)) return false;

    if (
      seller &&
      /^(поиск|сортировка|фильтры|написать|ещ[её] фото)$/i.test(seller) &&
      title.length < 8
    ) {
      return false;
    }

    return true;
  });

  const unique = [];
  const seen = new Set();

  for (const row of filtered) {
    const fingerprint = makeRowFingerprint(row);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    unique.push(row);
  }

  return unique.map((row, index) => ({
    ...row,
    id: `row-${index + 1}`,
    position: index + 1
  }));
}

function buildSellerRows(rows) {
  const map = new Map();

  for (const row of rows) {
    const cleanSeller = normalizeSellerName(row.seller) || "Без имени";
    const sellerKey = getSellerKey(cleanSeller);

    if (!map.has(sellerKey)) {
      map.set(sellerKey, {
        seller: cleanSeller,
        positions: [],
        count: 0,
        rating: row.rating || "—",
        reviews: row.reviews || "—",
        cards: [],
        ads: [],
        firstPosition: row.position
      });
    }

    const sellerRow = map.get(sellerKey);

    if (!sellerRow.positions.includes(row.position)) {
      sellerRow.positions.push(row.position);
    }

    sellerRow.count += 1;

    if (row.card && !sellerRow.cards.includes(row.card)) {
      sellerRow.cards.push(row.card);
    }

    sellerRow.ads.push({
      id: row.id,
      title: row.title,
      price: row.price,
      position: row.position,
      link: row.link,
      promotions: row.promotions || { icons: [], loaded: true }
    });

    if (sellerRow.rating === "—" && row.rating !== "—") {
      sellerRow.rating = row.rating;
    }

    if (sellerRow.reviews === "—" && row.reviews !== "—") {
      sellerRow.reviews = row.reviews;
    }

    if (row.position < sellerRow.firstPosition) {
      sellerRow.firstPosition = row.position;
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      seller: normalizeSellerName(item.seller),
      positions: item.positions.sort((a, b) => a - b)
    }))
    .sort((a, b) => a.firstPosition - b.firstPosition);
}

function renderPromotionBadges(promotions) {
  if (!promotions || !Array.isArray(promotions.icons) || !promotions.icons.length) {
    return "";
  }

  return promotions.icons
    .map((src) => {
      let title = "Продвижение";

      if (src.includes("cpx_promo_common.svg")) {
        title = "Продвинуто";
      } else if (src.includes("/bbip.svg")) {
        title = "Размещение";
      } else if (src.includes("/highlight.svg")) {
        title = "Выделено";
      } else if (src.includes("/xl.svg")) {
        title = "XL";
      }

      return `
        <img
          src="${escapeAttr(src)}"
          alt="${escapeAttr(title)}"
          title="${escapeAttr(title)}"
          class="avitology-promo-real-icon"
          loading="lazy"
        />
      `;
    })
    .join("");
}

function getSellerKey(value) {
  return String(value || "Без имени").trim().toLowerCase();
}

function getPageStateKey() {
  return `avitology_state_${location.pathname}${location.search}`;
}

async function saveExtensionState() {
  try {
    const data = {
      currentTab,
      checkedPositionIds: Array.from(checkedPositionIds),
      checkedSellerIds: Array.from(checkedSellerIds),
      highlightedAccounts: Array.from(highlightedAccounts),
      tableScrollTopByTab,
      filters,
      extraPanelOpen,
      avitologyTableExpanded
    };

    await globalThis.extApi.storage.local.set({
      [getPageStateKey()]: data
    });
  } catch (error) {
    console.error("Avitology save state error:", error);
  }
}

async function loadExtensionState() {
  try {
    if (!globalThis.extApi) return;
    const result = await globalThis.extApi.storage.local.get(getPageStateKey());
    const data = result[getPageStateKey()];

    if (!data) return;

    currentTab = data.currentTab || "sellers";
    checkedPositionIds = new Set(data.checkedPositionIds || []);
    checkedSellerIds = new Set(data.checkedSellerIds || []);
    highlightedAccounts.clear();
    (data.highlightedAccounts || []).forEach((item) => highlightedAccounts.add(item));

    tableScrollTopByTab = {
      positions: data.tableScrollTopByTab?.positions || 0,
      sellers: data.tableScrollTopByTab?.sellers || 0
    };

    extraPanelOpen = !!data.extraPanelOpen;
    avitologyTableExpanded = !!data.avitologyTableExpanded;

    filters = {
      positions: {
        search: data.filters?.positions?.search || "",
        onlyChecked: !!data.filters?.positions?.onlyChecked,
        sortBy: data.filters?.positions?.sortBy || "position",
        sortDir: data.filters?.positions?.sortDir || "asc"
      },
      sellers: {
        search: data.filters?.sellers?.search || "",
        onlyChecked: !!data.filters?.sellers?.onlyChecked,
        sortBy: data.filters?.sellers?.sortBy || "firstPosition",
        sortDir: data.filters?.sellers?.sortDir || "asc"
      }
    };
  } catch (error) {
    console.error("Avitology load state error:", error);
  }
}

async function resetExtensionState() {
  try {
    if (!globalThis.extApi) return;
    await globalThis.extApi.storage.local.remove(getPageStateKey());
  } catch (error) {
    console.error("Avitology reset state error:", error);
  }
}

function ensureInlineContainer() {
  if (!isSearchPage()) return null;

  if (avitologyInlineContainer && document.body.contains(avitologyInlineContainer)) {
    return avitologyInlineContainer;
  }

  removeInlineContainerIfExists();

  const insertionPoint = findInsertionPoint();
  if (!insertionPoint) return null;

  avitologyInlineContainer = document.createElement("div");
  avitologyInlineContainer.id = "avitology-inline-container";
  avitologyInlineContainer.innerHTML = `
    <div class="avitology-inline-box">
      <div class="avitology-inline-header">
        <div>
          <div class="avitology-inline-title">Авитология — результаты анализа</div>
          <div class="avitology-inline-subtitle">Поиск, сортировка, фильтры и экспорт</div>
        </div>

        <a
          href="https://avitology.site"
          target="_blank"
          rel="noreferrer"
          class="avitology-brand-card"
        >
          <img
            src="https://avitology.site/logo.png"
            alt="Авитология"
            class="avitology-brand-logo"
          />
          <div>
            <div class="avitology-brand-title">Авитология</div>
            <div class="avitology-brand-link">avitology.site</div>
          </div>
        </a>
      </div>

      <div class="avitology-tabs">
        <button class="avitology-tab active" data-tab="sellers">По продавцам</button>
        <button class="avitology-tab" data-tab="positions">По позициям в поиске</button>
      </div>

      <div class="avitology-extra-wrap">
        <button id="avitology-extra-toggle" class="avitology-extra-toggle" type="button">
          <span id="avitology-extra-arrow">▼</span>
          <span>Дополнительно</span>
        </button>

        <div id="avitology-extra-panel" class="avitology-extra-panel" style="display: none;">
          <div class="avitology-toolbar">
            <input
              id="avitology-table-search"
              class="avitology-toolbar-input"
              type="text"
              placeholder="Поиск по текущей вкладке..."
            />

            <select id="avitology-sort-by" class="avitology-toolbar-select"></select>

            <select id="avitology-sort-dir" class="avitology-toolbar-select">
              <option value="asc">По возрастанию</option>
              <option value="desc">По убыванию</option>
            </select>

            <label class="avitology-checkbox-label">
              <input id="avitology-only-checked" type="checkbox" />
              Только отмеченные
            </label>

            <button id="avitology-export-btn" class="avitology-toolbar-btn">Экспорт CSV</button>
            <button id="avitology-export-xlsx-btn" class="avitology-toolbar-btn">Экспорт XLSX</button>
            <button id="avitology-clear-btn" class="avitology-toolbar-btn secondary">Снять все отметки</button>
            <button id="avitology-reset-state-btn" class="avitology-toolbar-btn secondary">Сбросить состояние</button>
          </div>
        </div>
      </div>

      <div id="avitology-inline-summary" class="avitology-inline-summary">
        Таблица еще не построена
      </div>

      <div id="avitology-inline-table-wrap"></div>
    </div>
  `;

  insertionPoint.prepend(avitologyInlineContainer);

  const tabs = avitologyInlineContainer.querySelectorAll(".avitology-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      saveCurrentTableScroll();
      currentTab = tab.getAttribute("data-tab") || "sellers";
      updateToolbarState();
      updateActiveTabUi();
      renderCurrentTab();
      saveExtensionState();
    });
  });

  bindToolbarEvents();
  updateToolbarState();

  return avitologyInlineContainer;
}

function resetCurrentTabFilters() {
  if (currentTab === "sellers") {
    filters.sellers = {
      search: "",
      onlyChecked: false,
      sortBy: "firstPosition",
      sortDir: "asc"
    };
  } else {
    filters.positions = {
      search: "",
      onlyChecked: false,
      sortBy: "position",
      sortDir: "asc"
    };
  }
}

function closeExtraPanelAndReset() {
  const panel = document.querySelector("#avitology-extra-panel");
  const arrow = document.querySelector("#avitology-extra-arrow");

  if (panel) panel.style.display = "none";
  if (arrow) arrow.textContent = "▼";

  extraPanelOpen = false;
  resetCurrentTabFilters();
  tableScrollTopByTab[currentTab] = 0;
  updateToolbarState();
  renderCurrentTab();
  saveExtensionState();
}

function toggleExtraPanel() {
  const panel = document.querySelector("#avitology-extra-panel");
  const arrow = document.querySelector("#avitology-extra-arrow");

  if (!panel || !arrow) return;

  const isOpen = panel.style.display !== "none";

  if (isOpen) {
    panel.style.display = "none";
    arrow.textContent = "▼";
    extraPanelOpen = false;
    resetCurrentTabFilters();
    tableScrollTopByTab[currentTab] = 0;
    updateToolbarState();
    renderCurrentTab();
  } else {
    panel.style.display = "block";
    arrow.textContent = "▲";
    extraPanelOpen = true;
    updateToolbarState();
  }

  saveExtensionState();
}

function bindToolbarEvents() {
  const searchInput = document.querySelector("#avitology-table-search");
  const sortBySelect = document.querySelector("#avitology-sort-by");
  const sortDirSelect = document.querySelector("#avitology-sort-dir");
  const onlyCheckedInput = document.querySelector("#avitology-only-checked");
  const exportBtn = document.querySelector("#avitology-export-btn");
  const exportXlsxBtn = document.querySelector("#avitology-export-xlsx-btn");
  const clearBtn = document.querySelector("#avitology-clear-btn");
  const resetStateBtn = document.querySelector("#avitology-reset-state-btn");
  const extraToggleBtn = document.querySelector("#avitology-extra-toggle");

  if (extraToggleBtn) {
    extraToggleBtn.addEventListener("click", () => {
      toggleExtraPanel();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filters[currentTab].search = e.target.value;
      saveCurrentTableScroll();
      tableScrollTopByTab[currentTab] = 0;
      renderCurrentTab();
      saveExtensionState();
    });
  }

  if (sortBySelect) {
    sortBySelect.addEventListener("change", (e) => {
      filters[currentTab].sortBy = e.target.value;
      saveCurrentTableScroll();
      tableScrollTopByTab[currentTab] = 0;
      renderCurrentTab();
      saveExtensionState();
    });
  }

  if (sortDirSelect) {
    sortDirSelect.addEventListener("change", (e) => {
      filters[currentTab].sortDir = e.target.value;
      saveCurrentTableScroll();
      tableScrollTopByTab[currentTab] = 0;
      renderCurrentTab();
      saveExtensionState();
    });
  }

  if (onlyCheckedInput) {
    onlyCheckedInput.addEventListener("change", (e) => {
      filters[currentTab].onlyChecked = e.target.checked;
      saveCurrentTableScroll();
      tableScrollTopByTab[currentTab] = 0;
      renderCurrentTab();
      saveExtensionState();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportCurrentTabToCsv();
    });
  }

  if (exportXlsxBtn) {
    exportXlsxBtn.addEventListener("click", () => {
      exportReportToXlsx();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearAllMarks();
      renderCurrentTab();
      saveExtensionState();
    });
  }

  if (resetStateBtn) {
    resetStateBtn.addEventListener("click", async () => {
      checkedPositionIds.clear();
      checkedSellerIds.clear();
      highlightedAccounts.clear();
      currentTab = "sellers";
      extraPanelOpen = false;
      avitologyTableExpanded = false;
      tableScrollTopByTab = { positions: 0, sellers: 0 };

      filters = {
        positions: {
          search: "",
          onlyChecked: false,
          sortBy: "position",
          sortDir: "asc"
        },
        sellers: {
          search: "",
          onlyChecked: false,
          sortBy: "firstPosition",
          sortDir: "asc"
        }
      };

      clearAllMarks();
      await resetExtensionState();
      closeExtraPanelAndReset();
      renderCurrentTab();
    });
  }
}

function updateToolbarState() {
  const searchInput = document.querySelector("#avitology-table-search");
  const sortBySelect = document.querySelector("#avitology-sort-by");
  const sortDirSelect = document.querySelector("#avitology-sort-dir");
  const onlyCheckedInput = document.querySelector("#avitology-only-checked");

  if (searchInput) {
    searchInput.value = filters[currentTab].search;
  }

  if (sortDirSelect) {
    sortDirSelect.value = filters[currentTab].sortDir;
  }

  if (onlyCheckedInput) {
    onlyCheckedInput.checked = filters[currentTab].onlyChecked;
  }

  if (sortBySelect) {
    const options =
      currentTab === "positions"
        ? [
            ["position", "Позиция"],
            ["title", "Объявление"],
            ["price", "Цена"],
            ["seller", "Продавец"],
            ["rating", "Рейтинг"],
            ["reviews", "Отзывы"]
          ]
        : [
            ["seller", "Продавец"],
            ["count", "Кол-во объявлений"],
            ["firstPosition", "Первая позиция"],
            ["rating", "Рейтинг"],
            ["reviews", "Отзывы"]
          ];

    sortBySelect.innerHTML = options
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");

    sortBySelect.value = filters[currentTab].sortBy;
  }
}

function updateActiveTabUi() {
  const container = document.querySelector("#avitology-inline-container");
  if (!container) return;

  const tabs = container.querySelectorAll(".avitology-tab");
  tabs.forEach((tab) => {
    const tabName = tab.getAttribute("data-tab");
    if (tabName === currentTab) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });
}

function getInlineSummaryEl() {
  return document.querySelector("#avitology-inline-summary");
}

function getInlineTableWrapEl() {
  return document.querySelector("#avitology-inline-table-wrap");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function saveCurrentTableScroll() {
  const scroller = document.querySelector("#avitology-inline-table-scroller");
  if (!scroller) return;
  tableScrollTopByTab[currentTab] = scroller.scrollTop;
}

function restoreCurrentTableScroll() {
  const scroller = document.querySelector("#avitology-inline-table-scroller");
  if (!scroller) return;

  const top = tableScrollTopByTab[currentTab] || 0;

  requestAnimationFrame(() => {
    scroller.scrollTop = top;
  });
}

function applyPositionFilters(rows) {
  let result = [...rows];
  const state = filters.positions;
  const query = state.search.trim().toLowerCase();

  if (query) {
    result = result.filter((row) => {
      const haystack = [
        row.position,
        row.title,
        row.price,
        row.seller,
        row.rating,
        row.reviews
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  if (state.onlyChecked) {
    result = result.filter((row) => checkedPositionIds.has(row.id));
  }

  result.sort((a, b) => {
    let av;
    let bv;

    switch (state.sortBy) {
      case "title":
        av = a.title.toLowerCase();
        bv = b.title.toLowerCase();
        break;
      case "price":
        av = a.priceNumber ?? -1;
        bv = b.priceNumber ?? -1;
        break;
      case "seller":
        av = a.seller.toLowerCase();
        bv = b.seller.toLowerCase();
        break;
      case "rating":
        av = normalizeNumberValue(a.rating);
        bv = normalizeNumberValue(b.rating);
        break;
      case "reviews":
        av = normalizeNumberValue(a.reviews);
        bv = normalizeNumberValue(b.reviews);
        break;
      case "position":
      default:
        av = a.position;
        bv = b.position;
        break;
    }

    if (av < bv) return state.sortDir === "asc" ? -1 : 1;
    if (av > bv) return state.sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return result;
}

function applySellerFilters(rows) {
  let result = [...rows];
  const state = filters.sellers;
  const query = state.search.trim().toLowerCase();

  if (query) {
    result = result.filter((row) => {
      const haystack = [
        row.seller,
        row.count,
        row.positions.join(" "),
        row.rating,
        row.reviews
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  if (state.onlyChecked) {
    result = result.filter((row) => checkedSellerIds.has(getSellerKey(row.seller)));
  }

  result.sort((a, b) => {
    let av;
    let bv;

    switch (state.sortBy) {
      case "seller":
        av = a.seller.toLowerCase();
        bv = b.seller.toLowerCase();
        break;
      case "count":
        av = a.count;
        bv = b.count;
        break;
      case "rating":
        av = normalizeNumberValue(a.rating);
        bv = normalizeNumberValue(b.rating);
        break;
      case "reviews":
        av = normalizeNumberValue(a.reviews);
        bv = normalizeNumberValue(b.reviews);
        break;
      case "firstPosition":
      default:
        av = a.firstPosition;
        bv = b.firstPosition;
        break;
    }

    if (av < bv) return state.sortDir === "asc" ? -1 : 1;
    if (av > bv) return state.sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return result;
}

function highlightCheckedCards() {
  currentRows.forEach((row) => {
    if (!row.card) return;

    const sellerKey = getSellerKey(row.seller);
    const shouldHighlight =
      checkedPositionIds.has(row.id) ||
      checkedSellerIds.has(sellerKey) ||
      highlightedAccounts.has(normalizeWhitespace(row.seller || "Без имени"));

    if (shouldHighlight) {
      row.card.classList.add("avitology-highlighted");
    } else {
      row.card.classList.remove("avitology-highlighted");
    }
  });
}

function renderExpandButton() {
  return `
    <div class="avitology-table-expand-wrap">
      <button
        type="button"
        id="avitology-expand-table-btn"
        class="avitology-table-expand-btn"
      >
        ${avitologyTableExpanded ? "Свернуть таблицу" : "Развернуть все позиции"}
      </button>
    </div>
  `;
}

function bindExpandButton(callback) {
  const expandBtn = document.querySelector("#avitology-expand-table-btn");
  if (!expandBtn) return;

  expandBtn.addEventListener("click", () => {
    saveCurrentTableScroll();
    avitologyTableExpanded = !avitologyTableExpanded;
    callback();
    saveExtensionState();
  });
}

function renderPositionsTable(rows) {
  const wrap = getInlineTableWrapEl();
  const summary = getInlineSummaryEl();
  if (!wrap || !summary) return;

  const filteredRows = applyPositionFilters(rows);

  summary.textContent = `Показано результатов: ${filteredRows.length} из ${rows.length}`;

  wrap.innerHTML = `
    <div
      id="avitology-inline-table-scroller"
      class="avitology-inline-table-scroll ${avitologyTableExpanded ? "expanded" : ""}"
    >
      <table class="avitology-table">
        <thead>
          <tr>
            <th class="avitology-check-col">✓</th>
            <th class="avitology-position-col">Позиция</th>
            <th>Объявление</th>
            <th>Цена</th>
            <th>Аккаунт</th>
            <th>Рейтинг</th>
            <th>Отзывы</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRows
            .map((row, index) => {
              const checked = checkedPositionIds.has(row.id) ? "checked" : "";
              const sellerHighlighted = highlightedAccounts.has(
                normalizeWhitespace(row.seller || "Без имени")
              )
                ? "avitology-seller-highlight"
                : "";

              const safeUrl = row.link ? escapeAttr(row.link) : "";
              const positionBadge = safeUrl
                ? `
                  <a
                    href="${safeUrl}"
                    target="_blank"
                    rel="noreferrer"
                    class="avitology-position-badge"
                    title="Открыть объявление"
                  >
                    ${row.position}
                  </a>
                `
                : `<span class="avitology-position-badge">${row.position}</span>`;

              const positionHtml = `
                <div class="avitology-position-badges">
                  ${positionBadge}
                  ${renderPromotionBadges(row.promotions)}
                </div>
              `;

              return `
                <tr class="${sellerHighlighted}">
                  <td>
                    <input
                      class="avitology-checkbox"
                      type="checkbox"
                      data-row-index="${index}"
                      ${checked}
                    />
                  </td>
                  <td class="avitology-position-col-cell">${positionHtml}</td>
                  <td title="${escapeAttr(row.title)}">
                    ${
                      safeUrl
                        ? `<a href="${safeUrl}" target="_blank" rel="noreferrer" class="avitology-title-link">${escapeHtml(row.title)}</a>`
                        : escapeHtml(row.title)
                    }
                  </td>
                  <td><span class="avitology-price-nowrap">${escapeHtml(row.price || "—")}</span></td>
                  <td>${escapeHtml(row.seller && row.seller !== "Без имени" ? row.seller : "—")}</td>
                  <td>${escapeHtml(row.rating || "—")}</td>
                  <td>${escapeHtml(row.reviews || "—")}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    ${renderExpandButton()}
  `;

  const scroller = document.querySelector("#avitology-inline-table-scroller");
  if (scroller) {
    scroller.addEventListener("scroll", () => {
      tableScrollTopByTab.positions = scroller.scrollTop;
    });
  }

  bindExpandButton(() => renderPositionsTable(rows));

  const checkboxes = wrap.querySelectorAll("[data-row-index]");
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const rowIndex = Number(
        event.currentTarget.getAttribute("data-row-index")
      );
      const row = filteredRows[rowIndex];
      if (!row) return;

      if (event.currentTarget.checked) {
        checkedPositionIds.add(row.id);
      } else {
        checkedPositionIds.delete(row.id);
      }

      highlightCheckedCards();
      saveExtensionState();
    });
  });

  highlightCheckedCards();
  restoreCurrentTableScroll();
}

function renderSellersTable(rows) {
  const wrap = getInlineTableWrapEl();
  const summary = getInlineSummaryEl();
  if (!wrap || !summary) return;

  const filteredRows = applySellerFilters(rows);

  summary.textContent = `Показано продавцов: ${filteredRows.length} из ${rows.length}`;

  wrap.innerHTML = `
    <div
      id="avitology-inline-table-scroller"
      class="avitology-inline-table-scroll ${avitologyTableExpanded ? "expanded" : ""}"
    >
      <table class="avitology-table">
        <thead>
          <tr>
            <th class="avitology-check-col">✓</th>
            <th>Продавец</th>
            <th>Объявлений</th>
            <th>Позиции в выдаче</th>
            <th>Рейтинг</th>
            <th>Отзывы</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRows
            .map((row, index) => {
              const sellerKey = getSellerKey(row.seller);
              const checked = checkedSellerIds.has(sellerKey) ? "checked" : "";
              const accountActive = highlightedAccounts.has(
                normalizeWhitespace(row.seller || "Без имени")
              )
                ? "active"
                : "";

              const positionsHtml = row.ads
                .map((item) => {
                  const safeUrl = item.link ? escapeAttr(item.link) : "";

                  const positionBadge = safeUrl
                    ? `
                      <a
                        href="${safeUrl}"
                        target="_blank"
                        rel="noreferrer"
                        class="avitology-position-badge"
                        title="Открыть объявление"
                      >
                        ${item.position}
                      </a>
                    `
                    : `<span class="avitology-position-badge">${item.position}</span>`;

                  return `
                    <div class="avitology-position-badge-row">
                      ${positionBadge}
                      ${renderPromotionBadges(item.promotions)}
                    </div>
                  `;
                })
                .join("");

              return `
                <tr>
                  <td>
                    <input
                      class="avitology-seller-checkbox"
                      type="checkbox"
                      data-seller-index="${index}"
                      ${checked}
                    />
                  </td>
                  <td class="avitology-seller-cell">
                    <button
                      type="button"
                      class="avitology-account-chip ${accountActive}"
                      data-account-name="${escapeAttr(normalizeWhitespace(row.seller || "Без имени"))}"
                    >
                      ${escapeHtml(row.seller)}
                    </button>
                  </td>
                  <td>${row.count}</td>
                  <td>
                    <div class="avitology-position-badges avitology-seller-positions-list">
                      ${positionsHtml}
                    </div>
                  </td>
                  <td>${escapeHtml(row.rating || "—")}</td>
                  <td>${escapeHtml(row.reviews || "—")}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    ${renderExpandButton()}
  `;

  const scroller = document.querySelector("#avitology-inline-table-scroller");
  if (scroller) {
    scroller.addEventListener("scroll", () => {
      tableScrollTopByTab.sellers = scroller.scrollTop;
    });
  }

  bindExpandButton(() => renderSellersTable(rows));

  const accountButtons = wrap.querySelectorAll("[data-account-name]");
  accountButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const accountName = btn.getAttribute("data-account-name") || "";

      if (highlightedAccounts.has(accountName)) {
        highlightedAccounts.delete(accountName);
      } else {
        highlightedAccounts.add(accountName);
      }

      renderSellersTable(rows);
      highlightCheckedCards();
      saveExtensionState();
    });
  });

  const checkboxes = wrap.querySelectorAll(".avitology-seller-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const target = event.target;
      const index = Number(target.getAttribute("data-seller-index"));
      const row = filteredRows[index];

      if (!row) return;

      const sellerKey = getSellerKey(row.seller);

      if (target.checked) {
        checkedSellerIds.add(sellerKey);
      } else {
        checkedSellerIds.delete(sellerKey);
      }

      highlightCheckedCards();
      saveExtensionState();
    });
  });

  highlightCheckedCards();
  restoreCurrentTableScroll();
}

function renderCurrentTab() {
  ensureInlineContainer();
  updateActiveTabUi();
  updateToolbarState();

  const panel = document.querySelector("#avitology-extra-panel");
  const arrow = document.querySelector("#avitology-extra-arrow");

  if (panel && arrow) {
    panel.style.display = extraPanelOpen ? "block" : "none";
    arrow.textContent = extraPanelOpen ? "▲" : "▼";
  }

  if (currentTab === "sellers") {
    renderSellersTable(currentSellerRows);
  } else {
    renderPositionsTable(currentRows);
  }

  saveExtensionState();
}

function clearAllMarks() {
  checkedPositionIds.clear();
  checkedSellerIds.clear();
  highlightedAccounts.clear();

  currentRows.forEach((row) => {
    if (row.card) row.card.classList.remove("avitology-highlighted");
  });

  currentSellerRows.forEach((row) => {
    row.cards.forEach((card) => {
      if (card) card.classList.remove("avitology-highlighted");
    });
  });
}

function downloadCsv(filename, rows) {
  const csvContent = rows
    .map((row) =>
      row
        .map((value) => {
          const safe = String(value ?? "").replaceAll('"', '""');
          return `"${safe}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function exportCurrentTabToCsv() {
  if (currentTab === "sellers") {
    const rows = applySellerFilters(currentSellerRows);
    const csvRows = [
      ["Аккаунт", "Объявлений", "Позиции в выдаче", "Рейтинг", "Отзывы"],
      ...rows.map((row) => [
        row.seller,
        row.count,
        row.positions.join(", "),
        row.rating,
        row.reviews
      ])
    ];

    downloadCsv(`avitology-sellers-${formatDateForFile()}.csv`, csvRows);
  } else {
    const rows = applyPositionFilters(currentRows);
    const csvRows = [
      ["Позиция", "Объявление", "Цена", "Аккаунт", "Рейтинг", "Отзывы"],
      ...rows.map((row) => [
        row.position,
        row.title,
        row.price,
        row.seller,
        row.rating,
        row.reviews
      ])
    ];

    downloadCsv(`avitology-positions-${formatDateForFile()}.csv`, csvRows);
  }
}

function getSearchQueryFromUrl() {
  try {
    const url = new URL(location.href);
    return url.searchParams.get("q") || "";
  } catch {
    return "";
  }
}

function formatDateForFile(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${hh}-${mi}`;
}

function exportReportToXlsx() {
  if (typeof XLSX === "undefined") {
    alert("Библиотека XLSX не загружена");
    return;
  }

  const wb = XLSX.utils.book_new();

  const filteredPositions = applyPositionFilters(currentRows);
  const filteredSellers = applySellerFilters(currentSellerRows);

  const summaryData = [
    ["Параметр", "Значение"],
    ["Дата выгрузки", new Date().toLocaleString("ru-RU")],
    ["URL поиска", location.href],
    ["Поисковый запрос", getSearchQueryFromUrl() || "—"],
    ["Всего объявлений", currentRows.length],
    ["Всего продавцов", currentSellerRows.length],
    ["Объявлений после фильтра", filteredPositions.length],
    ["Продавцов после фильтра", filteredSellers.length],
    ["Активная вкладка", currentTab === "sellers" ? "По продавцам" : "По позициям в поиске"]
  ];

  const positionsData = [
    ["Позиция", "Объявление", "Цена", "Аккаунт", "Рейтинг", "Отзывы"],
    ...filteredPositions.map((row) => [
      row.position,
      row.title,
      row.price,
      row.seller,
      row.rating,
      row.reviews
    ])
  ];

  const sellersData = [
    ["Аккаунт", "Объявлений", "Позиции в выдаче", "Рейтинг", "Отзывы"],
    ...filteredSellers.map((row) => [
      row.seller,
      row.count,
      row.positions.join(", "),
      row.rating,
      row.reviews
    ])
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  const positionsSheet = XLSX.utils.aoa_to_sheet(positionsData);
  const sellersSheet = XLSX.utils.aoa_to_sheet(sellersData);

  summarySheet["!cols"] = [{ wch: 28 }, { wch: 60 }];
  positionsSheet["!cols"] = [
    { wch: 10 },
    { wch: 50 },
    { wch: 18 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 }
  ];
  sellersSheet["!cols"] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(wb, summarySheet, "Сводка");
  XLSX.utils.book_append_sheet(wb, positionsSheet, "Позиции");
  XLSX.utils.book_append_sheet(wb, sellersSheet, "Продавцы");

  const filename = `avitology-report-${formatDateForFile()}.xlsx`;
  XLSX.writeFile(wb, filename);
}

async function buildTableOnceForCurrentPage({ auto = false } = {}) {
  if (isBuildingAvitology || hasBuiltTableForThisPage) return;
  isBuildingAvitology = true;

  try {
    const statusEl = getStatusEl();

    if (!isSearchPage()) {
      removeInlineContainerIfExists();
      hideInitialLoading();
      return;
    }

    showInitialLoadingIfNeeded();

    if (statusEl) {
      statusEl.className = "avitology-status warning";
      statusEl.textContent = auto
        ? "Обнаружена страница поиска. Загружаем таблицу..."
        : "Идет анализ страницы...";
    }

    const access = await checkAccess();
    if (!access) {
      removeInlineContainerIfExists();
      hideInitialLoading();
      return;
    }

    const cards = getAvitoCards();
    const rows = buildRows(cards);

    if (!rows.length) {
      if (statusEl) {
        statusEl.className = "avitology-status warning";
        statusEl.textContent = "Объявления ещё не появились. Ожидаем загрузку выдачи...";
      }
      return;
    }

    currentRows = rows;
    currentSellerRows = buildSellerRows(rows);
    lastRowsSignature = rows
      .map((row) => `${row.position}|${row.title}|${row.price}|${row.seller}`)
      .join("::");

    hideInitialLoading();
    ensureInlineContainer();
    renderCurrentTab();
    saveExtensionState();

    hasBuiltTableForThisPage = true;

    if (statusEl) {
      statusEl.className = "avitology-status success";
      statusEl.textContent = `Найдено карточек: ${rows.length}, продавцов: ${currentSellerRows.length}.`;
    }
  } finally {
    isBuildingAvitology = false;
  }
}

async function forceReloadData() {
  hasBuiltTableForThisPage = false;
  removeInlineContainerIfExists();
  showInitialLoadingIfNeeded();
  await buildTableOnceForCurrentPage({ auto: false });
}

function scheduleBuildAttempt() {
  if (!isSearchPage()) return;
  if (hasBuiltTableForThisPage) return;
  if (isBuildingAvitology) return;

  if (autoSearchTimer) {
    clearTimeout(autoSearchTimer);
  }

  autoSearchTimer = setTimeout(() => {
    buildTableOnceForCurrentPage({ auto: true });
  }, 700);
}

function resetPageBuildState() {
  hasBuiltTableForThisPage = false;
  isBuildingAvitology = false;
  initialLoadingVisible = false;
  lastRowsSignature = "";
  removeInlineContainerIfExists();
  hideInitialLoading();

  tableScrollTopByTab = {
    positions: 0,
    sellers: 0
  };

  checkedPositionIds = new Set();
  checkedSellerIds = new Set();
  highlightedAccounts.clear();
  currentTab = "sellers";
  extraPanelOpen = false;
  avitologyTableExpanded = false;

  filters = {
    positions: {
      search: "",
      onlyChecked: false,
      sortBy: "position",
      sortDir: "asc"
    },
    sellers: {
      search: "",
      onlyChecked: false,
      sortBy: "firstPosition",
      sortDir: "asc"
    }
  };
}

function watchUrlChanges() {
  setInterval(async () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;

      resetPageBuildState();
      await loadExtensionState();

      if (isSearchPage()) {
        showInitialLoadingIfNeeded();
        scheduleBuildAttempt();
      } else {
        removeInlineContainerIfExists();
        hideInitialLoading();
      }
    }
  }, 500);
}

function bindSearchTriggers() {
  document.addEventListener(
    "click",
    (event) => {
      if (!isSearchPage()) return;
      if (hasBuiltTableForThisPage) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickable = target.closest("button, a, div, li");
      if (!clickable) return;

      const text = (clickable.textContent || "").trim().toLowerCase();

      if (
        text.includes("найти") ||
        text.includes("search") ||
        clickable.getAttribute("type") === "submit"
      ) {
        showInitialLoadingIfNeeded();
        scheduleBuildAttempt();
        return;
      }

      const hasSuggestionRole =
        clickable.getAttribute("role") === "option" ||
        clickable.closest('[role="option"]') ||
        clickable.closest('[class*="suggest"]') ||
        clickable.closest('[data-marker*="suggest"]');

      if (hasSuggestionRole) {
        showInitialLoadingIfNeeded();
        scheduleBuildAttempt();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (!isSearchPage()) return;
      if (hasBuiltTableForThisPage) return;

      if (event.key === "Enter") {
        showInitialLoadingIfNeeded();
        scheduleBuildAttempt();
      }
    },
    true
  );

  const observer = new MutationObserver(() => {
    if (!isSearchPage()) return;
    if (hasBuiltTableForThisPage) return;
    if (document.querySelector('[data-marker="item"]')) {
      showInitialLoadingIfNeeded();
      scheduleBuildAttempt();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function handleAccessStateUpdate(state) {
  const statusEl = getStatusEl();

  if (!state) return;

  if (!state.authenticated || !state.access) {
    removeInlineContainerIfExists();
    hideInitialLoading();

    if (statusEl) {
      statusEl.className = "avitology-status error";
      statusEl.textContent = !state.authenticated
        ? "Доступ отключён: пользователь не авторизован."
        : "Доступ отключён: подписка неактивна.";
    }
  } else {
    if (statusEl) {
      statusEl.className = "avitology-status success";
      statusEl.textContent = "Доступ подтверждён. Расширение активно.";
    }

    if (isSearchPage() && !hasBuiltTableForThisPage) {
      showInitialLoadingIfNeeded();
      scheduleBuildAttempt();
    }
  }
}

function watchAccessStateChanges() {
  const rawApi = globalThis.extApi?.raw;

  if (!rawApi?.storage?.onChanged) return;

  rawApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes.avitologyAccessState) return;

    const newValue = changes.avitologyAccessState.newValue;
    handleAccessStateUpdate(newValue);
  });
}

async function init() {
  ensurePanel();
  ensureToggleButton().style.display = "flex";
  await loadExtensionState();
  checkAccess();
  bindSearchTriggers();
  watchUrlChanges();
  watchAccessStateChanges();

  if (isSearchPage()) {
    showInitialLoadingIfNeeded();
    scheduleBuildAttempt();
  }
}

init();