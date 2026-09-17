import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
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
 * Старый URL сохранён для совместимости с интерфейсом.
 * Теперь он возвращает параметры CPX Promo, а не устаревшие Promotion services / BBIP.
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
      minBid: true,
      maxBid: true,
      dailySpendLimit: true,
      promotionStrategy: true,
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
      {
        error:
          "Для получения параметров CPX нужен числовой avitoItemId.",
      },
      { status: 400 },
    );
  }

  try {
    const cpx = await getCpxBidsForItem({
      userId: authorization.user.id,
      itemId,
    });

    const allowedBids = cpx.manual.bids.map((bid) => ({
      bidPenny: bid.valuePenny,
      bidRubles: pennyToRubles(bid.valuePenny),
      minForecast: bid.minForecast,
      maxForecast: bid.maxForecast,
      compare: bid.compare,
    }));

    const bidsWithinBidderLimits = allowedBids.filter((bid) => {
      const bidRubles = bid.bidRubles;

      return (
        bidRubles !== null &&
        bidRubles >= bidder.minBid &&
        bidRubles <= bidder.maxBid
      );
    });

    return NextResponse.json({
      bidderId: bidder.id,
      title: bidder.title,
      itemId,

      strategy: "cpx_manual",
      oldStrategy: bidder.promotionStrategy,

      bidderLimits: {
        minBidRubles: bidder.minBid,
        maxBidRubles: bidder.maxBid,
        dailySpendLimitRubles: bidder.dailySpendLimit,
      },

      cpx: {
        actionTypeId: cpx.actionTypeId,
        selectedType: cpx.selectedType,

        currentBidPenny: cpx.manual.bidPenny,
        currentBidRubles: pennyToRubles(cpx.manual.bidPenny),

        recommendedBidPenny: cpx.manual.recBidPenny,
        recommendedBidRubles: pennyToRubles(cpx.manual.recBidPenny),

        minBidPenny: cpx.manual.minBidPenny,
        minBidRubles: pennyToRubles(cpx.manual.minBidPenny),

        maxBidPenny: cpx.manual.maxBidPenny,
        maxBidRubles: pennyToRubles(cpx.manual.maxBidPenny),

        currentLimitPenny: cpx.manual.limitPenny,
        currentLimitRubles: pennyToRubles(cpx.manual.limitPenny),

        availableBids: allowedBids,
        availableBidsWithinBidderLimits: bidsWithinBidderLimits,
      },

      raw: cpx.raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось получить параметры CPX Promo из Avito API.",
      },
      { status: 500 },
    );
  }
}