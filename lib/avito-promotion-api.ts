import { getAvitoAccessTokenForUser } from "@/lib/avito-api";

const AVITO_PROMOTION_BASE_URL = "https://api.avito.ru";

type PromotionRequestOptions = {
  userId: number;
  path: string;
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
};

async function avitoPromotionRequest<T>({
  userId,
  path,
  method = "POST",
  body,
}: PromotionRequestOptions): Promise<T> {
  const accessToken = await getAvitoAccessTokenForUser(userId);

  const response = await fetch(`${AVITO_PROMOTION_BASE_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message =
      extractPromotionError(payload) ||
      `Promotion API error: HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractPromotionError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail;
  }

  if (Array.isArray(record.errors) && record.errors.length > 0) {
    return record.errors
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const inner = item as Record<string, unknown>;
          if (typeof inner.message === "string") return inner.message;
          return JSON.stringify(inner);
        }
        return String(item);
      })
      .join("; ");
  }

  return null;
}

function extractArray<T>(payload: unknown, keys: string[]): T[] {
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}

export type AvitoPromotionService = Record<string, unknown>;
export type AvitoBbipSuggest = Record<string, unknown>;
export type AvitoBbipForecast = Record<string, unknown>;
export type AvitoPromotionOrderCreateResponse = Record<string, unknown>;
export type AvitoPromotionOrderStatusResponse = Record<string, unknown>;

export async function getPromotionServicesForItem(params: {
  userId: number;
  itemId: number;
}) {
  const payload = await avitoPromotionRequest<Record<string, unknown>>({
    userId: params.userId,
    path: "/promotion/v1/items/services/get",
    method: "POST",
    body: {
      itemIds: [params.itemId],
    },
  });

  return {
    raw: payload,
    services: extractArray<AvitoPromotionService>(payload, [
      "items",
      "services",
      "result",
      "data",
    ]),
  };
}

export async function getBbipSuggestsForItem(params: {
  userId: number;
  itemId: number;
}) {
  const payload = await avitoPromotionRequest<Record<string, unknown>>({
    userId: params.userId,
    path: "/promotion/v1/items/services/bbip/suggests/get",
    method: "POST",
    body: {
      itemIds: [params.itemId],
    },
  });

  return {
    raw: payload,
    suggests: extractArray<AvitoBbipSuggest>(payload, [
      "items",
      "suggests",
      "result",
      "data",
    ]),
  };
}

export async function getBbipForecastsForItem(params: {
  userId: number;
  itemId: number;
  duration: number;
  price: number;
  oldPrice: number;
}) {
  const payload = await avitoPromotionRequest<Record<string, unknown>>({
    userId: params.userId,
    path: "/promotion/v1/items/services/bbip/forecasts/get",
    method: "POST",
    body: {
      items: [
        {
          itemId: params.itemId,
          duration: params.duration,
          price: params.price,
          oldPrice: params.oldPrice,
        },
      ],
    },
  });

  return {
    raw: payload,
    forecasts: extractArray<AvitoBbipForecast>(payload, [
      "items",
      "forecasts",
      "result",
      "data",
    ]),
  };
}

export async function createBbipOrderForItem(params: {
  userId: number;
  itemId: number;
  duration: number;
  price: number;
  oldPrice: number;
}) {
  const payload =
    await avitoPromotionRequest<AvitoPromotionOrderCreateResponse>({
      userId: params.userId,
      path: "/promotion/v1/items/services/bbip/orders/create",
      method: "PUT",
      body: {
        items: [
          {
            itemId: params.itemId,
            duration: params.duration,
            price: params.price,
            oldPrice: params.oldPrice,
          },
        ],
      },
    });

  return payload;
}

export async function getPromotionOrderStatus(params: {
  userId: number;
  orderId: string;
}) {
  const numericOrderId = Number(params.orderId);

  const payload =
    await avitoPromotionRequest<AvitoPromotionOrderStatusResponse>({
      userId: params.userId,
      path: "/promotion/v1/items/services/orders/status",
      method: "POST",
      body: {
        orderId: Number.isFinite(numericOrderId)
          ? numericOrderId
          : params.orderId,
      },
    });

  return payload;
}

export function normalizeSuggestedBudget(
  suggest: Record<string, unknown> | null | undefined,
) {
  if (!suggest || typeof suggest !== "object") {
    return null;
  }

  const budgets = Array.isArray(suggest.budgets)
    ? (suggest.budgets as Record<string, unknown>[])
    : [];

  if (budgets.length === 0) {
    return null;
  }

  const recommended =
    budgets.find((budget) => budget.isRecommended === true) ?? budgets[0];

  const price =
    typeof recommended.price === "number" ? recommended.price : null;
  const oldPrice =
    typeof recommended.oldPrice === "number" ? recommended.oldPrice : price;

  const duration =
    suggest.duration &&
    typeof suggest.duration === "object" &&
    typeof (suggest.duration as Record<string, unknown>).value === "number"
      ? ((suggest.duration as Record<string, unknown>).value as number)
      : null;

  return {
    price,
    oldPrice,
    duration,
    rawBudget: recommended,
  };
}

export function extractOrderMeta(payload: Record<string, unknown> | null) {
  if (!payload) {
    return {
      orderId: null,
      requestId: null,
      status: null,
    };
  }

  const orderIdCandidates = [
    payload.orderId,
    payload.order_id,
    payload.id,
  ];

  const requestIdCandidates = [
    payload.requestId,
    payload.request_id,
    payload.traceId,
  ];

  const statusCandidates = [
    payload.status,
    payload.orderStatus,
    payload.state,
  ];

  const pickStringish = (value: unknown) =>
    typeof value === "string" || typeof value === "number" ? String(value) : null;

  return {
    orderId: orderIdCandidates.map(pickStringish).find(Boolean) ?? null,
    requestId: requestIdCandidates.map(pickStringish).find(Boolean) ?? null,
    status: statusCandidates.map(pickStringish).find(Boolean) ?? null,
  };
}