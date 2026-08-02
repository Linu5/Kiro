# 04_fall_detection — Blind benchmark assessment

**This file is a transcript of application output, not an answer key.**
Everything below was produced by the Socratic Citation Coach during a single run over
`blind_test_fall_detection.docx`. Nothing here is inferred from reading the document, and no
comparison against expected detections has been made. Detection logic, rules, prompts and
heuristics were not modified before, during or after the run.

---

## 1. Document metadata

| Field | Value |
| --- | --- |
| Test document | `test_cases/test_cases/blind_test_fall_detection.docx` |
| File size | 11,930 bytes |
| Report title (detected by app) | `2. Related Work` |
| Pages (as reported by app) | 2 |
| Words (as reported by app) | 927 |
| Cited claims (as reported by app) | 9 |
| References (as reported by app) | 12 |
| Citation style present | IEEE-style numeric markers `[1]`–`[12]` |
| Sections in document | 2.1–2.4 plus `References` |
| Independent pre-check | 6,585 characters / 927 words / 12 numbered entries extracted directly from the `.docx` ZIP before the run; the app's page, word, claim and reference counts above are its own output |

The document was read successfully: the app produced a header, thesis, claim list, reference list
and findings, and 0 parse errors were raised.

---

## 2. Analysis configuration and environment

| Field | Value |
| --- | --- |
| Application | packaged desktop build `src-tauri/target/release/socratic-citation-coach.exe` |
| Executable build time | 30 Jul 2026 23:35 (newer than the newest source file, `AppStore.tsx` 30 Jul 2026 22:22) |
| Source state | `git status --porcelain -- src src-tauri` empty; HEAD `1eb10270f70ed05eaccd2bfbea3a57b02b6489ce` ("removed md file") |
| Coach version (self-reported in export) | 0.1.0 |
| Webview | `Edg/150.0.4078.105` |
| Local model runtime | Ollama at `http://127.0.0.1:11434`, status `reachable: true`, models `["llama3:latest"]` |
| Model configured | `llama3` |
| Metadata verification | enabled |
| Registries queried | Crossref and OpenAlex (live network) |
| Checkpoint budget | 8 claim-citation pairs |
| Checkpoint label / date | `Blind benchmark 04_fall_detection` · `2026-08-01` |
| Student / supervisor / project fields | left empty |
| State before run | settings reset to the baseline above; all stored documents deleted and the export folder cleared so this run's artefacts are unambiguous |
| Export artefact | `Documents/SocraticCitationCoach/reasoning-trace_2-related-work_2026-08-01.md` (20,497 characters) |
| Console / page errors | 0 |

Run was driven through the application's own UI workflow (file input → automatic parse →
automatic verification → **Start checkpoint** → **Markdown** export) over the DevTools protocol.
No internal function was called directly except `llm_status` and the document-clearing commands
used to establish a clean state.

---

## 3. Scenarios tested

| ID | Scenario | Executed as | Result |
| --- | --- | --- | --- |
| S1 | `.docx` ingest and parse | dropped the file into the app's file input | Completed in 522 ms; header and parse summary rendered |
| S2 | Local structural analysis (markers vs list, ordering, duplicates) | automatic, part of parse | Reported 1 unmatched marker; structural findings produced (see §5) |
| S3 | Live source verification against registries | automatic after parse, metadata verification enabled | Completed in 10,702 ms; 12 references resolved to verdicts; 2 flagged sources |
| S4 | Socratic checkpoint question planning with the local model | clicked **Start checkpoint** | Completed in 25,525 ms; 24 questions prepared across 8 claim-citation pairs |
| S5 | Reasoning-trace export | clicked **Markdown** in the audit view | File written to `Documents/SocraticCitationCoach/` (20,497 chars) |
| S6 | Error monitoring | console and `pageerror` listeners active for the whole run | 0 errors |

Not exercised: no checkpoint answers were submitted, so answer evaluation, re-reading/revision
tracking and the scoring that depends on them were left at their initial values (see §7).

---

## 4. Parse summary as displayed

| Metric | Value |
| --- | --- |
| Pages | 2 |
| Words | 927 |
| Cited claims | 9 |
| References | 12 |
| Unmatched markers | 1 |
| Flagged sources | 2 |
| Integrity findings | 10 |
| Critical | 4 |

Findings filter buttons rendered by the app, with their counts: `All 10`,
`Document and list structure 4`, `What the citation asserts 6`.

---

## 5. Integrity findings produced by the application

The app's own summary line for this section:

> 10 findings: 4 critical, 3 major, 2 moderate. 10 are established from the document or a registry
> record; 0 need evidence from the student. 6 of 12 references carry no finding.

The app reports no numeric confidence score per finding. Its confidence expression is the
`Status` column (`confirmed` for all 10 here, meaning established from the document or a registry
record rather than pending student evidence). Severities are the app's own labels.

| # | Severity | Failure mode | Ref | Finding | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | critical | Duplicate entry | [11], [3] | [11] duplicates [3] | confirmed |
| 2 | critical | Fabricated reference | [9] | The DOI is well formed but resolves to nothing | confirmed |
| 3 | critical | Identifier mismatch | [10] | The DOI resolves to a different work | confirmed |
| 4 | critical | Incorrect or incomplete metadata | [10] | None of the listed authors appear on the work this identifier returns | confirmed |
| 5 | major | Incorrect or incomplete metadata | [12] | Author list is incomplete: 2 listed, 6 on the record | confirmed |
| 6 | major | Phantom citation | [13] | [13] is cited in the text but has no bibliography entry | confirmed |
| 7 | major | Wrong date | [4] | Entry dated 2016, but its own DOI encodes 2018 | confirmed |
| 8 | moderate | Orphan reference | [7] | [7] appears in the bibliography but is never cited | confirmed |
| 9 | moderate | Wrong date | [10] | The registry records 2015, the entry says 2019 | confirmed |
| 10 | advisory | Inconsistent citation system | [1], [3], [6], [2], [4] | Reference numbers do not follow the order of first citation | confirmed |

### 5.1 Evidence and questions, verbatim

Each block below is the app's evidence text ("detail"), the question it attached, and any
restraint note, exactly as serialised in the export.

**1. Duplicate entry — [11], [3]** · critical · confirmed
> [11] and [3] share the same DOI (10.1109/ACCESS.2019.2902718) with altered metadata. Two numbers for one source let the prose present a single study as independent corroboration.

Question to answer: Are [3] and [11] the same study? If so, does any sentence treat them as two?

**2. Fabricated reference — [9]** · critical · confirmed
> 10.9999/jaus.2021.04117 uses a real registrant prefix, so it passes format validation, yet neither Crossref nor OpenAlex holds it. A DOI that looks right and resolves to nothing is the signature of a fabricated reference. Any figure attributed to [9] has no traceable source.

Question to answer: Show where you obtained [9]. Can you open the source and point to the passage you used?

**3. Identifier mismatch — [10]** · critical · confirmed
> 10.1038/nature14539 is live, but it returns "Deep learning" (2015), not "Piezoresistive insole arrays for real-time fall-risk scoring in home-based elderly monitoring". Testing whether a DOI resolves is not enough; the resolved title has to match the cited one.

Question to answer: Which work did you actually read for [10] - the one you titled, or the one this DOI returns?

**4. Incorrect or incomplete metadata — [10]** · critical · confirmed
> Registry authors for 10.1038/nature14539: Yann LeCun; Yoshua Bengio; Geoffrey Hinton. The entry lists: B. Osei; R. Whitfield. Title-only matching passes this reference, which is why the author list has to be compared too.

Question to answer: Where did the author names in [10] come from? They are not the authors of the work the identifier returns.
Restraint: Comparison folds diacritics and accepts particle and single-syllable surnames, so "Ondřej", "van Beek" and "He" do not trigger it.

**5. Incorrect or incomplete metadata — [12]** · major · confirmed
> The record for 10.1016/j.measen.2025.101870 names Ch Gangadhar; P Pavithra Roy; R. Dinesh Kumar; Janjhyam Venkata Naga Ramesh; S. Ravikanth; N. Akhila. The entry omits 4 of them without "et al.".

Question to answer: Should [12] credit every author, or be shortened with "et al."?

**6. Phantom citation — [13]** · major · confirmed
> The list ends at [12]. [13] is cited on page 1 and points at nothing, so whatever it supports has no source at all.

Question to answer: What source is [13]? Add the entry, or remove the claim that leans on it.

**7. Wrong date — [4]** · major · confirmed
> The DOI 10.1109/JSEN.2018.2872835 carries 2018 in its suffix while the entry states 2016. No lookup is needed to see the contradiction; one of the two is wrong.

Question to answer: Which year is right for [4], and did you take the date from the record or from another citation of it?

**8. Orphan reference — [7]** · moderate · confirmed
> Set difference between in-text markers and list entries leaves [7] uncited: "A low power fall sensing technology based on fd-cnn". Either it informed the chapter and should be cited, or it should be removed.

Question to answer: Did you use [7]? If so, which sentence should carry it?

**9. Wrong date — [10]** · moderate · confirmed
> Registry record for 10.1038/nature14539: 2015. Entry: 2019. Preprint, online-first and issue dates are commonly confused.

No question was attached to this finding in the export.

**10. Inconsistent citation system — [1], [3], [6], [2], [4]** · advisory · confirmed
> First-citation order begins 8, 1, 5, 3, 12, 6, 2, 9, 13, 4. Under IEEE and Vancouver numbering, entry [1] is the first source cited, [2] the second, and so on, which lets a reader move between text and list without searching. 5 marker(s) appear after a higher-numbered one.

Question to answer: Does your programme require numbering in citation order? If so, renumber the list.
Restraint: Advisory only: ordering is a presentation convention and says nothing about whether any cited source is sound.

---

## 6. Source verification details, per reference

Verdicts, registry attribution and flag text are the app's own output. "Modes" lists the failure-mode
pills the app attached to that entry in the reference list.

| Ref | Verdict | Registries | Modes on entry | Title / metadata as shown | Flags reported |
| --- | --- | --- | --- | --- | --- |
| [1] | Source verified | crossref + openalex | — | RF-based fall monitoring using convolutional neural networks · Y. Tian · 2018 · Proc. ACM Interact · 10.1145/3264947 | — |
| [2] | Source verified | crossref + openalex | — | A machine learning based fall detection for elderly people with neurodegenerative disorders · N. Nahar · 2020 · 10.1007/978-3-030-59277-6_18 | — |
| [3] | Source verified | crossref + openalex | — | An energy-efficient algorithm for classification of fall types using a wearable sensor · S. B. Kwon · 2019 · 10.1109/ACCESS.2019.2902718 | — |
| [4] | Source verified | crossref + openalex | Wrong date | Impact of sampling rate on wearable-based fall detection systems based on machine learning models · K. Liu · 2016 · 10.1109/JSEN.2018.2872835 | Year mismatch: the report cites 2016, the registry records 2018. |
| [5] | Source verified | crossref + openalex | — | Supporting independent living for older adults; employing a visual based fall detection through analysing the motion and shape of the human body · A. Lotfi · 2018 · 10.1109/ACCESS.2018.2881237 | — |
| [6] | Source verified | crossref + openalex | — | Fall detection system for elderly people using IoT and ensemble machine learning algorithm · D. Yacchirema · 2019 · Ubiquitous Comput., 2019 · 10.1007/s00779-018-01196-8 | — |
| [7] | Source verified | crossref + openalex | Orphan reference | A low power fall sensing technology based on fd-cnn · J. He · 2019 · 10.1109/JSEN.2019.2903482 | — |
| [8] | Source verified | crossref + openalex | — | System for monitoring and fall detection of patients using mobile 3-axis accelerometer sensors · P. Mostarac · 2011 · Proc. IEEE Int · 10.1109/MeMeA.2011.5966724 | — |
| [9] | Source not found | none | Fabricated reference | Multimodal inertial–acoustic fusion for pre-impact fall prediction in ambulatory elderly cohorts · B. Okafor · 2021 · Ambient Intell · 10.9999/jaus.2021.04117 | Neither Crossref nor OpenAlex holds a record matching this reference. Treat as potentially hallucinated or predatory until the student produces the source. |
| [10] | Source suspicious | crossref + openalex | Identifier mismatch, Incorrect or incomplete metadata, Wrong date | Piezoresistive insole arrays for real-time fall-risk scoring in home-based elderly monitoring · B. Osei · 2019 · Eng., vol · 10.1038/nature14539 | Year mismatch: the report cites 2019, the registry records 2015. Title differs from the registry record (overlap 0%): "Deep learning". |
| [11] | Source verified | crossref + openalex | Duplicate entry | Energy-efficient fall-type classification using a wearable sensor · S. Kwon · 2019 · 10.1109/ACCESS.2019.2902718 | Title differs from the registry record (overlap 62%): "An Energy-Efficient Algorithm for Classification of Fall Types Using a Wearable Sensor". |
| [12] | Source verified | crossref + openalex | Incorrect or incomplete metadata | Wearable sensor-based fall detection for elderly care using ensemble machine learning techniques · N. Akhila · 2025 · 10.1016/j.measen.2025.101870 | — |

Verdict tally as produced: 10 × `Source verified`, 1 × `Source not found` ([9]), 1 × `Source suspicious` ([10]).
`Flagged sources` in the parse summary: 2.

---

## 7. Citation health matrix as produced

No checkpoint answers were submitted during this run, so the app reported:

| Field | Value |
| --- | --- |
| Checkpoint completion | 0/24 questions answered across 8 claim-citation pairs |
| Authenticity | 0/100 |
| Relevance | 0/100 |
| Depth of reasoning | 0/100 |
| Overall citation quality | 0/100 |
| Evidence use | Strong: 0 · adequate: 0 · weak or unverified: 8 · claims with no citation at all: 0 |
| Revisions recorded after re-reading | 0 of 0 answered checkpoints |
| Bands | High quality 0 · Valid 0 · Weak grounding 0 · Unverified 8 |

Per claim-citation pair (Auth is the app's authenticity sub-score, which does not depend on answers;
Rel and Depth are 0 because nothing was answered):

| Marker | Claim (truncated by the app) | Alignment | Auth | Rel | Depth | Band |
| --- | --- | --- | --- | --- | --- | --- |
| [8] | Threshold-based accelerometer systems worn at the waist can achieve high sensitivity for h… | Not answered | 90 | 0 | 0 | Unverified |
| [1] | Device-free alternatives have also been explored: Tian et al. showed that a convolutional… | Not answered | 90 | 0 | 0 | Unverified |
| [3] | Kwon et al. proposed an energy-efficient classification scheme that distinguishes forward,… | Not answered | 96 | 0 | 0 | Unverified |
| [6] | Ensemble and IoT-integrated pipelines have also been proposed to reduce false positives by… | Not answered | 90 | 0 | 0 | Unverified |
| [9] | Okafor and Delgado extended this line of work with a multimodal inertial–acoustic fusion m… | Not answered | 10 | 0 | 0 | Unverified |
| [4] | Liu et al. examined the impact of accelerometer sampling rate on the accuracy of several m… | Not answered | 78 | 0 | 0 | Unverified |
| [10] | Insole- and footwear-embedded pressure arrays have been proposed as an alternative or comp… | Not answered | 35 | 0 | 0 | Unverified |
| [3] | Taken together, this body of work suggests a shift away from single-sensor, threshold-base… | Not answered | 96 | 0 | 0 | Unverified |

---

## 8. Socratic checkpoint output

| Field | Value |
| --- | --- |
| Notice shown after planning | `24 questions prepared: 5 targeted at specific integrity findings, the rest generated by the local model.` |
| Pairs covered | 8 (matches the configured checkpoint budget) |
| Planning duration | 25,525 ms |
| First question header | `Question 1 of 24 · local model` |
| First question, verbatim | Which specific sentence or paragraph in [8] explicitly states 'early implementations suffered elevated false-alarm rates during vigorous non-fall activities such as sitting down quickly'? |
| Questions answered | 0 (run stopped at question 1 by design; answering would have introduced student-authored content into the benchmark) |

Thesis the app extracted and used to anchor questioning:

> Wearable inertial sensors remain the dominant modality for ambulatory fall detection, owing to
> their low cost and continuous availability during activities of daily living.

---

## 9. Verification details and timings

| Stage | Duration |
| --- | --- |
| Parse (`.docx` → claims, references, structural findings) | 522 ms |
| Source verification (12 references, Crossref + OpenAlex, live) | 10,702 ms |
| Checkpoint question planning (`llama3` via Ollama) | 25,525 ms |

- Privacy line emitted in the export: report text was never transmitted; only citation metadata
  (DOI/title) was sent to Crossref/OpenAlex.
- 0 console errors and 0 page errors across the whole run.
- Export written on the first attempt, 20,497 characters.

---

## 10. Observations about the output itself

Recorded because they are properties of what the application printed, not judgements about the
document. No code was changed in response to them.

1. **Export engine line.** The export header states
   `Reasoning engine | deterministic heuristics (no model was running)`, yet the checkpoint
   questions were produced by the local model (`Question 1 of 24 · local model`, 25.5 s of planning
   against `llama3`). Because no answers were submitted, the engine line has no evaluation records
   to read from at export time.
2. **Severity counts in the section summary.** The summary line reads
   `10 findings: 4 critical, 3 major, 2 moderate`, which totals 9; the table beneath it lists 10 rows,
   the tenth being the advisory. The advisory severity is omitted from the summary sentence.
3. **Finding 9 has no attached question**, while the other nine findings each carry one.
4. **Filter categories.** Only `Document and list structure` (4) and `What the citation asserts` (6)
   appeared alongside `All` (10); no other category buttons were rendered.

---

## 11. Scope statement

- Findings recorded: 10, exactly the number the application reported. No finding was added,
  removed, merged or reworded.
- No expected-detections list was consulted, and none is included here.
- Severity, failure-mode labels, evidence text, questions, restraint notes, verdicts, flags and
  scores are transcribed from the application's rendered UI and its own Markdown export.
- Comparison against an external answer key is deliberately left to a later step.
