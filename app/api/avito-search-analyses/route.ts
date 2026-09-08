import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthorizedAvitoUser,
  serializeAnalysisList,
} from "@/lib/avito-analytics";

const ANALYSIS_RETENTION_DAYS = 14;

export async function GET() {
  const authorization = await getAuthorizedAvitoUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  const userId = authorization.user.id;

  // Анализы хранятся не более 14 дней с даты создания.
  const cleanupDate = new Date();
  cleanupDate.setDate(cleanupDate.getDate() - ANALYSIS_RETENTION_DAYS);

  await prisma.avitoSearchAnalysis.deleteMany({
    where: {
      userId,
      createdAt: {
        lt: cleanupDate,
      },
    },
  });

  const analyses = await prisma.avitoSearchAnalysis.findMany({
    where: { userId },
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