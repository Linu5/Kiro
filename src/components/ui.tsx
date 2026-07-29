import clsx from "clsx";
import type { ReactNode } from "react";
import { ALIGNMENT_LABEL, BAND_LABEL } from "@/lib/scoring";
import type { Alignment, AuthenticityStatus, CitationScore, HealthBand } from "@/types";

/** Shared presentational primitives. No business logic lives here. */

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-hairline bg-panel shadow-panel",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-ink-soft">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  icon,
  type = "button",
  title,
  className,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "subtle" | "danger";
  disabled?: boolean;
  icon?: ReactNode;
  type?: "button" | "submit";
  title?: string;
  className?: string;
}): ReactNode {
  const styles = {
    primary:
      "bg-brand text-white shadow-sm hover:bg-[#0077ed] active:bg-[#006edb] disabled:bg-hairline-strong disabled:text-white",
    subtle:
      "bg-canvas text-ink border border-hairline hover:bg-[#ececee] disabled:text-ink-faint disabled:bg-panel-muted",
    ghost: "text-ink-soft hover:bg-canvas hover:text-ink disabled:text-ink-faint",
    danger:
      "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 disabled:text-ink-faint disabled:bg-panel-muted disabled:border-hairline",
  }[variant];

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed",
        styles,
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  title?: string;
}): ReactNode {
  const tones = {
    neutral: "border-hairline bg-canvas text-ink-soft",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    bad: "border-rose-200 bg-rose-50 text-rose-600",
    info: "border-[#cfe4fb] bg-brand-soft text-brand",
  }[tone];
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tones,
      )}
    >
      {children}
    </span>
  );
}

export function AlignmentBadge({ alignment }: { alignment: Alignment }): ReactNode {
  const tone = { aligned: "good", surface: "warn", misaligned: "bad", pending: "neutral" } as const;
  return <Pill tone={tone[alignment]}>{ALIGNMENT_LABEL[alignment]}</Pill>;
}

export function BandBadge({ band }: { band: HealthBand }): ReactNode {
  const tone = { high: "good", valid: "info", weak: "bad", unverified: "warn" } as const;
  return <Pill tone={tone[band]}>{BAND_LABEL[band]}</Pill>;
}

export function AuthenticityBadge({ status }: { status: AuthenticityStatus }): ReactNode {
  const map: Record<AuthenticityStatus, { tone: "good" | "warn" | "bad" | "neutral"; label: string }> = {
    verified: { tone: "good", label: "Source verified" },
    suspicious: { tone: "bad", label: "Source suspicious" },
    notFound: { tone: "bad", label: "Source not found" },
    unverified: { tone: "neutral", label: "Not checked" },
  };
  const entry = map[status];
  return <Pill tone={entry.tone}>{entry.label}</Pill>;
}

export function ScoreBar({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}): ReactNode {
  const tone = value >= 75 ? "bg-emerald-500" : value >= 55 ? "bg-brand" : "bg-rose-500";
  return (
    <div title={hint}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-ink-soft">{label}</span>
        <span className="text-sm font-semibold text-ink tabular-nums">{value}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={clsx("h-full rounded-full transition-[width]", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ScoreGrid({ score }: { score: CitationScore }): ReactNode {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <ScoreBar label="Authenticity" value={score.authenticity} hint="Does the source exist and is it reputably indexed?" />
      <ScoreBar label="Relevance" value={score.relevance} hint="Direct evidence for this claim, or background context?" />
      <ScoreBar label="Depth" value={score.depth} hint="Critical engagement in the student's own words." />
      <ScoreBar label="Overall" value={score.overall} hint="Weighted 30/35/35." />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-hairline bg-panel px-8 py-16 text-center shadow-panel">
      {icon && (
        <span className="flex size-11 items-center justify-center rounded-full bg-canvas text-ink-soft">{icon}</span>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children && <div className="max-w-md text-[13px] leading-relaxed text-ink-soft">{children}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-faint">{hint}</span>}
    </label>
  );
}

/** Shared input styling, so every text field matches. */
export const inputClass =
  "mt-1.5 w-full rounded-xl border border-hairline-strong bg-panel px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none";
