import { prisma } from "@/lib/prisma";
import { decryptAvitoSecret, encryptAvitoSecret } from "@/lib/avito-credentials";
import type { AvitoAccountConnection } from "@prisma/client";

/* =========================================================================
   Клиент API Авито для Автозагрузки.

   Использует ту же таблицу подключения (AvitoAccountConnection) и то же
   шифрование (lib/avito-credentials.ts), что и Бид-менеджер: ключи Авито
   у пользователя одни на весь сайт. Логика получения токена — своя (со
   своим кэшем в accessTokenEnc/tokenExpiresAt), lib/avito-api.ts не
   меняется и продолжает работать как раньше.

   Адреса методов — по официальному OpenAPI-описанию Авито (файлы
   «Автозагрузка» и «Объявления»), проверено 2026-09-23:
   - /autoload/v2/profile — актуальная версия профиля автозагрузки
     (v1 помечена deprecated).
   - Отчёты v2/v3 (/autoload/v2|v3/reports/...) помечены deprecated.
     Актуальная версия — /autoload/v4/uploads/...
   ========================================================================= */

const API_BASE = "https://api.avito.ru";

export const ENDPOINTS = {
  token: "/token",
  items: "/core/v1/items",
  profile: "/autoload/v2/profile",
  upload: "/autoload/v1/upload",
  uploads: "/autoload/v4/uploads",
  currentUpload: "/autoload/v4/uploads/current",
  currentUploadItems: "/autoload/v4/uploads/current/items",
  lastSuccessfulUpload: "/autoload/v4/uploads/last_successful",
  lastSuccessfulUploadItems: "/autoload/v4/uploads/last_successful/items",
  adIdsByAvitoIds: "/autoload/v2/items/ad_ids",
  avitoIdsByAdIds: "/autoload/v2/items/avito_ids",
  tree: "/autoload/v1/user-docs/tree",
  nodeFields: (slug: string) => `/autoload/v1/user-docs/node/${encodeURIComponent(slug)}/fields`,
} as const;

export class AvitoApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "AvitoApiError";
    this.status = status;
    this.payload = payload;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Тело ошибки в этом API — { error: { code, message } } (схема FieldErrorV2), иногда без обёртки. */
function extractMessage(payload: Json, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload.slice(0, 300) || fallback;
  const candidates = [
    payload?.error?.message,
    payload?.error_description,
    payload?.message,
    typeof payload?.error === "string" ? payload.error : null,
  ];
  const found = candidates.find((item) => typeof item === "string" && item.trim());
  return found ? String(found).slice(0, 300) : fallback;
}

function explain(status: number, payload: Json): string {
  if (status === 401 || status === 403) {
    const detail = extractMessage(payload, "");
    // Раз мы дошли до этой точки, токен уже был успешно получен (client_id/client_secret верны) —
    // 401/403 здесь почти всегда означает, что у приложения нет доступа именно к API Автозагрузки:
    // это отдельное разрешение, которое включается в кабинете Авито независимо от других API.
    return (
      "Ключи Авито верны, но приложение не может пользоваться Автозагрузкой" +
      (detail ? ` (Авито ответил: «${detail}»).` : ".") +
      " Обычно это значит, что для вашего приложения не включён продукт «Автозагрузка»." +
      " Проверьте в личном кабинете Авито: «Настройки» → «Автозагрузка» → «Через API», и что этот" +
      " способ автозагрузки включён и подтверждён (иногда требуется отдельное согласие с условиями" +
      " использования Автозагрузки). Если доступ должен быть, но всё равно не работает — напишите" +
      " в поддержку Автозагрузки: supportautoload@avito.ru, указав ваш client_id."
    );
  }
  if (status === 404) return extractMessage(payload, "Данные не найдены.");
  if (status === 429) return "Слишком много запросов к API Авито. Подождите минуту и повторите.";
  if (status >= 500) return "API Авито временно недоступен. Повторите чуть позже.";
  return extractMessage(payload, `Авито вернул ошибку ${status}.`);
}


/** Таймауты обращений к API Авито (миллисекунды). Держим короткими, чтобы интерфейс не «зависал». */
export const TOKEN_TIMEOUT_MS = 8_000;
export const REQUEST_TIMEOUT_MS = 10_000;
/** Дерево категорий большое, ему разрешаем чуть дольше. */
export const TREE_TIMEOUT_MS = 15_000;

async function timedFetch(url: string | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new AvitoApiError(`Авито не ответил за ${Math.round(timeoutMs / 1000)} с. Повторите чуть позже.`, 504);
    }
    throw new AvitoApiError("Не удалось связаться с API Авито. Проверьте соединение и повторите.", 502);
  }
}

/* ---------- Токен ---------- */

export async function requestToken(clientId: string, clientSecret: string) {
  const response = await timedFetch(
    `${API_BASE}${ENDPOINTS.token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    },
    TOKEN_TIMEOUT_MS,
  );

  const payload: Json = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new AvitoApiError(
      response.status === 400 || response.status === 401 || response.status === 403
        ? "Авито не принял client_id и client_secret. Проверьте ключи в разделе «Интеграции» → «Авито API» личного кабинета Авито."
        : explain(response.status, payload),
      response.status,
      payload,
    );
  }

  return {
    token: String(payload.access_token),
    expiresIn: Number(payload.expires_in) > 0 ? Number(payload.expires_in) : 3600,
  };
}

/**
 * Токен кэшируется в той же строке AvitoAccountConnection, что использует
 * Бид-менеджер (поле tokenExpiresAt уже было в схеме, но раньше не
 * использовалось; accessTokenEnc — новое поле). Бид-менеджер (lib/avito-api.ts)
 * этот кэш не читает и продолжает получать токен как раньше — конфликта нет.
 */
export async function getAccessToken(connection: AvitoAccountConnection, force = false): Promise<string> {
  const valid =
    !force &&
    connection.accessTokenEnc &&
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() - Date.now() > 60_000;

  if (valid && connection.accessTokenEnc) {
    try {
      return decryptAvitoSecret(connection.accessTokenEnc);
    } catch {
      /* повреждённый кэш — получим новый токен ниже */
    }
  }

  const clientSecret = decryptAvitoSecret(connection.encryptedClientSecret);
  const { token, expiresIn } = await requestToken(connection.clientId, clientSecret);

  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const updated = await prisma.avitoAccountConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEnc: encryptAvitoSecret(token),
      tokenExpiresAt: expiresAt,
      lastCheckedAt: new Date(),
      lastError: null,
    },
  });
  connection.accessTokenEnc = updated.accessTokenEnc;
  connection.tokenExpiresAt = updated.tokenExpiresAt;
  return token;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export async function avitoRequest<T = Json>(
  connection: AvitoAccountConnection,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const timeoutMs = path === ENDPOINTS.tree ? TREE_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const send = async (token: string) =>
    timedFetch(
      url,
      {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
      },
      timeoutMs,
    );

  let response = await send(await getAccessToken(connection));

  // Просроченный/отозванный токен — обновляем и повторяем один раз.
  if (response.status === 401 || response.status === 403) {
    response = await send(await getAccessToken(connection, true));
  }

  const text = await response.text();
  let payload: Json = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new AvitoApiError(explain(response.status, payload), response.status, payload);
  }

  await prisma.avitoAccountConnection
    .update({ where: { id: connection.id }, data: { lastError: null } })
    .catch(() => null);

  return payload as T;
}

async function markError(connection: AvitoAccountConnection, error: unknown) {
  const message = error instanceof AvitoApiError ? error.message : "Не удалось связаться с API Авито.";
  await prisma.avitoAccountConnection
    .update({ where: { id: connection.id }, data: { lastError: message } })
    .catch(() => null);
}

/* ---------- Методы Автозагрузки ---------- */

type UploadsQuery = { perPage?: number; page?: number; dateFrom?: string; dateTo?: string };
type UploadItemsQuery = { query?: string; sections?: string; page?: number; perPage?: number };

export const avito = {
  /** Лёгкий вызов для проверки, что ключи рабочие (не требует уже созданного профиля автозагрузки). */
  async ping(connection: AvitoAccountConnection): Promise<void> {
    await avitoRequest<Json>(connection, ENDPOINTS.items, { query: { per_page: 1, page: 1 } });
  },

  async getProfile(connection: AvitoAccountConnection): Promise<Json | null> {
    try {
      return await avitoRequest<Json>(connection, ENDPOINTS.profile);
    } catch (error) {
      if (error instanceof AvitoApiError && error.status === 404) return null;
      throw error;
    }
  },

  saveProfile: (connection: AvitoAccountConnection, body: unknown) =>
    avitoRequest<Json>(connection, ENDPOINTS.profile, { method: "POST", body }),

  /** Запускает выгрузку по ссылке сейчас же (не чаще раза в час — ограничение самого Авито). */
  upload: (connection: AvitoAccountConnection) =>
    avitoRequest<Json>(connection, ENDPOINTS.upload, { method: "POST" }),

  uploads: (connection: AvitoAccountConnection, params: UploadsQuery = {}) =>
    avitoRequest<Json>(connection, ENDPOINTS.uploads, {
      query: { perPage: params.perPage ?? 10, page: params.page ?? 1, dateFrom: params.dateFrom, dateTo: params.dateTo },
    }),

  async currentUpload(connection: AvitoAccountConnection): Promise<Json | null> {
    try {
      return await avitoRequest<Json>(connection, ENDPOINTS.currentUpload);
    } catch (error) {
      if (error instanceof AvitoApiError && error.status === 404) return null;
      throw error;
    }
  },

  async lastSuccessfulUpload(connection: AvitoAccountConnection): Promise<Json | null> {
    try {
      return await avitoRequest<Json>(connection, ENDPOINTS.lastSuccessfulUpload);
    } catch (error) {
      if (error instanceof AvitoApiError && error.status === 404) return null;
      throw error;
    }
  },

  currentUploadItems: (connection: AvitoAccountConnection, params: UploadItemsQuery) =>
    avitoRequest<Json>(connection, ENDPOINTS.currentUploadItems, {
      query: { query: params.query, sections: params.sections, page: params.page ?? 1, perPage: params.perPage ?? 100 },
    }),

  lastSuccessfulUploadItems: (connection: AvitoAccountConnection, params: UploadItemsQuery) =>
    avitoRequest<Json>(connection, ENDPOINTS.lastSuccessfulUploadItems, {
      query: { query: params.query, sections: params.sections, page: params.page ?? 1, perPage: params.perPage ?? 100 },
    }),

  tree: (connection: AvitoAccountConnection) => avitoRequest<Json>(connection, ENDPOINTS.tree),

  nodeFields: (connection: AvitoAccountConnection, slug: string) =>
    avitoRequest<Json>(connection, ENDPOINTS.nodeFields(slug)),
};

export { markError as markAvitoError };
