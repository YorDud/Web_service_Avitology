import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  findAllowedCpxBid,
  getCpxBidsForItem,
  pennyToRubles,
  rublesToPenny,
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
 * Старое имя route сохранено.
 * CPX прогноз уже содержится в getBids → manual.bids[].
 */
export async function GET(request: Request, context: RouteContext) {
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
      minBid: true,
      maxBid: true,
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

  const url = new URL(request.url);
  const requestedBidRublesValue = Number(url.searchParams.get("bid"));

  const desiredBidRubles =
    Number.isFinite(requestedBidRublesValue) &&
    requestedBidRublesValue >= bidder.minBid &&
    requestedBidRublesValue <= bidder.maxBid
      ? Math.round(requestedBidRublesValue)
      : bidder.currentBid;

  try {
    const cpx = await getCpxBidsForItem({
      userId: authorization.user.id,
      itemId,
    });

    const selectedBid = findAllowedCpxBid({
      desiredBidPenny: rublesToPenny(desiredBidRubles),
      minBidPenny: rublesToPenny(bidder.minBid),
      maxBidPenny: rublesToPenny(bidder.maxBid),
      availableBids: cpx.manual.bids,
    });

    if (!selectedBid) {
      return NextResponse.json(
        {
          error:
            "Avito не вернул CPX-ставок, подходящих под заданные лимиты bidder-а.",
        },
        { status: 400 },
      );
    }

    const allForecasts = cpx.manual.bids
      .filter(
        (bid) =>
          bid.valuePenny >= rublesToPenny(bidder.minBid) &&
          bid.valuePenny <= rublesToPenny(bidder.maxBid),
      )
      .map((bid) => ({
        bidPenny: bid.valuePenny,
        bidRubles: pennyToRubles(bid.valuePenny),
        minForecast: bid.minForecast,
        maxForecast: bid.maxForecast,
        compare: bid.compare,
        isCurrent: bid.valuePenny === cpx.manual.bidPenny,
        isRecommended: bid.valuePenny === cpx.manual.recBidPenny,
      }));

    return NextResponse.json({
      bidderId: bidder.id,
      title: bidder.title,
      itemId,
      strategy: "cpx_manual",

      requestedBidRubles: desiredBidRubles,

      selectedBid: {
        bidPenny: selectedBid.valuePenny,
        bidRubles: pennyToRubles(selectedBid.valuePenny),
        minForecast: selectedBid.minForecast,
        maxForecast: selectedBid.maxForecast,
        compare: selectedBid.compare,
      },

      avitoCurrentBid: {
        bidPenny: cpx.manual.bidPenny,
        bidRubles: pennyToRubles(cpx.manual.bidPenny),
      },

      avitoRecommendedBid: {
        bidPenny: cpx.manual.recBidPenny,
        bidRubles: pennyToRubles(cpx.manual.recBidPenny),
      },

      forecasts: allForecasts,
      raw: cpx.raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось получить CPX-прогноз из Avito API.",
      },
      { status: 500 },
    );
  }
}