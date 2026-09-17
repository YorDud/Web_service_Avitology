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
 * Старое имя route сохранено для UI.
 * Возвращает доступные CPX-ставки вместо BBIP suggests.
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
      bidStep: true,
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

    const availableBids = cpx.manual.bids.map((bid) => ({
      bidPenny: bid.valuePenny,
      bidRubles: pennyToRubles(bid.valuePenny),
      minForecast: bid.minForecast,
      maxForecast: bid.maxForecast,
      compare: bid.compare,
      isRecommended: bid.valuePenny === cpx.manual.recBidPenny,
      isCurrent: bid.valuePenny === cpx.manual.bidPenny,
      withinBidderLimits:
        bid.valuePenny >= bidder.minBid * 100 &&
        bid.valuePenny <= bidder.maxBid * 100,
    }));

    const allowedBids = availableBids.filter(
      (item) => item.withinBidderLimits,
    );

    const recommendedAllowed =
      allowedBids.find((item) => item.isRecommended) ??
      allowedBids.reduce<(typeof allowedBids)[number] | null>(
        (best, item) => {
          if (!best) return item;

          const target =
            cpx.manual.recBidPenny ?? bidder.currentBid * 100;

          const bestDistance = Math.abs(best.bidPenny - target);
          const itemDistance = Math.abs(item.bidPenny - target);

          return itemDistance < bestDistance ? item : best;
        },
        null,
      );

    return NextResponse.json({
      bidderId: bidder.id,
      title: bidder.title,
      itemId,
      strategy: "cpx_manual",

      currentBid: {
        penny: cpx.manual.bidPenny,
        rubles: pennyToRubles(cpx.manual.bidPenny),
      },

      avitoRecommendedBid: {
        penny: cpx.manual.recBidPenny,
        rubles: pennyToRubles(cpx.manual.recBidPenny),
      },

      bidderLimits: {
        minBidRubles: bidder.minBid,
        maxBidRubles: bidder.maxBid,
        bidStepRubles: bidder.bidStep,
      },

      suggestedBid: recommendedAllowed
        ? {
            penny: recommendedAllowed.bidPenny,
            rubles: recommendedAllowed.bidRubles,
            minForecast: recommendedAllowed.minForecast,
            maxForecast: recommendedAllowed.maxForecast,
            compare: recommendedAllowed.compare,
          }
        : null,

      availableBids,
      allowedBids,

      message:
        allowedBids.length > 0
          ? `Avito вернул ${allowedBids.length} допустимых CPX-ставок в лимитах bidder-а.`
          : "Avito не вернул ставок, подходящих под заданные лимиты bidder-а.",

      raw: cpx.raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось получить CPX-ставки из Avito API.",
      },
      { status: 500 },
    );
  }
}