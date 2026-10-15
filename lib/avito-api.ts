import { decryptAvitoSecret } from "@/lib/avito-credentials";
import { prisma } from "@/lib/prisma";

export type AvitoAccountItem = {
  id: string;
  title: string;
  url: string | null;
  price: string | null;
  status: string | null;
  serviceType: string | null;
  category: string | null;
};

async function requestAvitoAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const formData = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch("https://api.avito.ru/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        access_token?: unknown;
        error?: unknown;
        error_description?: unknown;
      }
    | null;

  if (!response.ok || !payload || typeof payload.access_token !== "string") {
    const errorMessage =
      typeof payload?.error_description === "string"
        ? payload.error_description
        : typeof payload?.error === "string"
          ? payload.error
          : "Не удалось получить access token Авито.";

    throw new Error(errorMessage);
  }

  return payload.access_token;
}

export async function getAvitoAccessTokenForUser(userId: number) {
  const connection = await prisma.avitoAccountConnection.findUnique({
    where: { userId },
    select: {
      clientId: true,
      encryptedClientSecret: true,
    },
  });

  if (!connection) {
    throw new Error("Аккаунт Авито не подключён.");
  }

  const clientSecret = decryptAvitoSecret(connection.encryptedClientSecret);
  const accessToken = await requestAvitoAccessToken(
    connection.clientId,
    clientSecret,
  );

  await prisma.avitoAccountConnection.update({
    where: { userId },
    data: {
      lastCheckedAt: new Date(),
      lastError: null,
    },
  });

  return accessToken;
}

function normalizeAvitoItem(rawItem: Record<string, unknown>): AvitoAccountItem {
  const id =
    typeof rawItem.id === "number" || typeof rawItem.id === "string"
      ? String(rawItem.id)
      : "";

  const title =
    typeof rawItem.title === "string"
      ? rawItem.title
      : typeof rawItem.subject === "string"
        ? rawItem.subject
        : "Объявление без названия";

  const url =
    typeof rawItem.url === "string"
      ? rawItem.url
      : typeof rawItem.link === "string"
        ? rawItem.link
        : typeof rawItem.itemUrl === "string"
          ? rawItem.itemUrl
          : null;

  const price =
    typeof rawItem.price === "string"
      ? rawItem.price
      : typeof rawItem.price_string === "string"
        ? rawItem.price_string
        : typeof rawItem.price === "number"
          ? `${rawItem.price} ₽`
          : null;

  const status = typeof rawItem.status === "string" ? rawItem.status : null;

  const serviceType =
    typeof rawItem.service_type === "string"
      ? rawItem.service_type
      : typeof rawItem.serviceType === "string"
        ? rawItem.serviceType
        : null;

  const category =
    typeof rawItem.category === "string"
      ? rawItem.category
      : typeof rawItem.category_name === "string"
        ? rawItem.category_name
        : null;

  return {
    id,
    title,
    url,
    price,
    status,
    serviceType,
    category,
  };
}

function extractItemsFromPayload(payload: Record<string, unknown> | null) {
  const candidates = [
    payload?.items,
    payload?.result,
    payload?.resources,
    payload?.data,
  ];

  const list = candidates.find((value) => Array.isArray(value));

  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map((item) =>
      item && typeof item === "object"
        ? normalizeAvitoItem(item as Record<string, unknown>)
        : null,
    )
    .filter((item): item is AvitoAccountItem => Boolean(item?.id));
}

// Кэш списка объявлений по пользователю. Раньше список скачивался заново перед КАЖДОЙ проверкой каждого бидера,
// из-за чего Авито отвечал HTTP 429 (лимит запросов). Теперь все бидеры одного аккаунта берут один и тот же список.
const ITEMS_CACHE_TTL_MS = 10 * 60 * 1000; // свежий кэш — не ходим в Авито
const ITEMS_CACHE_STALE_MS = 6 * 60 * 60 * 1000; // при 429 или сбое можно отдать устаревший список не старше 6 часов
const itemsCache = new Map<number, { items: AvitoAccountItem[]; at: number }>();
const itemsInFlight = new Map<number, Promise<AvitoAccountItem[]>>();

async function fetchAvitoItemsForUser(userId: number): Promise<AvitoAccountItem[]> {
  const accessToken = await getAvitoAccessTokenForUser(userId);
  const url = "https://api.avito.ru/core/v1/items";

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "неизвестная ошибка";
    throw new Error(`Не удалось получить список объявлений Авито: ${message}`);
  }

  if (response.status === 429) {
    throw new Error("Не удалось получить список объявлений Авито: лимит запросов Avito API (HTTP 429). Повтор позже.");
  }
  if (!response.ok) {
    throw new Error(`Не удалось получить список объявлений Авито: HTTP ${response.status}.`);
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const items = extractItemsFromPayload(payload);
  if (items.length === 0) {
    throw new Error("Не удалось получить список объявлений Авито: список объявлений не найден в ответе.");
  }
  return items;
}

export async function getAvitoItemsForUser(userId: number, options: { forceRefresh?: boolean } = {}) {
  const cached = itemsCache.get(userId);
  const now = Date.now();
  if (cached && !options.forceRefresh && now - cached.at < ITEMS_CACHE_TTL_MS) return cached.items;

  // Параллельные запросы одного пользователя ждут один общий запрос
  let pending = itemsInFlight.get(userId);
  if (!pending) {
    pending = fetchAvitoItemsForUser(userId).finally(() => itemsInFlight.delete(userId));
    itemsInFlight.set(userId, pending);
  }

  try {
    const items = await pending;
    itemsCache.set(userId, { items, at: Date.now() });
    return items;
  } catch (error) {
    // Лимит или сбой Авито: если есть не слишком старый список — используем его, чтобы бидер не вставал
    if (cached && Date.now() - cached.at < ITEMS_CACHE_STALE_MS) return cached.items;
    throw error;
  }
}

export async function getAvitoItemByIdForUser(userId: number, itemId: string) {
  let items = await getAvitoItemsForUser(userId);
  let item = items.find((candidate) => candidate.id === itemId);

  // Объявления нет в кэше — возможно, оно новое: один раз обновляем список (не чаще раза в минуту)
  if (!item) {
    const cachedAt = itemsCache.get(userId)?.at ?? 0;
    if (Date.now() - cachedAt > 60_000) {
      items = await getAvitoItemsForUser(userId, { forceRefresh: true });
      item = items.find((candidate) => candidate.id === itemId);
    }
  }

  if (!item) {
    throw new Error("Объявление не найдено в подключённом аккаунте Авито.");
  }

  return item;
}