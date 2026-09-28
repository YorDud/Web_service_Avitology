import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { avito, AvitoApiError } from "@/lib/autoload/avito";
import { normalizeUpload, requireAccount, requireAutoloadUser, routeError } from "@/lib/autoload/server";
import type { IssueAd, IssueGroup, IssuesResponse } from "@/lib/autoload/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_PAGE = 100;
const MAX_PAGES = 60;
const MAX_ADS_PER_GROUP = 200;
const SEVERITY: Record<string, number> = { error: 0, warning: 1, alarm: 2 };

/**
 * Что именно не так в последней загрузке: сообщения Авито по объявлениям, сгруппированные по причине,
 * со ссылкой на нужные объявления в таблицах пользователя.
 */
export async function GET() {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  try {
    const current = await avito.currentUpload(account);
    const upload = current ?? (await avito.lastSuccessfulUpload(account));
    if (!upload) {
      const empty: IssuesResponse = { upload: null, partial: false, groups: [], adsWithIssues: 0, totalAds: 0 };
      return NextResponse.json(empty);
    }
    const summary = normalizeUpload(upload);
    const useCurrent = Boolean(current);

    type RawItem = { ad_id?: unknown; avito_id?: unknown; avito_status?: unknown; url?: unknown; messages?: unknown };
    const problemItems: { adKey: string; avitoId: string | null; url: string | null; messages: { type: string; code: number; title: string; description: string }[] }[] = [];
    let totalAds = 0;

    const startedAt = Date.now();
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      if (Date.now() - startedAt > 40_000) {
        throw new AvitoApiError("Отчёт Авито слишком большой — не успели получить его за отведённое время. Повторите чуть позже.", 504);
      }
      const raw = useCurrent
        ? await avito.currentUploadItems(account, { page, perPage: PER_PAGE })
        : await avito.lastSuccessfulUploadItems(account, { page, perPage: PER_PAGE });
      const items: RawItem[] = Array.isArray(raw?.items) ? raw.items : [];
      totalAds += items.length;

      for (const item of items) {
        const messages = (Array.isArray(item.messages) ? (item.messages as Record<string, unknown>[]) : [])
          .map((m) => ({
            type: String(m.type ?? ""),
            code: Number(m.code) || 0,
            title: String(m.title ?? ""),
            description: String(m.description ?? ""),
          }))
          .filter((m) => m.type in SEVERITY);
        if (messages.length === 0) continue;
        problemItems.push({
          adKey: String(item.ad_id ?? ""),
          avitoId: item.avito_id !== undefined && item.avito_id !== null ? String(item.avito_id) : null,
          url: typeof item.url === "string" ? item.url : null,
          messages,
        });
      }

      const pages = Number(raw?.meta?.pages);
      if (items.length < PER_PAGE || (Number.isFinite(pages) && page >= pages)) break;
    }

    // сопоставляем с объявлениями в таблицах пользователя
    const known = new Map<string, { title: string | null; feedId: number; feedName: string }>();
    const keys = [...new Set(problemItems.map((item) => item.adKey).filter(Boolean))];
    for (let i = 0; i < keys.length; i += 500) {
      const rows = await prisma.autoloadAd.findMany({
        where: { adKey: { in: keys.slice(i, i + 500) }, feed: { userId: auth.user.id } },
        select: { adKey: true, data: true, feed: { select: { id: true, name: true } } },
      });
      for (const row of rows) {
        const data = (row.data ?? {}) as Record<string, unknown>;
        known.set(row.adKey, {
          title: typeof data.Title === "string" ? data.Title : null,
          feedId: row.feed.id,
          feedName: row.feed.name,
        });
      }
    }

    const groups = new Map<string, IssueGroup>();
    for (const item of problemItems) {
      const ad: IssueAd = {
        adKey: item.adKey,
        title: known.get(item.adKey)?.title ?? null,
        feedId: known.get(item.adKey)?.feedId ?? null,
        feedName: known.get(item.adKey)?.feedName ?? null,
        avitoId: item.avitoId,
        url: item.url,
      };
      for (const message of item.messages) {
        const key = `${message.type}:${message.code}:${message.title}`;
        let group = groups.get(key);
        if (!group) {
          group = { type: message.type, code: message.code, title: message.title, description: message.description, count: 0, ads: [] };
          groups.set(key, group);
        }
        group.count += 1;
        if (group.ads.length < MAX_ADS_PER_GROUP) group.ads.push(ad);
      }
    }

    const result: IssuesResponse = {
      upload: summary,
      partial: summary.status === "processing",
      groups: [...groups.values()].sort((a, b) => SEVERITY[a.type] - SEVERITY[b.type] || b.count - a.count),
      adsWithIssues: problemItems.length,
      totalAds,
    };
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
