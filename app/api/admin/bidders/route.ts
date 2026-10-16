import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Админка → «Бид-менеджеры пользователей»: все бидеры всех пользователей с данными владельца
 * (имя, почта, Public ID). Параметры: q — поиск (название, имя, почта, Public ID, ID объявления),
 * status — active | paused | attention.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") ?? "").trim().slice(0, 100);
    const status = searchParams.get("status");

    const numeric = q !== "" && /^\d+$/.test(q) ? Number(q) : null;
    const where = {
      ...(status === "active" || status === "paused" || status === "attention" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { avitoItemId: { contains: q } },
              { user: { name: { contains: q } } },
              { user: { email: { contains: q } } },
              ...(numeric !== null ? [{ user: { publicId: numeric } }] : []),
            ],
          }
        : {}),
    };

    const [bidders, grouped] = await Promise.all([
      prisma.avitoBidder.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        take: 500,
        include: { user: { select: { id: true, name: true, email: true, publicId: true, subscriptionLevel: true } } },
      }),
      prisma.avitoBidder.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const counts = { total: 0, active: 0, paused: 0, attention: 0 };
    for (const row of grouped) {
      const count = row._count._all;
      counts.total += count;
      if (row.status === "active" || row.status === "paused" || row.status === "attention") counts[row.status] = count;
    }

    const iso = (value: Date | null) => (value ? value.toISOString() : null);
    return NextResponse.json({
      counts,
      bidders: bidders.map((bidder) => ({
        id: bidder.id,
        title: bidder.title,
        status: bidder.status,
        mode: bidder.mode,
        avitoItemId: bidder.avitoItemId,
        avitoItemUrl: bidder.avitoItemUrl,
        searchUrl: bidder.searchUrl,
        targetFrom: bidder.targetFrom,
        targetTo: bidder.targetTo,
        currentPosition: bidder.currentPosition,
        positionSource: bidder.positionSource,
        positionCheckedAt: iso(bidder.positionCheckedAt),
        lastPositionError: bidder.lastPositionError,
        currentBid: bidder.currentBid,
        minBid: bidder.minBid,
        maxBid: bidder.maxBid,
        bidStep: bidder.bidStep,
        dailySpendLimit: bidder.dailySpendLimit,
        spentToday: bidder.spentToday,
        checkInterval: bidder.checkInterval,
        schedule: bidder.schedule,
        changesToday: bidder.changesToday,
        nextCheckAt: iso(bidder.nextCheckAt),
        lastCheckedAt: iso(bidder.lastCheckedAt),
        lastError: bidder.lastError,
        lastPromotionStatus: bidder.lastPromotionStatus,
        lastAppliedAt: iso(bidder.lastAppliedAt),
        createdAt: bidder.createdAt.toISOString(),
        owner: {
          id: bidder.user.id,
          name: bidder.user.name,
          email: bidder.user.email,
          publicId: bidder.user.publicId,
          subscriptionLevel: bidder.user.subscriptionLevel,
        },
      })),
    });
  } catch (error) {
    console.error("ADMIN BIDDERS LIST ERROR:", error);
    return NextResponse.json({ error: "Не удалось загрузить бидеры." }, { status: 500 });
  }
}
