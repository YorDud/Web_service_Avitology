import { parseDateTimeLocal } from "@/lib/dates";
import {
  BONUS_TIERS,
  isValidBonusCodeFormat,
  normalizeBonusCode,
  type BonusTier,
} from "@/lib/bonus-codes";

export type BonusCodeInput = {
  code: string;
  tier: BonusTier;
  durationDays: number;
  isActive: boolean;
  maxUses: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  note: string | null;
};

export function parseBonusCodeInput(
  body: Record<string, unknown> | null,
): { data: BonusCodeInput } | { error: string } {
  if (!body) return { error: "Некорректные данные" };

  const code = normalizeBonusCode(body.code);

  if (!isValidBonusCodeFormat(code)) {
    return {
      error:
        "Код: 3–40 символов, только латиница, цифры, дефис и подчёркивание",
    };
  }

  const tier = String(body.tier ?? "") as BonusTier;

  if (!BONUS_TIERS.includes(tier)) {
    return { error: "Выберите тариф: Basic или Pro" };
  }

  const durationDays = Number(body.durationDays);

  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return { error: "Срок должен быть целым числом дней от 1 до 3650" };
  }

  let maxUses: number | null = null;

  if (body.maxUses !== null && body.maxUses !== undefined && body.maxUses !== "") {
    maxUses = Number(body.maxUses);

    if (!Number.isInteger(maxUses) || maxUses < 1) {
      return { error: "Лимит активаций — целое число от 1 (или пусто = без лимита)" };
    }
  }

  const validFrom = parseDateTimeLocal(body.validFrom);
  const validUntil = parseDateTimeLocal(body.validUntil);

  if (validFrom && validUntil && validUntil <= validFrom) {
    return { error: "Дата окончания действия кода должна быть позже даты начала" };
  }

  const note = body.note ? String(body.note).trim().slice(0, 300) || null : null;

  return {
    data: {
      code,
      tier,
      durationDays,
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      maxUses,
      validFrom,
      validUntil,
      note,
    },
  };
}
