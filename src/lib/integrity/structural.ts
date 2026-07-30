import { similarity } from "../text";
import { finding, foldForCompare } from "./util";
import type { IntegrityFinding, ReferenceEntry, ReportDocument } from "@/types";

/**
 * Structural checks over the document as a whole. All of these are exact,
 * cheap and offline: set differences over markers, string comparison over
 * entries, and a count of the citation systems in use.
 */

function normaliseEntry(reference: ReferenceEntry): string {
  return foldForCompare(reference.raw).replace(/[^a-z0-9]/g, "");
}

/** Orphan: listed but never cited. Range expansion must happen first. */
function checkOrphans(document: ReportDocument): IntegrityFinding[] {
  const citedIds = new Set<string>();
  const citedMarkers = new Set<string>();
  const rangeOnlyIds = new Set<string>();
  const individuallyCited = new Set<string>();

  for (const claim of document.claims) {
    for (const citation of claim.citations) {
      citedMarkers.add(citation.marker.toLowerCase());
      if (!citation.referenceId) continue;
      citedIds.add(citation.referenceId);
      if (citation.viaRange) rangeOnlyIds.add(citation.referenceId);
      else individuallyCited.add(citation.referenceId);
    }
  }

  const out: IntegrityFinding[] = [];
  for (const reference of document.references) {
    if (citedIds.has(reference.id) || citedMarkers.has(reference.marker.toLowerCase())) {
      // Cited only inside a range: not an orphan, but nothing is attributed to it.
      if (rangeOnlyIds.has(reference.id) && !individuallyCited.has(reference.id)) {
        out.push(
          finding({
            mode: "undifferentiated-block-citation",
            level: "structural",
            severity: "moderate",
            confidence: "confirmed",
            summary: `${reference.marker} is cited only inside a range, never individually`,
            detail: `No sentence attributes anything specific to ${reference.marker}: it appears only within a bracketed range. It is not an orphan - a set difference over literal markers would wrongly report it as one - but nothing in the chapter depends on it.`,
            reference,
            question: `What does ${reference.marker} contribute that the other sources in that range do not?`,
            guardNote:
              "Reported as a block-citation consequence rather than an orphan, because range expansion shows it is cited.",
          }),
        );
      }
      continue;
    }

    out.push(
      finding({
        mode: "orphan-reference",
        level: "structural",
        severity: "moderate",
        confidence: "confirmed",
        summary: `${reference.marker} appears in the bibliography but is never cited`,
        detail: `Set difference between in-text markers and list entries leaves ${reference.marker} uncited: "${(reference.title ?? reference.raw).slice(0, 90)}". Either it informed the chapter and should be cited, or it should be removed.`,
        reference,
        question: `Did you use ${reference.marker}? If so, which sentence should carry it?`,
      }),
    );
  }
  return out;
}

/** Phantom: cited in the text with no entry in the list. */
function checkPhantoms(document: ReportDocument): IntegrityFinding[] {
  const numbers = document.references.map((r) => r.number).filter((n): n is number => typeof n === "number");
  const highestListed = numbers.length > 0 ? Math.max(...numbers) : 0;
  const listed = new Set(document.references.map((r) => r.marker.toLowerCase()));
  const out: IntegrityFinding[] = [];
  const reported = new Set<string>();

  for (const claim of document.claims) {
    for (const citation of claim.citations) {
      if (citation.referenceId) continue;
      const marker = citation.marker;
      if (listed.has(marker.toLowerCase()) || reported.has(marker.toLowerCase())) continue;
      reported.add(marker.toLowerCase());

      const numeric = /^\[(\d{1,3})\]$/.exec(marker);
      const beyondList = numeric && highestListed > 0 && Number.parseInt(numeric[1], 10) > highestListed;

      out.push(
        finding({
          mode: "phantom-citation",
          level: "structural",
          severity: "major",
          confidence: "confirmed",
          summary: `${marker} is cited in the text but has no bibliography entry`,
          detail: beyondList
            ? `The list ends at [${highestListed}]. ${marker} is cited on page ${claim.page} and points at nothing, so whatever it supports has no source at all.`
            : `${marker} is cited on page ${claim.page} but matches no entry in the reference list.`,
          claimId: claim.id,
          markers: [marker],
          question: `What source is ${marker}? Add the entry, or remove the claim that leans on it.`,
        }),
      );
    }
  }
  return out;
}

/** Duplicates: same entry twice, character-for-character or by identifier. */
function checkDuplicates(document: ReportDocument): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const seen: { reference: ReferenceEntry; norm: string }[] = [];

  for (const reference of document.references) {
    const norm = normaliseEntry(reference);
    for (const previous of seen) {
      const exact = previous.norm === norm;
      const sameDoi = Boolean(reference.doi && previous.reference.doi === reference.doi);
      const sameArxiv = Boolean(reference.arxivId && previous.reference.arxivId === reference.arxivId);
      const sameUrl = Boolean(reference.url && previous.reference.url === reference.url);
      const titleMatch =
        reference.title && previous.reference.title
          ? similarity(reference.title, previous.reference.title) > 0.8
          : false;

      if (!exact && !sameDoi && !sameArxiv && !sameUrl && !titleMatch) continue;

      const basis = exact
        ? "identical text"
        : sameDoi
          ? `the same DOI (${reference.doi})`
          : sameArxiv
            ? `the same arXiv record (${reference.arxivId})`
            : sameUrl
              ? "the same URL"
              : "near-identical titles";

      out.push(
        finding({
          mode: "duplicate-entry",
          level: "structural",
          severity: exact ? "moderate" : "critical",
          confidence: "confirmed",
          summary: `${reference.marker} duplicates ${previous.reference.marker}`,
          detail: exact
            ? `${reference.marker} repeats ${previous.reference.marker} character for character under a second number.`
            : `${reference.marker} and ${previous.reference.marker} share ${basis} with altered metadata. Two numbers for one source let the prose present a single study as independent corroboration.`,
          reference,
          markers: [reference.marker, previous.reference.marker],
          question: exact
            ? undefined
            : `Are ${previous.reference.marker} and ${reference.marker} the same study? If so, does any sentence treat them as two?`,
        }),
      );
      break;
    }
    seen.push({ reference, norm });
  }
  return out;
}

type EntryStyle = "ieee" | "apa" | "vancouver" | "other";

/**
 * Bibliography entry format. Numeric markers can sit above entries written in
 * several different conventions, which is the form inconsistency usually takes
 * in student work: the markers look tidy and the entries do not.
 */
function classifyEntry(raw: string): EntryStyle {
  if (/["“][^"”]{8,}["”]/.test(raw)) return "ieee";
  if (/^[A-Z][A-Za-z'’\u00c0-\u024f-]+,\s*(?:[A-Z]\.\s*)+(?:(?:and|&|,)\s*[A-Z][^(]{0,40})*\(\s*(?:19|20)\d{2}[a-z]?\s*\)/.test(raw)) {
    return "apa";
  }
  if (/^[A-Z][A-Za-z'’\u00c0-\u024f-]+\s+[A-Z]{1,3}(?:[,;]|\.\s)/.test(raw)) return "vancouver";
  return "other";
}

/** Mixed citation systems: in-text markers, or bibliography entry conventions. */
function checkStyleConsistency(document: ReportDocument): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];

  const counts = { numeric: 0, "author-year": 0 } as Record<string, number>;
  for (const claim of document.claims) {
    for (const citation of claim.citations) counts[citation.style] += 1;
  }
  const numeric = counts.numeric ?? 0;
  const authorYear = counts["author-year"] ?? 0;
  const minor = Math.min(numeric, authorYear);
  if (minor > 0 && minor / (numeric + authorYear) >= 0.05) {
    out.push(
      finding({
        mode: "inconsistent-citation-system",
        level: "structural",
        severity: "moderate",
        confidence: "confirmed",
        summary: "Numeric and author-date citations are interleaved in the text",
        detail: `${numeric} numeric markers and ${authorYear} author-date markers appear in the same chapter. Mixed systems break traceability: a reader cannot tell whether "(Smith, 2019)" is in the numbered list at all.`,
        question: "Which citation system does your programme require? Convert the whole chapter to it.",
      }),
    );
  }

  const styles = new Map<EntryStyle, string[]>();
  for (const reference of document.references) {
    const style = classifyEntry(reference.raw);
    styles.set(style, [...(styles.get(style) ?? []), reference.marker]);
  }
  const significant = [...styles.entries()].filter(
    ([style, markers]) => style !== "other" && markers.length / document.references.length >= 0.15,
  );
  if (document.references.length >= 6 && significant.length >= 2) {
    out.push(
      finding({
        mode: "inconsistent-citation-system",
        level: "structural",
        severity: "moderate",
        confidence: "confirmed",
        summary: `The reference list mixes ${significant.length} entry conventions`,
        detail: significant
          .map(
            ([style, markers]) =>
              `${style === "apa" ? "author-date (APA/Harvard)" : style === "ieee" ? "quoted-title (IEEE)" : "Vancouver"}: ${markers.join(", ")}`,
          )
          .join(" \u00b7 ") +
          ". Entries written to different conventions under one numbering scheme make fields ambiguous - a reader cannot tell whether a trailing year is the publication date or part of the venue.",
        markers: significant.flatMap(([, markers]) => markers).slice(0, 12),
        question: "Pick one bibliography convention and rewrite every entry to it.",
      }),
    );
  }

  return out;
}

/**
 * Numeric lists are conventionally numbered in order of first citation (IEEE,
 * Vancouver). Recorded as an advisory: it impedes traceability but says nothing
 * about whether any source is sound, so it must not read as an accusation.
 */
function checkNumberingOrder(document: ReportDocument): IntegrityFinding[] {
  const numbered = document.references.filter((r) => typeof r.number === "number");
  if (numbered.length < 6) return [];

  const firstCitation: number[] = [];
  const claims = [...document.claims].sort((a, b) => a.charStart - b.charStart);
  for (const claim of claims) {
    for (const citation of [...claim.citations].sort((a, b) => a.charStart - b.charStart)) {
      const match = /^\[(\d{1,3})\]$/.exec(citation.marker);
      if (!match) continue;
      const n = Number.parseInt(match[1], 10);
      if (!firstCitation.includes(n)) firstCitation.push(n);
    }
  }
  if (firstCitation.length < 6) return [];

  const outOfOrder = firstCitation.filter((n, i) => i > 0 && n < firstCitation[i - 1]);
  if (outOfOrder.length === 0) return [];

  return [
    finding({
      mode: "inconsistent-citation-system",
      level: "structural",
      severity: "advisory",
      confidence: "confirmed",
      summary: "Reference numbers do not follow the order of first citation",
      detail: `First-citation order begins ${firstCitation.slice(0, 10).join(", ")}. Under IEEE and Vancouver numbering, entry [1] is the first source cited, [2] the second, and so on, which lets a reader move between text and list without searching. ${outOfOrder.length} marker(s) appear after a higher-numbered one.`,
      markers: [...new Set(outOfOrder.map((n) => `[${n}]`))].slice(0, 10),
      question: "Does your programme require numbering in citation order? If so, renumber the list.",
      guardNote:
        "Advisory only: ordering is a presentation convention and says nothing about whether any cited source is sound.",
    }),
  ];
}

export function checkStructure(document: ReportDocument): IntegrityFinding[] {
  return [
    ...checkOrphans(document),
    ...checkPhantoms(document),
    ...checkDuplicates(document),
    ...checkStyleConsistency(document),
    ...checkNumberingOrder(document),
  ];
}
