export const SUBSCRIPTION_PLANS = {
  "1m": {
    code: "1m",
    title: "1 месяц",
    months: 1,
    price: 299,
    discountPercent: 0,
    description: "Оплата подписки Basic на 1 месяц",
  },
  "3m": {
    code: "3m",
    title: "3 месяца",
    months: 3,
    price: 807,
    discountPercent: 10,
    description: "Оплата подписки Basic на 3 месяца",
  },
  "6m": {
    code: "6m",
    title: "6 месяцев",
    months: 6,
    price: 1345,
    discountPercent: 25,
    description: "Оплата подписки Basic на 6 месяцев",
  },
} as const;

export type SubscriptionPlanCode = keyof typeof SUBSCRIPTION_PLANS;

export function getSubscriptionPlan(planCode?: string) {
  if (!planCode || !(planCode in SUBSCRIPTION_PLANS)) {
    return SUBSCRIPTION_PLANS["1m"];
  }

  return SUBSCRIPTION_PLANS[planCode as SubscriptionPlanCode];
}