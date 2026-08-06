import * as ipc from "./ipc";
import { isDesktop } from "./env";
import type {
  AppSettings,
  AuthenticityVerdict,
  Evaluation,
  ReportDocument,
  SocraticQuestion,
  StudentResponse,
} from "@/types";

/**
 * Auditable trace persistence.
 *
 * Desktop: SQLite in the OS app-data directory, via the Rust core.
 * Browser preview: `localStorage`, so the UI can be developed without Rust.
 *
 * Note what is *not* stored: the report's full text. Only the claim sentences
 * the student was actually questioned on, the reference metadata, and the
 * reasoning trace are persisted, which keeps the audit record meaningful while
 * limiting how much of the report sits on disk outside the original file.
 */

const LS_KEY = "scc.traces.v1";
const LS_SETTINGS = "scc.settings.v1";

interface LocalStore {
  documents: Record<string, ipc.DocumentRecord>;
  checkpoints: Record<string, ipc.CheckpointRecord>;
  evaluations: Record<string, ipc.EvaluationRecord>;
}

function readLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { documents: {}, checkpoints: {}, evaluations: {} };
    const parsed = JSON.parse(raw) as Partial<LocalStore>;
    return {
      documents: parsed.documents ?? {},
      checkpoints: parsed.checkpoints ?? {},
      evaluations: parsed.evaluations ?? {},
    };
  } catch {
    return { documents: {}, checkpoints: {}, evaluations: {} };
  }
}

function writeLocal(store: LocalStore): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    // Quota or private-mode failure: persistence is best-effort in preview mode.
  }
}

// ---------------------------------------------------------------------------
// Mappers: domain model -> storage records
// ---------------------------------------------------------------------------

export function toDocumentRecord(document: ReportDocument): ipc.DocumentRecord {
  return {
    id: document.id,
    fileName: document.fileName,
    title: document.title,
    thesis: document.thesis,
    executiveSummary: document.executiveSummary,
    pageCount: document.pageCount,
    wordCount: document.wordCount,
    createdAt: document.createdAt,
    claims: document.claims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      page: claim.page,
      section: claim.section,
      citationMarkers: claim.citations.map((citation) => citation.marker),
    })),
    references: document.references.map((reference) => ({
      id: reference.id,
      marker: reference.marker,
      raw: reference.raw,
      doi: reference.doi,
      title: reference.title,
      year: reference.year,
      authenticityJson: reference.authenticity ? JSON.stringify(reference.authenticity) : undefined,
    })),
  };
}

export function toCheckpointRecord(
  documentId: string,
  question: SocraticQuestion,
  response: StudentResponse,
): ipc.CheckpointRecord {
  return {
    id: question.id,
    documentId,
    claimId: question.claimId,
    referenceId: question.referenceId,
    dimension: question.dimension,
    question: question.prompt,
    studentRationale: response.rationale,
    evidenceExcerpt: response.evidenceExcerpt,
    answeredAt: response.answeredAt,
    revision: response.revision,
    revisedAt: response.revisedAt,
  };
}

export function toEvaluationRecord(
  documentId: string,
  evaluation: Evaluation,
): ipc.EvaluationRecord {
  return {
    id: evaluation.id,
    checkpointId: evaluation.questionId,
    documentId,
    aiInsight: evaluation.aiInsight,
    aiExpectedEvidence: evaluation.aiExpectedEvidence,
    studentSummary: evaluation.studentSummary,
    alignment: evaluation.alignment,
    similarity: evaluation.similarity,
    gapsJson: JSON.stringify(evaluation.gaps),
    authenticity: evaluation.score.authenticity,
    relevance: evaluation.score.relevance,
    depth: evaluation.score.depth,
    overall: evaluation.score.overall,
    model: evaluation.model,
    generatedBy: evaluation.generatedBy,
    createdAt: evaluation.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function persistDocument(document: ReportDocument): Promise<void> {
  const record = toDocumentRecord(document);
  if (isDesktop()) {
    await ipc.saveDocument(record);
    return;
  }
  const store = readLocal();
  store.documents[record.id] = record;
  writeLocal(store);
}

export async function persistAuthenticity(
  referenceId: string,
  verdict: AuthenticityVerdict,
): Promise<void> {
  const json = JSON.stringify(verdict);
  if (isDesktop()) {
    await ipc.updateReferenceAuthenticity(referenceId, json);
    return;
  }
  const store = readLocal();
  for (const document of Object.values(store.documents)) {
    const reference = document.references.find((entry) => entry.id === referenceId);
    if (reference) reference.authenticityJson = json;
  }
  writeLocal(store);
}

export async function persistCheckpoint(
  documentId: string,
  question: SocraticQuestion,
  response: StudentResponse,
): Promise<void> {
  const record = toCheckpointRecord(documentId, question, response);
  if (isDesktop()) {
    await ipc.saveCheckpoint(record);
    return;
  }
  const store = readLocal();
  store.checkpoints[record.id] = record;
  writeLocal(store);
}

export async function persistEvaluation(
  documentId: string,
  evaluation: Evaluation,
): Promise<void> {
  const record = toEvaluationRecord(documentId, evaluation);
  if (isDesktop()) {
    await ipc.saveEvaluation(record);
    return;
  }
  const store = readLocal();
  store.evaluations[record.id] = record;
  writeLocal(store);
}

export async function listSavedTraces(): Promise<ipc.DocumentSummary[]> {
  if (isDesktop()) return ipc.listDocuments();
  const store = readLocal();
  return Object.values(store.documents)
    .map((document) => ({
      id: document.id,
      title: document.title,
      fileName: document.fileName,
      createdAt: document.createdAt,
      claimCount: document.claims.length,
      answeredCount: Object.values(store.checkpoints).filter(
        (checkpoint) => checkpoint.documentId === document.id,
      ).length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteSavedTrace(documentId: string): Promise<void> {
  if (isDesktop()) {
    await ipc.deleteDocument(documentId);
    return;
  }
  const store = readLocal();
  delete store.documents[documentId];
  for (const [id, checkpoint] of Object.entries(store.checkpoints)) {
    if (checkpoint.documentId === documentId) delete store.checkpoints[id];
  }
  for (const [id, evaluation] of Object.entries(store.evaluations)) {
    if (evaluation.documentId === documentId) delete store.evaluations[id];
  }
  writeLocal(store);
}

// ---------------------------------------------------------------------------
// Settings (always local to the machine)
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: AppSettings = {
  llmProvider: "ollama",
  llmBaseUrl: "http://127.0.0.1:11434",
  llmModel: "llama3",
  groqApiKey: "",
  metadataEnabled: true,
  checkpointBudget: 8,
  studentName: "",
  supervisorName: "",
  projectTitle: "",
  checkpointLabel: "",
  checkpointDate: "",
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
