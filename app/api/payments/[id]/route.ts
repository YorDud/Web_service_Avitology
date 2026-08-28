import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const paymentId = Number(id);

    if (Number.isNaN(paymentId)) {
      return NextResponse.json(
        { error: "Некорректный ID платежа" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.userId !== sessionUser.id) {
      return NextResponse.json(
        { error: "Платеж не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      payment: {
        id: payment.id,
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description,
        confirmationUrl: payment.confirmationUrl,
        externalPaymentId: payment.externalPaymentId,
        paidAt: payment.paidAt,
        expiresAt: payment.expiresAt,
        createdAt: payment.createdAt,
      },
    });
  } catch (error) {
    console.error("GET PAYMENT ERROR:", error);

    return NextResponse.json(
      { error: "Ошибка получения платежа" },
      { status: 500 }
    );
  }
}