/**
 * Услуга «Ключевые слова»: убирает из набора словосочетаний повторяющиеся части.
 *
 * Принцип:
 *  1. Каждая строка делится на слова (буквы и цифры любых алфавитов, дефис внутри слова сохраняется).
 *  2. В конце строки по желанию убираются числа (частота из Яндекс Вордстат: «210 478»).
 *  3. Одинаковые строки схлопываются в одну.
 *  4. «Базовыми» считаются фразы, внутри которых нет других фраз из списка
 *     (например, «ремонт стиральных машин»).
 *  5. Из остальных строк базовые фразы вырезаются, остаётся только то, что нового:
 *       «ремонт стиральных машин на дому»  →  «на дому»
 *       «мастер по ремонту стиральных машин» →  «мастер по»
 *  6. Повторяющиеся остатки тоже убираются — каждое сочетание остаётся один раз.
 */

export type KeywordOptions = {
  /** Убирать числа в конце строки (частотность из Вордстата). */
  stripNumbers: boolean;
  /** Считать одинаковыми разные окончания слов: «ремонт» = «ремонту», «машин» = «машины». */
  matchWordForms: boolean;
};

export type KeywordStats = {
  inputLines: number;
  emptyLines: number;
  numbersStripped: number;
  duplicatesRemoved: number;
  cutLines: number;
  outputLines: number;
};

export type KeywordResult = {
  lines: string[];
  stats: KeywordStats;
};

export const MAX_INPUT_CHARS = 1_000_000;
const MAX_WORDS_PER_LINE = 40;
const SEP = "\u0001";

/** Слово: буквы/цифры любого алфавита, внутри допускаются дефис, апостроф и точка между буквами/цифрами (wi-fi, 3.5). */
const WORD_RE = /[\p{L}\p{N}\p{M}]+(?:[-'’.][\p{L}\p{N}\p{M}]+)*/gu;
const NUMBER_ONLY_RE = /^\p{N}+(?:[.,]\p{N}+)*$/u;

const RU_SUFFIXES = [
  "ыми", "ими", "ого", "его", "ому", "ему", "ая", "яя", "ою", "ею", "ой", "ей", "ий", "ый", "ов", "ев",
  "ом", "ем", "ах", "ях", "ую", "юю", "ых", "их", "ам", "ям", "ие", "ые", "ое", "ее", "ы", "и", "а", "я",
  "у", "ю", "е", "о", "ь", "й",
].sort((a, b) => b.length - a.length);
const CYRILLIC_RE = /^[а-я]+$/;

function stem(word: string): string {
  if (word.length < 4 || !CYRILLIC_RE.test(word)) return word;
  for (const suffix of RU_SUFFIXES) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

function normalizeWord(word: string, matchWordForms: boolean): string {
  const base = word.normalize("NFKC").toLowerCase().replace(/ё/g, "е");
  return matchWordForms ? stem(base) : base;
}

function tokenize(line: string): string[] {
  return line.normalize("NFKC").match(WORD_RE) ?? [];
}

/** Убирает числа с конца строки. Возвращает true, если что-то убрано. */
function stripTrailingNumbers(words: string[]): boolean {
  let end = words.length;
  while (end > 1 && NUMBER_ONLY_RE.test(words[end - 1])) end -= 1;
  if (end === words.length) return false;
  words.length = end;
  return true;
}

type Item = { words: string[]; keys: string[]; joined: string };

export function dedupeKeywords(input: string, options: KeywordOptions): KeywordResult {
  const text = input.length > MAX_INPUT_CHARS ? input.slice(0, MAX_INPUT_CHARS) : input;
  const rawLines = text.split(/\r\n|\r|\n/);

  const stats: KeywordStats = {
    inputLines: 0,
    emptyLines: 0,
    numbersStripped: 0,
    duplicatesRemoved: 0,
    cutLines: 0,
    outputLines: 0,
  };

  // 1–3. Разбор строк, удаление чисел, схлопывание одинаковых.
  const items: Item[] = [];
  const seen = new Set<string>();
  for (const raw of rawLines) {
    // Колонка с числом через табуляцию («ремонт машин<TAB>210 478») — берём только текст слева.
    let line = raw;
    if (options.stripNumbers && line.includes("\t")) {
      const parts = line.split("\t");
      const last = parts[parts.length - 1].trim();
      if (parts.length > 1 && (last === "" || /^[\p{N}\s.,%]+$/u.test(last))) {
        line = parts.slice(0, -1).join(" ");
        if (last !== "") stats.numbersStripped += 1;
      }
    }
    let words = tokenize(line);
    if (words.length === 0) {
      stats.emptyLines += 1;
      continue;
    }
    stats.inputLines += 1;
    if (words.length > MAX_WORDS_PER_LINE) words = words.slice(0, MAX_WORDS_PER_LINE);
    if (options.stripNumbers && stripTrailingNumbers(words)) stats.numbersStripped += 1;

    const keys = words.map((word) => normalizeWord(word, options.matchWordForms));
    const joined = keys.join(SEP);
    if (seen.has(joined)) {
      stats.duplicatesRemoved += 1;
      continue;
    }
    seen.add(joined);
    items.push({ words, keys, joined });
  }

  // 4. Базовые фразы: внутри них нет других фраз списка.
  const allPhrases = new Set(items.map((item) => item.joined));
  const baseSet = new Set<string>();
  const isBase: boolean[] = items.map((item) => {
    const { keys } = item;
    for (let length = 1; length < keys.length; length += 1) {
      for (let start = 0; start + length <= keys.length; start += 1) {
        if (allPhrases.has(keys.slice(start, start + length).join(SEP))) return false;
      }
    }
    return true;
  });
  items.forEach((item, index) => {
    if (isBase[index]) baseSet.add(item.joined);
  });

  // 5–6. Вырезаем базовые фразы, собираем остатки, убираем повторы остатков.
  const output: string[] = [];
  const emitted = new Set<string>();
  const emit = (words: string[], keys: string[]) => {
    const joined = keys.join(SEP);
    if (emitted.has(joined)) {
      stats.duplicatesRemoved += 1;
      return;
    }
    emitted.add(joined);
    output.push(words.join(" "));
  };

  items.forEach((item, index) => {
    if (isBase[index]) {
      emit(item.words, item.keys);
      return;
    }
    const { keys, words } = item;
    const covered = new Array<boolean>(keys.length).fill(false);
    for (let length = keys.length - 1; length >= 1; length -= 1) {
      for (let start = 0; start + length <= keys.length; start += 1) {
        let free = true;
        for (let k = start; k < start + length; k += 1) {
          if (covered[k]) {
            free = false;
            break;
          }
        }
        if (free && baseSet.has(keys.slice(start, start + length).join(SEP))) {
          for (let k = start; k < start + length; k += 1) covered[k] = true;
        }
      }
    }
    let start = -1;
    let produced = false;
    for (let k = 0; k <= keys.length; k += 1) {
      const open = k < keys.length && !covered[k];
      if (open && start === -1) start = k;
      if (!open && start !== -1) {
        emit(words.slice(start, k), keys.slice(start, k));
        produced = true;
        start = -1;
      }
    }
    if (produced) stats.cutLines += 1;
  });

  stats.outputLines = output.length;
  return { lines: output, stats };
}
