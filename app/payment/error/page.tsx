"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PaymentErrorPage() {
  const [message, setMessage] = useState(
    "Платёж был отменён или не был успешно завершён."
  );
  const [isClientsPayment, setIsClientsPayment] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const paymentId = url.searchParams.get("paymentId");

    if (!paymentId) return;

    let cancelled = false;

    async function checkPayment() {
      try {
        const res = await fetch(`/api/payments/${paymentId}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || cancelled) return;

        const status = data.payment?.status;
        const clientsPayment = String(data.payment?.planCode ?? "").startsWith("autoload_clients_x");
        setIsClientsPayment(clientsPayment);
        const unchanged = clientsPayment ? "Слоты клиентов не начислены." : "Уровень подписки не изменён.";

        if (status === "succeeded") {
          window.location.replace(`/payment/success?paymentId=${paymentId}`);
          return;
        }

        if (status === "pending") {
          setMessage("Платёж ещё ожидает подтверждения. Вы можете подождать ещё немного или попробовать позже.");
          return;
        }

        if (status === "canceled") {
          setMessage(`Платёж был отменён. ${unchanged}`);
          return;
        }

        if (status === "failed") {
          setMessage(`При обработке платежа произошла ошибка. ${unchanged}`);
          return;
        }

        setMessage(`Не удалось завершить оплату. ${unchanged}`);
      } catch (error) {
        console.error(error);
      }
    }

    checkPayment();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <section className="section-space">
        <div className="container-main max-w-3xl">
          <div className="white-card p-10 text-center">
            <div className="mb-4 text-5xl">⚠️</div>
            <h1 className="section-title mb-4">Не удалось завершить оплату</h1>
            <p className="section-text mb-8">{message}</p>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href={isClientsPayment ? "/dashboard?section=autoload" : "/pricing"} className="btn-primary">
                Повторить попытку
              </Link>
              <Link href="/support" className="btn-secondary">
                Связаться с поддержкой
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}