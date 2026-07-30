import { checkReferences } from "./references";
import { checkStructure } from "./structural";
import { checkUse } from "./use";
import { sortFindings } from "./util";
import type { FindingLevel, IntegrityFinding, ReportDocument, Severity } from "@/types";

export { MODE_LABEL, sortFindings, SEVERITY_RANK } from "./util";

/**
 * Citation-integrity analysis.
 *
 * Runs the deterministic checks over a parsed report. Everything here is local
 * and explainable: each finding names the failure mode, the evidence, and the
 * question a supervisor would ask. Registry-dependent checks activate only when
 * `reference.authenticity` has been populated, so the same function is used for
 * the offline pass at parse time and the fuller pass after verification.
 *
 * Restraint is part of the contract. False-positive guards from the taxonomy are
 * applied inside the individual checks, and where a guard suppresses or softens a
 * finding the reason is recorded in `guardNote`.
 */
export function analyseIntegrity(document: ReportDocument): IntegrityFinding[] {
  const findings = [
    ...checkStructure(document),
    ...checkReferences(document),
    ...checkUse(document),
  ];

  // Collapse repeats of the same mode against the same target.
  const seen = new Set<string>();
  const unique = findings.filter((entry) => {
    const key = `${entry.mode}|${entry.referenceId ?? ""}|${entry.claimId ?? ""}|${entry.markers.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return sortFindings(unique);
}

export interface IntegritySummary {
  total: number;
  bySeverity: Record<Severity, number>;
  byLevel: Record<FindingLevel, number>;
  confirmed: number;
  needsEvidence: number;
  /** References carrying at least one finding. */
  affectedReferences: number;
  /** References with no finding at all - the ones the tool declines to flag. */
  cleanReferences: number;
}

export function summariseFindings(
  findings: IntegrityFinding[],
  referenceCount: number,
): IntegritySummary {
  const bySeverity: Record<Severity, number> = { critical: 0, major: 0, moderate: 0, advisory: 0 };
  const byLevel: Record<FindingLevel, number> = { reference: 0, source: 0, use: 0, structural: 0 };
  const affected = new Set<string>();

  for (const entry of findings) {
    bySeverity[entry.severity] += 1;
    byLevel[entry.level] += 1;
    if (entry.referenceId) affected.add(entry.referenceId);
  }

  return {
    total: findings.length,
    bySeverity,
    byLevel,
    confirmed: findings.filter((f) => f.confidence === "confirmed").length,
    needsEvidence: findings.filter((f) => f.confidence === "needs-evidence").length,
    affectedReferences: affected.size,
    cleanReferences: Math.max(0, referenceCount - affected.size),
  };
}

/** Findings that concern one reference, worst first. */
export function findingsForReference(
  findings: IntegrityFinding[],
  referenceId: string,
): IntegrityFinding[] {
  return findings.filter((entry) => entry.referenceId === referenceId);
}

export function findingsForClaim(findings: IntegrityFinding[], claimId: string): IntegrityFinding[] {
  return findings.filter((entry) => entry.claimId === claimId);
}
