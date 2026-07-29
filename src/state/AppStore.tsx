import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { parseReport, selectCheckpointClaims, base64ToBytes } from "@/lib/parsing";
import { planCheckpoint } from "@/lib/ai/socratic";
import { evaluateResponse } from "@/lib/ai/evaluator";
import { checkLlm } from "@/lib/ai/ollama";
import { verifyReferences } from "@/lib/verify";
import { buildMatrix } from "@/lib/scoring";
import { buildTrace, exportTrace, type ExportFormat } from "@/lib/export";
import * as persistence from "@/lib/persistence";
import { readReportFile } from "@/lib/ipc";
import { isDesktop } from "@/lib/env";
import type {
  AppSettings,
  CitationHealthMatrix,
  Claim,
  Evaluation,
  LlmStatus,
  ReferenceEntry,
  ReportDocument,
  SocraticQuestion,
  StudentResponse,
} from "@/types";
import type { DocumentSummary } from "@/lib/ipc";

export type ViewKey = "overview" | "checkpoint" | "comparison" | "audit";

interface Busy {
  message: string;
  done?: number;
  total?: number;
}

interface State {
  view: ViewKey;
  settings: AppSettings;
  document: ReportDocument | null;
  questions: SocraticQuestion[];
  responses: Record<string, StudentResponse>;
  evaluations: Record<string, Evaluation>;
  activeQuestionId: string | null;
  llm: LlmStatus | null;
  busy: Busy | null;
  error: string | null;
  notice: string | null;
  savedTraces: DocumentSummary[];
}

type Action =
  | { type: "view"; view: ViewKey }
  | { type: "settings"; settings: AppSettings }
  | { type: "document"; document: ReportDocument }
  | { type: "reference-authenticity"; entries: [string, ReferenceEntry["authenticity"]][] }
  | { type: "questions"; questions: SocraticQuestion[] }
  | { type: "active-question"; questionId: string | null }
  | { type: "response"; response: StudentResponse }
  | { type: "evaluation"; evaluation: Evaluation }
  | { type: "llm"; llm: LlmStatus }
  | { type: "busy"; busy: Busy | null }
  | { type: "error"; error: string | null }
  | { type: "notice"; notice: string | null }
  | { type: "saved-traces"; traces: DocumentSummary[] }
  | { type: "reset" };

const initialState: State = {
  view: "overview",
  settings: persistence.DEFAULT_SETTINGS,
  document: null,
  questions: [],
  responses: {},
  evaluations: {},
  activeQuestionId: null,
  llm: null,
  busy: null,
  error: null,
  notice: null,
  savedTraces: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "view":
      return { ...state, view: action.view };
    case "settings":
      return { ...state, settings: action.settings };
    case "document":
      return {
        ...state,
        document: action.document,
        questions: [],
        responses: {},
        evaluations: {},
        activeQuestionId: null,
      };
    case "reference-authenticity": {
      if (!state.document) return state;
      const patch = new Map(action.entries);
      return {
        ...state,
        document: {
          ...state.document,
          references: state.document.references.map((reference) =>
            patch.has(reference.id)
              ? { ...reference, authenticity: patch.get(reference.id) }
              : reference,
          ),
        },
      };
    }
    case "questions":
      return {
        ...state,
        questions: action.questions,
        activeQuestionId: action.questions[0]?.id ?? null,
      };
    case "active-question":
      return { ...state, activeQuestionId: action.questionId };
    case "response":
      return {
        ...state,
        responses: { ...state.responses, [action.response.questionId]: action.response },
      };
    case "evaluation":
      return {
        ...state,
        evaluations: { ...state.evaluations, [action.evaluation.questionId]: action.evaluation },
      };
    case "llm":
      return { ...state, llm: action.llm };
    case "busy":
      return { ...state, busy: action.busy };
    case "error":
      return { ...state, error: action.error };
    case "notice":
      return { ...state, notice: action.notice };
    case "saved-traces":
      return { ...state, savedTraces: action.traces };
    case "reset":
      return { ...initialState, settings: state.settings, llm: state.llm, savedTraces: state.savedTraces };
    default:
      return state;
  }
}

interface Store extends State {
  matrix: CitationHealthMatrix | null;
  checkpointClaims: Claim[];
  referencesById: Map<string, ReferenceEntry>;
  claimsById: Map<string, Claim>;
  setView: (view: ViewKey) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  ingestFile: (file: File) => Promise<void>;
  ingestPath: (path: string) => Promise<void>;
  buildCheckpoint: () => Promise<void>;
  submitAnswer: (
    question: SocraticQuestion,
    input: { rationale: string; evidenceExcerpt: string; evidencePage?: number },
  ) => Promise<void>;
  setActiveQuestion: (questionId: string | null) => void;
  runExport: (format: ExportFormat) => Promise<void>;
  refreshLlm: () => Promise<void>;
  refreshTraces: () => Promise<void>;
  removeTrace: (documentId: string) => Promise<void>;
  dismissError: () => void;
  dismissNotice: () => void;
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, dispatch] = useReducer(reducer, initialState, (base) => ({
    ...base,
    settings: persistence.loadSettings(),
  }));

  const fail = useCallback((error: unknown) => {
    dispatch({ type: "busy", busy: null });
    dispatch({ type: "error", error: error instanceof Error ? error.message : String(error) });
  }, []);

  const refreshLlm = useCallback(async () => {
    const status = await checkLlm(state.settings);
    dispatch({ type: "llm", llm: status });
  }, [state.settings]);

  const refreshTraces = useCallback(async () => {
    try {
      dispatch({ type: "saved-traces", traces: await persistence.listSavedTraces() });
    } catch {
      // History is a convenience; a failure here must not block the workflow.
    }
  }, []);

  useEffect(() => {
    void refreshLlm();
    void refreshTraces();
    // Deliberately runs once on mount: the status bar has a manual refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Phase 1: parse, then verify sources (metadata only), then persist. */
  const ingestBytes = useCallback(
    async (fileName: string, bytes: Uint8Array) => {
      try {
        dispatch({ type: "error", error: null });
        dispatch({ type: "busy", busy: { message: `Parsing ${fileName}\u2026` } });
        const document = await parseReport(fileName, bytes);
        dispatch({ type: "document", document });
        await persistence.persistDocument(document);

        if (document.references.length > 0) {
          dispatch({
            type: "busy",
            busy: { message: "Verifying sources (metadata only)\u2026", done: 0, total: document.references.length },
          });
          const verdicts = await verifyReferences(document.references, state.settings, (progress) => {
            dispatch({
              type: "busy",
              busy: {
                message: `Verifying ${progress.reference.marker}\u2026`,
                done: progress.done,
                total: progress.total,
              },
            });
          });
          dispatch({
            type: "reference-authenticity",
            entries: [...verdicts.entries()],
          });
          for (const [referenceId, verdict] of verdicts) {
            await persistence.persistAuthenticity(referenceId, verdict);
          }
        }

        dispatch({ type: "busy", busy: null });
        dispatch({
          type: "notice",
          notice: `${document.claims.length} cited claim(s) and ${document.references.length} reference(s) parsed locally.`,
        });
        dispatch({ type: "view", view: "overview" });
        void refreshTraces();
      } catch (error) {
        fail(error);
      }
    },
    [fail, refreshTraces, state.settings],
  );

  const ingestFile = useCallback(
    async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await ingestBytes(file.name, bytes);
    },
    [ingestBytes],
  );

  const ingestPath = useCallback(
    async (path: string) => {
      try {
        const ingested = await readReportFile(path);
        await ingestBytes(ingested.fileName, base64ToBytes(ingested.bytes));
      } catch (error) {
        fail(error);
      }
    },
    [fail, ingestBytes],
  );

  /** Phase 2: build the Socratic question set for the top-salience claims. */
  const buildCheckpoint = useCallback(async () => {
    if (!state.document) return;
    const claims = selectCheckpointClaims(state.document, state.settings.checkpointBudget);
    try {
      dispatch({ type: "error", error: null });
      dispatch({
        type: "busy",
        busy: { message: "Preparing Socratic questions\u2026", done: 0, total: claims.length },
      });
      const plan = await planCheckpoint(claims, state.document.references, state.settings, (done, total) => {
        dispatch({ type: "busy", busy: { message: "Preparing Socratic questions\u2026", done, total } });
      });
      dispatch({ type: "questions", questions: plan.questions });
      dispatch({ type: "busy", busy: null });
      dispatch({
        type: "notice",
        notice: plan.usedModel
          ? `${plan.questions.length} questions generated by the local model.`
          : `${plan.questions.length} questions generated from the built-in bank (no local model answered).`,
      });
      dispatch({ type: "view", view: "checkpoint" });
    } catch (error) {
      fail(error);
    }
  }, [fail, state.document, state.settings]);

  /** Phase 3: dual-reasoning evaluation of one answer. */
  const submitAnswer = useCallback<Store["submitAnswer"]>(
    async (question, input) => {
      if (!state.document) return;
      const claim = state.document.claims.find((entry) => entry.id === question.claimId);
      if (!claim) return;
      const reference = state.document.references.find((entry) => entry.id === question.referenceId);

      const response: StudentResponse = {
        questionId: question.id,
        claimId: claim.id,
        rationale: input.rationale.trim(),
        evidenceExcerpt: input.evidenceExcerpt.trim(),
        evidencePage: input.evidencePage,
        answeredAt: new Date().toISOString(),
      };

      try {
        dispatch({ type: "error", error: null });
        dispatch({ type: "response", response });
        dispatch({ type: "busy", busy: { message: "Comparing your reasoning with the AI reading\u2026" } });
        await persistence.persistCheckpoint(state.document.id, question, response);

        const evaluation = await evaluateResponse({
          claim,
          reference,
          question,
          response,
          settings: state.settings,
        });
        dispatch({ type: "evaluation", evaluation });
        await persistence.persistEvaluation(state.document.id, evaluation);
        dispatch({ type: "busy", busy: null });
        void refreshTraces();
      } catch (error) {
        fail(error);
      }
    },
    [fail, refreshTraces, state.document, state.settings],
  );

  const runExport = useCallback(
    async (format: ExportFormat) => {
      if (!state.document) return;
      try {
        dispatch({ type: "busy", busy: { message: "Building the reasoning trace log\u2026" } });
        const trace = buildTrace({
          document: state.document,
          questions: state.questions,
          responses: Object.values(state.responses),
          evaluations: Object.values(state.evaluations),
        });
        const result = await exportTrace(trace, state.settings, format);
        dispatch({ type: "busy", busy: null });
        dispatch({
          type: "notice",
          notice: result.path
            ? `Saved ${result.fileName} to ${result.path}`
            : `Downloaded ${result.fileName}`,
        });
      } catch (error) {
        fail(error);
      }
    },
    [fail, state.document, state.evaluations, state.questions, state.responses, state.settings],
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      const next = { ...state.settings, ...patch };
      persistence.saveSettings(next);
      dispatch({ type: "settings", settings: next });
    },
    [state.settings],
  );

  const removeTrace = useCallback(
    async (documentId: string) => {
      try {
        await persistence.deleteSavedTrace(documentId);
        await refreshTraces();
      } catch (error) {
        fail(error);
      }
    },
    [fail, refreshTraces],
  );

  const matrix = useMemo(() => {
    if (!state.document) return null;
    return buildMatrix({
      document: state.document,
      questions: state.questions,
      responses: Object.values(state.responses),
      evaluations: Object.values(state.evaluations),
    });
  }, [state.document, state.evaluations, state.questions, state.responses]);

  const checkpointClaims = useMemo(() => {
    if (!state.document) return [];
    const claimIds = new Set(state.questions.map((question) => question.claimId));
    if (claimIds.size === 0) {
      return selectCheckpointClaims(state.document, state.settings.checkpointBudget);
    }
    return state.document.claims.filter((claim) => claimIds.has(claim.id));
  }, [state.document, state.questions, state.settings.checkpointBudget]);

  const referencesById = useMemo(
    () => new Map((state.document?.references ?? []).map((reference) => [reference.id, reference] as const)),
    [state.document],
  );
  const claimsById = useMemo(
    () => new Map((state.document?.claims ?? []).map((claim) => [claim.id, claim] as const)),
    [state.document],
  );

  const value: Store = {
    ...state,
    matrix,
    checkpointClaims,
    referencesById,
    claimsById,
    setView: (view) => dispatch({ type: "view", view }),
    updateSettings,
    ingestFile,
    ingestPath,
    buildCheckpoint,
    submitAnswer,
    setActiveQuestion: (questionId) => dispatch({ type: "active-question", questionId }),
    runExport,
    refreshLlm,
    refreshTraces,
    removeTrace,
    dismissError: () => dispatch({ type: "error", error: null }),
    dismissNotice: () => dispatch({ type: "notice", notice: null }),
    reset: () => dispatch({ type: "reset" }),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useApp must be used inside <AppStoreProvider>");
  return store;
}

export const runsOnDesktop = isDesktop;
