import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { dehyphenate } from "../text";
import type { SourceFormat } from "@/types";

/**
 * Text extraction. Runs entirely inside the webview: bytes come from a
 * drag-and-drop event or from the Rust file-ingest command, and never travel
 * anywhere else.
 *
 * pdf.js replaces the PyMuPDF/GROBID tier from the original design: it is
 * on-device, needs no Python runtime, and exposes per-item geometry which is
 * what the layout heuristics below rely on.
 */
/**
 * pdf.js and mammoth are loaded on demand: they are the two largest
 * dependencies and are only needed once a report is actually opened.
 */
let pdfjsModule: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsModule) {
    pdfjsModule = import("pdfjs-dist").then((module) => {
      module.GlobalWorkerOptions.workerSrc = workerUrl;
      return module;
    });
  }
  return pdfjsModule;
}

export interface ExtractedPage {
  index: number;
  text: string;
}

export interface ExtractedDocument {
  format: SourceFormat;
  pages: ExtractedPage[];
  warnings: string[];
}

interface PdfTextItem {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
  height?: number;
}

function isTextItem(item: unknown): item is PdfTextItem {
  return typeof item === "object" && item !== null && typeof (item as PdfTextItem).str === "string";
}

/**
 * Rebuild reading-order lines from pdf.js text items. Items arrive in draw
 * order, so we group by baseline y and join with x-gap aware spacing.
 */
function itemsToText(items: unknown[]): string {
  type Line = { y: number; parts: { x: number; str: string }[] };
  const lines: Line[] = [];
  const tolerance = 2.5;

  for (const raw of items) {
    if (!isTextItem(raw)) continue;
    if (raw.str.length === 0) continue;
    const x = raw.transform?.[4] ?? 0;
    const y = raw.transform?.[5] ?? 0;
    const line = lines.find((l) => Math.abs(l.y - y) <= tolerance);
    if (line) line.parts.push({ x, str: raw.str });
    else lines.push({ y, parts: [{ x, str: raw.str }] });
  }

  lines.sort((a, b) => b.y - a.y);
  return lines
    .map((line) => {
      line.parts.sort((a, b) => a.x - b.x);
      return line.parts
        .map((p) => p.str)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter((line) => line.length > 0)
    .join("\n");
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocument> {
  const warnings: string[] = [];
  const pdfjs = await loadPdfjs();
  // pdf.js takes ownership of the buffer, so hand it a copy. Font rendering is
  // disabled: only the text layer is needed here.
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
  });
  const doc = await task.promise;

  const pages: ExtractedPage[] = [];
  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const text = dehyphenate(itemsToText(content.items as unknown[]));
      pages.push({ index: pageNo, text });
      page.cleanup();
    }
  } finally {
    await doc.cleanup();
    await task.destroy();
  }

  const empty = pages.filter((p) => p.text.trim().length === 0).length;
  if (empty > 0) {
    warnings.push(
      `${empty} of ${pages.length} page(s) contained no extractable text - the PDF may be a scan. Run OCR before uploading for full coverage.`,
    );
  }
  return { format: "pdf", pages, warnings };
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractedDocument> {
  const mammoth = (await import("mammoth")).default;
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const warnings = result.messages
    .filter((m) => m.type === "error" || m.type === "warning")
    .slice(0, 5)
    .map((m) => `DOCX: ${m.message}`);

  // DOCX has no page model. Chunk on ~3500 characters at paragraph boundaries
  // so the viewer and citation locator still have stable "page" anchors.
  const paragraphs = result.value.split(/\n{2,}/);
  const pages: ExtractedPage[] = [];
  let buf = "";
  for (const paragraph of paragraphs) {
    if (buf.length + paragraph.length > 3500 && buf.length > 0) {
      pages.push({ index: pages.length + 1, text: buf.trim() });
      buf = "";
    }
    buf += `${paragraph}\n\n`;
  }
  if (buf.trim().length > 0) pages.push({ index: pages.length + 1, text: buf.trim() });
  if (pages.length === 0) pages.push({ index: 1, text: "" });

  warnings.push("DOCX has no fixed pagination: page numbers are synthetic chunk indices.");
  return { format: "docx", pages, warnings };
}

function extractPlainText(bytes: Uint8Array): ExtractedDocument {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return { format: "text", pages: [{ index: 1, text }], warnings: [] };
}

export function detectFormat(fileName: string): SourceFormat | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt" || ext === "md") return "text";
  return null;
}

export async function extractDocument(
  fileName: string,
  bytes: Uint8Array,
): Promise<ExtractedDocument> {
  const format = detectFormat(fileName);
  if (format === null) {
    throw new Error(
      `Unsupported file type "${fileName}". Upload a PDF, DOCX, TXT or Markdown report.`,
    );
  }
  if (format === "pdf") return extractPdf(bytes);
  if (format === "docx") return extractDocx(bytes);
  return extractPlainText(bytes);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
