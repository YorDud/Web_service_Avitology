"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_COLUMNS,
  DEFAULT_FIELD_TAGS,
  FIELD_BY_TAG,
  FIELD_GROUPS,
  KNOWN_FIELDS,
  MAX_ADS_PER_FEED,
  buildTemplateRows,
  isValidTagPath,
  tagLabel,
  type AdData,
  type FieldOption,
  type KnownField,
} from "@/lib/autoload/fields";
import { resolveCategoryFields } from "@/lib/autoload/category";
import { buildImport, buildTemplateCsv, parseDelimited, toCsv, type ImportResult } from "@/lib/autoload/import";
import { MESSAGE_KIND, fixHint, kindOf } from "@/lib/autoload/hints";
import { buildFeedXml, splitImages, validateAds, type AdIssue } from "@/lib/autoload/xml";
import type {
  AccountStatus,
  AdMessage,
  CatalogField,
  CatalogNode,
  FeedAd,
  FeedDetail,
  ProfileDto,
  SyncResult,
} from "@/lib/autoload/types";
import {
  AnchoredList,
  Icon,
  Modal,
  Pill,
  SearchableSelect,
  Spinner,
  api,
  cellInputClass,
  copyText,
  dangerButton,
  downloadBinary,
  downloadFile,
  errorText,
  formatDateTime,
  ghostButton,
  inputClass,
  timeAgo,
  useOutsideClose,
} from "./ui";

/* =========================================================================
   Редактор таблицы объявлений: таблица, общие поля, проверка, подключение.
   ========================================================================= */

type AdRow = {
  uid: string;
  key: string;
  data: AdData;
  avitoId: string | null;
  avitoStatus: string | null;
  avitoMessages: AdMessage[];
  syncedAt: string | null;
};

type CategoryTarget = "defaults" | { rowUids: string[] };

type Tab = "ads" | "defaults" | "check" | "connect";
type ImportMode = "append" | "merge" | "replace";

const PAGE_SIZE = 50;
let uidCounter = 0;
const newUid = () => `r${(uidCounter += 1)}`;

function toRow(ad: FeedAd): AdRow {
  return { uid: newUid(), key: ad.key, data: ad.data, avitoId: ad.avitoId, avitoStatus: ad.avitoStatus, avitoMessages: ad.avitoMessages, syncedAt: ad.syncedAt };
}

function blankRow(key: string, data: AdData = {}): AdRow {
  return { uid: newUid(), key, data, avitoId: null, avitoStatus: null, avitoMessages: [], syncedAt: null };
}

function uniqueKey(base: string, used: Set<string>) {
  let key = base;
  let suffix = 2;
  while (used.has(key)) key = `${base}-${suffix++}`;
  return key;
}

function normalizeColumns(saved: string[] | undefined, ads: FeedAd[], defaults: AdData) {
  const base = saved && saved.length > 0 ? saved : DEFAULT_COLUMNS;
  const set = new Set(base.filter((tag) => tag !== "Id"));
  // Столбцы с данными не должны пропадать из таблицы.
  for (const ad of ads.slice(0, 200)) {
    for (const tag of Object.keys(ad.data)) if (!FIELD_BY_TAG[tag]) set.add(tag);
  }
  for (const tag of Object.keys(defaults)) if (!FIELD_BY_TAG[tag] && tag !== "Id") set.add(tag);
  return ["Id", ...set];
}

// avito_status: active | old | blocked | rejected | archived | removed (перечисление из API Авито)
function statusTone(status: string | null, messages: AdMessage[]): "green" | "red" | "amber" | "gray" {
  if (messages.some((m) => m.type === "error")) return "red";
  if (status === "blocked" || status === "rejected" || status === "removed") return "red";
  if (status === "active") return "green";
  if (status === "old" || status === "archived") return "gray";
  if (messages.some((m) => m.type === "warning" || m.type === "alarm")) return "amber";
  return "gray";
}

type Props = {
  feedId: number;
  /** Открыть сразу это объявление (переход из окна «Что исправить»). */
  focusAdKey?: string | null;
  account: AccountStatus | null;
  profile: ProfileDto | null;
  onBack: () => void;
  onChanged: () => void;
  onProfile: (profile: ProfileDto) => void;
  toast: (text: string, kind?: "ok" | "error") => void;
};

export default function FeedEditor({ feedId, focusAdKey, account, profile, onBack, onChanged, onProfile, toast }: Props) {
  const [feed, setFeed] = useState<FeedDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [ads, setAds] = useState<AdRow[]>([]);
  const [defaults, setDefaults] = useState<AdData>({});
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [fieldOptions, setFieldOptions] = useState<Record<string, string[]>>({});
  const [nameDraft, setNameDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const [tab, setTab] = useState<Tab>("ads");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [rowModal, setRowModal] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState<CategoryTarget | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [issueFilter, setIssueFilter] = useState<"error" | "warning">("error");
  const [issueLimit, setIssueLimit] = useState(50);

  /* ---------- Загрузка ---------- */
  const applyFeed = useCallback((detail: FeedDetail) => {
    setFeed(detail);
    setNameDraft(detail.name);
    setAds(detail.ads.map(toRow));
    setDefaults(detail.defaults);
    setColumns(normalizeColumns(detail.settings.columns, detail.ads, detail.defaults));
    setFieldOptions(detail.settings.fieldOptions ?? {});
    setDirty(false);
    setSelected(new Set());
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ feed: FeedDetail }>(`/api/autoload/feeds/${feedId}`)
      .then(({ feed: detail }) => {
        if (alive) applyFeed(detail);
      })
      .catch((error) => {
        if (alive) setLoadError(errorText(error));
      });
    return () => {
      alive = false;
    };
  }, [feedId, applyFeed]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusAdKey || !feed || focusedRef.current) return;
    const row = ads.find((item) => item.key === focusAdKey);
    if (!row) return;
    focusedRef.current = true;
    setTab("ads");
    setQuery("");
    setPage(Math.floor(ads.indexOf(row) / PAGE_SIZE));
    setRowModal(row.uid);
  }, [focusAdKey, feed, ads]);

  const reload = useCallback(async () => {
    const { feed: detail } = await api<{ feed: FeedDetail }>(`/api/autoload/feeds/${feedId}`);
    applyFeed(detail);
  }, [feedId, applyFeed]);

  /* ---------- Изменения ---------- */
  const mutateAds = (fn: (prev: AdRow[]) => AdRow[]) => {
    setAds(fn);
    setDirty(true);
  };

  const updateRow = (uid: string, patch: Partial<Pick<AdRow, "key">> & { data?: AdData }) =>
    mutateAds((prev) => prev.map((row) => (row.uid === uid ? { ...row, ...patch } : row)));

  const setCell = (uid: string, tag: string, value: string) =>
    mutateAds((prev) =>
      prev.map((row) => {
        if (row.uid !== uid) return row;
        const data = { ...row.data };
        if (value) data[tag] = value;
        else delete data[tag];
        return { ...row, data };
      }),
    );

  const setCells = (uids: string[], values: Record<string, string>) => {
    const set = new Set(uids);
    mutateAds((prev) =>
      prev.map((row) => {
        if (!set.has(row.uid)) return row;
        const data = { ...row.data };
        for (const [tag, value] of Object.entries(values)) {
          if (value) data[tag] = value;
          else delete data[tag];
        }
        return { ...row, data };
      }),
    );
  };

  /**
   * Выбор раздела в каталоге: подставляем точную «Категорию» и фиксированные поля раздела
   * (например, для «Наушники»: Категория = «Аудио и видео», Вид товара = «Наушники»),
   * регистрируем списки допустимых значений и добавляем столбцы обязательных полей.
   */
  async function applyCategoryNode(node: CatalogNode, target: CategoryTarget) {
    if (categoryBusy) return;
    setCategoryBusy(true);
    try {
      let fields: CatalogField[] = [];
      if (node.slug) {
        try {
          fields = (await api<{ fields: CatalogField[] }>(`/api/autoload/catalog?slug=${encodeURIComponent(node.slug)}`)).fields;
        } catch (error) {
          toast(`Не удалось загрузить поля раздела: ${errorText(error)}`, "error");
        }
      }
      const result = resolveCategoryFields(node, fields);

      if (target === "defaults") {
        for (const [tag, value] of Object.entries(result.values)) setDefault(tag, value);
      } else {
        setCells(target.rowUids, result.values);
      }

      if (Object.keys(result.options).length > 0) {
        setFieldOptions((current) => ({ ...current, ...result.options }));
        setDirty(true);
      }
      for (const tag of result.requiredColumns) addColumn(tag);

      toast(result.summary.join(" · "));
      for (const warning of result.warnings) toast(warning, "error");
      if (target === "defaults") {
        const own = ads.filter((row) => row.data.Category && row.data.Category !== result.values.Category).length;
        if (own > 0) {
          toast(`У ${own} объявл. в таблице своя категория — она главнее общей. Выделите их галочками и нажмите «Категория».`, "error");
        }
      }
    } finally {
      setCategoryBusy(false);
    }
  }

  const addRow = () => {
    if (ads.length >= MAX_ADS_PER_FEED) {
      toast(`В таблице может быть до ${MAX_ADS_PER_FEED} объявлений.`, "error");
      return;
    }
    const used = new Set(ads.map((row) => row.key));
    const row = blankRow(uniqueKey(`ad-${ads.length + 1}`, used));
    mutateAds((prev) => [...prev, row]);
    setQuery("");
    setPage(Math.floor(ads.length / PAGE_SIZE));
    setRowModal(row.uid);
  };

  const duplicateRows = (uids: string[]) => {
    if (ads.length + uids.length > MAX_ADS_PER_FEED) {
      toast(`В таблице может быть до ${MAX_ADS_PER_FEED} объявлений.`, "error");
      return;
    }
    mutateAds((prev) => {
      const used = new Set(prev.map((row) => row.key));
      const copies = prev
        .filter((row) => uids.includes(row.uid))
        .map((row) => {
          const key = uniqueKey(`${row.key}-copy`, used);
          used.add(key);
          return blankRow(key, { ...row.data });
        });
      return [...prev, ...copies];
    });
  };

  const removeRows = (uids: string[]) => {
    mutateAds((prev) => prev.filter((row) => !uids.includes(row.uid)));
    setSelected((current) => {
      const next = new Set(current);
      uids.forEach((uid) => next.delete(uid));
      return next;
    });
  };

  const setDefault = (tag: string, value: string) => {
    setDefaults((current) => {
      const next = { ...current };
      if (value) next[tag] = value;
      else delete next[tag];
      return next;
    });
    setDirty(true);
  };

  const addColumn = (tag: string, values?: string[]) => {
    if (!isValidTagPath(tag) && tag !== "Id") return false;
    setColumns((current) => (current.includes(tag) ? current : [...current, tag]));
    if (values && values.length > 0) {
      setFieldOptions((current) => ({ ...current, [tag]: [...new Set(values)].slice(0, 300) }));
    }
    setDirty(true);
    return true;
  };

  const toggleColumn = (tag: string) => {
    if (tag === "Id") return;
    setColumns((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
    setDirty(true);
  };

  /* ---------- Проверка ---------- */
  const deferredAds = useDeferredValue(ads);
  const deferredDefaults = useDeferredValue(defaults);

  const validation = useMemo(() => {
    const result = validateAds(
      deferredAds.map((row) => ({ key: row.key, data: row.data })),
      deferredDefaults,
    );
    const byUid = new Map<string, AdIssue[]>();
    for (const issue of result.issues) {
      const uid = deferredAds[issue.index]?.uid;
      if (!uid) continue;
      const list = byUid.get(uid);
      if (list) list.push(issue);
      else byUid.set(uid, [issue]);
    }
    return { ...result, byUid };
  }, [deferredAds, deferredDefaults]);

  const xmlPreview = useMemo(
    () => (tab === "check" ? buildFeedXml(deferredAds.slice(0, 2).map((row) => ({ key: row.key, data: row.data })), deferredDefaults) : ""),
    [tab, deferredAds, deferredDefaults],
  );

  /* ---------- Таблица ---------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ads;
    return ads.filter((row) => row.key.toLowerCase().includes(q) || (row.data.Title ?? "").toLowerCase().includes(q));
  }, [ads, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const allOnPage = pageRows.length > 0 && pageRows.every((row) => selected.has(row.uid));

  const availableTags = useMemo(() => {
    const extra = new Set<string>();
    for (const row of ads.slice(0, 500)) for (const tag of Object.keys(row.data)) if (!FIELD_BY_TAG[tag]) extra.add(tag);
    for (const tag of Object.keys(defaults)) if (!FIELD_BY_TAG[tag]) extra.add(tag);
    for (const tag of columns) if (!FIELD_BY_TAG[tag] && tag !== "Id") extra.add(tag);
    return [...KNOWN_FIELDS.map((field) => field.tag), ...[...extra].sort()];
  }, [ads, defaults, columns]);

  const toggleAllOnPage = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allOnPage) pageRows.forEach((row) => next.delete(row.uid));
      else pageRows.forEach((row) => next.add(row.uid));
      return next;
    });

  const toggleSelect = (uid: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  /* ---------- Действия с сервером ---------- */
  async function save() {
    if (saving) return;
    const keys = ads.map((row) => row.key.trim());
    if (keys.some((key) => !key)) {
      toast("У каждого объявления должен быть ID.", "error");
      setTab("ads");
      return;
    }
    const duplicate = keys.find((key, index) => keys.indexOf(key) !== index);
    if (duplicate) {
      toast(`ID «${duplicate}» повторяется. Исправьте дубли.`, "error");
      setTab("ads");
      setQuery(duplicate);
      return;
    }

    setSaving(true);
    try {
      await api(`/api/autoload/feeds/${feedId}/ads`, {
        method: "PUT",
        json: { ads: ads.map((row) => ({ key: row.key.trim(), data: row.data })) },
      });
      await api(`/api/autoload/feeds/${feedId}`, {
        method: "PATCH",
        json: { defaults, settings: { columns, fieldOptions } },
      });
      await reload();
      onChanged();
      toast("Таблица сохранена.");
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setSaving(false);
    }
  }

  async function rename() {
    const name = nameDraft.trim();
    if (!feed || !name || name === feed.name) {
      setNameDraft(feed?.name ?? "");
      return;
    }
    try {
      await api(`/api/autoload/feeds/${feedId}`, { method: "PATCH", json: { name } });
      setFeed({ ...feed, name });
      onChanged();
      toast("Название обновлено.");
    } catch (error) {
      setNameDraft(feed.name);
      toast(errorText(error), "error");
    }
  }

  async function setLinked(next: boolean) {
    if (linking || !feed) return;
    if (dirty) {
      toast("Сначала сохраните изменения в таблице.", "error");
      return;
    }
    if (next && validation.errors > 0) {
      const ok = window.confirm(
        `В таблице ошибок: ${validation.errors}. Авито может отклонить часть объявлений. Подключить всё равно?`,
      );
      if (!ok) return;
    }

    setLinking(true);
    try {
      const result = await api<{ linked: boolean; profile: ProfileDto }>(`/api/autoload/feeds/${feedId}/link`, {
        method: "POST",
        json: { linked: next },
      });
      setFeed({ ...feed, linked: result.linked });
      onProfile(result.profile);
      onChanged();
      toast(next ? "Таблица подключена к автозагрузке Авито." : "Таблица отключена от автозагрузки.");
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setLinking(false);
    }
  }

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const { result } = await api<{ result: SyncResult }>(`/api/autoload/feeds/${feedId}/sync`, { method: "POST" });
      setSyncResult(result);
      if (!dirty) await reload();
      toast(
        result.partial
          ? `Загрузка ещё идёт: найдено ${result.matched} объявлений. Обновите ещё раз после окончания.`
          : `Статусы обновлены: найдено ${result.matched} объявлений.`,
      );
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setSyncing(false);
    }
  }

  function applyImport(result: ImportResult, mode: ImportMode) {
    const incoming = result.ads;
    let next: AdRow[];
    let count: number;

    if (mode === "replace") {
      next = incoming.map((ad) => blankRow(ad.key, ad.data));
      count = next.length;
    } else if (mode === "merge") {
      const incomingByKey = new Map(incoming.map((ad) => [ad.key, ad]));
      const seen = new Set<string>();
      const updated = ads.map((row) => {
        const ad = incomingByKey.get(row.key);
        if (!ad) return row;
        seen.add(row.key);
        return { ...row, data: { ...row.data, ...ad.data } };
      });
      const additions = incoming.filter((ad) => !seen.has(ad.key)).map((ad) => blankRow(ad.key, ad.data));
      next = [...updated, ...additions];
      count = incoming.length;
    } else {
      const used = new Set(ads.map((row) => row.key));
      const additions = incoming.map((ad) => {
        const key = uniqueKey(ad.key, used);
        used.add(key);
        return blankRow(key, ad.data);
      });
      next = [...ads, ...additions];
      count = additions.length;
    }

    const limited = next.slice(0, MAX_ADS_PER_FEED);
    setAds(limited);
    setDirty(true);
    setSelected(new Set());

    for (const item of result.mapping) {
      if (item.tag && item.tag !== "Id") addColumn(item.tag);
    }
    setImportOpen(false);
    setQuery("");
    setPage(0);
    toast(`Импортировано объявлений: ${Math.min(count, MAX_ADS_PER_FEED)}. Не забудьте сохранить таблицу.`);
  }

  function exportCsv() {
    const csv = toCsv(
      ads.map((row) => ({ key: row.key, data: row.data })),
      columns,
    );
    downloadFile(csv, `${feed?.name ?? "avito-autoload"}.csv`, "text/csv;charset=utf-8");
  }

  function exportXml() {
    const xml = buildFeedXml(
      ads.map((row) => ({ key: row.key, data: row.data })),
      defaults,
    );
    downloadFile(xml, `${feed?.name ?? "avito-autoload"}.xml`, "application/xml;charset=utf-8");
  }

  /* ---------- Рендер ---------- */
  if (loadError) {
    return (
      <div className="white-card p-8 text-center">
        <div className="text-lg font-extrabold text-red-600">{loadError}</div>
        <button type="button" onClick={onBack} className={`${ghostButton} mt-5`}>
          <Icon name="back" /> К списку таблиц
        </button>
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="white-card space-y-4 p-8">
        <div className="al-skeleton h-8 w-1/3 rounded-xl" />
        <div className="al-skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  const editingRow = rowModal ? ads.find((row) => row.uid === rowModal) : null;
  const selectedList = ads.filter((row) => selected.has(row.uid));
  const issueList = validation.issues.filter((issue) => issue.level === issueFilter);
  const readyAds = Math.max(0, ads.length - new Set(validation.issues.filter((i) => i.level === "error").map((i) => i.index)).size);

  const tabs: { id: Tab; label: string; badge?: ReactBadge }[] = [
    { id: "ads", label: "Объявления", badge: { text: String(ads.length), tone: "gray" } },
    { id: "defaults", label: "Общие поля" },
    {
      id: "check",
      label: "Проверка",
      badge:
        validation.errors > 0
          ? { text: String(validation.errors), tone: "red" }
          : validation.warnings > 0
            ? { text: String(validation.warnings), tone: "amber" }
            : ads.length > 0
              ? { text: "ОК", tone: "green" }
              : undefined,
    },
    { id: "connect", label: "Подключение", badge: feed.linked ? { text: "активно", tone: "green" } : undefined },
  ];

  return (
    <div className="al-pop min-w-0 space-y-5">
      {/* Шапка таблицы */}
      <section className="rounded-[28px] bg-black p-5 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                if (dirty && !window.confirm("Есть несохранённые изменения. Выйти без сохранения?")) return;
                onBack();
              }}
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-white/55 transition hover:text-[#78f8a6]"
            >
              <Icon name="back" /> Все таблицы
            </button>
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={() => void rename()}
              onKeyDown={(event) => {
                if (event.key === "Enter") (event.target as HTMLInputElement).blur();
              }}
              aria-label="Название таблицы"
              maxLength={80}
              className="w-full max-w-xl rounded-xl border border-transparent bg-transparent px-0 text-3xl font-extrabold tracking-[-0.04em] text-white outline-none transition placeholder:text-white/30 hover:border-white/15 focus:border-[#03bd48] focus:px-3 md:text-4xl"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/55">
              <Pill tone={feed.linked ? "green" : "gray"}>{feed.linked ? "Подключена к Авито" : "Не подключена"}</Pill>
              <span>{ads.length} объявл.</span>
              <span>·</span>
              <span>
                {feed.lastFetchedAt ? `Авито забирал файл ${timeAgo(feed.lastFetchedAt)}` : "Авито ещё не забирал файл"}
              </span>
            </div>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
            {[
              { label: "Готовы", value: readyAds, tone: "text-[#78f8a6]" },
              { label: "Ошибки", value: validation.errors, tone: validation.errors ? "text-red-300" : "text-white" },
              { label: "Замечания", value: validation.warnings, tone: validation.warnings ? "text-amber-300" : "text-white" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center">
                <div className={`text-2xl font-extrabold tabular-nums ${item.tone}`}>{item.value}</div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/40">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Вкладки */}
      <div role="tablist" className="flex gap-1.5 overflow-x-auto rounded-2xl bg-black/[0.05] p-1.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all duration-300 ${
              tab === item.id ? "bg-black text-white shadow-[0_10px_22px_rgba(16,24,40,0.2)]" : "text-black/55 hover:bg-white hover:text-black"
            }`}
          >
            {item.label}
            {item.badge && <Pill tone={item.badge.tone}>{item.badge.text}</Pill>}
          </button>
        ))}
      </div>

      {/* ===== Объявления ===== */}
      {tab === "ads" && (
        <section className="white-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Поиск по ID и названию"
                className={`${inputClass} pl-10`}
              />
            </div>
            <button type="button" onClick={addRow} className="btn-primary inline-flex items-center gap-2 !px-4 !py-3 text-sm">
              <Icon name="plus" /> Объявление
            </button>
            <button type="button" onClick={() => setImportOpen(true)} className={ghostButton}>
              <Icon name="upload" /> Импорт
            </button>
            <button type="button" onClick={exportCsv} disabled={ads.length === 0} className={ghostButton}>
              <Icon name="download" /> CSV
            </button>
            <div className="relative">
              <button type="button" onClick={() => setColumnsOpen((open) => !open)} className={ghostButton}>
                <Icon name="columns" /> Столбцы
              </button>
              {columnsOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Закрыть"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setColumnsOpen(false)}
                  />
                  <div className="al-pop absolute right-0 z-50 mt-2 max-h-80 w-64 overflow-y-auto rounded-2xl border border-black/10 bg-white p-2 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
                    {availableTags.map((tag) => (
                      <label
                        key={tag}
                        className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-black/75 transition hover:bg-black/[0.04]"
                      >
                        <input
                          type="checkbox"
                          checked={columns.includes(tag)}
                          onChange={() => toggleColumn(tag)}
                          className="h-4 w-4 accent-[#03bd48]"
                        />
                        <span className="min-w-0 flex-1 truncate">{tagLabel(tag)}</span>
                        {(FIELD_BY_TAG[tag]?.options || fieldOptions[tag]) && (
                          <span
                            title="Список значений"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#03bd48]"
                          />
                        )}
                      </label>
                    ))}
                    <div className="border-t border-black/10 p-2 pt-3">
                      <AddTagInput onAdd={(tag) => addColumn(tag)} placeholder="Свой тег, например Color" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {selectedList.length > 0 && (
            <div className="al-pop mt-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#03bd48]/30 bg-[#03bd48]/[0.06] p-3">
              <span className="px-2 text-sm font-extrabold text-black">Выбрано: {selectedList.length}</span>
              {selectedList.length < ads.length && (
                <button type="button" onClick={() => setSelected(new Set(ads.map((row) => row.uid)))} className={ghostButton}>
                  Выбрать все ({ads.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setCategoryTarget({ rowUids: selectedList.map((row) => row.uid) })}
                disabled={!account?.connected}
                title={account?.connected ? "Назначить категорию выбранным объявлениям" : "Сначала подключите Avito API"}
                className={ghostButton}
              >
                <Icon name="search" /> Категория
              </button>
              <button type="button" onClick={() => setBulkOpen(true)} className={ghostButton}>
                <Icon name="edit" /> Задать значение
              </button>
              <button type="button" onClick={() => duplicateRows(selectedList.map((row) => row.uid))} className={ghostButton}>
                <Icon name="copy" /> Дублировать
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Удалить выбранные объявления (${selectedList.length})?`)) removeRows(selectedList.map((row) => row.uid));
                }}
                className={dangerButton}
              >
                <Icon name="trash" /> Удалить
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-sm font-bold text-black/50 hover:text-black">
                Снять выбор
              </button>
            </div>
          )}

          {query.trim() && ads.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
              <span className="min-w-0">
                Показаны объявления по запросу «{query.trim()}»: {filtered.length} из {ads.length}.
              </span>
              <button type="button" onClick={() => setQuery("")} className="rounded-lg bg-white px-2.5 py-1 font-extrabold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100">
                Сбросить поиск
              </button>
            </div>
          )}

          {ads.length === 0 ? (
            <div className="mt-6 rounded-3xl border-2 border-dashed border-black/15 bg-black/[0.02] p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#03bd48]/10 text-[#028c36]">
                <Icon name="table" className="h-6 w-6" />
              </div>
              <div className="mt-4 text-lg font-extrabold text-black">В таблице пока нет объявлений</div>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-black/50">
                Вставьте данные из Excel или Google Таблиц. Заголовки столбцов на русском распознаются автоматически. Или добавьте первое объявление вручную.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setImportOpen(true)} className="btn-primary inline-flex items-center gap-2 !px-5 !py-3 text-sm">
                  <Icon name="upload" /> Импортировать таблицу
                </button>
                <button type="button" onClick={addRow} className={ghostButton}>
                  <Icon name="plus" /> Добавить вручную
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-black/[0.08]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-black text-[10px] font-extrabold uppercase tracking-[0.08em] text-white/60">
                      <th className="w-9 border-r border-white/10 px-2.5 py-2.5">
                        <input type="checkbox" checked={allOnPage} onChange={toggleAllOnPage} aria-label="Выбрать все на странице" className="h-3.5 w-3.5 accent-[#03bd48]" />
                      </th>
                      <th className="w-9 border-r border-white/10 px-1.5 py-2.5 text-center">№</th>
                      {columns.map((tag) => (
                        <th
                          key={tag}
                          style={{ minWidth: columnWidth(tag) }}
                          className="whitespace-nowrap border-r border-white/10 px-2.5 py-2.5"
                          title={tagLabel(tag)}
                        >
                          <span className="block truncate">{tagLabel(tag)}</span>
                        </th>
                      ))}
                      <th className="min-w-[84px] whitespace-nowrap border-r border-white/10 px-2.5 py-2.5">Авито</th>
                      <th className="sticky right-0 z-[5] w-[112px] min-w-[112px] bg-black px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const issues = validation.byUid.get(row.uid) ?? [];
                      const hasError = issues.some((issue) => issue.level === "error");
                      const index = ads.indexOf(row);
                      return (
                        <tr
                          key={row.uid}
                          className={`border-t border-black/[0.06] transition-colors hover:bg-[#03bd48]/[0.04] ${selected.has(row.uid) ? "bg-[#03bd48]/[0.06]" : ""}`}
                        >
                          <td className="border-r border-black/[0.07] px-2.5 py-1">
                            <input
                              type="checkbox"
                              checked={selected.has(row.uid)}
                              onChange={() => toggleSelect(row.uid)}
                              aria-label={`Выбрать ${row.key}`}
                              className="h-3.5 w-3.5 accent-[#03bd48]"
                            />
                          </td>
                          <td className="border-r border-black/[0.07] px-1.5 py-1 text-center">
                            <span
                              title={issues.map((issue) => issue.message).join("\n") || "Ошибок нет"}
                              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${
                                issues.length === 0
                                  ? "bg-[#03bd48]/12 text-[#027a30]"
                                  : hasError
                                    ? "bg-red-50 text-red-600"
                                    : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {index + 1}
                            </span>
                          </td>
                          {columns.map((tag) => (
                            <td key={tag} className="border-r border-black/[0.07] px-0.5 py-0.5">
                              <Cell
                                tag={tag}
                                row={row}
                                placeholder={defaults[tag]}
                                onKey={(value) => updateRow(row.uid, { key: value })}
                                onValue={(value) => setCell(row.uid, tag, value)}
                                onOpen={() => setRowModal(row.uid)}
                                hasIssue={issues.some((issue) => issue.tag === tag && issue.level === "error")}
                                extraOptions={fieldOptions[tag]}
                              />
                            </td>
                          ))}
                          <td className="border-r border-black/[0.07] px-2.5 py-1">
                            {row.avitoStatus || row.avitoMessages.length > 0 ? (
                              <button type="button" onClick={() => setRowModal(row.uid)} title="Открыть сообщения Авито" className="rounded-full">
                                <Pill tone={statusTone(row.avitoStatus, row.avitoMessages)}>{row.avitoMessages.length > 0 ? `Сообщений: ${row.avitoMessages.length}` : row.avitoStatus}</Pill>
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-black/25">—</span>
                            )}
                          </td>
                          <td className="sticky right-0 z-[5] w-[112px] min-w-[112px] bg-white px-1.5 py-1 shadow-[-10px_0_12px_-10px_rgba(0,0,0,0.18)]">
                            <div className="flex items-center justify-end gap-0.5">
                              <button type="button" onClick={() => setRowModal(row.uid)} aria-label="Редактировать" title="Открыть объявление" className="shrink-0 rounded-lg p-1.5 text-black/45 transition hover:bg-black/[0.06] hover:text-black">
                                <Icon name="edit" />
                              </button>
                              <button type="button" onClick={() => duplicateRows([row.uid])} aria-label="Дублировать" title="Дублировать" className="shrink-0 rounded-lg p-1.5 text-black/45 transition hover:bg-black/[0.06] hover:text-black">
                                <Icon name="copy" />
                              </button>
                              <button type="button" onClick={() => removeRows([row.uid])} aria-label="Удалить" title="Удалить" className="shrink-0 rounded-lg p-1.5 text-black/45 transition hover:bg-red-50 hover:text-red-600">
                                <Icon name="trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filtered.length === 0 && <div className="py-8 text-center text-sm font-bold text-black/45">Ничего не найдено.</div>}

              {pageCount > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-black/45">
                    {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} из {filtered.length}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className={ghostButton}>
                      Назад
                    </button>
                    <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className={ghostButton}>
                      Вперёд
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ===== Общие поля ===== */}
      {tab === "defaults" && (
        <section className="white-card p-5 sm:p-8">
          <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black">Общие поля для всех объявлений</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-black/55">
            Заполните то, что одинаково у всех объявлений: категорию, адрес, телефон. Если в строке таблицы поле пустое, в файл попадёт значение отсюда.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {KNOWN_FIELDS.filter((field) => DEFAULT_FIELD_TAGS.includes(field.tag)).map((field) => (
              <div key={field.tag} className={field.tag === "Category" ? "md:col-span-2" : ""}>
                <label className="mb-1.5 block text-sm font-extrabold text-black" htmlFor={`d-${field.tag}`}>
                  {field.label}
                </label>
                <div className="flex gap-2">
                  {field.tag === "Category" ? (
                    <div className="min-w-0 flex-1">
                      <CategoryField
                        id={`d-${field.tag}`}
                        value={defaults.Category ?? ""}
                        connected={Boolean(account?.connected)}
                        busy={categoryBusy}
                        onPickNode={(node) => void applyCategoryNode(node, "defaults")}
                        onOpenCatalog={() => setCategoryTarget("defaults")}
                      />
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <FieldControl
                        id={`d-${field.tag}`}
                        field={field}
                        value={defaults[field.tag] ?? ""}
                        onChange={(value) => setDefault(field.tag, value)}
                        extraOptions={fieldOptions[field.tag]}
                      />
                    </div>
                  )}
                </div>
                {field.hint && <p className="mt-1.5 text-xs leading-5 text-black/40">{field.hint}</p>}
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-black/[0.08] pt-6">
            <h4 className="text-lg font-extrabold text-black">Дополнительные общие теги</h4>
            <p className="mt-1 text-sm leading-6 text-black/50">
              Характеристики вашей категории, которые нужны всем объявлениям. Для вложенных тегов используйте «/», например Options/Option.
            </p>
            <div className="mt-4 space-y-2">
              {Object.keys(defaults)
                .filter((tag) => !DEFAULT_FIELD_TAGS.includes(tag))
                .map((tag) => (
                  <div key={tag} className="flex items-center gap-2">
                    <div className="w-1/3 min-w-[120px] shrink-0 truncate rounded-2xl bg-black/[0.04] px-4 py-3 text-sm font-extrabold text-black/70" title={tag}>{tag}</div>
                    <div className="min-w-0 flex-1">
                      <ValueInput value={defaults[tag]} onChange={(value) => setDefault(tag, value)} options={fieldOptions[tag]} />
                    </div>
                    <button type="button" onClick={() => setDefault(tag, "")} aria-label="Удалить" className="shrink-0 rounded-xl p-3 text-black/40 transition hover:bg-red-50 hover:text-red-600">
                      <Icon name="trash" />
                    </button>
                  </div>
                ))}
            </div>
            <div className="mt-3 max-w-md">
              <AddTagInput
                placeholder="Новый тег, например Brand"
                onAdd={(tag) => {
                  if (!isValidTagPath(tag)) return false;
                  setDefault(tag, defaults[tag] ?? " ");
                  return true;
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* ===== Проверка ===== */}
      {tab === "check" && (
        <section className="white-card p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black">Проверка перед отправкой</h3>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-black/55">
                Мы проверяем таблицу до того, как её увидит Авито: обязательные поля, длину текстов, ссылки на фото и уникальность ID. Точные требования к полям вашей категории есть в отчёте Авито после выгрузки.
              </p>
            </div>
            <button type="button" onClick={exportXml} disabled={ads.length === 0} className={ghostButton}>
              <Icon name="download" /> Скачать XML
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Без ошибок", value: readyAds, tone: "border-[#03bd48]/30 bg-[#03bd48]/[0.06] text-[#027a30]" },
              { label: "Ошибки", value: validation.errors, tone: validation.errors ? "border-red-200 bg-red-50 text-red-600" : "border-black/10 bg-black/[0.02] text-black/60" },
              { label: "Замечания", value: validation.warnings, tone: validation.warnings ? "border-amber-200 bg-amber-50 text-amber-700" : "border-black/10 bg-black/[0.02] text-black/60" },
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl border p-5 ${item.tone}`}>
                <div className="text-3xl font-extrabold tabular-nums">{item.value}</div>
                <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.1em] opacity-70">{item.label}</div>
              </div>
            ))}
          </div>

          {ads.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-black/[0.03] p-6 text-center text-sm font-bold text-black/45">Добавьте объявления, чтобы запустить проверку.</div>
          ) : validation.issues.length === 0 ? (
            <div className="al-pop mt-6 flex items-center gap-3 rounded-2xl border border-[#03bd48]/30 bg-[#03bd48]/[0.06] p-5 text-sm font-extrabold text-[#027a30]">
              <Icon name="check" className="h-5 w-5" /> Замечаний нет. Файл готов к подключению.
            </div>
          ) : (
            <div className="mt-6">
              <div className="mb-3 flex gap-2">
                {(["error", "warning"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setIssueFilter(level);
                      setIssueLimit(50);
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${
                      issueFilter === level ? "bg-black text-white" : "bg-black/[0.05] text-black/55 hover:bg-black/10"
                    }`}
                  >
                    {level === "error" ? `Ошибки · ${validation.errors}` : `Замечания · ${validation.warnings}`}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.08]">
                {issueList.slice(0, issueLimit).map((issue, position) => (
                  <button
                    key={`${issue.index}-${issue.tag}-${position}`}
                    type="button"
                    onClick={() => {
                      const uid = deferredAds[issue.index]?.uid;
                      if (uid) setRowModal(uid);
                    }}
                    className="flex w-full items-start gap-3 bg-white px-4 py-3 text-left transition hover:bg-black/[0.03]"
                  >
                    <Pill tone={issue.level === "error" ? "red" : "amber"} className="mt-0.5 shrink-0">
                      строка {issue.index + 1}
                    </Pill>
                    <span className="min-w-0 text-sm leading-6 text-black/70">
                      <b className="text-black">{tagLabel(issue.tag)}.</b> {issue.message}
                    </span>
                  </button>
                ))}
                {issueList.length === 0 && <div className="bg-white px-4 py-5 text-center text-sm font-bold text-black/40">В этой категории замечаний нет.</div>}
              </div>
              {issueList.length > issueLimit && (
                <button type="button" onClick={() => setIssueLimit((limit) => limit + 100)} className={`${ghostButton} mt-3`}>
                  Показать ещё
                </button>
              )}
            </div>
          )}

          {xmlPreview && (
            <div className="mt-8">
              <div className="mb-2 text-sm font-extrabold text-black">Как выглядит XML (первые два объявления)</div>
              <pre className="max-h-96 overflow-auto rounded-2xl bg-black p-5 text-[12px] leading-6 text-[#78f8a6]">{xmlPreview}</pre>
            </div>
          )}
        </section>
      )}

      {/* ===== Подключение ===== */}
      {tab === "connect" && (
        <section className="white-card p-5 sm:p-8">
          <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black">Подключение к Авито</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-black/55">
            HelpSell отдаёт Авито XML-файл по постоянной ссылке. Мы добавляем эту ссылку в ваш профиль автозагрузки через API. Копировать её в кабинет вручную не нужно.
          </p>

          <div className="mt-6 rounded-2xl bg-black p-5 text-white">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">Ссылка на XML-файл</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="min-w-0 flex-1 break-all text-sm font-semibold text-[#78f8a6]">{feed.publicUrl}</code>
              <button
                type="button"
                onClick={async () => toast((await copyText(feed.publicUrl)) ? "Ссылка скопирована." : "Не удалось скопировать ссылку.", "ok")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-extrabold transition hover:bg-white/20"
              >
                <Icon name="copy" /> Копировать
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-2.5">
            {[
              { ok: Boolean(account?.connected), text: "Подключён Avito API", hint: "Главная страница услуги → «Подключение Avito API»" },
              { ok: Boolean(profile?.exists), text: "Настроен профиль автозагрузки", hint: "Главная страница услуги → «Профиль автозагрузки»: почта и расписание" },
              { ok: ads.length > 0 && validation.errors === 0, text: ads.length === 0 ? "В таблице есть объявления" : "В таблице нет ошибок", hint: "Вкладка «Проверка»" },
              { ok: !dirty, text: "Изменения сохранены", hint: "Нажмите «Сохранить» внизу страницы" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 rounded-2xl border border-black/[0.08] bg-white px-4 py-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.ok ? "bg-[#03bd48] text-white" : "bg-black/10 text-black/35"}`}>
                  <Icon name={item.ok ? "check" : "close"} className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-black">{item.text}</div>
                  {!item.ok && <div className="text-xs font-semibold text-black/45">{item.hint}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {feed.linked ? (
              <button type="button" onClick={() => void setLinked(false)} disabled={linking} className={dangerButton}>
                {linking ? <Spinner /> : <Icon name="close" />} Отключить от автозагрузки
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void setLinked(true)}
                disabled={linking || !account?.connected || !profile?.exists || ads.length === 0}
                className="btn-primary inline-flex items-center gap-2 !px-6 !py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {linking ? <Spinner /> : <Icon name="link" />} Подключить к автозагрузке Авито
              </button>
            )}
            <button type="button" onClick={() => void sync()} disabled={syncing || !account?.connected} className={ghostButton}>
              {syncing ? <Spinner /> : <Icon name="refresh" />} Обновить статусы из отчёта
            </button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <InfoTile label="Авито забирал файл" value={feed.lastFetchedAt ? formatDateTime(feed.lastFetchedAt) : "ещё нет"} />
            <InfoTile label="Всего запросов файла" value={String(feed.fetchCount)} />
            <InfoTile label="Последняя сверка отчёта" value={formatDateTime(ads.map((row) => row.syncedAt).filter(Boolean).sort().pop() ?? null)} />
          </div>

          {syncResult && (
            <div className="al-pop mt-5 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-5">
              <div className="text-sm font-extrabold text-black">
                Сверка с {syncResult.partial ? "текущей (ещё идущей) загрузкой" : "последней завершённой загрузкой"} Авито №{syncResult.uploadId}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone="green">Найдено: {syncResult.matched}</Pill>
                <Pill tone={syncResult.errors ? "red" : "gray"}>С ошибками: {syncResult.errors}</Pill>
                <Pill tone={syncResult.warnings ? "amber" : "gray"}>С замечаниями: {syncResult.warnings}</Pill>
                <Pill tone="gray">Не найдено в отчёте: {syncResult.notFound}</Pill>
              </div>
              {syncResult.notFound > 0 && (
                <p className="mt-3 text-xs leading-5 text-black/45">Объявления «не найдено в отчёте» ещё не попали в выгрузку. Запустите загрузку и обновите статусы после её окончания.</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Плавающая панель сохранения */}
      {dirty && (
        <div className="al-pop sticky bottom-4 z-30 mx-auto flex w-fit max-w-full items-center gap-3 rounded-2xl bg-black px-4 py-3 text-white shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <span className="hidden text-sm font-bold text-white/70 sm:inline">Есть несохранённые изменения</span>
          <button
            type="button"
            onClick={() => void reload().then(() => toast("Изменения отменены."))}
            disabled={saving}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-extrabold transition hover:bg-white/10 disabled:opacity-50"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#03bd48] px-5 py-2 text-sm font-extrabold text-white transition hover:bg-[#04d152] disabled:opacity-60"
          >
            {saving ? <Spinner /> : <Icon name="check" />} Сохранить
          </button>
        </div>
      )}

      {/* Модальные окна */}
      {editingRow && (
        <RowEditor
          row={editingRow}
          defaults={defaults}
          issues={validation.byUid.get(editingRow.uid) ?? []}
          fieldOptions={fieldOptions}
          connected={Boolean(account?.connected)}
          onKey={(value) => updateRow(editingRow.uid, { key: value })}
          onCell={(tag, value) => setCell(editingRow.uid, tag, value)}
          onDelete={() => {
            removeRows([editingRow.uid]);
            setRowModal(null);
          }}
          onClose={() => setRowModal(null)}
          categoryBusy={categoryBusy}
          onPickCategory={(node) => void applyCategoryNode(node, { rowUids: [editingRow.uid] })}
          onOpenCatalog={() => setCategoryTarget({ rowUids: [editingRow.uid] })}
        />
      )}

      {importOpen && (
        <ImportModal currentCount={ads.length} onApply={applyImport} onClose={() => setImportOpen(false)} toast={toast} />
      )}

      {bulkOpen && (
        <BulkModal
          tags={availableTags}
          count={selectedList.length}
          fieldOptions={fieldOptions}
          onClose={() => setBulkOpen(false)}
          onApply={(tag, value) => {
            selectedList.forEach((row) => setCell(row.uid, tag, value));
            addColumn(tag);
            setBulkOpen(false);
            toast(`Значение задано для объявлений: ${selectedList.length}.`);
          }}
        />
      )}

      {categoryTarget && (
        <CategoryModal
          onClose={() => setCategoryTarget(null)}
          onPick={(node) => {
            const target = categoryTarget;
            setCategoryTarget(null);
            void applyCategoryNode(node, target);
          }}
          onAddColumn={(tag, values) => {
            if (addColumn(tag, values)) toast(`Столбец «${tag}» добавлен в таблицу.`);
            else toast(`Тег «${tag}» нельзя использовать как столбец.`, "error");
          }}
        />
      )}
    </div>
  );
}

/** Минимальная ширина столбца таблицы: чтобы значения не обрезались и не налезали друг на друга. */
function columnWidth(tag: string): number {
  switch (tag) {
    case "Id":
      return 130;
    case "Title":
      return 220;
    case "Price":
      return 96;
    case "Images":
      return 92;
    case "Description":
      return 112;
    case "Category":
    case "Address":
      return 200;
    case "ContactPhone":
      return 156;
    case "ManagerName":
    case "ContactMethod":
      return 150;
    case "DateBegin":
    case "DateEnd":
      return 132;
    default:
      return 140;
  }
}

type ReactBadge = { text: string; tone: "green" | "red" | "amber" | "gray" };

/* ---------- Мелкие компоненты ---------- */

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/40">{label}</div>
      <div className="mt-1.5 text-lg font-extrabold text-black">{value}</div>
    </div>
  );
}

function AddTagInput({ onAdd, placeholder }: { onAdd: (tag: string) => boolean; placeholder: string }) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    const tag = value.trim();
    if (!tag) return;
    if (onAdd(tag)) {
      setValue("");
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className={`${inputClass} !py-2.5`}
        />
        <button type="button" onClick={submit} className={ghostButton} aria-label="Добавить тег">
          <Icon name="plus" />
        </button>
      </div>
      {invalid && <p className="mt-1 text-xs font-bold text-red-600">Только латиница, цифры, «_», «-» и «/».</p>}
    </div>
  );
}

function FieldControl({
  id,
  field,
  value,
  onChange,
  placeholder,
  extraOptions,
}: {
  id: string;
  field: KnownField;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Значения из каталога категорий Авито для этого тега — точнее общего списка, если они загружены. */
  extraOptions?: string[];
}) {
  // Список из каталога категории приоритетнее общего: он точен именно для выбранной категории
  // (например, у «Платной услуги» и «Типа размещения» набор значений отличается по категориям).
  const dynamicOptions: FieldOption[] | undefined =
    extraOptions && extraOptions.length > 0 ? extraOptions.map((v) => ({ value: v, label: v })) : undefined;
  const options = dynamicOptions ?? field.options;

  if (options) {
    if (options.length > 6) {
      return (
        <SearchableSelect
          id={id}
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder ? `Как в общих полях: ${placeholder}` : "Начните вводить, чтобы найти значение…"}
        />
      );
    }
    return (
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">{placeholder ? `Как в общих полях: ${placeholder}` : "Не выбрано"}</option>
        {value && !options.some((option) => option.value === value) && <option value={value}>{value} — нет в списке</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.variant === "date") {
    return (
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} [color-scheme:light]`}
      />
    );
  }

  if (field.multiline) {
    return (
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={field.tag === "Images" ? 4 : 7}
        placeholder={field.placeholder}
        className={`${inputClass} resize-y leading-6`}
      />
    );
  }

  return (
    <input
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder ? `Как в общих полях: ${placeholder}` : field.placeholder}
      className={inputClass}
    />
  );
}

/** Для тегов без справочника KNOWN_FIELDS — но со списком значений из каталога категорий. */
function ValueInput({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  placeholder?: string;
}) {
  if (options && options.length > 0) {
    if (options.length > 6) {
      return (
        <SearchableSelect
          id={id}
          value={value}
          onChange={onChange}
          options={options.map((option) => ({ value: option, label: option }))}
          placeholder={placeholder ?? "Начните вводить, чтобы найти значение…"}
        />
      );
    }
    return (
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">{placeholder ?? "Не выбрано"}</option>
        {value && !options.includes(value) && <option value={value}>{value} — нет в списке</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClass} />;
}

function Cell({
  tag,
  row,
  placeholder,
  onKey,
  onValue,
  onOpen,
  hasIssue,
  extraOptions,
}: {
  tag: string;
  row: AdRow;
  placeholder?: string;
  onKey: (value: string) => void;
  onValue: (value: string) => void;
  onOpen: () => void;
  hasIssue: boolean;
  extraOptions?: string[];
}) {
  const ring = hasIssue ? "!border-red-300 bg-red-50/50" : "";

  if (tag === "Id") {
    return <input value={row.key} onChange={(event) => onKey(event.target.value)} aria-label="ID" className={`${cellInputClass} ${ring} font-extrabold`} />;
  }

  if (tag === "Images") {
    const count = splitImages(row.data.Images ?? "").length;
    return (
      <button type="button" onClick={onOpen} className={`${cellInputClass} ${ring} whitespace-nowrap text-left ${count ? "" : "text-black/30"}`}>
        {count ? `${count} фото` : "+ Фото"}
      </button>
    );
  }

  if (tag === "Category") {
    // Категорию нельзя вписывать вручную: только через выбор из каталога Авито (окно объявления).
    const own = row.data.Category ?? "";
    return (
      <button
        type="button"
        onClick={onOpen}
        title="Выбрать категорию из каталога Авито"
        className={`${cellInputClass} ${ring} whitespace-nowrap text-left ${own ? "" : "text-black/30"}`}
      >
        {own || placeholder || "+ Категория"}
      </button>
    );
  }

  if (tag === "Description") {
    const length = (row.data.Description ?? "").length;
    return (
      <button type="button" onClick={onOpen} className={`${cellInputClass} ${ring} whitespace-nowrap text-left ${length ? "" : "text-black/30"}`}>
        {length ? `Текст · ${length}` : "+ Описание"}
      </button>
    );
  }

  const field = FIELD_BY_TAG[tag];

  if (field?.variant === "date") {
    return (
      <input
        type="date"
        value={row.data[tag] ?? ""}
        onChange={(event) => onValue(event.target.value)}
        aria-label={tagLabel(tag)}
        className={`${cellInputClass} ${ring} [color-scheme:light]`}
      />
    );
  }

  const options =
    extraOptions && extraOptions.length > 0
      ? extraOptions.map((v) => ({ value: v, label: v }))
      : field?.options;
  if (options) {
    if (options.length > 6) {
      return (
        <SearchableSelect
          value={row.data[tag] ?? ""}
          onChange={onValue}
          options={options}
          placeholder={placeholder ?? "Найти значение…"}
          className={`${cellInputClass} ${ring}`}
        />
      );
    }
    return (
      <select value={row.data[tag] ?? ""} onChange={(event) => onValue(event.target.value)} className={`${cellInputClass} ${ring}`}>
        <option value="">{placeholder ?? "—"}</option>
        {row.data[tag] && !options.some((option) => option.value === row.data[tag]) && (
          <option value={row.data[tag]}>{row.data[tag]} — нет в списке</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      value={row.data[tag] ?? ""}
      onChange={(event) => onValue(event.target.value)}
      placeholder={placeholder}
      inputMode={tag === "Price" ? "decimal" : undefined}
      aria-label={tagLabel(tag)}
      className={`${cellInputClass} ${ring}`}
    />
  );
}

/* ---------- Окно объявления ---------- */
function RowEditor({
  row,
  defaults,
  issues,
  fieldOptions,
  connected,
  onKey,
  onCell,
  onDelete,
  onClose,
  onOpenCatalog,
  categoryBusy,
  onPickCategory,
}: {
  row: AdRow;
  defaults: AdData;
  issues: AdIssue[];
  fieldOptions: Record<string, string[]>;
  connected: boolean;
  onKey: (value: string) => void;
  onCell: (tag: string, value: string) => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenCatalog: () => void;
  categoryBusy: boolean;
  onPickCategory: (node: CatalogNode) => void;
}) {
  const custom = Object.keys(row.data).filter((tag) => !FIELD_BY_TAG[tag]);
  const images = splitImages(row.data.Images ?? defaults.Images ?? "").slice(0, 8);

  return (
    <Modal
      wide
      title={row.data.Title || row.key || "Объявление"}
      subtitle="Изменения применяются сразу. Не забудьте сохранить таблицу."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onDelete} className={dangerButton}>
            <Icon name="trash" /> Удалить объявление
          </button>
          <button type="button" onClick={onClose} className="btn-primary !px-6 !py-3 text-sm">
            Готово
          </button>
        </>
      }
    >
      {issues.length > 0 && (
        <div className="mb-5 space-y-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          {issues.map((issue, index) => (
            <div key={index} className={`text-sm font-bold ${issue.level === "error" ? "text-red-600" : "text-amber-800"}`}>
              {issue.level === "error" ? "Ошибка" : "Замечание"}: {issue.message}
            </div>
          ))}
        </div>
      )}

      {FIELD_GROUPS.map((group) => {
        const fields = KNOWN_FIELDS.filter((field) => field.group === group.id);
        return (
          <div key={group.id} className="mb-7">
            <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-black/40">{group.title}</div>
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => {
                const wide = field.multiline || field.tag === "Category";
                const value = field.tag === "Id" ? row.key : (row.data[field.tag] ?? "");
                const length = value.length;
                return (
                  <div key={field.tag} className={wide ? "md:col-span-2" : ""}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label htmlFor={`r-${field.tag}`} className="text-sm font-extrabold text-black">
                        {field.label}
                      </label>
                      {field.tag === "Title" && <span className={`text-xs font-bold ${length > 50 ? "text-red-600" : "text-black/35"}`}>{length}/50</span>}
                      {field.tag === "Description" && <span className={`text-xs font-bold ${length > 7500 ? "text-red-600" : "text-black/35"}`}>{length}/7500</span>}
                    </div>
                    {field.tag === "Category" ? (
                      <CategoryField
                        id={`r-${field.tag}`}
                        value={value}
                        connected={connected}
                        busy={categoryBusy}
                        onPickNode={onPickCategory}
                        onOpenCatalog={onOpenCatalog}
                      />
                    ) : (
                      <FieldControl
                        id={`r-${field.tag}`}
                        field={field}
                        value={value}
                        placeholder={defaults[field.tag]}
                        onChange={(next) => (field.tag === "Id" ? onKey(next) : onCell(field.tag, next))}
                        extraOptions={fieldOptions[field.tag]}
                      />
                    )}
                    {field.hint && field.tag !== "Category" && <p className="mt-1.5 text-xs leading-5 text-black/40">{field.hint}</p>}
                    {field.tag === "Images" && images.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {images.map((url, index) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${url}-${index}`}
                            src={url}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              event.currentTarget.style.opacity = "0.25";
                            }}
                            className="h-16 w-16 rounded-xl border border-black/10 bg-black/[0.04] object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="mb-7">
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-black/40">Дополнительные теги</div>
        <div className="space-y-2">
          {custom.map((tag) => (
            <div key={tag} className="flex items-center gap-2">
              <div className="w-1/3 min-w-[110px] shrink-0 truncate rounded-2xl bg-black/[0.04] px-4 py-3 text-sm font-extrabold text-black/70" title={tag}>{tag}</div>
              <div className="min-w-0 flex-1">
                <ValueInput value={row.data[tag]} onChange={(value) => onCell(tag, value)} options={fieldOptions[tag]} />
              </div>
              <button type="button" onClick={() => onCell(tag, "")} aria-label="Удалить тег" className="shrink-0 rounded-xl p-3 text-black/40 transition hover:bg-red-50 hover:text-red-600">
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 max-w-md">
          <AddTagInput
            placeholder="Новый тег, например Color"
            onAdd={(tag) => {
              if (!isValidTagPath(tag) || FIELD_BY_TAG[tag]) return false;
              onCell(tag, row.data[tag] ?? " ");
              return true;
            }}
          />
        </div>
      </div>

      {(row.avitoStatus || row.avitoMessages.length > 0 || row.avitoId) && (
        <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-extrabold text-black">Данные из отчёта Авито</div>
            {row.avitoStatus && <Pill tone={statusTone(row.avitoStatus, row.avitoMessages)}>{row.avitoStatus}</Pill>}
            {row.avitoId && (
              <a href={`https://www.avito.ru/${row.avitoId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-extrabold text-[#028c36] hover:underline">
                Объявление №{row.avitoId}
              </a>
            )}
            {row.syncedAt && <span className="text-xs font-semibold text-black/40">обновлено {formatDateTime(row.syncedAt)}</span>}
          </div>
          {row.avitoMessages.length > 0 && (
            <ul className="mt-3 space-y-2">
              {row.avitoMessages.map((message, index) => (
                <li key={index} className="text-sm leading-6 text-black/65">
                  <b className={message.type === "error" ? "text-red-600" : "text-amber-700"}>
                    {MESSAGE_KIND[kindOf(message.type)].label}: {message.title || message.type}
                  </b>
                  {message.description ? `. ${message.description}` : ""}
                  {fixHint(message.title, message.description) && (
                    <span className="mt-1 block rounded-lg bg-[#03bd48]/[0.07] px-2.5 py-1.5 text-xs font-semibold text-black/70">
                      Как исправить: {fixHint(message.title, message.description)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ---------- Импорт ---------- */
type ImportTab = "paste" | "file" | "url";

function ImportModal({
  currentCount,
  onApply,
  onClose,
  toast,
}: {
  currentCount: number;
  onApply: (result: ImportResult, mode: ImportMode) => void;
  onClose: () => void;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [tab, setTab] = useState<ImportTab>("paste");
  const [mode, setMode] = useState<ImportMode>(currentCount > 0 ? "merge" : "append");

  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState("");

  const [asyncParsed, setAsyncParsed] = useState<ImportResult | null>(null);
  const [asyncError, setAsyncError] = useState("");
  const [busy, setBusy] = useState(false);

  const pasteParsed = useMemo(() => (text.trim() ? buildImport(parseDelimited(text)) : null), [text]);
  const parsed = tab === "paste" ? pasteParsed : asyncParsed;

  const modes: { id: ImportMode; title: string; hint: string }[] = [
    { id: "append", title: "Добавить к существующим", hint: "Новые строки добавятся в конец. Одинаковые ID получат суффикс." },
    { id: "merge", title: "Обновить по ID и добавить новые", hint: "Строки с уже существующим ID обновят его поля." },
    { id: "replace", title: "Заменить всю таблицу", hint: "Все текущие объявления будут удалены." },
  ];

  async function downloadTemplate(format: "csv" | "xlsx") {
    (document.getElementById("al-template-menu") as HTMLDetailsElement | null)?.removeAttribute("open");
    const { headers, example } = buildTemplateRows();
    if (format === "csv") {
      downloadFile(buildTemplateCsv(headers, example), "helpsell-avito-shablon.csv", "text/csv;charset=utf-8");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
      (sheet as { ["!cols"]?: { wch: number }[] })["!cols"] = headers.map(() => ({ wch: 24 }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Объявления");
      const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      downloadBinary(
        data,
        "helpsell-avito-shablon.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch {
      toast("Не удалось собрать Excel-файл. Скачайте образец в формате CSV — он открывается и в Excel.", "error");
    }
  }

  async function handleExcelFile(file: File) {
    setFileName(file.name);
    setAsyncError("");
    setAsyncParsed(null);
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("empty");
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown as (
        | string
        | number
      )[][];
      const stringRows = rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
      setAsyncParsed(buildImport(stringRows));
    } catch {
      setAsyncError("Не удалось прочитать файл. Убедитесь, что это файл Excel (.xlsx) с таблицей на первом листе.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUrlImport() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setAsyncError("");
    setAsyncParsed(null);
    try {
      const result = await api<ImportResult>("/api/autoload/import-url", { json: { url: url.trim() } });
      setAsyncParsed(result);
    } catch (error) {
      setAsyncError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: ImportTab; label: string; icon: string }[] = [
    { id: "paste", label: "Вставить", icon: "table" },
    { id: "file", label: "Файл Excel", icon: "file" },
    { id: "url", label: "Ссылка", icon: "link" },
  ];

  return (
    <Modal
      wide
      title="Импорт объявлений"
      subtitle="Из Excel, Google Таблиц, Яндекс Таблиц или простой вставкой из буфера обмена."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostButton}>
            Отмена
          </button>
          <button
            type="button"
            disabled={!parsed || parsed.ads.length === 0 || parsed.recognized === 0}
            onClick={() => parsed && onApply(parsed, mode)}
            className="btn-primary !px-6 !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Импортировать{parsed && parsed.ads.length > 0 ? ` (${parsed.ads.length})` : ""}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1 rounded-2xl bg-black/[0.05] p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold transition-all duration-300 ${
                tab === item.id ? "bg-black text-white shadow-[0_8px_18px_rgba(16,24,40,0.18)]" : "text-black/55 hover:bg-white hover:text-black"
              }`}
            >
              <Icon name={item.icon} className="h-3.5 w-3.5" /> {item.label}
            </button>
          ))}
        </div>

        <div className="relative shrink-0">
          <details id="al-template-menu" className="group">
            <summary className={`${ghostButton} list-none [&::-webkit-details-marker]:hidden`}>
              <Icon name="download" /> Скачать образец
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.16)]">
              <button
                type="button"
                onClick={() => void downloadTemplate("xlsx")}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-bold text-black/75 transition hover:bg-black/[0.04]"
              >
                <Icon name="file" className="h-4 w-4 shrink-0" /> Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => void downloadTemplate("csv")}
                className="flex w-full items-center gap-2.5 border-t border-black/[0.06] px-4 py-3 text-left text-sm font-bold text-black/75 transition hover:bg-black/[0.04]"
              >
                <Icon name="file" className="h-4 w-4 shrink-0" /> CSV
              </button>
            </div>
          </details>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-black/40">
        В образце уже стоят правильные заголовки столбцов и одна строка-пример — заполните его своими товарами и загрузите обратно.
      </p>

      {tab === "paste" && (
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
          placeholder={"Название\tЦена\tОписание\tФото\nДиван угловой\t15000\tОтличное состояние\thttps://example.com/1.jpg"}
          className={`${inputClass} mt-4 resize-y font-mono !text-[12px] leading-6`}
        />
      )}

      {tab === "file" && (
        <div className="mt-4">
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-8 text-center transition ${
              fileName ? "border-[#03bd48]/50 bg-[#03bd48]/[0.05]" : "border-black/15 bg-black/[0.02] hover:border-[#03bd48]/50"
            }`}
          >
            <Icon name="upload" className="h-6 w-6 text-black/35" />
            <span className="text-sm font-extrabold text-black">{fileName || "Выберите файл Excel (.xlsx)"}</span>
            <span className="text-xs font-semibold text-black/40">Первый лист файла, первая строка — заголовки столбцов</span>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleExcelFile(file);
              }}
            />
          </label>
        </div>
      )}

      {tab === "url" && (
        <div className="mt-4">
          <p className="mb-2 text-sm leading-6 text-black/55">
            Ссылка на Google Таблицу или Яндекс Таблицу с открытым доступом «по ссылке». Строка загрузки открывает файл на сервере HelpSell — таблица не должна требовать входа в аккаунт.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleUrlImport();
                }
              }}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => void handleUrlImport()}
              disabled={busy || !url.trim()}
              className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Spinner /> : <Icon name="link" />} Загрузить
            </button>
          </div>
        </div>
      )}

      {busy && tab !== "url" && (
        <div className="al-pop mt-4 flex items-center gap-2.5 text-sm font-bold text-black/50">
          <Spinner /> Читаем файл…
        </div>
      )}

      {asyncError && (tab === "file" || tab === "url") && (
        <div className="al-pop mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-600">{asyncError}</div>
      )}

      {parsed && (
        <div className="al-pop mt-5 min-w-0">
          {parsed.recognized === 0 ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
              Не нашли ни одного знакомого заголовка. В первой строке должны быть названия столбцов: «Название», «Цена», «Фото» или XML-теги Title, Price, Images.
            </div>
          ) : (
            <>
              <div className="mb-2 text-sm font-extrabold text-black">
                Распознано столбцов: {parsed.recognized} из {parsed.mapping.length}. Объявлений: {parsed.ads.length}
              </div>
              <div className="flex flex-wrap gap-2">
                {parsed.mapping.map((item, index) => (
                  <Pill key={index} tone={item.tag ? "green" : "gray"} className="max-w-[220px]">
                    <span className="truncate">
                      {item.header || "без названия"}
                      {item.tag ? ` → ${item.tag}` : " · пропущен"}
                    </span>
                  </Pill>
                ))}
              </div>
              {currentCount + parsed.ads.length > MAX_ADS_PER_FEED && mode !== "replace" && (
                <p className="mt-3 text-xs font-bold text-amber-700">В таблицу поместится не больше {MAX_ADS_PER_FEED} объявлений, лишние будут отброшены.</p>
              )}
            </>
          )}
        </div>
      )}

      {currentCount > 0 && (
        <div className="mt-6 grid gap-2.5">
          {modes.map((item) => (
            <label
              key={item.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                mode === item.id ? "border-[#03bd48]/50 bg-[#03bd48]/[0.06]" : "border-black/[0.08] hover:border-black/20"
              }`}
            >
              <input type="radio" name="import-mode" checked={mode === item.id} onChange={() => setMode(item.id)} className="mt-1 h-4 w-4 shrink-0 accent-[#03bd48]" />
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-black">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-black/45">{item.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ---------- Массовое изменение ---------- */
function BulkModal({
  tags,
  count,
  fieldOptions,
  onApply,
  onClose,
}: {
  tags: string[];
  count: number;
  fieldOptions: Record<string, string[]>;
  onApply: (tag: string, value: string) => void;
  onClose: () => void;
}) {
  const [tag, setTag] = useState("Price");
  const [value, setValue] = useState("");
  const field = FIELD_BY_TAG[tag];

  return (
    <Modal
      title="Задать значение"
      subtitle={`Поле будет изменено у выбранных объявлений: ${count}. Пустое значение очистит поле.`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostButton}>
            Отмена
          </button>
          <button type="button" disabled={tag === "Id"} onClick={() => onApply(tag, value.trim())} className="btn-primary !px-6 !py-3 text-sm disabled:opacity-50">
            Применить
          </button>
        </>
      }
    >
      <label className="mb-1.5 block text-sm font-extrabold text-black" htmlFor="bulk-tag">
        Поле
      </label>
      <select
        id="bulk-tag"
        value={tag}
        onChange={(event) => {
          setTag(event.target.value);
          setValue("");
        }}
        className={inputClass}
      >
        {tags
          .filter((item) => item !== "Id")
          .map((item) => (
            <option key={item} value={item}>
              {tagLabel(item)}
            </option>
          ))}
      </select>

      <label className="mb-1.5 mt-5 block text-sm font-extrabold text-black" htmlFor="bulk-value">
        Значение
      </label>
      {field ? (
        <FieldControl id="bulk-value" field={field} value={value} onChange={setValue} extraOptions={fieldOptions[tag]} />
      ) : (
        <ValueInput id="bulk-value" value={value} onChange={setValue} options={fieldOptions[tag]} />
      )}
    </Modal>
  );
}

/* ---------- Каталог категорий Авито ---------- */
let catalogCache: CatalogNode[] | null = null;

/** Общий загрузчик каталога категорий: используют и инлайн-поиск у поля «Категория», и модалка «Каталог». */
function useCatalogNodes() {
  const [nodes, setNodes] = useState<CatalogNode[]>(catalogCache ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requested = useRef(false);

  const ensureLoaded = useCallback(() => {
    if (catalogCache || requested.current) return;
    requested.current = true;
    setLoading(true);
    setError("");
    api<{ nodes: CatalogNode[] }>("/api/autoload/catalog")
      .then((data) => {
        catalogCache = data.nodes;
        setNodes(data.nodes);
      })
      .catch((err) => {
        requested.current = false;
        setError(errorText(err));
      })
      .finally(() => setLoading(false));
  }, []);

  return { nodes, loading, error, ensureLoaded, loaded: nodes.length > 0 };
}

/**
 * Поле «Категория» с поиском: начинаете вводить название — показываются
 * подходящие категории из каталога Авито. Рядом — кнопка, открывающая
 * каталог целиком (там же видно, какие поля есть у выбранной категории).
 */
function CategoryField({
  id,
  value,
  connected,
  busy,
  onPickNode,
  onOpenCatalog,
}: {
  id?: string;
  value: string;
  connected: boolean;
  busy?: boolean;
  onPickNode: (node: CatalogNode) => void;
  onOpenCatalog: () => void;
}) {
  const { nodes, loading, error, ensureLoaded } = useCatalogNodes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useOutsideClose(open, [anchorRef, popupRef], () => {
    setOpen(false);
    setQuery("");
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? nodes.filter((node) => node.path.toLowerCase().includes(q)) : nodes;
    return list.slice(0, 60);
  }, [nodes, query]);

  return (
    <div className="flex gap-2">
      <div ref={anchorRef} className="relative min-w-0 flex-1">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          value={open ? query : value}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setOpen(true);
            if (connected) ensureLoaded();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          placeholder={busy ? "Загружаем поля категории…" : connected ? "Начните вводить: например, «Наушники»…" : "Сначала подключите Avito API"}
          disabled={!connected || busy}
          className={inputClass}
        />
        <AnchoredList open={open} anchorRef={anchorRef} popupRef={popupRef} minWidth={320}>
          {loading && <div className="px-3 py-2.5 text-sm font-semibold text-black/40">Загружаем категории…</div>}
          {error && <div className="px-3 py-2.5 text-sm font-bold text-red-600">{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="px-3 py-2.5 text-sm font-semibold text-black/40">Ничего не найдено</div>
          )}
          {!loading &&
            filtered.map((node, index) => (
              <button
                key={`${node.path}-${index}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                  onPickNode(node);
                }}
                className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition hover:bg-black/[0.05]"
              >
                <span className="w-full truncate text-sm font-bold text-black">{node.name}</span>
                {node.path !== node.name && <span className="w-full truncate text-xs text-black/40">{node.path}</span>}
              </button>
            ))}
        </AnchoredList>
      </div>
      <button
        type="button"
        onClick={onOpenCatalog}
        disabled={!connected || busy}
        title={connected ? "Открыть каталог целиком и посмотреть поля категории" : "Сначала подключите Avito API"}
        className={`${ghostButton} shrink-0`}
      >
        <Icon name="search" /> Каталог
      </button>
    </div>
  );
}

function CategoryModal({
  onPick,
  onAddColumn,
  onClose,
}: {
  onPick: (node: CatalogNode) => void;
  onAddColumn: (tag: string, values?: string[]) => void;
  onClose: () => void;
}) {
  const { nodes, loading, error, ensureLoaded } = useCatalogNodes();
  const [search, setSearch] = useState("");
  const [current, setCurrent] = useState<CatalogNode | null>(null);
  const [fields, setFields] = useState<CatalogField[] | null>(null);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState("");

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? nodes.filter((node) => node.path.toLowerCase().includes(q)) : nodes;
    return list.slice(0, 80);
  }, [nodes, search]);

  async function open(node: CatalogNode) {
    setCurrent(node);
    setFields(null);
    setFieldsError("");
    if (!node.slug) return;
    setFieldsLoading(true);
    try {
      const data = await api<{ fields: CatalogField[] }>(`/api/autoload/catalog?slug=${encodeURIComponent(node.slug)}`);
      setFields(data.fields);
    } catch (err) {
      setFieldsError(errorText(err));
    } finally {
      setFieldsLoading(false);
    }
  }

  return (
    <Modal
      wide
      title="Каталог категорий Авито"
      subtitle="Выберите самый вложенный раздел (например, «Наушники»): точную категорию Авито и обязательные значения (вид товара и т.п.) мы подставим сами."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostButton}>
            Отмена
          </button>
          <button type="button" disabled={!current} onClick={() => current && onPick(current)} className="btn-primary !px-6 !py-3 text-sm disabled:opacity-50">
            Выбрать «{current?.name ?? "…"}»
          </button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        <div className="min-w-0">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти категорию" className={`${inputClass} pl-10`} />
          </div>

          <div className="mt-3 max-h-[46vh] space-y-1 overflow-y-auto pr-1">
            {loading && [0, 1, 2, 3, 4].map((item) => <div key={item} className="al-skeleton h-12 rounded-xl" />)}
            {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}
            {!loading && !error && results.length === 0 && <div className="py-6 text-center text-sm font-bold text-black/40">Ничего не найдено.</div>}
            {results.map((node, index) => (
              <button
                key={`${node.path}-${index}`}
                type="button"
                onClick={() => void open(node)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition ${
                  current?.path === node.path ? "border-[#03bd48]/50 bg-[#03bd48]/[0.07]" : "border-transparent hover:bg-black/[0.04]"
                }`}
              >
                <div className="text-sm font-extrabold text-black">{node.name}</div>
                {node.path !== node.name && <div className="mt-0.5 truncate text-xs font-semibold text-black/40">{node.path}</div>}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4">
          <div className="text-sm font-extrabold text-black">Поля категории</div>
          {!current && <p className="mt-2 text-sm leading-6 text-black/45">Выберите категорию слева, и здесь появятся её поля.</p>}
          {current && !current.slug && <p className="mt-2 text-sm leading-6 text-black/45">У этого раздела нет отдельных полей. Выберите вложенную категорию.</p>}
          {fieldsLoading && <div className="al-skeleton mt-3 h-24 rounded-xl" />}
          {fieldsError && <p className="mt-3 text-sm font-bold text-red-600">{fieldsError}</p>}
          {fields && fields.length === 0 && <p className="mt-2 text-sm leading-6 text-black/45">Авито не вернул список полей для этой категории.</p>}
          {fields && fields.length > 0 && (
            <ul className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto pr-1">
              {fields.map((field) => (
                <li key={field.tag} className="rounded-xl border border-black/[0.08] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-black">{field.tag}</div>
                      {field.label !== field.tag && <div className="text-xs font-semibold text-black/45">{field.label}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {field.required && <Pill tone="red">обязательное</Pill>}
                      <button type="button" onClick={() => onAddColumn(field.tag, field.values)} aria-label={`Добавить столбец ${field.tag}`} className="rounded-lg p-1.5 text-black/45 transition hover:bg-[#03bd48]/10 hover:text-[#028c36]">
                        <Icon name="plus" />
                      </button>
                    </div>
                  </div>
                  {field.values.length > 0 && <div className="mt-2 text-xs leading-5 text-black/40">Значения: {field.values.slice(0, 8).join(", ")}{field.values.length > 8 ? "…" : ""}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
