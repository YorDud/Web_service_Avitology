import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_FEEDS_PER_USER } from "@/lib/autoload/fields";
import {
  fail,
  publicBaseUrl,
  requireAutoloadUser,
  routeError,
  serializeFeed,
} from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Список таблиц пользователя. */
export async function GET(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  try {
    const feeds = await prisma.autoloadFeed.findMany({
      where: { userId: auth.user.id },
      include: { _count: { select: { ads: true } } },
      orderBy: { createdAt: "desc" },
    });
    const base = publicBaseUrl(request);
    return NextResponse.json({ feeds: feeds.map((feed) => serializeFeed(feed, base)) });
  } catch (error) {
    return routeError(error);
  }
}

/** Создание новой таблицы. */
export async function POST(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);

  try {
    const count = await prisma.autoloadFeed.count({ where: { userId: auth.user.id } });
    if (count >= MAX_FEEDS_PER_USER) {
      return fail(`Можно создать не больше ${MAX_FEEDS_PER_USER} таблиц.`);
    }

    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    const name = (rawName || `Таблица ${count + 1}`).slice(0, 80);

    const feed = await prisma.autoloadFeed.create({
      data: {
        userId: auth.user.id,
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
