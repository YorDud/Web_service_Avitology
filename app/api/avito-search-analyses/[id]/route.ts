import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthorizedAvitoUser,
  serializeAnalysisList,
} from "@/lib/avito-analytics";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function GET(_: Request, context: RouteContext) {
  const authorization = await getAuthorizedAvitoUser();
  if ("error" in authorization) return authorization.error;

  const { id: rawId } = await context.params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Некорректный идентификатор анализа" },
      { status: 400 }
    );
  }

  const analysis = await prisma.avitoSearchAnalysis.findFirst({
    where: { id, userId: authorization.user.id },
    include: { items: { orderBy: { firstPosition: "asc" } } },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Анализ не найден" }, { status: 404 });
  }

  return NextResponse.json({
    analysis: {
      ...serializeAnalysisList(analysis),
      searchUrl: analysis.searchUrl,
      source: analysis.source,
      items: analysis.items.map((item) => ({
        id: item.id,
        sellerName: item.sellerName,
        firstPosition: item.firstPosition,
        positions: parseJson(item.positionsJson, []),
        adsCount: item.adsCount,
        rating: item.rating,
        reviews: item.reviews,
        ads: parseJson(item.adsJson, []),
      })),
    },
  });
}

export async function DELETE(_: Request, context: RouteContext) {
  const authorization = await getAuthorizedAvitoUser();
  if ("error" in authorization) return authorization.error;

  const { id: rawId } = await context.params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Некорректный идентификатор анализа" },
      { status: 400 }
    );
  }

  const analysis = await prisma.avitoSearchAnalysis.findFirst({
    where: { id, userId: authorization.user.id },
    select: { id: true },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Анализ не найден" }, { status: 404 });
  }

  await prisma.avitoSearchAnalysis.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}