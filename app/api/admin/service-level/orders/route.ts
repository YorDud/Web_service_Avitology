import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { scheduleDispatch, scheduleSync, toAdminOrderView } from "@/lib/service-level/orders";

// Этапы, на которых отправка на SocPublic ещё не доведена до конца (включая ожидание
// собственного лимита SocPublic на создание заданий — см. retryAfter у задания).
const UNFINISHED_STAGES = ["pending", "created", "funded", "creating", "funding", "enabling"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Все заказы (кроме неоплаченных черновиков) с расчётом прибыли. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const orders = await prisma.serviceLevelOrder.findMany({
      where: { status: { not: "awaiting_payment" } },
      orderBy: { id: "desc" },
      take: 1000,
      include: {
        items: { orderBy: { position: "asc" } },
        service: true,
        user: { select: { id: true, name: true, publicId: true, email: true } },
      },
    });
    const views = orders.map(toAdminOrderView);

    // Подстраховка на случай, если планировщик (CRON_SECRET) не настроен: просто открыв список
    // заказов, админ тоже запускает дозавершение «зависших» отправок — включая те, что ждут
    // своего часа из-за лимита SocPublic на создание заданий (retryAfter сам не даст дёргать API раньше времени).
    const now = Date.now();
    for (const order of orders) {
      if (order.status !== "in_progress") continue;
      const unfinished = order.items.some((item) => UNFINISHED_STAGES.includes(item.stage));
      const free = !order.dispatchLockedUntil || order.dispatchLockedUntil.getTime() < now;
      if (unfinished && free) scheduleDispatch(order.id);
    }

    // Заодно в фоне обновляем ход выполнения у SocPublic (баланс, «ждут проверки» и т.д.) — не чаще раза в 90 секунд на заказ.
    scheduleSync(
      orders
        .filter((order) => order.status === "in_progress" && order.items.some((item) => item.stage === "active") && (!order.lastSyncAt || now - order.lastSyncAt.getTime() >= 90_000))
        .slice(0, 5)
        .map((order) => order.id),
    );

    // В итоги входят только оплаченные и не отменённые заказы.
    const counted = views.filter((order) => order.status !== "cancelled");
    const totals = {
      orders: counted.length,
      revenue: counted.reduce((sum, order) => sum + order.paid, 0),
      cost: Math.round(counted.reduce((sum, order) => sum + order.socCost, 0) * 100) / 100,
      profit: Math.round(counted.reduce((sum, order) => sum + order.profit, 0) * 100) / 100,
      attention: views.filter((order) => order.attention && order.status === "in_progress").length,
    };
    return NextResponse.json({ orders: views, totals });
  } catch (error) {
    console.error("SERVICE LEVEL ORDERS GET ERROR:", error);
    return NextResponse.json({ error: "Не удалось загрузить заказы" }, { status: 500 });
  }
}
