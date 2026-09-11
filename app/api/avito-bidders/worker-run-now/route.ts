import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { runProductionBidderWorker } from "@/lib/avito-bidder-worker";

function hasBidderAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

export async function POST() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, subscriptionLevel: true },
  });
  if (!user || !hasBidderAccess(user.subscriptionLevel)) {
    return NextResponse.json({ error: "Бид-менеджер доступен с подпиской Basic" }, { status: 403 });
  }

  const result = await runProductionBidderWorker({
    source: "manual",
    userId: user.id,
    limit: 100,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message, result }, { status: 500 });
  }

  return NextResponse.json({ success: true, result });
}
