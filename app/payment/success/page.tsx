import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="section-space">
        <div className="container-main max-w-3xl">
          <div className="white-card p-10 text-center">
            <div className="mb-4 text-5xl">✅</div>
            <h1 className="section-title mb-4">Оплата успешно подтверждена</h1>
            <p className="section-text mb-8">
              Если webhook уже обработан, подписка активирована автоматически.
              Если активация произошла с небольшой задержкой, обновите кабинет
              через несколько секунд.
            </p>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/dashboard" className="btn-primary">
                Открыть личный кабинет
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