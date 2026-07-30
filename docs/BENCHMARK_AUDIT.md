# Independent benchmark audit

Audit of the supplied corpus in `test_cases/` and of the application's behaviour
against it. Conducted 29 July 2026, treating the previous implementation as
unverified third-party work.

**Method.** The three `.docx` chapters were re-extracted from scratch: a
purpose-written zip reader (`node:zlib`) pulled `word/document.xml` out of each
file and stripped it to plain text, and a second script computed every count from
that text. Neither script imports anything from `src/`, so the numbers below were
arrived at independently of the code under test. Factual claims made by the
assessment keys were then checked against live Crossref, OpenAlex, arXiv and DNS.

Two bugs were found **in the audit scripts themselves** before any conclusion was
drawn: an indented `References` heading defeated the section split (case 01
initially reported 0 entries), and an arXiv URL form defeated duplicate matching
(case 03 initially reported no duplicate). Both were fixed and the audit re-run.
This is noted because the second was the same class of bug the application had.

---

## Part 1A — Corpus structure, verified per document

Evidence is the independently computed value. "Key" is the claim made by the
corresponding assessment `.md`.

| # | Requirement | Case | Evidence | Key | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | Bibliography entry count | 01 | 18 entries, numbered 1–18 | "18 listed" | **PASS** |
| 2 | Bibliography entry count | 02 | 20 entries, numbered 1–20 | "20 listed" | **PASS** |
| 3 | Bibliography entry count | 03 | 20 entries, numbered 1–20 | "exactly 20 bibliography entries" | **PASS** |
| 4 | Numbering contiguous, ascending, no gaps | 01/02/03 | `1..n` with no gap or repeat in all three | implied | **PASS** |
| 5 | Highest in-text marker | 01 | 19 | "19" | **PASS** |
| 6 | Highest in-text marker | 02 | 21 | "highest number cited: 21" | **PASS** |
| 7 | Highest in-text marker | 03 | 19 | 19 (no phantom claimed) | **PASS** |
| 8 | Distinct markers actually cited | 01 | **18** distinct (17 real + phantom [19]) | header says "19 cited" | **FAIL (key wording)** |
| 9 | Uncited reference (orphan) | 01 | `[12]` only | "[12] orphan" | **PASS** |
| 10 | Uncited reference (orphan) | 02 | `[19]` only | "[19] orphan" | **PASS** |
| 11 | Uncited reference (orphan) | 03 | `[20]` only | "[20] orphaned" | **PASS** |
| 12 | Missing reference (phantom) | 01 | `[19]` cited, not listed | "[19] phantom" | **PASS** |
| 13 | Missing reference (phantom) | 02 | `[21]` cited, not listed | "[21] phantom" | **PASS** |
| 14 | Missing reference (phantom) | 03 | none | none claimed | **PASS** |
| 15 | Cited only inside a range | 02 | `[3]` reached only by expanding `[1]-[8]`; not an orphan | "[3] cited only inside the range" | **PASS** |
| 16 | Duplicate entry | 02 | `[7]`≡`[20]`: identical normalised text, same arXiv id, same URL | "[20] duplicate of [7], character for character" | **PASS** |
| 17 | Duplicate entry | 03 | `[13]`≡`[18]`: same arXiv record `2307.00108`, altered title/container | "[18] duplicate of [13] with altered metadata" | **PASS** |
| 18 | Duplicate entry | 01 | none | none claimed | **PASS** |
| 19 | Citation-reference consistency (prose vs entry) | 01 | "Rahman et al. … [10]"; `[10]` is Duives, Daamen, Hoogendoorn | U6 | **PASS** |
| 20 | Bibliography formatting mixed | 01 | APA author-date: `[1] [10] [12] [16]`; Vancouver: `[2] [3] [4] [5] [6] [7] [13] [15] [17]`; other: `[8] [9] [11] [14] [18]` | "deliberately inconsistent — author–date and numeric interleaved" | **PASS (see issue 8 below)** |
| 21 | Bibliography formatting consistent | 02/03 | IEEE quoted-title for all 20 entries in each | "IEEE numeric" | **PASS** |
| 22 | In-text citation formatting | 01/02/03 | numeric brackets only; **0** in-text author-date markers in any document | — | **PASS** |
| 23 | Reference ordering by first citation | 01 | first-citation order 1, 6, 3, 4, 2, 9, 16, 17, 15, 10 … | not claimed | **DEVIATION (unlisted)** |
| 24 | Reference ordering by first citation | 02 | 1, 8, 12, 2, 15, 4, 5, 11, 9, 7 … | not claimed | **DEVIATION (unlisted)** |
| 25 | Reference ordering by first citation | 03 | 1, 8, 4, 5, 2, 3, 6, 13, 18, 7 … | not claimed | **DEVIATION (unlisted)** |
| 26 | Entries with no DOI/URL/arXiv id | 01 | `[6] [7] [12] [18]` | `[7]` called out; `[18]` is a standard (guard) | **PASS** |
| 27 | Entries with no DOI/URL/arXiv id | 02 | `[5] [10] [14]` | "[5], [10] … neither DOI nor URL" | **PASS** |
| 28 | Entries with no DOI/URL/arXiv id | 03 | `[9] [10]` | not claimed as faults; both are proceedings | **PASS (guard case)** |
| 29 | DOI containing Unicode dashes | 02 | `[6]` = `10.1007/978U+2011 3U+2011 319U+2011 10602U+2011 1_48` (four U+2011) | "U+2011 non-breaking hyphens" | **PASS** |
| 30 | Browser scroll-to-text debris | 02 | `[7]` and `[20]` both end `#:~:text=` | "[7] dangling `#:~:text=`" | **PASS** |
| 31 | Access date present | 02 | `[7] [17] [20]` carry access/retrieval notes | "[17] access date (14 Mar. 2026) supplied" | **PASS** |
| 32 | Entries with no year | 01 | `[14]` (Social LSTM/ResearchGate), `[18]` (standard) | "[14] no year and no venue" | **PASS** |

### Issue 8 — case 01 header, "18 listed, 19 cited"

Evidence: 18 distinct markers appear in the body (`1–11, 13–19`); `[12]` is never
cited and `[19]` has no entry. The highest marker is 19. "19 cited" is therefore
true only if read as "markers up to [19]", not as a count of citations. Case 02's
header states the same idea unambiguously ("highest number cited: 21").
**Minimal fix:** none applied — the supplied assessment files are the benchmark's
ground truth and I have not edited them. Recommended wording: "18 listed · highest
number cited: 19 · one listed reference never cited". Flagged for the benchmark
owner.

### Issue 20 — case 01 style claim locates the inconsistency imprecisely

The header says author-date and numeric are "interleaved", which reads as an
in-text claim; the document's in-text markers are uniformly numeric (0 author-date
markers). The inconsistency is real but lives in the **bibliography entries** (4
APA vs 9 Vancouver vs 5 unclassifiable). **Minimal fix applied to the app:** the
consistency check now tests both surfaces separately — in-text marker systems, and
bibliography entry conventions — so it detects this document's actual fault
(`structural.ts:checkStyleConsistency`). Before this fix the app missed it.

### Issues 23–25 — reference numbering not in first-citation order

Evidence above: all three documents number entries out of first-citation order,
which IEEE and Vancouver both require. No assessment key lists this as a fault, so
it is not scored, and treating it as an error would be a false positive against
the keys. **Minimal fix applied:** the app reports it at `advisory` severity only,
explicitly labelled a presentation convention that says nothing about source
soundness (`structural.ts:checkNumberingOrder`). Advisory findings are excluded
from the false-positive count and from the accusation surface.

---

## Part 1B — Intentional failure modes, located in the documents

Every fault named in each key was searched for by exact string. All PRESENT
unless noted. Full probe list: `PROBES` in the audit script (reproduced in the
session transcript).

| Case | Modes verified present | Result |
| --- | --- | --- |
| 01 | U1 block `[1]–[6]` · U2 uncited "Around 70%" · U3 contradiction on `[3]` · U4 chronology · U5/U13 three quoted fragments · U6 Rahman/`[10]` mismatch + two uncited sentences · U7 patchwriting · U8 `[9]` as current · U9 34% from survey `[10]` · U10 preprint called peer-reviewed · U11 vendor 60 fps/10,000 agents · U12 no critical evaluation · `[4]` invented authors · `[5]` fabricated DOI · `[6]` non-existent venue · `[7]` no identifier · `[10]` 2015 vs DOI 2013 · `[11]` download.php · `[13]` arXiv for CVPR · `[14]` ResearchGate for CVPR · `[18]` NFPA standard | **21/21 PASS** |
| 02 | T1–T12 all present (block, chronology, invented 87%, quote-mining, two patchwriting passages, chaining via `[11]`, `[9]` self-contradiction, contested claim adopted, dropped-in trio, uncited 40%, broken promise) · `[3]` fabricated co-authors · `[8]` "G. Brain" · `[13]` wrong-work DOI · `[16]` ijarcset domain · `[17]` directory URL + access date · `[18]` vendor blog 63% | **18/18 PASS** |
| 02 | Part D: no retracted source, no topically irrelevant source | no match for `/retract/i` or spaced-repetition/human-memory text → **PASS (correctly absent)** |
| 03 | Items #1–#25 all located (block, 40–60%, chronology, Word2Vec "context-aware", 95%/no-reassignment, patchwriting workflow, "always outperform", BERT quote-mining, preprint as peer-reviewed, duplicate as independent, RAG "completely eliminates hallucination", `[8]` vendor research, `[15]` foundational, `[17]` 92%, ROC "always more informative", spaced-repetition analogy, `[14]` oversight unnecessary, `[14]` two of four authors, `[7]` preprint, `[16]` vendor page, vendor-outranks-academic, security deferred, internal contradiction, unwarranted certainty) | **24/24 PASS** |
| 03 | Positive controls PC1–PC5 all present | **5/5 PASS** |

One probe initially failed and was a **probe** defect, not a document defect:
case 03 item #8 uses **single** quotation marks (`'state-of-the-art results'`),
not double. This produced a genuine finding about the application — see
Fix A below.

---

## Part 1C — Factual claims in the keys, checked against live sources

23 of 23 confirmed. No claim in any key was refuted.

| Claim (source) | Check | Result |
| --- | --- | --- |
| `10.1109/TVCG.2023.3298871` resolves to nothing (01 `[5]`) | Crossref | HTTP 404 ✓ |
| `10.1109/JECS.2022.4471903` resolves to nothing (02 `[11]`) | Crossref | HTTP 404 ✓ |
| `10.4187/jaio.2024.120207` resolves to nothing (03 `[17]`) | Crossref | HTTP 404 ✓ |
| `10.1145/37401.37406` is Reynolds, **sole author**, 1987 (01 `[4]`) | Crossref | 1 author, "Flocks, herds and schools" ✓ |
| `10.1016/j.trc.2013.02.005` records **2013**, and is a state-of-the-art review (01 `[10]`) | Crossref | year 2013, title "State-of-the-art crowd motion simulation models" ✓ |
| `10.1016/j.patrec.2005.10.010` returns Fawcett, *An introduction to ROC analysis* (02 `[13]`) | Crossref | exact match, 2006 ✓ |
| `10.1109/ICCV.2017.324` lists He and Dollár (02 `[15]` awkward-but-correct control) | Crossref | 5 authors incl. both ✓ |
| `10.1016/j.eswa.2022.117815` has **four** authors: Zicari, Folino, Guarascio, Pontieri (03 `[14]`) | Crossref | 4 authors, all four names ✓ |
| `10.1371/journal.pone.0118432` argues PR **over** ROC (03 `[11]`) | Crossref | title confirms opposite of the chapter's claim ✓ |
| "International Journal of Advanced Computational Intelligence and Simulation Research" (01 `[6]`) | Crossref journals | no match ✓ |
| "Journal of Embedded Computing Systems" (02 `[11]`) | Crossref journals | no match ✓ |
| "Microsoft Journal of Applied Research" (03 `[13]`) | Crossref journals | no match ✓ |
| IEEE Trans. Mobile Computing and Pattern Recognition Letters **do** exist (02) | Crossref journals | both matched exactly ✓ |
| `ijarcset.co.in` has no DNS record (02 `[16]`) | DNS A query | "DNS name does not exist"; control lookup of `servicenow.com` resolved ✓ |
| arXiv:2307.00108 is Ticket-BERT by Liu, Benge, Jiang (03 `[13]`/`[18]`) | arXiv API | confirmed ✓ |
| arXiv:2307.00108 has no `journal_ref` and no `doi` field, so "peer-reviewed" is unestablished (03 `[13]`) | arXiv API | both fields absent ✓ |

---

## Part 1D — Application behaviour against the corpus

Two passes, both re-run after the fixes below.

**Offline pass** (parsing plus every check needing no network): **46 expected
findings hit, 0 missed, 0 false positives** across 15 positive-control
references. Findings produced: 30 (case 01), 37 (case 02), 29 (case 03).

**Live-registry pass** (packaged desktop app driven through WebView2 remote
debugging, real Crossref/OpenAlex calls): **26/26 checks pass, 0 false
positives**, no page errors. Confirms `[4]` invented authors, `[5]`/`[11]`/`[17]`
fabricated DOIs, `[13]` resolving to a different paper, `[8]` affiliation-as-author,
`[5]` venue mismatch, `[14]` incomplete author list; leaves all 17 control
references unaccused.

### Fixes applied during this audit

| Fix | Defect found | Evidence | Change |
| --- | --- | --- | --- |
| A | Quotation checks matched only double quotes, so case 03's quote-mining (`'state-of-the-art results'`) was invisible | probe #8 initially ABSENT for the wrong reason | `use.ts:quotationsIn` now matches single and curly-single quotes, with lookaround guards so apostrophes ("the organisation's tickets") are not read as quotations |
| B | New single-quote support risked counting illustrative phrases (`'cannot access payroll'`) as source quotations | case 03 would have gained an unlisted overreliance-on-quotation finding | quotation *density* now counts only **attributed** quotations — the sentence carries a citation marker or attribution language ("as those authors note") |
| C | Reference ordering was never checked, though the corpus deviates in all three documents | Part 1A issues 23–25 | new `checkNumberingOrder`, `advisory` severity only |
| D | A failed **title-only** lookup was reported as "Fabricated reference" at `major` | live pass flagged NVIDIA TensorRT docs (02 `[17]`), Guo et al. ICML (03 `[9]`), Geifman & El-Yaniv NeurIPS (03 `[10]`) — three false positives | fabrication is now asserted **only** when a supplied DOI fails to resolve. Title-only misses become `moderate` "not corroborated", or `advisory` where the source type is not indexed by these registries (PMLR/NeurIPS proceedings, vendor documentation) |

Fix D matters beyond the three cases: Crossref title search is not
deterministic. The same case 02 document returned 10 verified / 7 not-found on one
run and 7 / 11 on another, with no change to the document. Any inference of
fabrication from a title miss is therefore unsafe by construction, and the app no
longer makes one.

---

## Part 1E — Residual limitations (stated, not hidden)

1. **Source-content modes remain undetected by design**: patchwriting (01 U7, 02
   T5/T10, 03 #6), quote-mining (02 T4, 03 #8), contradictory citation (01 U3, 02
   T7, 03 #15/#17), and misreported statistics (02 T3, 03 #5). All require the
   cited source's text, which the app does not fetch. Each is routed to the
   Socratic checkpoint as a question demanding the passage. The keys anticipate
   this: a lookup-only prototype is expected to find "none of U1 through U13".
2. **Title-only verification is nondeterministic** (evidence above). Verdicts for
   entries without a DOI can change between runs.
3. **Author-list comparison depends on parse quality.** Case 01's Vancouver
   entries yield surname-only author lists; comparisons are written to tolerate
   this, but a mangled parse can suppress a real mismatch (a miss, not a false
   accusation).
4. **The supplied `.docx` files were not modified.** Where a defect lies in the
   benchmark's own wording (issues 8 and 20), it is reported rather than edited.
5. **Case 03's key is marked "do not provide to the system under test."** It was
   used only to build this audit's expectations, never as app input.
