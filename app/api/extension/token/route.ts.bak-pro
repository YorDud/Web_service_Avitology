import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function hasAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return withCors(
      NextResponse.json({ error: "Требуется авторизация" }, { status: 401 })
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      isActive: true,
      subscriptionLevel: true,
      extensionApiToken: true,
    },
  });

  if (!user || !user.isActive || !hasAccess(user.subscriptionLevel)) {
    return withCors(
      NextResponse.json({ error: "Нужна подписка Basic" }, { status: 403 })
    );
  }

  let token = user.extensionApiToken;

  if (!token) {
    token = `avx_${randomBytes(32).toString("hex")}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { extensionApiToken: token },
    });
  }

  return withCors(NextResponse.json({ token }));
}

export async function POST() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return withCors(
      NextResponse.json({ error: "Требуется авторизация" }, { status: 401 })
    );
  }

  const token = `avx_${randomBytes(32).toString("hex")}`;

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { extensionApiToken: token },
  });

  return withCors(NextResponse.json({ token }));
}