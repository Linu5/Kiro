import { ALIGNMENT_LABEL, BAND_LABEL } from "../scoring";
import { DIMENSION_LABEL } from "../ai/socratic";
import { MODE_LABEL, summariseFindings } from "../integrity";
import type { AppSettings, ReasoningTrace } from "@/types";

/**
 * PDF rendering of the Reasoning Trace Log. jsPDF runs in-process, so the
 * export never touches a print service or a remote renderer.
 */

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = 52;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

interface Cursor {
  y: number;
  page: number;
}

export async function renderTracePdf(
  trace: ReasoningTrace,
  settings: AppSettings,
): Promise<Blob> {
  // jsPDF is only needed when a PDF is actually exported.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const cursor: Cursor = { y: MARGIN, page: 1 };

  const footer = (): void => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130);
    doc.text(
      "Socratic Citation Coach - generated locally; report text was never transmitted.",
      MARGIN,
      PAGE.height - 26,
    );
    doc.text(String(cursor.page), PAGE.width - MARGIN, PAGE.height - 26, { align: "right" });
    doc.setTextColor(20);
  };

  const newPage = (): void => {
    footer();
    doc.addPage();
    cursor.page += 1;
    cursor.y = MARGIN;
  };

  const space = (amount: number): void => {
    cursor.y += amount;
    if (cursor.y > PAGE.height - MARGIN - 24) newPage();
  };

  const write = (
    text: string,
    options: { size?: number; style?: "normal" | "bold" | "italic"; indent?: number; colour?: number; gap?: number } = {},
  ): void => {
    const size = options.size ?? 9.5;
    const indent = options.indent ?? 0;
    doc.setFont("helvetica", options.style ?? "normal");
    doc.setFontSize(size);
    doc.setTextColor(options.colour ?? 20);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      if (cursor.y > PAGE.height - MARGIN - 24) newPage();
      doc.text(line, MARGIN + indent, cursor.y);
      cursor.y += lineHeight;
    }
    cursor.y += options.gap ?? 4;
  };

  const rule = (): void => {
    if (cursor.y > PAGE.height - MARGIN - 30) newPage();
    doc.setDrawColor(210);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, cursor.y, PAGE.width - MARGIN, cursor.y);
    cursor.y += 12;
  };

  const quote = (text: string): void => {
    const size = 9.5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 22) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      if (cursor.y > PAGE.height - MARGIN - 24) newPage();
      doc.setDrawColor(120, 150, 200);
      doc.setLineWidth(2);
      doc.line(MARGIN, cursor.y - size + 2, MARGIN, cursor.y + 3);
      doc.setTextColor(60);
      doc.text(line, MARGIN + 14, cursor.y);
      cursor.y += lineHeight;
    }
    doc.setTextColor(20);
    cursor.y += 6;
  };

  const { document: report, matrix } = trace;
  const claimsById = new Map(report.claims.map((c) => [c.id, c] as const));
  const referencesById = new Map(report.references.map((r) => [r.id, r] as const));
  const responsesByQuestion = new Map(trace.responses.map((r) => [r.questionId, r] as const));
  const evaluationsByQuestion = new Map(trace.evaluations.map((e) => [e.questionId, e] as const));

  // Header block
  write("Citation Reasoning Trace Log", { size: 17, style: "bold", gap: 2 });
  write(report.title, { size: 11, colour: 90, gap: 8 });
  const meta = [
    `File: ${report.fileName}`,
    `${report.pageCount} pages / ${report.wordCount} words`,
    settings.studentName ? `Student: ${settings.studentName}` : null,
    settings.supervisorName ? `Supervisor: ${settings.supervisorName}` : null,
    `Exported: ${new Date(trace.exportedAt).toLocaleString()}`,
    `Engine: ${
      trace.evaluations.some((e) => e.generatedBy === "local-llm")
        ? [...new Set(trace.evaluations.map((e) => e.model))].join(", ")
        : "deterministic heuristics"
    }`,
  ]
    .filter((entry): entry is string => entry !== null)
    .join("   |   ");
  write(meta, { size: 8, colour: 110, gap: 10 });
  rule();

  write("1. Report thesis", { size: 12, style: "bold" });
  quote(report.thesis.replace(/\s+/g, " "));
  space(4);

  write("2. Citation health", { size: 12, style: "bold" });
  write(
    `Checkpoint completion: ${matrix.answered}/${matrix.total} questions answered across ${matrix.rows.length} claim-citation pairs.`,
  );
  write(
    `Authenticity ${matrix.averageScore.authenticity}/100    Relevance ${matrix.averageScore.relevance}/100    Depth ${matrix.averageScore.depth}/100    Overall ${matrix.averageScore.overall}/100`,
    { style: "bold" },
  );
  write(
    (["high", "valid", "weak", "unverified"] as const)
      .map((band) => `${BAND_LABEL[band]}: ${matrix.counts[band]}`)
      .join("    |    "),
    { colour: 90 },
  );
  space(6);
  rule();

  if (report.findings.length > 0) {
    const summary = summariseFindings(report.findings, report.references.length);
    write("3. Citation integrity findings", { size: 12, style: "bold" });
    write(
      `${summary.total} findings: ${summary.bySeverity.critical} critical, ${summary.bySeverity.major} major, ${summary.bySeverity.moderate} moderate. ${summary.confirmed} confirmed, ${summary.needsEvidence} awaiting the student's evidence. ${summary.cleanReferences} of ${report.references.length} references carry no finding.`,
    );
    space(4);
    for (const entry of report.findings) {
      write(
        `${entry.severity.toUpperCase()} - ${MODE_LABEL[entry.mode]}${entry.markers.length > 0 ? ` (${entry.markers.join(", ")})` : ""}`,
        { size: 9.5, style: "bold", gap: 1 },
      );
      write(entry.detail, { size: 9, indent: 8, colour: 70 });
      if (entry.question) write(`Question: ${entry.question}`, { size: 9, indent: 8, style: "italic", colour: 40 });
      if (entry.guardNote) write(`Restraint: ${entry.guardNote}`, { size: 8, indent: 8, colour: 130 });
      space(2);
    }
    rule();
  }

  write("4. Reasoning trace", { size: 12, style: "bold" });

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
    space(6);
    write(`4.${index}  Claim - page ${claim.page}${claim.section ? ` / ${claim.section}` : ""}`, {
      size: 10.5,
      style: "bold",
    });
    index += 1;
    quote(claim.text);

    const reference = questions[0]?.referenceId ? referencesById.get(questions[0].referenceId) : undefined;
    if (reference) {
      write(`Cited source ${reference.marker}: ${reference.raw}`, { size: 8.5, colour: 90 });
      const authenticity = reference.authenticity;
      if (authenticity) {
        write(
          `Source check: ${authenticity.status}${
            authenticity.registries.length > 0 ? ` via ${authenticity.registries.join(", ")}` : ""
          }${authenticity.flags.length > 0 ? ` - ${authenticity.flags.join("; ")}` : ""}`,
          { size: 8.5, colour: authenticity.status === "verified" ? 90 : 170 },
        );
      }
    } else {
      write("Cited source: unresolved inline marker - no matching reference-list entry.", {
        size: 8.5,
        colour: 170,
      });
    }

    for (const question of questions) {
      const response = responsesByQuestion.get(question.id);
      const evaluation = evaluationsByQuestion.get(question.id);
      space(4);
      write(DIMENSION_LABEL[question.dimension], { size: 9.5, style: "bold", colour: 70 });
      write(`Q. ${question.prompt}`, { style: "italic" });
      if (!response) {
        write("A. Not answered.", { colour: 150 });
        continue;
      }
      if (response.evidenceExcerpt.trim().length > 0) {
        write(`Evidence highlighted${response.evidencePage ? ` (p.${response.evidencePage})` : ""}:`, {
          size: 8.5,
          colour: 110,
          gap: 1,
        });
        quote(response.evidenceExcerpt.replace(/\s+/g, " "));
      }
      write(`Student rationale: ${response.rationale}`, { indent: 8 });
      if (evaluation) {
        write(`AI reasoning: ${evaluation.aiInsight}`, { indent: 8, colour: 60 });
        write(`Expected evidence: ${evaluation.aiExpectedEvidence}`, { indent: 8, colour: 90, size: 9 });
        write(
          `Comparison: ${ALIGNMENT_LABEL[evaluation.alignment]} - overlap ${Math.round(
            evaluation.similarity * 100,
          )}%, relevance ${evaluation.score.relevance}, depth ${evaluation.score.depth}`,
          { indent: 8, style: "bold" },
        );
        for (const gap of evaluation.gaps) {
          write(`- ${gap.kind}: ${gap.detail}`, { indent: 16, size: 9, colour: gap.kind === "strength" ? 80 : 150 });
        }
      }
    }
    rule();
  }

  if (report.warnings.length > 0) {
    write("5. Parser notes", { size: 12, style: "bold" });
    for (const warning of report.warnings) write(`- ${warning}`, { size: 8.5, colour: 110 });
  }

  footer();
  return doc.output("blob");
}
