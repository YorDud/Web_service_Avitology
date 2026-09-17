import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

const MAX_ITEMS = 200;
const MAX_TEXT = 500;

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

function hasAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

function text(value: unknown, maxLength = MAX_TEXT) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalText(value: unknown, maxLength = MAX_TEXT) {
  return text(value, maxLength) || null;
}

function integer(value: unknown) {
  const result = Number(value);
  return Number.isInteger(result) && result >= 0 ? result : null;
}

function parsePositions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(integer)
    .filter((position): position is number => position !== null)
    .slice(0, 100);
}

function parseAds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 100).map((ad) => {
    const source = ad && typeof ad === "object" ? (ad as Record<string, unknown>) : {};

    return {
      id: text(source.id, 120),
      title: text(source.title),
      price: text(source.price, 120),
      position: integer(source.position),
      link: text(source.link, 2000),
      promotions: source.promotions ?? null,
    };
  });
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  const extensionToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  const sessionUser = extensionToken ? null : await getSessionUser();

  const user = extensionToken
    ? await prisma.user.findUnique({
        where: { extensionApiToken: extensionToken },
        select: { id: true, isActive: true, subscriptionLevel: true },
      })
    : sessionUser
      ? await prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { id: true, isActive: true, subscriptionLevel: true },
        })
      : null;

  if (!user || !user.isActive || !hasAccess(user.subscriptionLevel)) {
    return withCors(
      NextResponse.json(
        { error: "Сохранение аналитики доступно с подпиской Basic" },
        { status: 403 }
      )
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return withCors(
      NextResponse.json({ error: "Некорректный формат данных" }, { status: 400 })
    );
  }

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];

  if (!rawItems.length) {
    return withCors(
      NextResponse.json(
        { error: "Нет результатов по продавцам для сохранения" },
        { status: 400 }
      )
    );
  }

  const items = rawItems.map((raw) => {
    const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const positions = parsePositions(source.positions);
    const ads = parseAds(source.ads);

    return {
      sellerName: text(source.seller, 250) || "Без имени",
      firstPosition: integer(source.firstPosition) ?? positions[0] ?? null,
      positionsJson: JSON.stringify(positions),
      adsCount: integer(source.count) ?? ads.length,
      rating: optionalText(source.rating, 80),
      reviews: optionalText(source.reviews, 80),
      adsJson: JSON.stringify(ads),
      rawData: JSON.stringify(source),
    };
  });

  const analysis = await prisma.avitoSearchAnalysis.create({
    data: {
      userId: user.id,
      searchQuery: text(body.searchQuery, 250),
      searchUrl: optionalText(body.searchUrl, 2000),
      city: optionalText(body.city, 250),
      source: "extension",
      itemsCount: items.length,
      items: { create: items },
    },
    select: { id: true, createdAt: true, itemsCount: true },
  });

  return withCors(
    NextResponse.json({
      success: true,
      analysis: {
        id: analysis.id,
        createdAt: analysis.createdAt.toISOString(),
        itemsCount: analysis.itemsCount,
      },
    })
  );
}