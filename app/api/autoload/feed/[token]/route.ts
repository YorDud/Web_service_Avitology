import { prisma } from "@/lib/prisma";
import { buildFeedXml } from "@/lib/autoload/xml";
import { isProLevel, readDefaults, sanitizeData } from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

/**
 * Публичный XML-файл для Автозагрузки Авито.
 * Адрес содержит случайный токен, вход в аккаунт не требуется: файл читает сам Авито.
 * Работает, пока у владельца активна подписка Pro.
 */
export async function GET(_request: Request, context: Context) {
  const token = (await context.params).token.replace(/\.xml$/i, "");
  if (!/^[a-f0-9]{32,64}$/i.test(token)) return text("Файл не найден", 404);

  try {
    const feed = await prisma.autoloadFeed.findUnique({
      where: { publicToken: token },
      include: {
        user: { select: { subscriptionLevel: true } },
        ads: { orderBy: { id: "asc" }, select: { adKey: true, data: true } },
      },
    });

    if (!feed) return text("Файл не найден", 404);
    if (!isProLevel(feed.user.subscriptionLevel)) {
      return text("Подписка Pro не активна. Автозагрузка HelpSell приостановлена.", 403);
    }

    const xml = buildFeedXml(
      feed.ads.map((ad) => ({ key: ad.adKey, data: sanitizeData(ad.data) })),
      readDefaults(feed),
    );

    prisma.autoloadFeed
      .update({
        where: { id: feed.id },
        data: { lastFetchedAt: new Date(), fetchCount: { increment: 1 } },
      })
      .catch(() => null);

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[autoload] feed", error);
    return text("Ошибка сервера", 500);
  }
}
