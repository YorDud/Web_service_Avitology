import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  getNextScheduleStart,
  isTimeWithinBidderSchedule,
  parseBidderSchedule,
} from "@/lib/avito-bidder-schedule";

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
    return NextResponse.json({ error: "Бидер не найден" }, { status: 404 });
  }

  const parsedSchedule = parseBidderSchedule(bidder.schedule);
  const scheduleValid = Boolean(parsedSchedule);
  const allowedNow = isTimeWithinBidderSchedule(bidder.schedule, new Date());
  const nextScheduleStart = getNextScheduleStart(bidder.schedule, new Date());

  const cooldownActive = Boolean(
    bidder.liveApplyCooldownUntil &&
      bidder.liveApplyCooldownUntil.getTime() > Date.now(),
  );

  const hasPromotionOrder = Boolean(bidder.lastPromotionOrderId);
  const liveReady = Boolean(
    bidder.mode === "live" &&
      bidder.avitoItemId &&
      bidder.status === "active" &&
      allowedNow &&
      !cooldownActive,
  );

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
      strategy: bidder.promotionStrategy,
      durationDays: bidder.promotionDurationDays,
      hasOrder: hasPromotionOrder,
      orderId: bidder.lastPromotionOrderId,
      requestId: bidder.lastPromotionRequestId,
      status: bidder.lastPromotionStatus,
      price: bidder.lastPromotionPrice,
      oldPrice: bidder.lastPromotionOldPrice,
      lastAppliedAt: bidder.lastAppliedAt?.toISOString() ?? null,
      lastOrderStatusCheckedAt:
        bidder.lastOrderStatusCheckedAt?.toISOString() ?? null,
    },
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
  });
}