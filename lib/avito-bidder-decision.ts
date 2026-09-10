export type BidderDecisionAction =
  | "raise_bid"
  | "lower_bid"
  | "keep_bid"
  | "hold_position"
  | "no_position_data";

export type BidderDecisionResult = {
  action: BidderDecisionAction;
  reason: string;
  recommendedBid: number;
};

export function clampBid(value: number, minBid: number, maxBid: number) {
  return Math.min(Math.max(value, minBid), maxBid);
}

export function calculateBidderDecision(params: {
  currentPosition: number | null;
  currentBid: number;
  minBid: number;
  maxBid: number;
  step: number;
  targetFrom: number;
  targetTo: number;
}): BidderDecisionResult {
  const {
    currentPosition,
    currentBid,
    minBid,
    maxBid,
    step,
    targetFrom,
    targetTo,
  } = params;

  if (currentPosition === null) {
    return {
      action: "no_position_data",
      reason: "Нет данных о текущей позиции объявления.",
      recommendedBid: clampBid(currentBid, minBid, maxBid),
    };
  }

  if (currentPosition < targetFrom) {
    const recommendedBid = clampBid(currentBid - step, minBid, maxBid);

    if (recommendedBid === currentBid) {
      return {
        action: "hold_position",
        reason:
          "Позиция выше целевого диапазона, но ставка уже упёрлась в минимальный лимит.",
        recommendedBid,
      };
    }

    return {
      action: "lower_bid",
      reason: `Позиция ${currentPosition} выше целевого диапазона ${targetFrom}-${targetTo}, можно снизить ставку.`,
      recommendedBid,
    };
  }

  if (currentPosition > targetTo) {
    const recommendedBid = clampBid(currentBid + step, minBid, maxBid);

    if (recommendedBid === currentBid) {
      return {
        action: "hold_position",
        reason:
          "Позиция ниже целевого диапазона, но ставка уже упёрлась в максимальный лимит.",
        recommendedBid,
      };
    }

    return {
      action: "raise_bid",
      reason: `Позиция ${currentPosition} ниже целевого диапазона ${targetFrom}-${targetTo}, нужно повысить ставку.`,
      recommendedBid,
    };
  }

  return {
    action: "keep_bid",
    reason: `Позиция ${currentPosition} находится в целевом диапазоне ${targetFrom}-${targetTo}.`,
    recommendedBid: clampBid(currentBid, minBid, maxBid),
  };
}