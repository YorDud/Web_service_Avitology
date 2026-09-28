/* =========================================================================
   Сборка XML-файла для Автозагрузки Авито и локальная проверка объявлений.
   Чистые функции без обращений к серверу: работают и в API, и в браузере.
   ========================================================================= */
import {
  LIST_SEPARATOR,
  MAX_VALUE_LENGTH,
  isValidTagPath,
  normalizePriceValue,
  type AdData,
} from "./fields";

export type FeedAdInput = { key: string; data: AdData };

export type AdIssue = {
  adKey: string;
  index: number;
  tag: string;
  level: "error" | "warning";
  message: string;
};

const TAG_ORDER = [
  "Id",
  "DateBegin",
  "DateEnd",
  "ListingFee",
  "AdStatus",
  "AllowEmail",
  "ManagerName",
  "ContactPhone",
  "ContactMethod",
  "Address",
  "Category",
  "AdType",
  "GoodsType",
  "Condition",
  "Title",
  "Description",
  "Price",
  "VideoURL",
  "Images",
];

// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

const clean = (value: string) => value.replace(INVALID_XML_CHARS, "");

const escapeText = (value: string) =>
  clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttr = (value: string) => escapeText(value).replace(/"/g, "&quot;");

const cdata = (value: string) =>
  `<![CDATA[${clean(value).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export function splitImages(value: string): string[] {
  return value
    .split(/[\r\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitList(value: string): string[] {
  return value
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Значения объявления перекрывают общие поля; пустые значения берутся из общих. */
export function mergeWithDefaults(defaults: AdData, data: AdData): AdData {
  const merged: AdData = {};
  for (const [tag, value] of Object.entries(defaults)) {
    if (typeof value === "string" && value.trim()) merged[tag] = value.trim();
  }
  for (const [tag, value] of Object.entries(data)) {
    if (typeof value === "string" && value.trim()) merged[tag] = value.trim();
  }
  return merged;
}

function orderTags(tags: string[]) {
  const rank = (tag: string) => {
    const index = TAG_ORDER.indexOf(tag);
    return index === -1 ? TAG_ORDER.length : index;
  };
  return [...tags].sort((a, b) => rank(a) - rank(b));
}

type XmlNode = { values: string[]; children: Map<string, XmlNode> };

const createNode = (): XmlNode => ({ values: [], children: new Map() });

function renderNode(name: string, node: XmlNode, indent: string): string {
  if (node.children.size > 0) {
    const inner = [...node.children]
      .map(([childName, child]) => renderNode(childName, child, `${indent}  `))
      .join("");
    return `${indent}<${name}>\n${inner}${indent}</${name}>\n`;
  }
  return node.values
    .map((value) => `${indent}<${name}>${escapeText(value)}</${name}>\n`)
    .join("");
}

function renderAd(merged: AdData, id: string): string {
  const indent = "    ";
  const top = new Map<string, XmlNode | string>();
  top.set("Id", `${indent}<Id>${escapeText(id)}</Id>\n`);

  for (const tag of orderTags(Object.keys(merged))) {
    if (tag === "Id" || !isValidTagPath(tag)) continue;
    const value = merged[tag];

    if (tag === "Images") {
      const urls = splitImages(value);
      if (urls.length > 0) {
        const items = urls
          .map((url) => `${indent}  <Image url="${escapeAttr(url)}"/>\n`)
          .join("");
        top.set("Images", `${indent}<Images>\n${items}${indent}</Images>\n`);
      }
      continue;
    }

    if (tag === "Price") {
      const price = normalizePriceValue(value);
      top.set("Price", `${indent}<Price>${escapeText(price)}</Price>\n`);
      continue;
    }

    if (tag === "Description") {
      top.set("Description", `${indent}<Description>${cdata(value)}</Description>\n`);
      continue;
    }

    const path = tag.split("/");
    const existing = top.get(path[0]);
    let node: XmlNode;
    if (existing && typeof existing !== "string") {
      node = existing;
    } else {
      node = createNode();
      top.set(path[0], node);
    }

    let cursor = node;
    for (const segment of path.slice(1)) {
      let next = cursor.children.get(segment);
      if (!next) {
        next = createNode();
        cursor.children.set(segment, next);
      }
      cursor = next;
    }
    cursor.values.push(...splitList(value));
  }

  const body = [...top]
    .map(([name, node]) => (typeof node === "string" ? node : renderNode(name, node, indent)))
    .join("");

  return `  <Ad>\n${body}  </Ad>\n`;
}

export function buildFeedXml(ads: FeedAdInput[], defaults: AdData): string {
  const items = ads.map((ad) => renderAd(mergeWithDefaults(defaults, ad.data), ad.key)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Ads formatVersion="3" target="Avito.ru">\n${items}</Ads>\n`;
}

/* ---------- Локальная проверка ---------- */

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?([+-]\d{2}:?\d{2}|Z)?)?$/;

export function validateAds(ads: FeedAdInput[], defaults: AdData) {
  const issues: AdIssue[] = [];
  const seen = new Map<string, number>();

  const push = (
    ad: FeedAdInput,
    index: number,
    tag: string,
    level: "error" | "warning",
    message: string,
  ) => issues.push({ adKey: ad.key, index, tag, level, message });

  ads.forEach((ad, index) => {
    const key = ad.key.trim();

    if (!key) {
      push(ad, index, "Id", "error", "Не заполнен ID объявления.");
    } else {
      if (key.length > 100) push(ad, index, "Id", "error", "ID длиннее 100 символов.");
      if (/\s/.test(key)) push(ad, index, "Id", "warning", "В ID есть пробелы. Лучше использовать латиницу, цифры и дефис.");
      const first = seen.get(key);
      if (first !== undefined) {
        push(ad, index, "Id", "error", `ID повторяется (первое объявление — строка ${first + 1}).`);
      } else {
        seen.set(key, index);
      }
    }

    const merged = mergeWithDefaults(defaults, ad.data);

    for (const [tag, value] of Object.entries(merged)) {
      if (!isValidTagPath(tag)) {
        push(ad, index, tag, "error", `Некорректное имя тега «${tag}». Допустимы латинские буквы, цифры, «_», «-» и «/» для вложенности.`);
      }
      if (value.length > MAX_VALUE_LENGTH) {
        push(ad, index, tag, "error", `Значение «${tag}» слишком длинное.`);
      }
    }

    if (!merged.Category) push(ad, index, "Category", "error", "Не указана категория.");

    if (!merged.Title) {
      push(ad, index, "Title", "warning", "Нет названия. В некоторых категориях Авито собирает его само.");
    } else if (merged.Title.length > 50) {
      push(ad, index, "Title", "error", `Название длиннее 50 символов (${merged.Title.length}).`);
    }

    if (!merged.Description) {
      push(ad, index, "Description", "warning", "Нет описания.");
    } else if (merged.Description.length > 7500) {
      push(ad, index, "Description", "error", `Описание длиннее 7500 символов (${merged.Description.length}).`);
    }

    if (!merged.Price) {
      push(ad, index, "Price", "warning", "Не указана цена.");
    } else {
      const normalizedPrice = normalizePriceValue(merged.Price);
      if (!/^\d+([.,]\d+)?$/.test(normalizedPrice)) {
        push(
          ad,
          index,
          "Price",
          "error",
          `Цена должна быть числом без валюты и букв (сейчас: «${merged.Price}»).`,
        );
      }
    }

    if (merged.Images) {
      const urls = splitImages(merged.Images);
      const broken = urls.filter((url) => !/^https?:\/\/\S+$/i.test(url));
      if (broken.length > 0) {
        push(ad, index, "Images", "error", `Некорректная ссылка на фото: ${broken[0]}`);
      }
      if (urls.length > 40) push(ad, index, "Images", "error", "Больше 40 фото в одном объявлении.");
    } else {
      push(ad, index, "Images", "warning", "Нет фото.");
    }

    if (!merged.Address && !merged.Latitude) {
      push(ad, index, "Address", "warning", "Не указан адрес.");
    }

    if (merged.ContactPhone) {
      if (/^[#=]|#(ERROR|REF|NAME|VALUE|N\/A)/i.test(merged.ContactPhone)) {
        push(
          ad,
          index,
          "ContactPhone",
          "error",
          "Похоже, ячейка с телефоном была воспринята таблицей как формула (частая проблема с номерами вида «+7…» в Google/Excel). Отформатируйте столбец как текст и введите номер заново.",
        );
      } else {
        const digits = merged.ContactPhone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 12) {
          push(ad, index, "ContactPhone", "warning", "Телефон выглядит неполным.");
        }
      }
    }

    for (const tag of ["DateBegin", "DateEnd"]) {
      const value = merged[tag];
      if (value && !DATE_PATTERN.test(value)) {
        push(ad, index, tag, "warning", "Дата должна быть в формате ГГГГ-ММ-ДД.");
      }
    }
  });

  return {
    issues,
    errors: issues.filter((issue) => issue.level === "error").length,
    warnings: issues.filter((issue) => issue.level === "warning").length,
  };
}
