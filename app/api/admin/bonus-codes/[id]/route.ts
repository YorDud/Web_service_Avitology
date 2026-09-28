import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { parseBonusCodeInput } from "@/lib/bonus-codes-input";

type Params = { params: Promise<{ id: string }> };

async function readId(params: Params["params"]) {
  const { id } = await params;
  const numeric = Number(id);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const id = await readId(params);
    if (!id) {
      return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = parseBonusCodeInput(body);

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const current = await prisma.bonusCode.findUnique({ where: { id } });

    if (!current) {
      return NextResponse.json({ error: "Бонус-код не найден" }, { status: 404 });
    }

    if (parsed.data.maxUses !== null && parsed.data.maxUses < current.usedCount) {
      return NextResponse.json(
        {
          error: `Лимит не может быть меньше уже использованных активаций (${current.usedCount})`,
        },
        { status: 400 },
      );
    }

    const updated = await prisma.bonusCode.update({ where: { id }, data: parsed.data });

    return NextResponse.json({ success: true, code: updated });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Такой код уже существует" }, { status: 400 });
    }

    console.error("BONUS CODES PATCH ERROR:", error);
    return NextResponse.json({ error: "Ошибка сохранения бонус-кода" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const id = await readId(params);
    if (!id) {
      return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
    }

    const used = await prisma.bonusCodeRedemption.count({ where: { codeId: id } });

    if (used > 0) {
      return NextResponse.json(
        {
          error:
            "Код уже активировали пользователи — удалить нельзя, чтобы не потерять историю. Отключите его.",
        },
        { status: 400 },
      );
    }

    await prisma.bonusCode.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("BONUS CODES DELETE ERROR:", error);
    return NextResponse.json({ error: "Ошибка удаления бонус-кода" }, { status: 500 });
  }
}
