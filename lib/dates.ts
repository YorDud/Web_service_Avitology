export function formatRuDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatForDateTimeLocal(
  value: Date | string | null | undefined
) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function parseDateTimeLocal(value: unknown) {
  if (!value) return null;

  const text = String(value).trim();

  if (!text) return null;

  const normalized = text.length === 16 ? `${text}:00` : text;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}