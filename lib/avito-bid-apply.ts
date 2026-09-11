import {
  createBbipOrderForItem,
  extractOrderMeta,
  getBbipForecastsForItem,
  getBbipSuggestsForItem,
  getPromotionServicesForItem,
  normalizeSuggestedBudget,
} from "@/lib/avito-promotion-api";

export type ApplyBidMode = "dry_run" | "live";

export type ApplyBidResult =
  | {
      ok: true;
      applied: false;
      status: "dry_run_only";
      message: string;
      appliedBid: number;
      lastPromotionPayload?: string | null;
      lastForecastPayload?: string | null;
      lastSuggestPayload?: string | null;
      lastPromotionOrderId?: string | null;
      lastPromotionRequestId?: string | null;
      lastPromotionStatus?: string | null;
      lastPromotionPrice?: number | null;
      lastPromotionOldPrice?: number | null;
    }
  | {
      ok: true;
      applied: false;
      status: "cooldown_active";
      message: string;
      appliedBid: number;
      lastPromotionPayload?: string | null;
      lastForecastPayload?: string | null;
      lastSuggestPayload?: string | null;
      lastPromotionOrderId?: string | null;
      lastPromotionRequestId?: string | null;
      lastPromotionStatus?: string | null;
      lastPromotionPrice?: number | null;
      lastPromotionOldPrice?: number | null;
    }
  | {
      ok: true;
      applied: false;
      status: "pending_live_integration";
      message: string;
      appliedBid: number;
      lastPromotionPayload?: string | null;
      lastForecastPayload?: string | null;
      lastSuggestPayload?: string | null;
      lastPromotionOrderId?: string | null;
      lastPromotionRequestId?: string | null;
      lastPromotionStatus?: string | null;
      lastPromotionPrice?: number | null;
      lastPromotionOldPrice?: number | null;
    }
  | {
      ok: true;
      applied: true;
      status: "applied";
      message: string;
      appliedBid: number;
      externalRequestId?: string | null;
      lastPromotionPayload?: string | null;
      lastForecastPayload?: string | null;
      lastSuggestPayload?: string | null;
      lastPromotionOrderId?: string | null;
      lastPromotionRequestId?: string | null;
      lastPromotionStatus?: string | null;
      lastPromotionPrice?: number | null;
      lastPromotionOldPrice?: number | null;
    }
  | {
      ok: false;
      status: "failed";
      message: string;
    };

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function toItemIdNumber(value: string) {
  const itemId = Number(value);
  return Number.isInteger(itemId) && itemId > 0 ? itemId : null;
}

export async function applyBid(params: {
  mode: ApplyBidMode;
  bidderId: number;
  userId: number;
  avitoItemId: string;
  currentBid: number;
  recommendedBid: number;
  promotionDurationDays?: number;
  cooldownActive?: boolean;
}) {
  if (params.mode === "dry_run") {
    return {
      ok: true,
      applied: false,
      status: "dry_run_only",
      message: `Dry-run: ставка была бы изменена с ${params.currentBid} ₽ до ${params.recommendedBid} ₽.`,
      appliedBid: params.recommendedBid,
      lastPromotionPayload: null,
      lastForecastPayload: null,
      lastSuggestPayload: null,
      lastPromotionOrderId: null,
      lastPromotionRequestId: null,
      lastPromotionStatus: "dry_run",
      lastPromotionPrice: null,
      lastPromotionOldPrice: null,
    } satisfies ApplyBidResult;
  }

  if (params.cooldownActive) {
    return {
      ok: true,
      applied: false,
      status: "cooldown_active",
      message:
        "Повторное live-применение временно заблокировано cooldown-защитой.",
      appliedBid: params.currentBid,
      lastPromotionPayload: null,
      lastForecastPayload: null,
      lastSuggestPayload: null,
      lastPromotionOrderId: null,
      lastPromotionRequestId: null,
      lastPromotionStatus: "cooldown_active",
      lastPromotionPrice: null,
      lastPromotionOldPrice: null,
    } satisfies ApplyBidResult;
  }

  const itemId = toItemIdNumber(params.avitoItemId);

  if (!itemId) {
    return {
      ok: false,
      status: "failed",
      message:
        "Для live-применения требуется числовой Avito itemId, совместимый с Promotion API.",
    } satisfies ApplyBidResult;
  }

  try {
    const servicesResult = await getPromotionServicesForItem({
      userId: params.userId,
      itemId,
    });

    const suggestsResult = await getBbipSuggestsForItem({
      userId: params.userId,
      itemId,
    });

    const selectedSuggest =
      suggestsResult.suggests.find((item) => {
        const itemValue =
          typeof item.itemId === "number" || typeof item.itemId === "string"
            ? String(item.itemId)
            : null;
        return itemValue === String(itemId);
      }) ?? suggestsResult.suggests[0];

    const normalizedBudget = normalizeSuggestedBudget(selectedSuggest);

    if (!normalizedBudget?.price || !normalizedBudget.oldPrice) {
      return {
        ok: true,
        applied: false,
        status: "pending_live_integration",
        message:
          "Promotion API не вернул подходящий BBIP budget для live-применения.",
        appliedBid: params.currentBid,
        lastPromotionPayload: safeStringify(servicesResult.raw),
        lastForecastPayload: null,
        lastSuggestPayload: safeStringify(suggestsResult.raw),
        lastPromotionOrderId: null,
        lastPromotionRequestId: null,
        lastPromotionStatus: "no_budget_from_suggests",
        lastPromotionPrice: null,
        lastPromotionOldPrice: null,
      } satisfies ApplyBidResult;
    }

    const duration =
      params.promotionDurationDays && params.promotionDurationDays > 0
        ? params.promotionDurationDays
        : normalizedBudget.duration && normalizedBudget.duration > 0
          ? normalizedBudget.duration
          : 7;

    const forecastResult = await getBbipForecastsForItem({
      userId: params.userId,
      itemId,
      duration,
      price: normalizedBudget.price,
      oldPrice: normalizedBudget.oldPrice,
    });

    const orderResult = await createBbipOrderForItem({
      userId: params.userId,
      itemId,
      duration,
      price: normalizedBudget.price,
      oldPrice: normalizedBudget.oldPrice,
    });

    const orderMeta = extractOrderMeta(orderResult);

    return {
      ok: true,
      applied: true,
      status: "applied",
      message: orderMeta.orderId
        ? `Live BBIP заявка создана. Order ID: ${orderMeta.orderId}.`
        : "Live BBIP заявка отправлена в Promotion API.",
      appliedBid: params.recommendedBid,
      externalRequestId: orderMeta.requestId,
      lastPromotionPayload: safeStringify(orderResult),
      lastForecastPayload: safeStringify(forecastResult.raw),
      lastSuggestPayload: safeStringify(suggestsResult.raw),
      lastPromotionOrderId: orderMeta.orderId,
      lastPromotionRequestId: orderMeta.requestId,
      lastPromotionStatus: orderMeta.status ?? "created",
      lastPromotionPrice: normalizedBudget.price,
      lastPromotionOldPrice: normalizedBudget.oldPrice,
    } satisfies ApplyBidResult;
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Не удалось применить live BBIP через Promotion API.",
    } satisfies ApplyBidResult;
  }
}