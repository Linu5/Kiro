import { isDesktop, APP_VERSION } from "../env";
import { writeExport } from "../ipc";
import { bytesToBase64 } from "../parsing/extractText";
import { buildMatrix } from "../scoring";
import { renderTraceMarkdown } from "./markdown";
import { renderTracePdf } from "./pdf";
import type {
  AppSettings,
  Evaluation,
  ReasoningTrace,
  ReportDocument,
  SocraticQuestion,
  StudentResponse,
} from "@/types";

export { renderTraceMarkdown } from "./markdown";
export { renderTracePdf } from "./pdf";

export type ExportFormat = "markdown" | "pdf";

export function buildTrace(input: {
  document: ReportDocument;
  questions: SocraticQuestion[];
  responses: StudentResponse[];
  evaluations: Evaluation[];
}): ReasoningTrace {
  return {
    ...input,
    matrix: buildMatrix(input),
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "report";
}

export function traceFileName(document: ReportDocument, format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10);
  return `reasoning-trace_${slug(document.title)}_${date}.${format === "pdf" ? "pdf" : "md"}`;
}

function downloadInBrowser(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface ExportResult {
  fileName: string;
  /** Absolute path on desktop, or `null` when the browser handled the download. */
  path: string | null;
}

/**
 * Write the trace log to disk. On desktop the Rust core owns the write so the
 * file lands in a predictable, user-visible folder; in the browser it falls back
 * to a normal download.
 */
export async function exportTrace(
  trace: ReasoningTrace,
  settings: AppSettings,
  format: ExportFormat,
): Promise<ExportResult> {
  const fileName = traceFileName(trace.document, format);

  if (format === "markdown") {
    const markdown = renderTraceMarkdown(trace, settings);
    if (isDesktop()) {
      const bytes = new TextEncoder().encode(markdown);
      const path = await writeExport(fileName, bytesToBase64(bytes));
      return { fileName, path };
    }
    downloadInBrowser(fileName, new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    return { fileName, path: null };
  }

  const blob = await renderTracePdf(trace, settings);
  if (isDesktop()) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const path = await writeExport(fileName, bytesToBase64(bytes));
    return { fileName, path };
  }
  downloadInBrowser(fileName, blob);
  return { fileName, path: null };
}
