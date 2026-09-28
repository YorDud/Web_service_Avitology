import type { ScheduleRule } from "./types";

/* Расписание автозагрузки Авито: время московское (UTC+3, без перехода на летнее время). */

const MSK_OFFSET = 3 * 3600 * 1000;
const HOUR = 3600 * 1000;
export const DAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const pad = (value: number) => String(value).padStart(2, "0");

function mskParts(timestamp: number) {
  const date = new Date(timestamp + MSK_OFFSET);
  return {
    weekday: (date.getUTCDay() + 6) % 7, // 0 — понедельник, как в API Авито
    hour: date.getUTCHours(),
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

export type ScheduleSlot = { start: number; end: number; label: string; current: boolean };

function slotLabel(start: number, now: number) {
  const slot = mskParts(start);
  const today = mskParts(now);
  const diff = Math.round((Date.UTC(slot.year, slot.month, slot.day) - Date.UTC(today.year, today.month, today.day)) / 86_400_000);
  const day = diff === 0 ? "сегодня" : diff === 1 ? "завтра" : DAY_SHORT[slot.weekday];
  return `${day}, ${pad(slot.hour)}:00–${pad((slot.hour + 1) % 24)}:00`;
}

/** Ближайшие окна запуска (включая текущий час, если он подходит). */
export function nextSlots(schedule: ScheduleRule[], count = 3, now = Date.now()): ScheduleSlot[] {
  const hourStart = Math.floor((now + MSK_OFFSET) / HOUR) * HOUR - MSK_OFFSET;
  const result: ScheduleSlot[] = [];
  for (let i = 0; i < 24 * 8 && result.length < count; i += 1) {
    const start = hourStart + i * HOUR;
    const { weekday, hour } = mskParts(start);
    if (schedule.some((rule) => rule.weekdays.includes(weekday) && rule.time_slots.includes(hour))) {
      result.push({ start, end: start + HOUR, label: slotLabel(start, now), current: i === 0 });
    }
  }
  return result;
}

function daysText(days: number[]) {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return "каждый день";
  if (sorted.join() === "0,1,2,3,4") return "по будням";
  if (sorted.join() === "5,6") return "по выходным";
  return sorted.map((day) => DAY_SHORT[day]).join(", ");
}

function hoursText(hours: number[]) {
  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  if (sorted.length <= 3) return sorted.map((hour) => `${pad(hour)}:00`).join(", ");
  const n = sorted.length;
  const word = n % 10 === 1 && n % 100 !== 11 ? "окно" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "окна" : "окон";
  return `${n} ${word} в день`;
}

/** Короткое описание расписания: «каждый день, 03:00; по будням, 09:00, 18:00». */
export function describeSchedule(schedule: ScheduleRule[]): string {
  if (schedule.length === 0) return "расписание не задано";
  return schedule.map((rule) => `${daysText(rule.weekdays)}, ${hoursText(rule.time_slots)}`).join("; ");
}

/** Откуда пришла загрузка (поле source из API Авито). */
export function sourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "Url":
      return "по ссылке (расписание)";
    case "OpenAPI":
      return "кнопка «Запустить сейчас»";
    case "Web":
      return "вручную в кабинете Авито";
    case "Email":
      return "по почте";
    default:
      return source || "—";
  }
}
