/* Значения «по умолчанию» для услуг и настроек Уровня сервиса. Попадают в БД один раз
   при первом открытии; дальше всё меняется в админ-панели. */

/**
 * Шаблон тела task_create — по официальной документации SocPublic (раздел «Метод task_create»):
 *  name          — название, 5–70 символов, минимум 2 слова;
 *  url           — МАССИВ ссылок задания;
 *  type          — тип задания; допустимое значение для Авито — "avito";
 *  work_time     — «Время на выполнение» в СЕКУНДАХ (по умолчанию у SocPublic 432000 = 5 дней, поэтому
 *                  без этого поля у всех заданий и получались «5 дней»). Допустимые значения: 300, 900,
 *                  1800, 3600, 10800, 21600, 43200, 64800, 86400, 172800, 259200, 432000, 604800,
 *                  1209600, 1814400, 2592000 — это в точности наш список «Время на выполнение» × 60;
 *  description   — описание для исполнителей (HTML, от 100 символов);
 *  approve_type  — "hand" (ручная проверка; по умолчанию);
 *  approve_text  — «информация для подтверждения» (HTML, при ручной проверке);
 *  price_user    — оплата исполнителю за 1 выполнение, ₽.
 * Любые другие параметры из документации (ограничения по часам и дням, таргетинг, капча, per_24,
 * timeout и т.д.) можно дописать в этот шаблон в админке.
 */
export const DEFAULT_CREATE_TEMPLATE = JSON.stringify(
  {
    name: "{{name}}",
    url: "{{links}}",
    type: "avito",
    work_time: "{{executionSeconds}}",
    description: "{{description}}",
    approve_type: "hand",
    approve_text: "{{confirm}}",
    price_user: "{{reward}}",
  },
  null,
  2,
);

/** Прежние шаблоны с предположительными названиями или форматом полей — автоматически заменяются новым, если их не меняли вручную. */
export const LEGACY_CREATE_TEMPLATE = JSON.stringify(
  {
    name: "{{name}}",
    links: "{{links}}",
    links_order: "queue",
    type: "avito",
    description: "{{description}}",
    check_type: "manual",
    check_info: "{{confirm}}",
    adult: 0,
    price: "{{reward}}",
  },
  null,
  2,
);

/** Версия 2: верные названия полей (url, price_user, approve_text), но url ещё строкой и без type. */
export const LEGACY_CREATE_TEMPLATE_V2 = JSON.stringify(
  {
    name: "{{name}}",
    url: "{{linksText}}",
    description: "{{description}}",
    approve_text: "{{confirm}}",
    price_user: "{{reward}}",
  },
  null,
  2,
);

/** Версия 3: url уже массивом и добавлен type, но ещё без времени на выполнение (time_limit). */
export const LEGACY_CREATE_TEMPLATE_V3 = JSON.stringify(
  {
    name: "{{name}}",
    url: "{{links}}",
    type: "avito",
    description: "{{description}}",
    approve_text: "{{confirm}}",
    price_user: "{{reward}}",
  },
  null,
  2,
);

/** Версия 4: с выдуманным полем time_limit (в API такого поля нет — время задаётся полем work_time в секундах). */
export const LEGACY_CREATE_TEMPLATE_V4 = JSON.stringify(
  {
    name: "{{name}}",
    url: "{{links}}",
    type: "avito",
    time_limit: "{{executionMinutes}}",
    description: "{{description}}",
    approve_text: "{{confirm}}",
    price_user: "{{reward}}",
  },
  null,
  2,
);

/**
 * Шаблон тела task_pay (пополнение задания) — по документации: параметры
 *   id      — номер задания;
 *   amount  — «Сумма пополнения (только рубли!)» — рубли ЦЕЛЫМ числом (поэтому дробное 6.5 давало
 *             «Amount must be integer», а число выполнений «1» читалось как 1 ₽ и давало
 *             «Balance must be more than the cost of one execution»).
 * Стоимость выполнения дробная (5 ₽ выплаты × 1.3 = 6.5 ₽), поэтому сумму округляем ВВЕРХ до целого
 * рубля ({{amountRounded}}): так её всегда хватает, а остаток (до 0.99 ₽ на ссылку) возвращается на
 * рекламный баланс методом task_charge, когда задание выполнено или заказ отменён.
 */
export const DEFAULT_PAY_TEMPLATE = JSON.stringify({ id: "{{taskId}}", amount: "{{amountRounded}}" }, null, 2);

/** Прежние шаблоны пополнения — заменяются новым автоматически, если их не меняли вручную. */
export const LEGACY_PAY_TEMPLATE = JSON.stringify({ task_id: "{{taskId}}", sum: "{{amount}}" }, null, 2);
export const LEGACY_PAY_TEMPLATE_V2 = JSON.stringify({ id: "{{taskId}}", sum: "{{amount}}" }, null, 2);
export const LEGACY_PAY_TEMPLATE_V3 = JSON.stringify({ id: "{{taskId}}", amount: "{{amount}}" }, null, 2);
export const LEGACY_PAY_TEMPLATE_V4 = JSON.stringify({ id: "{{taskId}}", amount: "{{count}}" }, null, 2);

/**
 * «Время на выполнение» — те же варианты, что в форме SocPublic, в минутах. В API это поле work_time
 * в СЕКУНДАХ (минуты × 60 дают ровно допустимые значения SocPublic: 300 … 2592000); в шаблон оно
 * подставляется как {{executionSeconds}}.
 */
export const EXECUTION_TIME_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 5, label: "5 мин." },
  { minutes: 15, label: "15 мин." },
  { minutes: 30, label: "30 мин." },
  { minutes: 60, label: "1 час" },
  { minutes: 180, label: "3 часа" },
  { minutes: 360, label: "6 часов" },
  { minutes: 720, label: "12 часов" },
  { minutes: 1080, label: "18 часов" },
  { minutes: 1440, label: "24 часа (1 день)" },
  { minutes: 2880, label: "48 часов (2 дня)" },
  { minutes: 4320, label: "72 часа (3 дня)" },
  { minutes: 7200, label: "120 часов (5 дней)" },
  { minutes: 10080, label: "1 неделя" },
  { minutes: 20160, label: "2 недели" },
  { minutes: 30240, label: "3 недели" },
  { minutes: 43200, label: "1 месяц" },
];
export const DEFAULT_EXECUTION_MINUTES = 7200;

export type DefaultService = {
  slug: string;
  title: string;
  summary: string;
  guide: string;
  emoji: string;
  sortOrder: number;
  pricePerUnit: number;
  minQuantity: number;
  maxQuantity: number;
  taskTitle: string;
  taskDescription: string;
  confirmInfo: string;
  reward: number;
  executionMinutes: number;
};

export const DEFAULT_SERVICES: DefaultService[] = [
  {
    slug: "relevance",
    title: "Актуальность объявлений (наличие товара)",
    summary: "Живые покупатели спрашивают, актуально ли объявление и есть ли товар в наличии.",
    guide:
      "Исполнитель открывает ваше объявление по ссылке, здоровается и задаёт вопрос об актуальности объявления или наличии товара. Так в диалогах и поведении покупателей появляются живые вопросы о наличии.\n\nВажно: отвечайте на такие сообщения как обычному покупателю. Один исполнитель пишет в объявление только один раз — если он уже писал в это объявление, повторно задание выполнить не сможет.",
    emoji: "📦",
    sortOrder: 10,
    pricePerUnit: 25,
    minQuantity: 15,
    maxQuantity: 500,
    taskTitle: "Легкие действия Авито АКТУАЛЬНОСТЬ {letter}{n}",
    taskDescription:
      "Войти по ссылке в объявление, ПОЗДОРОВАТЬСЯ и <b>задать вопрос ОБ АКТУАЛЬНОСТИ ИЛИ НАЛИЧИИ ТОВАРА</b><br><br>если уже писали в объявление - больше нельзя",
    confirmInfo: "Скриншот переписки",
    reward: 5,
    executionMinutes: DEFAULT_EXECUTION_MINUTES,
  },
  {
    slug: "price",
    title: "Достоверность цены",
    summary: "Покупатели спрашивают о цене в объявлении и пишут вам в чат.",
    guide:
      "Исполнитель открывает объявление, здоровается и задаёт вопрос о цене. В объявлении появляются живые диалоги о стоимости — это создаёт ощущение реального спроса.\n\nВажно: отвечайте на сообщения как обычному покупателю. В одно объявление один исполнитель пишет только один раз.",
    emoji: "💰",
    sortOrder: 20,
    pricePerUnit: 25,
    minQuantity: 15,
    maxQuantity: 500,
    taskTitle: "Легкие действия Авито ЦЕНА {letter}{n}",
    taskDescription:
      "Войти по ссылке в объявление, ПОЗДОРОВАТЬСЯ и <b>задать вопрос О ЦЕНЕ</b><br><br>если уже писали в объявление - больше нельзя",
    confirmInfo: "Скриншот переписки",
    reward: 5,
    executionMinutes: DEFAULT_EXECUTION_MINUTES,
  },
  {
    slug: "chats",
    title: "Ответы в чатах",
    summary: "Живые исполнители ведут с вами диалог: пишут по два сообщения по описанию и фото товара.",
    guide:
      "Исполнитель открывает объявление, изучает описание и фотографии и пишет вам два сообщения по существу. Вы отвечаете — в чате появляется настоящая переписка.\n\nЭта услуга помогает проверить и улучшить скорость и качество ваших ответов в чатах.",
    emoji: "💬",
    sortOrder: 30,
    pricePerUnit: 20,
    minQuantity: 15,
    maxQuantity: 500,
    taskTitle: "Легкие действия Авито ЧАТЫ {letter}{n}",
    taskDescription:
      "Войти по ссылке, написать <b>ДВА СООБЩЕНИЯ</b> основываясь на описании и фотографиях товара из объявления",
    confirmInfo: "Скриншот переписки",
    reward: 5,
    executionMinutes: DEFAULT_EXECUTION_MINUTES,
  },
];

/**
 * Поля ответа task_info (по документации): bid_pay — оплачено заявок, bid_done — отчётов ждут
 * проверки, bid_start — начато, bid_debug — на доработке, bid_reject — отклонено, balance — баланс
 * задания, active — yes|off|ban. По ним считается ход выполнения.
 */
export const DEFAULT_PROGRESS_KEYS = {
  keyRemaining: "",
  keyReady: "bid_done",
  keyStarted: "bid_start",
  keyRework: "bid_debug",
  keyTotal: "",
  keyPaid: "bid_pay",
};

/** Прежние (предположительные) значения ключей — заменяются новыми автоматически, если их не меняли вручную. */
export const LEGACY_PROGRESS_KEYS = {
  keyRemaining: "left,remain,remaining,rest,ostalos,count_left",
  keyReady: "ready,bids_ready,wait,waiting,pending",
  keyStarted: "started,begin,in_work,bids_started",
  keyRework: "rework,revision,bids_rework",
  keyTotal: "total,all,bids_total",
  keyPaid: "paid,done,completed,success,bids_paid",
};
