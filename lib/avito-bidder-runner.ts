import { prisma } from "@/lib/prisma";
import {
  createBidderEvent,
  cleanupOldBidderEvents,
} from "@/lib/avito-bidder-events";
import { getAvitoItemByIdForUser } from "@/lib/avito-api";
import { calculateBidderDecision } from "@/lib/avito-bidder-decision";
import { getBidderPosition } from "@/lib/avito-bidder-position";
import { applyBid } from "@/lib/avito-bid-apply";

type RunnerResult = {
  bidderId: number;
  userId: number;
  title: string;
  mode: "dry_run" | "live";
  status: "processed" | "skipped" | "failed";
  message: string;
  nextCheckAt: string | null;
};

function getNextCheckAt(intervalMinutes: number) {
  return new Date(Date.now() + intervalMinutes * 60 * 1000);
}

function isBidderDue(nextCheckAt: Date | null) {
  if (!nextCheckAt) return true;
  return nextCheckAt.getTime() <= Date.now();
}

export async function runSingleBidder(params: {
  bidderId: number;
  userId?: number;
}): Promise<RunnerResult> {
  await cleanupOldBidderEvents();

  const bidder = await prisma.avitoBidder.findFirst({
    where: {
      id: params.bidderId,
      ...(params.userId ? { userId: params.userId } : {}),
    },
  });

  if (!bidder) {
    return {
      bidderId: params.bidderId,
      userId: params.userId ?? 0,
      title: "Неизвестный бидер",
      mode: "dry_run",
      status: "failed",
      message: "Бидер не найден.",
      nextCheckAt: null,
    };
  }

  if (bidder.status !== "active") {
    return {
      bidderId: bidder.id,
      userId: bidder.userId,
      title: bidder.title,
      mode: bidder.mode,
      status: "skipped",
      message: "Бидер не активен.",
      nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null,
    };
  }

  if (!isBidderDue(bidder.nextCheckAt)) {
    return {
      bidderId: bidder.id,
      userId: bidder.userId,
      title: bidder.title,
      mode: bidder.mode,
      status: "skipped",
      message: "Ещё не наступило время проверки.",
      nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null,
    };
  }

  if (!bidder.avitoItemId) {
    const nextCheckAt = getNextCheckAt(bidder.checkInterval);
    const errorMessage = "У бидера нет привязанного объявления Авито.";

    const updatedBidder = await prisma.avitoBidder.update({
      where: { id: bidder.id },
      data: {
        lastCheckedAt: new Date(),
        lastError: errorMessage,
        nextCheckAt,
        status: "attention",
      },
    });

    await createBidderEvent({
      bidderId: bidder.id,
      type: "runner_error",
      message: errorMessage,
    });

    return {
      bidderId: updatedBidder.id,
      userId: updatedBidder.userId,
      title: updatedBidder.title,
      mode: updatedBidder.mode,
      status: "failed",
      message: errorMessage,
      nextCheckAt: updatedBidder.nextCheckAt?.toISOString() ?? null,
    };
  }

  try {
    const item = await getAvitoItemByIdForUser(bidder.userId, bidder.avitoItemId);

    const positionResult = await getBidderPosition({
      bidderId: bidder.id,
      query: bidder.query,
      city: bidder.city,
      avitoItemId: bidder.avitoItemId,
    });

    const decision = calculateBidderDecision({
      currentPosition: positionResult.position,
      currentBid: bidder.currentBid,
      minBid: bidder.minBid,
      maxBid: bidder.maxBid,
      bidStep: bidder.bidStep,
      targetFrom: bidder.targetFrom,
      targetTo: bidder.targetTo,
      smartEconomyEnabled: bidder.smartEconomyEnabled,
      dailySpendLimit: bidder.dailySpendLimit,
      spentToday: bidder.spentToday,
    });

    await createBidderEvent({
      bidderId: bidder.id,
      type: "runner_position_detected",
      message: `Текущая позиция объявления: ${positionResult.position ?? "не определена"} (${positionResult.source}).`,
    });

    await createBidderEvent({
      bidderId: bidder.id,
      type: "runner_bid_decision",
      message: `Решение движка: ${decision.action}. ${decision.reason} Рекомендуемая ставка: ${decision.recommendedBid} ₽.`,
    });

    if (decision.action === "stop_due_to_daily_limit") {
      const nextCheckAt = getNextCheckAt(bidder.checkInterval);

      const updatedBidder = await prisma.avitoBidder.update({
        where: { id: bidder.id },
        data: {
          title: item.title || bidder.title,
          avitoItemUrl: item.url || bidder.avitoItemUrl,
          currentPosition: positionResult.position,
          lastCheckedAt: new Date(),
          lastError: decision.reason,
          nextCheckAt,
          status: "attention",
        },
      });

      await createBidderEvent({
        bidderId: bidder.id,
        type: "runner_daily_limit_reached",
        message: decision.reason,
      });

      return {
        bidderId: updatedBidder.id,
        userId: updatedBidder.userId,
        title: updatedBidder.title,
        mode: updatedBidder.mode,
        status: "failed",
        message: decision.reason,
        nextCheckAt: updatedBidder.nextCheckAt?.toISOString() ?? null,
      };
    }

    const applyResult = await applyBid({
      mode: bidder.mode,
      bidderId: bidder.id,
      userId: bidder.userId,
      avitoItemId: bidder.avitoItemId,
      currentBid: bidder.currentBid,
      recommendedBid: decision.recommendedBid,
    });

    if (!applyResult.ok) {
      const nextCheckAt = getNextCheckAt(bidder.checkInterval);

      const updatedBidder = await prisma.avitoBidder.update({
        where: { id: bidder.id },
        data: {
          title: item.title || bidder.title,
          avitoItemUrl: item.url || bidder.avitoItemUrl,
          currentPosition: positionResult.position,
          lastCheckedAt: new Date(),
          lastError: applyResult.message,
          nextCheckAt,
          status: "attention",
        },
      });

      await createBidderEvent({
        bidderId: bidder.id,
        type: "runner_bid_apply_error",
        message: `Ошибка применения ставки: ${applyResult.message}`,
      });

      return {
        bidderId: updatedBidder.id,
        userId: updatedBidder.userId,
        title: updatedBidder.title,
        mode: updatedBidder.mode,
        status: "failed",
        message: applyResult.message,
        nextCheckAt: updatedBidder.nextCheckAt?.toISOString() ?? null,
      };
    }

    const bidIncreased = applyResult.appliedBid > bidder.currentBid;
    const estimatedSpentToday = bidIncreased
      ? bidder.spentToday + (applyResult.appliedBid - bidder.currentBid)
      : bidder.spentToday;

    const nextCheckAt = getNextCheckAt(bidder.checkInterval);

    const updatedBidder = await prisma.avitoBidder.update({
      where: { id: bidder.id },
      data: {
        title: item.title || bidder.title,
        avitoItemUrl: item.url || bidder.avitoItemUrl,
        currentPosition: positionResult.position,
        currentBid: applyResult.appliedBid,
        spentToday: estimatedSpentToday,
        lastCheckedAt: new Date(),
        lastError: null,
        nextCheckAt,
        status: "active",
      },
    });

    if (applyResult.status === "dry_run_only") {
      await createBidderEvent({
        bidderId: bidder.id,
        type: "runner_bid_applied_dry_run",
        message: applyResult.message,
      });
    } else if (applyResult.status === "pending_live_integration") {
      await createBidderEvent({
        bidderId: bidder.id,
        type: "runner_bid_apply_pending_live",
        message: applyResult.message,
      });
    } else if (applyResult.status === "applied") {
      await createBidderEvent({
        bidderId: bidder.id,
        type: "runner_bid_applied_live",
        message: applyResult.message,
      });
    }

    await createBidderEvent({
      bidderId: bidder.id,
      type: "runner_check_success",
      message: `Worker обработал объявление «${updatedBidder.title}» в режиме ${updatedBidder.mode}.`,
    });

    return {
      bidderId: updatedBidder.id,
      userId: updatedBidder.userId,
      title: updatedBidder.title,
      mode: updatedBidder.mode,
      status: "processed",
      message:
        updatedBidder.mode === "dry_run"
          ? `Dry-run обработан: позиция ${positionResult.position ?? "нет данных"}, решение ${decision.action}, внутренняя ставка ${applyResult.appliedBid} ₽.`
          : `Live-режим обработан: позиция ${positionResult.position ?? "нет данных"}, решение ${decision.action}, подготовленная ставка ${applyResult.appliedBid} ₽.`,
      nextCheckAt: updatedBidder.nextCheckAt?.toISOString() ?? null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось проверить объявление через worker.";

    const nextCheckAt = getNextCheckAt(bidder.checkInterval);

    const updatedBidder = await prisma.avitoBidder.update({
      where: { id: bidder.id },
      data: {
        lastCheckedAt: new Date(),
        lastError: message,
        nextCheckAt,
        status: "attention",
      },
    });

    await createBidderEvent({
      bidderId: bidder.id,
      type: "runner_check_error",
      message: `Worker не смог проверить объявление: ${message}`,
    });

    return {
      bidderId: updatedBidder.id,
      userId: updatedBidder.userId,
      title: updatedBidder.title,
      mode: updatedBidder.mode,
      status: "failed",
      message,
      nextCheckAt: updatedBidder.nextCheckAt?.toISOString() ?? null,
    };
  }
}

export async function runDueBidders(params?: {
  userId?: number;
  limit?: number;
}) {
  await cleanupOldBidderEvents();

  const bidders = await prisma.avitoBidder.findMany({
    where: {
      status: "active",
      ...(params?.userId ? { userId: params.userId } : {}),
    },
    orderBy: [{ nextCheckAt: "asc" }, { updatedAt: "asc" }],
    take: params?.limit ?? 100,
  });

  const results: RunnerResult[] = [];

  for (const bidder of bidders) {
    const result = await runSingleBidder({
      bidderId: bidder.id,
      userId: bidder.userId,
    });

    results.push(result);
  }

  return {
    processedAt: new Date().toISOString(),
    total: results.length,
    processed: results.filter((item) => item.status === "processed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
    dryRunProcessed: results.filter(
      (item) => item.status === "processed" && item.mode === "dry_run",
    ).length,
    liveProcessed: results.filter(
      (item) => item.status === "processed" && item.mode === "live",
    ).length,
    results,
  };
}