import { newId } from "../text";
import type { CitationInstance, CitationStyle, ReferenceEntry } from "@/types";

/**
 * Inline citation detection and claim mapping.
 *
 * Two families are recognised:
 *   numeric      -> [3], [3], [4], [5]-[7], [3, 8]
 *   author-year  -> (Smith et al., 2023), (Smith & Lee, 2020; Tan, 2019),
 *                   and narrative form "Smith et al. (2023) showed ..."
 */

const NUMERIC_GROUP = /\[(\d{1,3}(?:\s*(?:[,;]|[-\u2013])\s*\d{1,3})*)\]/g;
const PAREN_GROUP = /\(([^()]{3,160}?(?:19|20)\d{2}[a-z]?(?:[^()]{0,40})?)\)/g;
const NARRATIVE = /\b([A-Z][A-Za-z'\u2019-]+(?:\s+(?:et\s+al\.?|and|&)\s+[A-Z][A-Za-z'\u2019-]+)?)\s+\((?:19|20)(\d{2})[a-z]?(?:,\s*[^()]{0,30})?\)/g;

/** Expand `[4]-[7]` / `[4, 6]` into individual numeric markers. */
function expandNumeric(group: string): string[] {
  const out: string[] = [];
  for (const part of group.split(/[,;]/)) {
    const range = /^\s*(\d{1,3})\s*[-\u2013]\s*(\d{1,3})\s*$/.exec(part);
    if (range) {
      const from = Number.parseInt(range[1], 10);
      const to = Number.parseInt(range[2], 10);
      if (to >= from && to - from <= 40) {
        for (let n = from; n <= to; n += 1) out.push(`[${n}]`);
        continue;
      }
    }
    const single = /\d{1,3}/.exec(part);
    if (single) out.push(`[${single[0]}]`);
  }
  return out;
}

function looksLikeCitation(inner: string): boolean {
  // Reject "(see Section 3, 2019 revision)"-style false positives and figure refs.
  if (/^(fig|figure|table|eq|equation|section|appendix)\b/i.test(inner.trim())) return false;
  return /[A-Z][A-Za-z'\u2019-]{2,}/.test(inner) || /\bet\s+al\b/i.test(inner);
}

/** Split `(Smith, 2020; Tan & Lee, 2019)` into its individual markers. */
function splitParenGroup(inner: string): string[] {
  return inner
    .split(";")
    .map((part) => part.trim().replace(/^(?:e\.g\.,?|see|cf\.?|also)\s+/i, ""))
    .filter((part) => part.length > 3 && /(19|20)\d{2}/.test(part));
}

export function findCitations(sentence: string, sentenceStart: number): CitationInstance[] {
  const found: CitationInstance[] = [];
  const push = (marker: string, style: CitationStyle, start: number, end: number): void => {
    found.push({
      id: newId("cite"),
      marker: marker.trim(),
      style,
      charStart: sentenceStart + start,
      charEnd: sentenceStart + end,
    });
  };

  for (const match of sentence.matchAll(NUMERIC_GROUP)) {
    const at = match.index ?? 0;
    for (const marker of expandNumeric(match[1])) {
      push(marker, "numeric", at, at + match[0].length);
    }
  }

  const consumed: [number, number][] = [];
  for (const match of sentence.matchAll(PAREN_GROUP)) {
    const at = match.index ?? 0;
    if (!looksLikeCitation(match[1])) continue;
    consumed.push([at, at + match[0].length]);
    for (const marker of splitParenGroup(match[1])) {
      push(marker, "author-year", at, at + match[0].length);
    }
  }

  for (const match of sentence.matchAll(NARRATIVE)) {
    const at = match.index ?? 0;
    if (consumed.some(([s, e]) => at >= s && at < e)) continue;
    push(`${match[1]}, ${match[0].includes("(19") ? "19" : "20"}${match[2]}`, "author-year", at, at + match[0].length);
  }

  // De-duplicate identical markers inside one sentence.
  const seen = new Set<string>();
  return found.filter((citation) => {
    const key = `${citation.marker}@${citation.style}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function surnameOf(marker: string): string {
  return (/^([A-Z][A-Za-z'\u2019-]+)/.exec(marker.trim())?.[1] ?? "").toLowerCase();
}

function yearOf(marker: string): string {
  return /(19|20)\d{2}/.exec(marker)?.[0] ?? "";
}

/**
 * Resolve inline markers to reference-list entries. Numeric markers match on
 * the bracketed number; author-year markers match on first-author surname plus
 * year, falling back to surname alone when the year is ambiguous.
 */
export function resolveCitations(
  citations: CitationInstance[],
  references: ReferenceEntry[],
): { resolved: CitationInstance[]; orphanMarkers: string[] } {
  const byMarker = new Map(references.map((ref) => [ref.marker.toLowerCase(), ref] as const));
  const orphanMarkers: string[] = [];

  const resolved = citations.map((citation) => {
    if (citation.style === "numeric") {
      const ref = byMarker.get(citation.marker.toLowerCase());
      if (ref) return { ...citation, referenceId: ref.id };
      orphanMarkers.push(citation.marker);
      return citation;
    }

    const surname = surnameOf(citation.marker);
    const year = yearOf(citation.marker);
    const candidates = references.filter((ref) => {
      const inAuthors = ref.authors.some((author) => author.toLowerCase().includes(surname));
      const inRaw = ref.raw.toLowerCase().includes(surname);
      return surname.length > 2 && (inAuthors || inRaw);
    });
    const exact = candidates.find((ref) => String(ref.year ?? "") === year);
    const chosen = exact ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (chosen) return { ...citation, referenceId: chosen.id };
    orphanMarkers.push(citation.marker);
    return citation;
  });

  return { resolved, orphanMarkers: [...new Set(orphanMarkers)] };
}

// ---------------------------------------------------------------------------
// Claim salience
// ---------------------------------------------------------------------------

const STRONG_CLAIM_CUES =
  /\b(prove[sd]?|demonstrate[sd]?|show[sn]?|confirm(?:s|ed)?|establish(?:es|ed)?|significantly|outperform(?:s|ed)?|cause[sd]?|lead[s]? to|result(?:s|ed) in|therefore|thus|hence|conclude[sd]?)\b/i;
const HEDGE_CUES = /\b(may|might|could|suggest(?:s|ed)?|appear(?:s|ed)?|likely|possibly|potentially)\b/i;
const GENERALISATION_CUES = /\b(all|every|always|never|none|universally|invariably|any)\b/i;
const QUANTITATIVE = /\b\d+(?:\.\d+)?\s*(?:%|percent|ms|s|kb|mb|gb|x|times|fold|p\s*<)/i;
const GAP_CUES = /\b(however|although|despite|nevertheless|in contrast|whereas|limitation)\b/i;

export interface Salience {
  score: number;
  reasons: string[];
}

/**
 * Rank cited sentences so the checkpoint spends the student's time on the
 * claims that carry the most argumentative weight.
 */
export function scoreSalience(
  sentence: string,
  citationCount: number,
  relativePosition: number,
): Salience {
  let score = 0.25;
  const reasons: string[] = [];

  if (STRONG_CLAIM_CUES.test(sentence)) {
    score += 0.24;
    reasons.push("Asserts a strong evidential or causal outcome");
  }
  if (GENERALISATION_CUES.test(sentence)) {
    score += 0.16;
    reasons.push("Uses absolute quantifiers that invite over-generalisation");
  }
  if (QUANTITATIVE.test(sentence)) {
    score += 0.14;
    reasons.push("Cites a specific figure that must be traceable to the source");
  }
  if (citationCount > 1) {
    score += 0.12;
    reasons.push(`Bundles ${citationCount} sources behind one statement`);
  }
  if (GAP_CUES.test(sentence)) {
    score += 0.06;
    reasons.push("Frames a contrast or limitation");
  }
  if (HEDGE_CUES.test(sentence)) {
    score -= 0.05;
    reasons.push("Hedged phrasing (lower risk of overclaiming)");
  }
  const words = sentence.split(/\s+/).length;
  if (words < 8) {
    score -= 0.12;
    reasons.push("Very short sentence, likely a list item or caption");
  }
  if (words > 45) {
    score += 0.05;
    reasons.push("Long sentence combining several ideas");
  }
  // Claims in the first third of the report usually anchor the argument.
  if (relativePosition < 0.34) {
    score += 0.05;
    reasons.push("Sits in the framing section of the report");
  }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}
