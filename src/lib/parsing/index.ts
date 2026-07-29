import { newId, splitBlocks, splitSentences, wordCount } from "../text";
import { extractDocument } from "./extractText";
import { findCitations, resolveCitations, scoreSalience } from "./citations";
import { parseReferences } from "./references";
import type { Claim, DocumentPage, ReportDocument } from "@/types";

export { detectFormat, base64ToBytes, bytesToBase64 } from "./extractText";
export { findCitations, resolveCitations, scoreSalience } from "./citations";
export { parseReferences, locateReferenceSection } from "./references";

const SUMMARY_HEADINGS =
  /^\s*(?:\d+\.?\s*)?(abstract|executive\s+summary|summary|synopsis)\s*:?\s*$/i;
const NEXT_HEADING =
  /^\s*(?:\d+\.?\s*|chapter\s+\d+\s*:?\s*)?(introduction|background|literature\s+review|table\s+of\s+contents|acknowledge?ments?|methodology|contents)\b/i;

const THESIS_CUES = [
  /\b(?:this|the)\s+(?:report|paper|study|project|capstone|review)\s+(?:aims?|seeks?|sets? out|intends?|presents?|proposes?|investigates?|examines?|argues?|explores?|evaluates?)\b[^.]{10,400}\./i,
  /\b(?:the\s+)?(?:aim|objective|purpose|goal)s?\s+of\s+(?:this|the)\s+(?:report|study|project|review)\b[^.]{10,400}\./i,
  /\bwe\s+(?:argue|propose|hypothesi[sz]e|show|demonstrate)\b[^.]{10,400}\./i,
];

function buildPages(raw: { index: number; text: string }[]): {
  pages: DocumentPage[];
  fullText: string;
} {
  const pages: DocumentPage[] = [];
  let fullText = "";
  for (const page of raw) {
    const charStart = fullText.length;
    fullText += page.text;
    pages.push({ index: page.index, text: page.text, charStart, charEnd: fullText.length });
    fullText += "\n\n";
  }
  return { pages, fullText };
}

function extractTitle(fullText: string, fileName: string): string {
  const head = fullText.slice(0, 1200).split("\n").map((l) => l.trim());
  const candidate = head
    .slice(0, 12)
    .filter((line) => line.length >= 12 && line.length <= 160)
    .filter((line) => !/^(singapore institute of technology|sit\b|page\s+\d+|\d+$)/i.test(line))
    .filter((line) => !/^(abstract|executive summary|contents)$/i.test(line))
    .sort((a, b) => b.length - a.length)[0];
  return candidate ?? fileName.replace(/\.[^.]+$/, "");
}

function extractExecutiveSummary(fullText: string): string {
  const lines = fullText.split("\n");
  let offset = 0;
  let start = -1;

  for (const line of lines) {
    if (start < 0 && SUMMARY_HEADINGS.test(line)) {
      start = offset + line.length + 1;
    } else if (start >= 0 && NEXT_HEADING.test(line)) {
      return fullText.slice(start, offset).trim();
    }
    offset += line.length + 1;
  }

  if (start >= 0) return fullText.slice(start, Math.min(fullText.length, start + 2500)).trim();

  // No abstract heading: use the first substantial paragraphs of the body.
  const paragraphs = fullText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => wordCount(p) > 40);
  return paragraphs.slice(0, 2).join("\n\n");
}

function extractThesis(fullText: string, summary: string): string {
  const haystacks = [summary, fullText.slice(0, 20000)];
  for (const haystack of haystacks) {
    for (const cue of THESIS_CUES) {
      const match = cue.exec(haystack);
      if (match) return match[0].trim();
    }
  }
  const first = splitSentences(summary)[0]?.text;
  return first ?? "No explicit thesis statement was detected in the report.";
}

function pageForOffset(pages: DocumentPage[], offset: number): number {
  const page = pages.find((p) => offset >= p.charStart && offset <= p.charEnd);
  return page?.index ?? pages[pages.length - 1]?.index ?? 1;
}

const SECTION_HEADING =
  /^\s*(?:\d+(?:\.\d+)*\.?\s+)?([A-Z][A-Za-z /&-]{3,70})\s*$/;

function sectionIndex(fullText: string): { offset: number; title: string }[] {
  const out: { offset: number; title: string }[] = [];
  let offset = 0;
  for (const line of fullText.split("\n")) {
    const match = SECTION_HEADING.exec(line);
    if (match && line.trim().split(/\s+/).length <= 9 && !/[.;:]$/.test(line.trim())) {
      out.push({ offset, title: match[1].trim() });
    }
    offset += line.length + 1;
  }
  return out;
}

function sectionForOffset(index: { offset: number; title: string }[], offset: number): string | undefined {
  let current: string | undefined;
  for (const entry of index) {
    if (entry.offset <= offset) current = entry.title;
    else break;
  }
  return current;
}

/**
 * Full Phase-1 ingestion: bytes in, structured `ReportDocument` out.
 * Everything here is deterministic and local - no model involved yet.
 */
export async function parseReport(fileName: string, bytes: Uint8Array): Promise<ReportDocument> {
  const extracted = await extractDocument(fileName, bytes);
  const { pages, fullText } = buildPages(extracted.pages);
  const warnings = [...extracted.warnings];

  const { references, section, warnings: refWarnings } = parseReferences(fullText);
  warnings.push(...refWarnings);

  const summary = extractExecutiveSummary(fullText);
  const thesis = extractThesis(fullText, summary);
  const headings = sectionIndex(fullText.slice(0, section.start));
  const bodyEnd = section.found ? section.start : fullText.length;

  const claims: Claim[] = [];
  for (const page of pages) {
    if (page.charStart >= bodyEnd) continue;
    const pageBody = page.text.slice(0, Math.max(0, Math.min(page.text.length, bodyEnd - page.charStart)));
    const sentences = splitBlocks(pageBody, page.charStart).flatMap((block) =>
      splitSentences(block.text, block.start),
    );
    for (const sentence of sentences) {
      const citations = findCitations(sentence.text, sentence.start);
      if (citations.length === 0) continue;
      if (wordCount(sentence.text) < 5) continue;

      const relativePosition = bodyEnd > 0 ? sentence.start / bodyEnd : 0;
      const salience = scoreSalience(sentence.text, citations.length, relativePosition);
      claims.push({
        id: newId("claim"),
        // Line wrapping from the PDF layer is collapsed so the sentence reads as
        // one line in prompts, cards and the exported log. The character offsets
        // still point at the original span in `fullText`.
        text: sentence.text.replace(/\s+/g, " "),
        page: pageForOffset(pages, sentence.start),
        section: sectionForOffset(headings, sentence.start),
        charStart: sentence.start,
        charEnd: sentence.end,
        citations,
        salience: salience.score,
        salienceReasons: salience.reasons,
      });
    }
  }

  const allCitations = claims.flatMap((claim) => claim.citations);
  const { resolved, orphanMarkers } = resolveCitations(allCitations, references);
  const byId = new Map(resolved.map((citation) => [citation.id, citation] as const));
  for (const claim of claims) {
    claim.citations = claim.citations.map((citation) => byId.get(citation.id) ?? citation);
  }

  if (orphanMarkers.length > 0) {
    warnings.push(
      `${orphanMarkers.length} inline marker(s) could not be matched to a reference entry: ${orphanMarkers
        .slice(0, 8)
        .join(", ")}${orphanMarkers.length > 8 ? "\u2026" : ""}. These are flagged as potentially hallucinated citations.`,
    );
  }
  if (claims.length === 0) {
    warnings.push("No inline citations were detected. Check that the report uses [n] or (Author, year) style.");
  }

  return {
    id: newId("doc"),
    fileName,
    sourceFormat: extracted.format,
    title: extractTitle(fullText, fileName),
    thesis,
    executiveSummary: summary,
    fullText,
    pages,
    claims,
    references,
    pageCount: pages.length,
    wordCount: wordCount(fullText),
    createdAt: new Date().toISOString(),
    warnings,
  };
}

/** Highest-salience claims, returned in document order. */
export function selectCheckpointClaims(document: ReportDocument, budget: number): Claim[] {
  return [...document.claims]
    .sort((a, b) => b.salience - a.salience)
    .slice(0, Math.max(1, budget))
    .sort((a, b) => a.charStart - b.charStart);
}
