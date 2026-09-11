import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      publicId: true,
      email: true,
      name: true,
      subscriptionLevel: true,
      subscriptionPrice: true,
      subscriptionPaidAt: true,
      subscriptionEndsAt: true,
      financialRecords: {
        orderBy: {
          recordDate: "asc",
        },
      },
      avitoBidders: {
        orderBy: {
          updatedAt: "desc",
        },
      },
      avitoAccountConnection: {
        select: {
          clientId: true,
          tokenExpiresAt: true,
          lastCheckedAt: true,
          lastError: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const initialFinancialRecords = user.financialRecords.map((record) => ({
    id: record.id,
    recordDate: record.recordDate,
    income: record.income,
    expense: record.expense,
  }));

  const initialBidders = user.avitoBidders.map((bidder) => ({
    id: bidder.id,
    title: bidder.title,
    groupName: bidder.groupName,
    city: bidder.city,
    query: bidder.query,
    searchUrl: bidder.searchUrl,
    avitoItemId: bidder.avitoItemId,
    avitoItemUrl: bidder.avitoItemUrl,
    targetFrom: bidder.targetFrom,
    targetTo: bidder.targetTo,
    currentPosition: bidder.currentPosition,
    currentBid: bidder.currentBid,
    minBid: bidder.minBid,
    maxBid: bidder.maxBid,
    bidStep: bidder.bidStep,
    dailySpendLimit: bidder.dailySpendLimit,
    spentToday: bidder.spentToday,
    smartEconomyEnabled: bidder.smartEconomyEnabled,
    checkInterval: bidder.checkInterval,
    schedule: bidder.schedule,
    status: bidder.status,
    mode: bidder.mode,
    changesToday: bidder.changesToday,
    nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null,
    lastCheckedAt: bidder.lastCheckedAt?.toISOString() ?? null,
    lastError: bidder.lastError,
    createdAt: bidder.createdAt.toISOString(),
    updatedAt: bidder.updatedAt.toISOString(),
  }));

  const initialAvitoConnection = user.avitoAccountConnection
    ? {
        clientIdMasked:
          user.avitoAccountConnection.clientId.length <= 6
            ? user.avitoAccountConnection.clientId
            : `${user.avitoAccountConnection.clientId.slice(0, 3)}***${user.avitoAccountConnection.clientId.slice(-3)}`,
        tokenExpiresAt:
          user.avitoAccountConnection.tokenExpiresAt?.toISOString() ?? null,
        lastCheckedAt:
          user.avitoAccountConnection.lastCheckedAt?.toISOString() ?? null,
        lastError: user.avitoAccountConnection.lastError,
      }
    : null;

  return (
    <DashboardClient
      user={{
        name: user.name,
        publicId: user.publicId ? String(user.publicId) : "—",
        email: user.email,
        subscriptionLevel: user.subscriptionLevel,
        subscriptionPriceText:
          user.subscriptionPrice > 0
            ? `${new Intl.NumberFormat("ru-RU").format(user.subscriptionPrice)} ₽/мес`
            : "Бесплатно",
        subscriptionPaidAt: user.subscriptionPaidAt
          ? new Intl.DateTimeFormat("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(user.subscriptionPaidAt)
          : "—",
        subscriptionEndsAt: user.subscriptionEndsAt
          ? new Intl.DateTimeFormat("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(user.subscriptionEndsAt)
          : "—",
      }}
      initialFinancialRecords={initialFinancialRecords}
      initialBidders={initialBidders}
      initialAvitoConnection={initialAvitoConnection}
    />
  );
}