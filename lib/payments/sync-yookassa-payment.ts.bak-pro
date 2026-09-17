import { prisma } from "@/lib/prisma";
import { activateBasicSubscription } from "@/lib/payments/activate-basic-subscription";
import { getYookassaPayment } from "@/lib/payments/yookassa";

export async function syncYookassaPaymentByInternalId(internalPaymentId: number) {
  const payment = await prisma.payment.findUnique({
    where: { id: internalPaymentId },
  });

  if (!payment) {
    throw new Error("Платеж не найден");
  }

  if (payment.provider !== "yookassa") {
    return payment;
  }

  if (!payment.externalPaymentId) {
    return payment;
  }

  const yookassaPayment = await getYookassaPayment(payment.externalPaymentId);

  const status = (yookassaPayment as any)?.status ?? payment.status;
  const paid = (yookassaPayment as any)?.paid ?? false;

  if (status === "succeeded" || paid === true) {
    if (payment.status !== "succeeded") {
      await activateBasicSubscription(payment.userId);

      return await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "succeeded",
          paidAt: new Date(),
          metadata: JSON.stringify({
            source: "sync-yookassa-payment",
            yookassaStatus: status,
            paid,
          }),
        },
      });
    }

    return payment;
  }

  if (status === "canceled") {
    return await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "canceled",
        metadata: JSON.stringify({
          source: "sync-yookassa-payment",
          yookassaStatus: status,
          paid,
        }),
      },
    });
  }

  return await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "pending",
      metadata: JSON.stringify({
        source: "sync-yookassa-payment",
        yookassaStatus: status,
        paid,
      }),
    },
  });
}