import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getServiceSettings } from "@/lib/service-settings";
import { activateFreeTrial } from "@/lib/payments/activate-free-trial";

export async function POST() {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      );
    }

    const settings = await getServiceSettings();

    if (!settings.isFreeTrialEnabled) {
      return NextResponse.json(
        { error: "Пробный доступ сейчас отключен" },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    if (user.usedFreeTrial) {
      return NextResponse.json(
        { error: "Пробный доступ уже использован" },
        { status: 400 }
      );
    }

    if (user.subscriptionPaidAt) {
      return NextResponse.json(
        { error: "Пробный доступ доступен только до первой оплаты" },
        { status: 400 }
      );
    }

    await activateFreeTrial(user.id);

    return NextResponse.json({
      success: true,
      redirectUrl: "/dashboard",
    });
  } catch (error) {
    console.error("FREE TRIAL ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ошибка активации пробного доступа",
      },
      { status: 500 }
    );
  }
}