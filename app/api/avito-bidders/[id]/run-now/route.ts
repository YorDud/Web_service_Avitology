import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { runSingleBidder } from "@/lib/avito-bidder-runner";

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

export async function POST(_: Request, context: RouteContext) {
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
      userId: true,
    },
  });

  if (!bidder) {
    return NextResponse.json({ error: "Бидер не найден" }, { status: 404 });
  }

  try {
    const result = await runSingleBidder({
      bidderId: bidder.id,
      userId: bidder.userId,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось запустить bidder вручную.",
      },
      { status: 500 },
    );
  }
}