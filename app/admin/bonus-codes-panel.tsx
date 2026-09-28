"use client";

import { useCallback, useEffect, useState } from "react";
import { formatForDateTimeLocal } from "@/lib/dates";

type Redemption = {
  id: number;
  redeemedAt: string;
  endsAt: string;
  user: {
    id: number;
    publicId: number | null;
    name: string;
    email: string;
  } | null;
};

type BonusCodeItem = {
  id: number;
  code: string;
  tier: "basic" | "pro";
  durationDays: number;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  note: string | null;
  createdAt: string;
  redemptions: Redemption[];
};

type Draft = {
  id: number | null;
  code: string;
  tier: "basic" | "pro";
  durationDays: string;
  maxUses: string;
  validFrom: string;
  validUntil: string;
  note: string;
  isActive: boolean;
};

const emptyDraft: Draft = {
  id: null,
  code: "",
  tier: "basic",
  durationDays: "7",
  maxUses: "",
  validFrom: "",
  validUntil: "",
  note: "",
  isActive: true,
};

const inputClass =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-black/35 focus:border-[#03bd48]";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDays(days: number) {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return `${days} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${days} дня`;
  return `${days} дней`;
}

function tierClass(tier: string) {
  return tier === "pro"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-sm font-bold text-black/65">{children}</label>
  );
}

export default function BonusCodesPanel() {
  const [codes, setCodes] = useState<BonusCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/bonus-codes", { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Не удалось загрузить бонус-коды");
      }

      setCodes(payload.codes as BonusCodeItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить бонус-коды");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(item: BonusCodeItem) {
    setError("");
    setMessage("");
    setDraft({
      id: item.id,
      code: item.code,
      tier: item.tier,
      durationDays: String(item.durationDays),
      maxUses: item.maxUses === null ? "" : String(item.maxUses),
      validFrom: formatForDateTimeLocal(item.validFrom),
      validUntil: formatForDateTimeLocal(item.validUntil),
      note: item.note ?? "",
      isActive: item.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetDraft() {
    setDraft(emptyDraft);
    setError("");
  }

  async function save() {
    setError("");
    setMessage("");

    try {
      setSaving(true);

      const isEdit = draft.id !== null;
      const response = await fetch(
        isEdit ? `/api/admin/bonus-codes/${draft.id}` : "/api/admin/bonus-codes",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: draft.code,
            tier: draft.tier,
            durationDays: Number(draft.durationDays),
            maxUses: draft.maxUses.trim() === "" ? null : Number(draft.maxUses),
            validFrom: draft.validFrom || null,
            validUntil: draft.validUntil || null,
            note: draft.note,
            isActive: draft.isActive,
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Не удалось сохранить бонус-код");
      }

      setMessage(isEdit ? "Бонус-код обновлён" : "Бонус-код создан");
      setDraft(emptyDraft);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить бонус-код");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: BonusCodeItem) {
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/bonus-codes/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: item.code,
        tier: item.tier,
        durationDays: item.durationDays,
        maxUses: item.maxUses,
        validFrom: formatForDateTimeLocal(item.validFrom) || null,
        validUntil: formatForDateTimeLocal(item.validUntil) || null,
        note: item.note,
        isActive: !item.isActive,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setError(payload?.error || "Не удалось изменить статус");
      return;
    }

    await load();
  }

  async function remove(item: BonusCodeItem) {
    if (!window.confirm(`Удалить бонус-код ${item.code}?`)) return;

    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/bonus-codes/${item.id}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setError(payload?.error || "Не удалось удалить бонус-код");
      return;
    }

    setMessage("Бонус-код удалён");
    await load();
  }

  const isEdit = draft.id !== null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-[#03bd48]/25 bg-[#03bd48]/10 px-5 py-4 text-sm font-semibold text-[#027a30]">
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
        <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
          Промокоды
        </div>
        <h2 className="text-3xl font-extrabold tracking-[-0.04em] md:text-4xl">
          Бонус-<span className="text-[#03bd48]">коды</span>
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
          Создавайте коды на любой тариф и любой срок. Каждый аккаунт может активировать
          конкретный код только один раз. Код на Basic нельзя активировать при действующей
          подписке Pro.
        </p>
      </section>

      <section className="white-card p-6 md:p-8">
        <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
          {isEdit ? `Редактирование: ${draft.code}` : "Новый бонус-код"}
        </h3>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Код</Label>
            <input
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              placeholder="HS3DBASIC"
              className={`${inputClass} font-mono uppercase tracking-wider`}
            />
          </div>

          <div>
            <Label>Тариф</Label>
            <select
              value={draft.tier}
              onChange={(e) => setDraft({ ...draft, tier: e.target.value as "basic" | "pro" })}
              className={inputClass}
            >
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
            </select>
          </div>

          <div>
            <Label>Срок подписки, дней</Label>
            <input
              type="number"
              min={1}
              max={3650}
              value={draft.durationDays}
              onChange={(e) => setDraft({ ...draft, durationDays: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <Label>Лимит активаций (пусто = без лимита)</Label>
            <input
              type="number"
              min={1}
              value={draft.maxUses}
              onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })}
              placeholder="Без лимита"
              className={inputClass}
            />
          </div>

          <div>
            <Label>Код действует с (необязательно)</Label>
            <input
              type="datetime-local"
              value={draft.validFrom}
              onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <Label>Код действует до (необязательно)</Label>
            <input
              type="datetime-local"
              value={draft.validUntil}
              onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Заметка (видна только админам)</Label>
            <input
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="Например: акция для блогера"
              className={inputClass}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              className="h-5 w-5 accent-[#03bd48]"
            />
            <span className="text-sm font-bold text-black/70">Код включён</span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Сохранение..." : isEdit ? "Сохранить изменения" : "Создать бонус-код"}
          </button>

          {isEdit && (
            <button type="button" onClick={resetDraft} className="btn-secondary">
              Отмена
            </button>
          )}
        </div>
      </section>

      <section className="white-card p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
            Все бонус-коды
          </h3>
          <div className="text-sm font-semibold text-black/45">{codes.length}</div>
        </div>

        {loading ? (
          <div className="mt-6 text-sm font-semibold text-black/45">Загрузка...</div>
        ) : codes.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-black/[0.03] p-6 text-sm font-semibold text-black/45">
            Бонус-кодов пока нет.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {codes.map((item) => {
              const expired = item.validUntil && new Date(item.validUntil) <= new Date();
              const exhausted = item.maxUses !== null && item.usedCount >= item.maxUses;
              const expanded = expandedId === item.id;

              return (
                <article
                  key={item.id}
                  className="rounded-3xl border border-black/10 bg-black/[0.015] p-5"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xl font-extrabold tracking-wider text-black">
                      {item.code}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-extrabold uppercase ${tierClass(item.tier)}`}
                    >
                      {item.tier}
                    </span>
                    <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-extrabold text-black/60">
                      {formatDays(item.durationDays)}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-extrabold ${
                        !item.isActive
                          ? "border-black/10 bg-black/[0.04] text-black/50"
                          : expired || exhausted
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]"
                      }`}
                    >
                      {!item.isActive
                        ? "Отключён"
                        : expired
                          ? "Срок истёк"
                          : exhausted
                            ? "Лимит исчерпан"
                            : "Активен"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl bg-white p-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-black/40">
                        Активаций
                      </div>
                      <div className="mt-1 font-extrabold text-black">
                        {item.usedCount}
                        {item.maxUses !== null ? ` / ${item.maxUses}` : " / ∞"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-black/40">
                        Действует с
                      </div>
                      <div className="mt-1 font-bold text-black">{formatDate(item.validFrom)}</div>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-black/40">
                        Действует до
                      </div>
                      <div className="mt-1 font-bold text-black">{formatDate(item.validUntil)}</div>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-black/40">
                        Заметка
                      </div>
                      <div className="mt-1 font-bold text-black">{item.note || "—"}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black transition hover:border-[#03bd48] hover:text-[#028c36]"
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(item)}
                      className="rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black transition hover:border-[#03bd48] hover:text-[#028c36]"
                    >
                      {item.isActive ? "Отключить" : "Включить"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black transition hover:border-[#03bd48] hover:text-[#028c36]"
                    >
                      {expanded ? "Скрыть активации" : `Активации (${item.usedCount})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-extrabold text-red-700 transition hover:bg-red-100"
                    >
                      Удалить
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-4 space-y-2">
                      {item.redemptions.length === 0 ? (
                        <div className="text-sm font-semibold text-black/45">
                          Этот код ещё никто не активировал.
                        </div>
                      ) : (
                        item.redemptions.map((r) => (
                          <div
                            key={r.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm"
                          >
                            <span className="font-bold text-black">
                              {r.user
                                ? `${r.user.name} · ${r.user.email}${r.user.publicId ? ` · ID ${r.user.publicId}` : ""}`
                                : "Пользователь удалён"}
                            </span>
                            <span className="text-black/50">
                              {formatDate(r.redeemedAt)} → до {formatDate(r.endsAt)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
