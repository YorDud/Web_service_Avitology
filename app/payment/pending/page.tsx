import Link from "next/link";

export default function PaymentPendingPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="section-space">
        <div className="container-main max-w-3xl">
          <div className="white-card p-10 text-center">
            <div className="mb-4 text-5xl">⏳</div>
            <h1 className="section-title mb-4">Ожидание подтверждения оплаты</h1>
            <p className="section-text mb-8">
              Платеж создан и ожидает подтверждения. После подключения ЮKassa
              эта страница будет использоваться для ожидания результата оплаты.
            </p>

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