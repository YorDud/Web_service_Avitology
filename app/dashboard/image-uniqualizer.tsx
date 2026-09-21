"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

/* =========================================================================
   УСЛУГА «УНИКАЛИЗАТОР КАРТИНОК» (07)
   -------------------------------------------------------------------------
   Отдельный самодостаточный компонент. Подключается в dashboard-client.tsx:

     import ImageUniqualizerService from "./image-uniqualizer";
     ...
     {activeSection === "image-uniqualizer" && <ImageUniqualizerService />}

   Вся обработка выполняется в браузере пользователя (Canvas API):
   файлы никуда не отправляются, серверная часть и новые зависимости
   не нужны. ZIP-архив собирается встроенной функцией ниже.
   ========================================================================= */

// ========== ТИПЫ И НАСТРОЙКИ ==========
type Strength = "light" | "medium" | "strong";
type OutputFormat = "jpeg" | "png" | "webp";

type Settings = {
  strength: Strength;
  variants: number;
  format: OutputFormat;
  quality: number;
  maxSide: number;
  noise: boolean;
  geometry: boolean;
  color: boolean;
  mirror: boolean;
};

type SourceImage = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
};

type ResultImage = {
  id: string;
  sourceName: string;
  name: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  difference: number;
};

type RenderedVariant = {
  blob: Blob;
  ext: string;
  width: number;
  height: number;
  difference: number;
};

const MAX_FILES = 30;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_VARIANTS = 10;
const MAX_TOTAL_RESULTS = 120;

const DEFAULT_SETTINGS: Settings = {
  strength: "medium",
  variants: 3,
  format: "jpeg",
  quality: 92,
  maxSide: 2048,
  noise: true,
  geometry: true,
  color: true,
  mirror: false,
};

// Параметры силы уникализации (доли: 0.01 = 1%).
const STRENGTH_PRESETS: Record<
  Strength,
  {
    cropMin: number;
    cropMax: number;
    rotate: number;
    bright: number;
    contrast: number;
    saturation: number;
    noise: number;
  }
> = {
  light: {
    cropMin: 0.004,
    cropMax: 0.012,
    rotate: 0.25,
    bright: 0.015,
    contrast: 0.015,
    saturation: 0.02,
    noise: 1.6,
  },
  medium: {
    cropMin: 0.008,
    cropMax: 0.022,
    rotate: 0.6,
    bright: 0.03,
    contrast: 0.03,
    saturation: 0.04,
    noise: 3,
  },
  strong: {
    cropMin: 0.015,
    cropMax: 0.035,
    rotate: 1.2,
    bright: 0.05,
    contrast: 0.05,
    saturation: 0.07,
    noise: 5,
  },
};

const MAX_SIDE_OPTIONS = [
  { value: 0, label: "Оригинальный размер" },
  { value: 2560, label: "До 2560 px" },
  { value: 2048, label: "До 2048 px" },
  { value: 1600, label: "До 1600 px" },
  { value: 1280, label: "До 1280 px" },
];

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter}`;
}

function plural(count: number, forms: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function sanitizeBaseName(fileName: string) {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return cleaned || "image";
}

function createRng() {
  const seed = new Uint32Array(1);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(seed);
  } else {
    seed[0] = (Math.random() * 0xffffffff) >>> 0;
  }
  let state = seed[0];

  // mulberry32 — быстрый генератор, каждая копия получает свой seed.
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createNoiseTable(rng: () => number, amplitude: number) {
  const table = new Float32Array(4096);
  for (let i = 0; i < table.length; i += 1) {
    const u = Math.max(rng(), 1e-9);
    const v = rng();
    table[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * amplitude;
  }
  return table;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("не удалось сохранить изображение"));
      },
      type,
      quality,
    );
  });
}

// Насколько результат отличается от оригинала (средняя разница яркости
// на уменьшенной копии, в процентах). Это индикатор, а не гарантия.
function measureDifference(source: ImageBitmap, result: HTMLCanvasElement) {
  const size = 48;
  const a = document.createElement("canvas");
  const b = document.createElement("canvas");
  a.width = size;
  a.height = size;
  b.width = size;
  b.height = size;

  const ctxA = a.getContext("2d", { willReadFrequently: true });
  const ctxB = b.getContext("2d", { willReadFrequently: true });
  if (!ctxA || !ctxB) return 0;

  ctxA.imageSmoothingQuality = "high";
  ctxB.imageSmoothingQuality = "high";
  ctxA.fillStyle = "#fff";
  ctxA.fillRect(0, 0, size, size);
  ctxA.drawImage(source, 0, 0, size, size);
  ctxB.drawImage(result, 0, 0, size, size);

  const dataA = ctxA.getImageData(0, 0, size, size).data;
  const dataB = ctxB.getImageData(0, 0, size, size).data;
  let total = 0;

  for (let i = 0; i < dataA.length; i += 4) {
    const lumaA = 0.299 * dataA[i] + 0.587 * dataA[i + 1] + 0.114 * dataA[i + 2];
    const lumaB = 0.299 * dataB[i] + 0.587 * dataB[i + 1] + 0.114 * dataB[i + 2];
    total += Math.abs(lumaA - lumaB);
  }

  return (total / (size * size) / 255) * 100;
}

// ========== ОБРАБОТКА ОДНОЙ КОПИИ ==========
async function renderVariant(
  bitmap: ImageBitmap,
  settings: Settings,
): Promise<RenderedVariant> {
  const rng = createRng();
  const preset = STRENGTH_PRESETS[settings.strength];
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  const scale =
    settings.maxSide > 0 ? Math.min(1, settings.maxSide / Math.max(srcW, srcH)) : 1;
  const outW = Math.max(16, Math.round(srcW * scale));
  const outH = Math.max(16, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas недоступен в этом браузере");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  // 1. Микро-обрезка и поворот
  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;
  let angle = 0;
  let cover = 1;

  if (settings.geometry) {
    const zoom = 1 + preset.cropMin + rng() * (preset.cropMax - preset.cropMin);
    angle = (rng() * 2 - 1) * preset.rotate * (Math.PI / 180);
    sw = srcW / zoom;
    sh = srcH / zoom;
    sx = rng() * (srcW - sw);
    sy = rng() * (srcH - sh);

    // Небольшое увеличение, чтобы после поворота не появились пустые углы.
    const ratio = Math.max(outW / outH, outH / outW);
    cover = Math.cos(Math.abs(angle)) + Math.sin(Math.abs(angle)) * ratio;
  }

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(angle);
  ctx.scale((settings.mirror ? -1 : 1) * cover, cover);
  ctx.drawImage(bitmap, sx, sy, sw, sh, -outW / 2, -outH / 2, outW, outH);
  ctx.restore();

  // 2. Цвет и шум на уровне пикселей
  if (settings.color || settings.noise) {
    const image = ctx.getImageData(0, 0, outW, outH);
    const data = image.data;

    const colorOn = settings.color;
    const noiseOn = settings.noise;
    const brightness = colorOn ? (rng() * 2 - 1) * preset.bright * 255 : 0;
    const contrast = colorOn ? 1 + (rng() * 2 - 1) * preset.contrast : 1;
    const saturation = colorOn ? 1 + (rng() * 2 - 1) * preset.saturation : 1;
    const table = createNoiseTable(rng, noiseOn ? preset.noise : 0);
    let state = ((rng() * 0xffffffff) | 0) || 123456789;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (colorOn) {
        r = (r - 128) * contrast + 128 + brightness;
        g = (g - 128) * contrast + 128 + brightness;
        b = (b - 128) * contrast + 128 + brightness;
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        r = luma + (r - luma) * saturation;
        g = luma + (g - luma) * saturation;
        b = luma + (b - luma) * saturation;
      }

      if (noiseOn) {
        // xorshift32: быстрый индекс в таблице гауссова шума
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        const luminanceNoise = table[state >>> 20];
        const chromaNoise = table[(state >>> 8) & 4095] * 0.35;
        r += luminanceNoise + chromaNoise;
        g += luminanceNoise;
        b += luminanceNoise - chromaNoise;
      }

      // Uint8ClampedArray сам ограничивает значения 0–255 и округляет.
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    ctx.putImageData(image, 0, 0);
  }

  // 3. Сохранение. Пересохранение через Canvas удаляет EXIF, GPS и прочие метаданные.
  const mime =
    settings.format === "png"
      ? "image/png"
      : settings.format === "webp"
        ? "image/webp"
        : "image/jpeg";

  const blob = await canvasToBlob(canvas, mime, settings.quality / 100);
  const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
  const difference = measureDifference(bitmap, canvas);

  return { blob, ext, width: outW, height: outH, difference };
}

// ========== СБОРКА ZIP (без сжатия, без сторонних библиотек) ==========
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function buildZip(files: { name: string; blob: Blob }[]) {
  const encoder = new TextEncoder();
  const parts: (ArrayBuffer | Blob)[] = [];
  const central: ArrayBuffer[] = [];

  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const usedNames = new Set<string>();
  let offset = 0;

  for (const file of files) {
    let name = file.name;
    if (usedNames.has(name)) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let counter = 2;
      while (usedNames.has(`${base}(${counter})${ext}`)) counter += 1;
      name = `${base}(${counter})${ext}`;
    }
    usedNames.add(name);

    const nameBytes = encoder.encode(name);
    const content = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(content);
    const size = content.length;

    const local = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(local);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 в именах файлов
    lv.setUint16(8, 0, true); // без сжатия
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    new Uint8Array(local).set(nameBytes, 30);

    const entry = new ArrayBuffer(46 + nameBytes.length);
    const ev = new DataView(entry);
    ev.setUint32(0, 0x02014b50, true);
    ev.setUint16(4, 20, true);
    ev.setUint16(6, 20, true);
    ev.setUint16(8, 0x0800, true);
    ev.setUint16(10, 0, true);
    ev.setUint16(12, dosTime, true);
    ev.setUint16(14, dosDate, true);
    ev.setUint32(16, crc, true);
    ev.setUint32(20, size, true);
    ev.setUint32(24, size, true);
    ev.setUint16(28, nameBytes.length, true);
    ev.setUint16(30, 0, true);
    ev.setUint16(32, 0, true);
    ev.setUint16(34, 0, true);
    ev.setUint16(36, 0, true);
    ev.setUint32(38, 0, true);
    ev.setUint32(42, offset, true);
    new Uint8Array(entry).set(nameBytes, 46);

    parts.push(local, file.blob);
    central.push(entry);
    offset += local.byteLength + size;
  }

  const centralSize = central.reduce((sum, item) => sum + item.byteLength, 0);
  const end = new ArrayBuffer(22);
  const dv = new DataView(end);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(4, 0, true);
  dv.setUint16(6, 0, true);
  dv.setUint16(8, files.length, true);
  dv.setUint16(10, files.length, true);
  dv.setUint32(12, centralSize, true);
  dv.setUint32(16, offset, true);
  dv.setUint16(20, 0, true);

  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ========== МЕЛКИЕ UI-КОМПОНЕНТЫ ==========
function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z" />
          <path d="M4 5.5v16" />
          <path d="M9 8h6" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 4v12" />
          <path d="m7 11 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <path d="m6.5 6.5 2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common} strokeWidth={2.7}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    default:
      return null;
  }
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-2xl bg-black/[0.05] p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-2 py-2.5 text-center text-sm font-extrabold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
              isActive
                ? "bg-[#03bd48] text-white shadow-[0_10px_22px_rgba(3,189,72,0.28)]"
                : "text-black/55 hover:bg-white hover:text-black"
            }`}
          >
            {option.label}
            {option.hint && (
              <span
                className={`mt-0.5 block text-[10px] font-semibold ${
                  isActive ? "text-white/80" : "text-black/40"
                }`}
              >
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300 disabled:cursor-not-allowed ${
        checked
          ? "border-[#03bd48]/30 bg-[#03bd48]/[0.05]"
          : "border-black/[0.08] bg-white hover:border-black/20"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-black">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-black/50">{description}</span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${
          checked ? "bg-[#03bd48]" : "bg-black/15"
        }`}
      >
        <span
          className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function DemoPhoto({ gradientId }: { gradientId: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334155" />
          <stop offset="1" stopColor="#f0b978" />
        </linearGradient>
      </defs>
      <rect width="160" height="120" fill={`url(#${gradientId})`} />
      <circle cx="112" cy="46" r="15" fill="#fff3d6" opacity="0.92" />
      <path d="M0 98 38 58l26 26 32-34 64 54v18H0Z" fill="#17241e" />
      <path d="M0 110l46-30 40 24 40-26 34 22v20H0Z" fill="#03bd48" opacity="0.88" />
    </svg>
  );
}

// ========== ОСНОВНОЙ КОМПОНЕНТ ==========
export default function ImageUniqualizerService() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef(false);
  const mountedRef = useRef(true);
  const urlsRef = useRef<Set<string>>(new Set());
  const sourcesRef = useRef<SourceImage[]>([]);

  const [sources, setSources] = useState<SourceImage[]>([]);
  const [results, setResults] = useState<ResultImage[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  // Освобождаем ссылки на превью при закрытии раздела.
  useEffect(() => {
    const urls = urlsRef.current;
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cancelRef.current = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const trackUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }, []);

  const releaseUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    urlsRef.current.delete(url);
  }, []);

  const updateSettings = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  // ---------- Добавление файлов ----------
  const addFiles = useCallback(
    async (incoming: File[]) => {
      const notes: string[] = [];
      const accepted: SourceImage[] = [];
      const existing = sourcesRef.current;

      for (const file of incoming) {
        if (!file.type.startsWith("image/")) {
          notes.push(`«${file.name}» — это не изображение.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          notes.push(`«${file.name}» больше 25 МБ.`);
          continue;
        }
        const isDuplicate = [...existing, ...accepted].some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified,
        );
        if (isDuplicate) continue;

        if (existing.length + accepted.length >= MAX_FILES) {
          notes.push(`Можно загрузить не больше ${MAX_FILES} фото за раз.`);
          break;
        }

        try {
          const bitmap = await createImageBitmap(file);
          const width = bitmap.width;
          const height = bitmap.height;
          bitmap.close();
          accepted.push({ id: nextId(), file, url: trackUrl(file), width, height });
        } catch {
          notes.push(`«${file.name}» не удалось открыть. Подойдут JPG, PNG и WEBP.`);
        }
      }

      if (!mountedRef.current) {
        accepted.forEach((item) => URL.revokeObjectURL(item.url));
        return;
      }

      if (accepted.length > 0) {
        setSources((current) => [...current, ...accepted]);
      }
      setNotice(Array.from(new Set(notes)).join(" "));
    },
    [trackUrl],
  );

  // Вставка изображения из буфера обмена (Ctrl+V)
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) return;
      event.preventDefault();
      void addFiles(files);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const openFileDialog = () => fileInputRef.current?.click();

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) void addFiles(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) void addFiles(files);
  };

  const handleDropzoneKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFileDialog();
    }
  };

  const removeSource = (id: string) => {
    setSources((current) => {
      const target = current.find((item) => item.id === id);
      if (target) releaseUrl(target.url);
      return current.filter((item) => item.id !== id);
    });
  };

  const clearSources = () => {
    sources.forEach((item) => releaseUrl(item.url));
    setSources([]);
    setNotice("");
  };

  const clearResults = () => {
    results.forEach((item) => releaseUrl(item.url));
    setResults([]);
    setProblems([]);
    setHasStarted(false);
    setProgress({ done: 0, total: 0 });
  };

  // ---------- Запуск обработки ----------
  const totalCopies = sources.length * settings.variants;
  const isOverLimit = totalCopies > MAX_TOTAL_RESULTS;

  const handleProcess = async () => {
    if (isProcessing || sources.length === 0 || isOverLimit) return;

    const snapshot: Settings = { ...settings };
    const queue = [...sources];
    const total = queue.length * snapshot.variants;

    results.forEach((item) => releaseUrl(item.url));
    setResults([]);
    setProblems([]);
    setNotice("");
    setHasStarted(true);
    setProgress({ done: 0, total });
    setIsProcessing(true);
    cancelRef.current = false;

    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    const errors: string[] = [];
    let done = 0;

    for (const source of queue) {
      if (cancelRef.current) break;

      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(source.file);
      } catch {
        errors.push(`«${source.file.name}»: не удалось открыть изображение.`);
        done += snapshot.variants;
        if (mountedRef.current) setProgress({ done, total });
        continue;
      }

      const baseName = sanitizeBaseName(source.file.name);

      for (let variant = 1; variant <= snapshot.variants; variant += 1) {
        if (cancelRef.current) break;

        try {
          const rendered = await renderVariant(bitmap, snapshot);
          if (!mountedRef.current) {
            bitmap.close();
            return;
          }

          const item: ResultImage = {
            id: nextId(),
            sourceName: source.file.name,
            name: `${baseName}_uniq-${String(variant).padStart(2, "0")}.${rendered.ext}`,
            blob: rendered.blob,
            url: trackUrl(rendered.blob),
            width: rendered.width,
            height: rendered.height,
            difference: rendered.difference,
          };
          setResults((current) => [...current, item]);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "ошибка обработки";
          errors.push(`«${source.file.name}», копия ${variant}: ${reason}.`);
        }

        done += 1;
        if (mountedRef.current) setProgress({ done, total });

        // Отдаём управление браузеру, чтобы интерфейс не зависал.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }

      bitmap.close();
    }

    if (!mountedRef.current) return;
    setProblems(errors);
    setIsProcessing(false);
  };

  const handleStop = () => {
    cancelRef.current = true;
  };

  const handleDownloadZip = async () => {
    if (results.length === 0 || isZipping) return;
    setIsZipping(true);
    try {
      const zip = await buildZip(results.map((item) => ({ name: item.name, blob: item.blob })));
      const stamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace("T", "_")
        .replace(":", "-");
      downloadBlob(zip, `helpsell-uniqualizer_${stamp}.zip`);
    } catch {
      setProblems((current) => [...current, "Не удалось собрать ZIP-архив. Скачайте файлы по одному."]);
    } finally {
      if (mountedRef.current) setIsZipping(false);
    }
  };

  const toggleGuide = () => {
    setIsGuideOpen((current) => {
      const next = !current;
      if (next) {
        window.setTimeout(() => {
          guideRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 120);
      }
      return next;
    });
  };

  const resultsTotalSize = useMemo(
    () => results.reduce((sum, item) => sum + item.blob.size, 0),
    [results],
  );

  const progressPercent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const showResults = hasStarted || results.length > 0;

  const guideSteps = [
    {
      title: "Загрузите фото",
      text: "Перетащите файлы в область загрузки, нажмите на неё или вставьте изображение из буфера через Ctrl+V. До 30 файлов JPG, PNG или WEBP, каждый до 25 МБ.",
    },
    {
      title: "Выберите силу",
      text: "«Лёгкая» почти не меняет картинку, «Средняя» подходит в большинстве случаев, «Сильная» заметнее меняет кадр и цвет.",
    },
    {
      title: "Задайте число копий",
      text: "От 1 до 10 копий каждого фото. Для каждой копии параметры подбираются случайно, поэтому все копии отличаются друг от друга.",
    },
    {
      title: "Скачайте результат",
      text: "Сохраните каждую копию отдельно или заберите всё одним ZIP-архивом кнопкой «Скачать всё».",
    },
  ];

  const guideMethods = [
    ["Метаданные", "EXIF, GPS, модель камеры и другие служебные данные удаляются при пересохранении. Это происходит всегда."],
    ["Шум", "На изображение накладывается едва заметный случайный шум."],
    ["Обрезка и поворот", "Кадр слегка приближается и поворачивается (не более чем на 1,2°). Пропорции сохраняются."],
    ["Цвет", "Яркость, контраст и насыщенность меняются на доли процента."],
    ["Отражение", "Зеркалит фото по горизонтали. Не включайте, если на снимке есть текст, логотипы или надписи."],
  ];

  const guideTips = [
    "Загружайте оригиналы: фото, уже сжатые мессенджером, теряют качество.",
    "Для объявлений подходит JPG с качеством 90–95: хороший вид и небольшой вес.",
    "Для каждого объявления берите отдельную копию, а не одну и ту же.",
    "Прозрачные области PNG заменяются белым фоном.",
    "Обработка идёт на вашем устройстве. Крупные фото на слабом телефоне обрабатываются дольше.",
  ];

  return (
    <div className="flex flex-col">
      {/* Стили и анимации услуги «Уникализатор картинок» */}
      <style>{`
        @keyframes iu-grain {
          0% { transform: translate(0, 0); }
          20% { transform: translate(-4%, 3%); }
          40% { transform: translate(3%, -4%); }
          60% { transform: translate(-2%, -3%); }
          80% { transform: translate(4%, 2%); }
          100% { transform: translate(0, 0); }
        }
        @keyframes iu-scan {
          0% { top: -6%; opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { top: 104%; opacity: 0; }
        }
        @keyframes iu-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes iu-pop {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes iu-shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @keyframes iu-ring {
          0% { box-shadow: 0 0 0 0 rgba(3, 189, 72, 0.35); }
          100% { box-shadow: 0 0 0 20px rgba(3, 189, 72, 0); }
        }
        .iu-grain {
          position: absolute;
          inset: -20%;
          pointer-events: none;
          opacity: 0.32;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          animation: iu-grain 0.9s steps(5) infinite;
        }
        .iu-scanline {
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, #03bd48, transparent);
          box-shadow: 0 0 18px 4px rgba(3, 189, 72, 0.55);
          animation: iu-scan 2.8s ease-in-out infinite;
        }
        .iu-float { animation: iu-float 3.2s ease-in-out infinite; }
        .iu-pop { animation: iu-pop 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .iu-ring { animation: iu-ring 1.1s ease-out infinite; }
        .iu-shimmer {
          background-image: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: iu-shimmer 1.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .iu-grain, .iu-scanline, .iu-float, .iu-pop, .iu-ring, .iu-shimmer {
            animation: none !important;
          }
        }
      `}</style>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {/* ===== HERO ===== */}
      <section className="overflow-hidden rounded-[30px] bg-black p-4 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] sm:p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                        <span className="text-[#03bd48]">★</span>
                        Бесплатный инструмент
                      </div>
            <h2 className="text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
              Уникализатор
              <span className="text-[#03bd48]"> картинок</span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/62">
              Создавайте уникальные копии фотографий для объявлений.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openFileDialog}
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                <Icon name="upload" className="h-9 w-7" />
                Загрузить фото
              </button>
              <button
                type="button"
                onClick={toggleGuide}
                aria-expanded={isGuideOpen}
                className="btn-secondary inline-flex items-center justify-center gap-2"
              >
                <Icon name="book" className="h-12 w-12" />
                {isGuideOpen ? "Скрыть инструкцию" : "Инструкция"}
              </button>
            </div>
          </div>

          {/* Демонстрация: оригинал и уникальная копия */}
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10">
                <DemoPhoto gradientId="iu-demo-a" />
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-extrabold text-white/85">
                  Оригинал
                </span>
              </div>

              <div className="iu-float flex h-9 w-9 items-center justify-center rounded-full bg-[#03bd48] text-white shadow-[0_10px_24px_rgba(3,189,72,0.4)]">
                <Icon name="sparkle" className="h-4 w-4" />
              </div>

              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#03bd48]/40">
                <DemoPhoto gradientId="iu-demo-b" />
                <div className="iu-grain" />
                <div className="iu-scanline" />
                <span className="absolute left-2 top-2 rounded-full bg-[#03bd48] px-2.5 py-1 text-[10px] font-extrabold text-white">
                  Копия
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {["Метаданные удалены", "Шум", "Обрезка и поворот", "Цвет"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white/75"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== ИНСТРУКЦИЯ ===== */}
      <div
        ref={guideRef}
        className={`grid transition-[grid-template-rows,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isGuideOpen ? "mt-6 grid-rows-[1fr]" : "mt-0 grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <section
            aria-hidden={!isGuideOpen}
            className={`overflow-hidden rounded-[28px] border border-[#03bd48]/20 bg-[linear-gradient(135deg,rgba(3,189,72,.09),rgba(255,255,255,1)_58%)] shadow-[0_18px_45px_rgba(16,24,40,.06)] transition-all duration-500 ${
              isGuideOpen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
            }`}
          >
            <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#027a30]/65">
                  Справка
                </div>
                <h3 className="mt-1 text-xl font-extrabold tracking-[-.03em] text-black">
                  Как пользоваться уникализатором
                </h3>
                <p className="mt-1 text-sm leading-6 text-black/55">
                  Четыре шага от загрузки до готовых файлов.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleGuide}
                tabIndex={isGuideOpen ? 0 : -1}
                aria-label="Скрыть инструкцию"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white text-black/60 transition hover:-translate-y-0.5 hover:border-[#03bd48]/50 hover:text-[#028c36]"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="border-t border-[#03bd48]/15 p-5 sm:p-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {guideSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded-2xl border border-black/[0.08] bg-white p-4"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-xs font-extrabold text-white">
                      {index + 1}
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-black">{step.title}</div>
                    <p className="mt-1.5 text-sm leading-6 text-black/60">{step.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5">
                  <div className="text-sm font-extrabold text-black">Что меняется в картинке</div>
                  <ul className="mt-3 space-y-3">
                    {guideMethods.map(([title, text]) => (
                      <li key={title} className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#03bd48]/12 text-[#028c36]">
                          <Icon name="check" className="h-3 w-3" />
                        </span>
                        <span className="text-sm leading-6 text-black/60">
                          <b className="text-black">{title}.</b> {text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5">
                  <div className="text-sm font-extrabold text-black">Советы</div>
                  <ul className="mt-3 space-y-2.5">
                    {guideTips.map((tip) => (
                      <li key={tip} className="flex gap-3 text-sm leading-6 text-black/60">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#03bd48]" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900/85">
                <b>Важно.</b> Показатель «Отличие от оригинала» отражает степень изменения
                картинки, но не гарантирует прохождение проверок площадок. Используйте только
                свои фотографии или те, на которые у вас есть права.
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ===== РАБОЧАЯ ОБЛАСТЬ ===== */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* --- Загрузка --- */}
        <section className="white-card min-w-0 p-5 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="badge-green mb-3">Шаг 1</div>
              <h3 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                Загрузите фото
              </h3>
            </div>
            {sources.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-black/45">
                  {sources.length} / {MAX_FILES}
                </span>
                <button
                  type="button"
                  onClick={clearSources}
                  disabled={isProcessing}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold text-black/65 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Очистить
                </button>
              </div>
            )}
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Область загрузки изображений"
            onClick={openFileDialog}
            onKeyDown={handleDropzoneKey}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-6 cursor-pointer rounded-3xl border-2 border-dashed p-6 text-center outline-none transition-all duration-300 focus-visible:border-[#03bd48] sm:p-8 ${
              isDragging
                ? "iu-ring scale-[1.015] border-[#03bd48] bg-[#03bd48]/[0.07]"
                : "border-black/15 bg-black/[0.02] hover:border-[#03bd48]/60 hover:bg-[#03bd48]/[0.035]"
            }`}
          >
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-300 ${
                isDragging ? "bg-[#03bd48] text-white" : "bg-[#03bd48]/10 text-[#028c36]"
              } ${isDragging ? "" : "iu-float"}`}
            >
              <Icon name="upload" className="h-6 w-6" />
            </div>
            <div className="mt-4 text-lg font-extrabold text-black">
              {isDragging ? "Отпустите, чтобы добавить" : "Перетащите фото сюда"}
            </div>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-black/50">
              или нажмите, чтобы выбрать файлы. Можно вставить из буфера через Ctrl+V.
            </p>
            <div className="mt-4 text-xs font-bold text-black/35">
              JPG, PNG, WEBP · до 25 МБ · до {MAX_FILES} файлов
            </div>
          </div>

          {notice && (
            <div className="iu-pop mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              {notice}
            </div>
          )}

          {sources.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sources.map((item) => (
                <div
                  key={item.id}
                  className="iu-pop group relative overflow-hidden rounded-2xl border border-black/[0.08] bg-white"
                >
                  <div className="aspect-square bg-black/[0.04]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.file.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-2.5">
                    <div className="truncate text-xs font-extrabold text-black" title={item.file.name}>
                      {item.file.name}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-black/40">
                      {item.width}×{item.height} · {formatBytes(item.file.size)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSource(item.id)}
                    disabled={isProcessing}
                    aria-label={`Убрать ${item.file.name}`}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-100 backdrop-blur transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* --- Настройки --- */}
        <section className="white-card min-w-0 p-5 md:p-8">
          <div className="badge-green mb-3">Шаг 2</div>
          <h3 className="text-3xl font-extrabold tracking-[-0.04em] text-black">Настройки</h3>

          <div className="mt-6 space-y-6">
            <div>
              <div className="mb-2 text-sm font-extrabold text-black">Сила уникализации</div>
              <Segmented<Strength>
                label="Сила уникализации"
                value={settings.strength}
                onChange={(value) => updateSettings("strength", value)}
                disabled={isProcessing}
                options={[
                  { value: "light", label: "Лёгкая", hint: "минимум" },
                  { value: "medium", label: "Средняя", hint: "оптимально" },
                  { value: "strong", label: "Сильная", hint: "заметнее" },
                ]}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-black">Копий каждого фото</div>
                <div className="text-xs font-bold text-black/40">от 1 до {MAX_VARIANTS}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updateSettings("variants", Math.max(1, settings.variants - 1))}
                  disabled={isProcessing || settings.variants <= 1}
                  aria-label="Меньше копий"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white text-xl font-extrabold text-black transition hover:border-[#03bd48]/50 hover:text-[#028c36] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <div className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-black text-2xl font-extrabold tabular-nums text-[#03bd48]">
                  {settings.variants}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings("variants", Math.min(MAX_VARIANTS, settings.variants + 1))
                  }
                  disabled={isProcessing || settings.variants >= MAX_VARIANTS}
                  aria-label="Больше копий"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white text-xl font-extrabold text-black transition hover:border-[#03bd48]/50 hover:text-[#028c36] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-extrabold text-black">Формат файла</div>
              <Segmented<OutputFormat>
                label="Формат файла"
                value={settings.format}
                onChange={(value) => updateSettings("format", value)}
                disabled={isProcessing}
                options={[
                  { value: "jpeg", label: "JPG", hint: "универсальный" },
                  { value: "png", label: "PNG", hint: "без потерь" },
                  { value: "webp", label: "WEBP", hint: "меньше вес" },
                ]}
              />

              <div
                className={`mt-4 transition-opacity duration-300 ${
                  settings.format === "png" ? "opacity-40" : "opacity-100"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="iu-quality" className="text-sm font-extrabold text-black">
                    Качество
                  </label>
                  <span className="text-sm font-extrabold tabular-nums text-[#028c36]">
                    {settings.quality}%
                  </span>
                </div>
                <input
                  id="iu-quality"
                  type="range"
                  min={70}
                  max={100}
                  step={1}
                  value={settings.quality}
                  disabled={isProcessing || settings.format === "png"}
                  onChange={(event) => updateSettings("quality", Number(event.target.value))}
                  className="w-full accent-[#03bd48]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="iu-max-side" className="mb-2 block text-sm font-extrabold text-black">
                Размер результата
              </label>
              <select
                id="iu-max-side"
                value={settings.maxSide}
                disabled={isProcessing}
                onChange={(event) => updateSettings("maxSide", Number(event.target.value))}
                className="w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3.5 text-sm font-bold outline-none transition focus:border-[#03bd48] focus:bg-white"
              >
                {MAX_SIDE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-3 rounded-2xl border border-[#03bd48]/25 bg-[#03bd48]/[0.06] p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#03bd48] text-white">
                  <Icon name="check" className="h-4 w-4" />
                </span>
                <span className="text-sm leading-5 text-black/70">
                  <b className="text-black">Метаданные удаляются всегда:</b> EXIF, GPS, модель
                  камеры.
                </span>
              </div>

              <ToggleRow
                checked={settings.noise}
                onChange={(value) => updateSettings("noise", value)}
                disabled={isProcessing}
                title="Шум"
                description="Едва заметные случайные точки по всему кадру"
              />
              <ToggleRow
                checked={settings.geometry}
                onChange={(value) => updateSettings("geometry", value)}
                disabled={isProcessing}
                title="Обрезка и поворот"
                description="Лёгкое приближение и наклон кадра"
              />
              <ToggleRow
                checked={settings.color}
                onChange={(value) => updateSettings("color", value)}
                disabled={isProcessing}
                title="Цвет"
                description="Яркость, контраст и насыщенность на доли процента"
              />
              <ToggleRow
                checked={settings.mirror}
                onChange={(value) => updateSettings("mirror", value)}
                disabled={isProcessing}
                title="Отразить по горизонтали"
                description="Не подходит для фото с текстом и логотипами"
              />
            </div>
          </div>

          <div className="mt-7 border-t border-black/[0.08] pt-6">
            {isOverLimit && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                За один запуск можно создать не больше {MAX_TOTAL_RESULTS} копий. Сейчас
                получается {totalCopies}: уберите часть фото или уменьшите число копий.
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleProcess()}
              disabled={sources.length === 0 || isProcessing || isOverLimit}
              className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Обрабатываем…
                </>
              ) : sources.length === 0 ? (
                "Сначала загрузите фото"
              ) : (
                `Создать ${totalCopies} ${plural(totalCopies, ["копию", "копии", "копий"])}`
              )}
            </button>
          </div>
        </section>
      </div>

      {/* ===== РЕЗУЛЬТАТ ===== */}
      {showResults && (
        <div ref={resultsRef} className="iu-pop mt-6 scroll-mt-6">
          <section className="overflow-hidden rounded-[30px] border border-black/[0.08] bg-white shadow-[0_18px_45px_rgba(16,24,40,.07)]">
            <div className="bg-black p-5 text-white sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-white/55">
                    Результат
                  </div>
                  <h3 className="mt-1 text-xl font-extrabold">
                    {isProcessing
                      ? `Готово ${progress.done} из ${progress.total}`
                      : results.length > 0
                        ? `${results.length} ${plural(results.length, ["копия готова", "копии готовы", "копий готово"])}`
                        : "Копии не созданы"}
                  </h3>
                  {results.length > 0 && (
                    <p className="mt-1 text-sm text-white/55">
                      Общий размер: {formatBytes(resultsTotalSize)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {isProcessing ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-white/20"
                    >
                      Остановить
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleDownloadZip()}
                        disabled={results.length === 0 || isZipping}
                        className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Icon name="download" className="h-4 w-4" />
                        {isZipping ? "Собираем архив…" : "Скачать всё (ZIP)"}
                      </button>
                      <button
                        type="button"
                        onClick={clearResults}
                        className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-white/20"
                      >
                        Очистить
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isProcessing && (
                <div className="mt-5">
                  <div
                    className="relative h-2.5 overflow-hidden rounded-full bg-white/10"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercent}
                  >
                    <div
                      className="relative h-full rounded-full bg-[#03bd48] transition-[width] duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    >
                      <div className="iu-shimmer absolute inset-0" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs font-bold text-white/45">{progressPercent}%</div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6">
              {problems.length > 0 && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="text-sm font-extrabold text-red-700">
                    Часть файлов не обработана
                  </div>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-red-700/85">
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results.length === 0 && !isProcessing && problems.length === 0 && (
                <div className="rounded-3xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-center text-sm font-semibold text-black/50">
                  Обработка была остановлена до создания первой копии.
                </div>
              )}

              {results.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {results.map((item) => (
                    <div
                      key={item.id}
                      className="iu-pop group overflow-hidden rounded-2xl border border-black/[0.08] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#03bd48]/35 hover:shadow-[0_16px_34px_rgba(3,189,72,0.12)]"
                    >
                      <div className="aspect-square bg-black/[0.04]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <div className="truncate text-xs font-extrabold text-black" title={item.name}>
                          {item.name}
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold text-black/40">
                          {item.width}×{item.height} · {formatBytes(item.blob.size)}
                        </div>

                        <div className="mt-2.5">
                          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.08em] text-black/40">
                            <span>Отличие</span>
                            <span className="text-[#028c36]">{item.difference.toFixed(1)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
                            <div
                              className="h-full rounded-full bg-[#03bd48] transition-[width] duration-700 ease-out"
                              style={{ width: `${Math.min(100, Math.max(4, item.difference * 12))}%` }}
                            />
                          </div>
                        </div>

                        <a
                          href={item.url}
                          download={item.name}
                          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-black px-3 py-2.5 text-xs font-extrabold !text-white transition hover:bg-[#03bd48]"
                        >
                          <Icon name="download" className="h-3.5 w-3.5" />
                          Скачать
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
// ========== КОНЕЦ УСЛУГИ «УНИКАЛИЗАТОР КАРТИНОК» ==========
