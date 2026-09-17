"""Run from the avitology-app project root: python upgrade_to_pro.py
Creates/updates the Pro subscription implementation. A .bak file is made once per edited file.
"""
from pathlib import Path
import shutil

ROOT = Path.cwd()

def path(name): return ROOT / name

def backup(p):
    if p.exists() and not p.with_suffix(p.suffix + '.bak-pro').exists():
        shutil.copy2(p, p.with_suffix(p.suffix + '.bak-pro'))

def replace(p, old, new, required=True):
    s = p.read_text(encoding="utf-8")

    # Скрипт разрешено запускать повторно:
    # если новое значение уже присутствует, ничего не меняем.
    if old not in s:
        print(f"[skip] Уже обновлено или не требуется: {p}")
        return

    backup(p)
    p.write_text(s.replace(old, new), encoding="utf-8")
    print(f"[ok] Обновлён: {p}")

def write(name, text):
    p=path(name); p.parent.mkdir(parents=True, exist_ok=True); backup(p); p.write_text(text,encoding='utf-8')

# Schema: Pro enum.
p=path('prisma/schema.prisma')
replace(p, 'enum SubscriptionLevel {\n  free\n  basic\n  admin\n}', 'enum SubscriptionLevel {\n  free\n  basic\n  pro\n  admin\n}')

# Global event retention.
p=path('lib/avito-bidder-events.ts')
replace(p, 'const BIDDER_EVENTS_RETENTION_DAYS = 2;', 'const BIDDER_EVENTS_RETENTION_DAYS = 7;')

write('lib/subscription-plans.ts', r'''export type SubscriptionTier = "basic" | "pro";
export type SubscriptionPlanCode = "basic_1m" | "basic_3m" | "basic_6m" | "pro_1m" | "pro_3m" | "pro_6m";

type SubscriptionPlan = { code: SubscriptionPlanCode; tier: SubscriptionTier; title: string; months: number; price: number; discountPercent: number; description: string };
const createPlans = (tier: SubscriptionTier, monthlyPrice: number, label: string): Record<`${SubscriptionTier}_${"1m"|"3m"|"6m"}`, SubscriptionPlan> => ({
  [`${tier}_1m`]: { code: `${tier}_1m`, tier, title: "1 месяц", months: 1, price: monthlyPrice, discountPercent: 0, description: `Оплата подписки ${label} на 1 месяц` },
  [`${tier}_3m`]: { code: `${tier}_3m`, tier, title: "3 месяца", months: 3, price: Math.round(monthlyPrice * 3 * .9), discountPercent: 10, description: `Оплата подписки ${label} на 3 месяца` },
  [`${tier}_6m`]: { code: `${tier}_6m`, tier, title: "6 месяцев", months: 6, price: Math.round(monthlyPrice * 6 * .75), discountPercent: 25, description: `Оплата подписки ${label} на 6 месяцев` },
});
export const SUBSCRIPTION_PLANS = { ...createPlans("basic", 299, "Basic"), ...createPlans("pro", 799, "Pro") } as const;
// Legacy codes are accepted for old links and existing payments.
const LEGACY_CODES: Record<string, SubscriptionPlanCode> = { "1m": "basic_1m", "3m": "basic_3m", "6m": "basic_6m" };
export function getSubscriptionPlan(planCode?: string) { return SUBSCRIPTION_PLANS[(LEGACY_CODES[planCode ?? ""] ?? planCode ?? "basic_1m") as SubscriptionPlanCode] ?? SUBSCRIPTION_PLANS.basic_1m; }
export function getSubscriptionPlans(tier: SubscriptionTier) { return Object.values(SUBSCRIPTION_PLANS).filter((plan) => plan.tier === tier); }
''')

write('lib/payments/activate-subscription.ts', r'''import { prisma } from "@/lib/prisma";
import type { SubscriptionTier } from "@/lib/subscription-plans";
export async function activateSubscription(userId: number, tier: SubscriptionTier, options: { months?: number; price?: number; paidAt?: Date } = {}) {
  const months = options.months ?? 1; const price = options.price ?? (tier === "pro" ? 799 : 299); const paidAt = options.paidAt ?? new Date();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Пользователь не найден");
  // Admin is never downgraded by a test or payment flow.
  if (user.subscriptionLevel === "admin") return user;
  const base = user.subscriptionEndsAt && user.subscriptionEndsAt > paidAt ? user.subscriptionEndsAt : paidAt;
  const subscriptionEndsAt = new Date(base); subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + months);
  return prisma.user.update({ where: { id: userId }, data: { subscriptionLevel: tier, subscriptionPrice: price, subscriptionPaidAt: paidAt, subscriptionEndsAt } });
}
''')

# Rework activation imports/calls in payment source files.
for n in ['app/api/payments/create/route.ts','app/api/payments/webhook/yookassa/route.ts','lib/payments/sync-yookassa-payment.ts']:
    p=path(n); s=p.read_text(encoding='utf-8'); backup(p)
    s=s.replace('import { activateBasicSubscription } from "@/lib/payments/activate-basic-subscription";', 'import { activateSubscription } from "@/lib/payments/activate-subscription";')
    s=s.replace('activateBasicSubscription(payment.userId, {\n          months: payment.durationMonths || 1,\n          price: payment.amount,\n        })', 'activateSubscription(payment.userId, getSubscriptionPlan(payment.planCode).tier, { months: payment.durationMonths || 1, price: payment.amount })')
    s=s.replace('activateBasicSubscription(payment.userId);', 'activateSubscription(payment.userId, getSubscriptionPlan(payment.planCode).tier, { months: payment.durationMonths || 1, price: payment.amount });')
    s=s.replace('activateBasicSubscription(user.id, {\n        months: plan.months,\n        price: plan.price,\n      })', 'activateSubscription(user.id, plan.tier, { months: plan.months, price: plan.price })')
    if 'getSubscriptionPlan(payment.planCode)' in s and 'subscription-plans' not in s:
        s=s.replace('import { getYookassaPayment } from "@/lib/payments/yookassa";', 'import { getYookassaPayment } from "@/lib/payments/yookassa";\nimport { getSubscriptionPlan } from "@/lib/subscription-plans";')
    p.write_text(s,encoding='utf-8')

# Payment creation uses chosen valid Basic/Pro code and records tier.
p=path('app/api/payments/create/route.ts'); s=p.read_text(encoding='utf-8'); backup(p)
s=s.replace('const planCode = body?.planCode || "1m";', 'const planCode = body?.planCode || "basic_1m";')
s=s.replace('`Тестовая активация подписки Basic (${plan.title})`', '`Тестовая активация подписки ${plan.tier === "pro" ? "Pro" : "Basic"} (${plan.title})`')
s=s.replace('planCode: plan.code,\n          }),', 'planCode: plan.code,\n            tier: plan.tier,\n          }),')
s=s.replace('planCode: plan.code,\n        }),', 'planCode: plan.code,\n          tier: plan.tier,\n        }),')
p.write_text(s,encoding='utf-8')

# Extension accepts Pro exactly like Basic.
for n in ['app/api/extension/access/route.ts','app/api/extension/token/route.ts','app/api/extension/avito-search-analyses/route.ts']:
    p=path(n); s=p.read_text(encoding='utf-8'); backup(p)
    s=s.replace('level === "basic" || level === "admin"','level === "basic" || level === "pro" || level === "admin"')
    s=s.replace('Нужна подписка Basic', 'Нужна подписка Basic или Pro').replace('доступно с подпиской Basic','доступно с подпиской Basic или Pro')
    p.write_text(s,encoding='utf-8')

# All bidder technical routes become Pro/Admin. Worker routes are strictly Admin.
for p in path('app/api/avito-bidders').rglob('route.ts'):
    s=p.read_text(encoding='utf-8'); backup(p)
    s=s.replace('level === "basic" || level === "admin"', 'level === "pro" || level === "admin"')
    s=s.replace('подпиской Basic', 'подпиской Pro')
    p.write_text(s,encoding='utf-8')
for n in ['app/api/avito-bidders/worker-runs/route.ts','app/api/avito-bidders/worker-run-now/route.ts']:
    p=path(n); s=p.read_text(encoding='utf-8'); backup(p)
    s=s.replace('return level === "pro" || level === "admin";', 'return level === "admin";')
    s=s.replace('Бид-менеджер доступен с подпиской Pro', 'Мониторинг worker доступен только администраторам')
    p.write_text(s,encoding='utf-8')

# Limit 10 total created bidders for Pro; Admin remains unlimited.
p=path('app/api/avito-bidders/route.ts'); s=p.read_text(encoding='utf-8'); backup(p)
needle='  const auth = await getAuthorizedUser(); if ("error" in auth) return auth.error;\n  const body ='
insert='''  const auth = await getAuthorizedUser(); if ("error" in auth) return auth.error;
  // Pro limit counts every created strategy: active, paused and attention.
  if (auth.user.subscriptionLevel !== "admin") {
    const bidderCount = await prisma.avitoBidder.count({ where: { userId: auth.user.id } });
    if (bidderCount >= 10) return NextResponse.json({ error: "На тарифе Pro можно создать не более 10 bidder-ов. Удалите ненужную стратегию, чтобы добавить новую." }, { status: 403 });
  }
  const body ='''
if needle not in s: raise RuntimeError('POST marker not found in bidder route')
p.write_text(s.replace(needle,insert),encoding='utf-8')

# Dashboard: normal services = Basic/Pro/Admin; bidder only = Pro/Admin; add BETA and a Pro upgrade screen.
p=path('app/dashboard/dashboard-client.tsx'); s=p.read_text(encoding='utf-8'); backup(p)
s=s.replace('case "basic":\n      return "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";', 'case "basic":\n      return "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";\n    case "pro":\n      return "border-blue-200 bg-blue-50 text-blue-700";')
s=s.replace('''  const hasAccess =
    subscriptionLevel === "basic" || subscriptionLevel === "admin";
  const isAdmin = subscriptionLevel === "admin";''','''  const hasAccess = subscriptionLevel === "basic" || subscriptionLevel === "pro" || subscriptionLevel === "admin";
  const hasBidderAccess = subscriptionLevel === "pro" || subscriptionLevel === "admin";
  const isAdmin = subscriptionLevel === "admin";''')
s=s.replace('''    inDevelopment?: boolean;
  }[] = [''','''    inDevelopment?: boolean;
    beta?: boolean;
  }[] = [''')
old='''      description: hasAccess
        ? "Автоматическое управление ставками"
        : "Доступно с подпиской Basic",
      available: hasAccess,
    },'''
new='''      description: hasBidderAccess ? "Автоматическое управление ставками" : "Доступно с подпиской Pro",
      available: hasBidderAccess,
      beta: true,
    },'''
if old not in s: raise RuntimeError('Bidder menu marker not found')
s=s.replace(old,new)
# Blue BETA in both locked/available menu branches.
s=s.replace('''                          {item.inDevelopment && (
                            <span''','''                          {item.beta && (<span className="rounded-full border border-blue-300/30 bg-blue-400/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-blue-200">BETA</span>)}
                          {item.inDevelopment && (
                            <span''')
s=s.replace('''                        {item.inDevelopment && (
                          <span className="rounded-full border border-amber-300/20''','''                        {item.beta && (<span className="rounded-full border border-blue-300/30 bg-blue-400/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-blue-200">BETA</span>)}
                        {item.inDevelopment && (
                          <span className="rounded-full border border-amber-300/20''')
# Guard existing component and put access upgrade component before it.
s=s.replace('{activeSection === "bid-manager" && hasAccess && (', '''{activeSection === "bid-manager" && !hasBidderAccess && (
              <section className="overflow-hidden rounded-[32px] bg-black p-6 text-white shadow-[0_24px_65px_rgba(16,24,40,.2)] md:p-8"><div className="inline-flex rounded-full border border-blue-300/30 bg-blue-400/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-blue-200">BETA · Pro</div><h2 className="mt-5 text-3xl font-extrabold tracking-[-.05em] md:text-5xl">Бид-менеджер <span className="text-[#03bd48]">Авито</span></h2><p className="mt-4 max-w-2xl text-sm leading-7 text-white/65">Автоматическое управление CPX-ставками доступно на тарифе Pro. В Pro можно одновременно хранить до 10 созданных стратегий.</p><Link href="/pricing" className="btn-primary mt-6 inline-flex">Выбрать Pro</Link></section>
            )}
            {activeSection === "bid-manager" && hasBidderAccess && (''')
# Header BETA and 10-limit in guide.
s=s.replace('''Автоматизация продвижения</div><h2 className=''','''Автоматизация продвижения</div><div className="mb-3 inline-flex rounded-full border border-blue-300/30 bg-blue-400/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-blue-200">BETA</div><h2 className=''')
s=s.replace('''</div><div className="mt-4 rounded-2xl border border-amber-200''','''</div><div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><b>Лимит Pro.</b> На одном аккаунте можно хранить до 10 созданных bidder-стратегий. Активные, приостановленные и требующие внимания стратегии учитываются в этом лимите.</div><div className="mt-4 rounded-2xl border border-amber-200''')
p.write_text(s,encoding='utf-8')

# Admin UI: add pro type, visual style, select option, and default price.
p=path('app/admin/users-client.tsx'); s=p.read_text(encoding='utf-8'); backup(p)
s=s.replace('"free" | "basic" | "admin"', '"free" | "basic" | "pro" | "admin"')
s=s.replace('''    case "basic":
      return "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";''','''    case "basic": return "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";
    case "pro": return "border-blue-200 bg-blue-50 text-blue-700";''')
s=s.replace('<option value="basic">basic</option>\n                          <option value="admin">admin</option>', '<option value="basic">basic</option>\n                          <option value="pro">pro</option>\n                          <option value="admin">admin</option>')
p.write_text(s,encoding='utf-8')

# Admin backend validates subscription level and assigns Pro's base display price.
for n in ['app/api/admin/users/[id]/route.ts','app/api/admin/users/create/route.ts']:
    p=path(n); s=p.read_text(encoding='utf-8'); backup(p)
    s=s.replace('| "basic"\n      | "admin"', '| "basic"\n      | "pro"\n      | "admin"')
    s=s.replace('subscriptionPrice: subscriptionLevel === "basic" ? 299 : 0,', 'subscriptionPrice: subscriptionLevel === "basic" ? 299 : subscriptionLevel === "pro" ? 799 : 0,')
    # insert runtime validation after type assignment where relevant
    marker='    const subscriptionPrice = Number(body.subscriptionPrice || 0);'
    if marker in s: s=s.replace(marker, '    if (!["free", "basic", "pro", "admin"].includes(subscriptionLevel)) return NextResponse.json({ error: "Некорректный уровень подписки" }, { status: 400 });\n'+marker)
    p.write_text(s,encoding='utf-8')

# Ensure webhook/sync imports getSubscriptionPlan after universal activation changes.
for n in ['app/api/payments/webhook/yookassa/route.ts', 'lib/payments/sync-yookassa-payment.ts']:
    p=path(n); s=p.read_text(encoding='utf-8'); backup(p)
    if 'getSubscriptionPlan(payment.planCode)' in s and 'from "@/lib/subscription-plans"' not in s:
        s='import { getSubscriptionPlan } from "@/lib/subscription-plans";\n'+s
    p.write_text(s, encoding='utf-8')

# The existing pricing page imports this component, so it becomes the Basic/Pro choice without changing routes.
write('app/pricing/buy-basic-button.tsx', r'''"use client";
import Link from "next/link";
import { useState } from "react";
type PlanCode = "basic_1m"|"basic_3m"|"basic_6m"|"pro_1m"|"pro_3m"|"pro_6m";
type Props = { isYookassaEnabled: boolean; canUseFreeTrial: boolean; isFreeTrialEnabled: boolean };
const plans = [
  { code:"basic_1m", tier:"BASIC", price:"299 ₽", term:"1 месяц", discount:"" }, { code:"basic_3m", tier:"BASIC", price:"807 ₽", term:"3 месяца", discount:"−10%" }, { code:"basic_6m", tier:"BASIC", price:"1 345 ₽", term:"6 месяцев", discount:"−25%" },
  { code:"pro_1m", tier:"PRO", price:"799 ₽", term:"1 месяц", discount:"" }, { code:"pro_3m", tier:"PRO", price:"2 157 ₽", term:"3 месяца", discount:"−10%" }, { code:"pro_6m", tier:"PRO", price:"3 596 ₽", term:"6 месяцев", discount:"−25%" },
] as const;
export default function BuyBasicButton({isYookassaEnabled,canUseFreeTrial,isFreeTrialEnabled}: Props) {
 const [loading,setLoading]=useState<PlanCode|"trial"|null>(null); const [error,setError]=useState("");
 async function buy(planCode:PlanCode) { try { setLoading(planCode); setError(""); const res=await fetch("/api/payments/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planCode})}); const data=await res.json(); if(!res.ok) throw new Error(data?.error||"Не удалось создать платёж"); if(!data?.redirectUrl) throw new Error("Сервис оплаты не вернул ссылку для перехода"); window.location.href=data.redirectUrl; } catch(e) { setError(e instanceof Error?e.message:"Ошибка сети"); } finally { setLoading(null); } }
 async function trial() { try {setLoading("trial");setError("");const r=await fetch("/api/subscription/free-trial",{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d?.error||"Не удалось активировать пробный доступ");window.location.href=d.redirectUrl||"/dashboard";}catch(e){setError(e instanceof Error?e.message:"Ошибка сети")}finally{setLoading(null)} }
 return <div className="space-y-6"><div className="rounded-2xl border border-blue-300/35 bg-blue-400/10 p-4"><div className="text-lg font-extrabold text-blue-100">Pro — автоматизация продвижения</div><p className="mt-1 text-sm leading-6 text-white/70">Включает всё из Basic, бид-менеджер Авито и до 10 стратегий на аккаунт.</p></div><div className="grid gap-4 md:grid-cols-3">{plans.map(plan=><button key={plan.code} type="button" onClick={()=>buy(plan.code)} disabled={loading!==null} className={`rounded-2xl border p-5 text-left transition hover:-translate-y-1 disabled:opacity-60 ${plan.tier==="PRO"?"border-blue-300/45 bg-blue-400/15 hover:bg-blue-400/25":"border-white/20 bg-white/10 hover:bg-white/15"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-extrabold tracking-wide text-white/80">{plan.tier}</span>{plan.discount&&<span className="rounded-full bg-yellow-300 px-2 py-1 text-[10px] font-extrabold text-black">{plan.discount}</span>}</div><div className="mt-3 text-2xl font-extrabold">{plan.price}</div><div className="mt-1 text-sm text-white/75">{plan.term}</div><div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">{loading===plan.code?"Переход к оплате…":isYookassaEnabled?"Оплатить":"Активировать"}</div></button>)}</div><div className="flex flex-wrap gap-3">{isFreeTrialEnabled&&canUseFreeTrial&&<button type="button" onClick={trial} disabled={loading!==null} className="btn-secondary disabled:opacity-60">{loading==="trial"?"Активация…":"Попробовать Basic 1 день бесплатно"}</button>}<Link href="/dashboard" className="btn-secondary">В кабинет</Link></div>{error&&<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}</div>;
}''')

# Pricing copy now describes two plans.
p=path('app/pricing/page.tsx'); s=p.read_text(encoding='utf-8'); backup(p)
s=s.replace('Один тариф — все основные инструменты', 'Два тарифа — доступ под ваши задачи').replace('Подписка Basic открывает доступ к рабочим модулям, личному\n              кабинету и текущим сервисам HelpSell.', 'Basic открывает аналитику и расширение. Pro включает всё из Basic, а также бид-менеджер Авито.')
p.write_text(s, encoding='utf-8')

print('Done. Run: npx prisma migrate dev --name add_pro_subscription && npx prisma generate && npm run build')
