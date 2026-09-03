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
  });

  if (!user) {
    redirect("/auth");
  }

  const dashboardUser = {
    name: user.name,
    publicId: user.publicId,
    email: user.email,
    subscriptionLevel: user.subscriptionLevel,

    // Всегда строка — никаких number | null в client-компонент.
    subscriptionPriceText:
      user.subscriptionPrice === null
        ? "—"
        : `${user.subscriptionPrice} ₽`,

    subscriptionPaidAt: formatRuDateTime(user.subscriptionPaidAt),
    subscriptionEndsAt: formatRuDateTime(user.subscriptionEndsAt),
  };

  return <DashboardClientPage user={dashboardUser} />;
}