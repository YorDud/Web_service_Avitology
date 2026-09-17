import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { applyBid } from "@/lib/avito-bid-apply";
import { createBidderEvent } from "@/lib/avito-bidder-events";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function hasBidderAccess(level: string | null | undefined) {
  return level === "pro" || level === "admin";
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
        { error: "Бид-менеджер доступен с подпиской Pro" },
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

function parseRequestedBid(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(value);
}

/**
 * Ручное live-применение CPX manual bid.
 *
 * Body:
 * {
 *   confirmation: "LIVE",
 *   bidRubles?: number
 * }
 *
 * Если bidRubles не передан — используется текущая внутренняя ставка bidder-а.
 */
export async function POST(request: Request, context: RouteContext) {
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

  const body = await request.json().catch(() => null);

  if (body?.confirmation !== "LIVE") {
    return NextResponse.json(
      {
        error:
          "Для боевого применения CPX-ставки введите подтверждение LIVE.",
      },
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

  if (bidder.mode !== "live") {
    return NextResponse.json(
      {
        error:
          "Ручное CPX-применение доступно только для bidder-а в режиме live.",
      },
      { status: 400 },
    );
  }

  if (bidder.status !== "active") {
    return NextResponse.json(
      {
        error:
          "Для ручного CPX-применения bidder должен быть активным.",
      },
      { status: 400 },
    );
  }

  if (!bidder.avitoItemId) {
    return NextResponse.json(
      { error: "У бидера нет привязанного объявления Авито." },
      { status: 400 },
    );
  }

  if (
    bidder.liveApplyCooldownUntil &&
    bidder.liveApplyCooldownUntil.getTime() > Date.now()
  ) {
    return NextResponse.json(
      {
        error: `Повторное live-применение временно недоступно до ${bidder.liveApplyCooldownUntil.toISOString()}.`,
      },
      { status: 429 },
    );
  }

  const requestedBid = parseRequestedBid(body?.bidRubles, bidder.currentBid);

  if (requestedBid < bidder.minBid || requestedBid > bidder.maxBid) {
    return NextResponse.json(
      {
        error: `Ставка ${requestedBid} ₽ выходит за лимиты bidder-а: ${bidder.minBid}–${bidder.maxBid} ₽.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyBid({
      mode: "live",
      userId: bidder.userId,
      avitoItemId: bidder.avitoItemId,
            currentBid: bidder.currentBid,
      recommendedBid: requestedBid,

      // Ручное действие не использует решение позиционного алгоритма.
      // "keep_bid" оставляет стандартный выбор ближайшей разрешённой ставки.
      decisionAction: "keep_bid",

      minBid: bidder.minBid,
      maxBid: bidder.maxBid,
      dailySpendLimit: bidder.dailySpendLimit,
      cooldownActive: false,

      // Не передаём "mock": это ручное, явно подтверждённое пользователем действие.
      allowManualLiveApply: true,
    });

    if (!result.ok) {
      await createBidderEvent({
        bidderId: bidder.id,
        type: "manual_cpx_apply_error",
        message: result.message,
      });

      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    const changed = result.status === "applied";

    const updatedBidder = await prisma.avitoBidder.update({
      where: {
        id: bidder.id,
      },
      data: {
        currentBid: result.actualBid,
        promotionStrategy: "cpx_manual",

        lastPromotionPayload:
          result.lastPromotionPayload ?? bidder.lastPromotionPayload,
        lastForecastPayload:
          result.lastForecastPayload ?? bidder.lastForecastPayload,
        lastSuggestPayload:
          result.lastSuggestPayload ?? bidder.lastSuggestPayload,

        // Старые поля оставлены только ради совместимости текущей БД/UI.
        // CPX не создаёт order ID.
        lastPromotionOrderId: null,
        lastPromotionRequestId:
          result.cpxActionTypeId === null
            ? null
            : String(result.cpxActionTypeId),
        lastPromotionStatus:
          result.lastPromotionStatus ?? "cpx_manual_checked",
        lastPromotionPrice: result.actualBid,
        lastPromotionOldPrice: null,

        lastAppliedAt: changed ? new Date() : bidder.lastAppliedAt,
        lastError: null,

        liveApplyCooldownUntil: changed
          ? new Date(Date.now() + 15 * 60 * 1000)
          : bidder.liveApplyCooldownUntil,

        changesToday: changed
          ? bidder.changesToday + 1
          : bidder.changesToday,
      },
    });

    await createBidderEvent({
      bidderId: bidder.id,
      type: changed ? "manual_cpx_applied" : "manual_cpx_checked",
      message: result.message,
    });

    return NextResponse.json({
      success: true,
      bidderId: updatedBidder.id,
      message: result.message,

      result: {
        ...result,
        requestedBidRubles: requestedBid,
        appliedBidRubles: result.appliedBid,
        actualBidRubles: result.actualBid,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось выполнить ручное CPX-применение.";

    await createBidderEvent({
      bidderId: bidder.id,
      type: "manual_cpx_apply_exception",
      message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}