import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { runDueBidders, runSingleBidder } from "@/lib/avito-bidder-runner";

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

export async function POST(request: Request) {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  let body:
    | {
        bidderId?: unknown;
        limit?: unknown;
      }
    | undefined;

  try {
    body = await request.json();
  } catch {
    body = undefined;
  }

  const bidderId =
    typeof body?.bidderId === "number" &&
    Number.isInteger(body.bidderId) &&
    body.bidderId > 0
      ? body.bidderId
      : null;

  const limit =
    typeof body?.limit === "number" &&
    Number.isInteger(body.limit) &&
    body.limit > 0 &&
    body.limit <= 100
      ? body.limit
      : 20;

  try {
    if (bidderId) {
      const result = await runSingleBidder({
        bidderId,
        userId: authorization.user.id,
      });

      return NextResponse.json({ result });
    }

    const result = await runDueBidders({
      userId: authorization.user.id,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось выполнить цикл проверки бидеров.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}