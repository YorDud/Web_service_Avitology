import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_ADS_PER_FEED } from "@/lib/autoload/fields";
import {
  fail,
  parseFeedId,
  requireAutoloadUser,
  routeError,
  sanitizeData,
  stableStringify,
} from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const CHUNK = 400;

function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Сохраняет всю таблицу объявлений.
 * Существующие объявления (по ID) обновляются и сохраняют статусы Авито,
 * новые добавляются, отсутствующие в запросе удаляются.
 */
export async function PUT(request: Request, context: Context) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const feedId = parseFeedId((await context.params).id);
  if (!feedId) return fail("Таблица не найдена.", 404);

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.ads)) return fail("Ожидается список объявлений.");
  if (body.ads.length > MAX_ADS_PER_FEED) {
    return fail(`В одной таблице можно хранить до ${MAX_ADS_PER_FEED} объявлений.`);
  }

  const incoming = new Map<string, Record<string, string>>();
  for (const item of body.ads as { key?: unknown; data?: unknown }[]) {
    const key = typeof item?.key === "string" ? item.key.trim() : "";
    if (!key || key.length > 100) return fail("У каждого объявления должен быть ID до 100 символов.");
    if (incoming.has(key)) return fail(`ID «${key}» повторяется. Исправьте дубли и сохраните снова.`);
    incoming.set(key, sanitizeData(item.data));
  }

  try {
    const feed = await prisma.autoloadFeed.findFirst({ where: { id: feedId, userId: auth.user.id } });
    if (!feed) return fail("Таблица не найдена.", 404);

    const existing = await prisma.autoloadAd.findMany({
      where: { feedId },
      select: { id: true, adKey: true, data: true },
    });
    const existingByKey = new Map(existing.map((ad) => [ad.adKey, ad]));

    const removeIds = existing.filter((ad) => !incoming.has(ad.adKey)).map((ad) => ad.id);
    const toCreate = [...incoming].filter(([key]) => !existingByKey.has(key));
    const toUpdate = [...incoming].flatMap(([key, data]) => {
      const current = existingByKey.get(key);
      if (!current) return [];
      return stableStringify(sanitizeData(current.data)) === stableStringify(data)
        ? []
        : [{ id: current.id, data }];
    });

    for (const ids of chunk(removeIds)) {
      await prisma.autoloadAd.deleteMany({ where: { id: { in: ids } } });
    }
    for (const rows of chunk(toCreate)) {
      await prisma.autoloadAd.createMany({
        data: rows.map(([adKey, data]) => ({ feedId, adKey, data })),
      });
    }
    for (const rows of chunk(toUpdate)) {
      await prisma.$transaction(
        rows.map((row) => prisma.autoloadAd.update({ where: { id: row.id }, data: { data: row.data } })),
      );
    }

    await prisma.autoloadFeed.update({ where: { id: feedId }, data: { updatedAt: new Date() } });

    return NextResponse.json({
      ok: true,
      count: incoming.size,
      created: toCreate.length,
      updated: toUpdate.length,
      removed: removeIds.length,
    });
  } catch (error) {
    return routeError(error);
  }
}
