import type {
  Alignment,
  AuthenticityStatus,
  AuthenticityVerdict,
  CitationHealthMatrix,
  CitationHealthRow,
  CitationScore,
  Claim,
  Evaluation,
  HealthBand,
  ReferenceEntry,
  ReportDocument,
  SocraticQuestion,
  StudentResponse,
} from "@/types";

/**
 * Citation quality metric.
 *
 * Three independent dimensions, deliberately kept separable so a supervisor can
 * see *why* a citation scored badly:
 *   authenticity - does the source exist and is it reputably indexed?
 *   relevance    - is it direct evidence for this claim, or background padding?
 *   depth        - did the student engage critically in their own words?
 */

export const WEIGHTS = { authenticity: 0.3, relevance: 0.35, depth: 0.35 } as const;

export function authenticityScore(verdict: AuthenticityVerdict | undefined): number {
  if (!verdict) return 50; // never checked - neutral, and flagged in the UI
  switch (verdict.status) {
    case "verified":
      return Math.max(60, Math.min(100, verdict.score));
    case "suspicious":
      return Math.min(45, Math.max(15, verdict.score));
    case "notFound":
      return 10;
    default:
      return 50;
  }
}

export function rollUp(authenticity: number, relevance: number, depth: number): CitationScore {
  const clamp = (value: number): number => Math.round(Math.max(0, Math.min(100, value)));
  const a = clamp(authenticity);
  const r = clamp(relevance);
  const d = clamp(depth);
  return {
    authenticity: a,
    relevance: r,
    depth: d,
    overall: Math.round(a * WEIGHTS.authenticity + r * WEIGHTS.relevance + d * WEIGHTS.depth),
  };
}

/**
 * Band a scored citation for the health matrix.
 * `unverified` outranks the quality bands: an unverifiable source is a
 * different kind of problem from a weakly justified one.
 */
export function bandFor(
  score: CitationScore,
  alignment: Alignment,
  authenticity: AuthenticityStatus,
): HealthBand {
  if (authenticity === "notFound" || authenticity === "suspicious") return "unverified";
  if (alignment === "pending") return "unverified";
  if (alignment === "misaligned" || score.depth < 40 || score.overall < 55) return "weak";
  if (alignment === "aligned" && score.overall >= 75 && score.depth >= 70) return "high";
  return "valid";
}

export const BAND_LABEL: Record<HealthBand, string> = {
  high: "High quality",
  valid: "Valid",
  weak: "Weak grounding",
  unverified: "Unverified",
};

export const ALIGNMENT_LABEL: Record<Alignment, string> = {
  aligned: "Aligned",
  surface: "Surface-level",
  misaligned: "Misaligned",
  pending: "Not answered",
};

const EMPTY_COUNTS: Record<HealthBand, number> = { high: 0, valid: 0, weak: 0, unverified: 0 };

export interface MatrixInput {
  document: ReportDocument;
  questions: SocraticQuestion[];
  responses: StudentResponse[];
  evaluations: Evaluation[];
}

/**
 * One row per (claim, cited reference) pair that the checkpoint covers, so a
 * claim bundling three sources is audited three times.
 */
export function buildMatrix({
  document,
  questions,
  responses,
  evaluations,
}: MatrixInput): CitationHealthMatrix {
  const referencesById = new Map(document.references.map((r) => [r.id, r] as const));
  const claimsById = new Map(document.claims.map((c) => [c.id, c] as const));
  const answeredIds = new Set(responses.map((r) => r.questionId));
  const evaluationByQuestion = new Map(evaluations.map((e) => [e.questionId, e] as const));

  const rows: CitationHealthRow[] = [];
  const counts: Record<HealthBand, number> = { ...EMPTY_COUNTS };
  const seen = new Set<string>();

  for (const question of questions) {
    const claim = claimsById.get(question.claimId);
    if (!claim) continue;
    const key = `${question.claimId}:${question.referenceId ?? "unresolved"}`;
    if (seen.has(key)) continue;

    const reference = question.referenceId ? referencesById.get(question.referenceId) : undefined;
    const status: AuthenticityStatus = question.referenceId
      ? reference?.authenticity?.status ?? "unverified"
      : "notFound"; // an inline marker with no reference entry is a hallucination risk

    // Use the best evaluation available for this claim/reference pair.
    const relevant = questions
      .filter((q) => q.claimId === question.claimId && q.referenceId === question.referenceId)
      .map((q) => evaluationByQuestion.get(q.id))
      .filter((e): e is Evaluation => e !== undefined);

    let alignment: Alignment = "pending";
    let score = rollUp(authenticityScore(reference?.authenticity), 0, 0);

    if (relevant.length > 0) {
      const avgRelevance = relevant.reduce((sum, e) => sum + e.score.relevance, 0) / relevant.length;
      const avgDepth = relevant.reduce((sum, e) => sum + e.score.depth, 0) / relevant.length;
      score = rollUp(authenticityScore(reference?.authenticity), avgRelevance, avgDepth);
      const rank: Record<Exclude<Alignment, "pending">, number> = {
        misaligned: 0,
        surface: 1,
        aligned: 2,
      };
      alignment = relevant
        .map((e) => e.alignment)
        .filter((a): a is Exclude<Alignment, "pending"> => a !== "pending")
        .sort((a, b) => rank[a] - rank[b])[0] ?? "pending";
    }

    const band = bandFor(score, alignment, status);
    counts[band] += 1;
    seen.add(key);
    rows.push({
      referenceId: question.referenceId,
      claimId: question.claimId,
      marker: reference?.marker ?? claim.citations[0]?.marker ?? "unresolved",
      band,
      score,
      alignment,
      authenticity: status,
    });
  }

  const scored = rows.filter((row) => row.alignment !== "pending");
  const average = (pick: (row: CitationHealthRow) => number): number =>
    scored.length === 0 ? 0 : Math.round(scored.reduce((sum, row) => sum + pick(row), 0) / scored.length);

  return {
    rows,
    counts,
    averageScore: {
      authenticity: average((row) => row.score.authenticity),
      relevance: average((row) => row.score.relevance),
      depth: average((row) => row.score.depth),
      overall: average((row) => row.score.overall),
    },
    answered: questions.filter((question) => answeredIds.has(question.id)).length,
    total: questions.length,
  };
}

/** Short human-readable verdict used on cards and in the export. */
export function verdictSentence(row: CitationHealthRow, claim: Claim | undefined, reference: ReferenceEntry | undefined): string {
  const marker = reference?.marker ?? row.marker;
  switch (row.band) {
    case "high":
      return `${marker} is verified and the student's justification matches the evidence.`;
    case "valid":
      return `${marker} supports the claim, but the justification stays close to the surface.`;
    case "weak":
      return `${marker} is weakly grounded for "${claim ? claim.text.slice(0, 60) : "this claim"}\u2026".`;
    default:
      return `${marker} could not be verified against Crossref or OpenAlex.`;
  }
}
