import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { parseDateTimeLocal } from "@/lib/dates";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser || sessionUser.subscriptionLevel !== "admin") {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { id } = await params;
    const userId = Number(id);

    if (!userId) {
      return NextResponse.json(
        { error: "Некорректный ID пользователя" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const subscriptionLevel = String(body.subscriptionLevel || "free") as
      | "free"
      | "basic"
      | "admin";
    const subscriptionPrice = Number(body.subscriptionPrice || 0);
    const isActive = Boolean(body.isActive);
    const notes = body.notes ? String(body.notes) : null;

    const subscriptionPaidAt = parseDateTimeLocal(body.subscriptionPaidAt);
	const subscriptionEndsAt = parseDateTimeLocal(body.subscriptionEndsAt);

    if (!email || !name) {
      return NextResponse.json(
        { error: "Имя и почта обязательны" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: userId },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Почта уже занята другим пользователем" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email,
        name,
        subscriptionLevel,
        subscriptionPrice,
        subscriptionPaidAt,
        subscriptionEndsAt,
        isActive,
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("ADMIN USER PATCH ERROR:", error);
    return NextResponse.json(
      { error: "Ошибка обновления пользователя" },
      { status: 500 }
    );
  }
}