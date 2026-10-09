import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchOrder, syncOrders } from "@/lib/service-level/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Служебный проход: дозапускает неотправленные заказы, обновляет ход выполнения,
 * чистит старые неоплаченные черновики. Вызывается внешним планировщиком (Vercel Cron,
 * cron-job.org и т.п.) раз в 5–15 минут с заголовком Authorization: Bearer <CRON_SECRET>.
 * Если CRON_SECRET в .env не задан — маршрут выключен.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET не задан в .env" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }

  const active = await prisma.serviceLevelOrder.findMany({
    where: { status: "in_progress" },
    include: { items: { select: { stage: true } } },
    take: 100,
    orderBy: { id: "asc" },
  });

  let dispatched = 0;
  for (const order of active) {
    if (order.items.some((item) => ["pending", "created", "funded", "creating", "funding", "enabling"].includes(item.stage))) {
      await dispatchOrder(order.id);
      dispatched += 1;
    }
  }

  const toSync = active.filter((order) => order.items.some((item) => item.stage === "active")).map((order) => order.id);
  await syncOrders(toSync.slice(0, 30));

  const removed = await prisma.serviceLevelOrder.deleteMany({
    where: { status: "awaiting_payment", createdAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
  });

  return NextResponse.json({ ok: true, dispatched, synced: Math.min(toSync.length, 30), draftsRemoved: removed.count });
}

export const GET = run;
export const POST = run;
