import { newId, normaliseWhitespace } from "../text";
import type { ReferenceEntry } from "@/types";

/**
 * Reference-list segmentation and metadata extraction.
 *
 * Supports the styles SIT capstone reports actually use: IEEE numeric with
 * quoted titles (`[1] J. Smith, "Title," Venue, 2019.`), Vancouver numeric
 * (`1. Smith J, Kaur P. Title. Venue. 2019.`) and APA/Harvard author-year.
 *
 * Extraction is deliberately conservative and records what was *printed* as
 * well as what was repaired: `doiAsWritten` keeps the original so the integrity
 * layer can report a malformed locator instead of silently fixing it.
 */

const REFERENCE_HEADINGS =
  /^\s*(?:\d+\.?\s*|[ivxlc]+\.?\s*)?(references?|bibliography|works\s+cited|reference\s+list)\s*:?\s*$/i;

/**
 * DOI characters per the Crossref recommendation, plus `_` and `#` which appear
 * in Springer/LNCS suffixes. Unicode dashes are matched too so a DOI broken by
 * a non-breaking hyphen is captured whole and flagged rather than truncated.
 */
const DOI_PATTERN = /\b10\.\d{4,9}\/[-–—‐‑‒A-Za-z0-9._;()/:<>+#\[\]]+/;
const UNICODE_DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2212]/g;
const URL_PATTERN = /https?:\/\/[^\s)>\],]+/i;
/**
 * arXiv identifiers in every form a student's bibliography uses them:
 * `arXiv:2307.00108`, `arxiv.org/abs/2307.00108`, `arxiv.org/pdf/...`, and the
 * DataCite DOI form `10.48550/arXiv.2307.00108`.
 */
const ARXIV_PATTERN =
  /arxiv[:.\s]*(?:org\/(?:abs|pdf)\/)?((?:\d{4}\.\d{4,5})(?:v\d+)?|[a-z-]+\/\d{7})/i;
const ACCESS_DATE =
  /(?:\[?(?:cited|accessed|retrieved)\]?[:\s]*)((?:\d{1,2}\s+)?[A-Z][a-z]{2,8}\.?\s*\d{0,2},?\s*\d{4}|\d{4}[-/]\d{2}[-/]\d{2}|\d{4}\s+[A-Z][a-z]{2})/i;

/** A published standard, statute or official specification. */
const STANDARD_PATTERN =
  /\b(NFPA|ISO|IEC|IEEE\s+Std|ASTM|BS\s?EN|EN\s?\d{3,}|ANSI|RFC\s?\d{3,}|ITU-T|DIN|SS\s?\d{3,}|GDPR|PDPA)\b/;

/** Venue words that indicate a review or survey rather than primary research. */
export const SECONDARY_TITLE_PATTERN =
  /\b(review|survey|state[-\s]of[-\s]the[-\s]art|systematic\s+(?:review|mapping)|overview|taxonomy|meta[-\s]analysis)\b/i;

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
    const fallback = /(^|\n)\s*(?:\[1\]|1\.)\s+[A-Z]/.exec(fullText);
    if (fallback) {
      const start = fallback.index + fallback[1].length;
      return { start, end: fullText.length, raw: fullText.slice(start), found: true };
    }
    return { start: fullText.length, end: fullText.length, raw: "", found: false };
  }

  const after = fullText.slice(bestStart);
  const appendix = /\n\s*(appendix|appendices|annex)\b/i.exec(after);
  const end = appendix ? bestStart + appendix.index : fullText.length;
  return { start: bestStart, end: fullText.length, raw: fullText.slice(bestStart, end), found: true };
}

function cleanEntry(raw: string): string {
  return normaliseWhitespace(raw.replace(/\n/g, " "));
}

interface RawEntry {
  marker: string;
  number?: number;
  body: string;
}

/** Split a numeric reference list into `[n] ...` or `n. ...` chunks. */
function splitNumeric(raw: string): RawEntry[] {
  const matches = [...raw.matchAll(/(?:^|\n)\s*(?:\[(\d{1,3})\]|(\d{1,3})[.)])\s+/g)];
  if (matches.length < 2) return [];
  const entries: RawEntry[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const number = Number.parseInt(match[1] ?? match[2], 10);
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index ?? raw.length : raw.length;
    entries.push({ marker: `[${number}]`, number, body: cleanEntry(raw.slice(bodyStart, bodyEnd)) });
  }
  return entries;
}

/** Split an author-year reference list on lines that start a new entry. */
function splitAuthorYear(raw: string): RawEntry[] {
  const lines = raw.split("\n");
  const blocks: string[] = [];
  let current = "";

  const startsEntry = (line: string): boolean =>
    /^[A-Z\u00c0-\u024f][A-Za-z'’\u00c0-\u024f-]+,\s*(?:[A-Z]\.\s*)+/.test(line.trim()) ||
    /^[A-Z][A-Za-z'’\u00c0-\u024f-]+\s+(?:and|&)\s+[A-Z]/.test(line.trim());

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
    .filter((body) => body.length > 30 && findYear(body) !== undefined)
    .map((body) => ({ marker: authorYearMarker(body), body }));
}

function authorYearMarker(body: string): string {
  const surname = /^([A-Z][A-Za-z'’\u00c0-\u024f-]+)/.exec(body)?.[1] ?? "Unknown";
  const year = findYear(body);
  const multiple = /\b(et al|&|and)\b/i.test(body.slice(0, 80));
  return `${surname}${multiple ? " et al." : ""}, ${year ?? "n.d."}`;
}

/**
 * Publication year. Years embedded in identifiers are excluded: `arXiv:2005.11401`
 * and `10.1109/TVCG.2023.3298871` both contain digit runs that look like years
 * but are not the publication date.
 */
export function findYear(body: string): number | undefined {
  const masked = body
    .replace(DOI_PATTERN, " ")
    .replace(ARXIV_PATTERN, " ")
    .replace(/\b\d{4}\.\d{4,5}(v\d+)?\b/g, " ")
    .replace(URL_PATTERN, " ");
  // Prefer a parenthesised or terminal year, then any remaining year.
  const candidates = [
    /\((19|20)(\d{2})[a-z]?\)/.exec(masked),
    /\b(19|20)(\d{2})[a-z]?\s*[.;)]?\s*$/.exec(masked),
    /\b(19|20)(\d{2})[a-z]?\b/.exec(masked),
  ];
  for (const match of candidates) {
    if (match) return Number.parseInt(`${match[1]}${match[2]}`, 10);
  }
  return undefined;
}

/** The year encoded in a DOI suffix, e.g. `10.1016/j.trc.2013.02.005` -> 2013. */
export function doiSuffixYear(doi: string | undefined): number | undefined {
  if (!doi) return undefined;
  const suffix = doi.slice(doi.indexOf("/") + 1);
  const match = /(?:^|[.\-_/])((?:19|20)\d{2})(?:[.\-_/]|$)/.exec(suffix);
  if (!match) return undefined;
  const year = Number.parseInt(match[1], 10);
  const thisYear = new Date().getFullYear();
  return year >= 1980 && year <= thisYear + 1 ? year : undefined;
}

/**
 * Author segment. Vancouver entries put the title immediately after the author
 * list with no quotation marks (`Smith J, Kaur P. Title of work. Venue. 2019.`),
 * so the split is on the first sentence boundary that follows an initials group.
 */
function splitAuthorsAndTitle(body: string): { authors: string[]; title?: string } {
  const quoted = /["“]([^"”]{8,300})["”]/.exec(body);

  // IEEE: authors before the quoted title.
  if (quoted) {
    const head = body.slice(0, quoted.index);
    return { authors: splitAuthorList(head), title: quoted[1].replace(/[.,]$/, "").trim() };
  }

  // APA/Harvard: authors before the parenthesised year.
  const yearParen = /\((19|20)\d{2}[a-z]?\)\.?\s*/.exec(body);
  if (yearParen) {
    const head = body.slice(0, yearParen.index);
    const tail = body.slice(yearParen.index + yearParen[0].length);
    const title = /^([^.?!]{8,300})[.?!]/.exec(tail)?.[1];
    return { authors: splitAuthorList(head), title: title?.trim() };
  }

  // Vancouver: "Surname AB, Surname C-D, Surname EF. Title. Venue. Year."
  // Initials may be hyphenated ("Olivier A-H") or doubled ("Dally WJ").
  const NAME_INITIALS = "[A-Z][A-Za-z'’\\u00c0-\\u024f-]+\\s+[A-Z]{1,3}(?:-[A-Z])?";
  const vancouver = new RegExp(
    `^((?:${NAME_INITIALS}(?:,\\s*|,?\\s+(?:and|&)\\s+|;\\s*))*${NAME_INITIALS})\\.\\s+([^.]{8,300})\\.`,
  ).exec(body);
  if (vancouver) {
    return { authors: splitAuthorList(vancouver[1]), title: vancouver[2].trim() };
  }

  // Organisation as author: "National Fire Protection Association. NFPA 130: ..."
  const orgFirst = /^([A-Z][A-Za-z&.,'’\- ]{3,60}?)\.\s+([A-Z][^.]{8,300})\./.exec(body);
  if (orgFirst) {
    return { authors: [orgFirst[1].trim()], title: orgFirst[2].trim() };
  }

  const chunks = body.split(/,\s*/);
  return {
    authors: splitAuthorList(chunks[0] ?? ""),
    title: chunks.slice(1).find((chunk) => chunk.trim().length > 20)?.replace(/[.,]$/, "").trim(),
  };
}

/**
 * Split an author segment into individual names. Diacritics, particle surnames
 * ("van Beek") and short surnames ("He") are preserved verbatim: the false
 * positive guards in FAILURE_MODES.md exist because normalising these produces
 * author errors that are the tool's fault, not the student's.
 */
export function splitAuthorList(segment: string): string[] {
  return segment
    .replace(/\bet\s+al\.?/gi, "")
    .split(/,\s*(?![A-Z]\.)|;\s*|\s+(?:and|&)\s+/)
    .map((part) =>
      part
        // "…, and G. Brain" leaves a conjunction glued to the last name.
        .replace(/^\s*(?:and|&)\s+/i, "")
        .replace(/^\s*[.,;]\s*|[.,;]\s*$/g, "")
        .trim(),
    )
    .filter((part) => part.length > 1 && /[A-Za-z\u00c0-\u024f]/.test(part) && !/^\d+$/.test(part))
    .slice(0, 12);
}

function extractVenue(body: string, title: string | undefined): string | undefined {
  const afterTitle = title && body.includes(title) ? body.slice(body.indexOf(title) + title.length) : body;
  const journalish =
    /(?:In:?\s+)?((?:Proc(?:eedings)?\.?|Conference|Workshop|Symposium)[^,.;]{0,80}|[A-Z][A-Za-z&'’\u00c0-\u024f\s.-]{4,70}?(?:Journal|Transactions|Review|Reviews|Letters|Magazine|Studies|Quarterly|Research|Computing|Systems|Applications|Intelligence|Proceedings)[A-Za-z&\s.-]{0,40})/.exec(
      afterTitle,
    );
  if (journalish) return journalish[1].replace(/\s{2,}/g, " ").trim();
  // Vancouver: the segment after the title sentence.
  const parts = afterTitle.split(/\.\s+/).map((p) => p.trim()).filter(Boolean);
  const candidate = parts.find((p) => p.length > 6 && /^[A-Z]/.test(p) && !/^\d/.test(p));
  return candidate?.slice(0, 90);
}

function extractLocator(body: string): string | undefined {
  const vol = /\bvol\.?\s*\d+[^.;]{0,40}|\b\d+\s*\(\d+\)\s*(?:[,:]\s*[\dA-Za-z-]+)?|\bpp\.?\s*[\dA-Za-z-–]+|\barticle\s+\d+/i.exec(
    body,
  );
  return vol?.[0]?.trim();
}

export function parseReferenceEntry(marker: string, body: string, number?: number): ReferenceEntry {
  const doiMatch = DOI_PATTERN.exec(body);
  const doiAsWritten = doiMatch?.[0]?.replace(/[.,;]+$/, "");
  // Repair Unicode dashes so the identifier can still be looked up; the
  // integrity layer reports the original as a malformed locator.
  const doi = doiAsWritten?.replace(UNICODE_DASHES, "-");
  const { authors, title } = splitAuthorsAndTitle(body);
  const url = URL_PATTERN.exec(body)?.[0]?.replace(/[.,;]+$/, "");

  return {
    id: newId("ref"),
    marker,
    number,
    raw: body,
    authors,
    title,
    year: findYear(body),
    venue: extractVenue(body, title),
    publisher: /\b(Springer|Elsevier|IEEE|ACM|Wiley|Taylor\s*&\s*Francis|MIT Press|O'Reilly|NFPA|ISO)\b/i.exec(body)?.[0],
    doi,
    doiAsWritten: doiAsWritten !== doi ? doiAsWritten : undefined,
    arxivId: ARXIV_PATTERN.exec(body)?.[1],
    url,
    accessedDate: ACCESS_DATE.exec(body)?.[1]?.trim(),
    locator: extractLocator(body),
    isStandard: STANDARD_PATTERN.test(body),
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
      "No reference list heading was found. Citation checks will be limited to inline markers.",
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
    .map((entry) => parseReferenceEntry(entry.marker, entry.body, entry.number));

  return { references, section, warnings };
}
