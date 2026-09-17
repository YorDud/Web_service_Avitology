export type SubscriptionTier = "basic" | "pro";

export type SubscriptionPlanCode =
  | "basic_1m"
  | "basic_3m"
  | "basic_6m"
  | "pro_1m"
  | "pro_3m"
  | "pro_6m";

export type SubscriptionPlan = {
  code: SubscriptionPlanCode;
  tier: SubscriptionTier;
  title: string;
  months: number;
  price: number;
  discountPercent: number;
  description: string;
};

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlanCode,
  SubscriptionPlan
> = {
  basic_1m: {
    code: "basic_1m",
    tier: "basic",
    title: "1 месяц",
    months: 1,
    price: 299,
    discountPercent: 0,
    description: "Оплата подписки Basic на 1 месяц",
  },
  basic_3m: {
    code: "basic_3m",
    tier: "basic",
    title: "3 месяца",
    months: 3,
    price: 807,
    discountPercent: 10,
    description: "Оплата подписки Basic на 3 месяца",
  },
  basic_6m: {
    code: "basic_6m",
    tier: "basic",
    title: "6 месяцев",
    months: 6,
    price: 1345,
    discountPercent: 25,
    description: "Оплата подписки Basic на 6 месяцев",
  },

  pro_1m: {
    code: "pro_1m",
    tier: "pro",
    title: "1 месяц",
    months: 1,
    price: 799,
    discountPercent: 0,
    description: "Оплата подписки Pro на 1 месяц",
  },
  pro_3m: {
    code: "pro_3m",
    tier: "pro",
    title: "3 месяца",
    months: 3,
    price: 2157,
    discountPercent: 10,
    description: "Оплата подписки Pro на 3 месяца",
  },
  pro_6m: {
    code: "pro_6m",
    tier: "pro",
    title: "6 месяцев",
    months: 6,
    price: 3596,
    discountPercent: 25,
    description: "Оплата подписки Pro на 6 месяцев",
  },
};

// Старые коды сохраняются ради совместимости со старыми платежами.
const LEGACY_PLAN_CODES: Record<string, SubscriptionPlanCode> = {
  "1m": "basic_1m",
  "3m": "basic_3m",
  "6m": "basic_6m",
};

export function getSubscriptionPlan(planCode?: string | null) {
  const resolvedCode =
    LEGACY_PLAN_CODES[planCode ?? ""] ??
    (planCode as SubscriptionPlanCode | undefined) ??
    "basic_1m";

  return SUBSCRIPTION_PLANS[resolvedCode] ?? SUBSCRIPTION_PLANS.basic_1m;
}

export function getSubscriptionPlans(tier: SubscriptionTier) {
  return Object.values(SUBSCRIPTION_PLANS).filter(
    (plan) => plan.tier === tier,
  );
}