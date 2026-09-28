import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BonusTier = "basic" | "pro";

export const BONUS_TIERS: BonusTier[] = ["basic", "pro"];

export class BonusCodeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function normalizeBonusCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function isValidBonusCodeFormat(code: string) {
  return /^[A-Z0-9_-]{3,40}$/.test(code);
}

export async function redeemBonusCode(userId: number, rawCode: unknown) {
  const code = normalizeBonusCode(rawCode);

  if (!code) {
    throw new BonusCodeError("Введите промокод", 400);
  }

  return prisma.$transaction(async (tx) => {
    const bonus = await tx.bonusCode.findUnique({ where: { code } });

    if (!bonus) {
      throw new BonusCodeError("Такого промокода не существует", 404);
    }

    const user = await tx.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BonusCodeError("Пользователь не найден", 404);
    }

    const now = new Date();

    if (!bonus.isActive) {
      throw new BonusCodeError("Этот промокод сейчас отключён", 400);
    }

    if (bonus.validFrom && bonus.validFrom > now) {
      throw new BonusCodeError("Этот промокод ещё не начал действовать", 400);
    }

    if (bonus.validUntil && bonus.validUntil <= now) {
      throw new BonusCodeError("Срок действия промокода истёк", 400);
    }

    if (bonus.maxUses !== null && bonus.usedCount >= bonus.maxUses) {
      throw new BonusCodeError("Лимит активаций промокода исчерпан", 400);
    }

    if (user.subscriptionLevel === "admin") {
      throw new BonusCodeError(
        "Администраторам активация промокодов недоступна",
        403,
      );
    }

    const subscriptionIsActive =
      (user.subscriptionLevel === "basic" ||
        user.subscriptionLevel === "pro") &&
      !!user.subscriptionEndsAt &&
      user.subscriptionEndsAt > now;

    if (
      bonus.tier === "basic" &&
      user.subscriptionLevel === "pro" &&
      subscriptionIsActive
    ) {
      throw new BonusCodeError(
        "У вас подписка Pro, вы не можете активировать данный промокод в данный момент",
        403,
      );
    }

    const tier = bonus.tier as BonusTier;

    // Продлеваем от текущей даты окончания, если подписка ещё действует
    // (так же работает оплата в lib/payments/activate-subscription.ts).
    const base =
      subscriptionIsActive && user.subscriptionEndsAt
        ? user.subscriptionEndsAt
        : now;

    const endsAt = new Date(base);
    endsAt.setDate(endsAt.getDate() + bonus.durationDays);

    // Один аккаунт — одна активация кода. Гарантируется уникальным индексом
    // (codeId, userId), поэтому двойной клик / параллельные запросы безопасны.
    try {
      await tx.bonusCodeRedemption.create({
        data: {
          codeId: bonus.id,
          userId: user.id,
          tier,
          durationDays: bonus.durationDays,
          endsAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new BonusCodeError("Вы уже активировали этот промокод", 409);
      }

      throw error;
    }

    await tx.bonusCode.update({
      where: { id: bonus.id },
      data: { usedCount: { increment: 1 } },
    });

    // Если у пользователя уже есть действующая подписка того же тарифа,
    // сохраняем её цену и дату оплаты; иначе это бонусная подписка (0 ₽).
    const keepPaidData =
      subscriptionIsActive && user.subscriptionLevel === tier;

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        subscriptionLevel: tier,
        subscriptionPrice: keepPaidData ? user.subscriptionPrice : 0,
        subscriptionPaidAt: keepPaidData
          ? (user.subscriptionPaidAt ?? now)
          : now,
        subscriptionEndsAt: endsAt,
      },
    });

    return {
      tier,
      durationDays: bonus.durationDays,
      subscriptionEndsAt: updated.subscriptionEndsAt,
    };
  });
}
