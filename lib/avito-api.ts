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

export async function getAvitoItemsForUser(userId: number) {
  const accessToken = await getAvitoAccessTokenForUser(userId);

  const possibleUrls = [
    "https://api.avito.ru/core/v1/items",
    "https://api.avito.ru/autoload/v2/items",
    "https://api.avito.ru/core/v1/accounts/self/items",
  ];

  const errors: string[] = [];

  for (const url of possibleUrls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });

      const payload = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;

      if (!response.ok) {
        errors.push(`${url} → HTTP ${response.status}`);
        continue;
      }

      const items = extractItemsFromPayload(payload);

      if (items.length === 0) {
        errors.push(`${url} → список объявлений не найден в ответе`);
        continue;
      }

      return items;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "неизвестная ошибка";
      errors.push(`${url} → ${message}`);
    }
  }

  throw new Error(
    `Не удалось получить список объявлений Авито. Проверенные endpoints: ${errors.join("; ")}`,
  );
}

export async function getAvitoItemByIdForUser(userId: number, itemId: string) {
  const items = await getAvitoItemsForUser(userId);
  const item = items.find((candidate) => candidate.id === itemId);

  if (!item) {
    throw new Error("Объявление не найдено в подключённом аккаунте Авито.");
  }

  return item;
}