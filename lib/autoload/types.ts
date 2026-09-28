/* Типы данных, которыми обмениваются API и интерфейс автозагрузки. */
import type { AdData } from "./fields";

export type FeedSettings = {
  /** Порядок и набор столбцов таблицы объявлений. */
  columns?: string[];
  /** Значения для выпадающих списков по тегам, взятые из каталога категорий Авито. */
  fieldOptions?: Record<string, string[]>;
};

/** То же подключение, что отдаёт GET /api/avito-connection (общее с Бид-менеджером Авито). */
export type AccountStatus = {
  connected: boolean;
  clientIdMasked?: string;
  tokenExpiresAt?: string | null;
  lastCheckedAt?: string | null;
  lastError?: string | null;
};

export type FeedSummary = {
  id: number;
  name: string;
  publicUrl: string;
  linked: boolean;
  adsCount: number;
  lastFetchedAt: string | null;
  fetchCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdMessage = {
  type: string;
  title: string;
  description: string;
};

export type FeedAd = {
  key: string;
  data: AdData;
  avitoId: string | null;
  avitoStatus: string | null;
  avitoMessages: AdMessage[];
  syncedAt: string | null;
};

export type FeedDetail = FeedSummary & {
  defaults: AdData;
  settings: FeedSettings;
  ads: FeedAd[];
};

export type ScheduleRule = {
  rate: number;
  /** 0 — понедельник, 6 — воскресенье. */
  weekdays: number[];
  /** 0 — интервал 00:00–01:00 по Москве. */
  time_slots: number[];
};

export type ProfileDto = {
  exists: boolean;
  autoloadEnabled: boolean;
  reportEmail: string;
  schedule: ScheduleRule[];
  feeds: { name: string; url: string; ours: boolean }[];
};

export type ReportSummary = {
  id: string;
  status: string;
  source: string | null;
  startedAt: string | null;
  counts: { label: string; value: number }[];
  events: { type: string; description: string }[];
};

export type SyncResult = {
  uploadId: string | null;
  /** true, если использована ещё идущая загрузка (current), а не последняя завершённая. */
  partial: boolean;
  matched: number;
  errors: number;
  warnings: number;
  notFound: number;
};

export type CatalogNode = {
  slug: string | null;
  name: string;
  path: string;
};

export type CatalogField = {
  tag: string;
  label: string;
  required: boolean;
  values: string[];
};

export type IssueAd = {
  adKey: string;
  title: string | null;
  feedId: number | null;
  feedName: string | null;
  avitoId: string | null;
  url: string | null;
};

export type IssueGroup = {
  type: string;
  code: number;
  title: string;
  description: string;
  count: number;
  ads: IssueAd[];
};

export type IssuesResponse = {
  upload: ReportSummary | null;
  partial: boolean;
  groups: IssueGroup[];
  adsWithIssues: number;
  totalAds: number;
};
