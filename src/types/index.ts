/**
 * Shared domain model.
 *
 * These shapes are the contract between the React webview and the Rust core
 * (`src-tauri/src/commands/*`). Rust mirrors them with serde `rename_all =
 * "camelCase"` structs, so field names must stay in sync.
 */

export type SourceFormat = "pdf" | "docx" | "text";

/** How an inline citation is written in the report body. */
export type CitationStyle = "numeric" | "author-year";

// ---------------------------------------------------------------------------
// Phase 1 - ingestion
// ---------------------------------------------------------------------------

export interface DocumentPage {
  index: number; // 1-based
  text: string;
  charStart: number; // offset inside ReportDocument.fullText
  charEnd: number;
}

/** One entry of the report's reference list. */
export interface ReferenceEntry {
  id: string;
  /** `[12]` for numeric styles, `Smith et al., 2023` for author-year. */
  marker: string;
  /** Numeric position in the list, when the list is numbered. */
  number?: number;
  raw: string;
  authors: string[];
  title?: string;
  year?: number;
  venue?: string;
  publisher?: string;
  doi?: string;
  /** The DOI exactly as printed, before repair - used to report malformed locators. */
  doiAsWritten?: string;
  arxivId?: string;
  url?: string;
  /** "cited 2026 Jul" / "Accessed: 14 Mar. 2026", when supplied. */
  accessedDate?: string;
  /** Volume/issue/pages/article-number, when parseable. */
  locator?: string;
  /** A published standard, statute or official specification (NFPA, ISO, RFC...). */
  isStandard: boolean;
  authenticity?: AuthenticityVerdict;
}

/** An inline citation occurrence inside a claim sentence. */
export interface CitationInstance {
  id: string;
  marker: string;
  style: CitationStyle;
  /** Resolved reference-list entry, when the marker could be matched. */
  referenceId?: string;
  charStart: number;
  charEnd: number;
  /**
   * True when the marker was reached by expanding a range such as `[1]-[8]`.
   * The reference is cited, but no claim is attributed to it individually.
   */
  viaRange?: boolean;
}

/** A cited sentence: the unit the student is asked to defend. */
export interface Claim {
  id: string;
  text: string;
  page: number;
  section?: string;
  charStart: number;
  charEnd: number;
  citations: CitationInstance[];
  /** 0..1 heuristic ranking used to pick checkpoint-worthy claims. */
  salience: number;
  /** Why the claim was ranked as it was - surfaced in the UI for transparency. */
  salienceReasons: string[];
}

export interface ReportDocument {
  id: string;
  fileName: string;
  sourceFormat: SourceFormat;
  title: string;
  /** Best-effort thesis statement. */
  thesis: string;
  /** Extracted (not generated) executive summary / abstract text. */
  executiveSummary: string;
  fullText: string;
  pages: DocumentPage[];
  claims: Claim[];
  references: ReferenceEntry[];
  pageCount: number;
  wordCount: number;
  createdAt: string;
  /** Non-fatal ingestion notes, e.g. "no reference list heading found". */
  warnings: string[];
  /** Which inline citation styles were observed, for consistency checking. */
  observedStyles: CitationStyle[];
  /** Deterministic citation-integrity findings (see lib/integrity). */
  findings: IntegrityFinding[];
}

// ---------------------------------------------------------------------------
// Citation integrity findings (deterministic checks, no model involved)
// ---------------------------------------------------------------------------

/**
 * Failure-mode identifiers. These follow the taxonomy in
 * `test_cases/test_cases/FAILURE_MODES.md` so findings can be traced back to a
 * named mode rather than an ad-hoc label.
 */
export type FailureMode =
  // reference level
  | "fabricated-reference"
  | "incorrect-or-incomplete-metadata"
  | "identifier-mismatch"
  | "malformed-locator"
  | "broken-or-unavailable-link"
  | "version-mismatch"
  | "wrong-date"
  | "typographical-corruption"
  // source level
  | "questionable-venue"
  | "non-scholarly-source-as-scholarship"
  | "mutable-source-undocumented"
  | "inappropriate-or-discredited-source"
  | "insufficient-scholarly-grounding"
  | "secondary-only-bibliography"
  // use level
  | "unsupported-claim"
  | "exaggeration-or-quote-mining"
  | "fabricated-quotation"
  | "citation-chaining"
  | "superseded-source-as-current"
  | "undifferentiated-block-citation"
  | "descriptive-listing-without-synthesis"
  | "poor-citation-integration"
  | "lack-of-critical-evaluation"
  | "overreliance-on-quotation"
  | "missing-citation"
  | "misleading-source-equivalence"
  // structural
  | "duplicate-entry"
  | "orphan-reference"
  | "phantom-citation"
  | "reference-manager-debris"
  | "inconsistent-citation-system"
  | "inconsistent-in-text-attribution";

export type FindingLevel = "reference" | "source" | "use" | "structural";

export type Severity = "critical" | "major" | "moderate" | "advisory";

/**
 * `confirmed` - established from the document or a registry record.
 * `needs-evidence` - a signal the student must answer for; the tool cannot
 *   settle it alone (paywalled source, mutable page, judgement call).
 */
export type FindingConfidence = "confirmed" | "needs-evidence";

export interface IntegrityFinding {
  id: string;
  mode: FailureMode;
  level: FindingLevel;
  severity: Severity;
  confidence: FindingConfidence;
  /** One-line statement of what is wrong. */
  summary: string;
  /** The specific evidence: quoted text, marker numbers, registry values. */
  detail: string;
  referenceId?: string;
  claimId?: string;
  /** Marker(s) the finding concerns, for display when no reference resolves. */
  markers: string[];
  /** The question a supervisor would ask about this finding. */
  question?: string;
  /**
   * Which false-positive guard was considered and why it does not apply, or
   * why the check was suppressed. Recorded so restraint is auditable.
   */
  guardNote?: string;
}

// ---------------------------------------------------------------------------
// Source verification (only metadata leaves the device)
// ---------------------------------------------------------------------------

export interface SourceQuery {
  doi?: string;
  title?: string;
  firstAuthor?: string;
  year?: number;
}

export type AuthenticityStatus =
  | "verified"
  | "suspicious"
  | "notFound"
  | "unverified"; // never checked (offline / disabled)

export interface AuthenticityVerdict {
  status: AuthenticityStatus;
  /** 0..100 confidence that the source exists and is reputably indexed. */
  score: number;
  matchedTitle?: string;
  publisher?: string;
  containerTitle?: string;
  year?: number;
  citedByCount?: number;
  /**
   * Citations per year since publication. Absent when the count cannot be
   * interpreted: no year on the record, or the work is inside the indexing lag
   * window, where an empty count reflects timing rather than the source.
   */
  citationsPerYear?: number;
  /**
   * How the count was read, so the score adjustment is auditable:
   * `earlyUptake` and `wellCited` earn the corroboration credit, `tooRecent`,
   * `sparse` and `uncited` neither earn nor lose anything.
   */
  citationSignal?: "tooRecent" | "earlyUptake" | "wellCited" | "sparse" | "uncited";
  /** A free full text is available somewhere, per OpenAlex. */
  isOpenAccess: boolean;
  /** OpenAlex OA colour: gold, green, hybrid, bronze, diamond, closed. */
  oaStatus?: string;
  /** Author list as recorded by the registry, for comparison with the entry. */
  registryAuthors?: string[];
  /** Crossref/OpenAlex work or hosting type: journal-article, posted-content... */
  workType?: string;
  /** The registry record is a preprint / repository copy. */
  isPreprint?: boolean;
  /** 0..1 overlap between the cited title and the resolved title. */
  titleOverlap?: number;
  isRetracted: boolean;
  /** The cited record is itself a retraction notice, not a retracted study. */
  isRetractionNotice?: boolean;
  /** DOI of the notice that retracted the work, when the registry links it. */
  retractionNoticeDoi?: string;
  /** Date the retraction was recorded, `YYYY-MM-DD` where available. */
  retractionDate?: string;
  /** A journal expression of concern: weaker than retraction, still material. */
  hasExpressionOfConcern?: boolean;
  isIndexedInDoaj: boolean;
  /** Which registries answered: `crossref`, `openalex`. */
  registries: string[];
  /** Human-readable warnings, e.g. "title mismatch", "no publisher record". */
  flags: string[];
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Phase 2 - Socratic checkpoint
// ---------------------------------------------------------------------------

export type SocraticDimension =
  | "grounding"
  | "limitations"
  | "selection"
  | "relevance"
  | "synthesis"
  /**
   * "What change did you make after re-reading the source?" - the fourth
   * question named in the proposal. Asked after the comparison, and recorded in
   * the reasoning trace as the revision.
   */
  | "revision";

export interface SocraticQuestion {
  id: string;
  claimId: string;
  referenceId?: string;
  dimension: SocraticDimension;
  prompt: string;
  /** Coaching nudge shown on request; never contains the answer. */
  hint?: string;
  order: number;
  generatedBy: ReasoningProvenance;
  /** Set when the question was derived from a specific integrity finding. */
  findingId?: string;
}

export interface StudentResponse {
  questionId: string;
  claimId: string;
  /** Exact excerpt the student highlighted from the report or source. */
  evidenceExcerpt: string;
  evidencePage?: number;
  rationale: string;
  answeredAt: string;
  /**
   * What the student changed after re-reading the source. The proposal requires
   * the reasoning trace to hold "the citation, the question, the student's
   * explanation and any resulting revision", so this is part of the record
   * rather than a UI-only note. Absent until the student answers the follow-up.
   */
  revision?: string;
  revisedAt?: string;
}

// ---------------------------------------------------------------------------
// Phase 3 - dual reasoning
// ---------------------------------------------------------------------------

export type ReasoningProvenance = "local-llm" | "heuristic";

export type Alignment = "aligned" | "surface" | "misaligned" | "pending";

export type GapKind =
  | "over-generalisation"
  | "misinterpretation"
  | "missing-evidence"
  | "superficial"
  | "unsupported-causality"
  | "strength";

export interface GapFinding {
  kind: GapKind;
  detail: string;
}

export interface CitationScore {
  /** Source exists and is reputable. */
  authenticity: number;
  /** Direct evidence for the claim vs. background padding. */
  relevance: number;
  /** Critical engagement in the student's own rationale. */
  depth: number;
  /** Weighted roll-up, 0..100. */
  overall: number;
}

export interface Evaluation {
  id: string;
  questionId: string;
  claimId: string;
  referenceId?: string;
  /** The model's independent reading of the claim/citation relationship. */
  aiInsight: string;
  /** What evidence the model would expect to see quoted. */
  aiExpectedEvidence: string;
  /** Normalised restatement of the student's rationale. */
  studentSummary: string;
  alignment: Alignment;
  /** 0..1 semantic overlap between the two reasonings. */
  similarity: number;
  gaps: GapFinding[];
  score: CitationScore;
  model: string;
  generatedBy: ReasoningProvenance;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Phase 4 - dashboard + audit
// ---------------------------------------------------------------------------

export type HealthBand = "high" | "valid" | "weak" | "unverified";

export interface CitationHealthRow {
  referenceId?: string;
  claimId: string;
  marker: string;
  band: HealthBand;
  score: CitationScore;
  alignment: Alignment;
  authenticity: AuthenticityStatus;
}

export interface CitationHealthMatrix {
  rows: CitationHealthRow[];
  counts: Record<HealthBand, number>;
  averageScore: CitationScore;
  answered: number;
  total: number;
}

export interface ReasoningTrace {
  document: ReportDocument;
  questions: SocraticQuestion[];
  responses: StudentResponse[];
  evaluations: Evaluation[];
  matrix: CitationHealthMatrix;
  exportedAt: string;
  appVersion: string;
}

// ---------------------------------------------------------------------------
// Settings / infrastructure
// ---------------------------------------------------------------------------

export interface AppSettings {
  llmBaseUrl: string;
  llmModel: string;
  /** When false, no network request is made at all. */
  metadataEnabled: boolean;
  /** Number of claims promoted to a Socratic checkpoint. */
  checkpointBudget: number;
  studentName: string;
  supervisorName: string;
  projectTitle: string;
  /**
   * Which scheduled supervision checkpoint this trace belongs to, e.g.
   * "Back-to-campus day 2". The activity is designed to be completed before the
   * meeting, so the trace has to say which meeting it is for.
   */
  checkpointLabel: string;
  /** Date of that supervision meeting, `YYYY-MM-DD`. */
  checkpointDate: string;
}

export interface LlmStatus {
  reachable: boolean;
  baseUrl: string;
  models: string[];
  detail?: string;
}
