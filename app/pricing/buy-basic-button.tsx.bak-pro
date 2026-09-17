"use client";

import Link from "next/link";
import { useState } from "react";

type PlanCode = "1m" | "3m" | "6m";

type Props = {
  isYookassaEnabled: boolean;
  canUseFreeTrial: boolean;
  isFreeTrialEnabled: boolean;
};

export default function BuyBasicButton({
  isYookassaEnabled,
  canUseFreeTrial,
  isFreeTrialEnabled,
}: Props) {
  const [loadingPlan, setLoadingPlan] = useState<PlanCode | "trial" | null>(null);
  const [error, setError] = useState("");

  async function handleBuyBasic(planCode: PlanCode) {
    try {
      setLoadingPlan(planCode);
      setError("");

      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Не удалось создать платеж");
        return;
      }

      if (!data.redirectUrl) {
        setError("Сервис оплаты не вернул ссылку для перехода");
        return;
      }

      window.location.href = data.redirectUrl;
    } catch (e) {
      console.error(e);
      setError("Ошибка сети");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handleFreeTrial() {
    try {
      setLoadingPlan("trial");
      setError("");

      const res = await fetch("/api/subscription/free-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Не удалось активировать пробный доступ");
        return;
      }

      window.location.href = data.redirectUrl || "/dashboard";
    } catch (e) {
      console.error(e);
      setError("Ошибка сети");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => handleBuyBasic("1m")}
          disabled={loadingPlan !== null}
          className="rounded-2xl border border-white/20 bg-white/10 p-5 text-left transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <div className="text-sm font-bold uppercase text-white/70">Basic</div>
          <div className="mt-2 text-2xl font-extrabold">299 ₽</div>
          <div className="mt-1 text-sm text-white/80">1 месяц</div>
          <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium">
            {loadingPlan === "1m"
              ? "Переход к оплате..."
              : isYookassaEnabled
              ? "Оплатить"
              : "Активировать"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleBuyBasic("3m")}
          disabled={loadingPlan !== null}
          className="rounded-2xl border border-white/20 bg-white/10 p-5 text-left transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-bold uppercase text-white/70">Basic</div>
            <div className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-extrabold text-gray-900">
              -10%
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold">807 ₽</div>
          <div className="mt-1 text-sm text-white/80">3 месяца</div>
          <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium">
            {loadingPlan === "3m"
              ? "Переход к оплате..."
              : isYookassaEnabled
              ? "Оплатить"
              : "Активировать"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleBuyBasic("6m")}
          disabled={loadingPlan !== null}
          className="rounded-2xl border border-white/20 bg-white/10 p-5 text-left transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-bold uppercase text-white/70">Basic</div>
            <div className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-extrabold text-gray-900">
              -25%
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold">1345 ₽</div>
          <div className="mt-1 text-sm text-white/80">6 месяцев</div>
          <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium">
            {loadingPlan === "6m"
              ? "Переход к оплате..."
              : isYookassaEnabled
              ? "Оплатить"
              : "Активировать"}
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {isFreeTrialEnabled && canUseFreeTrial && (
          <button
            type="button"
            onClick={handleFreeTrial}
            disabled={loadingPlan !== null}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loadingPlan === "trial"
              ? "Активация пробного доступа..."
              : "Попробовать 1 день бесплатно"}
          </button>
        )}

        <Link href="/dashboard" className="btn-secondary">
          В кабинет
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}