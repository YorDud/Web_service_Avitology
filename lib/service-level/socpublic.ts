/* =========================================================================
   Клиент API SocPublic (https://socpublic.com/api).
   Транспорт повторяет официальный PHP-класс SOCPublic.php: POST x-www-form-urlencoded,
   поля act=..., параметры метода, затем api_id и api_key; ответ — JSON.
   Ключи берутся из .env: SOCPUBLIC_API_ID и SOCPUBLIC_API_KEY.
   ========================================================================= */

const DEFAULT_URL = "https://socpublic.com/api";
/** Между запросами держим паузу: у ряда методов лимит «1 запрос в секунду». */
const MIN_GAP_MS = 1100;

export type SocResult = {
  ok: boolean;
  /** Поле status из ответа (или наш код 301/302/0 при сбое до ответа). */
  status: number | string | null;
  text: string | null;
  raw: unknown;
  error?: string;
};

export function socConfigured() {
  return Boolean(process.env.SOCPUBLIC_API_ID?.trim() && process.env.SOCPUBLIC_API_KEY?.trim());
}

let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      return await task();
    } finally {
      lastCallAt = Date.now();
    }
  });
  queue = run.catch(() => null);
  return run;
}

export function isSuccessStatus(status: unknown, successCodes: string[]) {
  if (status === null || status === undefined) return false;
  return successCodes.includes(String(status).trim().toLowerCase());
}

export function parseSuccessCodes(value: string | null | undefined) {
  const codes = String(value ?? "0")
    .split(/[,;\s]+/)
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
  return codes.length > 0 ? codes : ["0"];
}

/** «Bad request (url: Неверный формат данных; price_user: Минимальное значение 1.8 Руб.)» — ошибки по полям из ответа. */
function describeFailure(record: Record<string, unknown>, status: unknown, text: string | null) {
  let base = text || `SocPublic вернул статус ${String(status)}`;
  // 10x — ошибка авторизации. SocPublic принимает запросы только с IP-адресов, указанных в самом API-ключе.
  const code = Number(status);
  if (Number.isFinite(code) && code >= 100 && code < 200) {
    base += ". Проверьте API-ключ и что IP-адрес этого сервера добавлен в настройках API-ключа на SocPublic (запросы принимаются только с указанных IP)";
  }
  const data = record.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const fields = Object.entries(data as Record<string, unknown>)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([key, value]) => `${key}: ${String(value).trim()}`);
    if (fields.length > 0) return `${base} (${fields.join("; ")})`;
  }
  return base;
}

/** Вызов метода API. Секреты в логи и ответы не попадают. */
export async function socCall(
  act: string,
  params: Record<string, string | number | null | undefined> = {},
  successCodes: string[] = ["0"],
  timeoutMs = 25_000,
): Promise<SocResult> {
  if (!socConfigured()) {
    return { ok: false, status: 0, text: "Ключи SocPublic не заданы", raw: null, error: "В .env не заданы SOCPUBLIC_API_ID и SOCPUBLIC_API_KEY." };
  }

  const body = new URLSearchParams();
  body.set("act", act);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) body.set(key, String(value));
  }
  body.set("api_id", process.env.SOCPUBLIC_API_ID!.trim());
  body.set("api_key", process.env.SOCPUBLIC_API_KEY!.trim());

  return throttled(async () => {
    let response: Response;
    try {
      response = await fetch(process.env.SOCPUBLIC_API_URL?.trim() || DEFAULT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "SOCPublic API" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = (error as { name?: string } | null)?.name === "TimeoutError";
      return {
        ok: false,
        status: 0,
        text: null,
        raw: null,
        error: timedOut ? "SocPublic не ответил вовремя." : "Не удалось связаться с SocPublic.",
      };
    }

    const raw = await response.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return { ok: false, status: 302, text: null, raw, error: `Ответ SocPublic не JSON (HTTP ${response.status}).` };
    }

    const record = raw as Record<string, unknown>;
    const status = (record.status ?? null) as number | string | null;
    const text = typeof record.text === "string" ? record.text : null;
    const ok = isSuccessStatus(status, successCodes);
    return { ok, status, text, raw, error: ok ? undefined : describeFailure(record, status, text) };
  });
}

/** Ищет id задания в ответе task_create (по типичным ключам, на любой глубине до 4 уровней). */
export function extractTaskId(raw: unknown): string | null {
  const keys = ["task_id", "taskid", "id"];
  let level: unknown[] = [raw];
  for (let depth = 0; depth <= 4 && level.length > 0; depth += 1) {
    const next: unknown[] = [];
    for (const node of level) {
      if (!node || typeof node !== "object") continue;
      const entries = Object.entries(node as Record<string, unknown>);
      for (const key of keys) {
        const hit = entries.find(([name]) => name.toLowerCase() === key);
        const value = hit?.[1];
        // ID заданий SocPublic — многозначные числа (например, 3099525); мелкие числа (флаги, счётчики) не принимаем.
        if ((typeof value === "number" && Number.isInteger(value) && value >= 100) || (typeof value === "string" && /^\d{3,}$/.test(value.trim()))) {
          return String(value).trim();
        }
      }
      for (const [, child] of entries) if (child && typeof child === "object") next.push(child);
    }
    level = next;
  }
  return null;
}

/**
 * Распознаёт собственное ограничение SocPublic на частоту создания заданий («Вы слишком часто
 * создаёте рекламные кампании. Подождите 1 час.») — это не наша настройка и трогать тут нечего,
 * нужно просто не пытаться создать задание раньше времени. Возвращает, на сколько минут подождать
 * (из текста ответа, если число есть, иначе разумный запас), или null, если это не тот случай.
 */
export function rateLimitWaitMinutes(message: string | null | undefined): number | null {
  const text = String(message ?? "");
  if (!/слишком часто/i.test(text)) return null;
  const hours = /(\d+)\s*час/i.exec(text);
  if (hours) return Number(hours[1]) * 60 + 5;
  const minutes = /(\d+)\s*мин/i.exec(text);
  if (minutes) return Number(minutes[1]) + 5;
  return 65; // не смогли распознать число — подождём с запасом
}

/** Кратко и без лишнего: сырой ответ для админки (обрезаем длинные). */
export function stringifyRaw(raw: unknown, limit = 4000) {
  try {
    const text = JSON.stringify(raw, null, 2) ?? "";
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
  } catch {
    return String(raw);
  }
}
