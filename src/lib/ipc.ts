import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "./env";
import type { AuthenticityVerdict, LlmStatus, SourceQuery } from "@/types";

/**
 * Typed wrappers over the Rust command surface. Every function degrades
 * gracefully when the Rust core is absent so the UI stays usable in browser
 * preview mode.
 */

export class CoreUnavailableError extends Error {
  constructor(command: string) {
    super(`The Rust core is not available in this host (command: ${command}).`);
    this.name = "CoreUnavailableError";
  }
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktop()) throw new CoreUnavailableError(command);
  return invoke<T>(command, args);
}

// ---------------------------------------------------------------------------
// LLM bridge (loopback only, see src-tauri/src/commands/llm.rs)
// ---------------------------------------------------------------------------

export interface LlmRequest {
  baseUrl: string;
  model: string;
  prompt: string;
  system?: string;
  /** Ask the model to emit strict JSON (`format: "json"` in Ollama). */
  json?: boolean;
  temperature?: number;
}

export interface LlmResponse {
  text: string;
  model: string;
  elapsedMs: number;
}

export const llmStatus = (baseUrl: string): Promise<LlmStatus> =>
  call<LlmStatus>("llm_status", { baseUrl });

export const llmGenerate = (request: LlmRequest): Promise<LlmResponse> =>
  call<LlmResponse>("llm_generate", { request });

// ---------------------------------------------------------------------------
// Scholarly metadata (the only outbound network path)
// ---------------------------------------------------------------------------

export const verifySource = (query: SourceQuery): Promise<AuthenticityVerdict> =>
  call<AuthenticityVerdict>("verify_source", { query });

// ---------------------------------------------------------------------------
// File ingest
// ---------------------------------------------------------------------------

export interface IngestedFile {
  fileName: string;
  /** base64, decoded in the webview and handed to pdf.js / mammoth. */
  bytes: string;
  extension: string;
  sizeBytes: number;
}

export const readReportFile = (path: string): Promise<IngestedFile> =>
  call<IngestedFile>("read_report_file", { path });

/** Writes an export next to the user's Documents folder and returns the path. */
export const writeExport = (fileName: string, contentsBase64: string): Promise<string> =>
  call<string>("write_export", { fileName, contentsBase64 });

// ---------------------------------------------------------------------------
// Auditable trace store (SQLite)
// ---------------------------------------------------------------------------

export interface DocumentRecord {
  id: string;
  fileName: string;
  title: string;
  thesis: string;
  executiveSummary: string;
  pageCount: number;
  wordCount: number;
  createdAt: string;
  claims: ClaimRecord[];
  references: ReferenceRecord[];
}

export interface ClaimRecord {
  id: string;
  text: string;
  page: number;
  section?: string;
  citationMarkers: string[];
}

export interface ReferenceRecord {
  id: string;
  marker: string;
  raw: string;
  doi?: string;
  title?: string;
  year?: number;
  authenticityJson?: string;
}

export interface CheckpointRecord {
  id: string;
  documentId: string;
  claimId: string;
  referenceId?: string;
  dimension: string;
  question: string;
  studentRationale: string;
  evidenceExcerpt: string;
  answeredAt: string;
}

export interface EvaluationRecord {
  id: string;
  checkpointId: string;
  documentId: string;
  aiInsight: string;
  aiExpectedEvidence: string;
  studentSummary: string;
  alignment: string;
  similarity: number;
  gapsJson: string;
  authenticity: number;
  relevance: number;
  depth: number;
  overall: number;
  model: string;
  generatedBy: string;
  createdAt: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  fileName: string;
  createdAt: string;
  claimCount: number;
  answeredCount: number;
}

export interface StoredTrace {
  document: DocumentRecord;
  checkpoints: CheckpointRecord[];
  evaluations: EvaluationRecord[];
}

export const saveDocument = (document: DocumentRecord): Promise<void> =>
  call<void>("save_document", { document });

export const saveCheckpoint = (checkpoint: CheckpointRecord): Promise<void> =>
  call<void>("save_checkpoint", { checkpoint });

export const saveEvaluation = (evaluation: EvaluationRecord): Promise<void> =>
  call<void>("save_evaluation", { evaluation });

export const updateReferenceAuthenticity = (
  referenceId: string,
  authenticityJson: string,
): Promise<void> => call<void>("update_reference_authenticity", { referenceId, authenticityJson });

export const listDocuments = (): Promise<DocumentSummary[]> =>
  call<DocumentSummary[]>("list_documents");

export const loadTrace = (documentId: string): Promise<StoredTrace | null> =>
  call<StoredTrace | null>("load_trace", { documentId });

export const deleteDocument = (documentId: string): Promise<void> =>
  call<void>("delete_document", { documentId });
