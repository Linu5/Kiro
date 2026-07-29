import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { DocumentOverview } from "./views/DocumentOverview";
import { SocraticCheckpoint } from "./views/SocraticCheckpoint";
import { ReasoningComparison } from "./views/ReasoningComparison";
import { AuditReport } from "./views/AuditReport";
import { useApp } from "./state/AppStore";

function Banner(): ReactNode {
  const { error, notice, dismissError, dismissNotice } = useApp();
  if (!error && !notice) return null;

  const isError = Boolean(error);
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        isError
          ? "flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-7 py-2.5 text-xs text-rose-700"
          : "flex items-start gap-2 border-b border-emerald-200 bg-emerald-50 px-7 py-2.5 text-xs text-emerald-800"
      }
    >
      {isError ? (
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
      )}
      <p className="flex-1 leading-relaxed">{error ?? notice}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={isError ? dismissError : dismissNotice}
        className="shrink-0 rounded-full p-0.5 hover:bg-black/5"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function BusyBar(): ReactNode {
  const { busy } = useApp();
  if (!busy) return null;
  const percent = busy.total ? Math.round(((busy.done ?? 0) / busy.total) * 100) : null;

  return (
    <div className="flex items-center gap-3 border-b border-hairline bg-brand-soft px-7 py-2.5">
      <Loader2 size={14} className="animate-spin text-brand" />
      <p className="text-xs text-ink">{busy.message}</p>
      {percent !== null && (
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-[11px] text-ink-soft tabular-nums">
            {busy.done}/{busy.total}
          </span>
        </div>
      )}
    </div>
  );
}

export default function App(): ReactNode {
  const { view, ingestFile } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Accept a report dropped anywhere in the window, not just on the upload zone.
  useEffect(() => {
    const onDrop = (event: DragEvent): void => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file) void ingestFile(file);
    };
    const onDragOver = (event: DragEvent): void => event.preventDefault();
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    return () => {
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
    };
  }, [ingestFile]);

  return (
    <div className="flex h-full bg-canvas text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSettings={() => setSettingsOpen(true)} />
        <Banner />
        <BusyBar />
        <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="mx-auto h-full w-full max-w-6xl">
            {view === "overview" && <DocumentOverview />}
            {view === "checkpoint" && <SocraticCheckpoint />}
            {view === "comparison" && <ReasoningComparison />}
            {view === "audit" && <AuditReport />}
          </div>
        </main>
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
