import { newId, truncate } from "../text";
import { generateJson } from "./ollama";
import { SOCRATIC_SYSTEM, socraticQuestionPrompt } from "./prompts";
import type {
  AppSettings,
  Claim,
  ReferenceEntry,
  SocraticDimension,
  SocraticQuestion,
} from "@/types";

/**
 * Socratic planner. Produces the question set for a claim, preferring the local
 * model and falling back to a deterministic bank so the checkpoint still works
 * on a machine with no model installed (or during an exam-hall demo).
 */

const DIMENSION_ORDER: SocraticDimension[] = [
  "grounding",
  "relevance",
  "limitations",
  "selection",
  "synthesis",
];

export const DIMENSION_LABEL: Record<SocraticDimension, string> = {
  grounding: "Evidence grounding",
  relevance: "Direct relevance",
  limitations: "Source limitations",
  selection: "Selection rationale",
  synthesis: "Synthesis across sources",
};

/** Which angles are worth probing for this particular claim. */
export function dimensionsFor(claim: Claim): SocraticDimension[] {
  const dimensions: SocraticDimension[] = ["grounding"];
  if (/\b(all|every|always|never|none|universally)\b/i.test(claim.text)) {
    dimensions.push("limitations");
  }
  if (/\b(cause[sd]?|lead[s]? to|result(?:s|ed) in|because|due to|drives?)\b/i.test(claim.text)) {
    dimensions.push("relevance");
  }
  if (claim.citations.length > 1) dimensions.push("synthesis");
  if (!dimensions.includes("limitations")) dimensions.push("limitations");
  if (dimensions.length < 3) dimensions.push("selection");
  return [...new Set(dimensions)]
    .sort((a, b) => DIMENSION_ORDER.indexOf(a) - DIMENSION_ORDER.indexOf(b))
    .slice(0, 3);
}

function subject(claim: Claim): string {
  // Strip inline citation markers so the question reads naturally.
  const cleaned = claim.text
    .replace(/\[[^\]]{1,40}\]/g, "")
    .replace(/\([^)]{0,120}(?:19|20)\d{2}[a-z]?[^)]{0,40}\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return truncate(cleaned, 150);
}

const FALLBACK: Record<SocraticDimension, (claim: Claim, marker: string) => { prompt: string; hint: string }> = {
  grounding: (claim, marker) => ({
    prompt: `Which specific passage, result or figure in ${marker} supports your statement that ${subject(claim)}?`,
    hint: "Quote the sentence, table or figure number you are relying on, not the topic of the paper.",
  }),
  relevance: (_claim, marker) => ({
    prompt: `Is ${marker} direct evidence for this claim, or background context? Explain which, and why.`,
    hint: "Direct evidence measures or tests the thing you are asserting; background only frames it.",
  }),
  limitations: (_claim, marker) => ({
    prompt: `What limitations of ${marker} - sample, setting, method or date - constrain how far your claim can go?`,
    hint: "Look at the study's population, scale and context, then say what your claim cannot cover.",
  }),
  selection: (_claim, marker) => ({
    prompt: `Why did you select this finding from ${marker} rather than another result in the same work or a competing study?`,
    hint: "Name the alternative you rejected and the reason it was weaker for your argument.",
  }),
  synthesis: (claim, _marker) => ({
    prompt: `You cite ${claim.citations.length} sources here. Where do they agree, and where would they disagree with each other?`,
    hint: "Bundled citations should not hide a disagreement between the sources.",
  }),
};

function markerFor(claim: Claim, reference: ReferenceEntry | undefined): string {
  return reference?.marker ?? claim.citations[0]?.marker ?? "this source";
}

export function heuristicQuestions(
  claim: Claim,
  reference: ReferenceEntry | undefined,
): SocraticQuestion[] {
  const marker = markerFor(claim, reference);
  return dimensionsFor(claim).map((dimension, index) => {
    const built = FALLBACK[dimension](claim, marker);
    return {
      id: newId("q"),
      claimId: claim.id,
      referenceId: reference?.id,
      dimension,
      prompt: built.prompt,
      hint: built.hint,
      order: index,
      generatedBy: "heuristic" as const,
    };
  });
}

interface LlmQuestionPayload {
  questions?: { dimension?: string; prompt?: string; hint?: string }[];
}

function isDimension(value: string): value is SocraticDimension {
  return (DIMENSION_ORDER as string[]).includes(value);
}

/**
 * Generate the question set for one claim. Never throws: on any model problem
 * it returns the deterministic bank so the student is never blocked.
 */
export async function questionsForClaim(
  claim: Claim,
  reference: ReferenceEntry | undefined,
  settings: AppSettings,
): Promise<SocraticQuestion[]> {
  const dimensions = dimensionsFor(claim);
  try {
    const { value } = await generateJson<LlmQuestionPayload>({
      settings,
      system: SOCRATIC_SYSTEM,
      prompt: socraticQuestionPrompt(claim, reference, dimensions),
      temperature: 0.3,
    });

    const questions = (value.questions ?? [])
      .map((raw, index): SocraticQuestion | null => {
        const prompt = (raw.prompt ?? "").trim();
        if (prompt.length < 12) return null;
        const dimensionRaw = (raw.dimension ?? "").trim().toLowerCase();
        const dimension = isDimension(dimensionRaw)
          ? dimensionRaw
          : dimensions[index] ?? dimensions[0];
        return {
          id: newId("q"),
          claimId: claim.id,
          referenceId: reference?.id,
          dimension,
          prompt,
          hint: raw.hint?.trim() || FALLBACK[dimension](claim, markerFor(claim, reference)).hint,
          order: index,
          generatedBy: "local-llm",
        };
      })
      .filter((q): q is SocraticQuestion => q !== null);

    return questions.length > 0 ? questions : heuristicQuestions(claim, reference);
  } catch {
    return heuristicQuestions(claim, reference);
  }
}

export interface CheckpointPlan {
  questions: SocraticQuestion[];
  usedModel: boolean;
}

/** Build the whole checkpoint, one claim at a time (sequential: local models are single-slot). */
export async function planCheckpoint(
  claims: Claim[],
  references: ReferenceEntry[],
  settings: AppSettings,
  onProgress?: (done: number, total: number) => void,
): Promise<CheckpointPlan> {
  const byId = new Map(references.map((reference) => [reference.id, reference] as const));
  const questions: SocraticQuestion[] = [];
  let usedModel = false;

  for (const [index, claim] of claims.entries()) {
    const referenceId = claim.citations.find((citation) => citation.referenceId)?.referenceId;
    const reference = referenceId ? byId.get(referenceId) : undefined;
    const generated = await questionsForClaim(claim, reference, settings);
    if (generated.some((question) => question.generatedBy === "local-llm")) usedModel = true;
    questions.push(...generated);
    onProgress?.(index + 1, claims.length);
  }

  return { questions, usedModel };
}
