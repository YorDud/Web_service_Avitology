import { NextResponse } from "next/server";
import { getAvitoItemByIdForUser } from "@/lib/avito-api";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    itemId: string;
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

export async function GET(_: Request, context: RouteContext) {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  const { itemId } = await context.params;

  if (!itemId || !itemId.trim()) {
    return NextResponse.json(
      { error: "Некорректный идентификатор объявления" },
      { status: 400 },
    );
  }

  try {
    const item = await getAvitoItemByIdForUser(
      authorization.user.id,
      itemId.trim(),
    );

    return NextResponse.json({ item });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось получить объявление Авито.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}