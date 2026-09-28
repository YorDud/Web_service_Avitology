import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { BonusCodeError, redeemBonusCode } from "@/lib/bonus-codes";

// Простая защита от перебора кодов: не более 8 попыток в минуту на аккаунт.
const attempts = new Map<number, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 8;

function isRateLimited(userId: number) {
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter(
    (time) => now - time < WINDOW_MS,
  );

  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(userId, recent);
    return true;
  }

  recent.push(now);
  attempts.set(userId, recent);
  return false;
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 },
      );
    }

    if (isRateLimited(sessionUser.id)) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте через минуту." },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => null);
    const result = await redeemBonusCode(sessionUser.id, body?.code);

    return NextResponse.json({
      success: true,
      tier: result.tier,
      durationDays: result.durationDays,
      subscriptionEndsAt: result.subscriptionEndsAt,
    });
  } catch (error) {
    if (error instanceof BonusCodeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("REDEEM CODE ERROR:", error);

    return NextResponse.json(
      { error: "Не удалось активировать промокод. Попробуйте позже." },
      { status: 500 },
    );
  }
}
