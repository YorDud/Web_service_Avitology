"use client";

import { useMemo, useRef, useState } from "react";
import { dedupeKeywords, MAX_INPUT_CHARS, type KeywordResult } from "@/lib/keywords/dedupe";

/* =========================================================================
   УСЛУГА «КЛЮЧЕВЫЕ СЛОВА»
   -------------------------------------------------------------------------
   Вставляете набор словосочетаний — получаете список без повторов:
   общая часть остаётся один раз, у остальных строк остаётся только новое.
   Всё считается в браузере, на сервер ничего не отправляется.
   ========================================================================= */

function fallbackCopy(text: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function pluralLines(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "строка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "строки";
  return "строк";
}

function Toggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition"
      style={{
        borderColor: checked ? "rgba(3,189,72,0.45)" : "rgba(0,0,0,0.1)",
        background: checked ? "rgba(3,189,72,0.06)" : "#fff",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 shrink-0"
        style={{ width: 18, height: 18, accentColor: "#03bd48" }}
      />
      <span className="block" style={{ minWidth: 0, flex: "1 1 0%" }}>
        <span className="block text-[13px] font-extrabold leading-5 text-black" style={{ overflowWrap: "break-word" }}>{title}</span>
        <span className="mt-0.5 block text-xs leading-[1.35] text-black/55" style={{ overflowWrap: "break-word" }}>{description}</span>
      </span>
    </label>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className="rounded-xl border px-3 py-2"
      style={{
        borderColor: accent ? "rgba(3,189,72,0.35)" : "rgba(0,0,0,0.08)",
        background: accent ? "rgba(3,189,72,0.08)" : "rgba(0,0,0,0.025)",
      }}
    >
      <div className="text-[10px] font-extrabold uppercase leading-4 tracking-[0.08em] text-black/45">{label}</div>
      <div className="text-xl font-extrabold leading-6 tracking-[-0.03em]" style={{ color: accent ? "#03a03c" : "#000" }}>
        {value.toLocaleString("ru-RU")}
      </div>
    </div>
  );
}

export default function KeywordsService() {
  const [input, setInput] = useState("");
  const [stripNumbers, setStripNumbers] = useState(true);
  const [matchWordForms, setMatchWordForms] = useState(true);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [stale, setStale] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [sourceMessage, setSourceMessage] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputLinesCount = useMemo(() => {
    if (!input.trim()) return 0;
    return input.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "").length;
  }, [input]);

  const outputText = useMemo(() => (result ? result.lines.join("\n") : ""), [result]);

  const markStale = () => {
    if (result) setStale(true);
  };

  const handleInput = (value: string) => {
    if (value.length > MAX_INPUT_CHARS) {
      setInput(value.slice(0, MAX_INPUT_CHARS));
      setSourceMessage(`Текст слишком длинный — оставили первые ${MAX_INPUT_CHARS.toLocaleString("ru-RU")} символов.`);
    } else {
      setInput(value);
      setSourceMessage("");
    }
    markStale();
  };

  const generate = () => {
    if (!input.trim()) {
      setResult(null);
      return;
    }
    setResult(dedupeKeywords(input, { stripNumbers, matchWordForms }));
    setStale(false);
    setCopied("idle");
  };

  const clearAll = () => {
    setInput("");
    setResult(null);
    setStale(false);
    setSourceMessage("");
    setCopied("idle");
  };

  const flashCopied = (state: "ok" | "fail") => {
    setCopied(state);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied("idle"), 2200);
  };

  const copyResult = async () => {
    if (!outputText) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(outputText);
        flashCopied("ok");
        return;
      }
    } catch {
      /* пробуем запасной способ */
    }
    flashCopied(fallbackCopy(outputText) ? "ok" : "fail");
  };

  const downloadResult = () => {
    if (!outputText) return;
    try {
      const blob = new Blob(["﻿" + outputText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "klyuchevye-slova.txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      flashCopied("fail");
    }
  };

  const stats = result?.stats;

  const areaStyle = {
    width: "100%",
    height: "clamp(150px, 30vh, 300px)",
    fontFamily: "inherit",
    overflowWrap: "break-word" as const,
    wordBreak: "normal" as const,
  };

  return (
    <div className="space-y-4">
      {/* ===== Шапка ===== */}
      <section className="relative overflow-hidden rounded-[28px] bg-[#101010] px-5 py-5 text-white shadow-[0_24px_65px_rgba(16,24,40,0.22)] sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#03bd48]/20 blur-3xl" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <span className="text-[#03bd48]">★</span>
            Бесплатный инструмент
          </div>
          <h2 className="text-2xl font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-4xl">
            Ключевые
            <span className="text-[#03bd48]"> слова</span>
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-white/62 sm:text-sm">
            Вставьте набор словосочетаний, например из Яндекс Вордстат: повторяющиеся части останутся один раз, в остальных
            строках будет только новое.
          </p>
        </div>
      </section>

      {/* ===== Рабочая область ===== */}
      <section className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        {/* Ввод */}
        <div
          className="flex flex-col rounded-[26px] border border-black/[0.08] bg-white p-4 shadow-[0_18px_45px_rgba(16,24,40,0.07)] sm:p-5"
          style={{ minWidth: 0 }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <label htmlFor="keywords-input" className="text-base font-extrabold tracking-[-0.02em] text-black">
              Набор словосочетаний
            </label>
            <span className="text-xs font-semibold text-black/45">
              {inputLinesCount.toLocaleString("ru-RU")} {pluralLines(inputLinesCount)}
            </span>
          </div>

          <textarea
            id="keywords-input"
            value={input}
            onChange={(event) => handleInput(event.target.value)}
            spellCheck={false}
            placeholder={"ремонт стиральных машин\nремонт стиральных машин в Москве\nремонт стиральных машин качественно"}
            className="mt-2.5 block w-full resize-y rounded-2xl border border-black/10 bg-[#fafafa] px-3.5 py-2.5 text-base leading-6 text-black outline-none transition focus:border-[#03bd48] focus:bg-white focus:ring-4 focus:ring-[#03bd48]/15"
            style={areaStyle}
          />
          {sourceMessage && <div className="mt-1.5 text-xs font-semibold text-amber-700">{sourceMessage}</div>}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Toggle
              checked={stripNumbers}
              onChange={(value) => {
                setStripNumbers(value);
                markStale();
              }}
              title="Убрать числа из слов"
              description="Числа в конце строки из Вордстата («210 478») удалятся."
            />
            <Toggle
              checked={matchWordForms}
              onChange={(value) => {
                setMatchWordForms(value);
                markStale();
              }}
              title="Учитывать окончания"
              description="«Ремонт» и «ремонту» — одно слово."
            />
          </div>

          <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.6fr)" }}>
            <button
              type="button"
              onClick={generate}
              disabled={!input.trim()}
              className="btn-primary inline-flex items-center justify-center gap-2"
              style={{ opacity: input.trim() ? 1 : 0.5, cursor: input.trim() ? "pointer" : "not-allowed" }}
            >
              Сгенерировать
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={!input && !result}
              className="btn-secondary inline-flex items-center justify-center gap-2"
              style={{ opacity: input || result ? 1 : 0.5 }}
            >
              Очистить
            </button>
          </div>
        </div>

        {/* Результат */}
        <div
          className="flex flex-col rounded-[26px] border border-black/[0.08] bg-white p-4 shadow-[0_18px_45px_rgba(16,24,40,0.07)] sm:p-5"
          style={{ minWidth: 0 }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <label htmlFor="keywords-output" className="text-base font-extrabold tracking-[-0.02em] text-black">
              Список без повторов
            </label>
            {result && (
              <span className="text-xs font-semibold text-black/45">
                {result.stats.outputLines.toLocaleString("ru-RU")} {pluralLines(result.stats.outputLines)}
              </span>
            )}
          </div>

          {stale && result && (
            <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
              Данные изменились — нажмите «Сгенерировать», чтобы обновить.
            </div>
          )}

          <textarea
            id="keywords-output"
            readOnly
            value={outputText}
            onFocus={(event) => event.currentTarget.select()}
            spellCheck={false}
            placeholder="Здесь появится результат после нажатия «Сгенерировать»"
            className="mt-2.5 block w-full resize-y rounded-2xl border border-[#03bd48]/35 bg-[#03bd48]/[0.04] px-3.5 py-2.5 text-base leading-6 text-black outline-none"
            style={areaStyle}
          />
          {result && result.lines.length === 0 && (
            <div className="mt-1.5 text-xs font-semibold text-black/50">В тексте не нашлось слов.</div>
          )}

          {result && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="Повторов убрано" value={result.stats.duplicatesRemoved} accent />
              <Stat label="Чисел убрано" value={result.stats.numbersStripped} />
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={copyResult}
              disabled={!outputText}
              className="btn-primary inline-flex items-center justify-center gap-2"
              style={{ opacity: outputText ? 1 : 0.5 }}
            >
              {copied === "ok" ? "Скопировано ✓" : copied === "fail" ? "Не вышло" : "Скопировать"}
            </button>
            <button
              type="button"
              onClick={downloadResult}
              disabled={!outputText}
              className="btn-secondary inline-flex items-center justify-center gap-2"
              style={{ opacity: outputText ? 1 : 0.5 }}
            >
              Скачать .txt
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
