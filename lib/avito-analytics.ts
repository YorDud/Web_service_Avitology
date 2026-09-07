import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export function hasAvitoAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

export async function getAuthorizedAvitoUser() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return {
      error: NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      ),
    } as const;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, subscriptionLevel: true, isActive: true },
  });

  if (!user || !user.isActive || !hasAvitoAccess(user.subscriptionLevel)) {
    return {
      error: NextResponse.json(
        { error: "Аналитика мест в поиске доступна с подпиской Basic" },
        { status: 403 }
      ),
    } as const;
  }

  return { user } as const;
}

export function serializeAnalysisList(analysis: {
  id: number;
  searchQuery: string;
  city: string | null;
  itemsCount: number;
  createdAt: Date;
}) {
  return {
    id: analysis.id,
    searchQuery: analysis.searchQuery,
    city: analysis.city,
    itemsCount: analysis.itemsCount,
    createdAt: analysis.createdAt.toISOString(),
  };
}