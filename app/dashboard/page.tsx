import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { formatRuDateTime } from "@/lib/dates";
import DashboardClientPage from "./dashboard-client";


function maskAvitoClientId(clientId: string) {
  if (clientId.length <= 4) return "••••";
  if (clientId.length <= 8) {
    return `${clientId.slice(0, 2)}••••${clientId.slice(-2)}`;
  }

  return `${clientId.slice(0, 4)}••••${clientId.slice(-4)}`;
}

function serializeBidder(bidder: {
  id: number;
  title: string;
  city: string;
  query: string;
  targetFrom: number;
  targetTo: number;
  currentPosition: number | null;
  currentBid: number | null;
  minBid: number;
  maxBid: number;
  status: string;
  changesToday: number;
}) {
  const status: "active" | "paused" | "attention" =
    bidder.status === "paused" || bidder.status === "attention"
      ? bidder.status
      : "active";

  return {
    id: bidder.id,
    title: bidder.title,
    city: bidder.city,
    query: bidder.query,
    targetFrom: bidder.targetFrom,
    targetTo: bidder.targetTo,
    position: bidder.currentPosition,
    currentBid: bidder.currentBid ?? bidder.minBid,
    minBid: bidder.minBid,
    maxBid: bidder.maxBid,
    status,
    nextCheck: status === "paused" ? "на паузе" : "ожидает запуска worker",
    changesToday: bidder.changesToday,
    imageLabel: bidder.title.slice(0, 2).toUpperCase(),
  };
}

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) redirect("/auth");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      financialRecords: { orderBy: { recordDate: "desc" } },
      avitoBidders: { orderBy: { updatedAt: "desc" } },
      avitoAccountConnection: true,
    },
  });

  if (!user) redirect("/auth");

  const dashboardUser = {
    name: user.name ?? "Пользователь",
    publicId: user.publicId === null || user.publicId === undefined ? "—" : String(user.publicId),
    email: user.email ?? "—",
    subscriptionLevel: String(user.subscriptionLevel ?? "free"),
    subscriptionPriceText: user.subscriptionPrice === null || user.subscriptionPrice === undefined ? "—" : `${user.subscriptionPrice} ₽`,
    subscriptionPaidAt: formatRuDateTime(user.subscriptionPaidAt) || "—",
    subscriptionEndsAt: formatRuDateTime(user.subscriptionEndsAt) || "—",
  };

  const financialRecords = user.financialRecords.map((record) => ({
    id: record.id,
    recordDate: record.recordDate,
    income: record.income,
    expense: record.expense,
  }));

  const initialBidders = user.avitoBidders.map((bidder) => ({
  id: bidder.id,
  title: bidder.title,
  city: bidder.city,
  query: bidder.query,
  avitoItemId: bidder.avitoItemId,
  avitoItemUrl: bidder.avitoItemUrl,
  targetFrom: bidder.targetFrom,
  targetTo: bidder.targetTo,
  currentPosition: bidder.currentPosition,
  currentBid: bidder.currentBid,
  minBid: bidder.minBid,
  maxBid: bidder.maxBid,
  checkInterval: bidder.checkInterval,
  schedule: bidder.schedule,
  status: bidder.status,
  changesToday: bidder.changesToday,
  nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null,
  lastCheckedAt: bidder.lastCheckedAt?.toISOString() ?? null,
  lastError: bidder.lastError,
  createdAt: bidder.createdAt.toISOString(),
  updatedAt: bidder.updatedAt.toISOString(),
}));

const avitoConnection = user.avitoAccountConnection
  ? {
      clientIdMasked: maskAvitoClientId(user.avitoAccountConnection.clientId),
      tokenExpiresAt:
        user.avitoAccountConnection.tokenExpiresAt?.toISOString() ?? null,
      lastCheckedAt:
        user.avitoAccountConnection.lastCheckedAt?.toISOString() ?? null,
      lastError: user.avitoAccountConnection.lastError,
    }
  : null;

  return (
    <DashboardClientPage
      user={dashboardUser}
      initialFinancialRecords={financialRecords}
      initialBidders={initialBidders}
      initialAvitoConnection={avitoConnection}
    />
  );
}
