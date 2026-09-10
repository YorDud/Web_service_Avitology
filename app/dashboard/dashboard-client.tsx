"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
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

type ComparedAvitoItem = {
  comparisonId: string;
  analysisId: number;
  sourceItemId: number;
  analysisCreatedAt: string;
  searchQuery: string;
  city: string | null;
  sellerName: string;
  positions: number[];
  firstPosition: number | null;
  adsCount: number;
  rating: string | null;
  reviews: string | null;
  firstAdTitle: string | null;
  firstAdPrice: string | null;
  firstAdLink: string | null;
};

type BidderApi = {
  id: number;
  title: string;
  city: string;
  query: string;
  avitoItemId: string | null;
  avitoItemUrl: string | null;
  targetFrom: number;
  targetTo: number;
  currentPosition: number | null;
  currentBid: number;
  minBid: number;
  maxBid: number;
  checkInterval: number;
  schedule: string;
  status: BidderStatus;
  mode: BidderMode;
  changesToday: number;
  nextCheckAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type BidderEvent = {
  id: number;
  type: string;
  message: string;
  createdAt: string;
};

type AvitoConnection = {
  clientIdMasked: string;
  tokenExpiresAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
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
  initialBidders: BidderApi[];
  initialAvitoConnection: AvitoConnection | null;
};

type DashboardSection =
  | "profile"
  | "avito"
  | "financial"
  | "bid-manager"
  | "popular-queries"
  | null;

type BidderStatus = "active" | "paused" | "attention";
type BidderMode = "dry_run" | "live";

type Bidder = BidderApi & {
  position: number | null;
  nextCheck: string;
  imageLabel: string;
};

function formatBidderNextCheck(value: string | null, status: BidderStatus) {
  if (status === "paused") return "на паузе";
  if (!value) return "ожидает проверки";

  const difference = new Date(value).getTime() - Date.now();
  if (difference <= 0) return "сейчас";

  const minutes = Math.ceil(difference / (60 * 1000));
  return `через ${minutes} мин`;
}

function toBidder(apiBidder: BidderApi): Bidder {
  return {
    ...apiBidder,
    position: apiBidder.currentPosition,
    nextCheck: formatBidderNextCheck(apiBidder.nextCheckAt, apiBidder.status),
    imageLabel: apiBidder.title.trim().slice(0, 2).toUpperCase() || "АВ",
  };
}

function formatConnectionDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type BidderDraft = {
  title: string;
  city: string;
  query: string;
  avitoItemId: string | null;
  avitoItemUrl: string | null;
  targetFrom: number;
  targetTo: number;
  minBid: number;
  maxBid: number;
  step: number;
  interval: number;
  schedule: string;
  mode: BidderMode;
};

type AvitoItem = {
  id: string;
  title: string;
  url: string | null;
  price: string | null;
  status: string | null;
  serviceType: string | null;
  category: string | null;
};

const initialBidderDraft: BidderDraft = {
  title: "",
  city: "",
  query: "",
  avitoItemId: null,
  avitoItemUrl: null,
  targetFrom: 3,
  targetTo: 5,
  minBid: 150,
  maxBid: 400,
  step: 10,
  interval: 10,
  schedule: "Ежедневно, 09:00–22:00",
  mode: "dry_run",
};

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
function formatAnalysisDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDateRange(start: string, end: string) {
  const result: string[] = [];
  const current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);

  while (current <= last) {
    const offset = current.getTimezoneOffset() * 60 * 1000;
    result.push(
      new Date(current.getTime() - offset).toISOString().slice(0, 10),
    );
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
      title={
        expanded ? "Вернуть обычный размер" : "Развернуть график на весь экран"
      }
      aria-label={
        expanded
          ? "Вернуть обычный размер графика"
          : "Развернуть график на весь экран"
      }
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
  const width = Math.max(
    expanded ? 1800 : 1180,
    data.length * (expanded ? 128 : 92),
  );
  const height = expanded ? 820 : 430;
  const paddingTop = expanded ? 100 : 58;
  const paddingBottom = expanded ? 116 : 78;
  const paddingX = expanded ? 112 : 64;
  const maxValue = Math.max(
    ...data.map((item) => Math.max(item.income, item.expense)),
    1,
  );
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const getX = (index: number) =>
    data.length <= 1
      ? width / 2
      : paddingX + (index / (data.length - 1)) * chartWidth;
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
      : Math.min(
          Math.max(getX(activeIndex) - tooltipWidth / 2, 8),
          width - tooltipWidth - 8,
        );
  const tooltipY =
    activeIndex === null
      ? 0
      : Math.max(getY(activeItem?.income || 0) - tooltipHeight - 22, 8);
  const scale = expanded ? 1.35 : 1;

  return (
    <div className={expanded ? "flex min-h-0 flex-1 flex-col" : "min-w-0"}>
      {!expanded && <div className="mb-4"></div>}
      <div
        className={`-mx-1 overflow-x-auto rounded-2xl border border-black/7 bg-black/[0.015] p-2 sm:mx-0 sm:p-5 ${
          expanded ? "min-h-0 flex-1" : ""
        }`}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`block h-auto w-full ${expanded ? "min-w-[2100px]" : "min-w-[1080px] sm:min-w-[1380px]"}`}
          role="img"
          aria-label="График доходов за выбранный период"
          onMouseLeave={() => setActiveIndex(null)}
          onClick={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient
              id={
                expanded ? "income-area-gradient-full" : "income-area-gradient"
              }
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
                <rect
                  width={tooltipWidth}
                  height={tooltipHeight}
                  rx={16 * scale}
                  fill="#101010"
                />
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
            const pointColor =
              item.income >= previousIncome ? "#03bd48" : "#ef4444";
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
  initialBidders,
  initialAvitoConnection,
}: DashboardPageProps) {
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("profile");
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>(
    initialFinancialRecords,
  );
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
  const [isFinancialAnalyticsOpen, setIsFinancialAnalyticsOpen] =
    useState(true);
  const [isFinancialTableOpen, setIsFinancialTableOpen] = useState(true);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);

  const [isAvitoAnalyticsOpen, setIsAvitoAnalyticsOpen] = useState(false);
  const [avitoAnalyses, setAvitoAnalyses] = useState<AvitoAnalysisSummary[]>(
    [],
  );
  const [selectedAvitoAnalysisId, setSelectedAvitoAnalysisId] = useState<
    number | null
  >(null);
  const [selectedAvitoAnalysis, setSelectedAvitoAnalysis] =
    useState<AvitoAnalysisDetails | null>(null);
  const [avitoAnalysesLoading, setAvitoAnalysesLoading] = useState(false);
  const [avitoAnalysisLoading, setAvitoAnalysisLoading] = useState(false);
  const [avitoAnalyticsError, setAvitoAnalyticsError] = useState("");
  const [avitoSearch, setAvitoSearch] = useState("");
  const [selectedAvitoRowIds, setSelectedAvitoRowIds] = useState<Set<number>>(
    new Set(),
  );
  const [avitoOnlySelected, setAvitoOnlySelected] = useState(false);
  const avitoAnalysesScrollRef = useRef<HTMLDivElement | null>(null);

  const [comparedAvitoItems, setComparedAvitoItems] = useState<
    ComparedAvitoItem[]
  >([]);
  const [comparisonMessage, setComparisonMessage] = useState("");

  // Первый визуальный прототип бид-менеджера. На этом этапе данные живут
  // только в состоянии страницы и не отправляются в Авито или в базу.
  const [bidders, setBidders] = useState<Bidder[]>(() =>
    initialBidders.map(toBidder),
  );
  const [bidderSaving, setBidderSaving] = useState(false);
  const [checkingBidderId, setCheckingBidderId] = useState<number | null>(null);
  const [isBidderWizardOpen, setIsBidderWizardOpen] = useState(false);
  const [bidderWizardStep, setBidderWizardStep] = useState(1);
  const [bidderDraft, setBidderDraft] =
    useState<BidderDraft>(initialBidderDraft);
  const [bidderMessage, setBidderMessage] = useState("");
  const [editingBidderId, setEditingBidderId] = useState<number | null>(null);
  const [avitoConnection, setAvitoConnection] =
    useState<AvitoConnection | null>(initialAvitoConnection);
  const [isAvitoConnectionOpen, setIsAvitoConnectionOpen] = useState(false);
  const [avitoConnectionSaving, setAvitoConnectionSaving] = useState(false);
  const [avitoConnectionError, setAvitoConnectionError] = useState("");
  const [avitoClientId, setAvitoClientId] = useState("");
  const [avitoClientSecret, setAvitoClientSecret] = useState("");
  const [avitoItems, setAvitoItems] = useState<AvitoItem[]>([]);
  const [avitoItemsLoading, setAvitoItemsLoading] = useState(false);
  const [avitoItemsError, setAvitoItemsError] = useState("");

  const [expandedBidderId, setExpandedBidderId] = useState<number | null>(null);
const [bidderEvents, setBidderEvents] = useState<Record<number, BidderEvent[]>>(
  {},
);
const [bidderEventsLoadingId, setBidderEventsLoadingId] = useState<number | null>(
  null,
);

  const subscriptionLevel = user.subscriptionLevel.toLowerCase();
  const hasAccess =
    subscriptionLevel === "basic" || subscriptionLevel === "admin";
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
      description: hasAccess
        ? "Аналитика поисковых позиций"
        : "Доступно с подпиской Basic",
      available: hasAccess,
    },
    {
      id: "financial",
      index: "03",
      title: "Финансовый анализ",
      description: hasAccess
        ? "Доходы, расходы и прибыль"
        : "Доступно с подпиской Basic",
      available: hasAccess,
    },
    {
      id: "bid-manager",
      index: "04",
      title: "Бид-менеджер Авито",
      description: hasAccess
        ? "Автоматическое управление ставками"
        : "Доступно с подпиской Basic",
      available: hasAccess,
    },
    {
      id: "popular-queries",
      index: "05",
      title: "Запросы по популярности Авито",
      description: hasAccess
        ? "Подбор популярных запросов"
        : "Доступно с подпиской Basic",
      available: hasAccess,
      inDevelopment: true,
    },
  ];

  const tableRecordsInPeriod = useMemo(() => {
    return financialRecords
      .filter(
        (record) =>
          record.recordDate >= tablePeriodStart &&
          record.recordDate <= tablePeriodEnd,
      )
      .sort((a, b) => b.recordDate.localeCompare(a.recordDate));
  }, [financialRecords, tablePeriodStart, tablePeriodEnd]);

  const analytics = useMemo(() => {
    const recordByDate = new Map(
      financialRecords.map((record) => [record.recordDate, record]),
    );
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
      ? [
          query,
          `${query} купить`,
          `${query} цена`,
          `${query} недорого`,
          `${query} с доставкой`,
        ]
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
            .includes(q),
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
    value: string,
  ) {
    setFinancialDrafts((current) =>
      current.map((record) => {
        if (record.id !== id) return record;
        return field === "recordDate"
          ? { ...record, recordDate: value }
          : { ...record, [field]: Math.max(0, Number(value) || 0) };
      }),
    );
  }

  function removeFinancialDraft(record: FinancialDraft) {
    if (!record.isNew)
      setDeletedRecordIds((current) => [...current, record.id]);
    setFinancialDrafts((current) =>
      current.filter((item) => item.id !== record.id),
    );
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
      setFinancialError(
        "В таблице не может быть нескольких строк с одинаковой датой.",
      );
      setFinancialSaving(false);
      return;
    }

    try {
      const responses = await Promise.all([
        ...deletedRecordIds.map((id) =>
          fetch(`/api/financial-records/${id}`, { method: "DELETE" }),
        ),
        ...financialDrafts.map((record) =>
          fetch(
            record.isNew
              ? "/api/financial-records"
              : `/api/financial-records/${record.id}`,
            {
              method: record.isNew ? "POST" : "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recordDate: record.recordDate,
                income: Math.max(0, Math.round(record.income)),
                expense: Math.max(0, Math.round(record.expense)),
              }),
            },
          ),
        ),
      ]);

      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const data = await failed.json().catch(() => null);
        setFinancialError(
          data?.error || "Не удалось сохранить изменения в таблице.",
        );
        return;
      }

      const response = await fetch("/api/financial-records");
      const data = await response.json();

      if (!response.ok) {
        setFinancialError(
          data?.error || "Не удалось обновить данные финансового анализа.",
        );
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
    if (id === selectedAvitoAnalysisId || avitoAnalysisLoading) return;

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
        error instanceof Error ? error.message : "Не удалось загрузить анализ",
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
        error instanceof Error ? error.message : "Не удалось загрузить анализы",
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

  function addSelectedAvitoItemsToComparison() {
    if (!selectedAvitoAnalysis || selectedAvitoRowIds.size === 0) {
      return;
    }

    const selectedItems = selectedAvitoAnalysis.items.filter((item) =>
      selectedAvitoRowIds.has(item.id),
    );

    let addedCount = 0;
    let alreadyAddedCount = 0;

    setComparedAvitoItems((current) => {
      const existingIds = new Set(current.map((item) => item.comparisonId));

      const itemsToAdd = selectedItems
        .filter((item) => {
          const comparisonId = `${selectedAvitoAnalysis.id}-${item.id}`;

          if (existingIds.has(comparisonId)) {
            alreadyAddedCount += 1;
            return false;
          }

          addedCount += 1;
          return true;
        })
        .map((item) => {
          const firstAd = item.ads[0];

          return {
            comparisonId: `${selectedAvitoAnalysis.id}-${item.id}`,
            analysisId: selectedAvitoAnalysis.id,
            sourceItemId: item.id,
            analysisCreatedAt: selectedAvitoAnalysis.createdAt,
            searchQuery:
              selectedAvitoAnalysis.searchQuery || "Поисковый запрос",
            city: selectedAvitoAnalysis.city,
            sellerName: item.sellerName,
            positions: item.positions,
            firstPosition: item.firstPosition,
            adsCount: item.adsCount,
            rating: item.rating,
            reviews: item.reviews,
            firstAdTitle: firstAd?.title || null,
            firstAdPrice: firstAd?.price || null,
            firstAdLink: firstAd?.link || null,
          };
        });

      return [...current, ...itemsToAdd];
    });

    if (addedCount > 0 && alreadyAddedCount > 0) {
      setComparisonMessage(
        `Добавлено в сравнение: ${addedCount}. Уже были добавлены: ${alreadyAddedCount}.`,
      );
    } else if (addedCount > 0) {
      setComparisonMessage(
        `${addedCount === 1 ? "Продавец добавлен" : `Добавлено продавцов: ${addedCount}`} в сравнение.`,
      );
    } else {
      setComparisonMessage("Все выбранные продавцы уже находятся в сравнении.");
    }

    window.setTimeout(() => {
      setComparisonMessage("");
    }, 3500);
  }

  function removeComparedAvitoItem(comparisonId: string) {
    setComparedAvitoItems((current) =>
      current.filter((item) => item.comparisonId !== comparisonId),
    );
  }

  function clearAvitoComparison() {
    setComparedAvitoItems([]);
    setComparisonMessage("");
  }

  function showBidderMessage(text: string) {
    setBidderMessage(text);
    window.setTimeout(() => setBidderMessage(""), 3200);
  }

  async function toggleBidderStatus(id: number) {
    const bidder = bidders.find((item) => item.id === id);
    if (!bidder || bidderSaving) return;

    const nextStatus: "active" | "paused" =
      bidder.status === "active" ? "paused" : "active";
    setBidderSaving(true);
    try {
      const response = await fetch(`/api/avito-bidders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showBidderMessage(data?.error || "Не удалось изменить статус бидера.");
        return;
      }
      setBidders((current) =>
        current.map((item) => (item.id === id ? toBidder(data.bidder) : item)),
      );
      await loadBidderEvents(id);
      showBidderMessage(
        nextStatus === "active"
          ? `Бидер «${bidder.title}» запущен.`
          : `Бидер «${bidder.title}» поставлен на паузу.`,
      );
    } catch (error) {
      console.error(error);
      showBidderMessage("Ошибка сети. Не удалось изменить статус бидера.");
    } finally {
      setBidderSaving(false);
    }
  }

  async function deleteBidder(id: number) {
    const bidder = bidders.find((item) => item.id === id);
    if (
      !bidder ||
      bidderSaving ||
      !window.confirm(`Удалить бидер «${bidder.title}»?`)
    )
      return;

    setBidderSaving(true);
    try {
      const response = await fetch(`/api/avito-bidders/${id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showBidderMessage(data?.error || "Не удалось удалить бидер.");
        return;
      }
      setBidders((current) => current.filter((item) => item.id !== id));
      showBidderMessage("Бидер удалён.");
    } catch (error) {
      console.error(error);
      showBidderMessage("Ошибка сети. Не удалось удалить бидер.");
    } finally {
      setBidderSaving(false);
    }
  }

  async function loadBidderEvents(bidderId: number) {
  setBidderEventsLoadingId(bidderId);

  try {
    const response = await fetch(`/api/avito-bidders/${bidderId}/events`, {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      showBidderMessage(
        data?.error || "Не удалось загрузить историю событий бидера.",
      );
      return;
    }

    setBidderEvents((current) => ({
      ...current,
      [bidderId]: Array.isArray(data?.events) ? data.events : [],
    }));
  } catch (error) {
    console.error(error);
    showBidderMessage("Ошибка сети. Не удалось загрузить историю событий.");
  } finally {
    setBidderEventsLoadingId(null);
  }
}

async function toggleBidderEvents(bidderId: number) {
  if (expandedBidderId === bidderId) {
    setExpandedBidderId(null);
    return;
  }

  setExpandedBidderId(bidderId);

  if (!bidderEvents[bidderId]) {
    await loadBidderEvents(bidderId);
  }
}

  async function checkBidderItem(id: number) {
  const bidder = bidders.find((item) => item.id === id);

  if (!bidder || !bidder.avitoItemId || checkingBidderId !== null) {
    return;
  }

  setCheckingBidderId(id);

  try {
    const itemResponse = await fetch(`/api/avito-items/${bidder.avitoItemId}`, {
      method: "GET",
      cache: "no-store",
    });

    const itemData = await itemResponse.json().catch(() => null);
    const checkedAt = new Date().toISOString();

    if (!itemResponse.ok) {
      const errorMessage =
        itemData?.error || "Не удалось проверить объявление Авито.";

      const patchResponse = await fetch(`/api/avito-bidders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastError: errorMessage,
          lastCheckedAt: checkedAt,
        }),
      });

      const patchData = await patchResponse.json().catch(() => null);

      if (patchResponse.ok && patchData?.bidder) {
        setBidders((current) =>
          current.map((item) =>
            item.id === id ? toBidder(patchData.bidder) : item,
          ),
        );
        await loadBidderEvents(id);
      }

      showBidderMessage(errorMessage);
      return;
    }

    const item = itemData?.item;

    const patchResponse = await fetch(`/api/avito-bidders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:
          typeof item?.title === "string" && item.title.trim().length > 0
            ? item.title.trim()
            : bidder.title,
        avitoItemUrl:
          typeof item?.url === "string" && item.url.trim().length > 0
            ? item.url.trim()
            : bidder.avitoItemUrl,
        lastError: null,
        lastCheckedAt: checkedAt,
      }),
    });

    const patchData = await patchResponse.json().catch(() => null);

    if (!patchResponse.ok || !patchData?.bidder) {
      showBidderMessage(
        patchData?.error || "Не удалось сохранить результат проверки объявления.",
      );
      return;
    }

    setBidders((current) =>
      current.map((item) =>
        item.id === id ? toBidder(patchData.bidder) : item,
      ),
    );

    await loadBidderEvents(id);

    showBidderMessage(`Объявление «${patchData.bidder.title}» проверено.`);
  } catch (error) {
    console.error(error);
    showBidderMessage("Ошибка сети. Не удалось проверить объявление.");
  } finally {
    setCheckingBidderId(null);
  }
}

  function openBidderWizard() {
    setEditingBidderId(null);
    setBidderDraft(initialBidderDraft);
    setBidderWizardStep(1);
    setIsBidderWizardOpen(true);
    void loadAvitoItems();
  }

  function openBidderEditor(bidder: Bidder) {
    setEditingBidderId(bidder.id);
    setBidderDraft({
      title: bidder.title,
      city: bidder.city,
      query: bidder.query,
      avitoItemId: bidder.avitoItemId,
      avitoItemUrl: bidder.avitoItemUrl,
      targetFrom: bidder.targetFrom,
      targetTo: bidder.targetTo,
      minBid: bidder.minBid,
      maxBid: bidder.maxBid,
      step: 10,
      interval: bidder.checkInterval,
      schedule: bidder.schedule,
      mode: bidder.mode,
    });
    setBidderWizardStep(1);
    setIsBidderWizardOpen(true);
    void loadAvitoItems();
  }

  function openAvitoConnection() {
    setAvitoConnectionError("");
    setAvitoClientId("");
    setAvitoClientSecret("");
    setIsAvitoConnectionOpen(true);
  }

  async function saveAvitoConnection() {
    if (avitoConnectionSaving) return;

    setAvitoConnectionSaving(true);
    setAvitoConnectionError("");
    try {
      const response = await fetch("/api/avito-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: avitoClientId,
          clientSecret: avitoClientSecret,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setAvitoConnectionError(
          data?.error || "Не удалось подключить аккаунт Авито.",
        );
        return;
      }

      setAvitoConnection(data.connection);
      setIsAvitoConnectionOpen(false);
      await loadAvitoItems();
      showBidderMessage("Аккаунт Авито подключён и проверен.");
    } catch (error) {
      console.error(error);
      setAvitoConnectionError("Ошибка сети. Повторите попытку.");
    } finally {
      setAvitoConnectionSaving(false);
    }
  }

  async function disconnectAvitoConnection() {
    if (
      avitoConnectionSaving ||
      !window.confirm("Отключить аккаунт Авито от Бид-менеджера?")
    ) {
      return;
    }

    setAvitoConnectionSaving(true);
    try {
      const response = await fetch("/api/avito-connection", {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showBidderMessage(data?.error || "Не удалось отключить аккаунт Авито.");
        return;
      }

      setAvitoConnection(null);
      setAvitoItems([]);
      setAvitoItemsError("");
      showBidderMessage("Аккаунт Авито отключён.");
    } catch (error) {
      console.error(error);
      showBidderMessage("Ошибка сети. Не удалось отключить аккаунт Авито.");
    } finally {
      setAvitoConnectionSaving(false);
    }
  }

  async function loadAvitoItems() {
    if (!avitoConnection) {
      setAvitoItems([]);
      setAvitoItemsError("Сначала подключите аккаунт Авито.");
      return;
    }

    setAvitoItemsLoading(true);
    setAvitoItemsError("");
    try {
      const response = await fetch("/api/avito-items", {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setAvitoItems([]);
        setAvitoItemsError(
          data?.error || "Не удалось получить список объявлений Авито.",
        );
        return;
      }

      setAvitoItems(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error(error);
      setAvitoItems([]);
      setAvitoItemsError("Ошибка сети. Не удалось получить объявления Авито.");
    } finally {
      setAvitoItemsLoading(false);
    }
  }

  async function saveBidder() {
    if (bidderSaving) return;

    const payload = {
      title: bidderDraft.title,
      city: bidderDraft.city,
      query: bidderDraft.query,
      avitoItemId: bidderDraft.avitoItemId,
      avitoItemUrl: bidderDraft.avitoItemUrl,
      targetFrom: bidderDraft.targetFrom,
      targetTo: bidderDraft.targetTo,
      minBid: bidderDraft.minBid,
      maxBid: bidderDraft.maxBid,
      checkInterval: bidderDraft.interval,
      schedule: bidderDraft.schedule,
      mode: bidderDraft.mode,
    };

    setBidderSaving(true);
    try {
      const isEditing = editingBidderId !== null;
      const response = await fetch(
        isEditing
          ? `/api/avito-bidders/${editingBidderId}`
          : "/api/avito-bidders",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showBidderMessage(
          data?.error ||
            (isEditing
              ? "Не удалось сохранить изменения бидера."
              : "Не удалось создать бидер."),
        );
        return;
      }

      const savedBidder = toBidder(data.bidder);
      setBidders((current) =>
        isEditing
          ? current.map((item) =>
              item.id === savedBidder.id ? savedBidder : item,
            )
          : [savedBidder, ...current],
      );
      await loadBidderEvents(savedBidder.id);
setExpandedBidderId(savedBidder.id);
      setIsBidderWizardOpen(false);
      setEditingBidderId(null);
      showBidderMessage(
        isEditing
          ? "Настройки бидера сохранены."
          : "Бидер сохранён и запущен. Настройки не пропадут после обновления страницы.",
      );
    } catch (error) {
      console.error(error);
      showBidderMessage("Ошибка сети. Не удалось сохранить бидер.");
    } finally {
      setBidderSaving(false);
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
                        isActive
                          ? "bg-black/20 text-white"
                          : "bg-white/10 text-white/65"
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
                    <span className="text-lg font-light">
                      {isActive ? "−" : "+"}
                    </span>
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
                    Выберите раздел слева, чтобы посмотреть данные профиля или
                    перейти к доступным инструментам HelpSell.
                  </p>
                </div>
              </div>
            )}

            {activeSection === "profile" && (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-[30px] bg-black p-4 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] sm:p-6 md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                        Мой аккаунт
                      </div>
                      <h2 className="truncate text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                        {user.name}
                      </h2>
                      <p className="mt-3 break-all text-sm text-white/60">
                        {user.email}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#03bd48] px-5 py-4 text-white">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/70">
                        Public ID
                      </div>
                      <div className="mt-1 text-2xl font-extrabold">
                        {user.publicId}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="white-card min-w-0 p-6 md:p-8">
                  <div className="mb-7">
                    <div className="badge-green mb-3">
                      Информация о подписке
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                      Ваши данные
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-black/50">
                      Здесь отображается актуальная информация по вашему
                      аккаунту и доступу к сервису.
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
                          user.subscriptionLevel,
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
                        {hasAccess
                          ? "Доступ к сервисам активен"
                          : "Требуется подписка Basic"}
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
                          Подписка Basic откроет доступ к аналитике мест в
                          поиске Авито, финансовому анализу и рабочим
                          инструментам платформы.
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
                <section className="overflow-hidden rounded-[30px] bg-black p-4 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] sm:p-6 md:p-8">
                  <div className="grid gap-5 sm:gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div>
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                        Инструменты HelpSell
                      </div>
                      <h2 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-3xl md:text-4xl">
                        Места в поиске
                        <span className="text-[#03bd48]"> Авито</span>
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">
                        Сохраняйте результаты анализа из расширения и
                        сравнивайте позиции продавцов по датам в личном
                        кабинете.
                      </p>
                    </div>
                    <div className="w-full rounded-2xl bg-[#03bd48] px-4 py-4 text-white shadow-[0_12px_25px_rgba(3,189,72,0.22)] sm:w-auto sm:min-w-[220px] sm:px-5">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/70">
                        Статус услуги
                      </div>

                      <div className="mt-1 text-lg font-extrabold">
                        Доступ активен
                      </div>

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
                        Проверяйте сохранённые результаты парсинга: продавцов,
                        позиции, объявления, рейтинг и отзывы.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={toggleAvitoAnalytics}
                      className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-5 py-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#03bd48] sm:w-auto sm:shrink-0"
                    >
                      <span>
                        {isAvitoAnalyticsOpen
                          ? "Закрыть аналитику"
                          : "Открыть аналитику"}
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
                            Выберите сохранение по дате и запросу, чтобы открыть
                            подробную таблицу.
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
                            Откройте поиск Авито, запустите расширение и во
                            вкладке «По продавцам» нажмите «Сохранить анализ в
                            личный кабинет».
                          </p>
                        </div>
                      )}

                      {avitoAnalyses.length > 0 && (
                        <div className="space-y-5">
                          <div className="rounded-3xl border border-black/[0.07] bg-[linear-gradient(135deg,rgba(3,189,72,0.07),rgba(255,255,255,0.98))] p-3 shadow-[0_10px_28px_rgba(16,24,40,0.04)] sm:p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/40">
                                  Сохранённые анализы
                                </div>
                                <div className="mt-1 text-sm font-extrabold text-black">
                                  Выберите дату и поисковый запрос
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    avitoAnalysesScrollRef.current?.scrollBy({
                                      left: -340,
                                      behavior: "smooth",
                                    });
                                  }}
                                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-black transition hover:border-[#03bd48]/45 hover:bg-[#03bd48]/[0.06] hover:text-[#028c36]"
                                  aria-label="Показать предыдущие анализы"
                                  title="Предыдущие анализы"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  >
                                    <path d="m15 18-6-6 6-6" />
                                  </svg>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    avitoAnalysesScrollRef.current?.scrollBy({
                                      left: 340,
                                      behavior: "smooth",
                                    });
                                  }}
                                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-black transition hover:border-[#03bd48]/45 hover:bg-[#03bd48]/[0.06] hover:text-[#028c36]"
                                  aria-label="Показать следующие анализы"
                                  title="Следующие анализы"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  >
                                    <path d="m9 18 6-6-6-6" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            <div
                              ref={avitoAnalysesScrollRef}
                              className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 pr-2 [scrollbar-width:thin] sm:gap-3"
                            >
                              {avitoAnalyses.map((analysis) => {
                                const isActive =
                                  selectedAvitoAnalysisId === analysis.id;

                                return (
                                  <button
                                    key={analysis.id}
                                    type="button"
                                    onClick={() =>
                                      loadAvitoAnalysis(analysis.id)
                                    }
                                    className={`w-[178px] shrink-0 snap-start rounded-2xl border p-3 text-left transition-all duration-200 sm:w-[215px] sm:p-3.5 ${
                                      isActive
                                        ? "border-[#03bd48] bg-[#03bd48]/10 shadow-[0_8px_20px_rgba(3,189,72,0.12)]"
                                        : "border-black/[0.08] bg-white hover:-translate-y-0.5 hover:border-[#03bd48]/45 hover:bg-[#03bd48]/[0.035]"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="text-[10px] font-extrabold leading-4 text-black/65 sm:text-[11px]">
                                        {new Intl.DateTimeFormat("ru-RU", {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }).format(new Date(analysis.createdAt))}
                                      </div>

                                      <span
                                        className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${
                                          isActive
                                            ? "bg-[#03bd48] text-white"
                                            : "bg-black/[0.06] text-black/55"
                                        }`}
                                      >
                                        {analysis.itemsCount}
                                      </span>
                                    </div>

                                    <div
                                      className={`mt-2 truncate text-sm font-extrabold ${
                                        isActive
                                          ? "text-[#028c36]"
                                          : "text-black"
                                      }`}
                                      title={
                                        analysis.searchQuery ||
                                        "Запрос не указан"
                                      }
                                    >
                                      {analysis.searchQuery ||
                                        "Запрос не указан"}
                                    </div>

                                    <div className="mt-1 text-xs font-semibold text-black/42">
                                      Продавцов: {analysis.itemsCount}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="relative min-w-0 rounded-3xl border border-black/[0.07] bg-white p-4 shadow-[0_14px_35px_rgba(16,24,40,0.06)] md:p-5">
                            {avitoAnalysisLoading && selectedAvitoAnalysis && (
                              <div className="absolute inset-x-4 top-4 z-20 flex items-center justify-center gap-2 rounded-xl border border-[#03bd48]/25 bg-white/95 px-4 py-2.5 text-xs font-extrabold text-[#028c36] shadow-[0_8px_22px_rgba(16,24,40,0.1)] backdrop-blur md:inset-x-5 md:top-5">
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#03bd48]/25 border-t-[#03bd48]" />
                                Обновляем выбранный анализ…
                              </div>
                            )}

                            {!selectedAvitoAnalysis && avitoAnalysisLoading && (
                              <div className="py-16 text-center text-sm font-semibold text-black/50">
                                Загружаем выбранный анализ...
                              </div>
                            )}

                            {selectedAvitoAnalysis && (
                              <>
                                <div className="flex flex-col gap-3 border-b border-black/[0.07] pb-5 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/40">
                                      Выбранный анализ
                                    </div>

                                    <h4 className="mt-2 break-words text-xl font-extrabold leading-tight tracking-[-0.04em] text-black sm:text-2xl">
                                      {selectedAvitoAnalysis.searchQuery ||
                                        "Поисковый запрос"}
                                    </h4>

                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-black/48">
                                      <span>
                                        {new Intl.DateTimeFormat("ru-RU", {
                                          dateStyle: "long",
                                          timeStyle: "short",
                                        }).format(
                                          new Date(
                                            selectedAvitoAnalysis.createdAt,
                                          ),
                                        )}
                                      </span>

                                      <span className="h-1 w-1 rounded-full bg-black/25" />

                                      <span className="font-bold text-[#028c36]">
                                        {selectedAvitoAnalysis.itemsCount}{" "}
                                        продавцов
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteAvitoAnalysis(
                                        selectedAvitoAnalysis.id,
                                      )
                                    }
                                    className="h-fit w-full shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-extrabold text-red-600 transition hover:bg-red-100 sm:w-auto"
                                  >
                                    Удалить
                                  </button>
                                </div>

                                <div className="mt-5 rounded-2xl border border-black/[0.07] bg-black/[0.018] p-3 sm:p-4">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <label className="relative block min-w-0 flex-1">
                                      <span className="sr-only">
                                        Поиск по продавцу, позиции, объявлению
                                        или цене
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
                                        onChange={(event) =>
                                          setAvitoSearch(event.target.value)
                                        }
                                        placeholder="Поиск по продавцу, позиции, объявлению или цене..."
                                        className="w-full rounded-xl border border-black/10 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-black outline-none transition placeholder:text-black/35 focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
                                      />
                                    </label>

                                    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                                      <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3 text-xs font-extrabold text-black/70 transition hover:border-[#03bd48]/40 sm:w-auto">
                                        <input
                                          type="checkbox"
                                          checked={avitoOnlySelected}
                                          onChange={(event) =>
                                            setAvitoOnlySelected(
                                              event.target.checked,
                                            )
                                          }
                                          className="h-4 w-4 rounded border-black/25 accent-[#03bd48]"
                                        />
                                        Только выделенные
                                      </label>

                                      {selectedAvitoRowIds.size > 0 && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={
                                              addSelectedAvitoItemsToComparison
                                            }
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#03bd48] px-3 py-3 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(3,189,72,0.22)] transition hover:-translate-y-0.5 hover:bg-[#02963a] sm:w-auto"
                                          >
                                            <svg
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2.4"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              className="h-4 w-4"
                                              aria-hidden="true"
                                            >
                                              <path d="M12 5v14" />
                                              <path d="M5 12h14" />
                                            </svg>
                                            В сравнение:{" "}
                                            {selectedAvitoRowIds.size}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedAvitoRowIds(new Set());
                                              setAvitoOnlySelected(false);
                                            }}
                                            className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-xs font-extrabold text-black/60 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:w-auto"
                                          >
                                            Снять: {selectedAvitoRowIds.size}
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-black/[0.06] px-3 py-1.5 text-xs font-bold text-black/55">
                                      В таблице: {filteredAvitoItems.length}
                                    </span>

                                    <span className="rounded-full bg-[#03bd48]/10 px-3 py-1.5 text-xs font-extrabold text-[#028c36]">
                                      Выбрано: {selectedAvitoRowIds.size}
                                    </span>
                                  </div>
                                  {comparisonMessage && (
                                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#03bd48]/25 bg-[#03bd48]/10 px-3 py-3 text-xs font-bold leading-5 text-[#027a30]">
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                      >
                                        <path d="m5 12 4 4L19 6" />
                                      </svg>
                                      {comparisonMessage}
                                    </div>
                                  )}
                                </div>

                                <div className="mt-5 max-h-[620px] space-y-3 overflow-y-auto overscroll-contain pr-1 md:hidden">
                                  {filteredAvitoItems.map((item) => {
                                    const ad = item.ads[0];
                                    const isSelected = selectedAvitoRowIds.has(
                                      item.id,
                                    );
                                    const positions = item.positions.length
                                      ? item.positions.join(", ")
                                      : (item.firstPosition ?? "—");
                                    return (
                                      <article
                                        key={item.id}
                                        onClick={() =>
                                          setSelectedAvitoRowIds((current) => {
                                            const next = new Set(current);
                                            if (next.has(item.id))
                                              next.delete(item.id);
                                            else next.add(item.id);
                                            return next;
                                          })
                                        }
                                        className={`cursor-pointer rounded-2xl border p-4 transition ${isSelected ? "border-[#03bd48]/50 bg-[#03bd48]/10 shadow-[inset_4px_0_0_#03bd48]" : "border-black/[0.08] bg-white"}`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            aria-label={`Выбрать продавца ${item.sellerName}`}
                                            onClick={(event) =>
                                              event.stopPropagation()
                                            }
                                            onChange={() =>
                                              setSelectedAvitoRowIds(
                                                (current) => {
                                                  const next = new Set(current);
                                                  if (next.has(item.id))
                                                    next.delete(item.id);
                                                  else next.add(item.id);
                                                  return next;
                                                },
                                              )
                                            }
                                            className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-black/25 accent-[#03bd48]"
                                          />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                              <div className="break-words text-base font-extrabold leading-5 text-black">
                                                {item.sellerName}
                                              </div>
                                              <span
                                                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold ${isSelected ? "bg-[#03bd48] text-white" : "bg-[#03bd48]/10 text-[#028c36]"}`}
                                              >
                                                Поз.: {positions}
                                              </span>
                                            </div>
                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                              <div className="rounded-xl bg-black/[0.035] p-2">
                                                <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                                  Объявл.
                                                </div>
                                                <div className="mt-1 text-sm font-extrabold text-black">
                                                  {item.adsCount}
                                                </div>
                                              </div>
                                              <div className="rounded-xl bg-black/[0.035] p-2">
                                                <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                                  Рейтинг
                                                </div>
                                                <div className="mt-1 text-sm font-extrabold text-black">
                                                  {item.rating || "—"}
                                                </div>
                                              </div>
                                              <div className="rounded-xl bg-black/[0.035] p-2">
                                                <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                                  Отзывы
                                                </div>
                                                <div className="mt-1 text-sm font-extrabold text-black">
                                                  {item.reviews || "—"}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="mt-3 border-t border-black/[0.07] pt-3">
                                              <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                                Первое объявление
                                              </div>
                                              {ad?.link ? (
                                                <a
                                                  href={ad.link}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  onClick={(event) =>
                                                    event.stopPropagation()
                                                  }
                                                  className="mt-1 block break-words text-sm font-extrabold leading-5 text-[#028c36] hover:underline"
                                                >
                                                  {ad.title ||
                                                    "Открыть объявление"}
                                                </a>
                                              ) : (
                                                <div className="mt-1 break-words text-sm font-bold leading-5 text-black/65">
                                                  {ad?.title || "—"}
                                                </div>
                                              )}
                                              {ad?.price && (
                                                <div className="mt-1 text-xs font-bold text-black/45">
                                                  {ad.price}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </article>
                                    );
                                  })}
                                  {filteredAvitoItems.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-black/15 px-5 py-12 text-center text-sm text-black/48">
                                      {avitoOnlySelected
                                        ? "Нет выбранных строк"
                                        : "По вашему поиску ничего не найдено"}
                                    </div>
                                  )}
                                </div>
                                <div className="mt-5 hidden overflow-hidden rounded-2xl border border-black/[0.08] bg-white md:block">
                                  <div className="max-h-[620px] overflow-y-auto">
                                    <table className="w-full table-fixed border-collapse text-left">
                                      <thead className="sticky top-0 z-10 bg-[#101010] shadow-[0_2px_0_rgba(255,255,255,0.08)]">
                                        <tr className="whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.06em] text-white/65">
                                          <th className="w-[52px] px-3 py-4 text-center">
                                            <input
                                              type="checkbox"
                                              aria-label="Выбрать все строки"
                                              checked={
                                                filteredAvitoItems.length > 0 &&
                                                filteredAvitoItems.every(
                                                  (item) =>
                                                    selectedAvitoRowIds.has(
                                                      item.id,
                                                    ),
                                                )
                                              }
                                              onChange={(event) => {
                                                const checked =
                                                  event.target.checked;

                                                setSelectedAvitoRowIds(
                                                  (current) => {
                                                    const next = new Set(
                                                      current,
                                                    );

                                                    filteredAvitoItems.forEach(
                                                      (item) => {
                                                        if (checked) {
                                                          next.add(item.id);
                                                        } else {
                                                          next.delete(item.id);
                                                        }
                                                      },
                                                    );

                                                    return next;
                                                  },
                                                );
                                              }}
                                              className="h-4 w-4 cursor-pointer rounded border-white/30 accent-[#03bd48]"
                                            />
                                          </th>

                                          <th className="w-[13%] px-3 py-4">
                                            Позиции
                                          </th>
                                          <th className="w-[20%] px-3 py-4">
                                            Продавец
                                          </th>
                                          <th className="w-[11%] px-3 py-4 text-center">
                                            Объяв.
                                          </th>
                                          <th className="w-[10%] px-3 py-4 text-center">
                                            Рейтинг
                                          </th>
                                          <th className="w-[10%] px-3 py-4 text-center">
                                            Отзывы
                                          </th>
                                          <th className="px-3 py-4">
                                            Первое объявление
                                          </th>
                                        </tr>
                                      </thead>

                                      <tbody>
                                        {filteredAvitoItems.map((item) => {
                                          const ad = item.ads[0];
                                          const isSelected =
                                            selectedAvitoRowIds.has(item.id);

                                          const positions = item.positions
                                            .length
                                            ? item.positions.join(", ")
                                            : (item.firstPosition ?? "—");

                                          return (
                                            <tr
                                              key={item.id}
                                              onClick={() => {
                                                setSelectedAvitoRowIds(
                                                  (current) => {
                                                    const next = new Set(
                                                      current,
                                                    );

                                                    if (next.has(item.id)) {
                                                      next.delete(item.id);
                                                    } else {
                                                      next.add(item.id);
                                                    }

                                                    return next;
                                                  },
                                                );
                                              }}
                                              className={`cursor-pointer border-b border-black/[0.06] text-sm transition last:border-b-0 ${
                                                isSelected
                                                  ? "bg-[#03bd48]/[0.12] shadow-[inset_4px_0_0_#03bd48]"
                                                  : "bg-white hover:bg-[#03bd48]/[0.035]"
                                              }`}
                                            >
                                              <td className="px-3 py-3.5 text-center">
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  aria-label={`Выбрать продавца ${item.sellerName}`}
                                                  onClick={(event) =>
                                                    event.stopPropagation()
                                                  }
                                                  onChange={() => {
                                                    setSelectedAvitoRowIds(
                                                      (current) => {
                                                        const next = new Set(
                                                          current,
                                                        );

                                                        if (next.has(item.id)) {
                                                          next.delete(item.id);
                                                        } else {
                                                          next.add(item.id);
                                                        }

                                                        return next;
                                                      },
                                                    );
                                                  }}
                                                  className="h-4 w-4 cursor-pointer rounded border-black/25 accent-[#03bd48]"
                                                />
                                              </td>

                                              <td className="px-3 py-3.5 align-top">
                                                <span
                                                  className={`inline-flex max-w-full rounded-lg px-2 py-1 text-xs font-extrabold ${
                                                    isSelected
                                                      ? "bg-[#03bd48] text-white"
                                                      : "bg-[#03bd48]/10 text-[#028c36]"
                                                  }`}
                                                >
                                                  <span className="break-words leading-5">
                                                    {positions}
                                                  </span>
                                                </span>
                                              </td>

                                              <td className="px-3 py-3.5 align-top">
                                                <div
                                                  className="break-words font-extrabold leading-5 text-black"
                                                  title={item.sellerName}
                                                >
                                                  {item.sellerName}
                                                </div>

                                                {isSelected && (
                                                  <div className="mt-1 text-[10px] font-extrabold text-[#028c36]">
                                                    Выбрано
                                                  </div>
                                                )}
                                              </td>

                                              <td className="px-3 py-3.5 text-center align-top">
                                                <span className="inline-flex min-w-8 justify-center rounded-lg bg-black/[0.05] px-2 py-1 text-xs font-extrabold text-black/70">
                                                  {item.adsCount}
                                                </span>
                                              </td>

                                              <td className="px-3 py-3.5 text-center align-top font-extrabold text-black">
                                                {item.rating || "—"}
                                              </td>

                                              <td className="px-3 py-3.5 text-center align-top font-extrabold text-black">
                                                {item.reviews || "—"}
                                              </td>

                                              <td className="px-3 py-3.5 align-top">
                                                {ad?.link ? (
                                                  <a
                                                    href={ad.link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(event) =>
                                                      event.stopPropagation()
                                                    }
                                                    className="block break-words font-extrabold leading-5 text-[#028c36] hover:underline"
                                                    title={
                                                      ad.title ||
                                                      "Открыть объявление"
                                                    }
                                                  >
                                                    {ad.title ||
                                                      "Открыть объявление"}
                                                  </a>
                                                ) : (
                                                  <div className="break-words font-bold leading-5 text-black/65">
                                                    {ad?.title || "—"}
                                                  </div>
                                                )}

                                                {ad?.price && (
                                                  <div className="mt-1 whitespace-nowrap text-xs font-bold text-black/45">
                                                    {ad.price}
                                                  </div>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}

                                        {filteredAvitoItems.length === 0 && (
                                          <tr>
                                            <td
                                              colSpan={7}
                                              className="px-5 py-16 text-center"
                                            >
                                              <div className="text-base font-extrabold text-black">
                                                {avitoOnlySelected
                                                  ? "Нет выбранных строк"
                                                  : "По вашему поиску ничего не найдено"}
                                              </div>

                                              <p className="mt-2 text-sm text-black/45">
                                                {avitoOnlySelected
                                                  ? "Выберите строки или отключите фильтр «Только выделенные»."
                                                  : "Измените запрос поиска или выберите другой анализ."}
                                              </p>
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {comparedAvitoItems.length > 0 && (
                                  <section className="mt-6 overflow-hidden rounded-3xl border border-[#03bd48]/25 bg-[linear-gradient(145deg,rgba(3,189,72,0.09),rgba(255,255,255,0.98)_42%)] p-4 shadow-[0_14px_35px_rgba(3,189,72,0.08)] sm:p-5">
                                    <div className="flex flex-col gap-4 border-b border-[#03bd48]/15 pb-4 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0">
                                        <div className="inline-flex items-center gap-2 rounded-full bg-[#03bd48]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#027a30]">
                                          <span className="h-2 w-2 rounded-full bg-[#03bd48]" />
                                          Рабочее сравнение
                                        </div>

                                        <h4 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] text-black">
                                          Сравнение продавцов
                                        </h4>

                                        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
                                          Здесь собраны выбранные продавцы из
                                          разных анализов и поисковых запросов.
                                          Сравнение хранится в текущем браузере
                                          до обновления страницы.
                                        </p>
                                      </div>

                                      <div className="flex flex-col gap-2 sm:items-end">
                                        <span className="inline-flex w-fit rounded-full bg-black px-3 py-1.5 text-xs font-extrabold text-white">
                                          В сравнении:{" "}
                                          {comparedAvitoItems.length}
                                        </span>

                                        <button
                                          type="button"
                                          onClick={clearAvitoComparison}
                                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-extrabold text-red-600 transition hover:bg-red-100"
                                        >
                                          Очистить сравнение
                                        </button>
                                      </div>
                                    </div>

                                    {/* Карточки для мобильных */}
                                    <div className="mt-4 space-y-3 md:hidden">
                                      {comparedAvitoItems.map((item) => {
                                        const positions = item.positions.length
                                          ? item.positions.join(", ")
                                          : (item.firstPosition ?? "—");

                                        return (
                                          <article
                                            key={item.comparisonId}
                                            className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)]"
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <div className="break-words text-base font-extrabold leading-5 text-black">
                                                  {item.sellerName}
                                                </div>

                                                <div className="mt-1 text-xs font-semibold text-black/45">
                                                  {item.searchQuery}
                                                  {item.city
                                                    ? ` · ${item.city}`
                                                    : ""}
                                                </div>
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeComparedAvitoItem(
                                                    item.comparisonId,
                                                  )
                                                }
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                                                aria-label={`Убрать ${item.sellerName} из сравнения`}
                                                title="Убрать из сравнения"
                                              >
                                                ×
                                              </button>
                                            </div>

                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                              <div className="rounded-xl bg-[#03bd48]/[0.08] p-2.5">
                                                <div className="text-[9px] font-extrabold uppercase tracking-wide text-[#027a30]/65">
                                                  Позиции
                                                </div>
                                                <div className="mt-1 break-words text-sm font-extrabold text-[#028c36]">
                                                  {positions}
                                                </div>
                                              </div>

                                              <div className="rounded-xl bg-black/[0.035] p-2.5">
                                                <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                                  Рейтинг
                                                </div>
                                                <div className="mt-1 text-sm font-extrabold text-black">
                                                  {item.rating || "—"}
                                                </div>
                                              </div>

                                              <div className="rounded-xl bg-black/[0.035] p-2.5">
                                                <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                                  Отзывы
                                                </div>
                                                <div className="mt-1 text-sm font-extrabold text-black">
                                                  {item.reviews || "—"}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="mt-3 border-t border-black/[0.07] pt-3">
                                              <div className="flex items-center justify-between gap-2 text-xs">
                                                <span className="font-bold text-black/45">
                                                  Объявлений: {item.adsCount}
                                                </span>
                                                <span className="whitespace-nowrap text-[11px] font-bold text-black/45">
                                                  {formatAnalysisDateTime(
                                                    item.analysisCreatedAt,
                                                  )}
                                                </span>
                                              </div>

                                              {item.firstAdLink ? (
                                                <a
                                                  href={item.firstAdLink}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="mt-2 block break-words text-sm font-extrabold leading-5 text-[#028c36] hover:underline"
                                                >
                                                  {item.firstAdTitle ||
                                                    "Открыть объявление"}
                                                </a>
                                              ) : (
                                                <div className="mt-2 break-words text-sm font-bold leading-5 text-black/65">
                                                  {item.firstAdTitle ||
                                                    "Первое объявление не указано"}
                                                </div>
                                              )}

                                              {item.firstAdPrice && (
                                                <div className="mt-1 text-xs font-bold text-black/45">
                                                  {item.firstAdPrice}
                                                </div>
                                              )}
                                            </div>
                                          </article>
                                        );
                                      })}
                                    </div>

                                    {/* Таблица для планшета и ПК */}
                                    <div className="mt-4 hidden overflow-hidden rounded-2xl border border-black/[0.08] bg-white md:block">
                                      <div className="max-h-[560px] overflow-y-auto">
                                        <table className="w-full table-fixed border-collapse text-left">
                                          <thead className="sticky top-0 z-10 bg-[#101010] shadow-[0_2px_0_rgba(255,255,255,0.08)]">
                                            <tr className="whitespace-nowrap text-[9px] font-extrabold uppercase tracking-[0.045em] text-white/65">
                                              <th className="w-[17%] px-2 py-4 lg:px-3">
                                                Продавец
                                              </th>
                                              <th className="w-[14%] px-2 py-4 lg:px-3">
                                                Запрос
                                              </th>
                                              <th className="w-[17%] px-2 py-4 lg:px-3">
                                                Дата
                                              </th>
                                              <th className="w-[12%] px-2 py-4 lg:px-3">
                                                Позиции
                                              </th>
                                              <th className="w-[9%] px-2 py-4 text-center lg:px-3">
                                                Объявл.
                                              </th>
                                              <th className="w-[10%] px-2 py-4 text-center lg:px-3">
                                                Рейтинг
                                              </th>
                                              <th className="w-[10%] px-2 py-4 text-center lg:px-3">
                                                Отзывы
                                              </th>
                                              <th className="w-[11%] px-2 py-4 text-center lg:px-3">
                                                <span className="sr-only">
                                                  Убрать
                                                </span>
                                                <svg
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2.2"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  className="mx-auto h-4 w-4 text-white/70"
                                                  aria-hidden="true"
                                                >
                                                  <path d="M3 6h18" />
                                                  <path d="M8 6V4h8v2" />
                                                  <path d="m19 6-1 14H6L5 6" />
                                                </svg>
                                              </th>
                                            </tr>
                                          </thead>

                                          <tbody>
                                            {comparedAvitoItems.map((item) => {
                                              const positions = item.positions
                                                .length
                                                ? item.positions.join(", ")
                                                : (item.firstPosition ?? "—");

                                              return (
                                                <tr
                                                  key={item.comparisonId}
                                                  className="border-b border-black/[0.06] bg-white text-sm transition last:border-b-0 hover:bg-[#03bd48]/[0.035]"
                                                >
                                                  <td className="px-2 py-3.5 align-top lg:px-3">
                                                    <div className="break-words font-extrabold leading-5 text-black">
                                                      {item.sellerName}
                                                    </div>

                                                    {item.city && (
                                                      <div className="mt-1 text-xs font-semibold text-black/42">
                                                        {item.city}
                                                      </div>
                                                    )}
                                                  </td>

                                                  <td className="px-2 py-3.5 align-top lg:px-3">
                                                    <div className="break-words font-bold leading-5 text-black/70">
                                                      {item.searchQuery}
                                                    </div>
                                                  </td>

                                                  <td className="whitespace-nowrap px-2 py-3.5 align-top text-center lg:px-3">
                                                    <div className="text-xs font-extrabold text-black/65 whitespace-pre-line">
                                                      {formatAnalysisDateTime(
                                                        item.analysisCreatedAt,
                                                      ).replace(", ", "\n")}
                                                    </div>
                                                  </td>

                                                  <td className="px-2 py-3.5 align-top lg:px-3">
                                                    <span className="inline-flex max-w-full rounded-lg bg-[#03bd48]/10 px-2 py-1 text-xs font-extrabold text-[#028c36]">
                                                      <span className="break-words">
                                                        {positions}
                                                      </span>
                                                    </span>
                                                  </td>

                                                  <td className="whitespace-nowrap px-2 py-3.5 text-center align-top lg:px-3">
                                                    <span className="inline-flex min-w-8 justify-center rounded-lg bg-black/[0.05] px-2 py-1 text-xs font-extrabold text-black/70">
                                                      {item.adsCount}
                                                    </span>
                                                  </td>

                                                  <td className="whitespace-nowrap px-2 py-3.5 text-center align-top font-extrabold text-black lg:px-3">
                                                    {item.rating || "—"}
                                                  </td>

                                                  <td className="whitespace-nowrap px-2 py-3.5 text-center align-top font-extrabold text-black lg:px-3">
                                                    {item.reviews || "—"}
                                                  </td>

                                                  <td className="px-2 py-3.5 text-center align-top lg:px-3">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        removeComparedAvitoItem(
                                                          item.comparisonId,
                                                        )
                                                      }
                                                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-lg font-bold text-red-600 transition hover:bg-red-100"
                                                      aria-label={`Убрать ${item.sellerName} из сравнения`}
                                                      title="Убрать из сравнения"
                                                    >
                                                      ×
                                                    </button>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </section>
                                )}
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

                  <div className="relative flex items-start justify-between gap-3 p-4 sm:gap-5 sm:p-6 md:p-8">
                    <div className="min-w-0">
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                        Инструменты HelpSell
                      </div>

                      <h2 className="text-[30px] font-extrabold leading-[1.03] tracking-[-0.055em] sm:text-3xl md:text-5xl">
                        Финансовый
                        <span className="text-[#03bd48]"> анализ</span>
                      </h2>

                      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 md:text-[15px]">
                        Добавляйте ежедневные доходы и расходы, следите за
                        чистой прибылью и динамикой выручки за нужный период.
                      </p>
                    </div>

                    <CollapseButton
                      isOpen={isFinancialHeroOpen}
                      onClick={() =>
                        setIsFinancialHeroOpen((current) => !current)
                      }
                      dark
                      label="Свернуть или раскрыть описание финансового анализа"
                    />
                  </div>

                  <CollapsibleContent isOpen={isFinancialHeroOpen}>
                    <div className="relative grid gap-3 border-t border-white/10 p-4 pt-4 sm:grid-cols-2 sm:p-6 sm:pt-5 md:p-8 md:pt-5">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm transition hover:border-[#03bd48]/40 hover:bg-white/[0.08]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/45">
                              Указан период
                            </div>

                            <div className="mt-2 text-sm font-extrabold leading-5 tracking-[-0.025em] text-white sm:text-base md:text-xl">
                              {formatRecordDate(periodStart)} —{" "}
                              {formatRecordDate(periodEnd)}
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
                              className={`mt-2 break-words text-3xl font-extrabold leading-none tracking-[-0.05em] sm:text-4xl ${
                                analytics.netProfit >= 0
                                  ? "text-[#03bd48]"
                                  : "text-red-400"
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

                <section className="overflow-hidden rounded-[32px] border border-black/[0.07] bg-white p-4 shadow-[0_18px_45px_rgba(16,24,40,0.07)] sm:p-5 md:p-8">
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0">
                      <div className="mb-3 inline-flex rounded-full bg-[#03bd48]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#027a30]">
                        Аналитика
                      </div>
                      <h2 className="text-3xl font-extrabold tracking-[-0.045em] text-black">
                        Показатели за период
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-black/48">
                        Все значения пересчитываются автоматически по данным из
                        вашей таблицы доходов и расходов.
                      </p>
                    </div>
                    <CollapseButton
                      isOpen={isFinancialAnalyticsOpen}
                      onClick={() =>
                        setIsFinancialAnalyticsOpen((current) => !current)
                      }
                      label="Свернуть или раскрыть показатели за период"
                    />
                  </div>

                  <CollapsibleContent isOpen={isFinancialAnalyticsOpen}>
                    <div className="mt-7 space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                              analytics.netProfit >= 0
                                ? "bg-[#03bd48]/20"
                                : "bg-red-200/60"
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
                                  analytics.netProfit >= 0
                                    ? "text-[#03bd48]"
                                    : "text-red-600"
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
                          action={
                            <FullscreenChartButton
                              onClick={() => setIsChartFullscreen(true)}
                            />
                          }
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
                                    Полноэкранный режим: все точки, даты и
                                    значения увеличены пропорционально.
                                  </p>
                                </div>
                                <FullscreenChartButton
                                  expanded
                                  onClick={() => setIsChartFullscreen(false)}
                                />
                              </div>
                              <IncomeChart
                                data={analytics.chartData}
                                expanded
                              />
                            </div>
                          </div>,
                          document.body,
                        )}

                      <div className="rounded-3xl border border-black/[0.07] bg-black/[0.018] p-4 md:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="text-sm font-extrabold text-black">
                              Период аналитики
                            </div>
                            <p className="mt-1 text-sm text-black/48">
                              По умолчанию отображаются последние 7 дней.
                            </p>
                          </div>
                          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
                            <label className="block min-w-0">
                              <span className="mb-2 block text-xs font-bold text-black/50">
                                Начало периода
                              </span>
                              <input
                                type="date"
                                value={periodStart}
                                max={periodEnd}
                                onChange={(event) =>
                                  setPeriodStart(event.target.value)
                                }
                                className="min-w-0 max-w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-[13px] font-bold outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10 sm:text-sm"
                              />
                            </label>
                            <label className="block min-w-0">
                              <span className="mb-2 block text-xs font-bold text-black/50">
                                Конец периода
                              </span>
                              <input
                                type="date"
                                value={periodEnd}
                                min={periodStart}
                                max={getTodayDate()}
                                onChange={(event) =>
                                  setPeriodEnd(event.target.value)
                                }
                                className="min-w-0 max-w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-[13px] font-bold outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10 sm:text-sm"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </section>

                <section className="overflow-hidden rounded-[32px] border border-black/[0.07] bg-white p-4 shadow-[0_18px_45px_rgba(16,24,40,0.07)] sm:p-5 md:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 inline-flex rounded-full bg-black/[0.045] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/55">
                        Учёт
                      </div>
                      <h2 className="text-3xl font-extrabold tracking-[-0.045em] text-black">
                        Доходы и расходы
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-black/50">
                        Вносите данные за день. Чистая прибыль рассчитывается
                        автоматически.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {!isEditingFinancials && (
                        <button
                          type="button"
                          onClick={startFinancialEditing}
                          className="btn-primary flex-1 sm:flex-none shadow-[0_10px_22px_rgba(3,189,72,0.2)]"
                        >
                          Редактировать
                        </button>
                      )}
                      <CollapseButton
                        isOpen={isFinancialTableOpen}
                        onClick={() =>
                          setIsFinancialTableOpen((current) => !current)
                        }
                        label="Свернуть или раскрыть таблицу доходов и расходов"
                      />
                    </div>
                  </div>

                  <CollapsibleContent isOpen={isFinancialTableOpen}>
                    <div>
                      <div className="mt-6 rounded-3xl border border-black/[0.07] bg-[linear-gradient(135deg,rgba(3,189,72,0.055),rgba(255,255,255,0.9))] p-4 md:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="text-sm font-extrabold text-black">
                              Период отображения таблицы
                            </div>
                            <p className="mt-1 text-sm text-black/48">
                              По умолчанию отображается последний месяц.
                            </p>
                          </div>
                          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
                            <label className="block min-w-0">
                              <span className="mb-2 block text-xs font-bold text-black/50">
                                Начало периода
                              </span>
                              <input
                                type="date"
                                value={tablePeriodStart}
                                max={tablePeriodEnd}
                                onChange={(event) =>
                                  setTablePeriodStart(event.target.value)
                                }
                                className="min-w-0 max-w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-[13px] font-bold outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10 sm:text-sm"
                              />
                            </label>
                            <label className="block min-w-0">
                              <span className="mb-2 block text-xs font-bold text-black/50">
                                Конец периода
                              </span>
                              <input
                                type="date"
                                value={tablePeriodEnd}
                                min={tablePeriodStart}
                                max={getTodayDate()}
                                onChange={(event) =>
                                  setTablePeriodEnd(event.target.value)
                                }
                                className="min-w-0 max-w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-[13px] font-bold outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10 sm:text-sm"
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
                            {financialSaving
                              ? "Сохранение..."
                              : "Сохранить изменения"}
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

                      <div className="mt-6 space-y-3 md:hidden">
                        {!isEditingFinancials &&
                          tableRecordsInPeriod.map((record, index) => {
                            const profit = record.income - record.expense;
                            return (
                              <div
                                key={record.id}
                                className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)]"
                              >
                                <div className="flex items-center justify-between gap-3 border-b border-black/[0.07] pb-3">
                                  <span className="text-xs font-extrabold text-black/40">
                                    Запись #{index + 1}
                                  </span>
                                  <span className="text-sm font-extrabold text-black">
                                    {formatRecordDate(record.recordDate)}
                                  </span>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <div className="rounded-xl bg-[#03bd48]/[0.07] p-3">
                                    <div className="text-[9px] font-extrabold uppercase tracking-wide text-[#027a30]/65">
                                      Доходы
                                    </div>
                                    <div className="mt-1 text-base font-extrabold text-[#028c36]">
                                      {formatMoney(record.income)} ₽
                                    </div>
                                  </div>
                                  <div className="rounded-xl bg-red-50 p-3">
                                    <div className="text-[9px] font-extrabold uppercase tracking-wide text-red-600/65">
                                      Расходы
                                    </div>
                                    <div className="mt-1 text-base font-extrabold text-red-600">
                                      {formatMoney(record.expense)} ₽
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 rounded-xl bg-black p-3">
                                  <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/45">
                                    Чистая прибыль
                                  </div>
                                  <div
                                    className={`mt-1 text-lg font-extrabold ${profit >= 0 ? "text-[#03bd48]" : "text-red-400"}`}
                                  >
                                    {profit > 0 ? "+" : ""}
                                    {formatMoney(profit)} ₽
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        {!isEditingFinancials &&
                          tableRecordsInPeriod.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-black/15 px-5 py-12 text-center text-sm text-black/48">
                              В выбранном периоде пока нет данных.
                            </div>
                          )}
                      </div>
                      <div
                        className={`mt-6 overflow-x-auto rounded-3xl border border-black/[0.08] shadow-[0_10px_26px_rgba(16,24,40,0.04)] ${isEditingFinancials ? "block" : "hidden md:block"}`}
                      >
                        <table className="min-w-[760px] w-full border-collapse text-left">
                          <thead className="bg-[#101010]">
                            <tr className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-white/58">
                              <th className="w-[70px] px-5 py-4">№</th>
                              <th className="px-5 py-4">Дата</th>
                              <th className="px-5 py-4">Доходы</th>
                              <th className="px-5 py-4">Расходы</th>
                              <th className="px-5 py-4">Чистая прибыль</th>
                              {isEditingFinancials && (
                                <th className="w-[120px] px-5 py-4">
                                  Действие
                                </th>
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
                                        profit,
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
                                            event.target.value,
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
                                        value={
                                          record.income == 0
                                            ? ""
                                            : record.income
                                        }
                                        onChange={(event) =>
                                          updateFinancialDraft(
                                            record.id,
                                            "income",
                                            event.target.value,
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
                                        value={
                                          record.expense == 0
                                            ? ""
                                            : record.expense
                                        }
                                        onChange={(event) =>
                                          updateFinancialDraft(
                                            record.id,
                                            "expense",
                                            event.target.value,
                                          )
                                        }
                                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-bold text-red-600 outline-none transition focus:border-[#03bd48] focus:ring-4 focus:ring-[#03bd48]/10"
                                      />
                                    </td>

                                    <td
                                      className={`px-5 py-3 text-base font-extrabold ${getProfitClass(
                                        profit,
                                      )}`}
                                    >
                                      {profit > 0 ? "+" : ""}
                                      {formatMoney(profit)} ₽
                                    </td>
                                    <td className="px-5 py-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeFinancialDraft(record)
                                        }
                                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-extrabold text-red-600 transition hover:bg-red-100"
                                      >
                                        Удалить
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}

                            {!isEditingFinancials &&
                              tableRecordsInPeriod.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="px-5 py-14 text-center text-sm text-black/48"
                                  >
                                    В выбранном периоде пока нет данных. Нажмите
                                    «Редактировать», чтобы добавить первую
                                    запись.
                                  </td>
                                </tr>
                              )}

                            {isEditingFinancials &&
                              financialDrafts.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="px-5 py-14 text-center text-sm text-black/48"
                                  >
                                    В таблице нет строк. Нажмите «Добавить
                                    строку», чтобы внести первую запись.
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

            {activeSection === "bid-manager" && hasAccess && (
              <div className="space-y-6">
                <section className="relative overflow-hidden rounded-[32px] bg-[#101010] p-4 text-white shadow-[0_24px_65px_rgba(16,24,40,0.22)] sm:p-6 md:p-8">
                  <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#03bd48]/20 blur-3xl" />
                  <div className="pointer-events-none absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-white/[0.04] blur-3xl" />
                  <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/75">
                        <span className="h-2 w-2 rounded-full bg-[#03bd48] shadow-[0_0_0_5px_rgba(3,189,72,0.14)]" />
                        Инструменты HelpSell
                      </div>
                      <h2 className="text-[30px] font-extrabold leading-[1.03] tracking-[-0.055em] sm:text-4xl md:text-5xl">
                        Бид-менеджер
                        <span className="text-[#03bd48]"> Авито</span>
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 md:text-[15px]">
                        Подключайте кабинет Авито, выбирайте реальные объявления
                        и сохраняйте несколько независимых стратегий продвижения
                        — настройки останутся в вашем кабинете.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openBidderWizard}
                      className="btn-primary w-full shrink-0 sm:w-auto"
                    >
                      <span className="text-lg leading-none">+</span>
                      Создать бидер
                    </button>
                  </div>
                </section>

                <section className="rounded-[28px] border border-black/[0.08] bg-white p-4 shadow-[0_12px_32px_rgba(16,24,40,0.05)] sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold ${avitoConnection ? "bg-[#03bd48]/10 text-[#028c36]" : "bg-amber-50 text-amber-700"}`}
                      >
                        {avitoConnection ? "✓" : "!"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold uppercase tracking-[0.1em] text-black/42">
                          Аккаунт Авито
                        </div>
                        {avitoConnection ? (
                          <>
                            <div className="mt-1 font-extrabold text-black">
                              Аккаунт подключён
                            </div>
                            <div className="mt-1 text-xs font-semibold text-black/48">
                              Client ID: {avitoConnection.clientIdMasked} ·
                              Проверен:{" "}
                              {formatConnectionDate(
                                avitoConnection.lastCheckedAt,
                              )}
                            </div>
                            {avitoConnection.lastError && (
                              <div className="mt-1 text-xs font-bold text-red-600">
                                {avitoConnection.lastError}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="mt-1 font-extrabold text-black">
                              Аккаунт Авито не подключён
                            </div>
                            <div className="mt-1 text-xs font-semibold text-black/48">
                              Подключите кабинет, чтобы позже выбирать реальные
                              объявления и управлять продвижением.
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={openAvitoConnection}
                        disabled={avitoConnectionSaving}
                        className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {avitoConnection
                          ? "Переподключить"
                          : "Подключить Авито"}
                      </button>
                      {avitoConnection && (
                        <button
                          type="button"
                          onClick={disconnectAvitoConnection}
                          disabled={avitoConnectionSaving}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Отключить
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Активные бидеры"
                    className="border-[#03bd48]/20 bg-[#03bd48]/[0.055] p-4 sm:p-5"
                  >
                    <div className="text-3xl font-extrabold tracking-[-0.05em] text-[#028c36]">
                      {
                        bidders.filter((item) => item.status === "active")
                          .length
                      }
                    </div>
                    <div className="mt-1 text-xs font-bold text-[#027a30]/65">
                      автоматически работают
                    </div>
                  </MetricCard>
                  <MetricCard title="На паузе" className="p-4 sm:p-5">
                    <div className="text-3xl font-extrabold tracking-[-0.05em] text-black">
                      {
                        bidders.filter((item) => item.status === "paused")
                          .length
                      }
                    </div>
                    <div className="mt-1 text-xs font-bold text-black/42">
                      можно запустить в любой момент
                    </div>
                  </MetricCard>
                  <MetricCard
                    title="Требуют внимания"
                    className="border-amber-200 bg-amber-50 p-4 sm:p-5"
                  >
                    <div className="text-3xl font-extrabold tracking-[-0.05em] text-amber-700">
                      {
                        bidders.filter((item) => item.status === "attention")
                          .length
                      }
                    </div>
                    <div className="mt-1 text-xs font-bold text-amber-700/65">
                      позиция ниже целевого диапазона
                    </div>
                  </MetricCard>
                  <MetricCard
                    title="Изменений сегодня"
                    className="bg-black p-4 text-white sm:p-5"
                  >
                    <div className="text-3xl font-extrabold tracking-[-0.05em] text-[#03bd48]">
                      {bidders.reduce(
                        (sum, item) => sum + item.changesToday,
                        0,
                      )}
                    </div>
                    <div className="mt-1 text-xs font-bold text-white/45">
                      история появится после подключения Авито
                    </div>
                  </MetricCard>
                </section>

                {bidderMessage && (
                  <div className="flex items-start gap-2 rounded-2xl border border-[#03bd48]/25 bg-[#03bd48]/10 px-4 py-3 text-sm font-bold leading-6 text-[#027a30]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#03bd48] text-xs text-white">
                      ✓
                    </span>
                    {bidderMessage}
                  </div>
                )}

                <section className="overflow-hidden rounded-[32px] border border-black/[0.07] bg-white p-4 shadow-[0_18px_45px_rgba(16,24,40,0.07)] sm:p-6 md:p-8">
                  <div className="flex flex-col gap-4 border-b border-black/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="badge-green mb-3">Ваши стратегии</div>
                      <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black sm:text-3xl">
                        Бидеры объявлений
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-black/50">
                        Каждый бидер управляет отдельным объявлением и поисковым
                        запросом. Можно создавать несколько независимых
                        стратегий.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openBidderWizard}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-black/[0.025] px-5 py-4 text-sm font-extrabold text-black transition hover:border-[#03bd48]/50 hover:bg-[#03bd48]/[0.07] hover:text-[#028c36] sm:w-auto"
                    >
                      + Новый бидер
                    </button>
                  </div>

                  {bidders.length === 0 ? (
                    <div className="mt-6 rounded-3xl border border-dashed border-black/15 bg-black/[0.02] px-5 py-14 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#03bd48]/10 text-2xl font-extrabold text-[#028c36]">
                        +
                      </div>
                      <h4 className="mt-4 text-xl font-extrabold text-black">
                        Пока нет бидеров
                      </h4>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-black/50">
                        Создайте первый бидер: выберите объявление, цель по
                        позиции и безопасные границы ставки.
                      </p>
                      <button
                        type="button"
                        onClick={openBidderWizard}
                        className="btn-primary mt-5"
                      >
                        Создать первый бидер
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {bidders.map((bidder) => {
                        const status =
                          bidder.status === "active"
                            ? {
                                label: "Активен",
                                className:
                                  "bg-[#03bd48]/12 text-[#028c36] border-[#03bd48]/25",
                              }
                            : bidder.status === "paused"
                              ? {
                                  label: "На паузе",
                                  className:
                                    "bg-black/[0.045] text-black/55 border-black/10",
                                }
                              : {
                                  label: "Нужно внимание",
                                  className:
                                    "bg-amber-50 text-amber-700 border-amber-200",
                                };
                        const positionsText =
                          bidder.targetFrom === bidder.targetTo
                            ? `Топ-${bidder.targetFrom}`
                            : `${bidder.targetFrom}–${bidder.targetTo} место`;
                        return (
                          <article
                            key={bidder.id}
                            className="overflow-hidden rounded-3xl border border-black/[0.08] bg-white transition hover:border-[#03bd48]/30 hover:shadow-[0_14px_32px_rgba(16,24,40,0.07)]"
                          >
                            <div className="flex flex-col gap-4 p-4 sm:p-5 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#101010,#303337)] text-sm font-extrabold tracking-[0.08em] text-[#03bd48]">
                                {bidder.imageLabel}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-start justify-between gap-2 lg:justify-start">
                                  <h4 className="break-words text-lg font-extrabold leading-6 text-black">
                                    {bidder.title}
                                  </h4>
                                  <span
                                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.07em] ${status.className}`}
                                  >
                                    {status.label}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-black/48">
                                  <span>{bidder.query}</span>
                                  <span className="hidden h-1 w-1 self-center rounded-full bg-black/25 sm:block" />
                                  <span>{bidder.city}</span>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.07em] ${
                                    bidder.mode === "live"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-amber-50 text-amber-700"
                                  }`}>
                                    {bidder.mode === "live" ? "Live" : "Dry-run"}
                                  </span>
                                  {bidder.avitoItemId && (
                                    <>
                                      <span className="hidden h-1 w-1 self-center rounded-full bg-black/25 sm:block" />
                                      <span>ID: {bidder.avitoItemId}</span>
                                    </>
                                  )}
                                </div>
                                {bidder.avitoItemUrl && (
                                  <a
                                    href={bidder.avitoItemUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex text-xs font-extrabold text-[#028c36] transition hover:text-[#03bd48]"
                                  >
                                    Открыть объявление на Авито
                                  </a>
                                )}
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-black/45">
  <span>
    Последняя проверка:{" "}
    {bidder.lastCheckedAt
      ? formatConnectionDate(bidder.lastCheckedAt)
      : "ещё не выполнялась"}
  </span>

  {bidder.lastError && (
    <span className="text-red-600">Ошибка: {bidder.lastError}</span>
  )}
</div>
                                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  <div className="rounded-xl bg-black/[0.025] p-2.5">
                                    <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                      Цель
                                    </div>
                                    <div className="mt-1 whitespace-nowrap text-sm font-extrabold text-black">
                                      {positionsText}
                                    </div>
                                  </div>
                                  <div
                                    className={`rounded-xl p-2.5 ${bidder.status === "attention" ? "bg-amber-50" : "bg-[#03bd48]/[0.07]"}`}
                                  >
                                    <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                      Позиция
                                    </div>
                                    <div
                                      className={`mt-1 text-sm font-extrabold ${bidder.status === "attention" ? "text-amber-700" : "text-[#028c36]"}`}
                                    >
                                      {bidder.position
                                        ? `${bidder.position} место`
                                        : "—"}
                                    </div>
                                  </div>
                                  <div className="rounded-xl bg-black/[0.025] p-2.5">
                                    <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                      {bidder.mode === "live" ? "Ставка live" : "Ставка dry-run"}
                                    </div>
                                    <div className="mt-1 whitespace-nowrap text-sm font-extrabold text-black">
                                      {formatMoney(bidder.currentBid)} ₽
                                    </div>
                                  </div>
                                  <div className="rounded-xl bg-black/[0.025] p-2.5">
                                    <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">
                                      Проверка
                                    </div>
                                    <div className="mt-1 whitespace-nowrap text-xs font-extrabold text-black/65">
                                      {bidder.nextCheck}
                                    </div>
                                  </div>
                                  
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-col">
                                <button
                                  type="button"
                                  onClick={() => openBidderEditor(bidder)}
                                  disabled={bidderSaving}
                                  className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-extrabold text-black/70 transition hover:border-[#03bd48]/40 hover:bg-[#03bd48]/[0.06] hover:text-[#028c36] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Редактировать
                                </button>
                                <button
  type="button"
  onClick={() => checkBidderItem(bidder.id)}
  disabled={
    bidderSaving ||
    checkingBidderId !== null ||
    !bidder.avitoItemId
  }
  className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-extrabold text-black/70 transition hover:border-[#03bd48]/40 hover:bg-[#03bd48]/[0.06] hover:text-[#028c36] disabled:cursor-not-allowed disabled:opacity-60"
>
  {checkingBidderId === bidder.id ? "Проверяем..." : "Проверить объявление"}
</button>
<button
  type="button"
  onClick={() => void toggleBidderEvents(bidder.id)}
  disabled={bidderEventsLoadingId === bidder.id}
  className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-extrabold text-black/70 transition hover:border-[#03bd48]/40 hover:bg-[#03bd48]/[0.06] hover:text-[#028c36] disabled:cursor-not-allowed disabled:opacity-60"
>
  {expandedBidderId === bidder.id
    ? "Скрыть историю"
    : bidderEventsLoadingId === bidder.id
      ? "Загружаем..."
      : "История событий"}
</button>
                                <button
                                  type="button"
                                  onClick={() => toggleBidderStatus(bidder.id)}
                                  disabled={bidderSaving}
                                  className={`rounded-xl px-3 py-2.5 text-xs font-extrabold transition ${bidder.status === "active" ? "border border-black/10 bg-white text-black/70 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700" : "bg-[#03bd48] text-white hover:bg-[#02963a]"}`}
                                >
                                  {bidder.status === "active"
                                    ? "Пауза"
                                    : "Запустить"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteBidder(bidder.id)}
                                  disabled={bidderSaving}
                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-extrabold text-red-600 transition hover:bg-red-100"
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] bg-black/[0.018] px-4 py-3 text-xs sm:px-5">
                              <span className="font-semibold text-black/45">
                                Диапазон ставки: {formatMoney(bidder.minBid)}–
                                {formatMoney(bidder.maxBid)} ₽
                              </span>
                              <span className="font-extrabold text-[#028c36]">
                                Изменений сегодня: {bidder.changesToday}
                              </span>
                            </div>
                            {expandedBidderId === bidder.id && (
  <div className="border-t border-black/[0.06] bg-black/[0.02] px-4 py-4 sm:px-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/40">
          История событий
        </div>
        <div className="mt-1 text-sm font-bold text-black/55">
          Последние действия по этому бидеру
        </div>
      </div>

      <button
        type="button"
        onClick={() => void loadBidderEvents(bidder.id)}
        disabled={bidderEventsLoadingId === bidder.id}
        className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/70 transition hover:border-[#03bd48]/35 hover:text-[#028c36] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {bidderEventsLoadingId === bidder.id ? "Обновляем..." : "Обновить"}
      </button>
    </div>

    <div className="mt-4 space-y-3">
      {(bidderEvents[bidder.id] ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white px-4 py-6 text-sm font-semibold text-black/45">
          История событий пока пуста.
        </div>
      ) : (
        (bidderEvents[bidder.id] ?? []).map((event, index) => (
          <div
            key={event.id}
            className="relative rounded-2xl border border-black/[0.06] bg-white px-4 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${
                      event.type === "manual_check_success"
                        ? "bg-[#03bd48]/12 text-[#028c36]"
                        : event.type === "manual_check_error"
                          ? "bg-red-50 text-red-600"
                          : event.type === "bidder_deleted"
                            ? "bg-black/[0.07] text-black/55"
                            : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {event.type === "manual_check_success"
                      ? "Проверка OK"
                      : event.type === "manual_check_error"
                        ? "Ошибка проверки"
                        : event.type === "bidder_deleted"
                          ? "Удаление"
                          : "Событие"}
                  </span>
                </div>

                <div className="mt-2 text-sm font-bold leading-6 text-black">
                  {event.message}
                </div>
              </div>

              <div className="shrink-0 text-xs font-semibold text-black/40">
                {formatConnectionDate(event.createdAt)}
              </div>
            </div>

            {index < (bidderEvents[bidder.id] ?? []).length - 1 && (
              <div className="mt-3 border-b border-dashed border-black/10" />
            )}
          </div>
        ))
      )}
    </div>
  </div>
)}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-black/[0.07] bg-black/[0.018] p-4 sm:p-5">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-sm font-extrabold text-[#03bd48]">
                      i
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-black">
                        Первый этап Бид-менеджера
                      </h4>
                      <p className="mt-1 text-sm leading-6 text-black/50">
                        Бидеры пока не подключены к кабинету Авито: позиции и
                        ставки показаны как тестовые данные. На следующем этапе
                        добавим подключение кабинета, сохранение стратегий и
                        фоновую проверку ставок.
                      </p>
                    </div>
                  </div>
                </section>

                {isAvitoConnectionOpen && (
                  <div className="fixed inset-0 z-[10001] overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6">
                    <div className="mx-auto flex min-h-full w-full max-w-lg items-center">
                      <section className="my-auto w-full overflow-hidden rounded-[30px] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
                        <div className="flex items-start justify-between gap-4 bg-[#101010] p-5 text-white sm:p-7">
                          <div>
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-white/45">
                              Интеграция
                            </div>
                            <h3 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">
                              Подключить аккаунт Авито
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAvitoConnectionOpen(false)}
                            disabled={avitoConnectionSaving}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-xl text-white transition hover:bg-white/20 disabled:opacity-50"
                            aria-label="Закрыть окно"
                          >
                            ×
                          </button>
                        </div>
                        <div className="space-y-5 p-5 sm:p-7">
                          <p className="text-sm leading-6 text-black/55">
                            Введите данные приложения из кабинета разработчика
                            Авито. Client Secret будет зашифрован на сервере и
                            не отобразится в кабинете.
                          </p>
                          {avitoConnectionError && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700">
                              {avitoConnectionError}
                            </div>
                          )}
                          <label className="block">
                            <span className="mb-2 block text-xs font-bold text-black/55">
                              Client ID
                            </span>
                            <input
                              value={avitoClientId}
                              onChange={(event) =>
                                setAvitoClientId(event.target.value)
                              }
                              autoComplete="off"
                              disabled={avitoConnectionSaving}
                              className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48] disabled:bg-black/[0.03]"
                              placeholder="Введите Client ID"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-xs font-bold text-black/55">
                              Client Secret
                            </span>
                            <input
                              type="password"
                              value={avitoClientSecret}
                              onChange={(event) =>
                                setAvitoClientSecret(event.target.value)
                              }
                              autoComplete="new-password"
                              disabled={avitoConnectionSaving}
                              className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48] disabled:bg-black/[0.03]"
                              placeholder="Введите Client Secret"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={saveAvitoConnection}
                            disabled={
                              avitoConnectionSaving ||
                              !avitoClientId.trim() ||
                              !avitoClientSecret.trim()
                            }
                            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {avitoConnectionSaving
                              ? "Проверяем подключение…"
                              : "Проверить и подключить"}
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>
                )}

                {isBidderWizardOpen && (
                  <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6">
                    <div className="mx-auto flex min-h-full w-full max-w-3xl items-center">
                      <section className="my-auto w-full overflow-hidden rounded-[30px] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
                        <div className="flex items-start justify-between gap-4 bg-[#101010] p-5 text-white sm:p-7">
                          <div>
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-white/45">
                              {editingBidderId
                                ? "Редактирование бидера"
                                : "Новый бидер"}{" "}
                              · шаг {bidderWizardStep} из 4
                            </div>
                            <h3 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">
                              {editingBidderId
                                ? "Редактирование стратегии"
                                : "Создание стратегии"}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsBidderWizardOpen(false)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-xl text-white transition hover:bg-white/20"
                            aria-label="Закрыть мастер"
                          >
                            ×
                          </button>
                        </div>
                        <div className="flex gap-1.5 px-5 pt-5 sm:px-7">
                          {[1, 2, 3, 4].map((step) => (
                            <span
                              key={step}
                              className={`h-1.5 flex-1 rounded-full ${step <= bidderWizardStep ? "bg-[#03bd48]" : "bg-black/10"}`}
                            />
                          ))}
                        </div>
                        <div className="p-5 sm:p-7">
                          {bidderWizardStep === 1 && (
                            <div>
                              <div className="badge-green mb-3">
                                Шаг 1 · Объявление
                              </div>
                              <h4 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
                                Выберите объявление Авито
                              </h4>
                              <p className="mt-2 text-sm leading-6 text-black/50">
                                На этом шаге стратегия привязывается к реальному
                                объявлению из подключённого кабинета Авито.
                              </p>

                              {!avitoConnection && (
                                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold leading-6 text-amber-800">
                                  Аккаунт Авито ещё не подключён. Сначала
                                  подключите кабинет, затем вернитесь к созданию
                                  стратегии.
                                </div>
                              )}

                              {avitoConnection && (
                                <>
                                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-4">
                                    <div>
                                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-black/40">
                                        Подключённый кабинет
                                      </div>
                                      <div className="mt-1 text-sm font-extrabold text-black">
                                        Client ID:{" "}
                                        {avitoConnection.clientIdMasked}
                                      </div>
                                      <div className="mt-1 text-xs font-semibold text-black/45">
                                        Проверен:{" "}
                                        {formatConnectionDate(
                                          avitoConnection.lastCheckedAt,
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void loadAvitoItems()}
                                      disabled={avitoItemsLoading}
                                      className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-extrabold text-black/70 transition hover:border-[#03bd48]/35 hover:text-[#028c36] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {avitoItemsLoading
                                        ? "Обновляем…"
                                        : "Обновить объявления"}
                                    </button>
                                  </div>

                                  {avitoItemsError && (
                                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-bold leading-6 text-red-700">
                                      {avitoItemsError}
                                    </div>
                                  )}

                                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    {avitoItems.map((item) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onClick={() =>
                                          setBidderDraft({
                                            ...bidderDraft,
                                            title: item.title,
                                            avitoItemId: item.id,
                                            avitoItemUrl: item.url,
                                          })
                                        }
                                        className={`rounded-2xl border p-4 text-left transition ${bidderDraft.avitoItemId === item.id ? "border-[#03bd48] bg-[#03bd48]/10" : "border-black/10 bg-white hover:border-[#03bd48]/35"}`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">
                                            Объявление Авито
                                          </div>
                                          <span className="rounded-full bg-black/[0.05] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/45">
                                            ID {item.id}
                                          </span>
                                        </div>
                                        <div className="mt-2 font-extrabold text-black">
                                          {item.title}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-black/45">
                                          {item.price && (
                                            <span>{item.price}</span>
                                          )}
                                          {item.status && (
                                            <span>Статус: {item.status}</span>
                                          )}
                                          {item.category && (
                                            <span>{item.category}</span>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>

                                  {!avitoItemsLoading &&
                                    avitoItems.length === 0 &&
                                    !avitoItemsError && (
                                      <div className="mt-5 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-4 py-8 text-center text-sm font-semibold leading-6 text-black/48">
                                        Мы не нашли объявления в подключённом
                                        кабинете. Проверьте, что в аккаунте
                                        Авито есть активные объявления и у
                                        приложения есть нужные права доступа.
                                      </div>
                                    )}
                                </>
                              )}

                              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Название объявления
                                  </span>
                                  <input
                                    value={bidderDraft.title}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        title: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Ссылка на объявление
                                  </span>
                                  <input
                                    value={bidderDraft.avitoItemUrl ?? ""}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        avitoItemUrl: e.target.value || null,
                                      })
                                    }
                                    placeholder="https://www.avito.ru/..."
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                          {bidderWizardStep === 2 && (
                            <div>
                              <div className="badge-green mb-3">
                                Шаг 2 · Цель
                              </div>
                              <h4 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
                                Настройте позицию в поиске
                              </h4>
                              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Поисковый запрос
                                  </span>
                                  <input
                                    value={bidderDraft.query}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        query: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Город
                                  </span>
                                  <input
                                    value={bidderDraft.city}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        city: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Позиция от
                                  </span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={bidderDraft.targetFrom}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        targetFrom: Number(e.target.value) || 1,
                                      })
                                    }
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Позиция до
                                  </span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={bidderDraft.targetTo}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        targetTo: Number(e.target.value) || 1,
                                      })
                                    }
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  />
                                </label>
                              </div>
                              <div className="mt-4 rounded-2xl bg-[#03bd48]/[0.07] p-4 text-sm font-bold text-[#027a30]">
                                Цель: удерживать объявление на позициях{" "}
                                {bidderDraft.targetFrom}–{bidderDraft.targetTo}.
                              </div>
                            </div>
                          )}
                          {bidderWizardStep === 3 && (
                            <div>
                              <div className="badge-green mb-3">
                                Шаг 3 · Лимиты
                              </div>
                              <h4 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
                                Настройте безопасные границы
                              </h4>
                              <p className="mt-2 text-sm leading-6 text-black/50">
                                Бидер никогда не сможет выйти за указанные
                                лимиты ставки.
                              </p>
                              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Минимальная ставка, ₽
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={bidderDraft.minBid}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        minBid: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Максимальная ставка, ₽
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={bidderDraft.maxBid}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        maxBid: Number(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Проверка каждые, мин.
                                  </span>
                                  <select
                                    value={bidderDraft.interval}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        interval: Number(e.target.value),
                                      })
                                    }
                                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  >
                                    <option value="5">5 минут</option>
                                    <option value="10">10 минут</option>
                                    <option value="15">15 минут</option>
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="mb-2 block text-xs font-bold text-black/50">
                                    Рабочее время
                                  </span>
                                  <input
                                    value={bidderDraft.schedule}
                                    onChange={(e) =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        schedule: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-bold outline-none focus:border-[#03bd48]"
                                  />
                                </label>
                              </div>
                              <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                                <div className="text-xs font-extrabold uppercase tracking-[0.1em] text-black/40">
                                  Режим работы
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        mode: "dry_run",
                                      })
                                    }
                                    className={`rounded-2xl border p-4 text-left transition ${
                                      bidderDraft.mode === "dry_run"
                                        ? "border-amber-300 bg-amber-50"
                                        : "border-black/10 bg-white hover:border-amber-300/60"
                                    }`}
                                  >
                                    <div className="text-sm font-extrabold text-black">
                                      Dry-run
                                    </div>
                                    <div className="mt-1 text-xs font-semibold leading-5 text-black/55">
                                      Только расчёт позиции и рекомендуемой ставки внутри системы без боевого применения в Avito.
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBidderDraft({
                                        ...bidderDraft,
                                        mode: "live",
                                      })
                                    }
                                    className={`rounded-2xl border p-4 text-left transition ${
                                      bidderDraft.mode === "live"
                                        ? "border-blue-300 bg-blue-50"
                                        : "border-black/10 bg-white hover:border-blue-300/60"
                                    }`}
                                  >
                                    <div className="text-sm font-extrabold text-black">
                                      Live
                                    </div>
                                    <div className="mt-1 text-xs font-semibold leading-5 text-black/55">
                                      Режим боевой готовности: worker будет рассчитывать ставку как подготовленную к применению через Avito API.
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {bidderWizardStep === 4 && (
                            <div>
                              <div className="badge-green mb-3">
                                Шаг 4 · Проверка
                              </div>
                              <h4 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
                                Проверьте стратегию
                              </h4>
                              <div className="mt-5 space-y-3 rounded-3xl bg-black/[0.025] p-4 sm:p-5">
                                <div className="flex justify-between gap-4 border-b border-black/7 pb-3 text-sm">
                                  <span className="text-black/45">
                                    Объявление
                                  </span>
                                  <span className="text-right font-extrabold text-black">
                                    {bidderDraft.title}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 border-b border-black/7 pb-3 text-sm">
                                  <span className="text-black/45">Поиск</span>
                                  <span className="text-right font-extrabold text-black">
                                    {bidderDraft.query} · {bidderDraft.city}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 border-b border-black/7 pb-3 text-sm">
                                  <span className="text-black/45">Цель</span>
                                  <span className="font-extrabold text-[#028c36]">
                                    Позиции {bidderDraft.targetFrom}–
                                    {bidderDraft.targetTo}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 border-b border-black/7 pb-3 text-sm">
                                  <span className="text-black/45">Ставка</span>
                                  <span className="font-extrabold text-black">
                                    {formatMoney(bidderDraft.minBid)}–
                                    {formatMoney(bidderDraft.maxBid)} ₽
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 text-sm">
                                  <span className="text-black/45">Режим</span>
                                  <span
                                    className={`font-extrabold ${
                                      bidderDraft.mode === "live"
                                        ? "text-blue-700"
                                        : "text-amber-700"
                                    }`}
                                  >
                                    {bidderDraft.mode === "live"
                                      ? "Live"
                                      : "Dry-run"}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                                <b>Режим работы.</b> В dry-run система только рассчитывает позицию и рекомендуемую ставку внутри платформы. В live режиме бидер помечается как готовый к боевому применению через Avito API.
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col-reverse gap-2 border-t border-black/[0.07] p-5 sm:flex-row sm:justify-between sm:p-7">
                          <button
                            type="button"
                            onClick={() =>
                              bidderWizardStep === 1
                                ? setIsBidderWizardOpen(false)
                                : setBidderWizardStep((step) => step - 1)
                            }
                            className="rounded-xl px-4 py-3 text-sm font-extrabold text-black/55 transition hover:bg-black/[0.05]"
                          >
                            {bidderWizardStep === 1 ? "Отмена" : "Назад"}
                          </button>
                          {bidderWizardStep < 4 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setBidderWizardStep((step) => step + 1)
                              }
                              disabled={bidderWizardStep === 1 && !bidderDraft.avitoItemId}
                              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                              Продолжить
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={saveBidder}
                              disabled={bidderSaving}
                              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                              {editingBidderId
                                ? "Сохранить изменения"
                                : "Создать и запустить"}
                            </button>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSection === "popular-queries" && hasAccess && (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-[30px] bg-black p-4 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] sm:p-6 md:p-8">
                  <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <div className="mb-4 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100">
                        В разработке
                      </div>
                      <h2 className="text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                        Запросы по популярности
                        <span className="text-[#03bd48]"> Авито</span>
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">
                        Тестовый подбор связанных поисковых вариантов для работы
                        с запросами.
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
                          Полученные результаты выдачи «Запросы по популярности
                          Авито» могут быть недостоверными, неправильными,
                          неполными или не соответствовать действительности.
                        </p>
                        <p className="mt-2 text-sm font-bold text-amber-900">
                          Советуем дождаться окончания разработки данной услуги
                          перед принятием решений на основании результатов.
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
                        После запуска появятся пять тестовых вариантов с
                        дополнительными словами.
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
