import { Download, FileCheck2, FileText, HardDrive, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Button, Card, EmptyState, Pill } from "@/components/ui";
import { buildTrace, renderTraceMarkdown } from "@/lib/export";
import { useApp } from "@/state/AppStore";

/** Phase 4: the artefact a student brings to the supervision meeting. */
export function AuditReport(): ReactNode {
  const {
    document: report,
    questions,
    responses,
    evaluations,
    settings,
    runExport,
    busy,
    savedTraces,
    removeTrace,
  } = useApp();

  const preview = useMemo(() => {
    if (!report) return "";
    const trace = buildTrace({
      document: report,
      questions,
      responses: Object.values(responses),
      evaluations: Object.values(evaluations),
    });
    return renderTraceMarkdown(trace, settings);
  }, [evaluations, questions, report, responses, settings]);

  if (!report) {
    return (
      <EmptyState icon={<FileCheck2 size={20} />} title="No report loaded">
        Upload a literature review and complete at least part of the checkpoint to generate an audit trace.
      </EmptyState>
    );
  }

  const unanswered = questions.length - Object.keys(responses).length;

  return (
    <div className="space-y-5">
      <Card
        title="Reasoning Trace Log"
        subtitle="Rendered from the local trace; nothing is fetched at export time"
        actions={
          <>
            <Button
              variant="subtle"
              icon={<FileText size={13} />}
              disabled={Boolean(busy)}
              onClick={() => void runExport("markdown")}
            >
              Markdown
            </Button>
            <Button icon={<Download size={13} />} disabled={Boolean(busy)} onClick={() => void runExport("pdf")}>
              PDF
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="info">{questions.length} questions</Pill>
          <Pill tone={unanswered === 0 ? "good" : "warn"}>
            {unanswered === 0 ? "all answered" : `${unanswered} unanswered`}
          </Pill>
          <Pill>
            {Object.values(evaluations).some((evaluation) => evaluation.generatedBy === "local-llm")
              ? "local model reasoning"
              : "heuristic reasoning"}
          </Pill>
          {settings.supervisorName && <Pill>for {settings.supervisorName}</Pill>}
        </div>

        {unanswered > 0 && (
          <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
            Unanswered questions are included in the log as gaps rather than dropped, so the record stays honest
            about what was and was not defended.
          </p>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-panel-muted">
          <p className="border-b border-hairline px-4 py-2.5 text-[11px] font-medium text-ink-soft">
            Preview (Markdown source)
          </p>
          <pre className="scrollbar-thin max-h-96 overflow-auto px-4 py-3 text-[11px] leading-relaxed whitespace-pre-wrap text-ink-soft">
            {preview}
          </pre>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Privacy statement" subtitle="What this export does and does not contain">
          <ul className="space-y-3 text-[13px] leading-relaxed text-ink-soft">
            <li className="flex gap-2.5">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              The report file was parsed on this device and was never uploaded.
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              Only citation metadata (DOI, title, first author, year) was sent to Crossref and OpenAlex, and only
              for the source-verification column.
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              Reasoning came from a model running on this machine, or from local heuristics when no model was
              available. Which one is recorded per evaluation.
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              The export holds the claims you were questioned on, your rationales and the comparison. It is
              evidence for a conversation, not a grade.
            </li>
          </ul>
        </Card>

        <Card title="Saved traces on this device" subtitle="SQLite in the app data directory">
          {savedTraces.length === 0 ? (
            <p className="text-[13px] text-ink-faint">No traces stored yet.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {savedTraces.map((trace) => (
                <li key={trace.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <HardDrive size={14} className="shrink-0 text-ink-faint" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink">{trace.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {`${new Date(trace.createdAt).toLocaleString()} \u00b7 ${trace.claimCount} claims \u00b7 ${trace.answeredCount} answered`}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    icon={<Trash2 size={12} />}
                    onClick={() => void removeTrace(trace.id)}
                    title="Delete this stored trace"
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
