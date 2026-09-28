/* Импорт и экспорт таблиц объявлений: вставка из Excel / Google Таблиц и CSV. */
import { FIELD_BY_TAG, LIST_SEPARATOR, normalizeDateValue, normalizePriceValue, resolveTag, type AdData } from "./fields";
import type { FeedAdInput } from "./xml";

export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const count = (char: string) => firstLine.split(char).length - 1;
  const candidates: [string, number][] = [
    ["\t", count("\t")],
    [";", count(";")],
    [",", count(",")],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 0 ? candidates[0][0] : ",";
}

export function parseDelimited(input: string, delimiter = detectDelimiter(input)): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

export type ImportResult = {
  ads: FeedAdInput[];
  mapping: { header: string; tag: string | null }[];
  recognized: number;
};

/** Первая строка — заголовки. Столбец «Id» необязателен: недостающие ID создаются автоматически. */
/** «нет» → «Нет», «по телефону» → «По телефону»: приводим к допустимому значению поля со списком. */
function canonicalOption(tag: string, value: string): string {
  const options = FIELD_BY_TAG[tag]?.options;
  if (!options) return value;
  const v = value.trim().toLowerCase();
  const hit = options.find((option) => option.value.toLowerCase() === v || option.label.toLowerCase() === v);
  return hit ? hit.value : value;
}

export function buildImport(rows: string[][], idPrefix = "ad"): ImportResult {
  if (rows.length === 0) return { ads: [], mapping: [], recognized: 0 };

  const header = rows[0];
  const mapping = header.map((title) => ({ header: title.trim(), tag: resolveTag(title) }));
  const recognized = mapping.filter((item) => item.tag).length;
  const usedIds = new Set<string>();
  const ads: FeedAdInput[] = [];

  rows.slice(1).forEach((cells, rowIndex) => {
    const data: AdData = {};

    mapping.forEach((item, columnIndex) => {
      if (!item.tag) return;
      let value = (cells[columnIndex] ?? "").trim();
      if (!value) return;

      if (item.tag === "Price") value = normalizePriceValue(value);
      else if (item.tag === "DateBegin" || item.tag === "DateEnd") value = normalizeDateValue(value);
      else value = canonicalOption(item.tag, value);
      if (!value) return;

      if (data[item.tag]) {
        data[item.tag] += item.tag === "Images" ? "\n" + value : "";
      } else {
        data[item.tag] = item.tag === "Images" ? value.replace(/[\s,;]+(?=https?:\/\/)/g, "\n") : value;
      }
    });

    if (Object.keys(data).length === 0) return;

    let key = (data.Id ?? "").trim();
    delete data.Id;
    if (!key) key = `${idPrefix}-${rowIndex + 1}`;
    let unique = key;
    let suffix = 2;
    while (usedIds.has(unique)) unique = `${key}-${suffix++}`;
    usedIds.add(unique);

    ads.push({ key: unique, data });
  });

  return { ads, mapping, recognized };
}

export function toCsv(ads: FeedAdInput[], columns: string[]): string {
  const quote = (value: string) =>
    /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [columns.map(quote).join(";")];

  for (const ad of ads) {
    lines.push(
      columns
        .map((tag) => quote(tag === "Id" ? ad.key : (ad.data[tag] ?? "")))
        .join(";"),
    );
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** CSV-образец для скачивания: заголовки + одна строка-пример. */
export function buildTemplateCsv(headers: string[], example: string[]): string {
  const quote = (value: string) => (/[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [headers.map(quote).join(";"), example.map(quote).join(";")];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export { LIST_SEPARATOR };
