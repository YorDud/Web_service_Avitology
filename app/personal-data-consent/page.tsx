import Link from "next/link";

export default function PersonalDataConsentPage() {
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
            <div className="badge-green mb-5">
              Согласие на обработку персональных данных
            </div>

            <h1 className="section-title mb-6">
              Согласие пользователя на обработку персональных данных
            </h1>

            <div className="space-y-6 text-[15px] leading-7 text-gray-700 md:text-base">
              <p>
                Настоящим, заполняя формы на сайте{" "}
                <strong>https://helpsell.ru</strong>, пользователь свободно,
                своей волей и в своём интересе даёт согласие на обработку своих
                персональных данных Индивидуальному предпринимателю{" "}
                <strong>Пялкину Андрею Сергеевичу</strong>.
              </p>

              <div>
                <h2 className="mb-3 text-xl font-extrabold text-gray-900">
                  1. Данные оператора
                </h2>
                <ul className="space-y-2">
                  <li>
                    <strong>Наименование:</strong> ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ
                    ПЯЛКИН АНДРЕЙ СЕРГЕЕВИЧ
                  </li>
                  <li>
                    <strong>ИНН:</strong> 502017143999
                  </li>
                  <li>
                    <strong>ОГРНИП:</strong> 325508100326729
                  </li>
                  <li>
                    <strong>Email:</strong> avitology.help@yandex.ru
                  </li>
                  <li>
                    <strong>Телефон:</strong> +7 (993) 606-06-26
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="mb-3 text-xl font-extrabold text-gray-900">
                  2. Перечень персональных данных
                </h2>
                <ul className="list-disc space-y-2 pl-6">
                  <li>имя;</li>
                  <li>адрес электронной почты;</li>
                  <li>пароль в защищённом виде;</li>
                  <li>IP-адрес;</li>
                  <li>cookie-файлы;</li>
                  <li>сведения о браузере, устройстве и действиях на сайте;</li>
                  <li>
                    иные данные, добровольно предоставленные пользователем.
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="mb-3 text-xl font-extrabold text-gray-900">
                  3. Цели обработки
                </h2>
                <ul className="list-disc space-y-2 pl-6">
                  <li>регистрация и авторизация на сайте;</li>
                  <li>предоставление доступа к функциям личного кабинета;</li>
                  <li>исполнение запросов пользователя;</li>
                  <li>обработка обращений и поддержка пользователей;</li>
                  <li>улучшение работы сайта и его функциональности;</li>
                  <li>соблюдение требований законодательства РФ.</li>
                </ul>
              </div>

              <div>
                <h2 className="mb-3 text-xl font-extrabold text-gray-900">
                  4. Действия с персональными данными
                </h2>
                <p>
                  Пользователь соглашается на совершение с его персональными
                  данными следующих действий: сбор, запись, систематизация,
                  накопление, хранение, уточнение, извлечение, использование,
                  обезличивание, блокирование, удаление и уничтожение.
                </p>
              </div>

              <div>
                <h2 className="mb-3 text-xl font-extrabold text-gray-900">
                  5. Срок действия согласия
                </h2>
                <p>
                  Настоящее согласие действует с момента его предоставления и до
                  момента отзыва пользователем, если иное не предусмотрено
                  законодательством Российской Федерации.
                </p>
              </div>

              <div>
                <h2 className="mb-3 text-xl font-extrabold text-gray-900">
                  6. Порядок отзыва согласия
                </h2>
                <p>
                  Согласие может быть отозвано пользователем путём направления
                  письменного обращения на электронную почту{" "}
                  <strong>avitology.help@yandex.ru</strong>.
                </p>
              </div>

              <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-gray-700">
                Устанавливая чекбокс при регистрации, пользователь подтверждает,
                что ознакомился с настоящим согласием и принимает его условия.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}