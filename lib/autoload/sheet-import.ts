import { parseDelimited } from "./import";

/* =========================================================================
   Импорт таблицы объявлений по ссылке: Google Таблицы, Яндекс Таблицы/Диск
   или прямая ссылка на файл (.csv, .xlsx). Выполняется на сервере, потому
   что у этих сервисов нет открытого доступа из браузера (CORS запрещает
   fetch с чужого домена), а Яндекс вдобавок отдаёт файл только через
   отдельный API, возвращающий временную ссылку на скачивание.
   ========================================================================= */

export type SheetRows = string[][];

export class SheetImportError extends Error {}

function extractGoogleSheetId(url: URL): { id: string; gid: string | null } | null {
  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;
  const gidFromQuery = url.searchParams.get("gid");
  const gidFromHash = /gid=(\d+)/.exec(url.hash)?.[1] ?? null;
  return { id: match[1], gid: gidFromQuery || gidFromHash };
}

async function fetchText(url: string): Promise<{ text: string; contentType: string }> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new SheetImportError("Не удалось обратиться по ссылке. Проверьте адрес и повторите.");
  }
  if (!response.ok) {
    throw new SheetImportError(
      `Не удалось загрузить таблицу (код ${response.status}). Проверьте, что доступ открыт «всем, у кого есть ссылка».`,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  return { text, contentType };
}

async function fetchBuffer(url: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(25_000) });
  } catch {
    throw new SheetImportError("Не удалось обратиться по ссылке. Проверьте адрес и повторите.");
  }
  if (!response.ok) {
    throw new SheetImportError(`Не удалось загрузить файл (код ${response.status}).`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const buffer = await response.arrayBuffer();
  return { buffer, contentType };
}

async function rowsFromWorkbookBuffer(buffer: ArrayBuffer): Promise<SheetRows> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new SheetImportError("В файле нет листов с данными.");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown as (
    | string
    | number
  )[][];
  return rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
}

function looksLikeSpreadsheetFile(contentType: string, pathname: string) {
  return (
    contentType.includes("spreadsheet") ||
    contentType.includes("officedocument") ||
    contentType.includes("ms-excel") ||
    /\.xlsx?($|\?)/i.test(pathname)
  );
}

/** Разбирает ссылку на таблицу и возвращает её содержимое построчно (первая строка — заголовки). */
export async function resolveSheetUrl(rawUrl: string): Promise<SheetRows> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new SheetImportError("Это не похоже на ссылку. Скопируйте полный адрес страницы таблицы из браузера.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SheetImportError("Ссылка должна начинаться с http:// или https://.");
  }

  const host = url.hostname.toLowerCase();

  // Google Таблицы
  if (host.endsWith("docs.google.com")) {
    const parsed = extractGoogleSheetId(url);
    if (!parsed) {
      throw new SheetImportError(
        "Не удалось распознать ссылку на Google Таблицу. Скопируйте адрес прямо из адресной строки браузера.",
      );
    }
    const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${parsed.id}/export`);
    exportUrl.searchParams.set("format", "csv");
    if (parsed.gid) exportUrl.searchParams.set("gid", parsed.gid);

    const { text, contentType } = await fetchText(exportUrl.toString());
    if (contentType.includes("text/html")) {
      throw new SheetImportError(
        "Google Таблица недоступна для чтения. Откройте «Настройки доступа» → «Все, у кого есть ссылка» → «Читатель» и повторите.",
      );
    }
    return parseDelimited(text, ",");
  }

  // Яндекс Таблицы и Яндекс Диск (публичные ссылки на поддоменах yandex.ru/yandex.com/ya.ru)
  if (host.endsWith(".yandex.ru") || host === "yandex.ru" || host.endsWith(".yandex.com") || host === "yandex.com" || host.endsWith("ya.ru")) {
    const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(
      rawUrl.trim(),
    )}`;

    let metaResponse: Response;
    try {
      metaResponse = await fetch(apiUrl, { signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new SheetImportError("Не удалось обратиться к Яндексу. Проверьте ссылку и повторите.");
    }
    const meta = await metaResponse.json().catch(() => null);
    if (!metaResponse.ok || typeof meta?.href !== "string") {
      throw new SheetImportError(
        "Не удалось получить файл по ссылке Яндекса. Проверьте: доступ должен быть «Доступно всем по ссылке», а ссылка — вести на сам файл или таблицу, а не на папку.",
      );
    }

    const { buffer, contentType } = await fetchBuffer(meta.href);
    if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      return parseDelimited(new TextDecoder("utf-8").decode(buffer));
    }
    return rowsFromWorkbookBuffer(buffer);
  }

  // Прямая ссылка на файл (.csv, .xlsx и т.п.)
  const { buffer, contentType } = await fetchBuffer(url.toString());
  if (looksLikeSpreadsheetFile(contentType, url.pathname)) {
    return rowsFromWorkbookBuffer(buffer);
  }
  return parseDelimited(new TextDecoder("utf-8").decode(buffer));
}
