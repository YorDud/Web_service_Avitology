/* Шаблоны JSON-запросов к SocPublic с плейсхолдерами {{name}}, {{links}} и т.п.
   Чистые функции — их же использует админка для проверки шаблона до сохранения. */

export type TemplateVars = Record<string, string | number | string[]>;

function renderValue(value: unknown, vars: TemplateVars): unknown {
  if (typeof value === "string") {
    const exact = /^\{\{\s*(\w+)\s*\}\}$/.exec(value);
    if (exact && exact[1] in vars) return vars[exact[1]]; // целиком плейсхолдер — сохраняем тип (массив, число)
    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
      const found = vars[key];
      if (found === undefined) return "";
      return Array.isArray(found) ? found.join("\n") : String(found);
    });
  }
  if (Array.isArray(value)) return value.map((item) => renderValue(item, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, renderValue(item, vars)]));
  }
  return value;
}

export function validateTemplate(template: string): { ok: true } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(template);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Шаблон должен быть JSON-объектом: { \"поле\": \"значение\" }." };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Некорректный JSON: ${error instanceof Error ? error.message : "ошибка разбора"}` };
  }
}

export function renderTemplate(template: string, vars: TemplateVars): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const valid = validateTemplate(template);
  if (!valid.ok) return valid;
  return { ok: true, data: renderValue(JSON.parse(template), vars) as Record<string, unknown> };
}
