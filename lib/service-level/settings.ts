import type { ServiceLevelSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CREATE_TEMPLATE,
  DEFAULT_PAY_TEMPLATE,
  DEFAULT_PROGRESS_KEYS,
  DEFAULT_SERVICES,
  LEGACY_CREATE_TEMPLATE,
  LEGACY_CREATE_TEMPLATE_V2,
  LEGACY_CREATE_TEMPLATE_V3,
  LEGACY_CREATE_TEMPLATE_V4,
  LEGACY_PAY_TEMPLATE,
  LEGACY_PAY_TEMPLATE_V2,
  LEGACY_PAY_TEMPLATE_V3,
  LEGACY_PAY_TEMPLATE_V4,
  LEGACY_PROGRESS_KEYS,
} from "./defaults";
import { parseKeyList, type ProgressKeys } from "./progress";
import { parseSuccessCodes } from "./socpublic";

/**
 * Общие настройки «Уровня сервиса». Строка создаётся при первом обращении — вместе с тремя
 * стартовыми услугами (актуальность, цена, чаты). Дальше всё меняется в админ-панели,
 * а удалённые услуги заново не появляются.
 */
let legacyUpgraded = false;

/**
 * Один раз за запуск сервера: заменяет предположительные значения первой версии на подтверждённые.
 *  – код успешного ответа SocPublic: у них успех — статус 0 (не 200);
 *  – шаблон создания задания и пополнения: настоящие поля по официальной документации;
 *  – ключи, по которым читается ход выполнения (task_info): bid_pay, bid_done, bid_start, bid_debug.
 * Затрагивает только значения, которые не меняли вручную.
 */
async function upgradeLegacyDefaults() {
  if (legacyUpgraded) return;
  legacyUpgraded = true;
  try {
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, successCodes: "200" }, data: { successCodes: "0" } });
    await prisma.serviceLevelService.updateMany({ where: { payloadTemplate: LEGACY_CREATE_TEMPLATE }, data: { payloadTemplate: DEFAULT_CREATE_TEMPLATE } });
    await prisma.serviceLevelService.updateMany({ where: { payloadTemplate: LEGACY_CREATE_TEMPLATE_V2 }, data: { payloadTemplate: DEFAULT_CREATE_TEMPLATE } });
    await prisma.serviceLevelService.updateMany({ where: { payloadTemplate: LEGACY_CREATE_TEMPLATE_V3 }, data: { payloadTemplate: DEFAULT_CREATE_TEMPLATE } });
    await prisma.serviceLevelService.updateMany({ where: { payloadTemplate: LEGACY_CREATE_TEMPLATE_V4 }, data: { payloadTemplate: DEFAULT_CREATE_TEMPLATE } });
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, payTemplate: LEGACY_PAY_TEMPLATE }, data: { payTemplate: DEFAULT_PAY_TEMPLATE } });
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, payTemplate: LEGACY_PAY_TEMPLATE_V2 }, data: { payTemplate: DEFAULT_PAY_TEMPLATE } });
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, payTemplate: LEGACY_PAY_TEMPLATE_V3 }, data: { payTemplate: DEFAULT_PAY_TEMPLATE } });
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, payTemplate: LEGACY_PAY_TEMPLATE_V4 }, data: { payTemplate: DEFAULT_PAY_TEMPLATE } });
    // по одному полю явно (без вычисляемых ключей — так строго проходит проверка типов Prisma)
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, keyRemaining: LEGACY_PROGRESS_KEYS.keyRemaining }, data: { keyRemaining: DEFAULT_PROGRESS_KEYS.keyRemaining } });
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, keyReady: LEGACY_PROGRESS_KEYS.keyReady }, data: { keyReady: DEFAULT_PROGRESS_KEYS.keyReady } });
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, keyStarted: LEGACY_PROGRESS_KEYS.keyStarted }, data: { keyStarted: DEFAULT_PROGRESS_KEYS.keyStarted } });
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, keyRework: LEGACY_PROGRESS_KEYS.keyRework }, data: { keyRework: DEFAULT_PROGRESS_KEYS.keyRework } });
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, keyTotal: LEGACY_PROGRESS_KEYS.keyTotal }, data: { keyTotal: DEFAULT_PROGRESS_KEYS.keyTotal } });
    await prisma.serviceLevelSettings.updateMany({ where: { id: 1, keyPaid: LEGACY_PROGRESS_KEYS.keyPaid }, data: { keyPaid: DEFAULT_PROGRESS_KEYS.keyPaid } });
  } catch (error) {
    legacyUpgraded = false;
    console.error("SERVICE LEVEL UPGRADE ERROR:", error instanceof Error ? error.message : error);
  }
}

export async function getServiceLevelSettings(): Promise<ServiceLevelSettings> {
  let existing = await prisma.serviceLevelSettings.findUnique({ where: { id: 1 } });
  if (existing) {
    if (!legacyUpgraded) {
      await upgradeLegacyDefaults();
      existing = (await prisma.serviceLevelSettings.findUnique({ where: { id: 1 } })) ?? existing;
    }
    return existing;
  }

  let created: ServiceLevelSettings;
  try {
    created = await prisma.serviceLevelSettings.create({ data: { id: 1, payTemplate: DEFAULT_PAY_TEMPLATE, ...DEFAULT_PROGRESS_KEYS } });
  } catch {
    // параллельный первый вызов уже создал строку
    return prisma.serviceLevelSettings.findUniqueOrThrow({ where: { id: 1 } });
  }

  for (const service of DEFAULT_SERVICES) {
    await prisma.serviceLevelService.upsert({
      where: { slug: service.slug },
      update: {},
      create: { ...service, payloadTemplate: DEFAULT_CREATE_TEMPLATE },
    });
  }
  return created;
}

type SettingsRow = ServiceLevelSettings;

export function progressKeysFrom(settings: SettingsRow): ProgressKeys {
  return {
    remaining: parseKeyList(settings.keyRemaining),
    ready: parseKeyList(settings.keyReady),
    started: parseKeyList(settings.keyStarted),
    rework: parseKeyList(settings.keyRework),
    total: parseKeyList(settings.keyTotal),
    paid: parseKeyList(settings.keyPaid),
  };
}

export function successCodesFrom(settings: SettingsRow) {
  return parseSuccessCodes(settings.successCodes);
}
