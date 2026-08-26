import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getServiceSettings } from "@/lib/service-settings";

async function requireAdmin() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      subscriptionLevel: true,
    },
  });

  if (!user || user.subscriptionLevel !== "admin") {
    return null;
  }

  return user;
}

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const settings = await getServiceSettings();

  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const body = await req.json();

  const settings = await prisma.serviceSettings.upsert({
    where: { id: 1 },
    update: {
      isYookassaEnabled: Boolean(body.isYookassaEnabled),
    },
    create: {
      id: 1,
      isYookassaEnabled: Boolean(body.isYookassaEnabled),
    },
  });

  return NextResponse.json({
    success: true,
    settings,
  });
}