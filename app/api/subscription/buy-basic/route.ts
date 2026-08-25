import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function POST() {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      );
    }

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const updatedUser = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        subscriptionLevel: sessionUser.subscriptionLevel === "admin" ? "admin" : "basic",
        subscriptionPrice: sessionUser.subscriptionLevel === "admin" ? 0 : 299,
        subscriptionPaidAt: sessionUser.subscriptionLevel === "admin" ? null : now,
        subscriptionEndsAt: sessionUser.subscriptionLevel === "admin" ? null : endDate,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        updatedUser.subscriptionLevel === "admin"
          ? "У администратора уже полный доступ"
          : "Подписка Basic успешно активирована на 30 дней",
      user: {
        id: updatedUser.id,
        subscriptionLevel: updatedUser.subscriptionLevel,
        subscriptionPrice: updatedUser.subscriptionPrice,
        subscriptionPaidAt: updatedUser.subscriptionPaidAt,
        subscriptionEndsAt: updatedUser.subscriptionEndsAt,
      },
    });
  } catch (error) {
    console.error("BUY BASIC ERROR:", error);
    return NextResponse.json(
      { error: "Ошибка при активации подписки" },
      { status: 500 }
    );
  }
}