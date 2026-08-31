import { getServiceSettings } from "@/lib/service-settings";

export async function getPaymentMode(): Promise<"test" | "yookassa"> {
  try {
    const settings = await getServiceSettings();
    return settings.isYookassaEnabled ? "yookassa" : "test";
  } catch (error) {
    console.error("GET PAYMENT MODE ERROR:", error);
    return "test";
  }
}