import { FIELD_BY_TAG, tagLabel } from "./fields";
import type { CatalogField } from "./types";

/* =========================================================================
   Что подставить в таблицу, когда пользователь выбрал раздел в каталоге Авито.

   Важно: в XML поле Category — НЕ название выбранного подраздела. Например, для «Наушники»
   Авито ждёт Category = «Аудио и видео», а «Наушники» — это значение поля GoodsType.
   Точные значения берутся из полей выбранного раздела (GET /autoload/v1/user-docs/node/{slug}/fields).
   ========================================================================= */

/** Поля, которые заполняет сам пользователь — их значения из справочника не подставляем. */
const USER_TAGS = new Set([
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
  node: { name: string; path?: string; slug: string | null },
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
      allowed.find((value) => value === node.name) ??
      allowed.find((value) => segments.includes(value)) ??
      allowed[0];
    values.Category = pick;
  } else {
    values.Category = node.name;
    warnings.push(
      node.slug
        ? "Авито не вернул допустимые значения поля «Категория» для этого раздела — подставлено название раздела. Если при загрузке будет ошибка про категорию, выберите более вложенный раздел."
        : "Это общий раздел без собственных полей — подставлено его название. Выберите более вложенный раздел (например, конкретный вид товара), иначе Авито может не принять категорию.",
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
