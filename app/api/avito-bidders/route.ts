import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { createBidderEvent } from "@/lib/avito-bidder-events";

function hasBidderAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

function isNonEmptyString(value: unknown, maxLength = 300): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value > 0
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function isValidCheckInterval(value: unknown): value is number {
  return isPositiveInteger(value) && [5, 10, 15, 30, 60].includes(value);
}

function isValidBidderMode(value: unknown): value is "dry_run" | "live" {
  return value === "dry_run" || value === "live";
}

function getNextCheckAt(intervalMinutes: number) {
  return new Date(Date.now() + intervalMinutes * 60 * 1000);
}

function serializeBidder(bidder: {
  id: number;
  title: string;
  city: string;
  query: string;
  avitoItemId: string | null;
  avitoItemUrl: string | null;
  targetFrom: number;
  targetTo: number;
  currentPosition: number | null;
  currentBid: number;
  minBid: number;
  maxBid: number;
  checkInterval: number;
  schedule: string;
  status: string;
  mode: string;
  changesToday: number;
  nextCheckAt: Date | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...bidder,
    nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null,
    lastCheckedAt: bidder.lastCheckedAt?.toISOString() ?? null,
    createdAt: bidder.createdAt.toISOString(),
    updatedAt: bidder.updatedAt.toISOString(),
  };
}

async function getAuthorizedUser() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return {
      error: NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      subscriptionLevel: true,
    },
  });

  if (!user || !hasBidderAccess(user.subscriptionLevel)) {
    return {
      error: NextResponse.json(
        { error: "Бид-менеджер доступен с подпиской Basic" },
        { status: 403 },
      ),
    };
  }

  return { user };
}

export async function GET() {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  const bidders = await prisma.avitoBidder.findMany({
    where: {
      userId: authorization.user.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return NextResponse.json({
    bidders: bidders.map(serializeBidder),
  });
}

export async function POST(request: Request) {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  let body: {
    title?: unknown;
    city?: unknown;
    query?: unknown;
    avitoItemId?: unknown;
    avitoItemUrl?: unknown;
    targetFrom?: unknown;
    targetTo?: unknown;
    minBid?: unknown;
    maxBid?: unknown;
    checkInterval?: unknown;
    schedule?: unknown;
    mode?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный формат данных" },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body.title, 300)) {
    return NextResponse.json(
      { error: "Укажите корректное название объявления" },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body.city, 120)) {
    return NextResponse.json(
      { error: "Укажите корректный город" },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body.query, 300)) {
    return NextResponse.json(
      { error: "Укажите корректный поисковый запрос" },
      { status: 400 },
    );
  }

  const avitoItemId =
    typeof body.avitoItemId === "string" && body.avitoItemId.trim().length > 0
      ? body.avitoItemId.trim()
      : null;

  const avitoItemUrl =
    typeof body.avitoItemUrl === "string" && body.avitoItemUrl.trim().length > 0
      ? body.avitoItemUrl.trim()
      : null;

  if (!avitoItemId) {
    return NextResponse.json(
      { error: "Выберите реальное объявление Авито." },
      { status: 400 },
    );
  }

  if (
    !isPositiveInteger(body.targetFrom) ||
    !isPositiveInteger(body.targetTo) ||
    body.targetFrom > body.targetTo
  ) {
    return NextResponse.json(
      { error: "Укажите корректный диапазон целевых позиций" },
      { status: 400 },
    );
  }

  if (
    !isNonNegativeInteger(body.minBid) ||
    !isNonNegativeInteger(body.maxBid) ||
    body.minBid > body.maxBid
  ) {
    return NextResponse.json(
      { error: "Укажите корректный диапазон ставок" },
      { status: 400 },
    );
  }

  if (!isValidCheckInterval(body.checkInterval)) {
    return NextResponse.json(
      { error: "Выберите корректный интервал проверки" },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body.schedule, 200)) {
    return NextResponse.json(
      { error: "Укажите корректное расписание" },
      { status: 400 },
    );
  }

  const mode = isValidBidderMode(body.mode) ? body.mode : "dry_run";

  const bidder = await prisma.avitoBidder.create({
    data: {
      userId: authorization.user.id,
      title: body.title.trim(),
      city: body.city.trim(),
      query: body.query.trim(),
      avitoItemId,
      avitoItemUrl,
      targetFrom: body.targetFrom,
      targetTo: body.targetTo,
      currentBid: body.minBid,
      minBid: body.minBid,
      maxBid: body.maxBid,
      checkInterval: body.checkInterval,
      schedule: body.schedule.trim(),
      status: "paused",
      mode,
      nextCheckAt: getNextCheckAt(body.checkInterval),
    },
  });

  await createBidderEvent({
    bidderId: bidder.id,
    type: "bidder_created",
    message: `Создан бидер «${bidder.title}» в режиме ${bidder.mode}.`,
  });

  return NextResponse.json(
    {
      bidder: serializeBidder(bidder),
    },
    { status: 201 },
  );
}