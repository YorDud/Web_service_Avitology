import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_FEEDS_PER_USER } from "@/lib/autoload/fields";
import {
  fail,
  publicBaseUrl,
  readClientKey,
  requireAutoloadUser,
  requireScope,
  routeError,
  serializeFeed,
} from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Список таблиц выбранного аккаунта Авито (основного или клиента). */
export async function GET(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { scope, response } = await requireScope(auth.user.id, readClientKey(request));
  if (!scope) return response;

  try {
    const feeds = await prisma.autoloadFeed.findMany({
      where: { userId: auth.user.id, ...scope },
      include: { _count: { select: { ads: true } } },
      orderBy: { createdAt: "desc" },
    });
    const base = publicBaseUrl(request);
    return NextResponse.json({ feeds: feeds.map((feed) => serializeFeed(feed, base)) });
  } catch (error) {
    return routeError(error);
  }
}

/** Создание новой таблицы в выбранном аккаунте Авито. */
export async function POST(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { scope, response } = await requireScope(auth.user.id, readClientKey(request));
  if (!scope) return response;

  const body = await request.json().catch(() => null);

  try {
    // Лимит считается на каждый аккаунт Авито отдельно.
    const count = await prisma.autoloadFeed.count({ where: { userId: auth.user.id, ...scope } });
    if (count >= MAX_FEEDS_PER_USER) {
      return fail(`Можно создать не больше ${MAX_FEEDS_PER_USER} таблиц на один аккаунт Авито.`);
    }

    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    const name = (rawName || `Таблица ${count + 1}`).slice(0, 80);

    const feed = await prisma.autoloadFeed.create({
      data: {
        userId: auth.user.id,
        autoloadClientId: scope.autoloadClientId,
        name,
        publicToken: randomBytes(24).toString("hex"),
        defaults: {},
        settings: {},
      },
      include: { _count: { select: { ads: true } } },
    });

    return NextResponse.json({ feed: serializeFeed(feed, publicBaseUrl(request)) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
