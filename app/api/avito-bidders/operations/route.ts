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
  return level === "pro" || level === "admin";
}

async function getAuthorizedUser() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return {
      error: NextResponse.json(
        { error: "РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ." },
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
        { error: "Р‘РёРґ-РјРµРЅРµРґР¶РµСЂ РґРѕСЃС‚СѓРїРµРЅ СЃ РїРѕРґРїРёСЃРєРѕР№ Pro." },
        { status: 403 },
      ),
    };
  }

  return { user };
}

function isCooldownActive(value: Date | null) {
  return Boolean(value && value.getTime() > Date.now());
}

function toNumericItemId(value: string | null) {
  if (!value) return null;

  const itemId = Number(value);

  return Number.isInteger(itemId) && itemId > 0 ? itemId : null;
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
    const itemId = toNumericItemId(bidder.avitoItemId);

    const liveReady = Boolean(
      bidder.mode === "live" &&
        bidder.status === "active" &&
        itemId &&
        scheduleAllowed &&
        !cooldownActive,
    );

    return {
      bidderId: bidder.id,
      title: bidder.title,
      status: bidder.status,
      mode: bidder.mode,

      strategy: "cpx_manual",
      hasAvitoItem: Boolean(itemId),
      hasError: Boolean(bidder.lastError),

      schedule: {
        raw: bidder.schedule,
        valid: Boolean(scheduleParsed),
        allowedNow: scheduleAllowed,
        nextStartAt:
          getNextScheduleStart(bidder.schedule, now)?.toISOString() ?? null,
      },

      cooldown: {
        active: cooldownActive,
        until: bidder.liveApplyCooldownUntil?.toISOString() ?? null,
      },

      liveReady,
      nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null,
      lastCheckedAt: bidder.lastCheckedAt?.toISOString() ?? null,
      lastError: bidder.lastError,

      cpx: {
        status: bidder.lastPromotionStatus,
        savedBidRubles: bidder.currentBid,
        minBidRubles: bidder.minBid,
        maxBidRubles: bidder.maxBid,
        dailySpendLimitRubles: bidder.dailySpendLimit,
        lastAppliedAt: bidder.lastAppliedAt?.toISOString() ?? null,
      },
    };
  });

  return {
    generatedAt: now.toISOString(),

    totals: {
      all: bidders.length,
      active: bidders.filter((bidder) => bidder.status === "active").length,
      paused: bidders.filter((bidder) => bidder.status === "paused").length,
      attention: bidders.filter((bidder) => bidder.status === "attention")
        .length,

      live: bidders.filter((bidder) => bidder.mode === "live").length,
      dryRun: bidders.filter((bidder) => bidder.mode === "dry_run").length,

      liveReady: details.filter((item) => item.liveReady).length,
      cooldownActive: details.filter((item) => item.cooldown.active).length,
      outsideSchedule: details.filter((item) => !item.schedule.allowedNow)
        .length,

      withErrors: details.filter((item) => item.hasError).length,
      withoutAvitoItem: details.filter((item) => !item.hasAvitoItem).length,

      // РџРѕР»Рµ СЃРѕС…СЂР°РЅРµРЅРѕ, С‡С‚РѕР±С‹ РЅРµ Р»РѕРјР°С‚СЊ dashboard;
      // РІ CPX manual order-РѕРІ РЅРµ СЃСѓС‰РµСЃС‚РІСѓРµС‚.
      withPromotionOrder: 0,
    },

    bidders: details,
  };
}

/**
 * GET /api/avito-bidders/operations
 * Р’РѕР·РІСЂР°С‰Р°РµС‚ health summary С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
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
          'РќРµРєРѕСЂСЂРµРєС‚РЅРѕРµ РґРµР№СЃС‚РІРёРµ. РџРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ: "run_due" Рё "pause_all".',
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
              : "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РјР°СЃСЃРѕРІС‹Р№ Р·Р°РїСѓСЃРє bidder-РѕРІ.",
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
      message: "РќРµС‚ Р°РєС‚РёРІРЅС‹С… bidder-РѕРІ РґР»СЏ РїРѕСЃС‚Р°РЅРѕРІРєРё РЅР° РїР°СѓР·Сѓ.",
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
      lastPromotionStatus: "paused_by_bulk_operation",
    },
  });

  await Promise.all(
    activeBidders.map((bidder) =>
      createBidderEvent({
        bidderId: bidder.id,
        type: "bulk_pause",
        message: "Bidder РїРѕСЃС‚Р°РІР»РµРЅ РЅР° РїР°СѓР·Сѓ РјР°СЃСЃРѕРІРѕР№ РѕРїРµСЂР°С†РёРµР№.",
      }),
    ),
  );

  const summary = await getHealthSummary(authorization.user.id);

  return NextResponse.json({
    success: true,
    action,
    pausedCount: activeBidders.length,
    message: `РќР° РїР°СѓР·Сѓ РїРѕСЃС‚Р°РІР»РµРЅРѕ bidder-РѕРІ: ${activeBidders.length}.`,
    summary,
  });
}
