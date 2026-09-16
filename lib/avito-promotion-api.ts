import { getAvitoAccessTokenForUser } from "@/lib/avito-api";

const AVITO_PROMOTION_BASE_URL = "https://api.avito.ru";

type PromotionRequestOptions = {
  userId: number;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
};

export type AvitoCpxBidOption = {
  valuePenny: number;
  minForecast: number | null;
  maxForecast: number | null;
  compare: number | null;
  raw: Record<string, unknown>;
};

export type AvitoCpxManual = {
  bidPenny: number | null;
  recBidPenny: number | null;
  minBidPenny: number | null;
  maxBidPenny: number | null;
  limitPenny: number | null;
  bids: AvitoCpxBidOption[];
  raw: Record<string, unknown> | null;
};

export type AvitoCpxBids = {
  itemId: number;
  actionTypeId: number | null;
  selectedType: string | null;
  manual: AvitoCpxManual;
  raw: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractPromotionError(payload: unknown) {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  for (const key of ["message", "error", "detail", "description"]) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  if (Array.isArray(record.errors) && record.errors.length > 0) {
    return record.errors
      .map((item) => {
        if (typeof item === "string") return item;

        const inner = asRecord(item);

        return inner?.message && typeof inner.message === "string"
          ? inner.message
          : JSON.stringify(item);
      })
      .join("; ");
  }

  return null;
}

async function avitoPromotionRequest<T>({
  userId,
  path,
  method = "GET",
  body,
}: PromotionRequestOptions): Promise<T> {
  const accessToken = await getAvitoAccessTokenForUser(userId);

  const response = await fetch(`${AVITO_PROMOTION_BASE_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
          }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : {};

  if (!response.ok) {
    throw new Error(
      extractPromotionError(payload) ||
        `CPX Promo API error: HTTP ${response.status}`,
    );
  }

  return payload as T;
}

function parseCpxBidOption(value: unknown): AvitoCpxBidOption | null {
  const record = asRecord(value);

  if (!record) return null;

  const valuePenny =
    asNumber(record.valuePenny) ??
    asNumber(record.bidPenny) ??
    asNumber(record.value);

  if (valuePenny === null || valuePenny < 0) {
    return null;
  }

  return {
    valuePenny,
    minForecast: asNumber(record.minForecast),
    maxForecast: asNumber(record.maxForecast),
    compare: asNumber(record.compare),
    raw: record,
  };
}

function parseCpxPayload(itemId: number, payload: Record<string, unknown>): AvitoCpxBids {
  const manualRecord = asRecord(payload.manual);
  const rawBids = Array.isArray(manualRecord?.bids) ? manualRecord.bids : [];

  return {
    itemId,
    actionTypeId:
      asNumber(payload.actionTypeID) ?? asNumber(payload.actionTypeId),
    selectedType:
      typeof payload.selectedType === "string" ? payload.selectedType : null,
    manual: {
      bidPenny: asNumber(manualRecord?.bidPenny),
      recBidPenny: asNumber(manualRecord?.recBidPenny),
      minBidPenny: asNumber(manualRecord?.minBidPenny),
      maxBidPenny: asNumber(manualRecord?.maxBidPenny),
      limitPenny: asNumber(manualRecord?.limitPenny),
      bids: rawBids
        .map(parseCpxBidOption)
        .filter((item): item is AvitoCpxBidOption => Boolean(item))
        .sort((a, b) => a.valuePenny - b.valuePenny),
      raw: manualRecord,
    },
    raw: payload,
  };
}

export async function getCpxBidsForItem(params: {
  userId: number;
  itemId: number;
}): Promise<AvitoCpxBids> {
  const payload = await avitoPromotionRequest<Record<string, unknown>>({
    userId: params.userId,
    path: `/cpxpromo/1/getBids/${params.itemId}`,
    method: "GET",
  });

  return parseCpxPayload(params.itemId, payload);
}

export async function setCpxManualBidForItem(params: {
  userId: number;
  itemId: number;
  actionTypeId: number;
  bidPenny: number;
  limitPenny?: number | null;
}) {
  if (!Number.isInteger(params.itemId) || params.itemId <= 0) {
    throw new Error("Некорректный itemId для CPX Promo.");
  }

  if (!Number.isInteger(params.actionTypeId) || params.actionTypeId <= 0) {
    throw new Error("Avito не вернул actionTypeID для CPX Promo.");
  }

  if (!Number.isInteger(params.bidPenny) || params.bidPenny < 0) {
    throw new Error("Некорректная CPX-ставка.");
  }

  const body: Record<string, unknown> = {
    itemID: params.itemId,
    actionTypeID: params.actionTypeId,
    bidPenny: params.bidPenny,
  };

  if (
    typeof params.limitPenny === "number" &&
    Number.isInteger(params.limitPenny) &&
    params.limitPenny >= 0
  ) {
    body.limitPenny = params.limitPenny;
  }

  return avitoPromotionRequest<Record<string, unknown>>({
    userId: params.userId,
    path: "/cpxpromo/1/setManual",
    method: "POST",
    body,
  });
}

export function pennyToRubles(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  return value / 100;
}

export function rublesToPenny(value: number) {
  return Math.round(value * 100);
}

export function formatRublesFromPenny(value: number | null | undefined) {
  const rubles = pennyToRubles(value);

  if (rubles === null) return "—";

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rubles);
}

export function findAllowedCpxBid(params: {
  desiredBidPenny: number;
  minBidPenny: number;
  maxBidPenny: number;
  availableBids: AvitoCpxBidOption[];
}) {
  const candidates = params.availableBids.filter(
    (item) =>
      item.valuePenny >= params.minBidPenny &&
      item.valuePenny <= params.maxBidPenny,
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, current) => {
    const bestDistance = Math.abs(best.valuePenny - params.desiredBidPenny);
    const currentDistance = Math.abs(
      current.valuePenny - params.desiredBidPenny,
    );

    if (currentDistance < bestDistance) return current;
    if (
      currentDistance === bestDistance &&
      current.valuePenny < best.valuePenny
    ) {
      return current;
    }

    return best;
  });
}