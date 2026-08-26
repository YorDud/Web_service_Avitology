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

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const paymentMode = await getPaymentMode();

    if (paymentMode === "test") {
      const updatedUser = await activateBasicSubscription(user.id);

      const payment = await prisma.payment.create({
        data: {
          userId: user.id,
          provider: "test",
          status: "succeeded",
          amount: updatedUser.subscriptionLevel === "admin" ? 0 : 299,
          currency: "RUB",
          description: "Тестовая активация подписки Basic",
          paidAt: new Date(),
          metadata: JSON.stringify({
            source: "web-pricing",
            mode: "test",
          }),
        },
      });

      return NextResponse.json({
        success: true,
        provider: "test",
        paymentId: payment.id,
        redirectUrl: "/dashboard",
      });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        provider: "yookassa",
        status: "pending",
        amount: 299,
        currency: "RUB",
        description: "Оплата подписки Basic через ЮKassa",
        metadata: JSON.stringify({
          source: "web-pricing",
          mode: "yookassa",
        }),
      },
    });

    return NextResponse.json({
      success: true,
      provider: "yookassa",
      paymentId: payment.id,
      redirectUrl: `/payment/pending?paymentId=${payment.id}`,
    });
  } catch (error) {
    console.error("CREATE PAYMENT ERROR:", error);

    return NextResponse.json(
      { error: "Ошибка создания платежа" },
      { status: 500 }
    );
  }
}