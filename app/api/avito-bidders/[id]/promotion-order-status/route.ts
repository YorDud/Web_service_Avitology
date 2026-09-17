import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  getCpxBidsForItem,
  pennyToRubles,
} from "@/lib/avito-promotion-api";
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

function toNumericItemId(value: string | null) {
  if (!value) return null;

  const itemId = Number(value);

  return Number.isInteger(itemId) && itemId > 0 ? itemId : null;
}

/**
 * Обратная совместимость со старым URL order-status.
 * CPX не создаёт orders; endpoint подтверждает текущую ставку через getBids.
 */
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
    select: {
      id: true,
      title: true,
      avitoItemId: true,
      currentBid: true,
    },
  });

  if (!bidder) {
    return NextResponse.json(
      { error: "Бидер не найден" },
      { status: 404 },
    );
  }

  const itemId = toNumericItemId(bidder.avitoItemId);

  if (!itemId) {
    return NextResponse.json(
      { error: "Для CPX нужен числовой avitoItemId." },
      { status: 400 },
    );
  }

  try {
    const cpx = await getCpxBidsForItem({
      userId: authorization.user.id,
      itemId,
    });

    const currentBidRubles = pennyToRubles(cpx.manual.bidPenny);
    const isEqualToSavedBid =
      currentBidRubles !== null &&
      Math.round(currentBidRubles) === bidder.currentBid;

    const status = cpx.manual.bidPenny === null
      ? "cpx_bid_not_set"
      : isEqualToSavedBid
        ? "cpx_bid_confirmed"
        : "cpx_bid_differs_from_helpsell";

    await prisma.avitoBidder.update({
      where: { id: bidder.id },
      data: {
        currentBid:
          currentBidRubles === null
            ? bidder.currentBid
            : Math.round(currentBidRubles),
        lastPromotionStatus: status,
        lastPromotionPayload: JSON.stringify(cpx.raw),
        lastOrderStatusCheckedAt: new Date(),
        lastError: null,
      },
    });

    await createBidderEvent({
      bidderId: bidder.id,
      type: "manual_cpx_status_checked",
      message:
        cpx.manual.bidPenny === null
          ? "CPX Promo: текущая ручная ставка для объявления не установлена."
          : `CPX Promo: текущая ставка подтверждена Avito — ${currentBidRubles} ₽.`,
    });

    return NextResponse.json({
      bidderId: bidder.id,
      title: bidder.title,
      itemId,

      strategy: "cpx_manual",
      status,

      currentBid: {
        penny: cpx.manual.bidPenny,
        rubles: currentBidRubles,
      },

      recommendedBid: {
        penny: cpx.manual.recBidPenny,
        rubles: pennyToRubles(cpx.manual.recBidPenny),
      },

      limit: {
        penny: cpx.manual.limitPenny,
        rubles: pennyToRubles(cpx.manual.limitPenny),
      },

      actionTypeId: cpx.actionTypeId,
      selectedType: cpx.selectedType,

      raw: cpx.raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось проверить текущую CPX-ставку в Avito API.",
      },
      { status: 500 },
    );
  }
}