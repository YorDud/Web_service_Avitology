import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { createBidderEvent } from "@/lib/avito-bidder-events";
import { runSingleBidder } from "@/lib/avito-bidder-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/**
 * Управление бидером любого пользователя (только админ). body.action:
 *  pause    — поставить на паузу;
 *  start    — запустить (следующая проверка через интервал бидера);
 *  run-now  — выполнить проверку прямо сейчас;
 *  delete   — удалить бидер.
 * Каждое действие записывается в историю бидера с пометкой «администратор»,
 * поэтому пользователь видит у себя, что и когда было сделано.
 */
export async function POST(request: Request, context: Context) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Бидер не найден" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    const bidder = await prisma.avitoBidder.findUnique({ where: { id } });
    if (!bidder) return NextResponse.json({ error: "Бидер не найден" }, { status: 404 });

    if (action === "pause") {
      await prisma.avitoBidder.update({ where: { id }, data: { status: "paused", nextCheckAt: null } });
      await createBidderEvent({ bidderId: id, type: "admin_paused", message: "Статус изменён: paused (администратор)." });
      return NextResponse.json({ success: true, message: "Бидер поставлен на паузу." });
    }

    if (action === "start") {
      await prisma.avitoBidder.update({
        where: { id },
        data: { status: "active", nextCheckAt: new Date(Date.now() + bidder.checkInterval * 60_000), lastError: null },
      });
      await createBidderEvent({ bidderId: id, type: "admin_started", message: "Статус изменён: active (администратор)." });
      return NextResponse.json({ success: true, message: "Бидер запущен." });
    }

    if (action === "run-now") {
      await createBidderEvent({ bidderId: id, type: "admin_run_now", message: "Проверка запущена вручную администратором." });
      const result = await runSingleBidder({ bidderId: bidder.id, userId: bidder.userId, force: true });
      return NextResponse.json({ success: true, message: result?.message ?? "Проверка выполнена." });
    }

    if (action === "delete") {
      await prisma.avitoBidder.delete({ where: { id } });
      return NextResponse.json({ success: true, message: "Бидер удалён." });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("ADMIN BIDDER ACTION ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось выполнить действие" }, { status: 500 });
  }
}
