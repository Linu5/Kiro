import { verifySource } from "./ipc";
import type { AppSettings, AuthenticityVerdict, ReferenceEntry, SourceQuery } from "@/types";

/**
 * Source verification. Builds the *smallest possible* query - DOI when present,
 * otherwise title + first-author surname + year - and hands it to the Rust
 * metadata client, which is the only component allowed to reach the network.
 * No sentence of the student's report is ever part of the payload.
 */

export function buildQuery(reference: ReferenceEntry): SourceQuery {
  const surname = reference.authors[0]?.split(/[,\s]+/).find((part) => part.length > 2);
  return {
    doi: reference.doi,
    title: reference.title,
    firstAuthor: surname,
    year: reference.year,
  };
}

export function unverifiedVerdict(reason: string): AuthenticityVerdict {
  return {
    status: "unverified",
    score: 50,
    isRetracted: false,
    isIndexedInDoaj: false,
    registries: [],
    flags: [reason],
    checkedAt: new Date().toISOString(),
  };
}

export function hasQueryableMetadata(reference: ReferenceEntry): boolean {
  return Boolean(reference.doi || (reference.title && reference.title.length > 12));
}

export interface VerifyProgress {
  done: number;
  total: number;
  reference: ReferenceEntry;
}

export async function verifyReferences(
  references: ReferenceEntry[],
  settings: AppSettings,
  onProgress?: (progress: VerifyProgress) => void,
): Promise<Map<string, AuthenticityVerdict>> {
  const results = new Map<string, AuthenticityVerdict>();

  for (const [index, reference] of references.entries()) {
    let verdict: AuthenticityVerdict;
    if (!settings.metadataEnabled) {
      verdict = unverifiedVerdict("Metadata lookup is switched off in Settings, so nothing left this device.");
    } else if (reference.isStandard) {
      // Published standards are not held by these registries; a lookup would
      // return "not found" and mean nothing.
      verdict = unverifiedVerdict(
        "Published standards and official specifications are not indexed in Crossref or OpenAlex. Treated as the primary source for what it specifies; check the edition and clause instead.",
      );
    } else if (!hasQueryableMetadata(reference)) {
      verdict = unverifiedVerdict("No DOI or usable title could be parsed from this reference entry.");
    } else {
      try {
        verdict = await verifySource(buildQuery(reference));
      } catch (error) {
        verdict = unverifiedVerdict(
          `Lookup unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    results.set(reference.id, verdict);
    onProgress?.({ done: index + 1, total: references.length, reference });
  }

  return results;
}
