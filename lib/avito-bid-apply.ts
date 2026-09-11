export type ApplyBidMode = "dry_run" | "live";

export type ApplyBidResult =
  | {
      ok: true;
      applied: false;
      status: "dry_run_only";
      message: string;
      appliedBid: number;
    }
  | {
      ok: true;
      applied: false;
      status: "pending_live_integration";
      message: string;
      appliedBid: number;
    }
  | {
      ok: true;
      applied: true;
      status: "applied";
      message: string;
      appliedBid: number;
      externalRequestId?: string | null;
    }
  | {
      ok: false;
      status: "failed";
      message: string;
    };

export async function applyBid(params: {
  mode: ApplyBidMode;
  bidderId: number;
  userId: number;
  avitoItemId: string;
  currentBid: number;
  recommendedBid: number;
}) : Promise<ApplyBidResult> {
  if (params.mode === "dry_run") {
    return {
      ok: true,
      applied: false,
      status: "dry_run_only",
      message: `Dry-run: ставка ${params.recommendedBid} ₽ сохранена только внутри системы.`,
      appliedBid: params.recommendedBid,
    };
  }

  return {
    ok: true,
    applied: false,
    status: "pending_live_integration",
    message: `Live-режим включён, но реальная отправка ставки в Avito API пока не подключена. Подготовленная ставка: ${params.recommendedBid} ₽.`,
    appliedBid: params.recommendedBid,
  };
}