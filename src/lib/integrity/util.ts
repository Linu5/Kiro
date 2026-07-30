import { newId } from "../text";
import type {
  FailureMode,
  FindingConfidence,
  FindingLevel,
  IntegrityFinding,
  ReferenceEntry,
  Severity,
} from "@/types";

/** Shared helpers for the integrity checks. */

export interface FindingInput {
  mode: FailureMode;
  level: FindingLevel;
  severity: Severity;
  confidence: FindingConfidence;
  summary: string;
  detail: string;
  reference?: ReferenceEntry;
  claimId?: string;
  markers?: string[];
  question?: string;
  guardNote?: string;
}

export function finding(input: FindingInput): IntegrityFinding {
  return {
    id: newId("find"),
    mode: input.mode,
    level: input.level,
    severity: input.severity,
    confidence: input.confidence,
    summary: input.summary,
    detail: input.detail,
    referenceId: input.reference?.id,
    claimId: input.claimId,
    markers: input.markers ?? (input.reference ? [input.reference.marker] : []),
    question: input.question,
    guardNote: input.guardNote,
  };
}

/**
 * Fold diacritics for *comparison only*. Never used to rewrite a stored name:
 * FAILURE_MODES.md warns that normalising "Ondřej" or "Dollár" and then
 * reporting a mismatch blames the student for the tool's own lossy index.
 */
export function foldForCompare(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** An initials group: `J.`, `T.-Y.`, `A-H`, `W. J.` */
const INITIALS = "(?:[A-Z]\\.(?:-[A-Z]\\.?)?|[A-Z](?:-[A-Z])?(?=\\s|$))";
const PARTICLES = /^(van|von|de|del|della|der|den|di|da|dos|du|le|la|el|al|bin|ibn|mac|mc|st)\b/i;

/**
 * Surname of a personal name in any of the orders a bibliography uses:
 * "J. Smith", "T.-Y. Lin", "Smith J", "Smith, J.", "van Beek H", "Tsung-Yi Lin".
 *
 * Initials are only stripped when they *are* initials - a single capital
 * followed by a dot, or a hyphenated pair. Treating a bare capital as an initial
 * turns "Tsung-Yi Lin" into "sung-yi lin" and manufactures author mismatches,
 * which is the tool blaming the student for its own parsing.
 */
export function surnameOf(name: string): string {
  const cleaned = name
    .replace(/\b(?:jr|sr|iii|ii|phd|prof|dr)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return "";

  // Trailing initials: "Smith J", "Smith, J.", "Karamouzas I"
  const trailing = new RegExp(`^(.*?)[,\\s]+(?:${INITIALS}\\s*){1,4}$`).exec(cleaned);
  if (trailing && trailing[1].length > 1) return foldForCompare(trailing[1]);

  // Leading initials: "J. Smith", "T.-Y. Lin", "W. J. Dally"
  const leading = new RegExp(`^(?:${INITIALS}\\s*){1,4}(.+)$`).exec(cleaned);
  if (leading && leading[1].length > 1) {
    const rest = leading[1].trim();
    return foldForCompare(PARTICLES.test(rest) ? rest : rest.split(/\s+/).slice(-2).join(" ").trim());
  }

  // Full names: keep the particle with the surname ("van Beek", "de Souza").
  const parts = cleaned.split(" ");
  if (parts.length >= 2 && PARTICLES.test(parts[parts.length - 2])) {
    return foldForCompare(parts.slice(-2).join(" "));
  }
  return foldForCompare(parts[parts.length - 1] ?? cleaned);
}

const ORGANISATION_TOKENS =
  /\b(inc|ltd|llc|gmbh|corp|corporation|company|technologies|research|labs?|laboratories|institute|university|college|association|foundation|group|team|brain|ai|analytics|consulting|systems|software|solutions|press|society|council|committee|department|ministry|agency|bureau)\b/i;

const KNOWN_VENDORS =
  /\b(google|microsoft|nvidia|servicenow|amazon|aws|meta|facebook|openai|ibm|oracle|salesforce|unity|intel|qualcomm|apple|adobe|atlassian|zendesk|freshworks|deloitte|gartner|forrester|mckinsey|idc)\b/i;

/** Does this author string name an organisation rather than a person? */
export function looksLikeOrganisation(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.split(/\s+/).length >= 3 && ORGANISATION_TOKENS.test(trimmed)) return true;
  if (KNOWN_VENDORS.test(trimmed)) return true;
  return ORGANISATION_TOKENS.test(trimmed) && !/^[A-Z]\.\s/.test(trimmed);
}

/**
 * An affiliation recorded in a personal-author slot: "G. Brain" (Google Brain),
 * "P. Servicenow". Initials plus a corporate word, sitting in a list that is
 * otherwise made of people.
 */
export function looksLikeAffiliationAsAuthor(name: string, allAuthors: string[]): boolean {
  const trimmed = name.trim();
  const initialsPlusWord = /^(?:[A-Z]\.\s*){1,3}([A-Za-z][A-Za-z-]{2,})$/.exec(trimmed);
  if (!initialsPlusWord) return false;
  const word = initialsPlusWord[1];
  const corporate = KNOWN_VENDORS.test(word) || ORGANISATION_TOKENS.test(word);
  const othersArePeople = allAuthors.length > 1;
  return corporate && othersArePeople;
}

export const VENDOR_BLOG_PATTERN =
  /(\/blog|blog\.|\/news\/|medium\.com|dev\.to|substack|linkedin\.com|towardsdatascience|\/resources\/|\/insights\/|\/case-stud|\/press-release)/i;

/** Vendor *documentation* - legitimate primary source for the vendor's product. */
export const VENDOR_DOCS_PATTERN =
  /(docs\.|\/docs\/|developer|documentation|\/reference\/|\/api\/|\/manual|\/guide|support\.|help\.)/i;

export const MARKET_REPORT_PATTERN =
  /\b(market\s+(size|share|report|analysis|forecast|research)|industry\s+report|magic\s+quadrant|marketpulse|gartner|forrester|idc)\b/i;

export const PREPRINT_HOST_PATTERN =
  /(arxiv\.org|ar5iv|researchgate\.net|semanticscholar|biorxiv|medrxiv|ssrn|preprints\.org|hal\.science|osf\.io)/i;

/** Red-flag venue phrasings associated with weakly vetted publishing. */
export const QUESTIONABLE_VENUE_PATTERN =
  /\b(?:world|international|global|universal|american|european|asian)\s+journal\s+of\s+(?:advanced|applied|modern|innovative|emerging|multidisciplinary|scientific|engineering|research)|journal\s+of\s+(?:advanced|emerging|innovative)\s+\w+|\b(?:ijar|ijsr|ijert|wjarr|irjet|ijcst|jetir)\b/i;

const VENUE_NOISE = new Set([
  "proc", "proceeding", "proceedings", "of", "the", "on", "in", "and", "annual",
  "international", "intl", "int", "conf", "conference", "symposium", "symp",
  "workshop", "vol", "no", "pp", "advances", "papers", "th", "st", "nd", "rd",
]);

/** Uppercase acronyms of three or more letters: ICCV, SIGGRAPH, NeurIPS. */
function acronymsOf(value: string): Set<string> {
  return new Set((value.match(/\b[A-Z]{3,}\b/g) ?? []).map((a) => a.toUpperCase()));
}

/**
 * Are two venue strings plausibly the same publication?
 *
 * Bibliographies abbreviate venues heavily ("Proc. IEEE Int. Conf. Comput. Vis.
 * (ICCV)" against "2017 IEEE International Conference on Computer Vision"), so a
 * plain token overlap reports mismatches that are only abbreviation. Tokens are
 * matched on prefixes, structural words are dropped, and a shared acronym is
 * treated as decisive.
 */
export function venuesAgree(a: string, b: string): boolean {
  const sharedAcronym = [...acronymsOf(a)].some((acronym) => acronymsOf(b).has(acronym));
  if (sharedAcronym) return true;

  const tokenise = (value: string): string[] =>
    foldForCompare(value)
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/g, ""))
      .filter((token) => token.length >= 2 && !VENUE_NOISE.has(token) && !/^\d+$/.test(token));

  const left = tokenise(a);
  const right = tokenise(b);
  if (left.length === 0 || right.length === 0) return true; // nothing to compare

  const matches = left.filter((token) =>
    right.some((other) => {
      const short = token.length <= other.length ? token : other;
      const long = token.length <= other.length ? other : token;
      return long.startsWith(short.slice(0, Math.max(3, Math.min(short.length, 4))));
    }),
  ).length;

  return matches / Math.min(left.length, right.length) >= 0.5;
}

export function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

/** Is this entry a scholarly source, as opposed to grey literature or a vendor page? */
export function isScholarly(reference: ReferenceEntry): boolean {
  if (reference.doi && !PREPRINT_HOST_PATTERN.test(reference.doi)) return true;
  if (reference.arxivId) return true;
  const url = reference.url ?? "";
  if (VENDOR_BLOG_PATTERN.test(url) || MARKET_REPORT_PATTERN.test(reference.raw)) return false;
  if (VENDOR_DOCS_PATTERN.test(url)) return false;
  return Boolean(reference.venue && /journal|transactions|conference|proceedings|symposium|workshop|letters/i.test(reference.venue));
}

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  major: 1,
  moderate: 2,
  advisory: 3,
};

export function sortFindings(findings: IntegrityFinding[]): IntegrityFinding[] {
  return [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.mode.localeCompare(b.mode),
  );
}

export const MODE_LABEL: Record<FailureMode, string> = {
  "fabricated-reference": "Fabricated reference",
  "incorrect-or-incomplete-metadata": "Incorrect or incomplete metadata",
  "identifier-mismatch": "Identifier mismatch",
  "malformed-locator": "Malformed locator",
  "broken-or-unavailable-link": "Broken or unavailable link",
  "version-mismatch": "Version mismatch",
  "wrong-date": "Wrong date",
  "typographical-corruption": "Typographical corruption",
  "questionable-venue": "Questionable venue",
  "non-scholarly-source-as-scholarship": "Non-scholarly source as scholarship",
  "mutable-source-undocumented": "Mutable source inadequately documented",
  "inappropriate-or-discredited-source": "Inappropriate or discredited source",
  "insufficient-scholarly-grounding": "Insufficient scholarly grounding",
  "secondary-only-bibliography": "Secondary-only bibliography",
  "unsupported-claim": "Unsupported claim",
  "exaggeration-or-quote-mining": "Exaggeration or quote-mining",
  "fabricated-quotation": "Unverifiable quotation",
  "citation-chaining": "Citation chaining",
  "superseded-source-as-current": "Superseded source presented as current",
  "undifferentiated-block-citation": "Undifferentiated block citation",
  "descriptive-listing-without-synthesis": "Listing without synthesis",
  "poor-citation-integration": "Poor citation integration",
  "lack-of-critical-evaluation": "Lack of critical evaluation",
  "overreliance-on-quotation": "Overreliance on quotation",
  "missing-citation": "Missing citation",
  "misleading-source-equivalence": "Misleading source equivalence",
  "duplicate-entry": "Duplicate entry",
  "orphan-reference": "Orphan reference",
  "phantom-citation": "Phantom citation",
  "reference-manager-debris": "Reference-manager debris",
  "inconsistent-citation-system": "Inconsistent citation system",
  "inconsistent-in-text-attribution": "Inconsistent in-text attribution",
};
