import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { avito, AvitoApiError } from "@/lib/autoload/avito";
import {
  fail,
  normalizeUpload,
  parseFeedId,
  requireAccount,
  requireAutoloadUser,
  routeError,
} from "@/lib/autoload/server";
import type { SyncResult } from "@/lib/autoload/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

const PER_PAGE = 100; // максимум, который принимает /autoload/v4/uploads/*/items
const MAX_PAGES = 60; // покрывает MAX_ADS_PER_FEED = 5000

type UploadMessage = { type: string; title: string; description: string };

/**
 * Подтягивает статусы объявлений таблицы из последней завершённой загрузки
 * (/autoload/v4/uploads/last_successful/items). Если её ещё нет, но есть
 * загрузка в процессе (/autoload/v4/uploads/current/items) — используем её
 * и помечаем результат как предварительный (partial).
 */
export async function POST(_request: Request, context: Context) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const feedId = parseFeedId((await context.params).id);
  if (!feedId) return fail("Таблица не найдена.", 404);

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  try {
    const feed = await prisma.autoloadFeed.findFirst({ where: { id: feedId, userId: auth.user.id } });
    if (!feed) return fail("Таблица не найдена.", 404);

    // Берём самую свежую загрузку (в т.ч. завершившуюся с замечаниями): «last_successful» у Авито
    // может указывать на более старую загрузку без ошибок, и тогда статусы были бы устаревшими.
    let uploadId = "";
    let partial = false;
    let useCurrent = false;
    const current = await avito.currentUpload(account);
    if (current) {
      const summary = normalizeUpload(current);
      uploadId = summary.id;
      partial = summary.status === "processing";
      useCurrent = true;
    } else {
      const last = await avito.lastSuccessfulUpload(account);
      if (last) uploadId = normalizeUpload(last).id;
    }

    if (!uploadId) {
      return fail("У Авито пока нет ни одной загрузки по вашим файлам. Запустите выгрузку и подождите её окончания.");
    }

    const ads = await prisma.autoloadAd.findMany({ where: { feedId }, select: { id: true, adKey: true } });
    const byKey = new Map(ads.map((ad) => [ad.adKey, ad.id]));

    const found = new Map<
      number,
      { avitoId: string | null; status: string | null; messages: UploadMessage[] }
    >();

    const startedAt = Date.now();
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      if (Date.now() - startedAt > 40_000) {
        throw new AvitoApiError("Отчёт Авито слишком большой — не успели получить его за отведённое время. Повторите чуть позже.", 504);
      }
      const raw = useCurrent
        ? await avito.currentUploadItems(account, { page, perPage: PER_PAGE })
        : await avito.lastSuccessfulUploadItems(account, { page, perPage: PER_PAGE });

      const items: Record<string, unknown>[] = Array.isArray(raw?.items) ? raw.items : [];

      for (const item of items) {
        const adKey = String(item.ad_id ?? "").trim();
        const dbId = byKey.get(adKey);
        if (dbId === undefined) continue;

        const rawMessages = Array.isArray(item.messages) ? (item.messages as Record<string, unknown>[]) : [];
        found.set(dbId, {
          avitoId: item.avito_id !== undefined && item.avito_id !== null ? String(item.avito_id) : null,
          status: typeof item.avito_status === "string" ? item.avito_status : null,
          messages: rawMessages.map((message) => ({
            type: String(message.type ?? ""),
            title: String(message.title ?? ""),
            description: String(message.description ?? ""),
          })),
        });
      }

      const pages = Number(raw?.meta?.pages);
      const finished = items.length < PER_PAGE || (Number.isFinite(pages) && page >= pages);
      if (finished) break;
    }

    const now = new Date();
    const entries = [...found];
    for (let i = 0; i < entries.length; i += 300) {
      await prisma.$transaction(
        entries.slice(i, i + 300).map(([id, info]) =>
          prisma.autoloadAd.update({
            where: { id },
            data: {
              avitoId: info.avitoId,
              avitoStatus: info.status,
              avitoMessages: info.messages,
              syncedAt: now,
            },
          }),
        ),
      );
    }

    const result: SyncResult = {
      uploadId,
      partial,
      matched: found.size,
      notFound: ads.length - found.size,
      errors: entries.filter(([, info]) => info.messages.some((m) => m.type === "error")).length,
      warnings: entries.filter(
        ([, info]) => !info.messages.some((m) => m.type === "error") && info.messages.some((m) => m.type === "warning"),
      ).length,
    };

    return NextResponse.json({ result });
  } catch (error) {
    return routeError(error);
  }
}
