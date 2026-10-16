import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getPaymentMode } from "@/lib/payment-mode";
import { pluralRu, serviceLevelPlanCode } from "@/lib/service-level/constants";
import { createDraftOrder, fulfilServiceLevelPayment, prepareOrder, scheduleDispatch } from "@/lib/service-level/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/**
 * Оформление заказа: проверка → черновик заказа → платёж.
 *  – тестовый режим: платёж подтверждается сразу, заказ уходит в работу;
 *  – режим ЮKassa: возвращаем ссылку на оплату; заказ создаётся и уходит на SocPublic
 *    только после подтверждения оплаты (webhook или проверка статуса на странице оплаты).
 */
export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return json({ error: "Необходимо войти в аккаунт" }, 401);

    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) return json({ error: "Пользователь не найден" }, 404);

    // Защита от случайных повторных нажатий: слишком много неоплаченных черновиков подряд.
    const recentDrafts = await prisma.serviceLevelOrder.count({
      where: { userId: user.id, status: "awaiting_payment", createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
    });
    if (recentDrafts >= 8) return json({ error: "Слишком много неоплаченных заказов подряд. Оплатите созданные или подождите несколько минут." }, 429);

    const body = await request.json().catch(() => null);
    const prepared = await prepareOrder(user, body);
    if (!prepared.ok) return json({ error: prepared.error }, prepared.status);

    const order = await createDraftOrder(user, prepared);
    const links = prepared.links.length;
    const description = `Уровень сервиса: ${prepared.service.title} — ${links} ${pluralRu(links, "ссылка", "ссылки", "ссылок")} × ${prepared.quantityPerLink}${prepared.startDelayMinutes > 0 ? `, старт через ${prepared.startDelayMinutes / 60} ч` : ""}`;
    const planCode = serviceLevelPlanCode(order.id);
    const mode = await getPaymentMode();

    if (mode === "test") {
      const payment = await prisma.payment.create({
        data: {
          userId: user.id,
          provider: "test",
          status: "pending",
          amount: prepared.totals.price,
          currency: "RUB",
          description: `Тестовая активация: ${description}`,
          planCode,
          durationMonths: 1,
          metadata: JSON.stringify({ source: "service-level", mode: "test", orderId: order.id }),
        },
      });
      await fulfilServiceLevelPayment(payment.id, { source: "service-level", mode: "test" });
      scheduleDispatch(order.id);
      return json({ success: true, provider: "test", orderId: order.id, redirectUrl: null });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        provider: "yookassa",
        status: "pending",
        amount: prepared.totals.price,
        currency: "RUB",
        description,
        planCode,
        durationMonths: 1,
        metadata: JSON.stringify({ source: "service-level", mode: "yookassa", orderId: order.id }),
      },
    });

    try {
      // Подключаем ЮKassa только когда она реально нужна: модуль требует ключи в окружении.
      const { createYookassaPayment } = await import("@/lib/payments/yookassa");
      const yookassaPayment = await createYookassaPayment({
        amount: payment.amount,
        description,
        paymentId: payment.id,
        userId: user.id,
        userEmail: user.email,
      });

      const confirmationUrl = (yookassaPayment as any)?.confirmation?.confirmation_url ?? null;
      const expiresAtRaw = (yookassaPayment as any)?.expires_at ?? null;

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalPaymentId: (yookassaPayment as any)?.id ?? null,
          confirmationUrl,
          expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
          metadata: JSON.stringify({
            source: "service-level",
            mode: "yookassa",
            orderId: order.id,
            yookassaStatus: (yookassaPayment as any)?.status ?? null,
          }),
        },
      });

      if (!confirmationUrl) {
        await prisma.serviceLevelOrder.delete({ where: { id: order.id } }).catch(() => null);
        return json({ error: "ЮKassa не вернула ссылку для оплаты. Попробуйте ещё раз." }, 500);
      }
      return json({ success: true, provider: "yookassa", orderId: order.id, paymentId: payment.id, redirectUrl: confirmationUrl });
    } catch (providerError) {
      console.error("SERVICE LEVEL YOOKASSA ERROR:", providerError);
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } }).catch(() => null);
      await prisma.serviceLevelOrder.delete({ where: { id: order.id } }).catch(() => null);
      return json({ error: "Не удалось создать платёж через ЮKassa. Попробуйте позже." }, 500);
    }
  } catch (error) {
    console.error("SERVICE LEVEL CHECKOUT ERROR:", error);
    return json({ error: "Не удалось оформить заказ." }, 500);
  }
}
