import { HelpCircle, Loader2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button, EmptyState, Pill } from "@/components/ui";
import { DocumentViewer } from "@/components/DocumentViewer";
import { SocraticCard } from "@/components/SocraticCard";
import { useApp } from "@/state/AppStore";

/** Phase 2: the interactive checkpoint. Document on the left, coach on the right. */
export function SocraticCheckpoint(): ReactNode {
  const {
    document: report,
    questions,
    responses,
    evaluations,
    activeQuestionId,
    setActiveQuestion,
    submitAnswer,
    buildCheckpoint,
    busy,
    claimsById,
    referencesById,
  } = useApp();
  const [pendingEvidence, setPendingEvidence] = useState("");

  const activeIndex = useMemo(
    () => Math.max(0, questions.findIndex((question) => question.id === activeQuestionId)),
    [activeQuestionId, questions],
  );
  const question = questions[activeIndex];

  if (!report) {
    return (
      <EmptyState icon={<HelpCircle size={20} />} title="No report loaded">
        Upload a literature review in Document Overview first.
      </EmptyState>
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState icon={<HelpCircle size={20} />} title="No checkpoint prepared yet">
        <p>
          The coach will select the highest-salience cited claims and generate targeted questions for each of
          them. With a local model running the questions are tailored to the claim; without one, a built-in
          question bank is used.
        </p>
        <Button
          className="mt-4 px-5 py-2 text-[13px]"
          icon={busy ? <Loader2 size={13} className="animate-spin" /> : undefined}
          disabled={Boolean(busy)}
          onClick={() => void buildCheckpoint()}
        >
          {busy ? busy.message : "Prepare Socratic questions"}
        </Button>
      </EmptyState>
    );
  }

  if (!question) return null;
  const claim = claimsById.get(question.claimId);
  if (!claim) return null;
  const reference = question.referenceId ? referencesById.get(question.referenceId) : undefined;

  const goTo = (index: number): void => {
    const next = questions[Math.max(0, Math.min(questions.length - 1, index))];
    if (next) {
      setActiveQuestion(next.id);
      setPendingEvidence("");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-hairline bg-panel px-3 py-2 shadow-panel">
        {questions.map((entry, index) => {
          const answered = Boolean(responses[entry.id]);
          const alignment = evaluations[entry.id]?.alignment;
          const tone = !answered
            ? "neutral"
            : alignment === "aligned"
              ? "good"
              : alignment === "misaligned"
                ? "bad"
                : "warn";
          return (
            <button key={entry.id} type="button" onClick={() => goTo(index)} title={entry.prompt}>
              <Pill tone={index === activeIndex ? "info" : tone}>Q{index + 1}</Pill>
            </button>
          );
        })}
        <span className="ml-auto pr-2 text-[11px] text-ink-faint">
          {Object.keys(responses).length} of {questions.length} answered
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <DocumentViewer
          document={report}
          claim={claim}
          reference={reference}
          onUseSelection={(excerpt) => setPendingEvidence(excerpt)}
        />
        <SocraticCard
          question={question}
          index={activeIndex}
          total={questions.length}
          response={responses[question.id]}
          evaluation={evaluations[question.id]}
          pendingEvidence={pendingEvidence}
          busy={Boolean(busy)}
          onSubmit={(input) => void submitAnswer(question, input)}
          onNext={() => goTo(activeIndex + 1)}
        />
      </div>
    </div>
  );
}
