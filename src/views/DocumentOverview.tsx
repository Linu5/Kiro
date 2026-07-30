import { AlertTriangle, BookOpen, Play, Quote, Target } from "lucide-react";
import type { ReactNode } from "react";
import { AuthenticityBadge, Button, Card, EmptyState, Pill } from "@/components/ui";
import { UploadZone } from "@/components/UploadZone";
import { FindingsPanel } from "@/components/FindingsPanel";
import { useApp } from "@/state/AppStore";
import { selectCheckpointClaims } from "@/lib/parsing";
import { findingsForReference, MODE_LABEL } from "@/lib/integrity";

/** Phase 1 dashboard: what the parser found, and how trustworthy the sources are. */
export function DocumentOverview(): ReactNode {
  const { document: report, settings, buildCheckpoint, busy, questions, setView } = useApp();

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="pt-4 pb-2 text-center">
          <h2 className="text-[32px] leading-tight font-semibold tracking-tight text-ink">
            Defend every citation.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Upload your literature review and the coach will question the claims that carry the most
            weight, then record how your reasoning compares with an independent reading.
          </p>
        </div>

        <UploadZone />

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              step: "1. Parse",
              copy: "The thesis, every cited sentence and the reference list are extracted locally.",
            },
            {
              step: "2. Verify",
              copy: "Each DOI or title is checked against Crossref and OpenAlex to catch hallucinated or predatory sources.",
            },
            {
              step: "3. Defend",
              copy: "You answer Socratic questions on the highest-stakes claims, quoting the exact evidence you relied on.",
            },
            {
              step: "4. Export",
              copy: "Your reasoning is scored against an independent reading and written into a trace log for your supervisor.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-hairline bg-panel p-5 shadow-panel">
              <p className="text-[13px] font-semibold text-ink">{item.step}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const candidates = selectCheckpointClaims(report, settings.checkpointBudget);
  const unresolved = report.claims
    .flatMap((claim) => claim.citations)
    .filter((citation) => !citation.referenceId).length;
  const suspicious = report.references.filter(
    (reference) =>
      reference.authenticity?.status === "suspicious" || reference.authenticity?.status === "notFound",
  );
  const criticalFindings = report.findings.filter((finding) => finding.severity === "critical").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Executive summary"
          subtitle="Extracted verbatim from the report, not generated"
        >
          <p className="scrollbar-thin max-h-48 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap text-ink-soft">
            {report.executiveSummary || "No abstract or executive summary section was found."}
          </p>
          <div className="mt-4 rounded-xl border border-hairline bg-panel-muted p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
              <Target size={12} /> Detected thesis
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{report.thesis}</p>
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Parse summary">
            <dl className="grid grid-cols-2 gap-3">
              {[
                ["Pages", report.pageCount],
                ["Words", report.wordCount.toLocaleString()],
                ["Cited claims", report.claims.length],
                ["References", report.references.length],
                ["Unmatched markers", unresolved],
                ["Flagged sources", suspicious.length],
                ["Integrity findings", report.findings.length],
                ["Critical", criticalFindings],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-hairline bg-panel-muted px-3 py-2.5">
                  <dt className="text-[11px] text-ink-faint">{label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tracking-tight text-ink tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <Button
              className="mt-4 w-full justify-center py-2 text-[13px]"
              icon={<Play size={13} />}
              disabled={Boolean(busy) || report.claims.length === 0}
              onClick={() => (questions.length > 0 ? setView("checkpoint") : void buildCheckpoint())}
            >
              {questions.length > 0
                ? "Continue Socratic checkpoint"
                : `Start checkpoint on ${candidates.length} claim${candidates.length === 1 ? "" : "s"}`}
            </Button>
          </Card>

          {report.warnings.length > 0 && (
            <Card title="Parser notes">
              <ul className="space-y-2">
                {report.warnings.map((warning, index) => (
                  <li key={index} className="flex gap-2 text-[11px] leading-relaxed text-ink-soft">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
                    {warning}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <FindingsPanel findings={report.findings} references={report.references} />

      <Card
        title="Reference list and source checks"
        subtitle={`${report.references.length} entries \u00b7 only DOI and title metadata was sent for verification`}
      >
        {report.references.length === 0 ? (
          <EmptyState icon={<BookOpen size={20} />} title="No reference entries were segmented">
            The parser could not find a reference list. Check that the section is headed "References" or
            "Bibliography" and that entries start on their own line.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-hairline">
            {report.references.map((reference) => (
              <li key={reference.id} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 w-12 shrink-0 text-[11px] font-semibold text-brand">{reference.marker}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-relaxed text-ink">{reference.title ?? reference.raw}</p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {[reference.authors[0], reference.year, reference.venue, reference.doi]
                      .filter(Boolean)
                      .join(" \u00b7 ")}
                  </p>
                  {reference.authenticity?.flags.length ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-amber-700">
                      {reference.authenticity.flags.join(" ")}
                    </p>
                  ) : null}
                  {findingsForReference(report.findings, reference.id).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {findingsForReference(report.findings, reference.id).map((finding) => (
                        <Pill
                          key={finding.id}
                          tone={finding.severity === "critical" || finding.severity === "major" ? "bad" : "warn"}
                          title={finding.summary}
                        >
                          {MODE_LABEL[finding.mode]}
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <AuthenticityBadge status={reference.authenticity?.status ?? "unverified"} />
                  {reference.authenticity?.registries.length ? (
                    <Pill>{reference.authenticity.registries.join(" + ")}</Pill>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Claims selected for questioning"
        subtitle="Ranked by argumentative weight, with the reason each was picked"
      >
        <ul className="space-y-3">
          {candidates.map((claim) => (
            <li key={claim.id} className="rounded-xl border border-hairline bg-panel-muted p-4">
              <div className="flex items-start gap-2">
                <Quote size={12} className="mt-1.5 shrink-0 text-ink-faint" />
                <p className="text-[13px] leading-relaxed text-ink">{claim.text}</p>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Pill tone="info">p.{claim.page}</Pill>
                <Pill>salience {Math.round(claim.salience * 100)}</Pill>
                {claim.salienceReasons.slice(0, 2).map((reason) => (
                  <Pill key={reason}>{reason}</Pill>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
