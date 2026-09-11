import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { applyBid } from "@/lib/avito-bid-apply";
import { createBidderEvent } from "@/lib/avito-bidder-events";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function hasBidderAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

async function getAuthorizedUser() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: NextResponse.json({ error: "Требуется авторизация" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, subscriptionLevel: true },
  });

  if (!user || !hasBidderAccess(user.subscriptionLevel)) {
    return { error: NextResponse.json({ error: "Бид-менеджер доступен с подпиской Basic" }, { status: 403 }) };
  }

  return { user };
}

export async function POST(request: Request, context: RouteContext) {
  const authorization = await getAuthorizedUser();
  if ("error" in authorization) return authorization.error;

  const { id } = await context.params;
  const bidderId = Number(id);
  if (!Number.isInteger(bidderId) || bidderId <= 0) {
    return NextResponse.json({ error: "Некорректный идентификатор бидера" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (body?.confirmation !== "LIVE") {
    return NextResponse.json(
      { error: "Для создания live Promotion order требуется подтверждение LIVE." },
      { status: 400 },
    );
  }

  const bidder = await prisma.avitoBidder.findFirst({
    where: { id: bidderId, userId: authorization.user.id },
  });

  if (!bidder) return NextResponse.json({ error: "Бидер не найден" }, { status: 404 });
  if (bidder.mode !== "live") {
    return NextResponse.json({ error: "Manual live apply доступен только для bidder-а в режиме live." }, { status: 400 });
  }
  if (bidder.status !== "active") {
    return NextResponse.json({ error: "Для live apply bidder должен быть активен." }, { status: 400 });
  }
  if (!bidder.avitoItemId) {
    return NextResponse.json({ error: "У бидера нет привязанного объявления Авито." }, { status: 400 });
  }
  if (bidder.liveApplyCooldownUntil?.getTime() && bidder.liveApplyCooldownUntil.getTime() > Date.now()) {
    return NextResponse.json(
      { error: `Live apply временно недоступен до ${bidder.liveApplyCooldownUntil.toISOString()}.` },
      { status: 429 },
    );
  }

  try {
    const result = await applyBid({
      mode: "live",
      bidderId: bidder.id,
      userId: bidder.userId,
      avitoItemId: bidder.avitoItemId,
      currentBid: bidder.currentBid,
      recommendedBid: bidder.currentBid,
      promotionDurationDays: bidder.promotionDurationDays,
      cooldownActive: false,
    });

    if (!result.ok) {
      await createBidderEvent({ bidderId: bidder.id, type: "manual_live_apply_error", message: result.message });
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    const applied = result.status === "applied";
    const updated = await prisma.avitoBidder.update({
      where: { id: bidder.id },
      data: {
        lastPromotionPayload: result.lastPromotionPayload ?? bidder.lastPromotionPayload,
        lastForecastPayload: result.lastForecastPayload ?? bidder.lastForecastPayload,
        lastSuggestPayload: result.lastSuggestPayload ?? bidder.lastSuggestPayload,
        lastPromotionOrderId: result.lastPromotionOrderId ?? bidder.lastPromotionOrderId,
        lastPromotionRequestId: result.lastPromotionRequestId ?? bidder.lastPromotionRequestId,
        lastPromotionStatus: result.lastPromotionStatus ?? bidder.lastPromotionStatus,
        lastPromotionPrice: result.lastPromotionPrice ?? bidder.lastPromotionPrice,
        lastPromotionOldPrice: result.lastPromotionOldPrice ?? bidder.lastPromotionOldPrice,
        lastAppliedAt: applied ? new Date() : bidder.lastAppliedAt,
        lastError: null,
        liveApplyCooldownUntil: applied ? new Date(Date.now() + 15 * 60 * 1000) : bidder.liveApplyCooldownUntil,
      },
    });

    await createBidderEvent({ bidderId: bidder.id, type: "manual_live_apply_success", message: result.message });
    return NextResponse.json({ success: true, bidderId: updated.id, message: result.message, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить manual live apply.";
    await createBidderEvent({ bidderId: bidder.id, type: "manual_live_apply_exception", message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
