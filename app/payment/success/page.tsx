"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PaymentSuccessPage() {
  const [message, setMessage] = useState(
    "Проверяем и подтверждаем статус оплаты..."
  );
  // true — оплачены слоты для клиентов автозагрузки (а не подписка)
  const [isClientsPayment, setIsClientsPayment] = useState(false);
  // true — оплачен заказ услуги «Уровень сервиса»
  const [isServicePayment, setIsServicePayment] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const paymentId = url.searchParams.get("paymentId");

    if (!paymentId) {
      setMessage(
        "Оплата завершена. Если подписка ещё не активировалась, обновите кабинет через несколько секунд."
      );
      return;
    }

    let cancelled = false;

    async function checkPayment() {
      try {
        const res = await fetch(`/api/payments/${paymentId}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setMessage(
            data.error ||
              "Не удалось сразу подтвердить оплату. Обновите кабинет через несколько секунд."
          );
          return;
        }

        const status = data.payment?.status;
        const clientsPayment = String(data.payment?.planCode ?? "").startsWith("autoload_clients_x");
        setIsClientsPayment(clientsPayment);
        const servicePayment = String(data.payment?.planCode ?? "").startsWith("service_level_order_");
        setIsServicePayment(servicePayment);

        if (status === "succeeded") {
          setMessage(
            servicePayment
              ? "Оплата подтверждена. Заказ создан и передан в работу — следить за ходом выполнения можно в разделе «Уровень сервиса» → «Мои заказы»."
              : clientsPayment
              ? "Оплата подтверждена. Новые слоты для клиентов автозагрузки добавлены — вернитесь в «Автозагрузку» и добавьте клиента."
              : "Оплата подтверждена. Подписка Basic активирована."
          );
          return;
        }

        if (status === "pending") {
          window.location.replace(`/payment/pending?paymentId=${paymentId}`);
          return;
        }

        if (status === "canceled" || status === "failed") {
          window.location.replace(`/payment/error?paymentId=${paymentId}`);
          return;
        }

        setMessage(
          "Статус оплаты обновляется. Проверьте кабинет через несколько секунд."
        );
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMessage(
            "Ошибка при проверке статуса оплаты. Обновите кабинет через несколько секунд."
          );
        }
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
            <div className="mb-4 text-5xl">✅</div>
            <h1 className="section-title mb-4">Оплата успешно подтверждена</h1>
            <p className="section-text mb-8">{message}</p>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href={isServicePayment ? "/dashboard?section=service-level&tab=orders" : isClientsPayment ? "/dashboard?section=autoload" : "/dashboard"}
                className="btn-primary"
              >
                {isServicePayment ? "Перейти к моим заказам" : isClientsPayment ? "Вернуться к автозагрузке" : "Открыть личный кабинет"}
              </Link>
              <Link href="/" className="btn-secondary">
                На главную
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}