import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activateBasicSubscription } from "@/lib/payments/activate-basic-subscription";

type YookassaWebhookBody = {
  event?: string;
  object?: {
    id?: string;
    status?: string;
    paid?: boolean;
    amount?: {
      value?: string;
      currency?: string;
    };
    metadata?: {
      internalPaymentId?: string;
      userId?: string;
      email?: string;
    };
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as YookassaWebhookBody | null;

    console.log("YOOKASSA WEBHOOK:", JSON.stringify(body, null, 2));

    if (!body?.object?.id) {
      return NextResponse.json({ error: "Некорректный webhook" }, { status: 400 });
    }

    const externalPaymentId = body.object.id;
    const event = body.event;
    const status = body.object.status;
    const internalPaymentIdRaw = body.object.metadata?.internalPaymentId;

    let payment = await prisma.payment.findUnique({
      where: { externalPaymentId },
    });

    if (!payment && internalPaymentIdRaw) {
      const internalPaymentId = Number(internalPaymentIdRaw);

      if (!Number.isNaN(internalPaymentId)) {
        payment = await prisma.payment.findUnique({
          where: { id: internalPaymentId },
        });
      }
    }

    if (!payment) {
      return NextResponse.json(
        { error: "Платеж не найден" },
        { status: 404 }
      );
    }

    if (event === "payment.succeeded" || status === "succeeded") {
      if (payment.status !== "succeeded") {
        await activateBasicSubscription(payment.userId);

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "succeeded",
            paidAt: new Date(),
            metadata: JSON.stringify({
              webhookEvent: event,
              yookassaStatus: status,
              paid: body.object.paid ?? true,
            }),
          },
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (event === "payment.canceled" || status === "canceled") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "canceled",
          metadata: JSON.stringify({
            webhookEvent: event,
            yookassaStatus: status,
            paid: body.object.paid ?? false,
          }),
        },
      });

      return NextResponse.json({ ok: true });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "pending",
        metadata: JSON.stringify({
          webhookEvent: event,
          yookassaStatus: status ?? "pending",
          paid: body.object.paid ?? false,
        }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("YOOKASSA WEBHOOK ERROR:", error);

    return NextResponse.json(
      { error: "Ошибка обработки webhook" },
      { status: 500 }
    );
  }
}