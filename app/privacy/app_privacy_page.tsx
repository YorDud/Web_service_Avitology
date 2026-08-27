export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="container-main py-12 md:py-16">
        <div className="mx-auto max-w-4xl rounded-[32px] border border-green-100 bg-white p-6 shadow-[0_20px_50px_rgba(16,24,40,0.08)] md:p-10">
          <div className="mb-8">
            <div className="mb-3 inline-flex rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
              Политика конфиденциальности
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 md:text-5xl">
              Политика конфиденциальности Avitology
            </h1>
            <p className="mt-4 text-sm text-gray-500 md:text-base">
              Дата вступления в силу: 27 августа 2026 года
            </p>
          </div>

          <div className="space-y-8 text-gray-700">
            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">1. Общие положения</h2>
              <p className="text-base leading-8">
                Настоящая Политика конфиденциальности описывает, какие данные могут
                обрабатываться при использовании сайта Avitology и расширения
                Avitology для Google Chrome, а также в каких целях они используются.
              </p>
              <p className="text-base leading-8">
                Используя сайт и расширение Avitology, пользователь соглашается с
                настоящей Политикой конфиденциальности.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">2. Какие данные могут обрабатываться</h2>
              <p className="text-base leading-8">
                При использовании сервиса могут обрабатываться следующие данные:
              </p>
              <ul className="list-disc space-y-2 pl-6 text-base leading-8">
                <li>данные учётной записи пользователя, включая адрес электронной почты и имя;</li>
                <li>данные авторизации и сведения о наличии доступа к сервису;</li>
                <li>технические данные, необходимые для работы сайта и расширения;</li>
                <li>локально сохранённые настройки расширения и данные о статусе доступа;</li>
                <li>cookies и иные технические данные сессии, необходимые для авторизации.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">3. Цели обработки данных</h2>
              <p className="text-base leading-8">Данные используются исключительно в целях:</p>
              <ul className="list-disc space-y-2 pl-6 text-base leading-8">
                <li>предоставления доступа к функциям сайта и расширения;</li>
                <li>проверки авторизации пользователя;</li>
                <li>проверки наличия активного доступа к сервису;</li>
                <li>обеспечения корректной работы расширения на поддерживаемых страницах;</li>
                <li>поддержки и улучшения работы сервиса.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">4. Использование расширения Chrome</h2>
              <p className="text-base leading-8">
                Расширение Avitology для Google Chrome взаимодействует с сайтом
                Avitology для проверки, авторизован ли пользователь и имеет ли он
                активный доступ к сервису.
              </p>
              <p className="text-base leading-8">
                Расширение может локально сохранять технические данные, необходимые
                для отображения статуса доступа и корректной работы функций.
              </p>
              <p className="text-base leading-8">
                Расширение не продаёт пользовательские данные и не использует их для
                показа рекламы.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">5. Передача данных третьим лицам</h2>
              <p className="text-base leading-8">
                Avitology не продаёт персональные данные пользователей и не передаёт
                их третьим лицам в рекламных целях.
              </p>
              <p className="text-base leading-8">
                Передача данных может происходить только в объёме, необходимом для
                работы инфраструктуры сайта и сервиса, либо в случаях,
                предусмотренных законодательством.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">6. Cookies и технические данные</h2>
              <p className="text-base leading-8">
                Для корректной работы сайта и авторизации могут использоваться
                cookies и иные технические механизмы хранения данных сессии.
              </p>
              <p className="text-base leading-8">
                Отключение cookies может привести к некорректной работе отдельных
                функций сайта и расширения.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">7. Хранение и защита данных</h2>
              <p className="text-base leading-8">
                Мы принимаем разумные организационные и технические меры для защиты
                данных от несанкционированного доступа, изменения, раскрытия или
                уничтожения.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">8. Права пользователя</h2>
              <p className="text-base leading-8">
                Пользователь может обратиться по контактным данным, указанным ниже,
                по вопросам, связанным с обработкой данных и использованием сервиса.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">9. Контакты</h2>
              <p className="text-base leading-8">
                По всем вопросам, связанным с конфиденциальностью и работой сервиса,
                можно связаться по адресу:
              </p>
              <p className="text-base font-bold leading-8 text-gray-900">
                support@avitology.site
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-gray-900">10. Изменения политики</h2>
              <p className="text-base leading-8">
                Настоящая Политика конфиденциальности может обновляться. Актуальная
                версия всегда размещается на сайте Avitology.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
