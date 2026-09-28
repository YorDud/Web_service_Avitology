import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  applyProfile,
  fail,
  parseFeedId,
  publicBaseUrl,
  requireAccount,
  requireAutoloadUser,
  routeError,
} from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Подключает таблицу к автозагрузке Авито (добавляет ссылку на файл в профиль) или отключает её. */
export async function POST(request: Request, context: Context) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const feedId = parseFeedId((await context.params).id);
  if (!feedId) return fail("Таблица не найдена.", 404);

  const body = await request.json().catch(() => null);
  if (typeof body?.linked !== "boolean") return fail("Не указано, подключать или отключать таблицу.");

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  try {
    const feed = await prisma.autoloadFeed.findFirst({
      where: { id: feedId, userId: auth.user.id },
      include: { _count: { select: { ads: true } } },
    });
    if (!feed) return fail("Таблица не найдена.", 404);

    const base = publicBaseUrl(request);

    if (body.linked) {
      if (feed._count.ads === 0) return fail("Добавьте в таблицу хотя бы одно объявление.");
      if (/^https?:\/\/(localhost|127\.|192\.168\.|10\.)/i.test(base)) {
        return fail(
          "Авито не сможет открыть файл по адресу " + base + ". Подключайте таблицу на сайте с публичным доменом и HTTPS.",
        );
      }
    }

    await prisma.autoloadFeed.update({ where: { id: feedId }, data: { linked: body.linked } });

    try {
      const feeds = await prisma.autoloadFeed.findMany({ where: { userId: auth.user.id } });
      const profile = await applyProfile(account, feeds, base, {
        agreement: body.agreement === true ? true : undefined,
      });
      return NextResponse.json({ linked: body.linked, profile });
    } catch (error) {
      await prisma.autoloadFeed.update({ where: { id: feedId }, data: { linked: feed.linked } });
      throw error;
    }
  } catch (error) {
    return routeError(error);
  }
}
