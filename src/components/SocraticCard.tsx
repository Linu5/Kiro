import { Bot, Check, ChevronRight, Lightbulb, Loader2, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AlignmentBadge, Button, Pill, ScoreGrid } from "./ui";
import { DIMENSION_LABEL } from "@/lib/ai/socratic";
import type { Evaluation, SocraticQuestion, StudentResponse } from "@/types";

const textareaClass =
  "mt-1.5 w-full resize-y rounded-xl border border-hairline-strong bg-panel px-3.5 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none";

/**
 * Right panel of the Socratic view: the question, the student's evidence and
 * rationale, and - once submitted - the side-by-side reasoning comparison.
 */
export function SocraticCard({
  question,
  index,
  total,
  response,
  evaluation,
  pendingEvidence,
  busy,
  onSubmit,
  onNext,
}: {
  question: SocraticQuestion;
  index: number;
  total: number;
  response: StudentResponse | undefined;
  evaluation: Evaluation | undefined;
  pendingEvidence: string;
  busy: boolean;
  onSubmit: (input: { rationale: string; evidenceExcerpt: string }) => void;
  onNext: () => void;
}): ReactNode {
  const [rationale, setRationale] = useState(response?.rationale ?? "");
  const [evidence, setEvidence] = useState(response?.evidenceExcerpt ?? "");
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setRationale(response?.rationale ?? "");
    setEvidence(response?.evidenceExcerpt ?? "");
    setShowHint(false);
  }, [question.id, response]);

  useEffect(() => {
    if (pendingEvidence) setEvidence(pendingEvidence);
  }, [pendingEvidence]);

  const wordCount = rationale.trim() ? rationale.trim().split(/\s+/).length : 0;
  const canSubmit = wordCount >= 10 && !busy;

  return (
    <div className="scrollbar-thin flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <div className="rounded-2xl border border-hairline bg-panel p-5 shadow-panel">
        <div className="flex items-center justify-between gap-2">
          <Pill tone="info">{DIMENSION_LABEL[question.dimension]}</Pill>
          <span className="text-[11px] text-ink-faint">
            Question {index + 1} of {total}
            {question.generatedBy === "heuristic" ? " \u00b7 built-in bank" : " \u00b7 local model"}
          </span>
        </div>

        <p className="mt-4 text-[17px] leading-snug font-semibold tracking-tight text-ink">{question.prompt}</p>

        {question.hint && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowHint((value) => !value)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 hover:text-amber-800"
            >
              <Lightbulb size={12} />
              {showHint ? "Hide nudge" : "Need a nudge?"}
            </button>
            {showHint && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                {question.hint}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-ink">Evidence excerpt</span>
            <textarea
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              rows={3}
              placeholder="Highlight the passage in the viewer, or paste the exact sentence from the source."
              className={textareaClass}
            />
          </label>

          <label className="block">
            <span className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-ink">Your critical rationale</span>
              <span className={wordCount >= 10 ? "text-[11px] text-ink-faint" : "text-[11px] text-amber-700"}>
                {wordCount} words {wordCount < 10 ? "(10 minimum)" : ""}
              </span>
            </span>
            <textarea
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              rows={6}
              placeholder="In your own words: what does this passage establish, and why is it enough to support your claim? Name the limits."
              className={textareaClass}
            />
          </label>

          <div className="flex items-center justify-between">
            <Button
              onClick={() => onSubmit({ rationale, evidenceExcerpt: evidence })}
              disabled={!canSubmit}
              icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            >
              {response ? "Re-evaluate" : "Submit for comparison"}
            </Button>
            <Button variant="ghost" onClick={onNext} icon={<ChevronRight size={13} />}>
              Next question
            </Button>
          </div>
        </div>
      </div>

      {evaluation && (
        <div className="rounded-2xl border border-hairline bg-panel p-5 shadow-panel">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink">Reasoning comparison</h3>
            <div className="flex items-center gap-2">
              <AlignmentBadge alignment={evaluation.alignment} />
              <Pill>{evaluation.generatedBy === "local-llm" ? evaluation.model : "heuristic"}</Pill>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-hairline bg-panel-muted p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
                <Bot size={12} /> AI extracted insight
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink">{evaluation.aiInsight}</p>
              <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">
                Expected evidence: {evaluation.aiExpectedEvidence}
              </p>
            </div>
            <div className="rounded-xl border border-hairline bg-panel-muted p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                <User size={12} /> Your rationale
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink">
                {response?.rationale ?? evaluation.studentSummary}
              </p>
              {response?.evidenceExcerpt && (
                <p className="mt-2.5 border-l-2 border-hairline-strong pl-2.5 text-[11px] leading-relaxed text-ink-soft italic">
                  {response.evidenceExcerpt}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <ScoreGrid score={evaluation.score} />
          </div>

          <ul className="mt-4 space-y-2">
            {evaluation.gaps.map((gap, gapIndex) => (
              <li key={gapIndex} className="flex gap-2 text-[11px] leading-relaxed">
                <Pill tone={gap.kind === "strength" ? "good" : "warn"}>{gap.kind}</Pill>
                <span className="text-ink-soft">{gap.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
