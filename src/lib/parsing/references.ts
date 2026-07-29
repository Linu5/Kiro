import { newId, normaliseWhitespace } from "../text";
import type { ReferenceEntry } from "@/types";

/**
 * Reference-list segmentation and metadata extraction.
 *
 * Supports the two styles SIT capstone reports actually use: IEEE-style
 * numeric lists (`[1] J. Smith, ...`) and APA/Harvard author-year lists
 * (`Smith, J. (2023). Title...`).
 */

const REFERENCE_HEADINGS =
  /^\s*(?:\d+\.?\s*|[ivxlc]+\.?\s*)?(references?|bibliography|works\s+cited|reference\s+list)\s*:?\s*$/i;

const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:a-z0-9<>+]+/i;
const URL_PATTERN = /https?:\/\/[^\s)>\]]+/i;
const YEAR_PATTERN = /\b(19|20)\d{2}[a-z]?\b/;

export interface ReferenceSection {
  /** Character offset in the document full text where the list starts. */
  start: number;
  end: number;
  raw: string;
  found: boolean;
}

/** Locate the reference list. Prefers the *last* matching heading. */
export function locateReferenceSection(fullText: string): ReferenceSection {
  const lines = fullText.split("\n");
  let offset = 0;
  let bestStart = -1;

  for (const line of lines) {
    if (REFERENCE_HEADINGS.test(line)) bestStart = offset + line.length + 1;
    offset += line.length + 1;
  }

  if (bestStart < 0) {
    // Fall back to the first line that looks like a numbered reference entry.
    const fallback = /(^|\n)\s*\[1\]\s+[A-Z]/.exec(fullText);
    if (fallback) {
      const start = fallback.index + fallback[1].length;
      return { start, end: fullText.length, raw: fullText.slice(start), found: true };
    }
    return { start: fullText.length, end: fullText.length, raw: "", found: false };
  }

  // An appendix after the list should not be swallowed.
  const after = fullText.slice(bestStart);
  const appendix = /\n\s*(appendix|appendices|annex)\b/i.exec(after);
  const end = appendix ? bestStart + appendix.index : fullText.length;
  return { start: bestStart, end, raw: fullText.slice(bestStart, end), found: true };
}

function cleanEntry(raw: string): string {
  return normaliseWhitespace(raw.replace(/\n/g, " "));
}

/** Split a numeric reference list into `[n] ...` chunks. */
function splitNumeric(raw: string): { marker: string; body: string }[] {
  const matches = [...raw.matchAll(/(?:^|\n)\s*(?:\[(\d{1,3})\]|(\d{1,3})[.)])\s+/g)];
  if (matches.length < 2) return [];
  const entries: { marker: string; body: string }[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const number = match[1] ?? match[2];
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index ?? raw.length : raw.length;
    entries.push({ marker: `[${number}]`, body: cleanEntry(raw.slice(bodyStart, bodyEnd)) });
  }
  return entries;
}

/** Split an author-year reference list on lines that start a new entry. */
function splitAuthorYear(raw: string): { marker: string; body: string }[] {
  const lines = raw.split("\n");
  const blocks: string[] = [];
  let current = "";

  const startsEntry = (line: string): boolean =>
    /^[A-Z\u00c0-\u00dd][A-Za-z'\u2019-]+,\s*(?:[A-Z]\.\s*)+/.test(line.trim()) ||
    /^[A-Z][A-Za-z'\u2019-]+\s+(?:and|&)\s+[A-Z]/.test(line.trim());

  for (const line of lines) {
    if (startsEntry(line) && current.trim().length > 0) {
      blocks.push(current);
      current = line;
    } else {
      current += ` ${line}`;
    }
  }
  if (current.trim().length > 0) blocks.push(current);

  return blocks
    .map((block) => cleanEntry(block))
    .filter((body) => body.length > 30 && YEAR_PATTERN.test(body))
    .map((body) => ({ marker: authorYearMarker(body), body }));
}

function authorYearMarker(body: string): string {
  const surname = /^([A-Z][A-Za-z'\u2019-]+)/.exec(body)?.[1] ?? "Unknown";
  const year = YEAR_PATTERN.exec(body)?.[0] ?? "n.d.";
  const multiple = /\b(et al|&|and)\b/i.test(body.slice(0, 80));
  return `${surname}${multiple ? " et al." : ""}, ${year}`;
}

function extractAuthors(body: string): string[] {
  // Everything before the year (author-year) or before the first title cue.
  const head = body.split(/\((19|20)\d{2}[a-z]?\)/)[0] ?? body;
  const segment = head.split(/[.,]\s*["\u201c]/)[0] ?? head;
  return segment
    .split(/,|\band\b|&|;/)
    .map((part) => part.replace(/\.$/, "").trim())
    .filter((part) => part.length > 1 && /[A-Za-z]/.test(part) && !/^\d+$/.test(part))
    .slice(0, 8);
}

function extractTitle(body: string): string | undefined {
  // Quoted title (IEEE) wins, then the sentence right after the year (APA).
  const quoted = /["\u201c]([^"\u201d]{8,300})["\u201d]/.exec(body);
  if (quoted) return quoted[1].replace(/[.,]$/, "").trim();

  const afterYear = /\((?:19|20)\d{2}[a-z]?\)\.?\s*([^.?!]{8,300})[.?!]/.exec(body);
  if (afterYear) return afterYear[1].trim();

  // IEEE without quotes: second comma-separated chunk that is long enough.
  const chunks = body.split(/,\s*/);
  const candidate = chunks.slice(1).find((chunk) => chunk.trim().length > 20);
  return candidate?.replace(/[.,]$/, "").trim();
}

function extractVenue(body: string): string | undefined {
  const italicish = /(?:In\s+)?(?:Proc(?:eedings)?\.?[^,.]{0,80}|[A-Z][A-Za-z&\s]{4,60}(?:Journal|Transactions|Review|Conference|Letters|Studies|Quarterly)[A-Za-z&\s]{0,40})/.exec(
    body,
  );
  return italicish?.[0].trim();
}

export function parseReferenceEntry(marker: string, body: string): ReferenceEntry {
  const doi = DOI_PATTERN.exec(body)?.[0]?.replace(/[.,;]$/, "");
  const yearMatch = YEAR_PATTERN.exec(body)?.[0];
  return {
    id: newId("ref"),
    marker,
    raw: body,
    authors: extractAuthors(body),
    title: extractTitle(body),
    year: yearMatch ? Number.parseInt(yearMatch.slice(0, 4), 10) : undefined,
    venue: extractVenue(body),
    doi,
    url: doi ? undefined : URL_PATTERN.exec(body)?.[0],
  };
}

export function parseReferences(fullText: string): {
  references: ReferenceEntry[];
  section: ReferenceSection;
  warnings: string[];
} {
  const section = locateReferenceSection(fullText);
  const warnings: string[] = [];
  if (!section.found) {
    warnings.push(
      "No reference list heading was found. Citation authenticity checks will be limited to inline markers.",
    );
    return { references: [], section, warnings };
  }

  const numeric = splitNumeric(section.raw);
  const entries = numeric.length >= 2 ? numeric : splitAuthorYear(section.raw);
  if (entries.length === 0) {
    warnings.push("The reference list was located but no entries could be segmented.");
  }

  const references = entries
    .filter((entry) => entry.body.length > 20)
    .map((entry) => parseReferenceEntry(entry.marker, entry.body));

  const withoutDoi = references.filter((r) => !r.doi && !r.url).length;
  if (withoutDoi > 0) {
    warnings.push(
      `${withoutDoi} reference(s) carry neither a DOI nor a URL; verification falls back to title matching.`,
    );
  }
  return { references, section, warnings };
}
