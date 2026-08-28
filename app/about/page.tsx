import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="section-space">
        <div className="container-main max-w-4xl">
          <div className="mb-6">
            <Link
              href="/"
              className="text-sm font-bold text-gray-500 transition hover:text-black"
            >
              ← На главную
            </Link>
          </div>

          <div className="white-card p-6 md:p-10">
            <div className="badge-green mb-5">О владельце сервиса</div>

            <h1 className="section-title mb-6">Реквизиты и контактная информация</h1>

            <div className="space-y-8 text-[15px] leading-7 text-gray-700 md:text-base">
              <div>
                <h2 className="mb-4 text-xl font-extrabold text-gray-900">
                  Сведения о владельце
                </h2>
                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                  <ul className="space-y-3">
                    <li>
                      <strong>Наименование:</strong> ИНДИВИДУАЛЬНЫЙ
                      ПРЕДПРИНИМАТЕЛЬ ПЯЛКИН АНДРЕЙ СЕРГЕЕВИЧ
                    </li>
                    <li>
                      <strong>ИП:</strong> Пялкин Андрей Сергеевич
                    </li>
                    <li>
                      <strong>ИНН:</strong> 502017143999
                    </li>
                    <li>
                      <strong>ОГРНИП:</strong> 325508100326729
                    </li>
                    <li>
                      <strong>Адрес:</strong> Московская область, Клинский район,
                      деревня Решоткино, кв. 43
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <h2 className="mb-4 text-xl font-extrabold text-gray-900">
                  Контакты
                </h2>
                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                  <ul className="space-y-3">
                    <li>
                      <strong>Email:</strong> avitology.help@yandex.ru
                    </li>
                    <li>
                      <strong>Телефон:</strong> +7 (993) 606-06-26
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <h2 className="mb-4 text-xl font-extrabold text-gray-900">
                  Банковские реквизиты
                </h2>
                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                  <ul className="space-y-3">
                    <li>
                      <strong>Расчётный счёт:</strong> 40802810040070045790
                    </li>
                    <li>
                      <strong>Банк:</strong> ПАО Сбербанк
                    </li>
                    <li>
                      <strong>БИК банка:</strong> 044525225
                    </li>
                    <li>
                      <strong>Корсчёт:</strong> 30101810400000000225
                    </li>
                    <li>
                      <strong>ИНН банка:</strong> 7707083893
                    </li>
                    <li>
                      <strong>КПП банка:</strong> 773643002
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-gray-700">
                По вопросам работы сервиса, персональных данных и технической
                поддержки вы можете связаться с нами по указанным контактам.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}