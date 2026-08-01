import { newId, truncate } from "../text";
import { generateJson } from "./ollama";
import { SOCRATIC_SYSTEM, socraticQuestionPrompt } from "./prompts";
import { MODE_LABEL } from "../integrity/util";
import type {
  AppSettings,
  Claim,
  IntegrityFinding,
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
  // Never planned: asked as a follow-up once the student has an answer to revise.
  "revision",
];

export const DIMENSION_LABEL: Record<SocraticDimension, string> = {
  grounding: "Evidence grounding",
  relevance: "Direct relevance",
  limitations: "Source limitations",
  selection: "Selection rationale",
  synthesis: "Synthesis across sources",
  revision: "Revision after re-reading",
};

/**
 * The follow-up asked once a comparison exists, in the proposal's own words. It
 * is deliberately not part of the planned question set: it can only be answered
 * after the student has re-read the source, so it is attached to an answered
 * question rather than queued alongside the others.
 */
export const REVISION_QUESTION = "What change did you make after re-reading the source?";
export const REVISION_HINT =
  "A revision can be to the claim, the citation, or neither - if nothing changed, say why the original still stands.";

/**
 * Questions derived from integrity findings.
 *
 * A finding already contains the specific thing that is wrong and the question a
 * supervisor would ask about it, so these are put first and are never replaced by
 * generic prompts: "which passage supports this?" is a weaker use of the
 * student's time than "this DOI returns a different paper - which did you read?".
 */
export function questionsFromFindings(
  claim: Claim,
  reference: ReferenceEntry | undefined,
  findings: IntegrityFinding[],
): SocraticQuestion[] {
  const relevant = findings.filter(
    (entry) =>
      Boolean(entry.question) &&
      ((entry.claimId && entry.claimId === claim.id) ||
        (entry.referenceId && reference && entry.referenceId === reference.id)),
  );

  const dimensionFor = (mode: IntegrityFinding["mode"]): SocraticDimension => {
    if (mode === "undifferentiated-block-citation" || mode === "descriptive-listing-without-synthesis") {
      return "synthesis";
    }
    if (
      mode === "lack-of-critical-evaluation" ||
      mode === "unsupported-claim" ||
      // A retraction question is about what the withdrawal invalidates.
      mode === "inappropriate-or-discredited-source"
    ) {
      return "limitations";
    }
    if (mode === "citation-chaining" || mode === "non-scholarly-source-as-scholarship") return "relevance";
    if (mode === "missing-citation" || mode === "fabricated-quotation") return "grounding";
    return "selection";
  };

  return relevant.slice(0, 3).map((entry, index) => ({
    id: newId("q"),
    claimId: claim.id,
    referenceId: reference?.id,
    dimension: dimensionFor(entry.mode),
    prompt: entry.question as string,
    hint: `${MODE_LABEL[entry.mode]}: ${truncate(entry.detail, 220)}`,
    order: index,
    generatedBy: "heuristic" as const,
    findingId: entry.id,
  }));
}

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
    prompt: `Is ${marker} direct evidence for this claim, background context, or only a related example? Say which, and why.`,
    hint: "Direct evidence measures or tests the thing you are asserting; background frames it; a related example resembles it without testing it.",
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
  revision: () => ({ prompt: REVISION_QUESTION, hint: REVISION_HINT }),
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
  fromFindings: number;
}

/**
 * Build the whole checkpoint, one claim at a time (sequential: local models are
 * single-slot). Finding-derived questions come first; the model or the bank fills
 * the remaining slots so every claim still gets a grounding question.
 */
export async function planCheckpoint(
  claims: Claim[],
  references: ReferenceEntry[],
  settings: AppSettings,
  findings: IntegrityFinding[] = [],
  onProgress?: (done: number, total: number) => void,
): Promise<CheckpointPlan> {
  const byId = new Map(references.map((reference) => [reference.id, reference] as const));
  const questions: SocraticQuestion[] = [];
  let usedModel = false;
  let fromFindings = 0;

  for (const [index, claim] of claims.entries()) {
    const referenceId = claim.citations.find((citation) => citation.referenceId)?.referenceId;
    const reference = referenceId ? byId.get(referenceId) : undefined;

    const targeted = questionsFromFindings(claim, reference, findings);
    fromFindings += targeted.length;

    const remaining = Math.max(1, 3 - targeted.length);
    const generic = (await questionsForClaim(claim, reference, settings)).slice(0, remaining);
    if (generic.some((question) => question.generatedBy === "local-llm")) usedModel = true;

    questions.push(
      ...[...targeted, ...generic].map((question, order) => ({ ...question, order })),
    );
    onProgress?.(index + 1, claims.length);
  }

  return { questions, usedModel, fromFindings };
}
