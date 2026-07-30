import { splitBlocks, splitSentences, truncate } from "../text";
import { findCitations } from "../parsing/citations";
import { SECONDARY_TITLE_PATTERN } from "../parsing/references";
import {
  finding,
  foldForCompare,
  hostOf,
  isScholarly,
  MARKET_REPORT_PATTERN,
  PREPRINT_HOST_PATTERN,
  surnameOf,
  VENDOR_BLOG_PATTERN,
} from "./util";
import type { Claim, IntegrityFinding, ReferenceEntry, ReportDocument } from "@/types";

/**
 * Use-level checks: how the source serves the argument. These are the ones a
 * coach exists for. Each is deliberately phrased as something the student can
 * answer, because most cannot be settled by the tool alone.
 */

const CURRENT_YEAR = new Date().getFullYear();

/** A precise figure: percentage, multiple, count with unit, or p-value. */
const STATISTIC =
  /(\b\d{1,3}(?:\.\d+)?\s?%|\b\d{1,3}(?:\.\d+)?\s?(?:per\s?cent|percent)\b|\b\d+(?:\.\d+)?\s?(?:×|x)\b|\b\d+(?:\.\d+)?\s?(?:fps|ms|s|GB|MB|KB|W|Hz|FLOPs?|agents|tickets|images)\b|\bp\s?[<=]\s?0?\.\d+)/i;
const ABSOLUTE =
  /\b(all|every|always|never|none|universally|invariably|any|guarantees?|eliminates?|proves?|proven|entirely|completely|no longer)\b/i;
const HEDGE = /\b(may|might|could|suggests?|indicates?|appears?|likely|tends? to|in this setting)\b/i;
const CURRENCY = /\b(state[-\s]of[-\s]the[-\s]art|current(?:ly)?|the latest|most recent|modern|today|at present|now standard)\b/i;
const CRITICAL_CUE =
  /\b(however|although|though|whereas|limitation|limited|constrain|caveat|assumes?|only|in contrast|does not|cannot|unclear|unlike|trade[-\s]?off|risk)\b/i;
const COMPARATIVE_CUE =
  /\b(whereas|compared with|compared to|in contrast|by contrast|unlike|both|neither|whereas|differs?|agree|disagree|conflict|consistent with|contradict)\b/i;
const PEER_REVIEW_CLAIM = /\b(peer[-\s]reviewed|refereed|published in a journal)\b/i;
const VENDOR_SUPERIORITY =
  /\b(vendor|commercial|industry|product|proprietary)\b[^.]{0,80}\b(more (?:reliable|credible|trustworthy|relevant|useful)|better evidence|outweighs?|stronger than|superior to|more convincing)\b[^.]{0,60}\b(academic|research|peer[-\s]reviewed|university|scholarly)\b/i;
const PROMISE = /\b(described|discussed|examined|analysed|analyzed|detailed|explained)\s+(?:in\s+)?(?:more\s+)?(?:detail\s+)?in\s+the\s+(?:following|next)\s+(?:paragraphs?|section|subsection)\b/i;

/**
 * Quoted fragments, in double *or* single quotes. Student chapters use both, and
 * a double-quote-only pattern misses a whole class of quote-mining. Apostrophes
 * are excluded by requiring the opening mark to follow a boundary and the closing
 * mark to precede one, so "the organisation's tickets" is not read as a quotation.
 */
const DOUBLE_QUOTE = /["“]([^"”\n]{12,300})["”]/g;
const SINGLE_QUOTE = /(?<=^|[\s([])['‘]([^'’\n]{12,300})['’](?=[\s.,;:)\]!?]|$)/gu;

export function quotationsIn(text: string): string[] {
  return [
    ...[...text.matchAll(DOUBLE_QUOTE)].map((m) => m[1]),
    ...[...text.matchAll(SINGLE_QUOTE)].map((m) => m[1]),
  ];
}

function referencesOf(claim: Claim, byId: Map<string, ReferenceEntry>): ReferenceEntry[] {
  return claim.citations
    .map((citation) => (citation.referenceId ? byId.get(citation.referenceId) : undefined))
    .filter((reference): reference is ReferenceEntry => reference !== undefined);
}

// ---------------------------------------------------------------------------

function checkBlockCitations(claim: Claim, references: ReferenceEntry[]): IntegrityFinding[] {
  const distinct = new Set(claim.citations.map((c) => c.marker));
  if (distinct.size < 3) return [];

  const unresolved = claim.citations.filter((c) => !c.referenceId).map((c) => c.marker);
  const suspect = references.filter(
    (r) => r.authenticity?.status === "notFound" || r.authenticity?.status === "suspicious",
  );

  return [
    finding({
      mode: "undifferentiated-block-citation",
      level: "use",
      severity: distinct.size >= 5 ? "major" : "moderate",
      confidence: "confirmed",
      summary: `${distinct.size} sources cited behind one statement`,
      detail: `"${truncate(claim.text, 180)}" attributes a single claim to ${[...distinct].join(", ")} with no indication which source supports which part.${
        suspect.length > 0
          ? ` The block also conceals the weakness of its own membership: ${suspect.map((r) => r.marker).join(", ")} did not verify.`
          : ""
      }${unresolved.length > 0 ? ` ${unresolved.join(", ")} resolve to no entry at all.` : ""}`,
      claimId: claim.id,
      markers: [...distinct],
      question: `Take the strongest source in that block. Which exact part of this sentence does it establish, and what do the others add?`,
    }),
  ];
}

function checkAbsolutes(claim: Claim, references: ReferenceEntry[]): IntegrityFinding[] {
  if (!ABSOLUTE.test(claim.text) || HEDGE.test(claim.text)) return [];
  return [
    finding({
      mode: "unsupported-claim",
      level: "use",
      severity: "major",
      confidence: "needs-evidence",
      summary: "An absolute claim rests on a bounded source",
      detail: `"${truncate(claim.text, 180)}" is stated without qualification. A single study establishes a result under its own conditions; the quantifier has to come from somewhere.${references.length > 0 ? ` Cited: ${references.map((r) => r.marker).join(", ")}.` : ""}`,
      claimId: claim.id,
      markers: claim.citations.map((c) => c.marker),
      question: "Which population, dataset or setting did the source measure, and does your sentence stay inside it?",
    }),
  ];
}

function checkSecondaryForPrimary(claim: Claim, references: ReferenceEntry[]): IntegrityFinding[] {
  if (!STATISTIC.test(claim.text)) return [];
  const reviews = references.filter((r) => SECONDARY_TITLE_PATTERN.test(r.title ?? ""));
  if (reviews.length === 0) return [];

  return reviews.map((reference) =>
    finding({
      mode: "citation-chaining",
      level: "use",
      severity: "major",
      confidence: "confirmed",
      summary: `A primary figure is attributed to a review (${reference.marker})`,
      detail: `"${truncate(claim.text, 160)}" carries a specific figure sourced to "${reference.title}", which is a review or survey. A review synthesises primary results; it does not produce experimental findings. Either the figure belongs to a primary study that should be cited instead, or it has no source. This is establishable from the title alone.`,
      reference,
      claimId: claim.id,
      question: `Which primary study produced that figure? Cite it directly rather than through ${reference.marker}.`,
    }),
  );
}

function checkCurrency(claim: Claim, references: ReferenceEntry[]): IntegrityFinding[] {
  if (!CURRENCY.test(claim.text)) return [];
  const stale = references.filter((r) => r.year !== undefined && CURRENT_YEAR - r.year >= 8);
  if (stale.length === 0) return [];

  return [
    finding({
      mode: "superseded-source-as-current",
      level: "use",
      severity: "major",
      confidence: "needs-evidence",
      summary: `Work from ${stale.map((r) => r.year).join(", ")} is presented as the current state of the art`,
      detail: `"${truncate(claim.text, 170)}" claims currency for ${stale.map((r) => `${r.marker} (${r.year})`).join(", ")}. The metadata may be correct and the source sound while the claim about its standing is still wrong.`,
      claimId: claim.id,
      markers: stale.map((r) => r.marker),
      question: "What has been published since on the same problem, and why is this still the state of the art?",
    }),
  ];
}

function checkSourceTypeForClaim(claim: Claim, references: ReferenceEntry[]): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const carriesFigure = STATISTIC.test(claim.text);

  for (const reference of references) {
    const url = reference.url ?? "";
    const isGrey = VENDOR_BLOG_PATTERN.test(url) || MARKET_REPORT_PATTERN.test(reference.raw);
    if (carriesFigure && isGrey) {
      out.push(
        finding({
          mode: "non-scholarly-source-as-scholarship",
          level: "use",
          severity: "major",
          confidence: "confirmed",
          summary: `An effect size is sourced to ${hostOf(url) || "promotional material"}`,
          detail: `"${truncate(claim.text, 160)}" takes a precise figure from ${reference.marker}, which is promotional or analyst material rather than a study. The question is not what kind of source it is but what it is asked to support: the same publisher's documentation would be fine for describing a feature, and is not fine for an effect size.`,
          reference,
          claimId: claim.id,
          question: `What method produced that number, and is it reproduced in any peer-reviewed work?`,
        }),
      );
    }

    if (PEER_REVIEW_CLAIM.test(claim.text)) {
      const preprint = Boolean(reference.arxivId) || PREPRINT_HOST_PATTERN.test(url) || /arxiv/i.test(reference.venue ?? "");
      const grey = !isScholarly(reference);
      if (preprint || grey) {
        out.push(
          finding({
            mode: "misleading-source-equivalence",
            level: "use",
            severity: "major",
            confidence: "confirmed",
            summary: `Described as peer reviewed, but ${reference.marker} is ${preprint ? "a preprint" : "not a scholarly source"}`,
            detail: `"${truncate(claim.text, 160)}" claims peer review. The entry gives ${preprint ? `a preprint record${reference.arxivId ? ` (arXiv:${reference.arxivId})` : ""}` : `${hostOf(url) || "a non-scholarly source"}`}. Peer review is a property of the version cited, not of the work in the abstract.`,
            reference,
            claimId: claim.id,
            question: `Was the version you read refereed? If a published version exists, cite that; if not, drop the phrase.`,
          }),
        );
      }
    }
  }
  return out;
}

function checkAttribution(claim: Claim, references: ReferenceEntry[]): IntegrityFinding[] {
  // "Rahman et al. examined ... [10]" where [10] is by someone else.
  const named = /\b([A-Z][A-Za-z'’\u00c0-\u024f-]{2,})\s+(?:et\s+al\.?|and\s+colleagues|and\s+co-?workers)/.exec(
    claim.text,
  );
  if (!named || references.length === 0) return [];
  const prosesurname = foldForCompare(named[1]);
  if (prosesurname.length < 3) return [];

  const matches = references.some((reference) =>
    reference.authors.some((author) => {
      const surname = surnameOf(author);
      return surname.includes(prosesurname) || prosesurname.includes(surname);
    }),
  );
  if (matches) return [];

  const reference = references[0];
  return [
    finding({
      mode: "inconsistent-in-text-attribution",
      level: "use",
      severity: "major",
      confidence: "confirmed",
      summary: `The prose credits "${named[1]}" but ${reference.marker} is by ${reference.authors.slice(0, 2).join(", ") || "other authors"}`,
      detail: `"${truncate(claim.text, 170)}" names ${named[1]} while the marker points at ${reference.marker}: ${truncate(reference.raw, 110)}. Under a numeric system the mismatch is invisible on the page, which is why it survives to submission.`,
      reference,
      claimId: claim.id,
      question: `Is ${named[1]} the author of ${reference.marker}? If not, which source did you mean?`,
    }),
  ];
}

function checkQuotations(claim: Claim, references: ReferenceEntry[]): IntegrityFinding[] {
  const quotes = quotationsIn(claim.text);
  if (quotes.length === 0) return [];
  const out: IntegrityFinding[] = [];

  for (const reference of references) {
    const unreachable =
      reference.authenticity?.status === "notFound" ||
      (!reference.doi && !reference.url && !reference.arxivId);
    out.push(
      finding({
        mode: "fabricated-quotation",
        level: "use",
        severity: unreachable ? "major" : "moderate",
        confidence: "needs-evidence",
        summary: `A verbatim quotation is attributed to ${reference.marker}`,
        detail: `Quotation marks assert word-for-word reproduction: "${truncate(quotes[0], 120)}". ${
          unreachable
            ? `${reference.marker} cannot be reached from the metadata supplied, so the quotation can be neither confirmed nor refuted here.`
            : `Confirm it appears in ${reference.marker} exactly as printed, including the surrounding qualification.`
        }`,
        reference,
        claimId: claim.id,
        question: "Paste the sentence from the source that contains this quotation, with the words either side of it.",
        guardNote: "Recorded as unverifiable rather than fabricated: the tool has no access to the source text.",
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Passage- and document-level use checks
// ---------------------------------------------------------------------------

/** Numeric claims with no citation anywhere in the sentence. */
function checkMissingCitations(document: ReportDocument): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const bodyEnd = document.claims.length > 0 ? Math.max(...document.claims.map((c) => c.charEnd)) : 0;

  for (const page of document.pages) {
    if (page.charStart > bodyEnd) continue;
    const sentences = splitBlocks(page.text, page.charStart).flatMap((block) =>
      splitSentences(block.text, block.start),
    );
    for (const sentence of sentences) {
      if (sentence.start > bodyEnd) continue;
      const text = sentence.text.replace(/\s+/g, " ");
      if (!STATISTIC.test(text)) continue;
      if (findCitations(text, 0).length > 0) continue;
      if (text.split(/\s+/).length < 6) continue;
      // Figures the report produces itself are not citation failures.
      if (/\b(we|our|this (?:report|project|chapter|study)|proposed|target|requirement)\b/i.test(text)) continue;

      out.push(
        finding({
          mode: "missing-citation",
          level: "use",
          severity: "major",
          confidence: "confirmed",
          summary: "A precise figure carries no citation",
          detail: `"${truncate(text, 170)}" (page ${page.index}) states a specific quantity with no source, in a chapter that cites elsewhere. Unattributed numbers are what a marker checks first.`,
          markers: [],
          question: "Where does that figure come from? If it is your own estimate, say so in the sentence.",
        }),
      );
    }
  }
  return out.slice(0, 12);
}

/** Sequences of one-source sentences with nothing relating them. */
function checkSynthesis(document: ReportDocument): IntegrityFinding[] {
  const claims = [...document.claims].sort((a, b) => a.charStart - b.charStart);
  const out: IntegrityFinding[] = [];
  let run: Claim[] = [];

  const flush = (): void => {
    if (run.length >= 3) {
      const distinct = new Set(run.flatMap((c) => c.citations.map((x) => x.marker)));
      if (distinct.size >= 3) {
        out.push(
          finding({
            mode: "descriptive-listing-without-synthesis",
            level: "use",
            severity: "moderate",
            confidence: "confirmed",
            summary: `${run.length} consecutive sentences each cite one source with nothing relating them`,
            detail: `Sources ${[...distinct].join(", ")} are described in sequence from page ${run[0].page}. No comparison, agreement, disagreement or criterion appears between them, so the passage lists rather than synthesises.${
              /\b(chronolog|then|later|subsequent|followed by|in \d{4})\b/i.test(run.map((c) => c.text).join(" "))
                ? " The ordering is chronological, which is not itself a relation between the findings."
                : ""
            }`,
            claimId: run[0].id,
            markers: [...distinct],
            question: "Where do two of these sources disagree, and which would you rely on for your design?",
          }),
        );
      }
    }
    run = [];
  };

  for (const claim of claims) {
    const single = new Set(claim.citations.map((c) => c.marker)).size === 1;
    const relates = COMPARATIVE_CUE.test(claim.text);
    const contiguous = run.length === 0 || claim.charStart - run[run.length - 1].charEnd < 400;
    if (single && !relates && contiguous) run.push(claim);
    else flush();
  }
  flush();
  return out.slice(0, 4);
}

function checkCriticalEvaluation(document: ReportDocument): IntegrityFinding[] {
  const claims = document.claims;
  if (claims.length < 6) return [];
  const withCritique = claims.filter((claim) => CRITICAL_CUE.test(claim.text));
  const share = withCritique.length / claims.length;
  if (share >= 0.15) return [];

  return [
    finding({
      mode: "lack-of-critical-evaluation",
      level: "use",
      severity: "major",
      confidence: "confirmed",
      summary: `Only ${withCritique.length} of ${claims.length} cited sentences name any limitation or contrast`,
      detail: `Across the chapter, ${Math.round(share * 100)}% of cited sentences contain any evaluative language - a limitation, a caveat, a comparison or a condition. Methods, credibility, applicability and conflicting findings are not addressed, so the review reports rather than judges.`,
      question: "Pick your two most important sources. What is the weakness of each, and where do they conflict?",
    }),
  ];
}

/**
 * Quotation density over the whole body, not only cited sentences: a passage
 * built from quoted fragments often carries its marker on a neighbouring
 * sentence, so counting claims alone undercounts it.
 */
function checkQuotationDensity(document: ReportDocument): IntegrityFinding[] {
  const bodyEnd = document.claims.length > 0 ? Math.max(...document.claims.map((c) => c.charEnd)) : 0;
  const quotes: { text: string; page: number }[] = [];

  // Only *attributed* quotations count: the sentence either carries a citation
  // marker or says whose words these are. Quoted illustrative strings ("the user
  // writes 'cannot access payroll'") are not claims about a source.
  const ATTRIBUTION =
    /\b(as (?:its|the|those) authors?|the same authors?|those authors?|they (?:note|observe|state|write|argue)|authors? (?:note|observe|state|write|argue|put it)|according to|states? that|writes? that|puts? it|reports? that|describes?)\b/i;

  for (const page of document.pages) {
    if (bodyEnd > 0 && page.charStart > bodyEnd) continue;
    for (const block of splitBlocks(page.text, page.charStart)) {
      for (const sentence of splitSentences(block.text, block.start)) {
        const found = quotationsIn(sentence.text);
        if (found.length === 0) continue;
        const attributed =
          /\[\d{1,3}\]/.test(sentence.text) ||
          /\((?:19|20)\d{2}\)/.test(sentence.text) ||
          ATTRIBUTION.test(sentence.text);
        if (!attributed) continue;
        for (const quote of found) quotes.push({ text: quote, page: page.index });
      }
    }
  }
  if (quotes.length < 3) return [];

  const pages = [...new Set(quotes.map((q) => q.page))];
  const nearby = document.claims.filter((claim) => pages.includes(claim.page));
  return [
    finding({
      mode: "overreliance-on-quotation",
      level: "use",
      severity: "moderate",
      confidence: "confirmed",
      summary: `${quotes.length} quoted fragments carry the argument`,
      detail: `Quotations appear on page(s) ${pages.join(", ")}, beginning "${truncate(quotes[0].text, 80)}". Where quoted fragments are strung together, the comparison the student should be making is left to the reader - and each quotation asserts verbatim reproduction that has to be checkable.`,
      claimId: nearby[0]?.id,
      markers: [...new Set(nearby.flatMap((c) => c.citations.map((x) => x.marker)))].slice(0, 6),
      question: "Restate the quoted point in your own words. What does the quotation commit you to that a paraphrase would not?",
    }),
  ];
}

function checkRhetoric(document: ReportDocument): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const text = document.fullText;

  const superiority = VENDOR_SUPERIORITY.exec(text);
  if (superiority) {
    out.push(
      finding({
        mode: "misleading-source-equivalence",
        level: "use",
        severity: "major",
        confidence: "confirmed",
        summary: "The chapter argues that vendor evidence outranks peer review",
        detail: `"${truncate(superiority[0], 200)}" Deployment scale and paid adoption are not substitutes for transparent method, comparators or reproducibility. Vendor pages document availability; research tests efficacy under stated conditions.`,
        question: "What would a vendor page have to contain before it could settle a question of effectiveness?",
      }),
    );
  }

  const promise = PROMISE.exec(text);
  if (promise) {
    // The promise is broken when the section ends straight afterwards: take the
    // text up to the next heading rather than a fixed window, since a numbered
    // heading may follow immediately.
    const from = (promise.index ?? 0) + promise[0].length;
    const rest = text.slice(from, from + 1200);
    const heading = /\n[ \t]*(?:\d+(?:\.\d+)*[.)]?\s+[A-Z]|[A-Z][A-Za-z ,&-]{3,60}\n)/.exec(rest);
    const untilHeading = heading ? rest.slice(0, heading.index) : rest.slice(0, 400);
    if (untilHeading.replace(/\s/g, "").length < 200) {
      out.push(
        finding({
          mode: "poor-citation-integration",
          level: "use",
          severity: "moderate",
          confidence: "confirmed",
          summary: "A promised discussion never arrives",
          detail: `The text says the work is "${truncate(promise[0], 90)}" and then ends the section. The citation is left with no evidential role.`,
          question: "Either write the discussion you promised, or remove the promise and the citation with it.",
        }),
      );
    }
  }

  return out;
}

export function checkUse(document: ReportDocument): IntegrityFinding[] {
  const byId = new Map(document.references.map((reference) => [reference.id, reference] as const));
  const out: IntegrityFinding[] = [];

  for (const claim of document.claims) {
    const references = referencesOf(claim, byId);
    out.push(
      ...checkBlockCitations(claim, references),
      ...checkAbsolutes(claim, references),
      ...checkSecondaryForPrimary(claim, references),
      ...checkCurrency(claim, references),
      ...checkSourceTypeForClaim(claim, references),
      ...checkAttribution(claim, references),
      ...checkQuotations(claim, references),
    );
  }

  out.push(
    ...checkMissingCitations(document),
    ...checkSynthesis(document),
    ...checkCriticalEvaluation(document),
    ...checkQuotationDensity(document),
    ...checkRhetoric(document),
  );
  return out;
}
