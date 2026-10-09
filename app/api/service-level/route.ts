import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { hasTierAccess } from "@/lib/service-level/constants";
import { scheduleDispatch, scheduleSync, toUserOrderView } from "@/lib/service-level/orders";
import { getServiceLevelSettings } from "@/lib/service-level/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYNC_AFTER_MS = 90 * 1000;

/**
 * Услуги, настройки приёма заказов и заказы пользователя.
 * Заодно «подтягивает» ход выполнения у SocPublic (в фоне, не задерживая ответ):
 * пока заказ в работе, при каждом обновлении страницы статус актуализируется.
 */
export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return NextResponse.json({ error: "Необходимо войти в аккаунт" }, { status: 401 });

    const settings = await getServiceLevelSettings();
    const allowed = hasTierAccess(sessionUser.subscriptionLevel, settings.minTier);

    const [services, orders] = await Promise.all([
      prisma.serviceLevelService.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      prisma.serviceLevelOrder.findMany({
        where: { userId: sessionUser.id, status: { not: "awaiting_payment" } },
        orderBy: { orderNumber: "desc" },
        include: { items: { orderBy: { position: "asc" } }, service: true },
        take: 300,
      }),
    ]);

    const now = Date.now();
    const active = orders.filter((order) => order.status === "in_progress");
    scheduleSync(
      active
        .filter((order) => order.items.some((item) => item.stage === "active") && (!order.lastSyncAt || now - order.lastSyncAt.getTime() >= SYNC_AFTER_MS))
        .slice(0, 3)
        .map((order) => order.id),
    );
    // Самовосстановление: оплаченный заказ, у которого отправка не завершилась (например, сервер перезапустили), дозапускается.
    for (const order of active) {
      // Включая промежуточные этапы: если сервер упал посреди запроса, дозапуск пометит такое задание как «требует внимания».
      const unfinished = order.items.some((item) => ["pending", "created", "funded", "creating", "funding", "enabling"].includes(item.stage));
      const free = !order.dispatchLockedUntil || order.dispatchLockedUntil.getTime() < now;
      if (unfinished && free) scheduleDispatch(order.id);
    }

    return NextResponse.json({
      allowed,
      settings: {
        isEnabled: settings.isEnabled,
        minTier: settings.minTier,
        maxLinksPerOrder: settings.maxLinksPerOrder,
        etaText: settings.etaText,
        guideIntro: settings.guideIntro,
      },
      services: services.map((service) => ({
        id: service.id,
        slug: service.slug,
        title: service.title,
        summary: service.summary,
        guide: service.guide,
        emoji: service.emoji,
        pricePerUnit: service.pricePerUnit,
        minQuantity: service.minQuantity,
        maxQuantity: service.maxQuantity,
      })),
      orders: orders.map(toUserOrderView),
    });
  } catch (error) {
    console.error("SERVICE LEVEL GET ERROR:", error);
    return NextResponse.json({ error: "Не удалось загрузить данные услуги." }, { status: 500 });
  }
}
