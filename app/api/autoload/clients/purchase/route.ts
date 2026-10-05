import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getPaymentMode } from "@/lib/payment-mode";
import { fulfilAutoloadClientsPayment } from "@/lib/payments/fulfil-autoload-clients";
import {
  AUTOLOAD_CLIENT_MAX_PACKS_PER_PAYMENT,
  AUTOLOAD_CLIENT_PACK_SIZE,
  autoloadClientsPlanCode,
  autoloadClientsPrice,
  autoloadClientsSlots,
  clientsWord,
} from "@/lib/autoload/clients-plan";
import { fail, isProLevel } from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Покупка слотов для дополнительных клиентов автозагрузки: +3 клиента за 299 ₽ (за каждый пакет).
 *
 * Работает так же, как оплата подписки (/api/payments/create):
 *  - тестовый режим — слоты зачисляются сразу, без оплаты;
 *  - режим ЮKassa — создаётся платёж и возвращается ссылка на оплату; слоты зачисляются,
 *    когда ЮKassa подтвердит оплату (webhook или проверка статуса на странице оплаты).
 */
export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return fail("Необходимо войти в аккаунт", 401);

    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) return fail("Пользователь не найден", 404);
    if (!isProLevel(user.subscriptionLevel)) return fail("Автозагрузка доступна с подпиской Pro.", 403, { code: "PRO_REQUIRED" });
    if (String(user.subscriptionLevel).toLowerCase() === "admin") {
      return fail("У вас полный доступ — количество клиентов не ограничено, докупать слоты не нужно.");
    }

    const body = await request.json().catch(() => null);
    const packs = Math.round(Number(body?.packs ?? 1));
    if (!Number.isInteger(packs) || packs < 1 || packs > AUTOLOAD_CLIENT_MAX_PACKS_PER_PAYMENT) {
      return fail(`Выберите от 1 до ${AUTOLOAD_CLIENT_MAX_PACKS_PER_PAYMENT} пакетов.`);
    }

    const slots = autoloadClientsSlots(packs);
    const amount = autoloadClientsPrice(packs);
    const planCode = autoloadClientsPlanCode(packs);
    const description = `Автозагрузка Авито: +${slots} ${clientsWord(slots)} (${packs} × ${AUTOLOAD_CLIENT_PACK_SIZE})`;
    const mode = await getPaymentMode();

    if (mode === "test") {
      const payment = await prisma.payment.create({
        data: {
          userId: user.id,
          provider: "test",
          status: "pending",
          amount,
          currency: "RUB",
          description: `Тестовая активация: ${description}`,
          planCode,
          durationMonths: 1,
          metadata: JSON.stringify({ source: "autoload-clients", mode: "test", packs }),
        },
      });
      await fulfilAutoloadClientsPayment(payment.id, { source: "autoload-clients", mode: "test" });
      return NextResponse.json({ success: true, provider: "test", paymentId: payment.id, slots, redirectUrl: null });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        provider: "yookassa",
        status: "pending",
        amount,
        currency: "RUB",
        description,
        planCode,
        durationMonths: 1,
        metadata: JSON.stringify({ source: "autoload-clients", mode: "yookassa", packs }),
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

      const externalPaymentId = (yookassaPayment as any)?.id ?? null;
      const confirmationUrl = (yookassaPayment as any)?.confirmation?.confirmation_url ?? null;
      const expiresAtRaw = (yookassaPayment as any)?.expires_at ?? null;

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalPaymentId,
          confirmationUrl,
          expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
          metadata: JSON.stringify({
            source: "autoload-clients",
            mode: "yookassa",
            packs,
            yookassaStatus: (yookassaPayment as any)?.status ?? null,
          }),
        },
      });

      if (!confirmationUrl) {
        return fail("ЮKassa не вернула ссылку для перехода на оплату", 500, { paymentId: payment.id });
      }

      return NextResponse.json({ success: true, provider: "yookassa", paymentId: payment.id, slots, redirectUrl: confirmationUrl });
    } catch (providerError) {
      console.error("AUTOLOAD CLIENTS YOOKASSA ERROR:", providerError);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          metadata: JSON.stringify({
            source: "autoload-clients",
            mode: "yookassa",
            packs,
            providerError: providerError instanceof Error ? providerError.message : "unknown error",
          }),
        },
      });
      return fail("Не удалось создать платёж через ЮKassa", 500);
    }
  } catch (error) {
    console.error("AUTOLOAD CLIENTS PURCHASE ERROR:", error);
    return fail("Ошибка создания платежа", 500);
  }
}
