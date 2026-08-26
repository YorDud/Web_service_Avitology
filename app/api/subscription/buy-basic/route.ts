import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getPaymentMode } from "@/lib/payment-mode";
import { activateBasicSubscription } from "@/lib/payments/activate-basic-subscription";

export async function POST() {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      );
    }

    const paymentMode = await getPaymentMode();

    if (paymentMode === "yookassa") {
      const payment = await prisma.payment.create({
        data: {
          userId: sessionUser.id,
          provider: "yookassa",
          status: "pending",
          amount: 299,
          currency: "RUB",
          description: "Оплата подписки Basic через ЮKassa",
          metadata: JSON.stringify({
            source: "legacy-subscription-route",
            mode: "yookassa",
          }),
        },
      });

      return NextResponse.json({
        success: true,
        provider: "yookassa",
        paymentId: payment.id,
        redirectUrl: `/payment/pending?paymentId=${payment.id}`,
        message: "Создан платеж ЮKassa",
      });
    }

    const updatedUser = await activateBasicSubscription(sessionUser.id);

    const payment = await prisma.payment.create({
      data: {
        userId: sessionUser.id,
        provider: "test",
        status: "succeeded",
        amount: updatedUser.subscriptionLevel === "admin" ? 0 : 299,
        currency: "RUB",
        description: "Тестовая активация подписки Basic",
        paidAt: new Date(),
        metadata: JSON.stringify({
          source: "legacy-subscription-route",
          mode: "test",
        }),
      },
    });

    return NextResponse.json({
      success: true,
      provider: "test",
      paymentId: payment.id,
      message:
        updatedUser.subscriptionLevel === "admin"
          ? "У пользователя с полным доступом подписка не изменяется"
          : "Подписка Basic успешно активирована на 30 дней",
      user: {
        id: updatedUser.id,
        subscriptionLevel: updatedUser.subscriptionLevel,
        subscriptionPrice: updatedUser.subscriptionPrice,
        subscriptionPaidAt: updatedUser.subscriptionPaidAt,
        subscriptionEndsAt: updatedUser.subscriptionEndsAt,
      },
      redirectUrl: "/dashboard",
    });
  } catch (error) {
    console.error("BUY BASIC ERROR:", error);

    return NextResponse.json(
      { error: "Ошибка при активации подписки" },
      { status: 500 }
    );
  }
}