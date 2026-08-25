import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser || sessionUser.subscriptionLevel !== "admin") {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();

    const publicIdQuery = Number(q);
const isPublicIdSearch = q !== "" && !Number.isNaN(publicIdQuery);

const users = await prisma.user.findMany({
  where: q
    ? {
        OR: [
          { email: { contains: q } },
          { name: { contains: q } },
          { notes: { contains: q } },
          ...(isPublicIdSearch ? [{ publicId: publicIdQuery }] : []),
        ],
      }
    : undefined,
  orderBy: { id: "asc" },
});

    return NextResponse.json({ users });
  } catch (error) {
    console.error("ADMIN USERS GET ERROR:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки пользователей" },
      { status: 500 }
    );
  }
}