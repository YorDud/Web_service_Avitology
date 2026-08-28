import YooKassa from "yookassa";

const shopId = process.env.YOOKASSA_SHOP_ID;
const secretKey = process.env.YOOKASSA_SECRET_KEY;
const returnUrl =
  process.env.YOOKASSA_RETURN_URL || "https://avitology.site/payment/success";

if (!shopId) {
  throw new Error("YOOKASSA_SHOP_ID is not set");
}

if (!secretKey) {
  throw new Error("YOOKASSA_SECRET_KEY is not set");
}

export const yookassa = new YooKassa({
  shopId,
  secretKey,
});

export async function createYookassaPayment(params: {
  amount: number;
  description: string;
  paymentId: number;
  userId: number;
  userEmail: string;
}) {
  const idempotenceKey = `payment-${params.paymentId}-${Date.now()}`;

  const payment = await yookassa.createPayment(
    {
      amount: {
        value: params.amount.toFixed(2),
        currency: "RUB",
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: `${returnUrl}?paymentId=${params.paymentId}`,
      },
      description: params.description,
      metadata: {
        internalPaymentId: String(params.paymentId),
        userId: String(params.userId),
        email: params.userEmail,
      },
    },
    idempotenceKey
  );

  return payment;
}

export async function getYookassaPayment(paymentId: string) {
  return await yookassa.getPayment(paymentId);
}