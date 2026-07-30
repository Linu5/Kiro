import clsx from "clsx";
import { AlertTriangle, HelpCircle, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Card, Pill } from "./ui";
import { MODE_LABEL } from "@/lib/integrity";
import type { FindingLevel, IntegrityFinding, ReferenceEntry, Severity } from "@/types";

/**
 * Citation-integrity findings, grouped so a student can work through them in
 * order of consequence. Every row carries the evidence, the question to answer,
 * and - where a false-positive guard was applied - the reason for restraint.
 */

const SEVERITY_STYLE: Record<Severity, { tone: "bad" | "warn" | "neutral" | "info"; label: string }> = {
  critical: { tone: "bad", label: "Critical" },
  major: { tone: "bad", label: "Major" },
  moderate: { tone: "warn", label: "Moderate" },
  advisory: { tone: "neutral", label: "Advisory" },
};

const LEVEL_LABEL: Record<FindingLevel, string> = {
  reference: "What the citation asserts",
  source: "What the source is",
  use: "How the source serves the argument",
  structural: "Document and list structure",
};

const LEVEL_ORDER: FindingLevel[] = ["structural", "reference", "source", "use"];

export function FindingsPanel({
  findings,
  references,
}: {
  findings: IntegrityFinding[];
  references: ReferenceEntry[];
}): ReactNode {
  const [level, setLevel] = useState<FindingLevel | "all">("all");
  const [query, setQuery] = useState("");

  const markerFor = useMemo(() => {
    const byId = new Map(references.map((reference) => [reference.id, reference.marker] as const));
    return (entry: IntegrityFinding): string[] =>
      entry.markers.length > 0
        ? entry.markers
        : entry.referenceId && byId.has(entry.referenceId)
          ? [byId.get(entry.referenceId) as string]
          : [];
  }, [references]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return findings.filter((entry) => {
      if (level !== "all" && entry.level !== level) return false;
      if (needle.length === 0) return true;
      return `${entry.summary} ${entry.detail} ${MODE_LABEL[entry.mode]} ${markerFor(entry).join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
  }, [findings, level, markerFor, query]);

  const grouped = useMemo(() => {
    const map = new Map<FindingLevel, IntegrityFinding[]>();
    for (const entry of filtered) {
      const list = map.get(entry.level) ?? [];
      list.push(entry);
      map.set(entry.level, list);
    }
    return map;
  }, [filtered]);

  if (findings.length === 0) {
    return (
      <Card title="Citation integrity" subtitle="Deterministic checks, run on this device">
        <div className="flex items-center gap-2.5 text-[13px] text-ink-soft">
          <ShieldCheck size={15} className="text-emerald-600" />
          No structural, reference or use-level faults were detected. That is a statement about the
          checks that ran, not a guarantee: passages, quotations and paraphrase still need reading.
        </div>
      </Card>
    );
  }

  const counts = findings.reduce<Record<FindingLevel, number>>(
    (acc, entry) => ({ ...acc, [entry.level]: (acc[entry.level] ?? 0) + 1 }),
    { reference: 0, source: 0, use: 0, structural: 0 },
  );

  return (
    <Card
      title="Citation integrity findings"
      subtitle={`${findings.length} findings \u00b7 each names a failure mode, its evidence, and the question to answer`}
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute top-2 left-2.5 text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter"
              aria-label="Filter findings"
              className="w-32 rounded-full border border-hairline bg-panel py-1 pr-2 pl-7 text-[11px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
            />
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setLevel("all")}>
          <Pill tone={level === "all" ? "info" : "neutral"}>All {findings.length}</Pill>
        </button>
        {LEVEL_ORDER.filter((key) => counts[key] > 0).map((key) => (
          <button key={key} type="button" onClick={() => setLevel(key)}>
            <Pill tone={level === key ? "info" : "neutral"}>
              {LEVEL_LABEL[key]} {counts[key]}
            </Pill>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-5">
        {LEVEL_ORDER.filter((key) => grouped.has(key)).map((key) => (
          <section key={key}>
            <h3 className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
              {LEVEL_LABEL[key]}
            </h3>
            <ul className="mt-2 space-y-2.5">
              {(grouped.get(key) ?? []).map((entry) => {
                const severity = SEVERITY_STYLE[entry.severity];
                const markers = markerFor(entry);
                return (
                  <li
                    key={entry.id}
                    className={clsx(
                      "rounded-xl border bg-panel-muted p-4",
                      entry.severity === "critical" ? "border-rose-200" : "border-hairline",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill tone={severity.tone}>{severity.label}</Pill>
                      <Pill>{MODE_LABEL[entry.mode]}</Pill>
                      {markers.map((marker) => (
                        <Pill key={marker} tone="info">
                          {marker}
                        </Pill>
                      ))}
                      {entry.confidence === "needs-evidence" && (
                        <Pill tone="warn">needs your evidence</Pill>
                      )}
                    </div>

                    <p className="mt-2.5 text-[13px] font-medium text-ink">{entry.summary}</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{entry.detail}</p>

                    {entry.question && (
                      <p className="mt-2.5 flex gap-2 rounded-lg bg-brand-soft px-3 py-2 text-[12px] leading-relaxed text-ink">
                        <HelpCircle size={13} className="mt-0.5 shrink-0 text-brand" />
                        {entry.question}
                      </p>
                    )}

                    {entry.guardNote && (
                      <p className="mt-2 flex gap-2 text-[11px] leading-relaxed text-ink-faint">
                        <ShieldCheck size={12} className="mt-0.5 shrink-0 text-emerald-600" />
                        {entry.guardNote}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-faint">
          <AlertTriangle size={13} /> No findings match this filter.
        </p>
      )}
    </Card>
  );
}
