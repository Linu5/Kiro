# Failure-mode coverage

Maps every mode in `test_cases/test_cases/FAILURE_MODES.md` to the code that
detects it and the evidence that it works. Verified against the three supplied
test cases on 29 July 2026.

Legend: **✓** detected deterministically · **⚠** partially detected, or routed to
the student as a question the tool cannot settle alone · **✗** not detected
without the source text.

Implementation lives in `src/lib/integrity/`:
`structural.ts` (document and list), `references.ts` (reference and source level),
`use.ts` (how the source serves the argument), `util.ts` (name, venue and
source-type comparison, plus the false-positive guards).

---

## 1. Reference level — what the citation asserts

| Mode | Status | How |
| --- | --- | --- |
| Fabricated reference | ✓ | Registry lookup returns nothing. A well-formed DOI that resolves to nothing is `critical`/confirmed; absence by title alone is `major`/needs-evidence, because these two registries do not index everything. |
| Composite reference | ⚠ | Surfaces as its parts: `identifier-mismatch` (resolved title differs) plus an author-list mismatch. Not labelled as splicing. |
| Incorrect or incomplete metadata | ✓ | Author list compared with the registry (missing, invented, incomplete); venue compared; year compared; affiliation-as-author (`G. Brain`, `P. Servicenow`) detected structurally; missing identifier reported. |
| Typographical corruption | ⚠ | Caught indirectly through title/author overlap against the registry. No dedicated fuzzy-match pass. |
| Identifier mismatch | ✓ | `titleOverlap` from the resolved record; below 0.5 the DOI is reported as resolving to a different work, and the verdict is capped so it cannot read as verified. |
| Malformed locator | ✓ | Unicode dashes in DOIs (U+2010–U+2015), duplicated schemes, scroll-to-text fragments. The printed form is preserved in `doiAsWritten` and reported rather than silently repaired. |
| Broken or unavailable link | ⚠ | Structural signals only: download scripts, bare `?id=` locators, directory URLs standing in for a named section. The webview has no network permission, so arbitrary URLs are not fetched. |
| Version mismatch | ✓ | Preprint/mirror hosts (arXiv, ar5iv, ResearchGate, SSRN, bioRxiv, OSF) detected; `confirmed` when the registry holds a published container, `needs-evidence` otherwise. |
| Wrong date | ✓ | Two independent checks: the year encoded in the DOI suffix against the stated year (offline), and the registry year against the stated year. |

## 2. Source level — what the source is

| Mode | Status | How |
| --- | --- | --- |
| Questionable venue | ✓ | Naming patterns of weakly vetted publishing (`World/International Journal of Advanced…`, WJARR, IJSR…), plus failure to corroborate in either registry. |
| Non-scholarly source presented as scholarship | ✓ | Blog/vendor/marketing URL patterns, escalated to `major` when the entry carries an effect size. Vendor *documentation* is explicitly exempt. |
| Mutable or gated source inadequately documented | ✓ | Web source with no access date; market/analyst reports; a named section cited at directory level. |
| Inappropriate or discredited source (retraction) | ✓ | Three independent signals, because the registries are inconsistent: Crossref `updated-by[].type == "retraction"` on the article, the publisher's `RETRACTED:`/`WITHDRAWN` title prefix, and OpenAlex `is_retracted`. Reported `critical` with the retraction date and the notice DOI so the student can read the reason. Retraction **notices** cited as if they were studies are a separate `major` finding, and expressions of concern a third, at `major`/needs-evidence. Guard note records that discussing a retraction is legitimate. |
| Insufficient scholarly grounding | ✓ | Counted over the whole list: ≥25% vendor/blog/web entries, standards excluded. |
| Secondary-only bibliography | ✓ | Counted over the whole list: ≥40% review/survey titles. |

## 3. Use level — how the source serves the argument

| Mode | Status | How |
| --- | --- | --- |
| Unsupported claim | ⚠ | Absolute quantifiers on bounded sources are flagged and questioned. Topical irrelevance needs the source's content. |
| Contradictory citation | ✗ → coach | Cannot be established from metadata. Routed to the Socratic checkpoint, where the student must quote the passage, and to the dual-reasoning evaluator. |
| Exaggeration or quote-mining | ✗ → coach | Same: the quoted words are real, so only the source text settles it. |
| Fabricated quotation | ⚠ | Every quotation attached to a citation is flagged as requiring verbatim confirmation, `major` when the source is unreachable, and recorded as *unverifiable* rather than fabricated. |
| Citation chaining | ✓ | A specific figure attributed to an entry whose title marks it as a review or survey — establishable from the title alone. |
| Superseded source presented as current | ✓ | Currency language ("state of the art", "current") with a cited work ≥8 years old. |
| Undifferentiated block citation | ✓ | ≥3 distinct markers behind one sentence; also reports when the block conceals unverified members, and when a reference is cited *only* inside a range. |
| Descriptive listing without synthesis | ✓ | Runs of ≥3 consecutive single-source sentences with no comparative connective; notes when the ordering is chronological. |
| Poor citation integration | ⚠ | Detects the promised-discussion-that-never-arrives pattern. General "dropped-in" citations surface as listing-without-synthesis or as in-text attribution mismatch. |
| Lack of critical evaluation | ✓ | Share of cited sentences containing any limitation, contrast or condition below 15%. |
| Patchwriting | ✗ → coach | Requires the source text. Routed to the evaluator, which compares the student's rationale against an independent reading. |
| Overreliance on quotation | ✓ | Quotation density across the body, not only cited sentences. |
| Missing citation | ✓ | Precise figures (percentages, multiples, units, p-values) in uncited sentences; the report's own targets and requirements are excluded. |
| Misleading source equivalence | ✓ | Explicit vendor-outranks-research sentences, and "peer-reviewed" applied to a preprint or grey source. |

## 4. Structural and document level

| Mode | Status | How |
| --- | --- | --- |
| Duplicate entry | ✓ | Exact text, shared DOI, shared arXiv record, shared URL, or near-identical titles. Altered-metadata duplicates are `critical`, because they let one study appear as two. |
| Orphan reference | ✓ | Set difference over markers **after** range expansion. |
| Phantom citation | ✓ | The reverse difference, and specifically markers numbered beyond the end of the list. |
| Reference-manager or copy-paste debris | ✓ | Browser scroll-to-text fragments and duplicated schemes, reported as evidence that the import was not checked. |
| Inconsistent citation system | ✓ | Two checks: numeric/author-date mixed in the text, and mixed bibliography conventions (IEEE quoted-title, APA author-date, Vancouver) under one numbering scheme. |
| Inconsistent in-text attribution | ✓ | Prose naming "X et al." where the marker points at other authors. |

## 5. False-positive guards

Each guard is implemented and its reasoning is written into the finding's
`guardNote`, so restraint is auditable rather than invisible.

| Guard | Implementation |
| --- | --- |
| Extraction artefacts are not student faults | Parser warnings are kept separate from findings; DOCX pagination is declared synthetic; the printed locator is preserved rather than corrected in place. |
| Unusual names may be correct | Diacritics are folded **for comparison only** and never stored folded; particle surnames (`van Beek`), single-syllable surnames (`He`), hyphenated initials (`T.-Y.`) and consortium authors are handled. Two live false positives were found and fixed this way. |
| Grey literature may be authoritative | Standards, statutes and specifications (NFPA, ISO, IEEE Std, RFC…) are exempt from the missing-identifier check *and* from registry lookup, since neither registry indexes them. Vendor documentation is distinguished from vendor blogs by URL. |
| Preprints may be appropriate | Version mismatch is `needs-evidence` unless a published container is found, and says so. |
| Retracted work may be cited appropriately | Guard note attached to every retraction finding. |
| Uncommon publication structures may be valid | Proceedings without DOIs are downgraded to `advisory` rather than reported as incomplete. |
| A currently broken link may once have worked | Link findings are `needs-evidence`, never fabrication. |

## 6. Verification results

Two harnesses were run against the three supplied `.docx` chapters and then
deleted. Full detail of the run is in the session transcript.

**Offline pass** — parsing and every check that needs no network:

| | Result |
| --- | --- |
| Expected findings hit | **46 / 46** (30 per-reference, 16 document-level) |
| Missed | 0 |
| False positives on Part A / positive-control references | **0** (15 controls) |

Includes: orphan `[12]`/`[19]`/`[20]`, phantom `[19]`/`[21]`, duplicate `[20]`↔`[7]`
and `[18]`↔`[13]`, DOI-suffix year contradiction on `[10]` and `[13]`, U+2011 DOI on
`[6]`, ar5iv debris on `[7]`, directory-level TensorRT locator on `[17]`, vendor
effect sizes on `[8]`/`[18]`, questionable venues `[6]`/`[15]`/`[16]`, block citations,
uncited percentages, chronology-without-synthesis, chaining through a survey,
2008 work called state of the art, mixed bibliography conventions, and the prose
crediting "Rahman" for the Duives survey.

**Desktop pass** — the packaged app driven through WebView2 remote debugging, so
`verify_source` ran against live Crossref and OpenAlex:

| Case | Result |
| --- | --- |
| 01 | `[4]` invented authors on a genuine paper ✓ · `[5]` fabricated DOI ✓ · 6 controls unaccused ✓ |
| 02 | `[13]` DOI resolves to Fawcett's ROC paper ✓ · `[11]` fabricated ✓ · `[3]` fabricated co-authors ✓ · `[8]` "G. Brain" affiliation ✓ · 2 controls unaccused ✓ |
| 03 | `[17]` borrowed `10.4187` prefix, 404 ✓ · `[14]` incomplete author list ✓ · 5 controls unaccused ✓ |

Three false positives were found during this pass and fixed: an over-eager
initials parser turning "Tsung-Yi Lin" into a mismatch, NFPA 130 reported as
unfindable, and an abbreviated ICCV venue read as a venue mismatch.

**Retraction pass** — the supplied corpus contains no retracted source (case 02's
key states this deliberately), so this path was verified separately against real
retracted DOIs in the packaged app: Wakefield 1998 (`10.1016/S0140-6736(97)11096-0`),
its retraction notice (`…(10)60175-4`), the 2020 Surgisphere paper
(`…(20)31180-6`), and a non-retracted control. **19/19 checks pass**: the article is
flagged retracted with date `2010-02-06` and the notice DOI captured, its status
drops from `verified` to `suspicious` (score 25), the notice is identified as a
notice rather than a study, the control is untouched, the finding renders as
`critical`, and its question reaches the Socratic checkpoint under the
"Source limitations" dimension. Re-running the three benchmark cases afterwards
produced **no** retraction or expression-of-concern findings, confirming the new
checks do not fire on a corpus without them.

This pass corrected a real defect: Crossref records the relationship from both
ends, and the previous implementation read only `update-to`, which the *notice*
carries. Wakefield 1998 has `update-to: null`, so a retracted article was detected
only when OpenAlex happened to answer.

## 7. Known limits

- Modes marked ✗ need the cited source's text. The app deliberately does not
  fetch paywalled sources; it asks the student for the passage instead, which is
  the point of the Socratic checkpoint.
- Verification depends on Crossref and OpenAlex. Books, regional venues and
  standards are not indexed there, and findings phrase themselves accordingly.
- Reference parsing is heuristic. Author/title splitting is correct for IEEE,
  Vancouver and APA styles in the test corpus, and `authors` may still be partial
  for unusual layouts; comparisons are written to tolerate that.
