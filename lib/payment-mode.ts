import { isYookassaEnabled } from "@/lib/service-settings";

export async function getPaymentMode(): Promise<"test" | "yookassa"> {
  const enabled = await isYookassaEnabled();
  return enabled ? "yookassa" : "test";
}