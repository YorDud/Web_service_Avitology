import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { runProductionBidderWorker } from "@/lib/avito-bidder-worker";

function hasBidderAccess(level: string | null | undefined) {
  return level === "admin";
}

export async function POST() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, subscriptionLevel: true },
  });
  if (!user || !hasBidderAccess(user.subscriptionLevel)) {
    return NextResponse.json({ error: "РњРѕРЅРёС‚РѕСЂРёРЅРі worker РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°Рј" }, { status: 403 });
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

