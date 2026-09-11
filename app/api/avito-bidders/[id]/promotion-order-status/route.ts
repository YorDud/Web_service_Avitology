import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  getPromotionOrderStatus,
  extractOrderMeta,
} from "@/lib/avito-promotion-api";
import { createBidderEvent } from "@/lib/avito-bidder-events";

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
    select: {
      id: true,
      title: true,
      lastPromotionOrderId: true,
    },
  });

  if (!bidder) {
    return NextResponse.json({ error: "Бидер не найден" }, { status: 404 });
  }

  if (!bidder.lastPromotionOrderId) {
    return NextResponse.json(
      { error: "У бидера нет сохранённого Promotion order ID." },
      { status: 400 },
    );
  }

  try {
    const result = await getPromotionOrderStatus({
      userId: authorization.user.id,
      orderId: bidder.lastPromotionOrderId,
    });

    const meta = extractOrderMeta(result);

    await prisma.avitoBidder.update({
      where: { id: bidder.id },
      data: {
        lastPromotionStatus: meta.status ?? "status_checked",
        lastPromotionPayload: JSON.stringify(result),
      },
    });

    await createBidderEvent({
      bidderId: bidder.id,
      type: "manual_order_status_checked",
      message: `Статус Promotion order проверен: ${meta.status ?? "unknown"}.`,
    });

    return NextResponse.json({
      bidderId: bidder.id,
      title: bidder.title,
      orderId: bidder.lastPromotionOrderId,
      meta,
      raw: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось проверить статус заявки Promotion API.",
      },
      { status: 500 },
    );
  }
}