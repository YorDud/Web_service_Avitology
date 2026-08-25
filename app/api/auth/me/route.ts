import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
  id: true,
  publicId: true,
  email: true,
  name: true,
  subscriptionLevel: true,
  subscriptionPrice: true,
  subscriptionPaidAt: true,
  subscriptionEndsAt: true,
  createdAt: true,
  lastLoginAt: true,
  isActive: true,
},
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("ME ERROR:", error);
    return NextResponse.json({ user: null });
  }
}