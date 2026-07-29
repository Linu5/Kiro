/** Small text utilities shared by the parser, the evaluator and the exporters. */

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function normaliseWhitespace(input: string): string {
  return input.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
}

/** Collapse hyphenated line breaks produced by PDF column wrapping. */
export function dehyphenate(input: string): string {
  return input.replace(/([A-Za-z])-\n([a-z])/g, "$1$2");
}

export interface Span {
  text: string;
  start: number;
  end: number;
}

const ABBREVIATIONS = [
  "e.g",
  "i.e",
  "et al",
  "cf",
  "vs",
  "fig",
  "eq",
  "no",
  "vol",
  "pp",
  "dr",
  "prof",
  "mr",
  "ms",
  "approx",
];

/**
 * Sentence segmentation tuned for academic prose: keeps `[3]`, `(Smith, 2019)`
 * and decimal numbers intact, and refuses to split after known abbreviations.
 */
export function splitSentences(text: string, offset = 0): Span[] {
  const spans: Span[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    const before = text.slice(Math.max(0, i - 12), i).toLowerCase();
    if (ABBREVIATIONS.some((abbr) => before.endsWith(abbr))) continue;
    // Decimal numbers and version strings: 3.5, v1.2
    if (/\d$/.test(text.slice(0, i)) && /^\d/.test(text.slice(i + 1, i + 2))) continue;
    // Initials: "J. Smith"
    if (/(^|\s)[A-Z]$/.test(text.slice(Math.max(0, i - 2), i))) continue;

    // Consume trailing citation brackets and closing quotes so they stay with
    // the sentence they belong to.
    let end = i + 1;
    const tail = /^(\s*(\[[\d,\s\u2013-]+\]|\([^()]{0,60}\)|["'\u201d\u2019)]))+/.exec(
      text.slice(end),
    );
    if (tail) end += tail[0].length;

    const raw = text.slice(start, end);
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const lead = raw.length - raw.trimStart().length;
      spans.push({
        text: trimmed,
        start: offset + start + lead,
        end: offset + start + lead + trimmed.length,
      });
    }
    start = end;
  }

  const rest = text.slice(start).trim();
  if (rest.length > 0) {
    const lead = text.slice(start).length - text.slice(start).trimStart().length;
    spans.push({
      text: rest,
      start: offset + start + lead,
      end: offset + start + lead + rest.length,
    });
  }
  return spans;
}

/**
 * Split text into blocks at heading boundaries before sentence segmentation.
 * Without this, a heading that carries no terminal punctuation ("2. Literature
 * Review") is swallowed into the first sentence of the section it introduces.
 *
 * A line counts as a heading only when it is short, unpunctuated *and* the
 * previous line closed a sentence - otherwise every wrapped PDF line would look
 * like a heading.
 */
export function splitBlocks(text: string, base = 0): { text: string; start: number }[] {
  const blocks: { text: string; start: number }[] = [];
  let current = "";
  let start = 0;
  let offset = 0;
  let previousClosed = true;

  const flush = (): void => {
    if (current.trim().length > 0) blocks.push({ text: current, start: base + start });
    current = "";
  };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const closes = /[.?!:;]["'\u201d\u2019)]?$/.test(trimmed) || trimmed.length === 0;
    const headingLike =
      trimmed.length > 0 &&
      trimmed.length <= 80 &&
      trimmed.split(/\s+/).length <= 9 &&
      !/[.?!,;:]$/.test(trimmed) &&
      /^[\d(]*[.)]?\s*[A-Z]/.test(trimmed);

    if (headingLike && previousClosed) {
      flush();
      start = offset + line.length + 1;
    } else {
      if (current.length === 0) start = offset;
      current += `${line}\n`;
    }
    previousClosed = closes;
    offset += line.length + 1;
  }
  flush();
  return blocks;
}

export const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "all", "also", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "between", "both", "but", "by", "can", "could",
  "did", "do", "does", "doing", "during", "each", "for", "from", "further", "had", "has", "have",
  "having", "he", "her", "here", "hers", "him", "his", "how", "however", "i", "if", "in", "into",
  "is", "it", "its", "itself", "just", "may", "me", "might", "more", "most", "must", "my", "no",
  "nor", "not", "of", "off", "on", "once", "only", "or", "other", "our", "out", "over", "own",
  "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why",
  "will", "with", "would", "you", "your",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Crude Porter-ish suffix stripping: enough to match "reduces"/"reduction". */
export function stem(token: string): string {
  return token
    .replace(/(ational|ization|iveness|fulness|ousness)$/, "")
    .replace(/(ations?|izations?|ments?|ness|ities|ity)$/, "")
    .replace(/(ing|edly|ed|es|s)$/, "")
    .replace(/(.)\1$/, "$1");
}

export function contentSet(text: string): Set<string> {
  return new Set(tokenize(text).map(stem).filter((t) => t.length > 2));
}

/** Jaccard similarity over stemmed content words, 0..1. */
export function similarity(a: string, b: string): number {
  const setA = contentSet(a);
  const setB = contentSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

/** Fraction of `a`'s content words that also appear in `b`, 0..1. */
export function coverage(a: string, b: string): number {
  const setA = contentSet(a);
  const setB = contentSet(b);
  if (setA.size === 0) return 0;
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  return shared / setA.size;
}

export function wordCount(text: string): number {
  const matched = text.trim().match(/\S+/g);
  return matched ? matched.length : 0;
}

export function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}\u2026`;
}
