import { prisma } from "@/lib/prisma";

export async function activateFreeTrial(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Пользователь не найден");
  }

  if (user.usedFreeTrial) {
    throw new Error("Пробный доступ уже использован");
  }

  if (user.subscriptionPaidAt) {
    throw new Error("Пробный доступ недоступен после оплаты");
  }

  const paidAt = new Date();
  const endsAt = new Date(paidAt);
  endsAt.setDate(endsAt.getDate() + 1);

  return prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionLevel: "basic",
      subscriptionPrice: 0,
      subscriptionPaidAt: paidAt,
      subscriptionEndsAt: endsAt,
      usedFreeTrial: true,
    },
  });
}