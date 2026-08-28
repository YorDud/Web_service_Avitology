import { isYookassaEnabled } from "@/lib/service-settings";

export async function getPaymentMode(): Promise<"test" | "yookassa"> {
  try {
    const enabled = await isYookassaEnabled();
    return enabled ? "yookassa" : "test";
  } catch (error) {
    console.error("GET PAYMENT MODE ERROR:", error);
    return "test";
  }
}