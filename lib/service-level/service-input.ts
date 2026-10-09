import { EXECUTION_TIME_OPTIONS } from "./defaults";
import { validateTemplate } from "./template";

/* Проверка данных услуги из админки (создание и редактирование). */

export type ServiceInput = {
  title: string;
  summary: string;
  guide: string;
  emoji: string;
  sortOrder: number;
  isActive: boolean;
  pricePerUnit: number;
  minQuantity: number;
  maxQuantity: number;
  taskTitle: string;
  numberSingleLink: boolean;
  taskDescription: string;
  confirmInfo: string;
  reward: number;
  executionMinutes: number;
  payloadTemplate: string;
};

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Минимальная оплата исполнителю на SocPublic (в форме создания задания: «Минимум 1.8 руб.»). */
export const MIN_REWARD = 1.8;

export function parseServiceInput(body: unknown, current?: Partial<ServiceInput>): { data: ServiceInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Пустой запрос." };
  const input = body as Record<string, unknown>;
  const pick = <K extends keyof ServiceInput>(key: K, fallback: ServiceInput[K]): unknown => (input[key] !== undefined ? input[key] : (current?.[key] ?? fallback));

  const title = text(pick("title", ""), 120);
  if (!title) return { error: "Укажите название услуги." };

  const pricePerUnit = Math.round(Number(pick("pricePerUnit", 25)));
  if (!Number.isFinite(pricePerUnit) || pricePerUnit < 1 || pricePerUnit > 100000) return { error: "Цена за одно выполнение — целое число рублей от 1 до 100 000." };

  const minQuantity = Math.round(Number(pick("minQuantity", 15)));
  const maxQuantity = Math.round(Number(pick("maxQuantity", 500)));
  if (!Number.isFinite(minQuantity) || minQuantity < 1 || minQuantity > 100000) return { error: "Минимальное количество — от 1 до 100 000." };
  if (!Number.isFinite(maxQuantity) || maxQuantity < minQuantity || maxQuantity > 100000) return { error: "Максимальное количество должно быть не меньше минимального." };

  const reward = Number(String(pick("reward", 5)).replace(",", "."));
  if (!Number.isFinite(reward) || reward < MIN_REWARD || reward > 100000) return { error: `Оплата исполнителю — от ${MIN_REWARD} ₽ (минимум SocPublic).` };

  const executionMinutes = Math.round(Number(pick("executionMinutes", 7200)));
  if (!EXECUTION_TIME_OPTIONS.some((option) => option.minutes === executionMinutes)) return { error: "Выберите время на выполнение из списка." };

  const taskTitle = text(pick("taskTitle", ""), 140);
  if (!taskTitle) return { error: "Укажите шаблон названия задания на SocPublic." };

  const payloadTemplate = typeof pick("payloadTemplate", "") === "string" ? String(pick("payloadTemplate", "")).trim() : "";
  const templateCheck = validateTemplate(payloadTemplate);
  if (!templateCheck.ok) return { error: `Шаблон создания задания: ${templateCheck.error}` };

  const taskDescription = text(pick("taskDescription", ""), 8000);
  if (!taskDescription) return { error: "Укажите описание задания для исполнителей." };
  const confirmInfo = text(pick("confirmInfo", ""), 4000);
  if (!confirmInfo) return { error: "Укажите, что исполнитель должен приложить для подтверждения." };

  return {
    data: {
      title,
      summary: text(pick("summary", ""), 400),
      guide: text(pick("guide", ""), 6000),
      emoji: text(pick("emoji", "⭐"), 8) || "⭐",
      sortOrder: Math.round(Number(pick("sortOrder", 0))) || 0,
      isActive: Boolean(pick("isActive", true)),
      pricePerUnit,
      minQuantity,
      maxQuantity,
      taskTitle,
      numberSingleLink: Boolean(pick("numberSingleLink", true)),
      taskDescription,
      confirmInfo,
      reward: Math.round(reward * 100) / 100,
      executionMinutes,
      payloadTemplate,
    },
  };
}
