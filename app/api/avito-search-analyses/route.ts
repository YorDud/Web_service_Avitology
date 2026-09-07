import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthorizedAvitoUser,
  serializeAnalysisList,
} from "@/lib/avito-analytics";

export async function GET() {
  const authorization = await getAuthorizedAvitoUser();
  if ("error" in authorization) return authorization.error;

  const analyses = await prisma.avitoSearchAnalysis.findMany({
    where: { userId: authorization.user.id },
    select: {
      id: true,
      searchQuery: true,
      city: true,
      itemsCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    analyses: analyses.map(serializeAnalysisList),
  });
}