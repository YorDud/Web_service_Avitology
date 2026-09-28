import { NextResponse } from "next/server";
import { avito } from "@/lib/autoload/avito";
import {
  fail,
  flattenCatalog,
  parseCatalogFields,
  requireAccount,
  requireAutoloadUser,
  routeError,
} from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/autoload/catalog            — дерево категорий Авито (плоским списком)
 * GET /api/autoload/catalog?slug=...   — поля выбранной категории
 */
export async function GET(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  const slug = new URL(request.url).searchParams.get("slug");

  try {
    if (slug) {
      if (!/^[\w.-]{1,120}$/.test(slug)) return fail("Некорректный код категории.");
      const raw = await avito.nodeFields(account, slug);
      return NextResponse.json({ fields: parseCatalogFields(raw) });
    }

    const raw = await avito.tree(account);
    return NextResponse.json({ nodes: flattenCatalog(raw) });
  } catch (error) {
    return routeError(error);
  }
}
