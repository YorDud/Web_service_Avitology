import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  getBbipForecastsForItem,
  getBbipSuggestsForItem,
  normalizeSuggestedBudget,
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
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
    select: {
      id: true,
      title: true,
      avitoItemId: true,
      promotionDurationDays: true,
    },
  });

  if (!bidder) {
    return NextResponse.json({ error: "Бидер не найден" }, { status: 404 });
  }

  const itemId = toNumericItemId(bidder.avitoItemId);

  if (!itemId) {
    return NextResponse.json(
      {
        error:
          "Для получения forecast нужен числовой avitoItemId, совместимый с Promotion API.",
      },
      { status: 400 },
    );
  }

  try {
    const suggests = await getBbipSuggestsForItem({
      userId: authorization.user.id,
      itemId,
    });

    const suggest =
      suggests.suggests.find((item) => {
        const current =
          typeof item.itemId === "number" || typeof item.itemId === "string"
            ? String(item.itemId)
            : null;

        return current === String(itemId);
      }) ?? suggests.suggests[0];

    const budget = normalizeSuggestedBudget(suggest);

    if (!budget?.price || !budget.oldPrice) {
      return NextResponse.json(
        {
          error:
            "Promotion API не вернул подходящий бюджет для построения прогноза.",
        },
        { status: 400 },
      );
    }

    const duration =
      bidder.promotionDurationDays > 0 ? bidder.promotionDurationDays : 7;

    const forecast = await getBbipForecastsForItem({
      userId: authorization.user.id,
      itemId,
      duration,
      price: budget.price,
      oldPrice: budget.oldPrice,
    });

    return NextResponse.json({
      bidderId: bidder.id,
      title: bidder.title,
      itemId,
      duration,
      selectedBudget: budget,
      suggestsRaw: suggests.raw,
      forecastRaw: forecast.raw,
      forecasts: forecast.forecasts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось получить BBIP forecast.",
      },
      { status: 500 },
    );
  }
}