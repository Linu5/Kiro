import clsx from "clsx";
import { BarChart3, FileCheck2, FileText, HelpCircle, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useApp, type ViewKey } from "@/state/AppStore";
import { hostLabel } from "@/lib/env";

const ITEMS: { key: ViewKey; label: string; icon: ReactNode; hint: string }[] = [
  { key: "overview", label: "Document Overview", icon: <FileText size={16} />, hint: "Thesis, claims, source checks" },
  { key: "checkpoint", label: "Socratic Checkpoint", icon: <HelpCircle size={16} />, hint: "Defend each citation" },
  { key: "comparison", label: "Reasoning & Metrics", icon: <BarChart3 size={16} />, hint: "AI vs. your reasoning" },
  { key: "audit", label: "Supervisor Audit", icon: <FileCheck2 size={16} />, hint: "Export the trace log" },
];

export function Sidebar(): ReactNode {
  const { view, setView, document: report, questions, responses } = useApp();
  const answered = Object.keys(responses).length;

  const badgeFor = (key: ViewKey): string | null => {
    if (key === "overview") return report ? `${report.claims.length}` : null;
    if (key === "checkpoint") return questions.length > 0 ? `${answered}/${questions.length}` : null;
    return null;
  };

  return (
    <nav
      aria-label="Main"
      className="flex h-full w-[264px] shrink-0 flex-col border-r border-hairline bg-panel-muted"
    >
      <div className="px-6 pt-6 pb-5">
        <p className="text-[15px] font-semibold tracking-tight text-ink">Socratic Citation Coach</p>
        <p className="mt-1 text-[11px] text-ink-faint">SIT capstone citation integrity</p>
      </div>

      <ul className="flex-1 space-y-1 px-3">
        {ITEMS.map((item) => {
          const active = view === item.key;
          const badge = badgeFor(item.key);
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setView(item.key)}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  active ? "bg-panel shadow-panel" : "hover:bg-panel/70",
                )}
              >
                <span className={clsx("mt-0.5", active ? "text-brand" : "text-ink-faint")}>{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={clsx("truncate text-[13px] font-medium", active ? "text-ink" : "text-ink-soft")}>
                      {item.label}
                    </span>
                    {badge && (
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium text-ink-soft tabular-nums">
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-faint">{item.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="m-3 rounded-xl border border-hairline bg-panel p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <Lock size={12} /> Local-first
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
          Your report stays on this device. Only DOIs and titles are sent to Crossref and OpenAlex.
        </p>
        <p className="mt-2.5 text-[10px] text-ink-faint">{hostLabel()}</p>
      </div>
    </nav>
  );
}
