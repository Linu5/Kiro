import { MousePointerClick, Quote } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Pill } from "./ui";
import type { Claim, ReferenceEntry, ReportDocument } from "@/types";

/**
 * Left panel of the Socratic view: the report page containing the targeted
 * claim, with the claim highlighted and its citation markers picked out.
 * Selecting any text turns it into the evidence excerpt for the answer.
 */
export function DocumentViewer({
  document: report,
  claim,
  reference,
  onUseSelection,
}: {
  document: ReportDocument;
  claim: Claim;
  reference: ReferenceEntry | undefined;
  onUseSelection: (excerpt: string, page: number) => void;
}): ReactNode {
  const [selection, setSelection] = useState("");
  const claimRef = useRef<HTMLSpanElement>(null);

  const page = useMemo(
    () => report.pages.find((entry) => entry.index === claim.page) ?? report.pages[0],
    [claim.page, report.pages],
  );

  const segments = useMemo(() => {
    if (!page) return { before: "", target: claim.text, after: "" };
    const start = Math.max(0, claim.charStart - page.charStart);
    const end = Math.max(start, claim.charEnd - page.charStart);
    return {
      before: page.text.slice(0, start),
      target: page.text.slice(start, end) || claim.text,
      after: page.text.slice(end),
    };
  }, [claim, page]);

  useEffect(() => {
    claimRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    setSelection("");
  }, [claim.id]);

  const readSelection = (): void => {
    const text = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    setSelection(text.length > 3 ? text : "");
  };

  /** Mark inline citation markers inside the highlighted claim. */
  const renderClaim = (text: string): ReactNode => {
    const markers = claim.citations.map((citation) => citation.marker);
    if (markers.length === 0) return text;
    const pattern = new RegExp(
      `(${markers.map((marker) => marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "g",
    );
    return text.split(pattern).map((part, index) =>
      markers.includes(part) ? (
        <span key={index} className="rounded bg-brand-soft px-1 font-medium text-brand">
          {part}
        </span>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-panel shadow-panel">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink">
            Page {claim.page}
            {claim.section ? ` \u00b7 ${claim.section}` : ""}
          </p>
          <p className="truncate text-[11px] text-ink-faint">{report.fileName}</p>
        </div>
        <Pill tone="info">
          {claim.citations.length} citation{claim.citations.length === 1 ? "" : "s"}
        </Pill>
      </header>

      <div
        className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5 text-[13.5px] leading-7 text-ink-soft select-text"
        onMouseUp={readSelection}
        onKeyUp={readSelection}
      >
        <p className="whitespace-pre-wrap">{segments.before}</p>
        <p className="my-3 rounded-xl border-l-[3px] border-amber-400 bg-amber-50/70 px-4 py-3 whitespace-pre-wrap text-ink">
          <span ref={claimRef}>{renderClaim(segments.target)}</span>
        </p>
        <p className="whitespace-pre-wrap">{segments.after}</p>
      </div>

      <footer className="border-t border-hairline bg-panel-muted px-5 py-4">
        {reference ? (
          <div className="mb-3">
            <p className="text-[11px] font-semibold text-ink">Cited source {reference.marker}</p>
            <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-ink-soft">{reference.raw}</p>
          </div>
        ) : (
          <p className="mb-3 text-[11px] text-amber-700">
            This marker has no matching reference-list entry, so it cannot be verified.
          </p>
        )}

        {selection ? (
          <div className="rounded-xl border border-[#cfe4fb] bg-brand-soft p-3">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink">
              <Quote size={12} className="mt-0.5 shrink-0 text-brand" />
              <span className="line-clamp-3 italic">{selection}</span>
            </p>
            <Button
              className="mt-2.5"
              onClick={() => {
                onUseSelection(selection, claim.page);
                setSelection("");
                window.getSelection()?.removeAllRanges();
              }}
            >
              Use as my evidence
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <MousePointerClick size={12} />
            Highlight the passage you are relying on to attach it as evidence.
          </p>
        )}
      </footer>
    </div>
  );
}
