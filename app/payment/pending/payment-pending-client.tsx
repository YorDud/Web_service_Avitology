"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentStatus = "pending" | "succeeded" | "canceled" | "failed";

type Props = {
  paymentId: string | null;
};

export default function PaymentPendingClient({ paymentId }: Props) {
  const router = useRouter();

  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!paymentId || Number.isNaN(Number(paymentId))) {
      setError("Некорректный идентификатор платежа");
      return;
    }

    let cancelled = false;

    async function loadPayment() {
      try {
        const res = await fetch(`/api/payments/${paymentId}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          if (!cancelled) {
            setError(data.error || "Не удалось получить статус платежа");
          }
          return;
        }

        const paymentStatus = data.payment?.status as PaymentStatus;

        if (cancelled) return;

        setStatus(paymentStatus);

        if (paymentStatus === "succeeded") {
          router.replace(`/payment/success?paymentId=${paymentId}`);
          return;
        }

        if (paymentStatus === "canceled" || paymentStatus === "failed") {
          router.replace(`/payment/error?paymentId=${paymentId}`);
          return;
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError("Ошибка сети при проверке платежа");
        }
      }
    }

    loadPayment();
    const interval = setInterval(loadPayment, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [paymentId, router]);

  return (
    <main className="min-h-screen bg-white">
      <section className="section-space">
        <div className="container-main max-w-3xl">
          <div className="white-card p-10 text-center">
            <div className="mb-4 text-5xl">⏳</div>
            <h1 className="section-title mb-4">Ожидание подтверждения оплаты</h1>

            {error ? (
              <p className="section-text mb-8 text-red-600">{error}</p>
            ) : (
              <p className="section-text mb-8">
                Платёж создан и ожидает подтверждения. Статус обновляется
                автоматически.
                {paymentId ? ` ID платежа: ${paymentId}.` : ""}
              </p>
            )}

            {status && !error && (
              <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
                Текущий статус: <strong>{status}</strong>
              </div>
            )}

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/pricing" className="btn-primary">
                Вернуться к подписке
              </Link>
              <Link href="/dashboard" className="btn-secondary">
                Перейти в личный кабинет
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}