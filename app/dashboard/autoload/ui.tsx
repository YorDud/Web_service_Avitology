"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/* Общие мелочи интерфейса услуги «Автозагрузка объявлений Авито». */

// ---------- Запросы к API ----------
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(url: string, options: { method?: string; json?: unknown } = {}): Promise<T> {
  const hasBody = options.json !== undefined;
  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? (hasBody ? "POST" : "GET"),
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options.json) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверьте интернет и повторите.", 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error || "Не удалось выполнить запрос.", response.status, data?.code);
  }
  return data as T;
}

export function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Что-то пошло не так.";
}

// ---------- Форматирование ----------
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function timeAgo(value: string | null | undefined) {
  if (!value) return null;
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return null;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.round(hours / 24)} дн назад`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function downloadFile(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** То же самое для бинарных файлов (например, .xlsx, собранный библиотекой xlsx). */
export function downloadBinary(data: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------- Стили ----------
export const inputClass =
  "w-full min-w-0 flex-1 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm font-semibold text-black outline-none transition placeholder:font-medium placeholder:text-black/30 focus:border-[#03bd48] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

export const cellInputClass =
  "w-full min-w-0 truncate text-ellipsis rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-black outline-none transition placeholder:font-medium placeholder:text-black/25 hover:border-black/10 focus:border-[#03bd48] focus:bg-white";

export const ghostButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-extrabold text-black/70 transition hover:-translate-y-0.5 hover:border-[#03bd48]/50 hover:text-[#028c36] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

export const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-extrabold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

export function AutoloadStyles() {
  return (
    <style>{`
      @keyframes al-pop { from { opacity: 0; transform: translateY(12px) scale(.97); } to { opacity: 1; transform: none; } }
      @keyframes al-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes al-flow { from { background-position: 0 0; } to { background-position: 28px 0; } }
      @keyframes al-dot { 0% { left: 0; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { left: calc(100% - 10px); opacity: 0; } }
      @keyframes al-pulse { 0% { box-shadow: 0 0 0 0 rgba(3,189,72,.45); } 100% { box-shadow: 0 0 0 14px rgba(3,189,72,0); } }
      @keyframes al-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      @keyframes al-sheet { from { opacity: 0; transform: translateY(24px) scale(.98); } to { opacity: 1; transform: none; } }
      .al-pop { animation: al-pop .45s cubic-bezier(.22,1,.36,1) both; }
      .al-fade { animation: al-fade .25s ease-out both; }
      .al-sheet { animation: al-sheet .35s cubic-bezier(.22,1,.36,1) both; }
      .al-pulse { animation: al-pulse 1.6s ease-out infinite; }
      .al-wire {
        height: 2px; width: 22px; flex: none; position: relative;
        background-image: linear-gradient(90deg, rgba(255,255,255,.35) 50%, transparent 50%);
        background-size: 14px 2px; animation: al-flow .9s linear infinite;
      }
      .al-wire::after {
        content: ""; position: absolute; top: -4px; left: 0; width: 10px; height: 10px; border-radius: 999px;
        background: #03bd48; box-shadow: 0 0 14px 3px rgba(3,189,72,.7); animation: al-dot 2.2s ease-in-out infinite;
      }
      .al-skeleton {
        background: linear-gradient(90deg, rgba(0,0,0,.05) 25%, rgba(0,0,0,.09) 50%, rgba(0,0,0,.05) 75%);
        background-size: 200% 100%; animation: al-shimmer 1.4s linear infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .al-pop, .al-fade, .al-sheet, .al-pulse, .al-wire, .al-wire::after, .al-skeleton { animation: none !important; }
      }
    `}</style>
  );
}

// ---------- Иконки ----------
const ICONS: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12M9 7V4.5A.5.5 0 0 1 9.5 4h5a.5.5 0 0 1 .5.5V7" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  back: <path d="M15 5l-7 7 7 7" />,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z" /><path d="M4 5.5v16M9 8h6" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14-4L4 9" /><path d="M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2" /><path d="M20 20v-5h-5" /></>,
  play: <path d="M8 5v14l11-7Z" />,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M5 20h14" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></>,
  warning: <><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17v.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l3 3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6.5 6.5 2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" /></>,
  file: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  columns: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>,
};

export function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name] ?? null}
    </svg>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

// ---------- Блоки ----------
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[#03bd48]" : "bg-black/15"
      }`}
    >
      <span
        className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

export function Pill({
  tone,
  children,
  className = "",
}: {
  tone: "green" | "red" | "amber" | "gray" | "black";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    green: "bg-[#03bd48]/12 text-[#027a30]",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-black/[0.06] text-black/55",
    black: "bg-black text-white",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Выпадающий список с поиском по вводу — как обычный select, но с полем
 * фильтрации, когда вариантов много (категории, значения из каталога Авито).
 * Значение всегда одно из options; свободный текст не сохраняется.
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Начните вводить…",
  emptyText = "Ничего не найдено",
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((option) => option.label.toLowerCase().includes(q)) : options;
    return list.slice(0, 300);
  }, [options, query]);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={open ? query : (selected?.label ?? value)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        placeholder={placeholder}
        className={className ?? inputClass}
      />
      {open && (
        <div className="absolute z-40 mt-1.5 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-2xl border border-black/10 bg-white p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.16)]">
          {filtered.length === 0 && <div className="px-3 py-2.5 text-sm font-semibold text-black/40">{emptyText}</div>}
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setQuery("");
                setOpen(false);
              }}
              className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-black/[0.05] ${
                option.value === value ? "bg-[#03bd48]/10 text-[#028c36]" : "text-black/75"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                {option.hint && <span className="mt-0.5 block truncate text-xs font-medium text-black/40">{option.hint}</span>}
              </span>
              {option.value === value && <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-black/[0.06] px-3 py-2.5 text-left text-xs font-bold text-black/40 transition hover:bg-black/[0.04]"
            >
              <Icon name="close" className="h-3 w-3" /> Очистить
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SectionTitle({ badge, title, right }: { badge: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="badge-green mb-3">{badge}</div>
        <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black md:text-3xl">{title}</h3>
      </div>
      {right}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="al-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`al-sheet flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:rounded-[28px] ${
          wide ? "sm:max-w-4xl" : "sm:max-w-2xl"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/[0.08] p-5 sm:p-6">
          <div className="min-w-0">
            <h4 className="text-xl font-extrabold tracking-[-0.03em] text-black">{title}</h4>
            {subtitle && <p className="mt-1 text-sm leading-6 text-black/50">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 text-black/55 transition hover:border-[#03bd48]/50 hover:text-[#028c36]"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-black/[0.08] bg-black/[0.02] p-4 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Уведомления ----------
export function useToast() {
  const [items, setItems] = useState<{ id: number; kind: "ok" | "error"; text: string }[]>([]);
  const counter = useRef(0);

  const push = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    counter.current += 1;
    const id = counter.current;
    setItems((current) => [...current.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);

  const node = (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`al-pop pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-[0_18px_40px_rgba(0,0,0,0.18)] ${
            item.kind === "ok"
              ? "border-[#03bd48]/30 bg-black text-white"
              : "border-red-200 bg-white text-red-600"
          }`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              item.kind === "ok" ? "bg-[#03bd48] text-white" : "bg-red-100 text-red-600"
            }`}
          >
            <Icon name={item.kind === "ok" ? "check" : "warning"} className="h-3 w-3" />
          </span>
          <span className="leading-5">{item.text}</span>
        </div>
      ))}
    </div>
  );

  return { push, node };
}
