import { prisma } from "@/lib/prisma";
import { autoloadClientsSlots, parseAutoloadClientsPlanCode } from "@/lib/autoload/clients-plan";

/**
 * Зачисляет слоты за оплаченный платёж «дополнительные клиенты автозагрузки».
 *
 * Безопасно вызывать сколько угодно раз (webhook ЮKassa, проверка статуса на странице
 * оплаты, тестовый режим): платёж «захватывается» одним атомарным обновлением статуса —
 * слоты начисляются только тому вызову, который реально перевёл платёж в succeeded.
 */
export async function fulfilAutoloadClientsPayment(paymentId: number, metadata: Record<string, unknown> = {}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error("Платеж не найден");

    const packs = parseAutoloadClientsPlanCode(payment.planCode);
    if (packs === null) throw new Error("Это не платёж за клиентов автозагрузки");

    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: { not: "succeeded" } },
      data: {
        status: "succeeded",
        paidAt: new Date(),
        metadata: JSON.stringify({ kind: "autoload_clients", packs, ...metadata }),
      },
    });
    if (claimed.count === 0) return { granted: false, slots: 0 };

    const slots = autoloadClientsSlots(packs);
    await tx.user.update({
      where: { id: payment.userId },
      data: { autoloadExtraClientSlots: { increment: slots } },
    });
    return { granted: true, slots };
  });
}
