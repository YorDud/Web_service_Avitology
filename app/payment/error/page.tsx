import Link from "next/link";

export default function PaymentErrorPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="section-space">
        <div className="container-main max-w-3xl">
          <div className="white-card p-10 text-center">
            <div className="mb-4 text-5xl">⚠️</div>
            <h1 className="section-title mb-4">Не удалось завершить оплату</h1>
            <p className="section-text mb-8">
              Возникла ошибка при обработке платежа. Попробуйте повторить
              попытку позже или обратитесь в поддержку.
            </p>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/pricing" className="btn-primary">
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