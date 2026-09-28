import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  applyProfile,
  fail,
  getAccount,
  parseFeedId,
  publicBaseUrl,
  readDefaults,
  readSettings,
  requireAutoloadUser,
  routeError,
  sanitizeData,
  sanitizeSettings,
  serializeFeed,
} from "@/lib/autoload/server";
import type { AdMessage, FeedDetail } from "@/lib/autoload/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function readMessages(value: unknown): AdMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      type: String(item.type ?? ""),
      title: String(item.title ?? ""),
      description: String(item.description ?? ""),
    }));
}

/** Таблица целиком: настройки и все объявления. */
export async function GET(request: Request, context: Context) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const id = parseFeedId((await context.params).id);
  if (!id) return fail("Таблица не найдена.", 404);

  try {
    const feed = await prisma.autoloadFeed.findFirst({
      where: { id, userId: auth.user.id },
      include: { ads: { orderBy: { id: "asc" } }, _count: { select: { ads: true } } },
    });
    if (!feed) return fail("Таблица не найдена.", 404);

    const detail: FeedDetail = {
      ...serializeFeed(feed, publicBaseUrl(request)),
      defaults: readDefaults(feed),
      settings: readSettings(feed),
      ads: feed.ads.map((ad) => ({
        key: ad.adKey,
        data: sanitizeData(ad.data),
        avitoId: ad.avitoId,
        avitoStatus: ad.avitoStatus,
        avitoMessages: readMessages(ad.avitoMessages),
        syncedAt: ad.syncedAt ? ad.syncedAt.toISOString() : null,
      })),
    };

    return NextResponse.json({ feed: detail });
  } catch (error) {
    return routeError(error);
  }
}

/** Переименование, общие поля и настройки столбцов. */
export async function PATCH(request: Request, context: Context) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const id = parseFeedId((await context.params).id);
  if (!id) return fail("Таблица не найдена.", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Пустой запрос.");

  const data: {
    name?: string;
    defaults?: Record<string, string>;
    settings?: { columns?: string[] };
  } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (!name) return fail("Название таблицы не может быть пустым.");
    data.name = name;
  }
  if (body.defaults !== undefined) data.defaults = sanitizeData(body.defaults);
  if (body.settings !== undefined) data.settings = sanitizeSettings(body.settings);

  try {
    const existing = await prisma.autoloadFeed.findFirst({ where: { id, userId: auth.user.id } });
    if (!existing) return fail("Таблица не найдена.", 404);

    const feed = await prisma.autoloadFeed.update({
      where: { id },
      data,
      include: { _count: { select: { ads: true } } },
    });

    // Название файла показывается в отчётах Авито — обновим его в профиле.
    if (data.name && feed.linked) {
      const account = await getAccount(auth.user.id);
      if (account) {
        const feeds = await prisma.autoloadFeed.findMany({ where: { userId: auth.user.id } });
        await applyProfile(account, feeds, publicBaseUrl(request)).catch(() => null);
      }
    }

    return NextResponse.json({ feed: serializeFeed(feed, publicBaseUrl(request)) });
  } catch (error) {
    return routeError(error);
  }
}

/** Удаление таблицы вместе с объявлениями. */
export async function DELETE(request: Request, context: Context) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const id = parseFeedId((await context.params).id);
  if (!id) return fail("Таблица не найдена.", 404);

  try {
    const existing = await prisma.autoloadFeed.findFirst({ where: { id, userId: auth.user.id } });
    if (!existing) return fail("Таблица не найдена.", 404);

    await prisma.autoloadFeed.delete({ where: { id } });

    if (existing.linked) {
      const account = await getAccount(auth.user.id);
      if (account) {
        const feeds = await prisma.autoloadFeed.findMany({ where: { userId: auth.user.id } });
        await applyProfile(account, feeds, publicBaseUrl(request)).catch(() => null);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
