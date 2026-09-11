import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

function hasBidderAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { subscriptionLevel: true },
  });
  if (!user || !hasBidderAccess(user.subscriptionLevel)) {
    return NextResponse.json({ error: "Бид-менеджер доступен с подпиской Basic" }, { status: 403 });
  }

  const runs = await prisma.bidderWorkerRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
    select: {
      id: true,
      source: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      processed: true,
      skipped: true,
      failed: true,
      total: true,
      message: true,
      error: true,
    },
  });

  return NextResponse.json({ success: true, runs });
}
