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
  raw: string;
  authors: string[];
  title?: string;
  year?: number;
  venue?: string;
  doi?: string;
  url?: string;
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
  isRetracted: boolean;
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
  | "synthesis";

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
}

export interface StudentResponse {
  questionId: string;
  claimId: string;
  /** Exact excerpt the student highlighted from the report or source. */
  evidenceExcerpt: string;
  evidencePage?: number;
  rationale: string;
  answeredAt: string;
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
}

export interface LlmStatus {
  reachable: boolean;
  baseUrl: string;
  models: string[];
  detail?: string;
}
