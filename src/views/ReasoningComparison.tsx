import { BarChart3, Bot, User } from "lucide-react";
import type { ReactNode } from "react";
import {
  AlignmentBadge,
  AuthenticityBadge,
  BandBadge,
  Card,
  EmptyState,
  Pill,
  ScoreGrid,
} from "@/components/ui";
import { BAND_LABEL } from "@/lib/scoring";
import { DIMENSION_LABEL } from "@/lib/ai/socratic";
import { useApp } from "@/state/AppStore";
import type { HealthBand } from "@/types";

const BAND_ORDER: HealthBand[] = ["high", "valid", "weak", "unverified"];
const BAND_DOT: Record<HealthBand, string> = {
  high: "bg-emerald-500",
  valid: "bg-brand",
  weak: "bg-rose-500",
  unverified: "bg-amber-400",
};

/** Phase 3 dashboard: the citation health matrix and the comparison cards. */
export function ReasoningComparison(): ReactNode {
  const { document: report, matrix, questions, responses, evaluations, claimsById, referencesById, setView } = useApp();

  if (!report || !matrix) {
    return (
      <EmptyState icon={<BarChart3 size={20} />} title="Nothing to compare yet">
        Upload a report and answer at least one Socratic question.
      </EmptyState>
    );
  }

  const answeredQuestions = questions.filter((question) => responses[question.id]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Citation quality" subtitle="Averaged across every evaluated citation">
          <ScoreGrid score={matrix.averageScore} />
          <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
            Weighting: authenticity 30%, relevance 35%, depth of reasoning 35%. Unanswered questions are excluded
            from the averages but still count as unverified in the matrix.
          </p>
        </Card>

        <Card title="Citation health matrix" subtitle={`${matrix.answered}/${matrix.total} questions answered`}>
          <ul className="space-y-2.5">
            {BAND_ORDER.map((band) => (
              <li key={band} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-ink-soft">
                  <span className={`size-2 rounded-full ${BAND_DOT[band]}`} />
                  {BAND_LABEL[band]}
                </span>
                <span className="font-semibold text-ink tabular-nums">{matrix.counts[band]}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Claim-citation pairs" subtitle="One row per cited source per claim">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-[11px] text-ink-faint">
              <tr>
                <th className="pb-2 pr-3 font-medium">Marker</th>
                <th className="pb-2 pr-3 font-medium">Claim</th>
                <th className="pb-2 pr-3 font-medium">Source</th>
                <th className="pb-2 pr-3 font-medium">Alignment</th>
                <th className="pb-2 pr-3 font-medium">Auth</th>
                <th className="pb-2 pr-3 font-medium">Rel</th>
                <th className="pb-2 pr-3 font-medium">Depth</th>
                <th className="pb-2 font-medium">Band</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {matrix.rows.map((row) => {
                const claim = claimsById.get(row.claimId);
                return (
                  <tr key={`${row.claimId}:${row.referenceId ?? "none"}`} className="align-top">
                    <td className="py-3 pr-3 font-semibold text-brand">{row.marker}</td>
                    <td className="max-w-[280px] py-3 pr-3 text-ink">
                      <button
                        type="button"
                        className="line-clamp-2 text-left hover:text-brand"
                        title={claim?.text}
                        onClick={() => setView("checkpoint")}
                      >
                        {claim?.text ?? "\u2014"}
                      </button>
                    </td>
                    <td className="py-3 pr-3">
                      <AuthenticityBadge status={row.authenticity} />
                    </td>
                    <td className="py-3 pr-3">
                      <AlignmentBadge alignment={row.alignment} />
                    </td>
                    <td className="py-3 pr-3 text-ink-soft tabular-nums">{row.score.authenticity}</td>
                    <td className="py-3 pr-3 text-ink-soft tabular-nums">{row.score.relevance}</td>
                    <td className="py-3 pr-3 text-ink-soft tabular-nums">{row.score.depth}</td>
                    <td className="py-3">
                      <BandBadge band={row.band} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {answeredQuestions.length === 0 ? (
        <EmptyState icon={<Bot size={20} />} title="No answers submitted yet">
          Answer a Socratic question to see the AI reading beside your own rationale.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {answeredQuestions.map((question) => {
            const claim = claimsById.get(question.claimId);
            const reference = question.referenceId ? referencesById.get(question.referenceId) : undefined;
            const response = responses[question.id];
            const evaluation = evaluations[question.id];
            if (!claim || !response) return null;

            return (
              <Card
                key={question.id}
                title={`${reference?.marker ?? "Unresolved marker"} \u00b7 ${DIMENSION_LABEL[question.dimension]}`}
                subtitle={`p.${claim.page}${claim.section ? ` \u00b7 ${claim.section}` : ""}`}
                actions={
                  evaluation ? (
                    <AlignmentBadge alignment={evaluation.alignment} />
                  ) : (
                    <Pill>{"evaluating\u2026"}</Pill>
                  )
                }
              >
                <p className="border-l-[3px] border-amber-400 pl-3 text-[13px] leading-relaxed text-ink">
                  {claim.text}
                </p>
                <p className="mt-2.5 text-[11px] text-ink-faint italic">Q. {question.prompt}</p>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-hairline bg-panel-muted p-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
                      <Bot size={12} /> AI extracted insight
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink">{evaluation?.aiInsight ?? "\u2014"}</p>
                  </div>
                  <div className="rounded-xl border border-hairline bg-panel-muted p-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                      <User size={12} /> Student provided rationale
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink">{response.rationale}</p>
                    {response.evidenceExcerpt && (
                      <p className="mt-2.5 border-l-2 border-hairline-strong pl-2.5 text-[11px] leading-relaxed text-ink-soft italic">
                        {response.evidenceExcerpt}
                      </p>
                    )}
                  </div>
                </div>

                {evaluation && (
                  <>
                    <div className="mt-4">
                      <ScoreGrid score={evaluation.score} />
                    </div>
                    <ul className="mt-4 space-y-2">
                      {evaluation.gaps.map((gap, index) => (
                        <li key={index} className="flex gap-2 text-[11px] leading-relaxed">
                          <Pill tone={gap.kind === "strength" ? "good" : "warn"}>{gap.kind}</Pill>
                          <span className="text-ink-soft">{gap.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
