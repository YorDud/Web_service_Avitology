import { prisma } from "@/lib/prisma";
import { activateSubscription } from "@/lib/payments/activate-subscription";
import { getYookassaPayment } from "@/lib/payments/yookassa";
import { getSubscriptionPlan } from "@/lib/subscription-plans";
import { fulfilAutoloadClientsPayment } from "@/lib/payments/fulfil-autoload-clients";
import { isAutoloadClientsPlanCode } from "@/lib/autoload/clients-plan";

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
    // Оплата слотов для клиентов автозагрузки — это не подписка: зачисляем слоты.
    if (isAutoloadClientsPlanCode(payment.planCode)) {
      await fulfilAutoloadClientsPayment(payment.id, { source: "sync-yookassa-payment", yookassaStatus: status, paid });
      return await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    }

    if (payment.status !== "succeeded") {
      await activateSubscription(payment.userId, getSubscriptionPlan(payment.planCode).tier, { months: payment.durationMonths || 1, price: payment.amount });

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