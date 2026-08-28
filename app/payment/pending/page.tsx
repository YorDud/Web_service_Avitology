import { Suspense } from "react";
import PaymentPendingClient from "./payment-pending-client";

type Props = {
  searchParams: Promise<{
    paymentId?: string;
  }>;
};

export default async function PaymentPendingPage({ searchParams }: Props) {
  const params = await searchParams;
  const paymentId = params.paymentId ?? null;

  return (
    <Suspense fallback={null}>
      <PaymentPendingClient paymentId={paymentId} />
    </Suspense>
  );
}