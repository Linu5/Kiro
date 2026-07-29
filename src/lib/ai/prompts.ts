import { truncate } from "../text";
import type { Claim, ReferenceEntry, SocraticDimension, StudentResponse } from "@/types";

/**
 * Every prompt the app sends to the local model lives here, so a supervisor (or
 * an ethics reviewer) can audit exactly what the coach asks and what it never
 * asks. Two hard rules are encoded in the system prompts:
 *
 *  1. The coach must not write the student's rationale for them.
 *  2. The evaluator must judge only what the student actually wrote.
 */

export const SOCRATIC_SYSTEM = `You are a Socratic research supervisor for final-year engineering and computing students.
You ask short, probing questions that force a student to justify a citation with specific evidence.
Rules:
- Never state the answer, never summarise the source, never write the student's rationale.
- One question per item, at most 28 words, plain language, no preamble.
- Target verifiable specifics: which passage, which result, which sample, which limitation, which alternative.
- Respond with JSON only.`;

export const EVALUATOR_SYSTEM = `You are an assessor of citation reasoning quality in student literature reviews.
You receive a claim, its cited reference metadata, the excerpt the student highlighted, and the student's own rationale.
Rules:
- Reason independently about whether the cited source can support the claim, then compare with the student's reasoning.
- Judge only the text provided. Never invent findings, numbers or page contents that are not present.
- If the excerpt does not appear to support the claim, say so plainly.
- Be concise and specific. Respond with JSON only.`;

const DIMENSION_BRIEF: Record<SocraticDimension, string> = {
  grounding: "which exact passage, result or figure in the source supports the claim",
  limitations: "what limitations, sample constraints or context boundaries the source carries",
  selection: "why this source or sentence was chosen over alternative findings",
  relevance: "whether the source is direct evidence or merely background framing",
  synthesis: "how this source relates to the other sources cited nearby",
};

function referenceBlock(reference: ReferenceEntry | undefined): string {
  if (!reference) return "Reference metadata: unresolved inline marker (no matching reference entry).";
  return [
    `Reference marker: ${reference.marker}`,
    `Authors: ${reference.authors.slice(0, 4).join("; ") || "unknown"}`,
    `Title: ${reference.title ?? "unknown"}`,
    `Year: ${reference.year ?? "unknown"}`,
    `Venue: ${reference.venue ?? "unknown"}`,
    `DOI: ${reference.doi ?? "none"}`,
  ].join("\n");
}

export function socraticQuestionPrompt(
  claim: Claim,
  reference: ReferenceEntry | undefined,
  dimensions: SocraticDimension[],
): string {
  return `A student wrote this cited claim in their literature review.

Claim: "${truncate(claim.text, 700)}"
${referenceBlock(reference)}

Write one Socratic question for each of the following focus areas, in order:
${dimensions.map((d, i) => `${i + 1}. ${d} - probe ${DIMENSION_BRIEF[d]}`).join("\n")}

Return JSON exactly of the form:
{"questions":[{"dimension":"<focus area>","prompt":"<question>","hint":"<one short nudge that does not reveal the answer>"}]}`;
}

export function dualReasoningPrompt(
  claim: Claim,
  reference: ReferenceEntry | undefined,
  response: StudentResponse,
  question: string,
): string {
  return `Claim from the student's report: "${truncate(claim.text, 700)}"
${referenceBlock(reference)}

Socratic question asked: "${question}"
Excerpt the student highlighted as evidence: "${truncate(response.evidenceExcerpt, 900) || "(none provided)"}"
Student's own rationale: "${truncate(response.rationale, 1200) || "(none provided)"}"

Do three things:
1. aiInsight: your own 2-3 sentence reading of whether and how the cited source can support this claim, based only on the metadata and excerpt available.
2. aiExpectedEvidence: one sentence naming the kind of evidence a defensible justification would have to quote.
3. Compare your reasoning with the student's and classify the alignment:
   - "aligned": the student identifies the same supporting logic with specific evidence.
   - "surface": the student is not wrong but stays generic, restates the claim, or cites the source's topic rather than its findings.
   - "misaligned": the student's reasoning contradicts the source, over-generalises it, or the excerpt does not support the claim.

Return JSON exactly of the form:
{"aiInsight":"...","aiExpectedEvidence":"...","studentSummary":"<one sentence restating what the student argued>","alignment":"aligned|surface|misaligned","similarity":0.0,"gaps":[{"kind":"over-generalisation|misinterpretation|missing-evidence|superficial|unsupported-causality|strength","detail":"..."}],"relevance":0,"depth":0}

relevance: 0-100, how directly the cited source evidences this specific claim.
depth: 0-100, how much independent critical engagement the student's rationale shows.`;
}

export function thesisPrompt(summaryText: string): string {
  return `Below is the abstract or opening of a student capstone report. In one sentence, state the report's central thesis using only wording grounded in the text. Return JSON: {"thesis":"..."}

Text:
"""
${truncate(summaryText, 4000)}
"""`;
}
