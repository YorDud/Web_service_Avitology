let avitologyPanel = null;
let avitologyToggleBtn = null;
let avitologyInlineContainer = null;
let lastUrl = location.href;
let autoSearchTimer = null;

let currentRows = [];
let currentSellerRows = [];
let currentTab = "positions";

let checkedPositionIds = new Set();
let checkedSellerIds = new Set();

let tableScrollTopByTab = {
  positions: 0,
  sellers: 0
};

let lastRowsSignature = "";
let extraPanelOpen = false;

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

function isSearchPage() {
  const url = location.href;
  return (
    url.includes("/all?") ||
    url.includes("?q=") ||
    !!document.querySelector('[data-marker="catalog-serp"]') ||
    !!document.querySelector('[data-marker="item"]')
  );
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
    await loadData({ auto: false });
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

function getStatusEl() {
  return document.querySelector("#avitology-status");
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
    'div[data-item-id]',
    'article'
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
    'strong',
    'span'
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

function cleanupSellerText(value) {
  return normalizeSellerName(value);
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
    /(\S)(\d[.,]\d)/g, // Илья5,0 -> Илья 5,0
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
    /\bВчера\b.*$/i
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
    /магазин/gi
  ];

  garbagePatterns.forEach((pattern) => {
    text = text.replace(pattern, " ");
  });

  text = text.replace(/[0-9]+[.,]?[0-9]*/g, " ").trim();
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return "Без имени";

  const parts = text
    .split(/ {2,}|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  const bestPart =
    parts.find(
      (item) =>
        item.length >= 2 &&
        item.length <= 40 &&
        !/отзыв|рейтинг|проверен|продавец|помогаю/i.test(item)
    ) || text;

  text = bestPart.trim();

  if (text.length > 40) {
    const words = text.split(" ");
    text = words.slice(0, 3).join(" ").trim();
  }

  text = text.replace(/[^\p{L}\p{N}\s\-_.]/gu, "").trim();
  text = text.replace(/\s+/g, " ").trim();

  if (!text || text.length < 2) return "Без имени";

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
    !!element.querySelector('a[href]');

  const hasLink = !!element.querySelector('a[href]');
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
      card
    };
  });

  const unique = [];
  const seen = new Set();

  for (const row of rows) {
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
      tableScrollTopByTab,
      filters,
      extraPanelOpen
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

    currentTab = data.currentTab || "positions";
    checkedPositionIds = new Set(data.checkedPositionIds || []);
    checkedSellerIds = new Set(data.checkedSellerIds || []);
    tableScrollTopByTab = {
      positions: data.tableScrollTopByTab?.positions || 0,
      sellers: data.tableScrollTopByTab?.sellers || 0
    };
    extraPanelOpen = !!data.extraPanelOpen;

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
      </div>

      <div class="avitology-tabs">
        <button class="avitology-tab active" data-tab="positions">По позициям в поиске</button>
        <button class="avitology-tab" data-tab="sellers">По продавцам</button>
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
      currentTab = tab.getAttribute("data-tab") || "positions";
      closeExtraPanelAndReset();
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

  if (panel) {
    panel.style.display = "none";
  }

  if (arrow) {
    arrow.textContent = "▼";
  }

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
      currentTab = "positions";
      extraPanelOpen = false;
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

function renderPositionsTable(rows) {
  const wrap = getInlineTableWrapEl();
  const summary = getInlineSummaryEl();
  if (!wrap || !summary) return;

  const filteredRows = applyPositionFilters(rows);

  summary.textContent = `Показано результатов: ${filteredRows.length} из ${rows.length}`;

  wrap.innerHTML = `
    <div id="avitology-inline-table-scroller" class="avitology-inline-table-scroll">
      <table class="avitology-table">
        <thead>
          <tr>
            <th>Пометить</th>
            <th>Позиция</th>
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

              return `
                <tr>
                  <td>
                    <input
                      class="avitology-checkbox"
                      type="checkbox"
                      data-row-index="${index}"
                      ${checked}
                    />
                  </td>
                  <td>${row.position}</td>
                  <td title="${escapeHtml(row.title)}">${escapeHtml(row.title)}</td>
                  <td>${escapeHtml(row.price || "—")}</td>
                  <td>${escapeHtml(row.seller || "—")}</td>
                  <td>${escapeHtml(row.rating || "—")}</td>
                  <td>${escapeHtml(row.reviews || "—")}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  const scroller = document.querySelector("#avitology-inline-table-scroller");
  if (scroller) {
    scroller.addEventListener("scroll", () => {
      tableScrollTopByTab.positions = scroller.scrollTop;
    });
  }

  const checkboxes = wrap.querySelectorAll(".avitology-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const target = event.target;
      const index = Number(target.getAttribute("data-row-index"));
      const row = filteredRows[index];

      if (!row) return;

      saveCurrentTableScroll();

      if (target.checked) {
        checkedPositionIds.add(row.id);
        if (row.card) row.card.classList.add("avitology-highlighted");
      } else {
        checkedPositionIds.delete(row.id);
        if (row.card) row.card.classList.remove("avitology-highlighted");
      }

      restoreCurrentTableScroll();
	  saveExtensionState();
    });
  });

  rows.forEach((row) => {
    if (checkedPositionIds.has(row.id) && row.card) {
      row.card.classList.add("avitology-highlighted");
    }
  });

  restoreCurrentTableScroll();
}

function renderSellersTable(rows) {
  const wrap = getInlineTableWrapEl();
  const summary = getInlineSummaryEl();
  if (!wrap || !summary) return;

  const filteredRows = applySellerFilters(rows);

  summary.textContent = `Показано продавцов: ${filteredRows.length} из ${rows.length}`;

  wrap.innerHTML = `
    <div id="avitology-inline-table-scroller" class="avitology-inline-table-scroll">
      <table class="avitology-table">
        <thead>
          <tr>
            <th>Пометить в выдаче</th>
            <th>Аккаунт</th>
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
                  <td>${escapeHtml(row.seller)}</td>
                  <td>${row.count}</td>
                  <td>${escapeHtml(row.positions.join(", "))}</td>
                  <td>${escapeHtml(row.rating || "—")}</td>
                  <td>${escapeHtml(row.reviews || "—")}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  const scroller = document.querySelector("#avitology-inline-table-scroller");
  if (scroller) {
    scroller.addEventListener("scroll", () => {
      tableScrollTopByTab.sellers = scroller.scrollTop;
    });
  }

  const checkboxes = wrap.querySelectorAll(".avitology-seller-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const target = event.target;
      const index = Number(target.getAttribute("data-seller-index"));
      const row = filteredRows[index];

      if (!row) return;

      const sellerKey = getSellerKey(row.seller);

      saveCurrentTableScroll();

      if (target.checked) {
        checkedSellerIds.add(sellerKey);
        row.cards.forEach((card) => {
          if (card) card.classList.add("avitology-highlighted");
        });
      } else {
        checkedSellerIds.delete(sellerKey);
        row.cards.forEach((card) => {
          if (card) card.classList.remove("avitology-highlighted");
        });
      }

      restoreCurrentTableScroll();
	  saveExtensionState();
    });
  });

  rows.forEach((row) => {
    const sellerKey = getSellerKey(row.seller);
    if (checkedSellerIds.has(sellerKey)) {
      row.cards.forEach((card) => {
        if (card) card.classList.add("avitology-highlighted");
      });
    }
  });

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

async function loadData({ auto = false } = {}) {
  const statusEl = getStatusEl();

  if (!isSearchPage()) {
    removeInlineContainerIfExists();
    if (statusEl) {
      statusEl.className = "avitology-status warning";
      statusEl.textContent =
        "Сейчас не страница поиска. Таблицы доступны только после поиска на Авито.";
    }
    return;
  }

  if (statusEl) {
    statusEl.className = "avitology-status warning";
    statusEl.textContent = auto
      ? "Обнаружено обновление поисковой выдачи. Автоматически анализируем..."
      : "Идет анализ страницы...";
  }

  const access = await checkAccess();
  if (!access) {
    removeInlineContainerIfExists();
    return;
  }

  const cards = getAvitoCards();
  const rows = buildRows(cards);

  if (!rows.length) {
    removeInlineContainerIfExists();
    if (statusEl) {
      statusEl.className = "avitology-status warning";
      statusEl.textContent =
        "На странице поиска пока не найдено объявлений для таблиц.";
    }
    return;
  }

  const newSignature = rows
    .map((row) => `${row.id}|${row.position}|${row.title}|${row.price}|${row.seller}`)
    .join("::");

  const shouldRerender =
    !avitologyInlineContainer ||
    newSignature !== lastRowsSignature;

  currentRows = rows;
  currentSellerRows = buildSellerRows(rows);

  if (!shouldRerender && auto) {
    if (statusEl) {
      statusEl.className = "avitology-status success";
      statusEl.textContent = `Найдено карточек: ${rows.length}, продавцов: ${currentSellerRows.length}.`;
    }
    return;
  }

  lastRowsSignature = newSignature;

    ensureInlineContainer();
  renderCurrentTab();
  saveExtensionState();

  if (statusEl) {
    statusEl.className = "avitology-status success";
    statusEl.textContent = `Найдено карточек: ${rows.length}, продавцов: ${currentSellerRows.length}.`;
  }
}

function watchUrlChanges() {
  setInterval(async () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastRowsSignature = "";
      tableScrollTopByTab.positions = 0;
      tableScrollTopByTab.sellers = 0;

      checkedPositionIds = new Set();
      checkedSellerIds = new Set();
      currentTab = "positions";
      extraPanelOpen = false;

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

      await loadExtensionState();

      if (!isSearchPage()) {
        removeInlineContainerIfExists();
      } else {
        scheduleAutoLoad();
      }
    }
  }, 600);
}

function scheduleAutoLoad() {
  if (autoSearchTimer) {
    clearTimeout(autoSearchTimer);
  }

  autoSearchTimer = setTimeout(() => {
    loadData({ auto: true });
  }, 1000);
}

function bindSearchTriggers() {
  document.addEventListener(
    "click",
    (event) => {
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
        scheduleAutoLoad();
        return;
      }

      const hasSuggestionRole =
        clickable.getAttribute("role") === "option" ||
        clickable.closest('[role="option"]') ||
        clickable.closest('[class*="suggest"]') ||
        clickable.closest('[data-marker*="suggest"]');

      if (hasSuggestionRole) {
        scheduleAutoLoad();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        scheduleAutoLoad();
      }
    },
    true
  );

  const observer = new MutationObserver(() => {
    if (isSearchPage()) {
      scheduleAutoLoad();
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

    if (isSearchPage()) {
      scheduleAutoLoad();
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
    scheduleAutoLoad();
  }
}

init();