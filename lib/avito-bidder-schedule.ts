const DAY_MAP: Record<string, number> = {
  вс: 0,
  воскресенье: 0,

  пн: 1,
  понедельник: 1,

  вт: 2,
  вторник: 2,

  ср: 3,
  среда: 3,

  чт: 4,
  четверг: 4,

  пт: 5,
  пятница: 5,

  сб: 6,
  суббота: 6,
};

export type ParsedBidderSchedule = {
  raw: string;
  days: number[] | null;
  startMinutes: number;
  endMinutes: number;
};

function normalizeSchedule(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTimeToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function parseDaysPart(value: string): number[] | null {
  const normalized = normalizeSchedule(value);

  if (
    !normalized ||
    normalized.includes("ежедневно") ||
    normalized.includes("каждый день") ||
    normalized.includes("ежедн")
  ) {
    return null;
  }

  const parts = normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const result = new Set<number>();

  for (const part of parts) {
    if (part.includes("-")) {
      const [fromRaw, toRaw] = part.split("-").map((item) => item.trim());

      const from = DAY_MAP[fromRaw];
      const to = DAY_MAP[toRaw];

      if (from === undefined || to === undefined) {
        continue;
      }

      if (from <= to) {
        for (let day = from; day <= to; day += 1) {
          result.add(day);
        }
      } else {
        for (let day = from; day <= 6; day += 1) {
          result.add(day);
        }

        for (let day = 0; day <= to; day += 1) {
          result.add(day);
        }
      }

      continue;
    }

    const mapped = DAY_MAP[part];

    if (mapped !== undefined) {
      result.add(mapped);
    }
  }

  return result.size > 0 ? [...result].sort((a, b) => a - b) : null;
}

/**
 * Поддерживаемые форматы:
 *
 * - Ежедневно, 09:00–22:00
 * - Каждый день, 10:00-20:00
 * - Пн-Пт, 08:00–19:30
 * - Пн,Ср,Пт, 09:00–18:00
 * - 09:00–22:00
 */
export function parseBidderSchedule(
  value: string,
): ParsedBidderSchedule | null {
  const normalized = normalizeSchedule(value);

  if (!normalized) {
    return null;
  }

  const timeMatch = normalized.match(
    /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/,
  );

  if (!timeMatch) {
    return null;
  }

  const startMinutes = parseTimeToMinutes(timeMatch[1]);
  const endMinutes = parseTimeToMinutes(timeMatch[2]);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  const matchIndex = timeMatch.index ?? 0;

  const daysPart = normalized
    .slice(0, matchIndex)
    .replace(/[, ]+$/, "")
    .trim();

  return {
    raw: value,
    days: daysPart ? parseDaysPart(daysPart) : null,
    startMinutes,
    endMinutes,
  };
}

/**
 * true, если прямо сейчас bidder имеет право работать.
 *
 * Если расписание не распознано — возвращаем true.
 * Это deliberate fail-open поведение: неверное старое расписание
 * не должно неожиданно остановить все существующие бидеры.
 */
export function isTimeWithinBidderSchedule(
  schedule: string,
  now = new Date(),
): boolean {
  const parsed = parseBidderSchedule(schedule);

  if (!parsed) {
    return true;
  }

  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (parsed.days && !parsed.days.includes(day)) {
    return false;
  }

  // Обычное окно в рамках одного дня: 09:00–22:00
  if (parsed.startMinutes <= parsed.endMinutes) {
    return (
      minutes >= parsed.startMinutes && minutes <= parsed.endMinutes
    );
  }

  // Ночное окно, например: 22:00–03:00
  return minutes >= parsed.startMinutes || minutes <= parsed.endMinutes;
}

/**
 * Возвращает начало следующего рабочего окна.
 *
 * Например:
 * - сейчас 23:15
 * - расписание Ежедневно, 09:00–22:00
 * - результат: завтра 09:00
 */
export function getNextScheduleStart(
  schedule: string,
  now = new Date(),
): Date | null {
  const parsed = parseBidderSchedule(schedule);

  if (!parsed) {
    return null;
  }

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);

    candidate.setHours(0, 0, 0, 0);
    candidate.setDate(candidate.getDate() + offset);

    const candidateDay = candidate.getDay();

    if (parsed.days && !parsed.days.includes(candidateDay)) {
      continue;
    }

    const result = new Date(candidate);

    result.setHours(
      Math.floor(parsed.startMinutes / 60),
      parsed.startMinutes % 60,
      0,
      0,
    );

    if (result.getTime() > now.getTime()) {
      return result;
    }
  }

  return null;
}

/**
 * Удобное описание для UI/логов.
 */
export function getBidderScheduleStatus(
  schedule: string,
  now = new Date(),
) {
  const parsed = parseBidderSchedule(schedule);

  if (!parsed) {
    return {
      valid: false,
      allowedNow: true,
      nextStartAt: null as Date | null,
      message:
        "Расписание не распознано. Для совместимости bidder работает без ограничения по времени.",
    };
  }

  const allowedNow = isTimeWithinBidderSchedule(schedule, now);

  return {
    valid: true,
    allowedNow,
    nextStartAt: allowedNow ? null : getNextScheduleStart(schedule, now),
    message: allowedNow
      ? "Текущее время находится внутри рабочего окна."
      : "Текущее время находится вне рабочего окна.",
  };
}