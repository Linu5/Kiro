import { Cpu, RefreshCw, Settings, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Pill } from "./ui";
import { useApp } from "@/state/AppStore";

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }): ReactNode {
  const { document: report, llm, refreshLlm, reset, settings } = useApp();

  return (
    <header className="frosted sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-hairline px-7 py-3.5">
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold text-ink">
          {report ? report.title : "No report loaded"}
        </h1>
        <p className="truncate text-[11px] text-ink-soft">
          {report
            ? `${report.fileName} \u00b7 ${report.pageCount} pages \u00b7 ${report.claims.length} cited claims \u00b7 ${report.references.length} references`
            : "Upload a PDF or DOCX literature review to begin"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Pill tone={llm?.reachable ? "good" : "warn"} title={llm?.detail ?? undefined}>
          <Cpu size={12} />
          {llm?.reachable ? `${settings.llmModel} ready` : "Local model offline"}
        </Pill>
        <Button
          variant="ghost"
          icon={<RefreshCw size={13} />}
          onClick={() => void refreshLlm()}
          title="Re-check the local model"
        >
          Recheck
        </Button>
        {report && (
          <Button
            variant="ghost"
            icon={<Trash2 size={13} />}
            onClick={reset}
            title="Clear the loaded report from this session"
          >
            Clear
          </Button>
        )}
        <Button variant="subtle" icon={<Settings size={13} />} onClick={onOpenSettings}>
          Settings
        </Button>
      </div>
    </header>
  );
}
