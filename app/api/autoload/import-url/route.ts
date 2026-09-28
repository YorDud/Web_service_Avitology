import { NextResponse } from "next/server";
import { buildImport } from "@/lib/autoload/import";
import { resolveSheetUrl, SheetImportError } from "@/lib/autoload/sheet-import";
import { fail, requireAutoloadUser, routeError } from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Импорт таблицы объявлений по ссылке: Google Таблица, Яндекс Таблица/Диск
 * или прямая ссылка на файл (.csv, .xlsx). Разбор идёт на сервере — у этих
 * сервисов нет открытого доступа из браузера (CORS). Результат в том же
 * формате, что и обычный импорт вставленного текста ({ ads, mapping, recognized }).
 */
export async function POST(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return fail("Вставьте ссылку на таблицу.");
  if (url.length > 2000) return fail("Слишком длинная ссылка.");

  try {
    const rows = await resolveSheetUrl(url);
    if (rows.length === 0) return fail("В таблице по этой ссылке нет данных.");
    return NextResponse.json(buildImport(rows));
  } catch (error) {
    if (error instanceof SheetImportError) return fail(error.message);
    return routeError(error);
  }
}
