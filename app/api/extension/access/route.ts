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
        NextResponse.json({
          authenticated: false,
          access: false,
          reason: "not_authenticated",
        })
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (!user || !user.isActive) {
      return withCors(
        NextResponse.json({
          authenticated: false,
          access: false,
          reason: "inactive_user",
        })
      );
    }

    const hasAccess =
      user.subscriptionLevel === "basic" || user.subscriptionLevel === "admin";

    return withCors(
      NextResponse.json({
        authenticated: true,
        access: hasAccess,
        subscriptionLevel: user.subscriptionLevel,
        reason: hasAccess ? "ok" : "subscription_required",
      })
    );
  } catch (error) {
    console.error("EXTENSION ACCESS ERROR:", error);
    return withCors(
      NextResponse.json(
        {
          authenticated: false,
          access: false,
          reason: "server_error",
        },
        { status: 500 }
      )
    );
  }
}