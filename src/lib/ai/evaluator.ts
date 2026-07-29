import { coverage, newId, similarity, truncate, wordCount } from "../text";
import { authenticityScore, rollUp } from "../scoring";
import { generateJson, LlmUnavailableError } from "./ollama";
import { EVALUATOR_SYSTEM, dualReasoningPrompt } from "./prompts";
import type {
  Alignment,
  AppSettings,
  Claim,
  Evaluation,
  GapFinding,
  GapKind,
  ReferenceEntry,
  SocraticQuestion,
  StudentResponse,
} from "@/types";

/**
 * Phase 3: dual-reasoning evaluator.
 *
 * The model reasons about the claim/citation link independently, then its
 * reasoning is compared with the student's. When no model is reachable the same
 * comparison runs on lexical evidence signals, so the workflow always produces
 * an auditable verdict - it just labels the provenance as `heuristic`.
 */

const CRITICAL_MARKERS =
  /\b(because|since|whereas|however|although|despite|limitation|limited|sample|cohort|context|assumes?|assumption|generalis|generaliz|contradict|only|methodolog|confound|correlat|causal|threshold|baseline|compared with|in contrast)\b/i;
const CAUSAL_CLAIM = /\b(cause[sd]?|causes|leads? to|result(?:s|ed) in|because of|drives?|reduces?|increases?)\b/i;
const ABSOLUTE = /\b(all|every|always|never|none|universally|invariably|proves?)\b/i;
const HEDGE = /\b(may|might|could|suggests?|indicates?|appears?|likely)\b/i;
const RESTATEMENT_THRESHOLD = 0.62;

export interface HeuristicSignals {
  evidenceCoverage: number;
  rationaleOverlapWithClaim: number;
  rationaleOverlapWithEvidence: number;
  rationaleWords: number;
  criticalMarkers: boolean;
}

export function heuristicSignals(claim: Claim, response: StudentResponse): HeuristicSignals {
  // Measured in both directions: a long claim will never be fully covered by a
  // one-sentence excerpt, and a short excerpt that is entirely on-topic is
  // stronger evidence than a long one that merely brushes the subject.
  const evidenceCoverage = Math.max(
    coverage(claim.text, response.evidenceExcerpt),
    coverage(response.evidenceExcerpt, claim.text),
  );
  return {
    evidenceCoverage,
    rationaleOverlapWithClaim: similarity(claim.text, response.rationale),
    rationaleOverlapWithEvidence: coverage(response.rationale, response.evidenceExcerpt),
    rationaleWords: wordCount(response.rationale),
    criticalMarkers: CRITICAL_MARKERS.test(response.rationale),
  };
}

function heuristicGaps(claim: Claim, response: StudentResponse, signals: HeuristicSignals): GapFinding[] {
  const gaps: GapFinding[] = [];

  if (response.evidenceExcerpt.trim().length === 0) {
    gaps.push({
      kind: "missing-evidence",
      detail: "No excerpt was highlighted, so the claim has no traceable anchor in the source.",
    });
  } else if (signals.evidenceCoverage < 0.18) {
    gaps.push({
      kind: "missing-evidence",
      detail: `The highlighted excerpt shares little vocabulary with the claim (${Math.round(
        signals.evidenceCoverage * 100,
      )}% overlap), which usually means it evidences the topic rather than the assertion.`,
    });
  }

  if (signals.rationaleWords < 20) {
    gaps.push({
      kind: "superficial",
      detail: `The rationale is only ${signals.rationaleWords} words - too short to show why this source settles the point.`,
    });
  } else if (!signals.criticalMarkers) {
    gaps.push({
      kind: "superficial",
      detail: "The rationale asserts rather than reasons: no cause, comparison, limitation or condition is named.",
    });
  }

  if (signals.rationaleOverlapWithClaim > RESTATEMENT_THRESHOLD) {
    gaps.push({
      kind: "misinterpretation",
      detail: "The rationale largely restates the claim instead of explaining how the source supports it.",
    });
  }

  if (ABSOLUTE.test(claim.text) && !/\b(limit|only|some|specific|context|sample)\b/i.test(response.rationale)) {
    gaps.push({
      kind: "over-generalisation",
      detail: "The claim is stated absolutely, but the rationale does not bound it to the source's population or setting.",
    });
  }

  if (CAUSAL_CLAIM.test(claim.text) && !HEDGE.test(claim.text)) {
    const defended = /\b(experiment|randomi|controlled|trial|intervention|causal|regression|ablation)\b/i.test(
      `${response.rationale} ${response.evidenceExcerpt}`,
    );
    if (!defended) {
      gaps.push({
        kind: "unsupported-causality",
        detail: "A causal relationship is asserted, but neither the excerpt nor the rationale points to a design that can establish causation.",
      });
    }
  }

  if (gaps.length === 0) {
    gaps.push({
      kind: "strength",
      detail: "The excerpt is on-point and the rationale gives an independent reason for using it.",
    });
  }
  return gaps;
}

function heuristicAlignment(signals: HeuristicSignals, gaps: GapFinding[]): Alignment {
  const hard = gaps.some((gap) =>
    (["missing-evidence", "misinterpretation", "unsupported-causality", "over-generalisation"] as GapKind[]).includes(
      gap.kind,
    ),
  );
  if (hard) return "misaligned";
  if (gaps.some((gap) => gap.kind === "superficial")) return "surface";
  if (signals.evidenceCoverage >= 0.3 && signals.criticalMarkers && signals.rationaleWords >= 35) {
    return "aligned";
  }
  return "surface";
}

function heuristicRelevance(signals: HeuristicSignals, reference: ReferenceEntry | undefined): number {
  let score = 30 + signals.evidenceCoverage * 60;
  if (signals.rationaleOverlapWithEvidence > 0.25) score += 8;
  if (!reference) score -= 25; // unresolved marker
  return score;
}

function heuristicDepth(signals: HeuristicSignals): number {
  let score = 18;
  score += Math.min(34, signals.rationaleWords * 0.5);
  if (signals.criticalMarkers) score += 22;
  if (signals.rationaleOverlapWithEvidence > 0.2) score += 12;
  if (signals.rationaleOverlapWithClaim > RESTATEMENT_THRESHOLD) score -= 28;
  return score;
}

export function heuristicAiInsight(
  claim: Claim,
  reference: ReferenceEntry | undefined,
  signals: HeuristicSignals,
): string {
  const source = reference
    ? `${reference.marker}${reference.title ? ` ("${truncate(reference.title, 90)}")` : ""}`
    : "the cited marker (no matching reference entry was found)";
  const overlap = Math.round(signals.evidenceCoverage * 100);
  const strength = ABSOLUTE.test(claim.text)
    ? "The claim is phrased absolutely, so it needs evidence covering the full range it asserts."
    : CAUSAL_CLAIM.test(claim.text)
      ? "The claim asserts a directional effect, so it needs a result that measured that effect."
      : "The claim is descriptive, so a reported finding or definition from the source can carry it.";
  return [
    `Local analysis (no model): ${strength}`,
    `The highlighted excerpt from ${source} shares ${overlap}% of the claim's content terms.`,
    overlap >= 30
      ? "That is consistent with direct support, though wording overlap alone cannot confirm the finding."
      : "That is low for direct support: the excerpt more likely establishes context than the specific assertion.",
  ].join(" ");
}

export interface EvaluateArgs {
  claim: Claim;
  reference: ReferenceEntry | undefined;
  question: SocraticQuestion;
  response: StudentResponse;
  settings: AppSettings;
}

export function evaluateHeuristically({
  claim,
  reference,
  question,
  response,
}: EvaluateArgs): Evaluation {
  const signals = heuristicSignals(claim, response);
  const gaps = heuristicGaps(claim, response, signals);
  const alignment = heuristicAlignment(signals, gaps);
  const score = rollUp(
    authenticityScore(reference?.authenticity),
    heuristicRelevance(signals, reference),
    heuristicDepth(signals),
  );

  return {
    id: newId("eval"),
    questionId: question.id,
    claimId: claim.id,
    referenceId: reference?.id,
    aiInsight: heuristicAiInsight(claim, reference, signals),
    aiExpectedEvidence: reference
      ? `A defensible justification quotes the specific result, sample or definition in ${reference.marker} that measures what the claim asserts.`
      : "A defensible justification starts by identifying which reference-list entry this marker points to.",
    studentSummary: truncate(response.rationale, 240) || "(no rationale provided)",
    alignment,
    similarity: Number(similarity(claim.text, response.rationale).toFixed(2)),
    gaps,
    score,
    model: "none",
    generatedBy: "heuristic",
    createdAt: new Date().toISOString(),
  };
}

interface LlmEvaluationPayload {
  aiInsight?: string;
  aiExpectedEvidence?: string;
  studentSummary?: string;
  alignment?: string;
  similarity?: number;
  gaps?: { kind?: string; detail?: string }[];
  relevance?: number;
  depth?: number;
}

const GAP_KINDS: GapKind[] = [
  "over-generalisation",
  "misinterpretation",
  "missing-evidence",
  "superficial",
  "unsupported-causality",
  "strength",
];

function coerceAlignment(value: string | undefined, fallback: Alignment): Alignment {
  const normalised = (value ?? "").trim().toLowerCase();
  if (normalised === "aligned" || normalised === "surface" || normalised === "misaligned") {
    return normalised;
  }
  if (normalised.startsWith("surface")) return "surface";
  return fallback;
}

function coerceGaps(raw: LlmEvaluationPayload["gaps"], fallback: GapFinding[]): GapFinding[] {
  const mapped = (raw ?? [])
    .map((gap) => {
      const detail = (gap.detail ?? "").trim();
      if (detail.length < 8) return null;
      const kindRaw = (gap.kind ?? "").trim().toLowerCase().replace("generalization", "generalisation");
      const kind = (GAP_KINDS as string[]).includes(kindRaw) ? (kindRaw as GapKind) : "superficial";
      return { kind, detail };
    })
    .filter((gap): gap is GapFinding => gap !== null);
  return mapped.length > 0 ? mapped : fallback;
}

function clampScore(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  // Tolerate models that answer on a 0..1 or 0..10 scale.
  const scaled = value <= 1 ? value * 100 : value <= 10 ? value * 10 : value;
  return Math.max(0, Math.min(100, scaled));
}

/**
 * Run the dual-reasoning comparison. Always resolves: the heuristic evaluation
 * is computed first and used as the fallback for any field the model omits.
 */
export async function evaluateResponse(args: EvaluateArgs): Promise<Evaluation> {
  const baseline = evaluateHeuristically(args);
  const { claim, reference, question, response, settings } = args;

  try {
    const { value, model } = await generateJson<LlmEvaluationPayload>({
      settings,
      system: EVALUATOR_SYSTEM,
      prompt: dualReasoningPrompt(claim, reference, response, question.prompt),
      temperature: 0.15,
    });

    const insight = (value.aiInsight ?? "").trim();
    if (insight.length < 20) return baseline;

    const alignment = coerceAlignment(value.alignment, baseline.alignment);
    const score = rollUp(
      authenticityScore(reference?.authenticity),
      clampScore(value.relevance, baseline.score.relevance),
      clampScore(value.depth, baseline.score.depth),
    );

    return {
      ...baseline,
      aiInsight: insight,
      aiExpectedEvidence: (value.aiExpectedEvidence ?? "").trim() || baseline.aiExpectedEvidence,
      studentSummary: (value.studentSummary ?? "").trim() || baseline.studentSummary,
      alignment,
      similarity:
        typeof value.similarity === "number"
          ? Number(Math.max(0, Math.min(1, value.similarity)).toFixed(2))
          : baseline.similarity,
      gaps: coerceGaps(value.gaps, baseline.gaps),
      score,
      model,
      generatedBy: "local-llm",
    };
  } catch (error) {
    if (!(error instanceof LlmUnavailableError)) throw error;
    return baseline;
  }
}
