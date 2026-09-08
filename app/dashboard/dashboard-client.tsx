"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type FinancialRecord = {
  id: number;
  recordDate: string;
  income: number;
  expense: number;
};

type FinancialDraft = FinancialRecord & {
  isNew?: boolean;
};

type AvitoAnalysisSummary = {
  id: number;
  searchQuery: string;
  city: string | null;
  itemsCount: number;
  createdAt: string;
};

type AvitoAd = {
  title?: string;
  price?: string;
  position?: number | null;
  link?: string;
};

type AvitoAnalysisItem = {
  id: number;
  sellerName: string;
  firstPosition: number | null;
  positions: number[];
  adsCount: number;
  rating: string | null;
  reviews: string | null;
  ads: AvitoAd[];
};

type AvitoAnalysisDetails = AvitoAnalysisSummary & {
  searchUrl: string | null;
  source: string;
  items: AvitoAnalysisItem[];
};

type DashboardPageProps = {
  user: {
    name: string;
    publicId: string;
    email: string;
    subscriptionLevel: string;
    subscriptionPriceText: string;
    subscriptionPaidAt: string;
    subscriptionEndsAt: string;
  };
  initialFinancialRecords: FinancialRecord[];
};

type DashboardSection =
  | "profile"
  | "avito"
  | "financial"
  | "popular-queries"
  | null;

function getSubscriptionStyle(level: string) {
  switch (level.toLowerCase()) {
    case "admin":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "basic":
      return "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";
    default:
      return "border-black/10 bg-black/[0.03] text-black/60";
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

function getTodayDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getDateBefore(daysBeforeToday: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysBeforeToday);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatRecordDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function getDateRange(start: string, end: string) {
  const result: string[] = [];
  const current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);

  while (current <= last) {
    const offset = current.getTimezoneOffset() * 60 * 1000;
    result.push(new Date(current.getTime() - offset).toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function getProfitClass(value: number) {
  if (value > 0) return "text-[#028c36]";
  if (value < 0) return "text-red-600";
  return "text-black/50";
}

function InfoCard({
  title,
  children,
  accent = false,
}: {
  title: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl p-4 ${
        accent
          ? "border border-[#03bd48]/20 bg-[#03bd48]/[0.06]"
          : "bg-black/[0.025]"
      }`}
    >
      <div
        className={`text-[10px] font-extrabold uppercase tracking-[0.1em] ${
          accent ? "text-[#027a30]/65" : "text-black/40"
        }`}
      >
        {title}
      </div>
      <div className="mt-2 min-w-0">{children}</div>
    </div>
  );
}

function MetricCard({
  title,
  children,
  className = "",
  action,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_10px_25px_rgba(16,24,40,0.05)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">
          {title}
        </div>
        {action}
      </div>
      <div className="mt-3 min-w-0">{children}</div>
    </div>
  );
}

function CollapseButton({
  isOpen,
  onClick,
  dark = false,
  label,
}: {
  isOpen: boolean;
  onClick: () => void;
  dark?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-label={label}
      title={isOpen ? "Свернуть блок" : "Раскрыть блок"}
      className={`group flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(16,24,40,0.12)] active:translate-y-0 ${
        dark
          ? "border-white/15 bg-white/10 text-white hover:border-[#03bd48]/60 hover:bg-[#03bd48]/15"
          : "border-black/10 bg-black/[0.025] text-black hover:border-[#03bd48]/50 hover:bg-[#03bd48]/[0.07] hover:text-[#028c36]"
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-lg transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen
            ? dark
              ? "bg-[#03bd48] text-white"
              : "bg-black text-white"
            : dark
              ? "bg-white/10 text-white/80"
              : "bg-white text-black/60"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>
  );
}

function CollapsibleContent({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div
        className={`min-h-0 overflow-hidden transition-all duration-300 ease-out ${
          isOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function FullscreenChartButton({
  onClick,
  expanded = false,
}: {
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-black/[0.025] px-3 text-xs font-extrabold text-black transition-all duration-300 hover:-translate-y-0.5 hover:border-[#03bd48]/50 hover:bg-[#03bd48]/[0.07] hover:text-[#028c36]"
      title={expanded ? "Вернуть обычный размер" : "Развернуть график на весь экран"}
      aria-label={expanded ? "Вернуть обычный размер графика" : "Развернуть график на весь экран"}
    >
      
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 transition-transform duration-300 group-hover:scale-110"
        aria-hidden="true"
      >
        {expanded ? (
          <>
            <path d="M9 3v6H3" />
            <path d="m3 3 6 6" />
            <path d="M15 21v-6h6" />
            <path d="m21 21-6-6" />
          </>
        ) : (
          <>
            <path d="M15 3h6v6" />
            <path d="m21 3-7 7" />
            <path d="M9 21H3v-6" />
            <path d="m3 21 7-7" />
          </>
        )}
      </svg>
    </button>
  );
}

function IncomeChart({
  data,
  expanded = false,
}: {
  data: { date: string; income: number; expense: number }[];
  expanded?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = Math.max(expanded ? 1800 : 1180, data.length * (expanded ? 128 : 92));
  const height = expanded ? 820 : 430;
  const paddingTop = expanded ? 100 : 58;
  const paddingBottom = expanded ? 116 : 78;
  const paddingX = expanded ? 112 : 64;
  const maxValue = Math.max(...data.map((item) => Math.max(item.income, item.expense)), 1);
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const getX = (index: number) =>
    data.length <= 1 ? width / 2 : paddingX + (index / (data.length - 1)) * chartWidth;
  const getY = (value: number) =>
    paddingTop + chartHeight - (value / maxValue) * chartHeight;
  const areaPath = [
    `M ${getX(0)} ${height - paddingBottom}`,
    ...data.map((item, index) => `L ${getX(index)} ${getY(item.income)}`),
    `L ${getX(data.length - 1)} ${height - paddingBottom}`,
    "Z",
  ].join(" ");
  const activeItem = activeIndex === null ? null : data[activeIndex] || null;
  const activeProfit = activeItem ? activeItem.income - activeItem.expense : 0;
  const tooltipWidth = expanded ? 280 : 206;
  const tooltipHeight = expanded ? 148 : 114;
  const tooltipX =
    activeIndex === null
      ? 0
      : Math.min(Math.max(getX(activeIndex) - tooltipWidth / 2, 8), width - tooltipWidth - 8);
  const tooltipY =
    activeIndex === null
      ? 0
      : Math.max(getY(activeItem?.income || 0) - tooltipHeight - 22, 8);
  const scale = expanded ? 1.35 : 1;

  return (
    <div className={expanded ? "flex min-h-0 flex-1 flex-col" : "min-w-0"}>
      {!expanded && (
        <div className="mb-4">
                   
        </div>
      )}
      <div
        className={`overflow-x-auto rounded-2xl border border-black/7 bg-black/[0.015] p-3 sm:p-5 ${
          expanded ? "min-h-0 flex-1" : ""
        }`}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`block h-auto w-full ${expanded ? "min-w-[2100px]" : "min-w-[1380px]"}`}
          role="img"
          aria-label="График доходов за выбранный период"
          onMouseLeave={() => setActiveIndex(null)}
          onClick={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient
              id={expanded ? "income-area-gradient-full" : "income-area-gradient"}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#03bd48" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#03bd48" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((position) => {
            const y = paddingTop + chartHeight * (1 - position);
            return (
              <g key={position}>
                <line
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={y}
                  y2={y}
                  stroke="rgba(16,16,16,0.08)"
                  strokeDasharray="4 7"
                />
                <text
                  x={paddingX}
                  y={y - 10}
                  fill="rgba(16,16,16,0.46)"
                  fontSize={14 * scale}
                  fontWeight="800"
                >
                  {formatMoney(Math.round(maxValue * position))} ₽
                </text>
              </g>
            );
          })}
          <path
            d={areaPath}
            fill={`url(#${expanded ? "income-area-gradient-full" : "income-area-gradient"})`}
          />
          {data.slice(1).map((item, index) => {
            const previous = data[index];
            return (
              <line
                key={`${item.date}-segment`}
                x1={getX(index)}
                y1={getY(previous.income)}
                x2={getX(index + 1)}
                y2={getY(item.income)}
                stroke={item.income >= previous.income ? "#03bd48" : "#ef4444"}
                strokeWidth={5 * scale}
                strokeLinecap="round"
              />
            );
          })}
          {activeIndex !== null && activeItem && (
            <>
              <line
                x1={getX(activeIndex)}
                x2={getX(activeIndex)}
                y1={paddingTop}
                y2={height - paddingBottom}
                stroke="rgba(16,16,16,0.18)"
                strokeDasharray="4 5"
              />
              <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                <rect width={tooltipWidth} height={tooltipHeight} rx={16 * scale} fill="#101010" />
                <text
                  x={16 * scale}
                  y={25 * scale}
                  fill="rgba(255,255,255,0.55)"
                  fontSize={15 * scale}
                  fontWeight="800"
                  letterSpacing="1"
                >
                  {formatRecordDate(activeItem.date).toUpperCase()}
                </text>
                <text
                  x={16 * scale}
                  y={53 * scale}
                  fill="#ffffff"
                  fontSize={15 * scale}
                  fontWeight="700"
                >
                  Доход: {formatMoney(activeItem.income)} ₽
                </text>
                <text
                  x={16 * scale}
                  y={77 * scale}
                  fill="rgba(255,255,255,0.62)"
                  fontSize={14 * scale}
                  fontWeight="600"
                >
                  Расход: {formatMoney(activeItem.expense)} ₽
                </text>
                <text
                  x={16 * scale}
                  y={105 * scale}
                  fill={activeProfit >= 0 ? "#03bd48" : "#f87171"}
                  fontSize={15 * scale}
                  fontWeight="800"
                >
                  Прибыль: {activeProfit > 0 ? "+" : ""}
                  {formatMoney(activeProfit)} ₽
                </text>
              </g>
            </>
          )}
          {data.map((item, index) => {
            const previousIncome = data[index - 1]?.income ?? item.income;
            const pointColor = item.income >= previousIncome ? "#03bd48" : "#ef4444";
            const isActive = activeIndex === index;
            return (
              <g
                key={item.date}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex(index);
                }}
              >
                <rect
                  x={getX(index) - 32 * scale}
                  y={paddingTop}
                  width={64 * scale}
                  height={chartHeight}
                  fill="transparent"
                />
                <circle
                  cx={getX(index)}
                  cy={getY(item.income)}
                  r={isActive ? 9 * scale : 7 * scale}
                  fill="#ffffff"
                  stroke={pointColor}
                  strokeWidth={isActive ? 4 * scale : 3 * scale}
                />
                <text
                  x={getX(index)}
                  y={height - 24}
                  textAnchor="middle"
                  fill={isActive ? "#028c36" : "rgba(16,16,16,0.58)"}
                  fontSize={19 * scale}
                  fontWeight={isActive ? "900" : "800"}
                >
                  {item.date.slice(8, 10)}.{item.date.slice(5, 7)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function DashboardClientPage({
  user,
  initialFinancialRecords,
}: DashboardPageProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>("profile");
  const [financialRecords, setFinancialRecords] =
    useState<FinancialRecord[]>(initialFinancialRecords);
  const [periodStart, setPeriodStart] = useState(getDateBefore(6));
  const [periodEnd, setPeriodEnd] = useState(getTodayDate());
  const [tablePeriodStart, setTablePeriodStart] = useState(getDateBefore(29));
  const [tablePeriodEnd, setTablePeriodEnd] = useState(getTodayDate());
  const [isEditingFinancials, setIsEditingFinancials] = useState(false);
  const [financialDrafts, setFinancialDrafts] = useState<FinancialDraft[]>([]);
  const [deletedRecordIds, setDeletedRecordIds] = useState<number[]>([]);
  const [financialSaving, setFinancialSaving] = useState(false);
  const [financialError, setFinancialError] = useState("");
  const [financialMessage, setFinancialMessage] = useState("");
  const [popularQuery, setPopularQuery] = useState("");
  const [startedPopularSearch, setStartedPopularSearch] = useState(false);
  const [isFinancialHeroOpen, setIsFinancialHeroOpen] = useState(true);
  const [isFinancialAnalyticsOpen, setIsFinancialAnalyticsOpen] = useState(true);
  const [isFinancialTableOpen, setIsFinancialTableOpen] = useState(true);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);

  const [isAvitoAnalyticsOpen, setIsAvitoAnalyticsOpen] = useState(false);
  const [avitoAnalyses, setAvitoAnalyses] = useState<AvitoAnalysisSummary[]>([]);
  const [selectedAvitoAnalysisId, setSelectedAvitoAnalysisId] = useState<number | null>(null);
  const [selectedAvitoAnalysis, setSelectedAvitoAnalysis] =
    useState<AvitoAnalysisDetails | null>(null);
  const [avitoAnalysesLoading, setAvitoAnalysesLoading] = useState(false);
  const [avitoAnalysisLoading, setAvitoAnalysisLoading] = useState(false);
  const [avitoAnalyticsError, setAvitoAnalyticsError] = useState("");
  const [avitoSearch, setAvitoSearch] = useState("");
  const [selectedAvitoRowIds, setSelectedAvitoRowIds] = useState<Set<number>>(
  new Set()
);
const [avitoOnlySelected, setAvitoOnlySelected] = useState(false);

  const subscriptionLevel = user.subscriptionLevel.toLowerCase();
  const hasAccess = subscriptionLevel === "basic" || subscriptionLevel === "admin";
  const isAdmin = subscriptionLevel === "admin";

  const toggleSection = (section: Exclude<DashboardSection, null>) =>
    setActiveSection((current) => (current === section ? null : section));

  const menuItems: {
  id: Exclude<DashboardSection, null>;
  index: string;
  title: string;
  description: string;
  available: boolean;
  inDevelopment?: boolean;
}[] = [
    {
      id: "profile",
      index: "01",
      title: "Мой профиль",
      description: "Данные аккаунта и подписка",
      available: true,
    },
    {
      id: "avito",
      index: "02",
      title: "Места в поиске Авито",
      description: hasAccess ? "Аналитика поисковых позиций" : "Доступно с подпиской Basic",
      available: hasAccess,
    },
    {
      id: "financial",
      index: "03",
      title: "Финансовый анализ",
      description: hasAccess ? "Доходы, расходы и прибыль" : "Доступно с подпиской Basic",
      available: hasAccess,
    },
    {
      id: "popular-queries",
      index: "04",
      title: "Запросы по популярности Авито",
      description: hasAccess ? "Подбор популярных запросов" : "Доступно с подпиской Basic",
      available: hasAccess,
      inDevelopment: true,
    },
  ];

  const tableRecordsInPeriod = useMemo(() => {
    return financialRecords
      .filter(
        (record) =>
          record.recordDate >= tablePeriodStart && record.recordDate <= tablePeriodEnd
      )
      .sort((a, b) => b.recordDate.localeCompare(a.recordDate));
  }, [financialRecords, tablePeriodStart, tablePeriodEnd]);

  const analytics = useMemo(() => {
    const recordByDate = new Map(financialRecords.map((record) => [record.recordDate, record]));
    const chartData = getDateRange(periodStart, periodEnd).map((date) => ({
      date,
      income: recordByDate.get(date)?.income ?? 0,
      expense: recordByDate.get(date)?.expense ?? 0,
    }));
    const income = chartData.reduce((sum, item) => sum + item.income, 0);
    const expense = chartData.reduce((sum, item) => sum + item.expense, 0);
    return { chartData, income, expense, netProfit: income - expense };
  }, [financialRecords, periodStart, periodEnd]);

  const popularQueryResults = useMemo(() => {
    const query = popularQuery.trim();
    return query
      ? [query, `${query} купить`, `${query} цена`, `${query} недорого`, `${query} с доставкой`]
      : [];
  }, [popularQuery]);

  const filteredAvitoItems = useMemo(() => {
  const q = avitoSearch.trim().toLowerCase();
  const items = selectedAvitoAnalysis?.items || [];

  const searchedItems = q
    ? items.filter((item) =>
        [
          item.sellerName,
          item.positions.join(" "),
          item.rating,
          item.reviews,
          ...item.ads.map((ad) => `${ad.title || ""} ${ad.price || ""}`),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : items;

  return avitoOnlySelected
    ? searchedItems.filter((item) => selectedAvitoRowIds.has(item.id))
    : searchedItems;
}, [
  selectedAvitoAnalysis,
  avitoSearch,
  avitoOnlySelected,
  selectedAvitoRowIds,
]);

  function startFinancialEditing() {
    setFinancialDrafts(tableRecordsInPeriod.map((record) => ({ ...record })));
    setDeletedRecordIds([]);
    setFinancialError("");
    setFinancialMessage("");
    setIsEditingFinancials(true);
  }

  function cancelFinancialEditing() {
    setFinancialDrafts([]);
    setDeletedRecordIds([]);
    setFinancialError("");
    setIsEditingFinancials(false);
  }

  function addFinancialRecord() {
    setFinancialDrafts((current) => [
      {
        id: -Date.now(),
        recordDate: getTodayDate(),
        income: 0,
        expense: 0,
        isNew: true,
      },
      ...current,
    ]);
  }

  function updateFinancialDraft(
    id: number,
    field: "recordDate" | "income" | "expense",
    value: string
  ) {
    setFinancialDrafts((current) =>
      current.map((record) => {
        if (record.id !== id) return record;
        return field === "recordDate"
          ? { ...record, recordDate: value }
          : { ...record, [field]: Math.max(0, Number(value) || 0) };
      })
    );
  }

  function removeFinancialDraft(record: FinancialDraft) {
    if (!record.isNew) setDeletedRecordIds((current) => [...current, record.id]);
    setFinancialDrafts((current) => current.filter((item) => item.id !== record.id));
  }

  async function saveFinancialChanges() {
    setFinancialSaving(true);
    setFinancialError("");
    setFinancialMessage("");
    const dates = financialDrafts.map((record) => record.recordDate);

    if (dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      setFinancialError("Проверьте корректность дат в таблице.");
      setFinancialSaving(false);
      return;
    }

    if (new Set(dates).size !== dates.length) {
      setFinancialError("В таблице не может быть нескольких строк с одинаковой датой.");
      setFinancialSaving(false);
      return;
    }

    try {
      const responses = await Promise.all([
        ...deletedRecordIds.map((id) =>
          fetch(`/api/financial-records/${id}`, { method: "DELETE" })
        ),
        ...financialDrafts.map((record) =>
          fetch(record.isNew ? "/api/financial-records" : `/api/financial-records/${record.id}`, {
            method: record.isNew ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordDate: record.recordDate,
              income: Math.max(0, Math.round(record.income)),
              expense: Math.max(0, Math.round(record.expense)),
            }),
          })
        ),
      ]);

      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const data = await failed.json().catch(() => null);
        setFinancialError(data?.error || "Не удалось сохранить изменения в таблице.");
        return;
      }

      const response = await fetch("/api/financial-records");
      const data = await response.json();

      if (!response.ok) {
        setFinancialError(data?.error || "Не удалось обновить данные финансового анализа.");
        return;
      }

      setFinancialRecords(data.records);
      setFinancialDrafts([]);
      setDeletedRecordIds([]);
      setIsEditingFinancials(false);
      setFinancialMessage("Финансовые данные успешно сохранены.");
    } catch (error) {
      console.error(error);
      setFinancialError("Ошибка сети. Попробуйте сохранить данные ещё раз.");
    } finally {
      setFinancialSaving(false);
    }
  }

  async function loadAvitoAnalysis(id: number) {
    setAvitoAnalysisLoading(true);
    setAvitoAnalyticsError("");
    setSelectedAvitoAnalysisId(id);
setSelectedAvitoRowIds(new Set());
setAvitoOnlySelected(false);

    try {
      const response = await fetch(`/api/avito-search-analyses/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Не удалось загрузить анализ");
      }

      setSelectedAvitoAnalysis(data.analysis);
    } catch (error) {
      setAvitoAnalyticsError(
        error instanceof Error ? error.message : "Не удалось загрузить анализ"
      );
    } finally {
      setAvitoAnalysisLoading(false);
    }
  }

  async function loadAvitoAnalyses() {
    setAvitoAnalysesLoading(true);
    setAvitoAnalyticsError("");

    try {
      const response = await fetch("/api/avito-search-analyses");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Не удалось загрузить анализы");
      }

      const analyses = Array.isArray(data.analyses) ? data.analyses : [];
      setAvitoAnalyses(analyses);

      if (analyses[0] && !selectedAvitoAnalysisId) {
        await loadAvitoAnalysis(analyses[0].id);
      }
    } catch (error) {
      setAvitoAnalyticsError(
        error instanceof Error ? error.message : "Не удалось загрузить анализы"
      );
    } finally {
      setAvitoAnalysesLoading(false);
    }
  }

  async function toggleAvitoAnalytics() {
    const next = !isAvitoAnalyticsOpen;
    setIsAvitoAnalyticsOpen(next);

    if (next && !avitoAnalyses.length) {
      await loadAvitoAnalyses();
    }
  }

  async function deleteAvitoAnalysis(id: number) {
    if (!window.confirm("Удалить этот анализ?")) return;

    const response = await fetch(`/api/avito-search-analyses/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setAvitoAnalyses((items) => items.filter((item) => item.id !== id));
      setSelectedAvitoAnalysis(null);
      setSelectedAvitoAnalysisId(null);
      setSelectedAvitoRowIds(new Set());
      setAvitoOnlySelected(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main internal-page-shell pb-12">
        <header className="mb-6 overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_24px_65px_rgba(16,24,40,0.2)] md:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black">
                <img
                  src="/logo.png"
                  alt="HelpSell logo"
                  className="h-[132%] w-[132%] max-w-none object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="mb-2 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-white/75">
                  HelpSell
                </div>
                <h1 className="truncate text-3xl font-extrabold tracking-[-0.04em] md:text-4xl">
                  Личный<span className="text-[#03bd48]"> кабинет</span>
                </h1>
                <p className="mt-2 truncate text-sm text-white/60">
                  Добро пожаловать, {user.name}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {isAdmin && (
                <Link href="/admin" className="btn-primary">
                  Админ-панель
                </Link>
              )}
              <Link href="/" className="btn-secondary">
                На главную
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button type="submit" className="btn-secondary">
                  Выйти
                </button>
              </form>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="h-fit rounded-[30px] bg-black p-4 text-white shadow-[0_20px_50px_rgba(16,24,40,0.16)] lg:sticky lg:top-5">
            <div className="border-b border-white/10 px-3 pb-5 pt-3">
              <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/40">
                Личный кабинет
              </div>
              <div className="mt-2 text-xl font-extrabold">Разделы</div>
            </div>

            <div className="mt-3 space-y-2">
              {menuItems.map((item) => {
                const isActive = activeSection === item.id;

                if (!item.available) {
                  return (
                    <div
                      key={item.id}
                      className="flex w-full items-center gap-3 rounded-2xl p-4 text-white/38"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs font-extrabold text-white/35">
                        {item.index}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
  <span>{item.title}</span>

  {item.inDevelopment && (
    <span
      className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em] ${
        isActive
          ? "border-amber-100/45 bg-amber-200/20 text-amber-50"
          : "border-amber-300/30 bg-amber-300/10 text-amber-200"
      }`}
    >
      В разработке
    </span>
  )}
</span>
                        <span className="mt-1 block text-xs leading-5 text-white/32">
                          {item.description}
                        </span>
                      </span>
                      <span className="text-base">🔒</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSection(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-2xl p-4 text-left transition ${
                      isActive
                        ? "bg-[#03bd48] text-white shadow-[0_12px_26px_rgba(3,189,72,0.22)]"
                        : "text-white/72 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                        isActive ? "bg-black/20 text-white" : "bg-white/10 text-white/65"
                      }`}
                    >
                      {item.index}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
  <span>{item.title}</span>

  {item.inDevelopment && (
    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-amber-200/70">
      В разработке
    </span>
  )}
</span>
                      <span
                        className={`mt-1 block text-xs leading-5 ${
                          isActive ? "text-white/78" : "text-white/42"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>
                    <span className="text-lg font-light">{isActive ? "−" : "+"}</span>
                  </button>
                );
              })}
            </div>

            <div className="mx-3 mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/40">
                Текущий тариф
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xl font-extrabold text-[#03bd48]">
                  {user.subscriptionLevel.toUpperCase()}
                </span>
                {hasAccess && (
                  <span className="rounded-full bg-[#03bd48]/15 px-2 py-1 text-[10px] font-extrabold uppercase text-[#03bd48]">
                    Активен
                  </span>
                )}
              </div>
              <div className="mt-2 text-sm text-white/55">
                Стоимость: {user.subscriptionPriceText}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            {activeSection === null && (
              <div className="flex min-h-[460px] items-center justify-center overflow-hidden rounded-[30px] bg-black p-8 text-center text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)]">
                <div className="max-w-md">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#03bd48] text-3xl font-extrabold">
                    +
                  </div>
                  <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.04em]">
                    Раздел закрыт
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-white/60">
                    Выберите раздел слева, чтобы посмотреть данные профиля или перейти к
                    доступным инструментам HelpSell.
                  </p>
                </div>
              </div>
            )}

            {activeSection === "profile" && (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                        Мой аккаунт
                      </div>
                      <h2 className="truncate text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                        {user.name}
                      </h2>
                      <p className="mt-3 break-all text-sm text-white/60">{user.email}</p>
                    </div>
                    <div className="rounded-2xl bg-[#03bd48] px-5 py-4 text-white">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/70">
                        Public ID
                      </div>
                      <div className="mt-1 text-2xl font-extrabold">{user.publicId}</div>
                    </div>
                  </div>
                </section>

                <section className="white-card min-w-0 p-6 md:p-8">
                  <div className="mb-7">
                    <div className="badge-green mb-3">Информация о подписке</div>
                    <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                      Ваши данные
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-black/50">
                      Здесь отображается актуальная информация по вашему аккаунту и доступу к сервису.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoCard title="Public ID" accent>
                      <div className="break-all text-lg font-extrabold text-[#027a30]">
                        {user.publicId}
                      </div>
                    </InfoCard>
                    <InfoCard title="Уровень подписки">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase ${getSubscriptionStyle(
                          user.subscriptionLevel
                        )}`}
                      >
                        {user.subscriptionLevel}
                      </span>
                    </InfoCard>
                    <InfoCard title="Стоимость">
                      <div className="text-lg font-extrabold text-black">
                        {user.subscriptionPriceText}
                      </div>
                    </InfoCard>
                    <InfoCard title="Дата оплаты">
                      <div className="text-sm font-bold leading-6 text-black">
                        {user.subscriptionPaidAt}
                      </div>
                    </InfoCard>
                    <InfoCard title="Дата окончания">
                      <div className="text-sm font-bold leading-6 text-black">
                        {user.subscriptionEndsAt}
                      </div>
                    </InfoCard>
                    <InfoCard title="Статус доступа" accent>
                      <div
                        className={`text-sm font-extrabold ${
                          hasAccess ? "text-[#028c36]" : "text-black/55"
                        }`}
                      >
                        {hasAccess ? "Доступ к сервисам активен" : "Требуется подписка Basic"}
                      </div>
                    </InfoCard>
                  </div>
                </section>

                {!hasAccess && (
                  <section className="overflow-hidden rounded-[30px] bg-[#03bd48] p-6 text-white shadow-[0_20px_50px_rgba(3,189,72,0.2)] md:p-8">
                    <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
                      <div>
                        <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
                          Расширьте возможности
                        </div>
                        <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.04em]">
                          Подключите Basic
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/85">
                          Подписка Basic откроет доступ к аналитике мест в поиске Авито,
                          финансовому анализу и рабочим инструментам платформы.
                        </p>
                      </div>
                      <Link
                        href="/pricing"
                        className="rounded-2xl bg-black px-5 py-4 text-sm font-extrabold text-white transition hover:bg-black/85"
                      >
                        Выбрать тариф
                      </Link>
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeSection === "avito" && hasAccess && (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
                  <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                        Инструменты HelpSell
                      </div>
                      <h2 className="text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                        Места в поиске<span className="text-[#03bd48]"> Авито</span>
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">
                        Сохраняйте результаты анализа из расширения и сравнивайте позиции
                        продавцов по датам в личном кабинете.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#03bd48] px-5 py-4 text-white shadow-[0_12px_25px_rgba(3,189,72,0.22)]">
  <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/70">
    Статус услуги
  </div>

  <div className="mt-1 text-lg font-extrabold">Доступ активен</div>

  <a
    href="https://helpsell.ru/extension"
    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-black/20 px-3 py-2.5 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-black/35"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
    Скачать расширение
  </a>
</div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-[30px] border border-black/[0.07] bg-white p-6 shadow-[0_18px_45px_rgba(16,24,40,0.07)] md:p-8">
                  <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="badge-green mb-4">Аналитика</div>
                      <h3 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                        Отслеживайте позиции
                      </h3>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-black/50">
                        Проверяйте сохранённые результаты парсинга: продавцов, позиции,
                        объявления, рейтинг и отзывы.
                      </p>
                    </div>

                    <button
  type="button"
  onClick={toggleAvitoAnalytics}
  className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-black px-5 py-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#03bd48]"
>
  <span>
    {isAvitoAnalyticsOpen ? "Закрыть аналитику" : "Открыть аналитику"}
  </span>
  <span
    className={`flex h-6 w-6 items-center justify-center rounded-lg transition-transform duration-300 ${
      isAvitoAnalyticsOpen ? "rotate-180" : "rotate-0"
    }`}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
</button>

                  </div>

                  <CollapsibleContent isOpen={isAvitoAnalyticsOpen}>
                    <div className="mt-7 border-t border-black/[0.07] pt-7">
                      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
                            Аналитика мест в поиске
                          </h4>
                          <p className="mt-1 text-sm text-black/48">
                            Выберите сохранение по дате и запросу, чтобы открыть подробную таблицу.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={loadAvitoAnalyses}
                          disabled={avitoAnalysesLoading}
                          className="btn-secondary disabled:opacity-60"
                        >
                          {avitoAnalysesLoading ? "Загрузка..." : "Обновить"}
                        </button>
                      </div>

                      {avitoAnalyticsError && (
                        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                          {avitoAnalyticsError}
                        </div>
                      )}

                      {avitoAnalysesLoading && !avitoAnalyses.length && (
                        <div className="rounded-3xl border border-dashed border-black/15 bg-black/[0.02] p-10 text-center text-sm font-semibold text-black/50">
                          Загружаем сохранённые анализы...
                        </div>
                      )}

                      {!avitoAnalysesLoading && !avitoAnalyses.length && (
                        <div className="rounded-3xl border border-dashed border-black/15 bg-black/[0.02] p-10 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#03bd48]/10 text-xl font-extrabold text-[#028c36]">
                            01
                          </div>
                          <h4 className="mt-4 text-xl font-extrabold text-black">
                            Пока нет сохранённых анализов
                          </h4>
                          <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-black/50">
                            Откройте поиск Авито, запустите расширение и во вкладке
                            «По продавцам» нажмите «Сохранить анализ в личный кабинет».
                          </p>
                        </div>
                      )}

                      {avitoAnalyses.length > 0 && (
                        <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
                          <div className="max-h-[600px] space-y-2 overflow-y-auto rounded-3xl border border-black/[0.07] bg-black/[0.018] p-3">
                            {avitoAnalyses.map((analysis) => (
                              <button
                                key={analysis.id}
                                type="button"
                                onClick={() => loadAvitoAnalysis(analysis.id)}
                                className={`w-full rounded-2xl border p-4 text-left transition ${
                                  selectedAvitoAnalysisId === analysis.id
                                    ? "border-[#03bd48] bg-[#03bd48]/10"
                                    : "border-transparent bg-white hover:border-black/10"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-extrabold text-black">
                                    {new Intl.DateTimeFormat("ru-RU", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    }).format(new Date(analysis.createdAt))}
                                  </span>
                                  <span className="rounded-full bg-black/[0.06] px-2 py-1 text-[10px] font-extrabold">
                                    {analysis.itemsCount}
                                  </span>
                                </div>
                                <div className="mt-2 truncate text-sm font-bold text-[#028c36]">
                                  {analysis.searchQuery || "Запрос не указан"}
                                </div>
                                <div className="mt-1 text-xs text-black/45">
                                  Продавцов: {analysis.itemsCount}
                                </div>
                              </button>
                            ))}
                          </div>

                          <div className="min-w-0 rounded-3xl border border-black/[0.07] bg-white p-4 md:p-5">
                            {avitoAnalysisLoading && (
                              <div className="py-16 text-center text-sm font-semibold text-black/50">
                                Загружаем выбранный анализ...
                              </div>
                            )}

                            {!avitoAnalysisLoading && selectedAvitoAnalysis && (
                              <>
                                <div className="flex flex-col gap-4 border-b border-black/[0.07] pb-5 sm:flex-row sm:justify-between">
                                  <div>
                                    <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/40">
                                      Выбранный анализ
                                    </div>
                                    <h4 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-black">
                                      {selectedAvitoAnalysis.searchQuery || "Поисковый запрос"}
                                    </h4>
                                    <p className="mt-2 text-sm text-black/48">
                                      {new Intl.DateTimeFormat("ru-RU", {
                                        dateStyle: "long",
                                        timeStyle: "short",
                                      }).format(new Date(selectedAvitoAnalysis.createdAt))}{" "}
                                      · {selectedAvitoAnalysis.itemsCount} продавцов
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => deleteAvitoAnalysis(selectedAvitoAnalysis.id)}
                                    className="h-fit rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-extrabold text-red-600"
                                  >
                                    Удалить
                                  </button>
                                </div>

                                <div className="mt-5 rounded-3xl border border-black/[0.07] bg-[linear-gradient(135deg,rgba(3,189,72,0.07),rgba(255,255,255,0.96))] p-3 sm:p-4">
  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">
        Поиск по продавцу, позиции, объявлению или цене
      </span>

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </svg>

      <input
        value={avitoSearch}
        onChange={(event) => setAvitoSearch(event.target.value)}
        placeholder="Поиск по продавцу, позиции, объявлению или цене..."
        className="w-full rounded-2xl border border-black/10 bg-white py-3.5 pl-11 pr-4 text-sm font-semibold text-black outline-none transition placeholder:text-black/35 focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
      />
    </label>

    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3 text-xs font-extrabold text-black/70 transition hover:border-[#03bd48]/40 hover:bg-[#03bd48]/[0.04]">
        <input
          type="checkbox"
          checked={avitoOnlySelected}
          onChange={(event) => setAvitoOnlySelected(event.target.checked)}
          className="h-4 w-4 rounded border-black/25 accent-[#03bd48]"
        />
        Оставить только выделенные
      </label>

      {selectedAvitoRowIds.size > 0 && (
        <button
          type="button"
          onClick={() => {
            setSelectedAvitoRowIds(new Set());
            setAvitoOnlySelected(false);
          }}
          className="rounded-xl border border-[#03bd48]/25 bg-[#03bd48]/10 px-3 py-3 text-xs font-extrabold text-[#028c36] transition hover:bg-[#03bd48]/20"
        >
          Снять выделение ({selectedAvitoRowIds.size})
        </button>
      )}
    </div>
  </div>

  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
    <span className="rounded-full bg-black/[0.06] px-3 py-1.5 font-bold text-black/55">
      В таблице: {filteredAvitoItems.length}
    </span>

    <span className="rounded-full bg-[#03bd48]/10 px-3 py-1.5 font-extrabold text-[#028c36]">
      Выбрано: {selectedAvitoRowIds.size}
    </span>

    {avitoOnlySelected && (
      <span className="rounded-full bg-amber-100 px-3 py-1.5 font-extrabold text-amber-800">
        Показаны только выделенные
      </span>
    )}
  </div>
</div>

<div className="mt-5 overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_12px_28px_rgba(16,24,40,0.05)]">
  <div className="max-h-[650px] overflow-auto">
    <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
      <thead className="sticky top-0 z-10 bg-[#101010] shadow-[0_2px_0_rgba(255,255,255,0.08)]">
        <tr className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/65">
          <th className="w-[62px] px-4 py-4 text-center">
            <input
              type="checkbox"
              aria-label="Выбрать все отображаемые строки"
              checked={
                filteredAvitoItems.length > 0 &&
                filteredAvitoItems.every((item) => selectedAvitoRowIds.has(item.id))
              }
              onChange={(event) => {
                const checked = event.target.checked;

                setSelectedAvitoRowIds((current) => {
                  const next = new Set(current);

                  filteredAvitoItems.forEach((item) => {
                    if (checked) {
                      next.add(item.id);
                    } else {
                      next.delete(item.id);
                    }
                  });

                  return next;
                });
              }}
              className="h-4 w-4 cursor-pointer rounded border-white/30 accent-[#03bd48]"
            />
          </th>
          <th className="w-[150px] px-4 py-4">Позиции</th>
          <th className="w-[190px] px-4 py-4">Продавец</th>
          <th className="w-[110px] px-4 py-4 text-center">Объявлений</th>
          <th className="w-[100px] px-4 py-4 text-center">Рейтинг</th>
          <th className="w-[100px] px-4 py-4 text-center">Отзывы</th>
          <th className="px-4 py-4">Первое объявление</th>
        </tr>
      </thead>

      <tbody>
        {filteredAvitoItems.map((item) => {
          const ad = item.ads[0];
          const isSelected = selectedAvitoRowIds.has(item.id);
          const positions = item.positions.length
            ? item.positions.join(", ")
            : item.firstPosition ?? "—";

          return (
            <tr
              key={item.id}
              onClick={() => {
                setSelectedAvitoRowIds((current) => {
                  const next = new Set(current);

                  if (next.has(item.id)) {
                    next.delete(item.id);
                  } else {
                    next.add(item.id);
                  }

                  return next;
                });
              }}
              className={`cursor-pointer border-b border-black/[0.06] text-sm transition last:border-b-0 ${
                isSelected
                  ? "bg-[#03bd48]/[0.12] shadow-[inset_4px_0_0_#03bd48]"
                  : "bg-white hover:bg-[#03bd48]/[0.035]"
              }`}
            >
              <td className="px-4 py-4 text-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  aria-label={`Выбрать продавца ${item.sellerName}`}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => {
                    setSelectedAvitoRowIds((current) => {
                      const next = new Set(current);

                      if (next.has(item.id)) {
                        next.delete(item.id);
                      } else {
                        next.add(item.id);
                      }

                      return next;
                    });
                  }}
                  className="h-4 w-4 cursor-pointer rounded border-black/25 accent-[#03bd48]"
                />
              </td>

              <td className="px-4 py-4 align-top">
                <span
                  className={`inline-flex rounded-xl px-2.5 py-1.5 text-xs font-extrabold ${
                    isSelected
                      ? "bg-[#03bd48] text-white"
                      : "bg-[#03bd48]/10 text-[#028c36]"
                  }`}
                >
                  {positions}
                </span>
              </td>

              <td className="px-4 py-4 align-top">
                <div className="truncate font-extrabold text-black" title={item.sellerName}>
                  {item.sellerName}
                </div>

                {isSelected && (
                  <div className="mt-1 text-[11px] font-extrabold text-[#028c36]">
                    Выбрано для сравнения
                  </div>
                )}
              </td>

              <td className="px-4 py-4 text-center align-top">
                <span className="inline-flex min-w-9 justify-center rounded-lg bg-black/[0.05] px-2 py-1 text-xs font-extrabold text-black/70">
                  {item.adsCount}
                </span>
              </td>

              <td className="px-4 py-4 text-center align-top">
                <span className="font-extrabold text-black">
                  {item.rating || "—"}
                </span>
              </td>

              <td className="px-4 py-4 text-center align-top">
                <span className="font-extrabold text-black">
                  {item.reviews || "—"}
                </span>
              </td>

              <td className="px-4 py-4 align-top">
                {ad?.link ? (
                  <a
                    href={ad.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate font-extrabold text-[#028c36] transition hover:text-[#016f2b] hover:underline"
                    title={ad.title || "Открыть объявление"}
                  >
                    {ad.title || "Открыть объявление"}
                  </a>
                ) : (
                  <div className="truncate font-bold text-black/65">
                    {ad?.title || "—"}
                  </div>
                )}

                {ad?.price && (
                  <div className="mt-1 text-xs font-bold text-black/45">
                    {ad.price}
                  </div>
                )}
              </td>
            </tr>
          );
        })}

        {filteredAvitoItems.length === 0 && (
          <tr>
            <td colSpan={7} className="px-5 py-16 text-center">
              <div className="mx-auto max-w-sm">
                <div className="text-base font-extrabold text-black">
                  {avitoOnlySelected
                    ? "Нет выбранных строк для отображения"
                    : "По вашему поиску ничего не найдено"}
                </div>
                <p className="mt-2 text-sm leading-6 text-black/45">
                  {avitoOnlySelected
                    ? "Снимите фильтр «Оставить только выделенные» или выберите строки в таблице."
                    : "Измените поисковый запрос или выберите другой сохранённый анализ."}
                </p>
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </section>
              </div>
            )}

            {activeSection === "financial" && hasAccess && (
              <div className="space-y-6">
                <section className="relative overflow-hidden rounded-[32px] bg-[#101010] text-white shadow-[0_24px_65px_rgba(16,24,40,0.22)]">
                  <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#03bd48]/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-white/[0.035] blur-3xl" />

                  <div className="relative flex items-start justify-between gap-5 p-6 md:p-8">
                    <div className="min-w-0">
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                        Инструменты HelpSell
                      </div>

                      <h2 className="text-3xl font-extrabold tracking-[-0.055em] md:text-5xl">
                        Финансовый<span className="text-[#03bd48]"> анализ</span>
                      </h2>

                      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 md:text-[15px]">
                        Добавляйте ежедневные доходы и расходы, следите за
                        чистой прибылью и динамикой выручки за нужный период.
                      </p>
                    </div>

                    <CollapseButton
                      isOpen={isFinancialHeroOpen}
                      onClick={() => setIsFinancialHeroOpen((current) => !current)}
                      dark
                      label="Свернуть или раскрыть описание финансового анализа"
                    />
                  </div>

                  <CollapsibleContent isOpen={isFinancialHeroOpen}>
  <div className="relative grid gap-3 border-t border-white/10 p-6 pt-5 sm:grid-cols-2 md:p-8 md:pt-5">
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm transition hover:border-[#03bd48]/40 hover:bg-white/[0.08]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/45">
            Указан период
          </div>

          <div className="mt-2 text-base font-extrabold tracking-[-0.035em] text-white md:text-xl">
            {formatRecordDate(periodStart)} — {formatRecordDate(periodEnd)}
          </div>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#03bd48] shadow-[0_9px_18px_rgba(0,0,0,0.16)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M4 19V5" />
            <path d="M4 19h16" />
            <path d="m7 15 4-4 3 2 5-6" />
          </svg>
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-[#03bd48]/25 bg-[#03bd48]/[0.12] p-5 backdrop-blur-sm transition hover:border-[#03bd48]/55 hover:bg-[#03bd48]/[0.16]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/55">
            Чистая прибыль
          </div>

          <div
            className={`mt-2 text-4xl font-extrabold tracking-[-0.05em] ${
              analytics.netProfit >= 0 ? "text-[#03bd48]" : "text-red-400"
            }`}
          >
            {analytics.netProfit > 0 ? "+" : ""}
            {formatMoney(analytics.netProfit)} ₽
          </div>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#03bd48] text-white shadow-[0_9px_18px_rgba(3,189,72,0.28)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <rect x="3" y="7" width="18" height="11" rx="2" />
            <path d="M5 9h14" />
            <path d="M5 16h14" />
            <circle cx="12" cy="12.5" r="2.3" />
            <path d="M12 10.8v3.4" />
            <path d="M10.9 11.6c.25-.45.7-.7 1.2-.7.75 0 1.35.45 1.35 1.05 0 1.3-2.55.7-2.55 2.05 0 .6.62 1.05 1.4 1.05.55 0 1.04-.25 1.3-.7" />
            <path d="M6 5h12" opacity="0.8" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</CollapsibleContent>
                </section>

                <section className="overflow-hidden rounded-[32px] border border-black/[0.07] bg-white p-5 shadow-[0_18px_45px_rgba(16,24,40,0.07)] md:p-8">
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0">
                      <div className="mb-3 inline-flex rounded-full bg-[#03bd48]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#027a30]">
                        Аналитика
                      </div>
                      <h2 className="text-3xl font-extrabold tracking-[-0.045em] text-black">
                        Показатели за период
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-black/48">
                        Все значения пересчитываются автоматически по данным из вашей
                        таблицы доходов и расходов.
                      </p>
                    </div>
                    <CollapseButton
                      isOpen={isFinancialAnalyticsOpen}
                      onClick={() => setIsFinancialAnalyticsOpen((current) => !current)}
                      label="Свернуть или раскрыть показатели за период"
                    />
                  </div>

                  <CollapsibleContent isOpen={isFinancialAnalyticsOpen}>
                    <div className="mt-7 space-y-5">
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className="group relative overflow-hidden rounded-3xl border border-[#03bd48]/25 bg-[linear-gradient(135deg,rgba(3,189,72,0.13),rgba(3,189,72,0.035))] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(3,189,72,0.13)]">
                          <div className="absolute -right-5 -top-7 h-24 w-24 rounded-full bg-[#03bd48]/10" />
                          <div className="relative flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#027a30]/65">
                                Доходы
                              </div>
                              <div className="mt-3 text-3xl font-extrabold tracking-[-0.055em] text-[#028c36]">
                                {formatMoney(analytics.income)} ₽
                              </div>
                              
                            </div>
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#03bd48] text-lg font-extrabold text-white shadow-[0_9px_18px_rgba(3,189,72,0.28)]">
                              ₽
                            </div>
                          </div>
                        </div>

                        <div className="group relative overflow-hidden rounded-3xl border border-red-200/80 bg-[linear-gradient(135deg,rgba(254,242,242,0.95),rgba(255,255,255,0.9))] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(239,68,68,0.10)]">
                          <div className="absolute -right-5 -top-7 h-24 w-24 rounded-full bg-red-100/70" />
                          <div className="relative flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-red-600/65">
                                Расходы
                              </div>
                              <div className="mt-3 text-3xl font-extrabold tracking-[-0.055em] text-red-600">
                                {formatMoney(analytics.expense)} ₽
                              </div>
                              
                            </div>
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-xl font-extrabold text-white shadow-[0_9px_18px_rgba(239,68,68,0.22)]">
                              −
                            </div>
                          </div>
                        </div>

                        <div
                          className={`group relative overflow-hidden rounded-3xl border p-5 transition duration-300 hover:-translate-y-1 ${
                            analytics.netProfit >= 0
                              ? "border-black/10 bg-black text-white shadow-[0_16px_30px_rgba(16,16,16,0.16)]"
                              : "border-red-200 bg-red-50 shadow-[0_16px_30px_rgba(239,68,68,0.1)]"
                          }`}
                        >
                          <div
                            className={`absolute -right-5 -top-7 h-24 w-24 rounded-full ${
                              analytics.netProfit >= 0 ? "bg-[#03bd48]/20" : "bg-red-200/60"
                            }`}
                          />
                          <div className="relative flex items-start justify-between gap-4">
                            <div>
                              <div
                                className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                                  analytics.netProfit >= 0
                                    ? "text-white/48"
                                    : "text-red-600/65"
                                }`}
                              >
                                Чистая прибыль
                              </div>
                              <div
                                className={`mt-3 text-3xl font-extrabold tracking-[-0.055em] ${
                                  analytics.netProfit >= 0 ? "text-[#03bd48]" : "text-red-600"
                                }`}
                              >
                                {analytics.netProfit > 0 ? "+" : ""}
                                {formatMoney(analytics.netProfit)} ₽
                              </div>
                              
                            </div>
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold ${
                                analytics.netProfit >= 0
                                  ? "bg-[#03bd48] text-white"
                                  : "bg-red-500 text-white"
                              }`}
                            >
                              {analytics.netProfit >= 0 ? "+" : "−"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-black/[0.07] bg-[linear-gradient(180deg,#ffffff,#fafbfb)] p-3 shadow-[0_12px_30px_rgba(16,24,40,0.04)] md:p-5">
                        <MetricCard
                          title="График доходов"
                          className="border-0 bg-transparent p-0 shadow-none"
                          action={<FullscreenChartButton onClick={() => setIsChartFullscreen(true)} />}
                        >
                          <IncomeChart data={analytics.chartData} />
                        </MetricCard>
                      </div>

                      {isChartFullscreen &&
                        typeof document !== "undefined" &&
                        createPortal(
                          <div className="fixed inset-0 z-[9999] flex min-h-screen flex-col bg-white p-4 md:p-8">
                            <div className="mx-auto flex w-full max-w-[1920px] min-h-0 flex-1 flex-col">
                              <div className="mb-5 flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <div className="text-3xl font-extrabold tracking-[-0.04em] text-black md:text-4xl">
                                    График доходов
                                  </div>
                                  <p className="mt-2 text-sm text-black/50">
                                    Полноэкранный режим: все точки, даты и значения
                                    увеличены пропорционально.
                                  </p>
                                </div>
                                <FullscreenChartButton
                                  expanded
                                  onClick={() => setIsChartFullscreen(false)}
                                />
                              </div>
                              <IncomeChart data={analytics.chartData} expanded />
                            </div>
                          </div>,
                          document.body
                        )}

                      <div className="rounded-3xl border border-black/[0.07] bg-black/[0.018] p-4 md:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                            <div className="text-sm font-extrabold text-black">
                              Период аналитики
                            </div>
                            <p className="mt-1 text-sm text-black/48">
                              По умолчанию отображаются последние 7 дней.
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-2 block text-xs font-bold text-black/50">
                                Начало периода
                              </span>
                              <input
                                type="date"
                                value={periodStart}
                                max={periodEnd}
                                onChange={(event) => setPeriodStart(event.target.value)}
                                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm font-bold outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-xs font-bold text-black/50">
                                Конец периода
                              </span>
                              <input
                                type="date"
                                value={periodEnd}
                                min={periodStart}
                                max={getTodayDate()}
                                onChange={(event) => setPeriodEnd(event.target.value)}
                                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm font-bold outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </section>

                <section className="overflow-hidden rounded-[32px] border border-black/[0.07] bg-white p-5 shadow-[0_18px_45px_rgba(16,24,40,0.07)] md:p-8">
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0">
                      <div className="mb-3 inline-flex rounded-full bg-black/[0.045] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/55">
                        Учёт
                      </div>
                      <h2 className="text-3xl font-extrabold tracking-[-0.045em] text-black">
                        Доходы и расходы
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-black/50">
                        Вносите данные за день. Чистая прибыль рассчитывается автоматически.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {!isEditingFinancials && (
                        <button
                          type="button"
                          onClick={startFinancialEditing}
                          className="btn-primary shrink-0 shadow-[0_10px_22px_rgba(3,189,72,0.2)]"
                        >
                          Редактировать
                        </button>
                      )}
                      <CollapseButton
                        isOpen={isFinancialTableOpen}
                        onClick={() => setIsFinancialTableOpen((current) => !current)}
                        label="Свернуть или раскрыть таблицу доходов и расходов"
                      />
                    </div>
                  </div>

                  <CollapsibleContent isOpen={isFinancialTableOpen}>
                    <div>
                      <div className="mt-6 rounded-3xl border border-black/[0.07] bg-[linear-gradient(135deg,rgba(3,189,72,0.055),rgba(255,255,255,0.9))] p-4 md:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                            <div className="text-sm font-extrabold text-black">
                              Период отображения таблицы
                            </div>
                            <p className="mt-1 text-sm text-black/48">
                              По умолчанию отображается последний месяц.
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-2 block text-xs font-bold text-black/50">
                                Начало периода
                              </span>
                              <input
                                type="date"
                                value={tablePeriodStart}
                                max={tablePeriodEnd}
                                onChange={(event) => setTablePeriodStart(event.target.value)}
                                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm font-bold outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-xs font-bold text-black/50">
                                Конец периода
                              </span>
                              <input
                                type="date"
                                value={tablePeriodEnd}
                                min={tablePeriodStart}
                                max={getTodayDate()}
                                onChange={(event) => setTablePeriodEnd(event.target.value)}
                                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm font-bold outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      {isEditingFinancials && (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={addFinancialRecord}
                            className="btn-secondary"
                          >
                            + Добавить строку
                          </button>
                          <button
                            type="button"
                            onClick={cancelFinancialEditing}
                            disabled={financialSaving}
                            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={saveFinancialChanges}
                            disabled={financialSaving}
                            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {financialSaving ? "Сохранение..." : "Сохранить изменения"}
                          </button>
                        </div>
                      )}

                      {financialError && (
                        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                          {financialError}
                        </div>
                      )}
                      {financialMessage && (
                        <div className="mt-5 rounded-2xl border border-[#03bd48]/25 bg-[#03bd48]/10 px-4 py-3 text-sm font-semibold text-[#027a30]">
                          {financialMessage}
                        </div>
                      )}

                      <div className="mt-6 overflow-x-auto rounded-3xl border border-black/[0.08] shadow-[0_10px_26px_rgba(16,24,40,0.04)]">
                        <table className="min-w-[760px] w-full border-collapse text-left">
                          <thead className="bg-[#101010]">
                            <tr className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-white/58">
                              <th className="w-[70px] px-5 py-4">№</th>
                              <th className="px-5 py-4">Дата</th>
                              <th className="px-5 py-4">Доходы</th>
                              <th className="px-5 py-4">Расходы</th>
                              <th className="px-5 py-4">Чистая прибыль</th>
                              {isEditingFinancials && (
                                <th className="w-[120px] px-5 py-4">Действие</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {!isEditingFinancials &&
                              tableRecordsInPeriod.map((record, index) => {
                                const profit = record.income - record.expense;
                                return (
                                  <tr
                                    key={record.id}
                                    className="border-b border-black/[0.06] bg-white text-sm last:border-b-0 transition hover:bg-[#03bd48]/[0.035]"
                                  >
                                    <td className="px-5 py-4 font-bold text-black/42">
                                      {index + 1}
                                    </td>
                                    <td className="px-5 py-4 font-bold text-black">
                                      {formatRecordDate(record.recordDate)}
                                    </td>
                                    <td className="px-5 py-4 font-extrabold text-[#028c36]">
                                      {formatMoney(record.income)} ₽
                                    </td>
                                    <td className="px-5 py-4 font-extrabold text-red-600">
                                      {formatMoney(record.expense)} ₽
                                    </td>
                                    <td
                                      className={`px-5 py-4 text-base font-extrabold ${getProfitClass(
                                        profit
                                      )}`}
                                    >
                                      {profit > 0 ? "+" : ""}
                                      {formatMoney(profit)} ₽
                                    </td>
                                  </tr>
                                );
                              })}

                            {isEditingFinancials &&
                              financialDrafts.map((record, index) => {
                                const profit = record.income - record.expense;
                                return (
                                  <tr
                                    key={record.id}
                                    className={`border-b border-black/[0.06] text-sm last:border-b-0 ${
                                      record.isNew ? "bg-red-50/70" : "bg-white"
                                    }`}
                                  >
                                    <td className="px-5 py-3 font-bold text-black/42">
                                      {index + 1}
                                    </td>
                                    <td className="px-5 py-3">
                                      <input
                                        type="date"
                                        value={record.recordDate}
                                        onChange={(event) =>
                                          updateFinancialDraft(
                                            record.id,
                                            "recordDate",
                                            event.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-bold outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
                                      />
                                    </td>
                                    <td className="px-5 py-3">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={record.income}
                                        onChange={(event) =>
                                          updateFinancialDraft(
                                            record.id,
                                            "income",
                                            event.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-bold text-[#028c36] outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
                                      />
                                    </td>
                                    <td className="px-5 py-3">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={record.expense}
                                        onChange={(event) =>
                                          updateFinancialDraft(
                                            record.id,
                                            "expense",
                                            event.target.value
                                          )
                                        }
                                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-bold text-red-600 outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
                                      />
                                    </td>
                                    <td
                                      className={`px-5 py-3 text-base font-extrabold ${getProfitClass(
                                        profit
                                      )}`}
                                    >
                                      {profit > 0 ? "+" : ""}
                                      {formatMoney(profit)} ₽
                                    </td>
                                    <td className="px-5 py-3">
                                      <button
                                        type="button"
                                        onClick={() => removeFinancialDraft(record)}
                                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-extrabold text-red-600 transition hover:bg-red-100"
                                      >
                                        Удалить
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}

                            {!isEditingFinancials && tableRecordsInPeriod.length === 0 && (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-5 py-14 text-center text-sm text-black/48"
                                >
                                  В выбранном периоде пока нет данных. Нажмите
                                  «Редактировать», чтобы добавить первую запись.
                                </td>
                              </tr>
                            )}

                            {isEditingFinancials && financialDrafts.length === 0 && (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="px-5 py-14 text-center text-sm text-black/48"
                                >
                                  В таблице нет строк. Нажмите «Добавить строку», чтобы
                                  внести первую запись.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CollapsibleContent>
                </section>
              </div>
            )}

            {activeSection === "popular-queries" && hasAccess && (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
                  <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <div className="mb-4 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100">
                        В разработке
                      </div>
                      <h2 className="text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                        Запросы по популярности<span className="text-[#03bd48]"> Авито</span>
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">
                        Тестовый подбор связанных поисковых вариантов для работы с запросами.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-amber-300/15 px-5 py-4 text-white">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-amber-100/70">
                        Статус
                      </div>
                      <div className="mt-1 text-lg font-extrabold text-amber-200">
                        В разработке
                      </div>
                    </div>
                  </div>
                </section>

                <section className="white-card min-w-0 p-5 md:p-8">
                  <div className="badge-green mb-3">Тестовый поиск</div>
                  <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                    Подберите варианты запроса
                  </h2>

                  <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-extrabold text-white">
                        !
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-amber-950">
                          Услуга находится на этапе разработки
                        </div>
                        <p className="mt-1 text-sm leading-6 text-amber-900/75">
                          Полученные результаты выдачи «Запросы по популярности Авито»
                          могут быть недостоверными, неправильными, неполными или не
                          соответствовать действительности.
                        </p>
                        <p className="mt-2 text-sm font-bold text-amber-900">
                          Советуем дождаться окончания разработки данной услуги перед
                          принятием решений на основании результатов.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={popularQuery}
                      onChange={(e) => {
                        setPopularQuery(e.target.value);
                        setStartedPopularSearch(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setStartedPopularSearch(true);
                      }}
                      placeholder="Например: iPhone 15, диван, велосипед..."
                      className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-4 text-sm outline-none transition placeholder:text-black/35 focus:border-[#03bd48] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setStartedPopularSearch(true)}
                      disabled={!popularQuery.trim()}
                      className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Получить варианты
                    </button>
                  </div>

                  {!startedPopularSearch && (
                    <div className="mt-6 rounded-3xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#03bd48]/10 text-xl font-extrabold text-[#028c36]">
                        01
                      </div>
                      <h3 className="mt-4 text-xl font-extrabold text-black">
                        Введите поисковый запрос
                      </h3>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-black/50">
                        После запуска появятся пять тестовых вариантов с дополнительными словами.
                      </p>
                    </div>
                  )}

                  {startedPopularSearch && popularQueryResults.length > 0 && (
                    <div className="mt-6">
                      <div className="mb-4 text-sm font-semibold text-black/50">
                        Тестовые варианты по запросу{" "}
                        <span className="font-extrabold text-black">
                          «{popularQuery.trim()}»
                        </span>
                      </div>
                      <div className="space-y-3">
                        {popularQueryResults.slice(0, 5).map((query, index) => (
                          <div
                            key={`${query}-${index}`}
                            className="flex min-w-0 items-center gap-4 rounded-2xl border border-black/8 bg-white p-4 transition hover:border-[#03bd48]/30 hover:bg-[#03bd48]/[0.025]"
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-sm font-extrabold text-white">
                              {String(index + 1).padStart(2, "0")}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-base font-extrabold text-black">
                                {query}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-black/45">
                                Тестовый вариант поискового запроса
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase text-amber-700">
                              Тест
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}