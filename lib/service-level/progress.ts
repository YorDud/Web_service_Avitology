/* Разбор ответа SocPublic о ходе выполнения задания (task_info).
   Структура ответа настраивается: админ задаёт списки ключей, по которым ищутся числа.
   Если нужных чисел в ответе нет — задание автоматически не завершаем (остаётся ручной контроль). */

export type ProgressKeys = {
  remaining: string[];
  ready: string[];
  started: string[];
  rework: string[];
  total: string[];
  paid: string[];
};

export type TaskProgress = {
  remaining: number | null;
  ready: number | null;
  started: number | null;
  rework: number | null;
  total: number | null;
  paid: number | null;
};

export function parseKeyList(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(/[,;\s]+/)
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+([.,]\d+)?$/.test(value.trim())) return Number(value.trim().replace(",", "."));
  return null;
}

/** Ищет в ответе (в ширину, с ограничением глубины) число по любому из ключей. */
export function findNumber(source: unknown, keys: string[], maxDepth = 5): number | null {
  if (!keys.length) return null;
  let level: unknown[] = [source];
  for (let depth = 0; depth <= maxDepth && level.length > 0; depth += 1) {
    const next: unknown[] = [];
    for (const node of level) {
      if (!node || typeof node !== "object") continue;
      const entries = Object.entries(node as Record<string, unknown>);
      for (const key of keys) {
        const hit = entries.find(([name]) => name.toLowerCase() === key);
        if (hit) {
          const number = toNumber(hit[1]);
          if (number !== null) return number;
        }
      }
      for (const [, child] of entries) if (child && typeof child === "object") next.push(child);
    }
    level = next;
  }
  return null;
}

export function extractProgress(info: unknown, keys: ProgressKeys): TaskProgress {
  return {
    remaining: findNumber(info, keys.remaining),
    ready: findNumber(info, keys.ready),
    started: findNumber(info, keys.started),
    rework: findNumber(info, keys.rework),
    total: findNumber(info, keys.total),
    paid: findNumber(info, keys.paid),
  };
}

/**
 * true — задание точно выполнено и проверено, false — ещё в работе,
 * null — по ответу понять нельзя (нужна ручная отметка в админке).
 */
export function isTaskComplete(progress: TaskProgress, quantity: number): boolean | null {
  if (progress.paid !== null && progress.paid >= quantity) return true;
  if (progress.remaining === null) return null;
  if (progress.remaining > 0) return false;
  const pending = [progress.ready, progress.started, progress.rework];
  if (pending.some((value) => value !== null && value > 0)) return false;
  // Заявок «на проверке» нет — но убеждаемся, что это известно, а не просто отсутствует в ответе.
  if (progress.ready === null) return null;
  return true;
}
