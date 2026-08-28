import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getPaymentMode } from "@/lib/payment-mode";
import { activateBasicSubscription } from "@/lib/payments/activate-basic-subscription";
import { createYookassaPayment } from "@/lib/payments/yookassa";

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
    console.log("PAYMENT MODE:", paymentMode);

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

    const yookassaPayment = await createYookassaPayment({
      amount: payment.amount,
      description: payment.description || "Оплата подписки Basic через ЮKassa",
      paymentId: payment.id,
      userId: user.id,
      userEmail: user.email,
    });

    console.log(
      "YOOKASSA CREATE PAYMENT RESPONSE:",
      JSON.stringify(yookassaPayment, null, 2)
    );

    const confirmationUrl =
      (yookassaPayment as any)?.confirmation?.confirmation_url ?? null;

    console.log("YOOKASSA CONFIRMATION URL:", confirmationUrl);

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalPaymentId: (yookassaPayment as any)?.id ?? null,
        confirmationUrl,
        expiresAt: (yookassaPayment as any)?.expires_at
          ? new Date((yookassaPayment as any).expires_at)
          : null,
        metadata: JSON.stringify({
          source: "web-pricing",
          mode: "yookassa",
          yookassaStatus: (yookassaPayment as any)?.status ?? null,
          rawConfirmationType:
            (yookassaPayment as any)?.confirmation?.type ?? null,
        }),
      },
    });

    if (!confirmationUrl) {
      console.error("YOOKASSA ERROR: confirmation_url is missing");

      return NextResponse.json(
        {
          error: "ЮKassa не вернула ссылку для перехода на оплату",
          paymentId: payment.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: "yookassa",
      paymentId: payment.id,
      redirectUrl: confirmationUrl,
    });
  } catch (error) {
    console.error("CREATE PAYMENT ERROR:", error);

    return NextResponse.json(
      { error: "Ошибка создания платежа" },
      { status: 500 }
    );
  }
}