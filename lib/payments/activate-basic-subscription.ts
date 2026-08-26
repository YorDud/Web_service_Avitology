import { prisma } from "@/lib/prisma";

export async function activateBasicSubscription(userId: number) {
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Пользователь не найден");
  }

  if (user.subscriptionLevel === "admin") {
    return user;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionLevel: "basic",
      subscriptionPrice: 299,
      subscriptionPaidAt: now,
      subscriptionEndsAt: endDate,
    },
  });

  return updatedUser;
}