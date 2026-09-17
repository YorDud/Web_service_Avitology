import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { createBidderEvent } from "@/lib/avito-bidder-events";

function hasBidderAccess(level: string | null | undefined) { return level === "pro" || level === "admin"; }
function isNonEmptyString(value: unknown, maxLength = 300): value is string { return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength; }
function isPositiveInteger(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value > 0; }
function isNonNegativeInteger(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= 0; }
function isValidCheckInterval(value: unknown): value is number { return isPositiveInteger(value) && [5, 10, 15, 30, 60].includes(value); }
function isValidBidderMode(value: unknown): value is "dry_run" | "live" { return value === "dry_run" || value === "live"; }
function getNextCheckAt(minutes: number) { return new Date(Date.now() + minutes * 60_000); }
function serializeBidder(bidder: any) { return { ...bidder, nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null, lastCheckedAt: bidder.lastCheckedAt?.toISOString() ?? null, lastAppliedAt: bidder.lastAppliedAt?.toISOString() ?? null, positionCheckedAt: bidder.positionCheckedAt?.toISOString() ?? null, createdAt: bidder.createdAt.toISOString(), updatedAt: bidder.updatedAt.toISOString() }; }
async function getAuthorizedUser() { const sessionUser = await getSessionUser(); if (!sessionUser) return { error: NextResponse.json({ error: "РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ" }, { status: 401 }) }; const user = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { id: true, subscriptionLevel: true } }); if (!user || !hasBidderAccess(user.subscriptionLevel)) return { error: NextResponse.json({ error: "Р‘РёРґ-РјРµРЅРµРґР¶РµСЂ РґРѕСЃС‚СѓРїРµРЅ СЃ РїРѕРґРїРёСЃРєРѕР№ Pro" }, { status: 403 }) }; return { user }; }

export async function GET() { const auth = await getAuthorizedUser(); if ("error" in auth) return auth.error; const bidders = await prisma.avitoBidder.findMany({ where: { userId: auth.user.id }, orderBy: { updatedAt: "desc" } }); return NextResponse.json({ bidders: bidders.map(serializeBidder) }); }

export async function POST(request: Request) {
  const auth = await getAuthorizedUser(); if ("error" in auth) return auth.error;
  // Pro limit counts every created strategy: active, paused and attention.
  if (auth.user.subscriptionLevel !== "admin") {
    const bidderCount = await prisma.avitoBidder.count({ where: { userId: auth.user.id } });
    if (bidderCount >= 10) return NextResponse.json({ error: "РќР° С‚Р°СЂРёС„Рµ Pro РјРѕР¶РЅРѕ СЃРѕР·РґР°С‚СЊ РЅРµ Р±РѕР»РµРµ 10 bidder-РѕРІ. РЈРґР°Р»РёС‚Рµ РЅРµРЅСѓР¶РЅСѓСЋ СЃС‚СЂР°С‚РµРіРёСЋ, С‡С‚РѕР±С‹ РґРѕР±Р°РІРёС‚СЊ РЅРѕРІСѓСЋ." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !isNonEmptyString(body.title, 300)) return NextResponse.json({ error: "РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅРѕРµ РЅР°Р·РІР°РЅРёРµ РѕР±СЉСЏРІР»РµРЅРёСЏ." }, { status: 400 });
  const avitoItemId = typeof body.avitoItemId === "string" && body.avitoItemId.trim() ? body.avitoItemId.trim() : null;
  if (!avitoItemId || !/^\d+$/.test(avitoItemId) || Number(avitoItemId) <= 0) return NextResponse.json({ error: "Р’С‹Р±РµСЂРёС‚Рµ СЂРµР°Р»СЊРЅРѕРµ РѕР±СЉСЏРІР»РµРЅРёРµ РђРІРёС‚Рѕ." }, { status: 400 });
  if (!isPositiveInteger(body.targetFrom) || !isPositiveInteger(body.targetTo) || body.targetFrom > body.targetTo) return NextResponse.json({ error: "РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РґРёР°РїР°Р·РѕРЅ С†РµР»РµРІС‹С… РїРѕР·РёС†РёР№." }, { status: 400 });
  if (!isNonNegativeInteger(body.minBid) || !isNonNegativeInteger(body.maxBid) || body.minBid > body.maxBid) return NextResponse.json({ error: "РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РґРёР°РїР°Р·РѕРЅ CPX-СЃС‚Р°РІРѕРє." }, { status: 400 });
  if (!isPositiveInteger(body.bidStep) || (body.maxBid > body.minBid && body.bidStep > body.maxBid - body.minBid)) return NextResponse.json({ error: "РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ С€Р°Рі РёР·РјРµРЅРµРЅРёСЏ СЃС‚Р°РІРєРё." }, { status: 400 });
  if (!isNonNegativeInteger(body.dailySpendLimit)) return NextResponse.json({ error: "РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РґРЅРµРІРЅРѕР№ Р»РёРјРёС‚ CPX." }, { status: 400 });
  if (!isValidCheckInterval(body.checkInterval)) return NextResponse.json({ error: "Р’С‹Р±РµСЂРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРЅС‚РµСЂРІР°Р» РїСЂРѕРІРµСЂРєРё." }, { status: 400 });
  if (!isNonEmptyString(body.schedule, 200)) return NextResponse.json({ error: "РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅРѕРµ СЂР°СЃРїРёСЃР°РЅРёРµ." }, { status: 400 });
  const searchUrl = typeof body.searchUrl === "string" && body.searchUrl.trim() ? body.searchUrl.trim() : null;
  const avitoItemUrl = typeof body.avitoItemUrl === "string" && body.avitoItemUrl.trim() ? body.avitoItemUrl.trim() : null;
  const groupName = typeof body.groupName === "string" && body.groupName.trim() ? body.groupName.trim() : null;
  const mode = isValidBidderMode(body.mode) ? body.mode : "dry_run";
  const bidder = await prisma.avitoBidder.create({ data: { userId: auth.user.id, title: body.title.trim(), groupName, // Legacy DB columns: deliberately retained with neutral values; UI no longer uses them.
    city: "РќРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ", query: "РќРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ", searchUrl, avitoItemId, avitoItemUrl, targetFrom: body.targetFrom, targetTo: body.targetTo, currentBid: body.minBid, minBid: body.minBid, maxBid: body.maxBid, bidStep: body.bidStep, dailySpendLimit: body.dailySpendLimit, spentToday: 0, smartEconomyEnabled: body.smartEconomyEnabled === true, checkInterval: body.checkInterval, schedule: body.schedule.trim(), status: "paused", mode, nextCheckAt: getNextCheckAt(body.checkInterval), promotionStrategy: "cpx_manual", promotionDurationDays: 0, lastPromotionStatus: "cpx_not_checked" } });
  await createBidderEvent({ bidderId: bidder.id, type: "bidder_created", message: `РЎРѕР·РґР°РЅ bidder В«${bidder.title}В» РІ СЂРµР¶РёРјРµ ${bidder.mode}.` });
  return NextResponse.json({ bidder: serializeBidder(bidder) }, { status: 201 });
}
