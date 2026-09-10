import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { createBidderEvent } from "@/lib/avito-bidder-events";

const BASIC_ACTIVE_BIDDERS_LIMIT = 5;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BidderStatus = "active" | "paused" | "attention";
type BidderMode = "dry_run" | "live";

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

function isValidStatus(value: unknown): value is BidderStatus {
  return value === "active" || value === "paused" || value === "attention";
}

function isValidMode(value: unknown): value is BidderMode {
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

  return {
    user,
  };
}

async function getBidderId(context: RouteContext) {
  const { id: idValue } = await context.params;
  const id = Number(idValue);

  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  const id = await getBidderId(context);

  if (!id) {
    return NextResponse.json(
      { error: "Некорректный идентификатор бидера" },
      { status: 400 },
    );
  }

  const existingBidder = await prisma.avitoBidder.findFirst({
    where: {
      id,
      userId: authorization.user.id,
    },
  });

  if (!existingBidder) {
    return NextResponse.json(
      { error: "Бидер не найден" },
      { status: 404 },
    );
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
    status?: unknown;
    mode?: unknown;
    lastError?: unknown;
    lastCheckedAt?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный формат данных" },
      { status: 400 },
    );
  }

  const data: {
    title?: string;
    city?: string;
    query?: string;
    avitoItemId?: string | null;
    avitoItemUrl?: string | null;
    targetFrom?: number;
    targetTo?: number;
    minBid?: number;
    maxBid?: number;
    currentBid?: number;
    checkInterval?: number;
    schedule?: string;
    status?: BidderStatus;
    mode?: BidderMode;
    nextCheckAt?: Date | null;
    lastError?: string | null;
    lastCheckedAt?: Date | null;
  } = {};

  const eventMessages: string[] = [];
  let shouldWriteManualCheckSuccessEvent = false;
  let shouldWriteManualCheckErrorEvent = false;

  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title, 300)) {
      return NextResponse.json(
        { error: "Укажите корректное название объявления" },
        { status: 400 },
      );
    }

    data.title = body.title.trim();

    if (data.title !== existingBidder.title) {
      eventMessages.push(`Название изменено на «${data.title}».`);
    }
  }

  if (body.city !== undefined) {
    if (!isNonEmptyString(body.city, 120)) {
      return NextResponse.json(
        { error: "Укажите корректный город" },
        { status: 400 },
      );
    }

    data.city = body.city.trim();

    if (data.city !== existingBidder.city) {
      eventMessages.push(`Город изменён: ${data.city}.`);
    }
  }

  if (body.query !== undefined) {
    if (!isNonEmptyString(body.query, 300)) {
      return NextResponse.json(
        { error: "Укажите корректный поисковый запрос" },
        { status: 400 },
      );
    }

    data.query = body.query.trim();

    if (data.query !== existingBidder.query) {
      eventMessages.push(`Поисковый запрос изменён: ${data.query}.`);
    }
  }

  if (body.avitoItemId !== undefined) {
    data.avitoItemId =
      typeof body.avitoItemId === "string" && body.avitoItemId.trim().length > 0
        ? body.avitoItemId.trim()
        : null;

    if (data.avitoItemId !== existingBidder.avitoItemId) {
      eventMessages.push(
        data.avitoItemId
          ? `Привязано объявление Avito ID ${data.avitoItemId}.`
          : "Привязка к объявлению Авито удалена.",
      );
    }
  }

  if (body.avitoItemUrl !== undefined) {
    data.avitoItemUrl =
      typeof body.avitoItemUrl === "string" &&
      body.avitoItemUrl.trim().length > 0
        ? body.avitoItemUrl.trim()
        : null;
  }

  if (body.mode !== undefined) {
    if (!isValidMode(body.mode)) {
      return NextResponse.json(
        { error: "Некорректный режим бидера" },
        { status: 400 },
      );
    }

    data.mode = body.mode;

    if (data.mode !== existingBidder.mode) {
      eventMessages.push(
        data.mode === "live"
          ? "Режим работы переключён в live."
          : "Режим работы переключён в dry-run.",
      );
    }
  }

  if (body.lastError !== undefined) {
    data.lastError =
      typeof body.lastError === "string" && body.lastError.trim().length > 0
        ? body.lastError.trim()
        : null;

    if (data.lastError) {
      shouldWriteManualCheckErrorEvent = true;
    } else if (body.lastCheckedAt !== undefined) {
      shouldWriteManualCheckSuccessEvent = true;
    }
  }

  if (body.lastCheckedAt !== undefined) {
    if (body.lastCheckedAt === null) {
      data.lastCheckedAt = null;
    } else if (
      typeof body.lastCheckedAt === "string" &&
      !Number.isNaN(Date.parse(body.lastCheckedAt))
    ) {
      data.lastCheckedAt = new Date(body.lastCheckedAt);
    } else {
      return NextResponse.json(
        { error: "Некорректная дата последней проверки" },
        { status: 400 },
      );
    }
  }

  const targetFrom =
    body.targetFrom === undefined ? existingBidder.targetFrom : body.targetFrom;

  const targetTo =
    body.targetTo === undefined ? existingBidder.targetTo : body.targetTo;

  if (body.targetFrom !== undefined || body.targetTo !== undefined) {
    if (
      !isPositiveInteger(targetFrom) ||
      !isPositiveInteger(targetTo) ||
      targetFrom > targetTo
    ) {
      return NextResponse.json(
        { error: "Укажите корректный диапазон целевых позиций" },
        { status: 400 },
      );
    }

    data.targetFrom = targetFrom;
    data.targetTo = targetTo;

    if (
      targetFrom !== existingBidder.targetFrom ||
      targetTo !== existingBidder.targetTo
    ) {
      eventMessages.push(`Целевой диапазон изменён: ${targetFrom}–${targetTo}.`);
    }
  }

  const minBid =
    body.minBid === undefined ? existingBidder.minBid : body.minBid;

  const maxBid =
    body.maxBid === undefined ? existingBidder.maxBid : body.maxBid;

  if (body.minBid !== undefined || body.maxBid !== undefined) {
    if (
      !isNonNegativeInteger(minBid) ||
      !isNonNegativeInteger(maxBid) ||
      minBid > maxBid
    ) {
      return NextResponse.json(
        { error: "Укажите корректный диапазон ставок" },
        { status: 400 },
      );
    }

    data.minBid = minBid;
    data.maxBid = maxBid;
    data.currentBid = Math.min(
      Math.max(existingBidder.currentBid, minBid),
      maxBid,
    );

    if (minBid !== existingBidder.minBid || maxBid !== existingBidder.maxBid) {
      eventMessages.push(`Лимиты ставок изменены: ${minBid}–${maxBid} ₽.`);
    }
  }

  if (body.checkInterval !== undefined) {
    if (!isValidCheckInterval(body.checkInterval)) {
      return NextResponse.json(
        { error: "Выберите корректный интервал проверки" },
        { status: 400 },
      );
    }

    data.checkInterval = body.checkInterval;

    if (data.checkInterval !== existingBidder.checkInterval) {
      eventMessages.push(
        `Интервал проверки изменён: ${data.checkInterval} мин.`,
      );
    }
  }

  if (body.schedule !== undefined) {
    if (!isNonEmptyString(body.schedule, 200)) {
      return NextResponse.json(
        { error: "Укажите корректное расписание" },
        { status: 400 },
      );
    }

    data.schedule = body.schedule.trim();

    if (data.schedule !== existingBidder.schedule) {
      eventMessages.push(`Расписание изменено: ${data.schedule}.`);
    }
  }

  if (body.status !== undefined) {
    if (!isValidStatus(body.status)) {
      return NextResponse.json(
        { error: "Некорректный статус бидера" },
        { status: 400 },
      );
    }

    if (
      body.status === "active" &&
      existingBidder.status !== "active" &&
      authorization.user.subscriptionLevel === "basic"
    ) {
      const activeBiddersCount = await prisma.avitoBidder.count({
        where: {
          userId: authorization.user.id,
          status: "active",
          id: {
            not: id,
          },
        },
      });

      if (activeBiddersCount >= BASIC_ACTIVE_BIDDERS_LIMIT) {
        return NextResponse.json(
          {
            error: `На подписке Basic доступно не более ${BASIC_ACTIVE_BIDDERS_LIMIT} активных бидеров.`,
          },
          { status: 403 },
        );
      }
    }

    data.status = body.status;

    if (body.status === "active") {
      const interval = data.checkInterval ?? existingBidder.checkInterval;
      data.nextCheckAt = getNextCheckAt(interval);
    }

    if (body.status === "paused") {
      data.nextCheckAt = null;
    }

    if (body.status !== existingBidder.status) {
      eventMessages.push(`Статус изменён: ${body.status}.`);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Нет данных для обновления" },
      { status: 400 },
    );
  }

  const bidder = await prisma.avitoBidder.update({
    where: {
      id,
    },
    data,
  });

  for (const message of eventMessages) {
    await createBidderEvent({
      bidderId: bidder.id,
      type: "bidder_updated",
      message,
    });
  }

  if (shouldWriteManualCheckSuccessEvent) {
    await createBidderEvent({
      bidderId: bidder.id,
      type: "manual_check_success",
      message: `Объявление «${bidder.title}» успешно проверено.`,
    });
  }

  if (shouldWriteManualCheckErrorEvent) {
    await createBidderEvent({
      bidderId: bidder.id,
      type: "manual_check_error",
      message: bidder.lastError || "Ошибка ручной проверки объявления.",
    });
  }

  return NextResponse.json({
    bidder: serializeBidder(bidder),
  });
}

export async function DELETE(_: Request, context: RouteContext) {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  const id = await getBidderId(context);

  if (!id) {
    return NextResponse.json(
      { error: "Некорректный идентификатор бидера" },
      { status: 400 },
    );
  }

  const existingBidder = await prisma.avitoBidder.findFirst({
    where: {
      id,
      userId: authorization.user.id,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!existingBidder) {
    return NextResponse.json(
      { error: "Бидер не найден" },
      { status: 404 },
    );
  }

  await createBidderEvent({
    bidderId: existingBidder.id,
    type: "bidder_deleted",
    message: `Бидер «${existingBidder.title}» удалён.`,
  });

  await prisma.avitoBidder.delete({
    where: {
      id,
    },
  });

  return NextResponse.json({
    success: true,
    deletedBidderId: id,
  });
}