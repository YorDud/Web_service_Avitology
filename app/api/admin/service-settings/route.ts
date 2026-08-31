import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function PATCH(req: Request) {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      );
    }

    const admin = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (!admin || admin.subscriptionLevel !== "admin") {
      return NextResponse.json(
        { error: "Недостаточно прав" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);

    const isYookassaEnabled = Boolean(body?.isYookassaEnabled);
    const isFreeTrialEnabled = Boolean(body?.isFreeTrialEnabled);

    const settings = await prisma.serviceSettings.upsert({
      where: { id: 1 },
      update: {
        isYookassaEnabled,
        isFreeTrialEnabled,
      },
      create: {
        id: 1,
        isYookassaEnabled,
        isFreeTrialEnabled,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("SERVICE SETTINGS PATCH ERROR:", error);

    return NextResponse.json(
      { error: "Ошибка сохранения настроек" },
      { status: 500 }
    );
  }
}