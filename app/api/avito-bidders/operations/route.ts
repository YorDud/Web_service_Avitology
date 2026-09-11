import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { runDueBidders } from "@/lib/avito-bidder-runner";
import {
  getNextScheduleStart,
  isTimeWithinBidderSchedule,
  parseBidderSchedule,
} from "@/lib/avito-bidder-schedule";
import { createBidderEvent } from "@/lib/avito-bidder-events";

function hasBidderAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

async function getAuthorizedUser() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return {
      error: NextResponse.json(
        { error: "Требуется авторизация." },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      subscriptionLevel: true,
    },
  });

  if (!user || !hasBidderAccess(user.subscriptionLevel)) {
    return {
      error: NextResponse.json(
        { error: "Бид-менеджер доступен с подпиской Basic." },
        { status: 403 },
      ),
    };
  }

  return { user };
}

function isCooldownActive(value: Date | null) {
  return Boolean(value && value.getTime() > Date.now());
}

async function getHealthSummary(userId: number) {
  const bidders = await prisma.avitoBidder.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();

  const details = bidders.map((bidder) => {
    const scheduleParsed = parseBidderSchedule(bidder.schedule);
    const scheduleAllowed = isTimeWithinBidderSchedule(bidder.schedule, now);
    const cooldownActive = isCooldownActive(bidder.liveApplyCooldownUntil);

    const liveReady = Boolean(
      bidder.mode === "live" &&
        bidder.status === "active" &&
        bidder.avitoItemId &&
        scheduleAllowed &&
        !cooldownActive,
    );

    return {
      bidderId: bidder.id,
      title: bidder.title,
      status: bidder.status,
      mode: bidder.mode,
      hasAvitoItem: Boolean(bidder.avitoItemId),
      hasOrder: Boolean(bidder.lastPromotionOrderId),
      hasError: Boolean(bidder.lastError),
      schedule: {
        raw: bidder.schedule,
        valid: Boolean(scheduleParsed),
        allowedNow: scheduleAllowed,
        nextStartAt: getNextScheduleStart(bidder.schedule, now)?.toISOString() ?? null,
      },
      cooldown: {
        active: cooldownActive,
        until: bidder.liveApplyCooldownUntil?.toISOString() ?? null,
      },
      liveReady,
      nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null,
      lastCheckedAt: bidder.lastCheckedAt?.toISOString() ?? null,
      lastError: bidder.lastError,
      promotionStatus: bidder.lastPromotionStatus,
    };
  });

  return {
    generatedAt: now.toISOString(),

    totals: {
      all: bidders.length,
      active: bidders.filter((bidder) => bidder.status === "active").length,
      paused: bidders.filter((bidder) => bidder.status === "paused").length,
      attention: bidders.filter((bidder) => bidder.status === "attention").length,

      live: bidders.filter((bidder) => bidder.mode === "live").length,
      dryRun: bidders.filter((bidder) => bidder.mode === "dry_run").length,

      liveReady: details.filter((item) => item.liveReady).length,
      cooldownActive: details.filter((item) => item.cooldown.active).length,
      outsideSchedule: details.filter(
        (item) => !item.schedule.allowedNow,
      ).length,

      withErrors: details.filter((item) => item.hasError).length,
      withoutAvitoItem: details.filter((item) => !item.hasAvitoItem).length,
      withPromotionOrder: details.filter((item) => item.hasOrder).length,
    },

    bidders: details,
  };
}

/**
 * GET /api/avito-bidders/operations
 *
 * Возвращает health summary всех bidder-ов текущего пользователя.
 */
export async function GET() {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  const summary = await getHealthSummary(authorization.user.id);

  return NextResponse.json({
    success: true,
    summary,
  });
}

/**
 * POST /api/avito-bidders/operations
 *
 * Body:
 * { action: "run_due" }
 * { action: "pause_all" }
 */
export async function POST(request: Request) {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action !== "run_due" && action !== "pause_all") {
    return NextResponse.json(
      {
        error:
          'Некорректное действие. Поддерживаются: "run_due" и "pause_all".',
      },
      { status: 400 },
    );
  }

  if (action === "run_due") {
    try {
      const result = await runDueBidders({
        userId: authorization.user.id,
        limit: 100,
      });

      const summary = await getHealthSummary(authorization.user.id);

      return NextResponse.json({
        success: true,
        action,
        result,
        summary,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Не удалось выполнить массовый запуск bidder-ов.",
        },
        { status: 500 },
      );
    }
  }

  const activeBidders = await prisma.avitoBidder.findMany({
    where: {
      userId: authorization.user.id,
      status: "active",
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (activeBidders.length === 0) {
    const summary = await getHealthSummary(authorization.user.id);

    return NextResponse.json({
      success: true,
      action,
      pausedCount: 0,
      message: "Нет активных bidder-ов для постановки на паузу.",
      summary,
    });
  }

  await prisma.avitoBidder.updateMany({
    where: {
      userId: authorization.user.id,
      status: "active",
    },
    data: {
      status: "paused",
      nextCheckAt: null,
      lastError: null,
    },
  });

  await Promise.all(
    activeBidders.map((bidder) =>
      createBidderEvent({
        bidderId: bidder.id,
        type: "bulk_pause",
        message: "Bidder поставлен на паузу массовой операцией.",
      }),
    ),
  );

  const summary = await getHealthSummary(authorization.user.id);

  return NextResponse.json({
    success: true,
    action,
    pausedCount: activeBidders.length,
    message: `На паузу поставлено bidder-ов: ${activeBidders.length}.`,
    summary,
  });
}