import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { formatRuDateTime } from "@/lib/dates";
import DashboardClientPage from "./dashboard-client";

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/auth");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      financialRecords: {
        orderBy: {
          recordDate: "desc",
        },
      },
    },
  });

  if (!user) {
    redirect("/auth");
  }

  const dashboardUser = {
    name: user.name ?? "Пользователь",
    publicId:
      user.publicId === null || user.publicId === undefined
        ? "—"
        : String(user.publicId),
    email: user.email ?? "—",
    subscriptionLevel: String(user.subscriptionLevel ?? "free"),
    subscriptionPriceText:
      user.subscriptionPrice === null || user.subscriptionPrice === undefined
        ? "—"
        : `${user.subscriptionPrice} ₽`,
    subscriptionPaidAt: formatRuDateTime(user.subscriptionPaidAt) || "—",
    subscriptionEndsAt: formatRuDateTime(user.subscriptionEndsAt) || "—",
  };

  const financialRecords = user.financialRecords.map((record) => ({
    id: record.id,
    recordDate: record.recordDate,
    income: record.income,
    expense: record.expense,
  }));

  return (
    <DashboardClientPage
      user={dashboardUser}
      initialFinancialRecords={financialRecords}
    />
  );
}