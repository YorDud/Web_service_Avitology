/* Выбор актуальной загрузки Авито: чистая функция без зависимостей (проще тестировать). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export type PickChoice = { which: "current" | "last"; raw: Json; stale: boolean } | null;

const idOf = (raw: Json | null) => (raw ? String(raw.upload_id) : null);

/**
 * latest — самая свежая загрузка из истории; current / last — ответы /uploads/current и
 * /uploads/last_successful (last_successful у Авито может отставать от истории).
 */
export function choosePickSource(latest: Json | null, current: Json | null, last: Json | null): PickChoice {
  const latestId = idOf(latest);
  let which: "current" | "last";
  let raw: Json;

  if (current && (!latestId || idOf(current) === latestId)) {
    which = "current";
    raw = current;
  } else if (last && idOf(last) === latestId) {
    which = "last";
    raw = last;
  } else if (current) {
    which = "current";
    raw = current;
  } else if (last) {
    which = "last";
    raw = last;
  } else {
    return null;
  }

  return { which, raw, stale: Boolean(latestId && idOf(raw) !== latestId) };
}
