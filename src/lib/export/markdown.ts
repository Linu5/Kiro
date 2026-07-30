import { ALIGNMENT_LABEL, BAND_LABEL } from "../scoring";
import { DIMENSION_LABEL } from "../ai/socratic";
import { MODE_LABEL, summariseFindings } from "../integrity";
import type { AppSettings, ReasoningTrace } from "@/types";

/**
 * "Reasoning Trace Log" in Markdown - the artefact a student brings to a
 * supervisor check-in. Everything is rendered from the local trace; nothing is
 * fetched at export time.
 */

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function scoreLine(label: string, value: number): string {
  const filled = Math.round(value / 10);
  return `${label}: ${value}/100 \`${"#".repeat(filled)}${"-".repeat(10 - filled)}\``;
}

export function renderTraceMarkdown(trace: ReasoningTrace, settings: AppSettings): string {
  const { document: report, matrix } = trace;
  const referencesById = new Map(report.references.map((r) => [r.id, r] as const));
  const claimsById = new Map(report.claims.map((c) => [c.id, c] as const));
  const responsesByQuestion = new Map(trace.responses.map((r) => [r.questionId, r] as const));
  const evaluationsByQuestion = new Map(trace.evaluations.map((e) => [e.questionId, e] as const));

  const lines: string[] = [];
  lines.push("# Citation Reasoning Trace Log");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Report | ${escapeCell(report.title)} |`);
  lines.push(`| File | ${escapeCell(report.fileName)} (${report.pageCount} pages, ${report.wordCount} words) |`);
  if (settings.projectTitle) lines.push(`| Project | ${escapeCell(settings.projectTitle)} |`);
  if (settings.studentName) lines.push(`| Student | ${escapeCell(settings.studentName)} |`);
  if (settings.supervisorName) lines.push(`| Supervisor | ${escapeCell(settings.supervisorName)} |`);
  lines.push(`| Exported | ${new Date(trace.exportedAt).toLocaleString()} |`);
  lines.push(`| Coach version | ${trace.appVersion} |`);
  lines.push(
    `| Reasoning engine | ${
      trace.evaluations.some((e) => e.generatedBy === "local-llm")
        ? `local model (${[...new Set(trace.evaluations.map((e) => e.model))].join(", ")})`
        : "deterministic heuristics (no model was running)"
    } |`,
  );
  lines.push("");
  lines.push("> Generated on the student's device. Report text was never transmitted; only citation");
  lines.push("> metadata (DOI/title) was sent to Crossref/OpenAlex for source verification.");
  lines.push("");

  lines.push("## 1. Report thesis");
  lines.push("");
  lines.push(`> ${report.thesis.replace(/\n+/g, " ")}`);
  lines.push("");
  if (report.executiveSummary.trim().length > 0) {
    lines.push("<details><summary>Extracted executive summary</summary>");
    lines.push("");
    lines.push(report.executiveSummary.trim());
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  lines.push("## 2. Citation health matrix");
  lines.push("");
  lines.push(
    `Checkpoint completion: **${matrix.answered}/${matrix.total}** questions answered across ${matrix.rows.length} claim-citation pairs.`,
  );
  lines.push("");
  lines.push(scoreLine("Authenticity", matrix.averageScore.authenticity));
  lines.push("");
  lines.push(scoreLine("Relevance", matrix.averageScore.relevance));
  lines.push("");
  lines.push(scoreLine("Depth of reasoning", matrix.averageScore.depth));
  lines.push("");
  lines.push(`**Overall citation quality: ${matrix.averageScore.overall}/100**`);
  lines.push("");
  lines.push("| Band | Count |");
  lines.push("| --- | --- |");
  for (const band of ["high", "valid", "weak", "unverified"] as const) {
    lines.push(`| ${BAND_LABEL[band]} | ${matrix.counts[band]} |`);
  }
  lines.push("");
  lines.push("| Marker | Claim | Alignment | Auth | Rel | Depth | Band |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of matrix.rows) {
    const claim = claimsById.get(row.claimId);
    lines.push(
      `| ${escapeCell(row.marker)} | ${escapeCell((claim?.text ?? "").slice(0, 90))}\u2026 | ${
        ALIGNMENT_LABEL[row.alignment]
      } | ${row.score.authenticity} | ${row.score.relevance} | ${row.score.depth} | ${BAND_LABEL[row.band]} |`,
    );
  }
  lines.push("");

  if (report.findings.length > 0) {
    const summary = summariseFindings(report.findings, report.references.length);
    lines.push("## 3. Citation integrity findings");
    lines.push("");
    lines.push(
      `${summary.total} findings: ${summary.bySeverity.critical} critical, ${summary.bySeverity.major} major, ${summary.bySeverity.moderate} moderate. ${summary.confirmed} are established from the document or a registry record; ${summary.needsEvidence} need evidence from the student. ${summary.cleanReferences} of ${report.references.length} references carry no finding.`,
    );
    lines.push("");
    lines.push("| Severity | Failure mode | Ref | Finding | Status |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const entry of report.findings) {
      lines.push(
        `| ${entry.severity} | ${MODE_LABEL[entry.mode]} | ${escapeCell(entry.markers.join(", ") || "-")} | ${escapeCell(entry.summary)} | ${entry.confidence === "confirmed" ? "confirmed" : "needs evidence"} |`,
      );
    }
    lines.push("");
    for (const entry of report.findings) {
      lines.push(`**${MODE_LABEL[entry.mode]}${entry.markers.length > 0 ? ` - ${entry.markers.join(", ")}` : ""}.** ${entry.detail}`);
      lines.push("");
      if (entry.question) {
        lines.push(`> Question to answer: ${entry.question}`);
        lines.push("");
      }
      if (entry.guardNote) {
        lines.push(`> Restraint: ${entry.guardNote}`);
        lines.push("");
      }
    }
  }

  lines.push("## 4. Reasoning trace");
  lines.push("");
  const grouped = new Map<string, typeof trace.questions>();
  for (const question of trace.questions) {
    const list = grouped.get(question.claimId) ?? [];
    list.push(question);
    grouped.set(question.claimId, list);
  }

  let index = 1;
  for (const [claimId, questions] of grouped) {
    const claim = claimsById.get(claimId);
    if (!claim) continue;
    lines.push(`### 4.${index} Claim (p.${claim.page}${claim.section ? `, ${claim.section}` : ""})`);
    index += 1;
    lines.push("");
    lines.push(`> ${claim.text}`);
    lines.push("");
    const reference = questions[0]?.referenceId ? referencesById.get(questions[0].referenceId) : undefined;
    if (reference) {
      lines.push(`**Cited source** ${reference.marker} - ${reference.raw}`);
      lines.push("");
      const authenticity = reference.authenticity;
      if (authenticity) {
        lines.push(
          `**Source check** ${authenticity.status}${
            authenticity.registries.length > 0 ? ` via ${authenticity.registries.join(", ")}` : ""
          }${authenticity.flags.length > 0 ? ` - ${authenticity.flags.join("; ")}` : ""}`,
        );
        lines.push("");
      }
    } else {
      lines.push("**Cited source** unresolved inline marker - no matching reference-list entry.");
      lines.push("");
    }

    for (const question of questions) {
      const response = responsesByQuestion.get(question.id);
      const evaluation = evaluationsByQuestion.get(question.id);
      lines.push(`#### ${DIMENSION_LABEL[question.dimension]}`);
      lines.push("");
      lines.push(`**Q.** ${question.prompt}`);
      lines.push("");
      if (!response) {
        lines.push("**A.** _not answered_");
        lines.push("");
        continue;
      }
      if (response.evidenceExcerpt.trim().length > 0) {
        lines.push(`**Evidence highlighted${response.evidencePage ? ` (p.${response.evidencePage})` : ""}**`);
        lines.push("");
        lines.push(`> ${response.evidenceExcerpt.replace(/\n+/g, " ")}`);
        lines.push("");
      }
      lines.push(`**Student rationale.** ${response.rationale}`);
      lines.push("");
      if (evaluation) {
        lines.push(`**AI reasoning.** ${evaluation.aiInsight}`);
        lines.push("");
        lines.push(`**Expected evidence.** ${evaluation.aiExpectedEvidence}`);
        lines.push("");
        lines.push(
          `**Comparison.** ${ALIGNMENT_LABEL[evaluation.alignment]} (overlap ${Math.round(
            evaluation.similarity * 100,
          )}%, relevance ${evaluation.score.relevance}, depth ${evaluation.score.depth}, source ${
            evaluation.generatedBy === "local-llm" ? evaluation.model : "heuristic"
          })`,
        );
        lines.push("");
        for (const gap of evaluation.gaps) {
          lines.push(`- **${gap.kind}**: ${gap.detail}`);
        }
        lines.push("");
      }
    }
  }

  if (report.warnings.length > 0) {
    lines.push("## 5. Parser notes");
    lines.push("");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    "_Socratic Citation Coach records what the student wrote and how it compared with an independent reading of the same citation. It is evidence for a supervision conversation, not a grade._",
  );
  lines.push("");
  return lines.join("\n");
}
