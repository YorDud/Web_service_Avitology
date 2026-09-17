import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  getNextScheduleStart,
  isTimeWithinBidderSchedule,
  parseBidderSchedule,
} from "@/lib/avito-bidder-schedule";
import {
  getCpxBidsForItem,
  pennyToRubles,
} from "@/lib/avito-promotion-api";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function hasBidderAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

async function getAuthorizedUser() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return {
      error: NextResponse.json(
        { error: "Требуется авторизация" },
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
        { error: "Бид-менеджер доступен с подпиской Basic" },
        { status: 403 },
      ),
    };
  }

  return { user };
}

async function getBidderId(context: RouteContext) {
  const { id } = await context.params;
  const bidderId = Number(id);

  return Number.isInteger(bidderId) && bidderId > 0 ? bidderId : null;
}

function toNumericItemId(value: string | null) {
  if (!value) return null;

  const itemId = Number(value);

  return Number.isInteger(itemId) && itemId > 0 ? itemId : null;
}

export async function GET(_: Request, context: RouteContext) {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  const bidderId = await getBidderId(context);

  if (!bidderId) {
    return NextResponse.json(
      { error: "Некорректный идентификатор бидера" },
      { status: 400 },
    );
  }

  const bidder = await prisma.avitoBidder.findFirst({
    where: {
      id: bidderId,
      userId: authorization.user.id,
    },
  });

  if (!bidder) {
    return NextResponse.json(
      { error: "Бидер не найден" },
      { status: 404 },
    );
  }

  const now = new Date();
  const parsedSchedule = parseBidderSchedule(bidder.schedule);
  const scheduleValid = Boolean(parsedSchedule);
  const allowedNow = isTimeWithinBidderSchedule(bidder.schedule, now);
  const nextScheduleStart = getNextScheduleStart(bidder.schedule, now);

  const cooldownActive = Boolean(
    bidder.liveApplyCooldownUntil &&
      bidder.liveApplyCooldownUntil.getTime() > Date.now(),
  );

  const itemId = toNumericItemId(bidder.avitoItemId);

  const liveReady = Boolean(
    bidder.mode === "live" &&
      bidder.status === "active" &&
      itemId &&
      allowedNow &&
      !cooldownActive,
  );

  let cpx:
    | {
        ok: true;
        actionTypeId: number | null;
        selectedType: string | null;
        currentBidPenny: number | null;
        currentBidRubles: number | null;
        recommendedBidPenny: number | null;
        recommendedBidRubles: number | null;
        minBidPenny: number | null;
        minBidRubles: number | null;
        maxBidPenny: number | null;
        maxBidRubles: number | null;
        limitPenny: number | null;
        limitRubles: number | null;
        availableBidsCount: number;
      }
    | {
        ok: false;
        error: string;
      }
    | null = null;

  if (itemId) {
    try {
      const cpxResult = await getCpxBidsForItem({
        userId: bidder.userId,
        itemId,
      });

      cpx = {
        ok: true,
        actionTypeId: cpxResult.actionTypeId,
        selectedType: cpxResult.selectedType,
        currentBidPenny: cpxResult.manual.bidPenny,
        currentBidRubles: pennyToRubles(cpxResult.manual.bidPenny),
        recommendedBidPenny: cpxResult.manual.recBidPenny,
        recommendedBidRubles: pennyToRubles(cpxResult.manual.recBidPenny),
        minBidPenny: cpxResult.manual.minBidPenny,
        minBidRubles: pennyToRubles(cpxResult.manual.minBidPenny),
        maxBidPenny: cpxResult.manual.maxBidPenny,
        maxBidRubles: pennyToRubles(cpxResult.manual.maxBidPenny),
        limitPenny: cpxResult.manual.limitPenny,
        limitRubles: pennyToRubles(cpxResult.manual.limitPenny),
        availableBidsCount: cpxResult.manual.bids.length,
      };
    } catch (error) {
      cpx = {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось получить CPX-данные из Avito API.",
      };
    }
  }

  return NextResponse.json({
    bidderId: bidder.id,
    title: bidder.title,
    mode: bidder.mode,
    status: bidder.status,
    avitoItemId: bidder.avitoItemId,

    schedule: {
      raw: bidder.schedule,
      valid: scheduleValid,
      parsed: parsedSchedule,
      allowedNow,
      nextStartAt: nextScheduleStart?.toISOString() ?? null,
    },

    cooldown: {
      active: cooldownActive,
      until: bidder.liveApplyCooldownUntil?.toISOString() ?? null,
    },

    promotion: {
      strategy: "cpx_manual",
      status: bidder.lastPromotionStatus,
      lastAppliedAt: bidder.lastAppliedAt?.toISOString() ?? null,

      // Оставлено для совместимости текущего dashboard UI.
      // В CPX нет order ID.
      hasOrder: false,
      orderId: null,
      requestId: bidder.lastPromotionRequestId,

      savedBidRubles: bidder.currentBid,
      bidderMinBidRubles: bidder.minBid,
      bidderMaxBidRubles: bidder.maxBid,
      dailySpendLimitRubles: bidder.dailySpendLimit,
    },

    cpx,

    runner: {
      nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null,
      lastCheckedAt: bidder.lastCheckedAt?.toISOString() ?? null,
      lastError: bidder.lastError,
      currentPosition: bidder.currentPosition,
      currentBid: bidder.currentBid,
      spentToday: bidder.spentToday,
      spentTodayDate: bidder.spentTodayDate,
    },

    liveReady,

    warnings: [
      bidder.mode === "live"
        ? "Автоматический live-worker не применяет ставку при mock-позиции. Ручное применение CPX после подтверждения LIVE доступно."
        : null,
      !itemId
        ? "У bidder-а нет корректного числового Avito item ID."
        : null,
      !scheduleValid
        ? "Расписание bidder-а не удалось разобрать."
        : null,
      cpx && !cpx.ok
        ? `CPX недоступен: ${cpx.error}`
        : null,
    ].filter(Boolean),
  });
}