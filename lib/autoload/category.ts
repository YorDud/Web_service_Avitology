import { FIELD_BY_TAG, TEMPLATE_EXAMPLES, TEMPLATE_TAGS, tagLabel } from "./fields";
import type { CatalogField } from "./types";

/* =========================================================================
   Что подставить в таблицу, когда пользователь выбрал раздел в каталоге Авито.

   Важно: в XML поле Category — НЕ название выбранного подраздела. Например, для «Наушники»
   Авито ждёт Category = «Аудио и видео», а «Наушники» — это значение поля GoodsType.
   Точные значения берутся из полей выбранного раздела (GET /autoload/v1/user-docs/node/{slug}/fields).
   ========================================================================= */

/** Поля, которые заполняет сам пользователь — их значения из справочника не подставляем. */
export const USER_TAGS = new Set([
  "Id",
  "Title",
  "Description",
  "Price",
  "Images",
  "VideoURL",
  "Address",
  "Latitude",
  "Longitude",
  "ContactPhone",
  "ManagerName",
  "DateBegin",
  "DateEnd",
]);

/** Даже если Авито не пометил поле обязательным, единственное допустимое значение для них ставим сами. */
const ALWAYS_FIXED = new Set(["GoodsType", "AdType"]);

/**
 * Поля «Авито Доставки», появившиеся в полях категорий с 1 октября 2026 года (ТН ВЭД, ОКПД 2,
 * «Честный знак», коды GTIN, «Документы не нужны» — закон № 289-ФЗ о платформенной экономике).
 * Нужны, только если для товара используется «Авито Доставка»: без них объявление с доставкой
 * не пройдёт проверку, но без доставки можно размещать объявление и без этих полей. Показываем
 * их отдельной группой, чтобы пользователь сам решил, нужна ли ему доставка для этого товара —
 * в обычные «обязательные» и «необязательные» их не смешиваем, какой бы флаг ни прислал Авито.
 */
export const DELIVERY_TAGS = new Set(["TNVED", "OKPD2", "SquareSymbol", "NoDocuments", "CodeGTIN"]);

export function isDeliveryTag(tag: string) {
  return DELIVERY_TAGS.has(tag);
}

export type CategoryResolution = {
  /** Значения, которые надо записать (Category и фиксированные поля раздела). */
  values: Record<string, string>;
  /** Допустимые значения для выпадающих списков (тег → варианты). */
  options: Record<string, string[]>;
  /** Обязательные поля раздела, которых нет среди стандартных — добавляем столбцами. */
  requiredColumns: string[];
  /** Читаемая сводка, что подставили. */
  summary: string[];
  warnings: string[];
};

export function resolveCategoryFields(
  node: { name: string; path?: string; slug: string | null; group?: string | null },
  fields: CatalogField[],
): CategoryResolution {
  const values: Record<string, string> = {};
  const options: Record<string, string[]> = {};
  const requiredColumns: string[] = [];
  const summary: string[] = [];
  const warnings: string[] = [];

  const categoryField = fields.find((field) => field.tag === "Category");
  const allowed = categoryField?.values ?? [];

  if (allowed.length > 0) {
    const segments = (node.path ?? "").split("›").map((part) => part.trim());
    const pick =
      (node.group ? allowed.find((value) => value === node.group) : undefined) ??
      allowed.find((value) => value === node.name) ??
      allowed.find((value) => segments.includes(value)) ??
      allowed[0];
    values.Category = pick;
  } else if (node.group) {
    // Авито не прислал список допустимых значений — берём промежуточный раздел из дерева каталога
    // (для «Наушники» это «Аудио и видео»).
    values.Category = node.group;
    warnings.push(
      `Авито не прислал допустимые значения поля «Категория» — подставили раздел «${node.group}» из каталога. Если после загрузки Авито напишет про категорию, скажите нам, какой пункт вы выбирали.`,
    );
  } else {
    values.Category = node.name;
    warnings.push(
      node.slug
        ? "Авито не прислал допустимые значения поля «Категория» для этого раздела — подставлено его название. Если при загрузке будет ошибка про категорию, выберите более вложенный пункт."
        : "Это общий раздел без собственных полей — подставлено его название. Выберите более вложенный пункт (конкретный вид товара), иначе Авито может не принять категорию.",
    );
  }
  summary.push(`Категория: ${values.Category}`);

  for (const field of fields) {
    if (field.tag === "Category" || USER_TAGS.has(field.tag)) continue;

    if (field.values.length === 1 && (field.required || ALWAYS_FIXED.has(field.tag))) {
      values[field.tag] = field.values[0];
      summary.push(`${tagLabel(field.tag)}: ${field.values[0]}`);
      continue;
    }

    if (field.values.length > 1) {
      options[field.tag] = field.values.slice(0, 300);
      if (field.required && !FIELD_BY_TAG[field.tag]) requiredColumns.push(field.tag);
    } else if (field.required && field.values.length === 0 && !FIELD_BY_TAG[field.tag]) {
      requiredColumns.push(field.tag);
    }
  }

  return { values, options, requiredColumns, summary, warnings };
}

/** Столбец образца таблицы: тег, подпись и пример значения. */
export type TemplateColumn = { tag: string; label: string; example: string };

/**
 * Образец для конкретной категории: стандартные столбцы (как в общем образце) плюс
 * недостающие обязательные поля этой категории, с реальными допустимыми значениями
 * Авито там, где они есть.
 */
export function buildCategoryTemplateColumns(
  node: { name: string; path?: string; slug: string | null; group?: string | null },
  fields: CatalogField[],
): TemplateColumn[] {
  const resolution = resolveCategoryFields(node, fields);
  const byTag = new Map(fields.map((field) => [field.tag, field]));
  const columns = new Map<string, TemplateColumn>();

  for (const tag of TEMPLATE_TAGS) {
    columns.set(tag, { tag, label: tagLabel(tag), example: TEMPLATE_EXAMPLES[tag] ?? "" });
  }
  for (const [tag, value] of Object.entries(resolution.values)) {
    columns.set(tag, { tag, label: byTag.get(tag)?.label || tagLabel(tag), example: value });
  }
  for (const tag of resolution.requiredColumns) {
    if (columns.has(tag)) continue;
    columns.set(tag, { tag, label: byTag.get(tag)?.label || tagLabel(tag), example: resolution.options[tag]?.[0] ?? "" });
  }
  for (const [tag, values] of Object.entries(resolution.options)) {
    const existing = columns.get(tag);
    if (existing && !existing.example) existing.example = values[0] ?? "";
  }

  // Поля «Авито Доставки» помечаем пояснением в заголовке независимо от того, добавились ли они
  // уже выше как обязательные (бывает и так — тогда оставляем их настоящий пример) или добавляются
  // только сейчас (тогда пример оставляем пустым: например, у «Документы не нужны» первое допустимое
  // значение — «Подтверждаю», автоматически проставлять такое юридически значимое значение не стоит).
  const DELIVERY_SUFFIX = " — только для Авито Доставки";
  for (const field of fields) {
    if (!isDeliveryTag(field.tag)) continue;
    const existing = columns.get(field.tag);
    const label = existing ? (existing.label.endsWith(DELIVERY_SUFFIX) ? existing.label : `${existing.label}${DELIVERY_SUFFIX}`) : `${field.label}${DELIVERY_SUFFIX}`;
    columns.set(field.tag, { tag: field.tag, label, example: existing ? existing.example : "" });
  }

  return [...columns.values()];
}
