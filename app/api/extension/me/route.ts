import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return withCors(
        NextResponse.json({ authenticated: false, user: null })
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionLevel: true,
        subscriptionPrice: true,
        subscriptionPaidAt: true,
        subscriptionEndsAt: true,
        isActive: true,
      },
    });

    if (!user) {
      return withCors(
        NextResponse.json({ authenticated: false, user: null })
      );
    }

    return withCors(
      NextResponse.json({
        authenticated: true,
        user,
      })
    );
  } catch (error) {
    console.error("EXTENSION ME ERROR:", error);
    return withCors(
      NextResponse.json(
        { authenticated: false, user: null },
        { status: 500 }
      )
    );
  }
}