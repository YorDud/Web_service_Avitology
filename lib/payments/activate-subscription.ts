import { prisma } from "@/lib/prisma";
import type { SubscriptionTier } from "@/lib/subscription-plans";
export async function activateSubscription(userId: number, tier: SubscriptionTier, options: { months?: number; price?: number; paidAt?: Date } = {}) {
  const months = options.months ?? 1; const price = options.price ?? (tier === "pro" ? 799 : 299); const paidAt = options.paidAt ?? new Date();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Пользователь не найден");
  // Admin is never downgraded by a test or payment flow.
  if (user.subscriptionLevel === "admin") return user;
  const base = user.subscriptionEndsAt && user.subscriptionEndsAt > paidAt ? user.subscriptionEndsAt : paidAt;
  const subscriptionEndsAt = new Date(base); subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + months);
  return prisma.user.update({ where: { id: userId }, data: { subscriptionLevel: tier, subscriptionPrice: price, subscriptionPaidAt: paidAt, subscriptionEndsAt } });
}
