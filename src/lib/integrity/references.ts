import { doiSuffixYear, SECONDARY_TITLE_PATTERN } from "../parsing/references";
import {
  finding,
  hostOf,
  isScholarly,
  venuesAgree,
  looksLikeAffiliationAsAuthor,
  looksLikeOrganisation,
  MARKET_REPORT_PATTERN,
  PREPRINT_HOST_PATTERN,
  QUESTIONABLE_VENUE_PATTERN,
  surnameOf,
  VENDOR_BLOG_PATTERN,
  VENDOR_DOCS_PATTERN,
} from "./util";
import type { IntegrityFinding, ReferenceEntry, ReportDocument } from "@/types";

/**
 * Reference- and source-level checks: what the citation asserts, and what the
 * source is. Checks that need no network run always; checks that need a
 * registry record run only when a verdict is present, and say so.
 */

const CURRENT_YEAR = new Date().getFullYear();

// ---------------------------------------------------------------------------
// Offline: locator and metadata hygiene
// ---------------------------------------------------------------------------

function checkLocator(reference: ReferenceEntry): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const url = reference.url ?? "";

  if (reference.doiAsWritten) {
    out.push(
      finding({
        mode: "malformed-locator",
        level: "reference",
        severity: "major",
        confidence: "confirmed",
        summary: "The DOI is printed with Unicode dashes and will never resolve as written",
        detail: `Printed as "${reference.doiAsWritten}" using non-ASCII hyphen characters (U+2010-U+2015). The ASCII form "${reference.doi}" is what a resolver needs. Retype the DOI rather than copying it from a styled document.`,
        reference,
        question: "Where did you copy this DOI from, and does it resolve when you paste it into doi.org?",
      }),
    );
  }

  if (/#:~:text=/.test(url)) {
    out.push(
      finding({
        mode: "reference-manager-debris",
        level: "structural",
        severity: "moderate",
        confidence: "confirmed",
        summary: "The URL carries a browser scroll-to-text fragment",
        detail: `The locator ends in a "#:~:text=" fragment left behind by a copy-link-to-highlight action: ${url}. It is debris from the capture, not part of the address, and suggests the rest of this entry was pasted rather than checked.`,
        reference,
      }),
    );
  }

  if (/https?:\/\/.*https?:\/\//.test(url)) {
    out.push(
      finding({
        mode: "malformed-locator",
        level: "reference",
        severity: "moderate",
        confidence: "confirmed",
        summary: "The URL contains a duplicated scheme",
        detail: `Two schemes appear in one locator: ${url}`,
        reference,
      }),
    );
  }

  // A locator that was clearly never followed: a query-string download script or
  // a bare directory standing in for a specific section.
  if (/download\.php\?|\/get\.php\?|\?id=\d+$/i.test(url)) {
    out.push(
      finding({
        mode: "broken-or-unavailable-link",
        level: "reference",
        severity: "major",
        confidence: "needs-evidence",
        summary: "The locator is a download script on an unidentifiable host",
        detail: `${url} names no publisher, venue or identifier. Nothing about it establishes what was retrieved or from whom.`,
        reference,
        question: "Can you open this link now, and what publisher or repository does it belong to?",
        guardNote:
          "A currently broken link may once have worked, so this is recorded as needing evidence rather than as fabrication.",
      }),
    );
  }

  const namesSection = /\b(section|chapter|working with|part\s+\d)\b/i.test(
    `${reference.title ?? ""} ${reference.locator ?? ""}`,
  );
  if (namesSection && /\/$/.test(url)) {
    out.push(
      finding({
        mode: "mutable-source-undocumented",
        level: "source",
        severity: "moderate",
        confidence: "needs-evidence",
        summary: "A named section is cited, but the URL points at the document root",
        detail: `The entry names a specific section while the locator (${url}) is a directory. Living documentation cited at directory level cannot be followed to the claim, and section headings are renamed between releases.${reference.accessedDate ? ` An access date (${reference.accessedDate}) is supplied, which does not make the URL specific enough.` : ""}`,
        reference,
        question: "Paste the exact URL and heading you read. Does that heading still exist on the page today?",
      }),
    );
  }

  return out;
}

function checkIdentifiers(reference: ReferenceEntry): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const hasIdentifier = Boolean(reference.doi || reference.url || reference.arxivId);

  if (!hasIdentifier) {
    if (reference.isStandard) {
      // Guard: a published standard is the primary source for what it specifies.
      return out;
    }
    // A named journal with no identifier is a real gap. A well-known
    // conference proceedings without a DOI is ordinary bibliographic practice,
    // so it is recorded as an advisory rather than an accusation.
    const namesJournal = Boolean(
      reference.venue && /journal|transactions|letters|magazine|quarterly|review/i.test(reference.venue),
    );
    const knownConference =
      /\b(proc(?:\.|eedings)?|conference|workshop|symposium|congress|annual meeting|advances in neural information processing|ICML|NeurIPS|NIPS|ICLR|CVPR|ICCV|ECCV|AAAI|IJCAI|ACL|EMNLP|NAACL|KDD|SIGIR|SIGGRAPH|ICRA|IROS|INTERSPEECH|MICCAI|LNCS)\b/i.test(
        `${reference.venue ?? ""} ${reference.raw}`,
      );

    out.push(
      finding({
        mode: "incorrect-or-incomplete-metadata",
        level: "reference",
        severity: namesJournal ? "major" : knownConference ? "advisory" : "moderate",
        confidence: "needs-evidence",
        summary: knownConference
          ? "No DOI or link supplied for a conference paper"
          : "No DOI, URL or repository identifier - the source cannot be located even in principle",
        detail: knownConference
          ? `${reference.marker} names ${reference.venue ? `"${reference.venue}"` : "a proceedings venue"} without an identifier. Proceedings are often cited this way and the entry may be perfectly correct; adding a DOI or link only makes it traceable.`
          : `${reference.marker} supplies ${reference.venue ? `a venue ("${reference.venue}")` : "no venue"} but no identifier of any kind. A reader cannot reach it, and neither can a checker. On its own this is suggestive rather than decisive - fabricated entries frequently have nothing to link to, and so do some genuine ones.`,
        reference,
        question: knownConference
          ? undefined
          : "Give the DOI or a stable link for this source. Where did you read it?",
        guardNote: knownConference
          ? "Downgraded to advisory: proceedings and article-number publication structures are legitimately cited without DOIs."
          : "Standards, legislation and official documentation legitimately lack DOIs and are exempt from this check; this entry does not look like one.",
      }),
    );
  }

  if (reference.year === undefined && !reference.isStandard) {
    out.push(
      finding({
        mode: "incorrect-or-incomplete-metadata",
        level: "reference",
        severity: "moderate",
        confidence: "confirmed",
        summary: "No publication year",
        detail: `No year could be read from ${reference.marker}: "${reference.raw.slice(0, 120)}".`,
        reference,
      }),
    );
  }

  const doiYear = doiSuffixYear(reference.doi);
  if (doiYear && reference.year && Math.abs(doiYear - reference.year) > 1) {
    out.push(
      finding({
        mode: "wrong-date",
        level: "reference",
        severity: "major",
        confidence: "confirmed",
        summary: `Entry dated ${reference.year}, but its own DOI encodes ${doiYear}`,
        detail: `The DOI ${reference.doi} carries ${doiYear} in its suffix while the entry states ${reference.year}. No lookup is needed to see the contradiction; one of the two is wrong.`,
        reference,
        question: `Which year is right for ${reference.marker}, and did you take the date from the record or from another citation of it?`,
      }),
    );
  }

  return out;
}

function checkAuthorForm(reference: ReferenceEntry): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  if (reference.authors.length === 0) return out;

  for (const author of reference.authors) {
    if (looksLikeAffiliationAsAuthor(author, reference.authors)) {
      out.push(
        finding({
          mode: "incorrect-or-incomplete-metadata",
          level: "reference",
          severity: "major",
          confidence: "confirmed",
          summary: `"${author}" is an affiliation recorded as a person`,
          detail: `The author list of ${reference.marker} contains "${author}" beside personal names. This is the signature of an affiliation being imported into an author field (for example Google Brain becoming "G. Brain"). Check the author list against the paper's own title page.`,
          reference,
          question: `Who are the actual authors of ${reference.marker}? Read them off the paper, not the reference manager.`,
          guardNote:
            "Unusual and one-letter surnames are not flagged by this check; it fires only on initials followed by a corporate word inside a list of people.",
        }),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Source level
// ---------------------------------------------------------------------------

function checkSourceType(reference: ReferenceEntry): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const url = reference.url ?? "";
  const host = hostOf(url);

  if (QUESTIONABLE_VENUE_PATTERN.test(reference.venue ?? "") || QUESTIONABLE_VENUE_PATTERN.test(reference.raw)) {
    out.push(
      finding({
        mode: "questionable-venue",
        level: "source",
        severity: "major",
        confidence: "needs-evidence",
        summary: "The venue matches patterns associated with weakly vetted publishing",
        detail: `"${reference.venue ?? reference.raw.slice(0, 90)}" follows the naming style of journals that solicit fees with minimal review. A DOI does not establish editorial quality. Corroborate anything load-bearing from this entry with an indexed source.`,
        reference,
        question: `What is the review process of the venue behind ${reference.marker}, and is the claim you draw from it corroborated anywhere indexed?`,
      }),
    );
  }

  if (MARKET_REPORT_PATTERN.test(reference.raw)) {
    out.push(
      finding({
        mode: "mutable-source-undocumented",
        level: "source",
        severity: "moderate",
        confidence: "needs-evidence",
        summary: "Market or analyst material cited as evidence",
        detail: `${reference.marker} is a market or analyst report. Its figures are typically gated, revised without notice, and produced without a published method.${reference.accessedDate ? "" : " No access date is recorded."}`,
        reference,
        question: "What method produced this figure, and can it be attributed to a dated, retrievable version?",
      }),
    );
  }

  if (VENDOR_BLOG_PATTERN.test(url) && !VENDOR_DOCS_PATTERN.test(url)) {
    out.push(
      finding({
        mode: "non-scholarly-source-as-scholarship",
        level: "source",
        severity: "moderate",
        confidence: "needs-evidence",
        summary: "Vendor or blog material in a scholarly reference list",
        detail: `${reference.marker} resolves to ${host || url}, which is promotional or editorial rather than peer-reviewed. That is not automatically a fault - it becomes one the moment the entry is asked to carry an effect size or a comparative result.`,
        reference,
        guardNote:
          "Vendor documentation is the correct primary source for the behaviour of the vendor's own product, and is exempted; this URL is not documentation.",
      }),
    );
  }

  if (!reference.accessedDate && url && !reference.doi && !reference.arxivId) {
    out.push(
      finding({
        mode: "mutable-source-undocumented",
        level: "source",
        severity: "moderate",
        confidence: "confirmed",
        summary: "A web source is cited with no access date",
        detail: `${reference.marker} is reachable only through ${host || url} and records no access date, so the version consulted cannot be identified after the page changes.`,
        reference,
        question: "When did you read this page, and can you archive the version you used?",
      }),
    );
  }

  return out;
}

function checkVersion(reference: ReferenceEntry): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const url = reference.url ?? "";
  const onPreprintHost = PREPRINT_HOST_PATTERN.test(url) || Boolean(reference.arxivId);
  if (!onPreprintHost) return out;

  const verdict = reference.authenticity;
  const registryIsPublished =
    verdict?.status === "verified" && verdict.isPreprint === false && Boolean(verdict.containerTitle);

  out.push(
    finding({
      mode: "version-mismatch",
      level: "reference",
      severity: registryIsPublished ? "major" : "moderate",
      confidence: registryIsPublished ? "confirmed" : "needs-evidence",
      summary: registryIsPublished
        ? "A preprint or mirror is cited although the version of record exists"
        : "A preprint or mirror is cited - check whether a version of record exists",
      detail: registryIsPublished
        ? `${reference.marker} points at ${hostOf(url) || "a preprint host"}, but the registry holds a published version in ${verdict?.containerTitle}${verdict?.year ? ` (${verdict.year})` : ""}. Cite the version of record; page numbers and wording can differ.`
        : `${reference.marker} points at ${hostOf(url) || "arXiv"}. If this work was later published, the published version is what should be cited, and only that version can be described as peer reviewed.`,
      reference,
      question: `Has ${reference.marker} appeared in a journal or proceedings? If so, why cite the preprint?`,
      guardNote:
        "No fault exists where no final version was published, or where the preprint version is deliberately the object of discussion.",
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// Registry-dependent checks
// ---------------------------------------------------------------------------

function checkAgainstRegistry(
  reference: ReferenceEntry,
  document: ReportDocument,
): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const verdict = reference.authenticity;
  if (!verdict || verdict.status === "unverified") return out;

  // Guard: standards, statutes and official specifications are not indexed in
  // Crossref or OpenAlex. Absence there says nothing about them, and reporting it
  // would penalise the correct primary source for an engineering requirement.
  if (reference.isStandard) return out;

  if (verdict.status === "notFound") {
    // Fabrication is only *asserted* when there was an identifier to test. A
    // failed title search proves nothing on its own: Crossref and OpenAlex do not
    // index PMLR/NeurIPS proceedings, most books, standards or vendor
    // documentation, so calling those entries fabricated blames the student for a
    // gap in the registries.
    if (reference.doi) {
      out.push(
        finding({
          mode: "fabricated-reference",
          level: "reference",
          severity: "critical",
          confidence: "confirmed",
          summary: "The DOI is well formed but resolves to nothing",
          detail: `${reference.doi} uses a real registrant prefix, so it passes format validation, yet neither Crossref nor OpenAlex holds it. A DOI that looks right and resolves to nothing is the signature of a fabricated reference. Any figure attributed to ${reference.marker} has no traceable source.`,
          reference,
          question: `Show where you obtained ${reference.marker}. Can you open the source and point to the passage you used?`,
        }),
      );
      return out;
    }

    const unindexedByDesign =
      /\b(proc(?:\.|eedings)?|conference|workshop|symposium|advances in neural information processing|ICML|NeurIPS|NIPS|ICLR|CVPR|ICCV|ECCV|AAAI|ACL|EMNLP|PMLR|LNCS)\b/i.test(
        `${reference.venue ?? ""} ${reference.raw}`,
      ) || /\b(documentation|developer guide|user guide|manual|white ?paper|blog)\b/i.test(reference.raw);

    out.push(
      finding({
        mode: "incorrect-or-incomplete-metadata",
        level: "reference",
        severity: unindexedByDesign ? "advisory" : "moderate",
        confidence: "needs-evidence",
        summary: unindexedByDesign
          ? "Not corroborated by a registry, which is expected for this source type"
          : "No registry record could be matched to this entry",
        detail: `A title search for "${reference.title ?? reference.raw.slice(0, 80)}" returned no match in Crossref or OpenAlex${reference.url ? `, and the entry offers only a URL (${hostOf(reference.url) || reference.url})` : ", and the entry supplies no identifier"}. ${
          unindexedByDesign
            ? "Neither registry indexes conference proceedings from PMLR/NeurIPS-style publishers, or vendor documentation, so this says nothing about whether the source exists."
            : "That is suggestive rather than decisive: these two registries do not cover books, regional venues or grey literature. Supply a DOI or stable link so it can be checked."
        }`,
        reference,
        question: unindexedByDesign
          ? undefined
          : `Where did you read ${reference.marker}? A DOI or stable link would settle it.`,
        guardNote:
          "Absence from these two registries is never reported as fabrication; fabrication is only asserted when a supplied DOI fails to resolve.",
      }),
    );
    return out;
  }

  // Identifier resolves, but to a different work.
  if (typeof verdict.titleOverlap === "number" && verdict.titleOverlap < 0.5 && verdict.matchedTitle) {
    out.push(
      finding({
        mode: "identifier-mismatch",
        level: "reference",
        severity: "critical",
        confidence: "confirmed",
        summary: "The DOI resolves to a different work",
        detail: `${reference.doi} is live, but it returns "${verdict.matchedTitle}"${verdict.year ? ` (${verdict.year})` : ""}, not "${reference.title}". Testing whether a DOI resolves is not enough; the resolved title has to match the cited one.`,
        reference,
        question: `Which work did you actually read for ${reference.marker} - the one you titled, or the one this DOI returns?`,
      }),
    );
  }

  if (verdict.year && reference.year && Math.abs(verdict.year - reference.year) > 1) {
    out.push(
      finding({
        mode: "wrong-date",
        level: "reference",
        severity: "moderate",
        confidence: "confirmed",
        summary: `The registry records ${verdict.year}, the entry says ${reference.year}`,
        detail: `Registry record for ${reference.doi ?? reference.marker}: ${verdict.year}. Entry: ${reference.year}. Preprint, online-first and issue dates are commonly confused.`,
        reference,
      }),
    );
  }

  if (verdict.isRetracted) {
    const when = verdict.retractionDate ? ` on ${verdict.retractionDate}` : "";
    const notice = verdict.retractionNoticeDoi
      ? ` The retraction notice is ${verdict.retractionNoticeDoi} - read it: the stated reason determines what, if anything, survives.`
      : " Search the journal's site for the retraction notice; the stated reason determines what, if anything, survives.";
    const citingSentences = document.claims
      .filter((claim) => claim.citations.some((citation) => citation.referenceId === reference.id))
      .map((claim) => `p.${claim.page}`);

    out.push(
      finding({
        mode: "inappropriate-or-discredited-source",
        level: "source",
        severity: "critical",
        confidence: "confirmed",
        summary: `${reference.marker} was formally retracted${when}`,
        detail: `The registry record for ${reference.doi ?? reference.marker} is marked retracted${when}. A retraction withdraws the findings from the literature: they are no longer available as evidence, whatever the paper still says.${notice} Retractions issued for data fabrication or a methodological error invalidate the results outright; one issued for an authorship dispute or a duplicate submission may leave the findings standing while the citation still needs replacing.${
          citingSentences.length > 0
            ? ` This source currently supports claims at ${[...new Set(citingSentences)].join(", ")}.`
            : ""
        }`,
        reference,
        question: `This DOI points to a paper that was formally retracted. What was the stated reason for the retraction, and how does that reason bear on the specific claim you are making with ${reference.marker}?`,
        guardNote:
          "Citing retracted work is legitimate when the retraction, or the work's historical influence, is itself the subject - in which case say so in the sentence.",
      }),
    );
  }

  if (verdict.isRetractionNotice) {
    out.push(
      finding({
        mode: "inappropriate-or-discredited-source",
        level: "source",
        severity: "major",
        confidence: "confirmed",
        summary: `${reference.marker} is a retraction notice, not a study`,
        detail: `The record for ${reference.doi ?? reference.marker} is the notice that retracts another work${verdict.matchedTitle ? ` ("${verdict.matchedTitle}")` : ""}. A notice is typically a paragraph and reports no findings, so no result can be attributed to it. This usually means the original paper's DOI was replaced by its notice's DOI somewhere in the copy chain.`,
        reference,
        question: `Did you mean to cite the retraction notice, or the paper it retracts? If the paper, it has been withdrawn - what are you using it for?`,
        guardNote:
          "Citing the notice itself is correct when the retraction event is what is being discussed.",
      }),
    );
  }

  if (verdict.hasExpressionOfConcern && !verdict.isRetracted) {
    out.push(
      finding({
        mode: "inappropriate-or-discredited-source",
        level: "source",
        severity: "major",
        confidence: "needs-evidence",
        summary: `An expression of concern has been issued about ${reference.marker}`,
        detail: `The registry records an expression of concern for ${reference.doi ?? reference.marker}. The journal has publicly questioned the work without withdrawing it, so its findings are contested rather than void. Anything load-bearing drawn from it should be corroborated by an unaffected source.`,
        reference,
        question: `What concern did the journal raise about ${reference.marker}, and is the specific result you rely on affected by it?`,
        guardNote:
          "An expression of concern is not a retraction: the work may yet be cleared, so this is reported as needing your evidence rather than as a fault.",
      }),
    );
  }

  // Author comparison. Only fires when the registry gave us a list to compare.
  const registryAuthors = verdict.registryAuthors ?? [];
  if (registryAuthors.length > 0 && reference.authors.length > 0) {
    const registrySurnames = registryAuthors.map(surnameOf).filter(Boolean);
    const entrySurnames = reference.authors
      .filter((author) => !looksLikeOrganisation(author))
      .map(surnameOf)
      .filter(Boolean);

    const unmatched = entrySurnames.filter(
      (surname) => !registrySurnames.some((known) => known.includes(surname) || surname.includes(known)),
    );

    if (unmatched.length > 0 && entrySurnames.length > 0) {
      const allWrong = unmatched.length === entrySurnames.length;
      out.push(
        finding({
          mode: "incorrect-or-incomplete-metadata",
          level: "reference",
          severity: allWrong ? "critical" : "major",
          confidence: "confirmed",
          summary: allWrong
            ? "None of the listed authors appear on the work this identifier returns"
            : `Listed author(s) not on the record: ${unmatched.join(", ")}`,
          detail: `Registry authors for ${reference.doi ?? reference.marker}: ${registryAuthors.slice(0, 8).join("; ")}. The entry lists: ${reference.authors.join("; ")}. Title-only matching passes this reference, which is why the author list has to be compared too.`,
          reference,
          question: `Where did the author names in ${reference.marker} come from? They are not the authors of the work the identifier returns.`,
          guardNote:
            "Comparison folds diacritics and accepts particle and single-syllable surnames, so \"Ondřej\", \"van Beek\" and \"He\" do not trigger it.",
        }),
      );
    } else if (
      registryAuthors.length > reference.authors.length + 1 &&
      !/et\s+al/i.test(reference.raw) &&
      reference.authors.length > 0
    ) {
      out.push(
        finding({
          mode: "incorrect-or-incomplete-metadata",
          level: "reference",
          severity: "major",
          confidence: "confirmed",
          summary: `Author list is incomplete: ${reference.authors.length} listed, ${registryAuthors.length} on the record`,
          detail: `The record for ${reference.doi ?? reference.marker} names ${registryAuthors.join("; ")}. The entry omits ${registryAuthors.length - reference.authors.length} of them without "et al.".`,
          reference,
          question: `Should ${reference.marker} credit every author, or be shortened with "et al."?`,
        }),
      );
    }
  }

  // Venue comparison: real paper attributed to the wrong container.
  if (verdict.containerTitle && reference.venue) {
    const entryNamesPreprint = PREPRINT_HOST_PATTERN.test(reference.venue) || /arxiv/i.test(reference.venue);
    if (!venuesAgree(reference.venue, verdict.containerTitle) && !entryNamesPreprint) {
      out.push(
        finding({
          mode: "incorrect-or-incomplete-metadata",
          level: "reference",
          severity: "major",
          confidence: "confirmed",
          summary: "The venue does not match the record",
          detail: `The entry publishes this work in "${reference.venue}"; the registry records "${verdict.containerTitle}". Volume, issue and page numbers invented around a real paper are a common reference-manager artefact.`,
          reference,
          question: `Where was ${reference.marker} actually published? Check the venue, volume and pages together.`,
          guardNote:
            "Abbreviated venue names and shared acronyms are treated as agreement, so \"Proc. IEEE Int. Conf. Comput. Vis. (ICCV)\" is not reported against the full conference title.",
        }),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Whole-bibliography properties
// ---------------------------------------------------------------------------

function checkBibliographyComposition(references: ReferenceEntry[]): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  if (references.length < 6) return out;

  const nonScholarly = references.filter((reference) => !isScholarly(reference) && !reference.isStandard);
  const share = nonScholarly.length / references.length;
  if (share >= 0.25) {
    out.push(
      finding({
        mode: "insufficient-scholarly-grounding",
        level: "source",
        severity: "major",
        confidence: "confirmed",
        summary: `${nonScholarly.length} of ${references.length} entries are vendor, blog or general web sources`,
        detail: `Non-scholarly entries: ${nonScholarly.map((r) => r.marker).join(", ")}. This is a property of the list as a whole, established by counting: where research literature is expected, a quarter or more of the bibliography resting on grey web sources changes what the chapter can claim.`,
        markers: nonScholarly.map((r) => r.marker),
        question: "Which of these grey sources could be replaced by peer-reviewed work making the same point?",
        guardNote: "Standards and official documentation are excluded from the count; they are legitimate primary sources.",
      }),
    );
  }

  const secondary = references.filter((reference) => SECONDARY_TITLE_PATTERN.test(reference.title ?? ""));
  if (secondary.length / references.length >= 0.4) {
    out.push(
      finding({
        mode: "secondary-only-bibliography",
        level: "source",
        severity: "moderate",
        confidence: "confirmed",
        summary: `${secondary.length} of ${references.length} entries are reviews or surveys`,
        detail: `Secondary entries: ${secondary.map((r) => r.marker).join(", ")}. Reviews synthesise primary results; a bibliography made mostly of them keeps the argument at second hand.`,
        markers: secondary.map((r) => r.marker),
      }),
    );
  }

  return out;
}

export function checkReferences(document: ReportDocument): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  for (const reference of document.references) {
    out.push(
      ...checkLocator(reference),
      ...checkIdentifiers(reference),
      ...checkAuthorForm(reference),
      ...checkSourceType(reference),
      ...checkVersion(reference),
      ...checkAgainstRegistry(reference, document),
    );
  }
  out.push(...checkBibliographyComposition(document.references));
  return out;
}

export { CURRENT_YEAR };
