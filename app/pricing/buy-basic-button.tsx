"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  isYookassaEnabled: boolean;
};

export default function BuyBasicButton({ isYookassaEnabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuyBasic() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <button
        type="button"
        onClick={handleBuyBasic}
        disabled={loading}
        className="btn-secondary disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading
          ? "Переход к оплате..."
          : isYookassaEnabled
          ? "Перейти к оплате"
          : "Активировать подписку"}
      </button>

      <Link href="/dashboard" className="btn-secondary">
        В кабинет
      </Link>

      {error && (
        <div className="sm:basis-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}