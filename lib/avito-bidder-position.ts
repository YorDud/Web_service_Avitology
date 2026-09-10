type PositionSource = "mock";

export type BidderPositionResult = {
  position: number | null;
  source: PositionSource;
  details: string;
};

function hashStringToNumber(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

export async function getBidderPosition(params: {
  bidderId: number;
  query: string;
  city: string;
  avitoItemId: string;
}): Promise<BidderPositionResult> {
  const seed = hashStringToNumber(
    `${params.bidderId}:${params.query}:${params.city}:${params.avitoItemId}`,
  );

  const position = (seed % 12) + 1;

  return {
    position,
    source: "mock",
    details:
      "Позиция рассчитана в dry-run режиме через mock provider. Позже этот слой будет заменён на реальный источник данных.",
  };
}