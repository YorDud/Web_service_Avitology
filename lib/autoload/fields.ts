/* =========================================================================
   Автозагрузка Авито — общие константы и справочник полей.
   Файл без серверных зависимостей: его используют и API, и интерфейс.
   ========================================================================= */

export const MAX_ADS_PER_FEED = 5000;
export const MAX_FEEDS_PER_USER = 20;
export const MAX_VALUE_LENGTH = 12000;
export const MAX_FIELD_OPTION_VALUES = 300;

/** Разделитель нескольких значений одного тега: «Bluetooth||Wi-Fi». */
export const LIST_SEPARATOR = "||";

/** Данные объявления: XML-тег → значение. Вложенность записывается через «/». */
export type AdData = Record<string, string>;

export type FieldGroup = "main" | "contacts" | "publish" | "extra";

/** value — то, что попадёт в XML для Авито; label — что видит пользователь. */
export type FieldOption = { value: string; label: string };

export type KnownField = {
  tag: string;
  label: string;
  group: FieldGroup;
  multiline?: boolean;
  /** «date» — поле даты (input type=date, хранится как ГГГГ-ММ-ДД). */
  variant?: "date";
  options?: FieldOption[];
  hint?: string;
  placeholder?: string;
};

export const FIELD_GROUPS: { id: FieldGroup; title: string }[] = [
  { id: "main", title: "Основное" },
  { id: "contacts", title: "Контакты" },
  { id: "publish", title: "Публикация и продвижение" },
  { id: "extra", title: "Характеристики" },
];

const opts = (pairs: [string, string][]): FieldOption[] => pairs.map(([value, label]) => ({ value, label }));

export const KNOWN_FIELDS: KnownField[] = [
  {
    tag: "Id",
    label: "ID объявления",
    group: "main",
    hint: "Ваш собственный номер (артикул) объявления в файле, у каждого свой. Авито по нему узнаёт объявление при обновлениях, поэтому не меняйте его после публикации. Уже есть в таблице — столбец «ID объявления».",
    placeholder: "например, sku-1001",
  },
  {
    tag: "Category",
    label: "Категория",
    group: "main",
    hint: "Название категории точно так, как в каталоге Авито. Выберите кнопкой «Каталог» рядом, чтобы не ошибиться в написании.",
    placeholder: "Товары для детей и игрушки",
  },
  { tag: "Title", label: "Название", group: "main", hint: "До 50 символов.", placeholder: "Коляска-трансформер" },
  {
    tag: "Description",
    label: "Описание",
    group: "main",
    multiline: true,
    hint: "До 7500 символов. Можно использовать теги p, br, strong, em, ul, ol, li.",
  },
  { tag: "Price", label: "Цена, ₽", group: "main", placeholder: "2990" },
  {
    tag: "Images",
    label: "Фото",
    group: "main",
    multiline: true,
    hint: "Прямые ссылки на изображения, по одной на строку. Ссылки должны открываться без входа.",
    placeholder: "https://example.com/photo-1.jpg",
  },
  { tag: "VideoURL", label: "Видео", group: "main", hint: "Ссылка на видео YouTube или RuTube." },
  { tag: "Address", label: "Адрес", group: "main", placeholder: "Москва, Тверская улица, 1" },

  { tag: "ContactPhone", label: "Телефон", group: "contacts", placeholder: "+7 999 123-45-67" },
  { tag: "ManagerName", label: "Имя менеджера", group: "contacts" },
  {
    tag: "ContactMethod",
    label: "Способ связи",
    group: "contacts",
    options: opts([
      ["По телефону и в сообщениях", "По телефону и в сообщениях"],
      ["По телефону", "Только по телефону"],
      ["В сообщениях", "Только в сообщениях"],
    ]),
  },
  { tag: "AllowEmail", label: "Связь по почте", group: "contacts", options: opts([["Да", "Да"], ["Нет", "Нет"]]) },

  {
    tag: "DateBegin",
    label: "Дата начала",
    group: "publish",
    variant: "date",
    hint: "Если не заполнено, объявление публикуется сразу.",
  },
  {
    tag: "DateEnd",
    label: "Дата окончания",
    group: "publish",
    variant: "date",
    hint: "Если не заполнено, срок не ограничен.",
  },
  {
    tag: "ListingFee",
    label: "Тип размещения",
    group: "publish",
    options: opts([
      ["Package", "Пакетное размещение (Package)"],
      ["PackageSingle", "Из пакета, поштучно (PackageSingle)"],
      ["Single", "Разовое размещение (Single)"],
    ]),
    hint: "Как оплачивается размещение этого объявления.",
  },
  {
    tag: "AdStatus",
    label: "Платная услуга",
    group: "publish",
    options: opts([
      ["Free", "Без продвижения (Free)"],
      ["Premium", "Premium"],
      ["VIP", "VIP"],
      ["PushUp", "Поднятие в поиске (PushUp)"],
      ["Highlight", "Выделение цветом (Highlight)"],
      ["TurboSale", "Турбо-продажа (TurboSale)"],
      ["QuickSale", "Быстрая продажа (QuickSale)"],
      ["XL", "XL-объявление (XL)"],
    ]),
  },

  { tag: "Condition", label: "Состояние", group: "extra", options: opts([["Новое", "Новое"], ["Б/у", "Б/у"]]) },
  { tag: "AdType", label: "Вид объявления", group: "extra", hint: "Значение зависит от категории — уточните в каталоге." },
  { tag: "GoodsType", label: "Вид товара", group: "extra", hint: "Значение зависит от категории — уточните в каталоге." },
];

export const FIELD_BY_TAG: Record<string, KnownField> = Object.fromEntries(
  KNOWN_FIELDS.map((field) => [field.tag, field]),
);

/** Поля, которые обычно задают один раз для всей таблицы. */
export const DEFAULT_FIELD_TAGS = [
  "Category",
  "Address",
  "ContactPhone",
  "ManagerName",
  "ContactMethod",
  "AllowEmail",
  "Condition",
  "ListingFee",
  "AdStatus",
  "DateBegin",
  "DateEnd",
];

export const DEFAULT_COLUMNS = ["Id", "Title", "Price", "Images", "Description"];

const TAG_SEGMENT = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function isValidTagPath(tag: string) {
  return (
    tag.length > 0 &&
    tag.length <= 80 &&
    tag.split("/").every((segment) => TAG_SEGMENT.test(segment))
  );
}

export function tagLabel(tag: string) {
  return FIELD_BY_TAG[tag]?.label ?? tag;
}

/** Русские и английские названия столбцов при импорте из Excel и Google/Яндекс Таблиц. */
const ALIASES: Record<string, string[]> = {
  Id: [
    "id",
    "ид",
    "артикул",
    "номер",
    "sku",
    "код",
    "код товара",
    "id объявления",
    "уникальный идентификатор объявления",
    "идентификатор объявления",
  ],
  Category: ["category", "категория"],
  Title: ["title", "название", "заголовок", "наименование", "имя товара", "название объявления"],
  Description: ["description", "описание", "текст", "текст объявления", "описание объявления"],
  Price: ["price", "цена", "стоимость"],
  Images: [
    "images",
    "image",
    "photo",
    "photos",
    "фото",
    "картинки",
    "изображения",
    "ссылки на фото",
    "ссылка на фото",
  ],
  VideoURL: ["videourl", "video", "видео", "ссылка на видео"],
  Address: ["address", "адрес"],
  ContactPhone: ["contactphone", "phone", "телефон", "контактный телефон", "номер телефона"],
  ManagerName: ["managername", "manager", "менеджер", "имя менеджера", "контактное лицо"],
  ContactMethod: ["contactmethod", "способ связи"],
  AllowEmail: ["allowemail", "связь по почте", "почта", "сообщения на email"],
  DateBegin: ["datebegin", "дата начала", "начало", "начало размещения"],
  DateEnd: ["dateend", "дата окончания", "окончание", "окончание размещения"],
  ListingFee: ["listingfee", "тип размещения", "размещение", "способ размещения", "вариант платного размещения"],
  AdStatus: ["adstatus", "платная услуга", "услуга", "продвижение", "услуга продвижения", "платные услуги"],
  Condition: ["condition", "состояние"],
  AdType: ["adtype", "вид объявления", "тип объявления"],
  GoodsType: ["goodstype", "вид товара", "тип товара"],
};

const ALIAS_LOOKUP: Record<string, string> = {};
for (const [tag, names] of Object.entries(ALIASES)) {
  for (const name of names) ALIAS_LOOKUP[name] = tag;
}

/**
 * Более осторожное распознавание: применяется только когда точное совпадение
 * не найдено — например, «Цена, руб.», «Фото (ссылки)», «Ссылки фотографий».
 * FUZZY_STEMS сравнивает НАЧАЛО отдельного слова (без учёта окончаний
 * русской морфологии — «фото»/«фотографии», «категори[я/и/ю]»), поэтому
 * взяты только основы, которые не встречаются в словах из другой смысловой
 * группы. FUZZY_PHRASES — многословные фразы, которые ищутся целиком.
 */
const FUZZY_STEMS: [string, string][] = [
  ["фото", "Images"],
  ["изображени", "Images"],
  ["картинк", "Images"],
  ["видео", "VideoURL"],
  ["описани", "Description"],
  ["категори", "Category"],
  ["телефон", "ContactPhone"],
  ["менеджер", "ManagerName"],
  ["адрес", "Address"],
  ["стоимост", "Price"],
  ["цена", "Price"],
  ["заголов", "Title"],
  ["наименован", "Title"],
  ["состояни", "Condition"],
  ["артикул", "Id"],
];

const FUZZY_PHRASES: [string, string][] = [
  ["ссылки на фото", "Images"],
  ["ссылка на фото", "Images"],
  ["ссылка на видео", "VideoURL"],
  ["контактное лицо", "ManagerName"],
  ["способ связи", "ContactMethod"],
  ["связь по почте", "AllowEmail"],
  ["начало размещения", "DateBegin"],
  ["окончание размещения", "DateEnd"],
  ["способ размещения", "ListingFee"],
  ["услуга продвижения", "AdStatus"],
  ["идентификатор объявления", "Id"],
];

function normalizeHeaderText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TAGGED_HEADER = /\(([A-Za-z_][A-Za-z0-9_.\/-]*)\)\s*$/;

/** Превращает заголовок столбца в XML-тег или возвращает null, если столбец не распознан. */
export function resolveTag(header: string): string | null {
  const raw = header.trim().replace(/^\uFEFF/, "");
  if (!raw) return null;

  // «Модель (Model)» — из наших образцов для конкретной категории: тег в скобках надёжнее
  // и работает для полей, которых нет в общем справочнике.
  const tagged = TAGGED_HEADER.exec(raw)?.[1];
  if (tagged && isValidTagPath(tagged)) return tagged;

  const exact = ALIAS_LOOKUP[raw.toLowerCase()];
  if (exact) return exact;

  const normalized = normalizeHeaderText(raw);
  const exactNormalized = ALIAS_LOOKUP[normalized];
  if (exactNormalized) return exactNormalized;

  for (const [phrase, tag] of FUZZY_PHRASES) {
    if (normalized.includes(phrase)) return tag;
  }

  const words = normalized.split(" ");
  for (const [stem, tag] of FUZZY_STEMS) {
    if (words.some((word) => word.startsWith(stem))) return tag;
  }

  return isValidTagPath(raw) ? raw : null;
}

/* ---------- Образец таблицы для скачивания ----------
   Готовый набор столбцов с уже правильными заголовками — чтобы пользователь
   мог заполнить его в Excel/Google Таблицах и сразу загрузить обратно. */

export const TEMPLATE_TAGS = [
  "Id",
  "Category",
  "Title",
  "Description",
  "Price",
  "Images",
  "Address",
  "ContactPhone",
  "ManagerName",
  "ContactMethod",
  "AllowEmail",
  "Condition",
];

export const TEMPLATE_EXAMPLES: Record<string, string> = {
  Id: "sku-1001",
  Category: "Товары для детей и игрушки",
  Title: "Коляска-трансформер",
  Description: "Коляска в отличном состоянии, все механизмы исправны. Торг уместен.",
  Price: "2990",
  Images: "https://example.com/photo-1.jpg\nhttps://example.com/photo-2.jpg",
  Address: "Москва, Тверская улица, 1",
  ContactPhone: "+7 999 123-45-67",
  ManagerName: "Анна",
  ContactMethod: "По телефону и в сообщениях",
  AllowEmail: "Нет",
  Condition: "Б/у",
};

/** Заголовки и одна строка-пример для файла-образца (columns можно переопределить). */
export function buildTemplateRows(tags: string[] = TEMPLATE_TAGS): { headers: string[]; example: string[] } {
  return {
    headers: tags.map((tag) => tagLabel(tag)),
    example: tags.map((tag) => TEMPLATE_EXAMPLES[tag] ?? ""),
  };
}

/**
 * Заголовок «Название (Tag)» — с явным именем тега в скобках. Такой заголовок resolveTag()
 * распознаёт напрямую, без сопоставления по словам — это нужно для образцов конкретной
 * категории, где часть столбцов (например «Модель», «Цвет») не входит в общий справочник
 * и на кириллице не прошла бы обычное распознавание.
 */
export function taggedHeader(tag: string, label: string): string {
  return `${label} (${tag})`;
}

/* ---------- Нормализация цены ----------
   Excel, Google Таблицы и Яндекс Таблицы часто отдают цену в отформатированном
   виде: с валютой («2 990 ₽»), с пробелом-разделителем тысяч (обычным или
   неразрывным) или с запятой вместо точки в копейках («2990,50»). Авито
   ожидает просто число. Приводим значение до попытки его провалидировать. */
export function normalizePriceValue(input: string): string {
  let s = input.normalize("NFKC").trim();
  if (!s) return "";

  // валюта и лишние слова (убираем, пока ещё есть пробелы-разделители).
  // Важно: \b в JS-регулярках не распознаёт границу перед кириллицей, поэтому
  // границы слова here заданы явно через пробел/начало/конец строки.
  s = s.replace(/[₽$€]/g, "");
  s = s.replace(/(^|\s)(руб\.?|rub\.?|р\.?)(?=\s|$)/gi, "$1").trim();
  s = s.replace(/(руб\.?|rub\.?|р\.?)$/i, "").trim();
  // все виды пробелов, в т.ч. неразрывный (NBSP) и узкий неразрывный (используются как разделитель тысяч)
  s = s.replace(/[\s\u00A0\u2009\u202F]/g, "");
  if (!s) return "";

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    // Есть и точка, и запятая — то, что правее, и есть десятичный разделитель.
    const decimalPos = Math.max(lastComma, lastDot);
    const intPart = s.slice(0, decimalPos).replace(/[.,]/g, "");
    const fracPart = s.slice(decimalPos + 1).replace(/[.,]/g, "");
    s = fracPart ? `${intPart}.${fracPart}` : intPart;
  } else if (lastComma !== -1) {
    const frac = s.slice(lastComma + 1);
    // 1-2 цифры после запятой — копейки, иначе это разделитель тысяч
    s = /^\d{1,2}$/.test(frac) ? `${s.slice(0, lastComma)}.${frac}` : s.replace(/,/g, "");
  } else if (lastDot !== -1) {
    const frac = s.slice(lastDot + 1);
    // ровно 3 цифры после единственной точки — почти наверняка группировка тысяч, не копейки
    if (/^\d{3}$/.test(frac) && s.indexOf(".") === lastDot) {
      s = s.replace(/\./g, "");
    }
  }

  return s;
}

/** Excel/Google/Яндекс часто отдают дату как ДД.ММ.ГГГГ или ДД/ММ/ГГГГ — приводим к ГГГГ-ММ-ДД. */
export function normalizeDateValue(input: string): string {
  const s = input.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(s);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}
