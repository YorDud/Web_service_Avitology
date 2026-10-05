/* =========================================================================
   Дополнительные клиенты автозагрузки: цена, размер пакета, коды платежей.
   Чистый файл без серверных зависимостей — им пользуются и API, и интерфейс.

   Основной аккаунт Авито (общий с Бид-менеджером) входит в подписку Pro.
   Каждый ДОПОЛНИТЕЛЬНЫЙ клиент — отдельный аккаунт Авито со своими ключами,
   таблицами и расписанием — занимает один слот. Слоты покупаются пакетами
   по AUTOLOAD_CLIENT_PACK_SIZE штук за AUTOLOAD_CLIENT_PACK_PRICE ₽ (разовая
   оплата, слоты не сгорают). Менять цену и размер пакета достаточно здесь.
   ========================================================================= */

export const AUTOLOAD_CLIENT_PACK_SIZE = 3;
export const AUTOLOAD_CLIENT_PACK_PRICE = 299;
/** Сколько пакетов можно оплатить за один раз. */
export const AUTOLOAD_CLIENT_MAX_PACKS_PER_PAYMENT = 10;
export const MAX_CLIENT_NAME_LENGTH = 60;

const PLAN_PREFIX = "autoload_clients_x";

/** Код платежа вида «autoload_clients_x2» (2 пакета). Платёж хранит его в Payment.planCode. */
export function autoloadClientsPlanCode(packs: number) {
  return `${PLAN_PREFIX}${packs}`;
}

/** Сколько пакетов куплено по коду платежа или null, если это не платёж за клиентов. */
export function parseAutoloadClientsPlanCode(code: string | null | undefined): number | null {
  const match = /^autoload_clients_x(\d{1,2})$/.exec(code ?? "");
  const packs = match ? Number(match[1]) : NaN;
  return Number.isInteger(packs) && packs >= 1 && packs <= AUTOLOAD_CLIENT_MAX_PACKS_PER_PAYMENT ? packs : null;
}

export function isAutoloadClientsPlanCode(code: string | null | undefined) {
  return parseAutoloadClientsPlanCode(code) !== null;
}

export function autoloadClientsPrice(packs: number) {
  return packs * AUTOLOAD_CLIENT_PACK_PRICE;
}

export function autoloadClientsSlots(packs: number) {
  return packs * AUTOLOAD_CLIENT_PACK_SIZE;
}

/** «1 клиент», «3 клиента», «5 клиентов». */
export function clientsWord(count: number) {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return "клиентов";
  if (last === 1) return "клиент";
  if (last >= 2 && last <= 4) return "клиента";
  return "клиентов";
}
