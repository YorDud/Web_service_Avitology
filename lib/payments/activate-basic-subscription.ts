import { prisma } from "@/lib/prisma";

type ActivateBasicSubscriptionOptions = {
  months?: number;
  price?: number;
  paidAt?: Date;
};

export async function activateBasicSubscription(
  userId: number,
  options: ActivateBasicSubscriptionOptions = {}
) {
  const months = options.months ?? 1;
  const price = options.price ?? 299;
  const paidAt = options.paidAt ?? new Date();

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!currentUser) {
    throw new Error("Пользователь не найден");
  }

  const baseDate =
    currentUser.subscriptionEndsAt &&
    currentUser.subscriptionEndsAt.getTime() > paidAt.getTime()
      ? currentUser.subscriptionEndsAt
      : paidAt;

  const nextEnd = new Date(baseDate);
  nextEnd.setMonth(nextEnd.getMonth() + months);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionLevel: "basic",
      subscriptionPrice: price,
      subscriptionPaidAt: paidAt,
      subscriptionEndsAt: nextEnd,
    },
  });

  return updatedUser;
}