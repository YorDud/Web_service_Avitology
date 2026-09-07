import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function hasFinancialAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
  );
}

function isValidMoney(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

async function getAuthorizedRecord(id: number, userId: number) {
  const record = await prisma.financialRecord.findUnique({
    where: { id },
  });

  if (!record || record.userId !== userId) {
    return null;
  }

  return record;
}

export async function PATCH(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Требуется авторизация" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      subscriptionLevel: true,
    },
  });

  if (!user || !hasFinancialAccess(user.subscriptionLevel)) {
    return NextResponse.json(
      { error: "Недостаточно прав доступа" },
      { status: 403 }
    );
  }

  const { id: idValue } = await context.params;
  const id = Number(idValue);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Некорректный идентификатор записи" },
      { status: 400 }
    );
  }

  const existingRecord = await getAuthorizedRecord(id, sessionUser.id);

  if (!existingRecord) {
    return NextResponse.json(
      { error: "Запись не найдена" },
      { status: 404 }
    );
  }

  let body: {
    recordDate?: unknown;
    income?: unknown;
    expense?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный формат данных" },
      { status: 400 }
    );
  }

  if (!isValidDate(body.recordDate)) {
    return NextResponse.json(
      { error: "Укажите корректную дату" },
      { status: 400 }
    );
  }

  if (!isValidMoney(body.income) || !isValidMoney(body.expense)) {
    return NextResponse.json(
      { error: "Доходы и расходы должны быть целыми неотрицательными числами" },
      { status: 400 }
    );
  }

  try {
    const record = await prisma.financialRecord.update({
      where: { id },
      data: {
        recordDate: body.recordDate,
        income: body.income,
        expense: body.expense,
      },
    });

    return NextResponse.json({ record });
  } catch {
    return NextResponse.json(
      {
        error:
          "Нельзя сохранить запись: на эту дату уже существует финансовая запись",
      },
      { status: 409 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Требуется авторизация" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      subscriptionLevel: true,
    },
  });

  if (!user || !hasFinancialAccess(user.subscriptionLevel)) {
    return NextResponse.json(
      { error: "Недостаточно прав доступа" },
      { status: 403 }
    );
  }

  const { id: idValue } = await context.params;
  const id = Number(idValue);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Некорректный идентификатор записи" },
      { status: 400 }
    );
  }

  const existingRecord = await getAuthorizedRecord(id, sessionUser.id);

  if (!existingRecord) {
    return NextResponse.json(
      { error: "Запись не найдена" },
      { status: 404 }
    );
  }

  await prisma.financialRecord.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}