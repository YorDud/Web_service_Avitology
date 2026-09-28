import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { parseBonusCodeInput } from "@/lib/bonus-codes-input";

export async function GET() {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const codes = await prisma.bonusCode.findMany({
      orderBy: { id: "desc" },
      include: {
        redemptions: {
          orderBy: { redeemedAt: "desc" },
          take: 50,
          include: {
            user: { select: { id: true, publicId: true, name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ codes });
  } catch (error) {
    console.error("BONUS CODES GET ERROR:", error);
    return NextResponse.json({ error: "Ошибка загрузки бонус-кодов" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    const parsed = parseBonusCodeInput(body);

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const created = await prisma.bonusCode.create({ data: parsed.data });

    return NextResponse.json({ success: true, code: created });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Такой код уже существует" }, { status: 400 });
    }

    console.error("BONUS CODES POST ERROR:", error);
    return NextResponse.json({ error: "Ошибка создания бонус-кода" }, { status: 500 });
  }
}
