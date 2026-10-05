import {
  AUTOLOAD_CLIENT_MAX_PACKS_PER_PAYMENT,
  AUTOLOAD_CLIENT_PACK_PRICE,
  AUTOLOAD_CLIENT_PACK_SIZE,
} from "./clients-plan";
import { maskClientId } from "./server";
import type { AutoloadClientDto, ClientSlots } from "./types";

/* Сериализация клиентов и подсчёт слотов — вынесено из route.ts, потому что файлы
   route.ts в Next.js не могут экспортировать ничего, кроме обработчиков GET/POST/... */

type ClientRow = {
  id: number;
  name: string;
  clientId: string;
  tokenExpiresAt: Date | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  _count?: { feeds: number };
};

export function serializeClient(client: ClientRow): AutoloadClientDto {
  return {
    id: client.id,
    name: client.name,
    clientIdMasked: maskClientId(client.clientId),
    tokenExpiresAt: client.tokenExpiresAt ? client.tokenExpiresAt.toISOString() : null,
    lastCheckedAt: client.lastCheckedAt ? client.lastCheckedAt.toISOString() : null,
    lastError: client.lastError,
    feedsCount: client._count?.feeds ?? 0,
    createdAt: client.createdAt.toISOString(),
  };
}

export function buildSlots(user: { subscriptionLevel: string; autoloadExtraClientSlots: number }, used: number): ClientSlots {
  const unlimited = String(user.subscriptionLevel).toLowerCase() === "admin";
  const purchased = user.autoloadExtraClientSlots;
  return {
    purchased,
    used,
    free: unlimited ? null : Math.max(0, purchased - used),
    unlimited,
    packSize: AUTOLOAD_CLIENT_PACK_SIZE,
    packPrice: AUTOLOAD_CLIENT_PACK_PRICE,
    maxPacksPerPayment: AUTOLOAD_CLIENT_MAX_PACKS_PER_PAYMENT,
  };
}
