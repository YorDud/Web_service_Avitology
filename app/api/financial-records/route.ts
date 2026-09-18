import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

function hasFinancialAccess(level: string | null | undefined) {
  return level === "basic" || level === "pro" || level === "admin";
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

function normalizeRecordName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export async function GET() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Требуется авторизация" },
      { status: 401 },
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
      { error: "Финансовый анализ доступен с подпиской Basic" },
      { status: 403 },
    );
  }

  const records = await prisma.financialRecord.findMany({
    where: {
      userId: sessionUser.id,
    },
    orderBy: [
      {
        recordDate: "desc",
      },
      {
        id: "desc",
      },
    ],
  });

  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Требуется авторизация" },
      { status: 401 },
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
      { error: "Финансовый анализ доступен с подпиской Basic" },
      { status: 403 },
    );
  }

  let body: {
    recordDate?: unknown;
    name?: unknown;
    income?: unknown;
    expense?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный формат данных" },
      { status: 400 },
    );
  }

  if (!isValidDate(body.recordDate)) {
    return NextResponse.json(
      { error: "Укажите корректную дату" },
      { status: 400 },
    );
  }

  if (!isValidMoney(body.income) || !isValidMoney(body.expense)) {
    return NextResponse.json(
      { error: "Доходы и расходы должны быть целыми неотрицательными числами" },
      { status: 400 },
    );
  }

  // Важно: create, а не upsert.
  // Поэтому можно добавлять несколько независимых строк на одну дату.
  const record = await prisma.financialRecord.create({
    data: {
      userId: sessionUser.id,
      recordDate: body.recordDate,
      name: normalizeRecordName(body.name),
      income: body.income,
      expense: body.expense,
    },
  });

  return NextResponse.json({ record }, { status: 201 });
}