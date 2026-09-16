import {
  findAllowedCpxBid,
  formatRublesFromPenny,
  getCpxBidsForItem,
  rublesToPenny,
  setCpxManualBidForItem,
} from "@/lib/avito-promotion-api";

import type { PositionSource } from "@/lib/avito-bidder-position";
import type { BidderDecisionAction } from "@/lib/avito-bidder-decision";

export type ApplyBidMode = "dry_run" | "live";

export type ApplyBidResult =
  | {
      ok: true;
      applied: boolean;
      status:
        | "dry_run_only"
        | "cooldown_active"
        | "applied"
        | "already_applied"
        | "blocked_unverified_position";
      message: string;
      appliedBid: number;
      actualBid: number;
      cpxActionTypeId: number | null;
      cpxCompare: number | null;
      cpxForecastMin: number | null;
      cpxForecastMax: number | null;
      cpxRecommendedBid: number | null;
      lastPromotionPayload: string | null;
      lastForecastPayload: string | null;
      lastSuggestPayload: string | null;
      lastPromotionStatus: string | null;
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
  userId: number;
  avitoItemId: string;
  currentBid: number;
recommendedBid: number;
decisionAction: BidderDecisionAction;
minBid: number;
  maxBid: number;
  dailySpendLimit: number;
  cooldownActive?: boolean;
  positionSource?: PositionSource;

  // Используется только для ручной кнопки «Применить CPX» после ввода LIVE.
  // Автоматический worker этот флаг не передаёт.
  allowManualLiveApply?: boolean;
}) {
  const itemId = toItemIdNumber(params.avitoItemId);

  if (!itemId) {
    return {
      ok: false,
      status: "failed",
      message: "Для CPX Promo нужен числовой Avito itemId.",
    } satisfies ApplyBidResult;
  }

  try {
    const before = await getCpxBidsForItem({
      userId: params.userId,
      itemId,
    });

    const actualBidRubles =
      before.manual.bidPenny === null
        ? params.currentBid
        : Math.round(before.manual.bidPenny / 100);

    const desiredBidPenny = rublesToPenny(params.recommendedBid);
    const minBidPenny = rublesToPenny(params.minBid);
    const maxBidPenny = rublesToPenny(params.maxBid);

    const allowedBidsInRange = before.manual.bids
  .filter(
    (bid) =>
      bid.valuePenny >= minBidPenny &&
      bid.valuePenny <= maxBidPenny,
  )
  .sort((left, right) => left.valuePenny - right.valuePenny);

let selectedBid = findAllowedCpxBid({
  desiredBidPenny,
  minBidPenny,
  maxBidPenny,
  availableBids: before.manual.bids,
});

// При повышении нельзя выбирать ставку ниже расчётной.
// Например: recommendation = 3 ₽, ставки Авито 2/4/6.
// Нужна 4 ₽, а не 2 ₽.
if (params.decisionAction === "raise_bid") {
  selectedBid =
    allowedBidsInRange.find(
      (bid) => bid.valuePenny >= desiredBidPenny,
    ) ?? null;
}

// При снижении нельзя выбирать ставку выше расчётной.
// Например: recommendation = 3 ₽, ставки Авито 2/4/6.
// Нужна 2 ₽, а не 4 ₽.
if (params.decisionAction === "lower_bid") {
  selectedBid =
    [...allowedBidsInRange]
      .reverse()
      .find((bid) => bid.valuePenny <= desiredBidPenny) ?? null;
}

    if (!selectedBid) {
      return {
        ok: false,
        status: "failed",
        message:
          "В заданном диапазоне HelpSell нет допустимых ставок, которые разрешил Avito CPX.",
      } satisfies ApplyBidResult;
    }

    const selectedBidRubles = Math.round(selectedBid.valuePenny / 100);
    const recommendedBidRubles =
      before.manual.recBidPenny === null
        ? null
        : before.manual.recBidPenny / 100;

    const common = {
      appliedBid: selectedBidRubles,
      actualBid: actualBidRubles,
      cpxActionTypeId: before.actionTypeId,
      cpxCompare: selectedBid.compare,
      cpxForecastMin: selectedBid.minForecast,
      cpxForecastMax: selectedBid.maxForecast,
      cpxRecommendedBid: recommendedBidRubles,
      lastPromotionPayload: safeStringify(before.raw),
      lastForecastPayload: safeStringify({
        minForecast: selectedBid.minForecast,
        maxForecast: selectedBid.maxForecast,
        compare: selectedBid.compare,
      }),
      lastSuggestPayload: safeStringify({
        selectedType: before.selectedType,
        manual: before.manual,
      }),
    };

    if (params.mode === "dry_run") {
      return {
        ok: true,
        applied: false,
        status: "dry_run_only",
        message: `Dry-run: была бы выбрана CPX-ставка ${formatRublesFromPenny(
          selectedBid.valuePenny,
        )} ₽. Текущая ставка Avito: ${formatRublesFromPenny(
          before.manual.bidPenny,
        )} ₽.`,
        lastPromotionStatus: "dry_run",
        ...common,
      } satisfies ApplyBidResult;
    }

    if (params.cooldownActive) {
      return {
        ok: true,
        applied: false,
        status: "cooldown_active",
        message: "Повторное live-применение временно заблокировано cooldown-защитой.",
        lastPromotionStatus: "cooldown_active",
        ...common,
      } satisfies ApplyBidResult;
    }

    if (
  !params.allowManualLiveApply &&
  params.positionSource !== "avito_serp_playwright" &&
  params.positionSource !== "avito_serp_first_page_not_found"
) {
  return {
    ok: true,
    applied: false,
    status: "blocked_unverified_position",
    message:
      "Live-изменение не выполнено: нет подтверждённой позиции из поисковой выдачи Авито.",
    lastPromotionStatus: "blocked_unverified_position",
    ...common,
  } satisfies ApplyBidResult;
}

    if (before.manual.bidPenny === selectedBid.valuePenny) {
      return {
        ok: true,
        applied: false,
        status: "already_applied",
        message: `CPX-ставка уже установлена: ${formatRublesFromPenny(
          selectedBid.valuePenny,
        )} ₽.`,
        lastPromotionStatus: "already_applied",
        ...common,
      } satisfies ApplyBidResult;
    }

    if (!before.actionTypeId) {
      return {
        ok: false,
        status: "failed",
        message: "Avito CPX не вернул actionTypeID для объявления.",
      } satisfies ApplyBidResult;
    }

    const limitPenny =
      params.dailySpendLimit > 0
        ? rublesToPenny(params.dailySpendLimit)
        : undefined;

    const setResult = await setCpxManualBidForItem({
      userId: params.userId,
      itemId,
      actionTypeId: before.actionTypeId,
      bidPenny: selectedBid.valuePenny,
      limitPenny,
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const after = await getCpxBidsForItem({
      userId: params.userId,
      itemId,
    });

    const confirmed = after.manual.bidPenny === selectedBid.valuePenny;

    if (!confirmed) {
      return {
        ok: false,
        status: "failed",
        message: `Avito не подтвердил применение ставки. Запрошено: ${formatRublesFromPenny(
          selectedBid.valuePenny,
        )} ₽; получено после проверки: ${formatRublesFromPenny(
          after.manual.bidPenny,
        )} ₽.`,
      } satisfies ApplyBidResult;
    }

    return {
      ok: true,
      applied: true,
      status: "applied",
      message: `CPX-ставка применена и подтверждена Avito: ${formatRublesFromPenny(
        selectedBid.valuePenny,
      )} ₽.`,
      ...common,
      actualBid: Math.round(
  (after.manual.bidPenny ?? selectedBid.valuePenny) / 100,
),
      lastPromotionPayload: safeStringify({
        setResult,
        after: after.raw,
      }),
      lastPromotionStatus: "applied_confirmed",
    } satisfies ApplyBidResult;
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Не удалось применить CPX-ставку через Avito API.",
    } satisfies ApplyBidResult;
  }
}