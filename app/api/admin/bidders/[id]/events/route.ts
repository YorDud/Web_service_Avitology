import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { cleanupOldBidderEvents } from "@/lib/avito-bidder-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** История работы бидера любого пользователя (последние 100 записей; события хранятся 7 дней). */
export async function GET(_request: Request, context: Context) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Бидер не найден" }, { status: 404 });

  try {
    await cleanupOldBidderEvents();
    const events = await prisma.avitoBidderEvent.findMany({ where: { bidderId: id }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({
      events: events.map((event) => ({ id: event.id, type: event.type, message: event.message, createdAt: event.createdAt.toISOString() })),
    });
  } catch (error) {
    console.error("ADMIN BIDDER EVENTS ERROR:", error);
    return NextResponse.json({ error: "Не удалось загрузить историю." }, { status: 500 });
  }
}
