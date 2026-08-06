import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Button, Field, Pill, inputClass } from "./ui";
import { useApp } from "@/state/AppStore";

/** Matches the `duration-200` classes below; the drawer unmounts once it ends. */
const TRANSITION_MS = 200;

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const { settings, updateSettings, llm, refreshLlm } = useApp();
  // Two flags, because an exit transition needs the drawer to outlive `open`:
  // `mounted` keeps it in the tree until the slide-out finishes, `shown` drives
  // the transition and must flip in a frame *after* the first paint or the
  // browser has no start value to animate from.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    // Under `prefers-reduced-motion` index.css flattens the transition, so the
    // drawer is already invisible here and this timer only delays removal.
    const timer = setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className={clsx(
        "fixed inset-0 z-40 flex justify-end bg-black/15 transition-opacity duration-200 ease-out",
        shown ? "opacity-100" : "opacity-0",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <button type="button" aria-label="Close settings" className="flex-1 cursor-default" onClick={onClose} />
      <aside
        className={clsx(
          "scrollbar-thin w-[400px] overflow-y-auto border-l border-hairline bg-panel p-6 shadow-float",
          "transition-transform duration-200 ease-out",
          shown ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-ink">Settings</h2>
          <Button variant="ghost" icon={<X size={15} />} onClick={onClose} />
        </div>

        <div className="mt-6 space-y-5">
          <Field label="AI Reasoning Engine" hint="Choose local desktop Ollama or Groq Cloud API for web deployments.">
            <select
              className={inputClass}
              value={settings.llmProvider ?? "ollama"}
              onChange={(event) => {
                const provider = event.target.value as "ollama" | "groq";
                updateSettings({
                  llmProvider: provider,
                  ...(provider === "groq" && (!settings.llmModel || settings.llmModel === "llama3")
                    ? { llmModel: "llama-3.3-70b-versatile" }
                    : {}),
                });
              }}
            >
              <option value="ollama">Ollama (Local Desktop)</option>
              <option value="groq">Groq Cloud API (Recommended for Vercel)</option>
            </select>
          </Field>

          {settings.llmProvider === "groq" ? (
            <>
              <Field
                label="Groq API Key"
                hint="Get a free key from console.groq.com"
              >
                <input
                  type="password"
                  className={inputClass}
                  value={settings.groqApiKey ?? ""}
                  onChange={(event) => updateSettings({ groqApiKey: event.target.value })}
                  placeholder="gsk_..."
                />
              </Field>

              <Field
                label="Model"
                hint="Recommended: llama-3.3-70b-versatile or llama-3.1-8b-instant"
              >
                <input
                  className={inputClass}
                  value={settings.llmModel}
                  onChange={(event) => updateSettings({ llmModel: event.target.value })}
                  placeholder="llama-3.3-70b-versatile"
                />
              </Field>
            </>
          ) : (
            <>
              <Field
                label="Local model endpoint"
                hint="Loopback only. A non-local endpoint is refused by the Rust core unless SCC_ALLOW_REMOTE_LLM=1 is set for an institutional server."
              >
                <input
                  className={inputClass}
                  value={settings.llmBaseUrl}
                  onChange={(event) => updateSettings({ llmBaseUrl: event.target.value })}
                  placeholder="http://127.0.0.1:11434"
                />
              </Field>

              <Field
                label="Model"
                hint={
                  llm?.models.length
                    ? `Available: ${llm.models.join(", ")}`
                    : "Run `ollama pull llama3` to install a model."
                }
              >
                <input
                  className={inputClass}
                  value={settings.llmModel}
                  onChange={(event) => updateSettings({ llmModel: event.target.value })}
                  placeholder="llama3"
                />
              </Field>
            </>
          )}

          <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-panel-muted px-4 py-3">
            <div>
              <p className="text-xs font-medium text-ink">Verify sources online</p>
              <p className="mt-0.5 text-[11px] text-ink-faint">Sends DOI and title only, to Crossref and OpenAlex.</p>
            </div>
            <input
              type="checkbox"
              className="size-4"
              checked={settings.metadataEnabled}
              onChange={(event) => updateSettings({ metadataEnabled: event.target.checked })}
              aria-label="Verify sources online"
            />
          </div>

          <Field
            label={`Claims per checkpoint: ${settings.checkpointBudget}`}
            hint="The highest-salience cited claims are selected."
          >
            <input
              type="range"
              min={3}
              max={20}
              step={1}
              className="mt-3 w-full"
              value={settings.checkpointBudget}
              onChange={(event) => updateSettings({ checkpointBudget: Number(event.target.value) })}
            />
          </Field>

          <div className="border-t border-hairline pt-5">
            <p className="text-xs font-semibold text-ink">Audit report header</p>
            <div className="mt-3 space-y-4">
              <Field label="Project title">
                <input
                  className={inputClass}
                  value={settings.projectTitle}
                  onChange={(event) => updateSettings({ projectTitle: event.target.value })}
                />
              </Field>
              <Field label="Student name">
                <input
                  className={inputClass}
                  value={settings.studentName}
                  onChange={(event) => updateSettings({ studentName: event.target.value })}
                />
              </Field>
              <Field label="Supervisor name">
                <input
                  className={inputClass}
                  value={settings.supervisorName}
                  onChange={(event) => updateSettings({ supervisorName: event.target.value })}
                />
              </Field>
              <Field
                label="Supervision checkpoint"
                hint="The meeting this trace is prepared for, e.g. a back-to-campus day."
              >
                <input
                  className={inputClass}
                  value={settings.checkpointLabel}
                  onChange={(event) => updateSettings({ checkpointLabel: event.target.value })}
                  placeholder="Back-to-campus day 2"
                />
              </Field>
              <Field label="Checkpoint date">
                <input
                  type="date"
                  className={inputClass}
                  value={settings.checkpointDate}
                  onChange={(event) => updateSettings({ checkpointDate: event.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-panel-muted p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink">Model status</p>
              <Pill tone={llm?.reachable ? "good" : "warn"}>{llm?.reachable ? "reachable" : "offline"}</Pill>
            </div>
            {llm?.detail && <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">{llm.detail}</p>}
            <Button variant="subtle" className="mt-3" onClick={() => void refreshLlm()}>
              Check again
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
