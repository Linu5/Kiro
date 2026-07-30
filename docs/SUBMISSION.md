# Socratic Citation Coach — Submission

Local-first desktop application for SIT capstone students and faculty supervisors.
Supporting material: [`ARCHITECTURE.md`](ARCHITECTURE.md) ·
[`FAILURE_MODE_COVERAGE.md`](FAILURE_MODE_COVERAGE.md) ·
[`BENCHMARK_AUDIT.md`](BENCHMARK_AUDIT.md)

---

## 1. The specific problem we are solving

**The problem.** Capstone and IWSP literature reviews increasingly contain
citations the student cannot defend. Not merely mis-formatted citations — citations
whose source does not exist, does not say what is attributed to it, or was never
read. Generative writing tools produce fluent prose with plausible-looking
references faster than any supervisor can check them, and reference managers
propagate a single bad import across an entire bibliography.

**Who experiences it.** Three parties, with different costs:

- *Students* lose marks and, in the worst case, face academic-integrity
  proceedings for faults they did not recognise as faults. A student who pastes a
  DOI that resolves to a different paper has not decided to cheat; they have
  failed to check, and nobody taught them what checking involves.
- *Supervisors* carry the detection burden. Checking a bibliography means one
  lookup per reference — the three benchmark chapters carry 18, 20 and 20 — and
  that repeats for every student and every draft. We have not measured how long
  supervisors actually spend, but the work scales with references × students ×
  drafts, so in practice it is sampled rather than completed. Faults that are found
  surface late.
- *Institutions* absorb the reputational risk of graduating work whose evidential
  base was never examined.

**Why it matters beyond marks.** A literature review is where an engineering
student learns to distinguish "a source exists" from "a source supports my claim".
That distinction is the whole skill. A student who never practises it carries the
deficit into professional work, where the same reasoning failure produces
requirements traceable to nothing.

**Why existing approaches are insufficient.**

| Existing approach | Why it falls short |
| --- | --- |
| Plagiarism / similarity detection (Turnitin et al.) | Answers "is this text copied?", not "is this citation defensible?". Patchwriting at paragraph length does not trip it, and a fabricated reference is original text. |
| Reference managers (Zotero, Mendeley, EndNote) | Optimise *formatting consistency*. They will format an invented reference immaculately, and they are frequently the mechanism by which affiliations end up in author fields. |
| Journal-side integrity tooling | Aimed at post-submission screening of manuscripts, not at coaching during drafting, and generally unavailable to undergraduates. |
| A general-purpose chatbot | Will happily rewrite the citation, which removes the fault and the learning simultaneously. It also cannot be trusted with the report text: uploading an unpublished capstone chapter to a third-party API is a confidentiality problem for the student and the industry partner. |
| Manual supervisor review | Correct but unscalable, and it arrives after the habit has formed. |

The gap is a tool that finds what is *checkable* automatically, refuses to guess
about what is not, and makes the student — not the tool — supply the justification.

---

## 2. Proposed AI solution

### 2.1 User workflow

1. **Ingest.** The student drops a PDF or DOCX literature review onto the app.
   Parsing happens on the device: thesis and abstract extraction, cited-sentence
   detection, inline-marker to reference-entry resolution, reference-list
   segmentation.
2. **Verify and check.** Every reference is checked against Crossref and OpenAlex
   using metadata only, and the integrity engine runs its checks over the document —
   30 distinct failure modes are emitted by the current implementation. The student sees a findings panel grouped by consequence, each finding
   carrying its evidence, the named failure mode, and the question it raises.
3. **Defend.** The app selects the claims that carry the most argumentative weight
   — ranked by rhetorical force *and* by attached findings — and questions them one
   at a time. The left panel shows the report page with the claim highlighted; the
   right panel holds the question, an evidence box, and a rationale box. The
   student highlights the exact passage they relied on and writes, in their own
   words, why it supports the claim.
4. **Compare.** The local model reasons about the claim/citation relationship
   independently, then the two readings are set side by side and scored.
5. **Export.** A Reasoning Trace Log (Markdown or PDF) records every question,
   every rationale, every comparison and every finding — the artefact the student
   brings to a supervision meeting.

### 2.2 AI reasoning process

The design separates three kinds of question, because they have different
epistemic status and conflating them is what makes existing tools untrustworthy:

- **Decidable from the document** (orphan and phantom citations, duplicates, a DOI
  broken by a non-breaking hyphen, a year contradicting its own DOI suffix, mixed
  bibliography conventions). Handled deterministically. No model involved, no
  probability attached, fully explainable.
- **Decidable from a registry** (does this DOI resolve; does it resolve to *this*
  work; are these the authors; is this the venue; is it retracted). Handled by the
  Rust metadata client against Crossref and OpenAlex, comparing resolved title,
  author surnames, venue and year with what the entry claims.
- **Not decidable without the source's content** (patchwriting, quote-mining,
  contradictory citation, misreported statistics). The tool does **not** guess.
  These become Socratic questions that require the student to produce the passage,
  and the model then reasons over what the student actually supplied.

The dual-reasoning step is the core. Given the claim, the reference metadata, the
student's highlighted excerpt and their rationale, the local model produces its own
reading of whether the source can support the claim, states what evidence a
defensible justification would have to quote, then classifies the relationship
between the two readings as **aligned**, **surface-level** or **misaligned**, with
typed gap findings (over-generalisation, unsupported causality, missing evidence,
superficial, misinterpretation).

Critically, the model's output is **coerced, not trusted**: a deterministic
heuristic evaluation is computed first and used as the fallback for any field the
model omits or malforms, and alignment/score values are validated and clamped. If
no model is running at all, the workflow completes on heuristics and the trace
records `heuristic` rather than pretending a model spoke.

### 2.3 Feedback mechanism

Feedback is a question, then a comparison — never a correction. Three properties
distinguish it:

- **Evidence-first.** Every finding quotes the offending text or the registry
  value. "The DOI resolves to *An introduction to ROC analysis* (2006), not the
  pruning review you titled" is a statement the student can check directly against
  the source record.
- **Restraint is explicit.** Where a false-positive guard applies, the reason is
  written into the finding (`guardNote`) and shown in the UI. NFPA 130 with no DOI
  is not a fault; a vendor blog carrying an effect size is. The tool states which
  rule it applied and why, so a student can argue with it.
- **Honest uncertainty.** Findings are labelled `confirmed` or `needs your
  evidence`. A quotation from a paywalled source is recorded as *unverifiable*, not
  as fabricated.

### 2.4 How this differs from correcting citations

A corrector optimises the artefact; a coach optimises the author. Concretely:

| Corrector behaviour | Our behaviour |
| --- | --- |
| Repairs the malformed DOI | Reports the printed form, keeps it in the record, and asks where it was copied from — because the answer ("I pasted it from a styled PDF") predicts the next twenty citations |
| Rewrites the over-claiming sentence | Asks which population the source measured and whether the sentence stays inside it |
| Deletes the uncited statistic | Asks where the figure came from, and accepts "it is my own estimate" if the sentence says so |
| Silently drops a source it cannot verify | Says which registries were consulted, what they returned, and what would settle it |
| Produces a clean bibliography | Produces a **reasoning trace**: what was asked, what the student answered, how that compared with an independent reading |

The trace is the pedagogical product. It gives the supervisor evidence of
reasoning rather than a claim of correctness, and it makes an unanswered question
visible instead of dropping it.

---

## 3. Impact and value

**Educational.** The unit of feedback is the student's own justification, which is
the thing being assessed and the thing that transfers. The questions are
deliberately unanswerable by guessing: "which measured result supports this?"
cannot be satisfied without opening the source. The intervention targets the
specific misconception behind most citation faults — that a citation asserts a
source exists, when it asserts the source supports the claim.

**Time.** Measured on the benchmark corpus, in the packaged application on a
12-thread Windows laptop:

| Chapter | References | On-device parse + integrity analysis | Registry verification (live) | Findings produced |
| --- | --- | --- | --- | --- |
| 01 | 18 | 144 ms (median of 5) | 10.8 s | 37 |
| 02 | 20 | 141 ms | 20.8 s | 51 |
| 03 | 20 | 118 ms | 21.8 s | 36 |

Verification is sequential and network-bound, at 0.60–1.09 s per reference on our
connection; the deterministic analysis is effectively instant. So a full chapter is
checked, with evidence attached to every finding, in **11–22 seconds**. The
equivalent manual work is one lookup per reference; we have not measured supervisor
time and make no claim about the ratio. What changes is that the supervision meeting
starts from a trace log rather than from scratch.

**Learning outcomes.** Mapped to what a capstone rubric actually asks: source
credibility (authenticity dimension), evidential relevance (relevance dimension),
critical engagement (depth dimension), and synthesis (block-citation and
listing-without-synthesis findings). Scores are reported per dimension rather than
as one number, so a student who cites impeccable sources shallowly is told exactly
that.

**Academic integrity.** The posture is diagnostic, not accusatory. It catches the
faults that matter — a DOI resolving to a different paper, an author list that is
not the paper's, a duplicate presented as independent corroboration — while
explicitly declining to accuse where the evidence does not support accusation.
This was not decoration: during the audit, three findings that read as
"fabricated" were downgraded because the underlying inference (absence from two
registries) does not support the claim. A tool that cries fabrication at
NeurIPS proceedings will be ignored by week three, and then it protects nobody.

**Privacy as an enabling property.** Report text never leaves the device. The
webview has no remote network permission at all; the only egress is a Rust client
allow-listed to `api.crossref.org` and `api.openalex.org`, sending DOI, title,
first-author surname and year. Model inference is pinned to loopback. This is what
makes the tool deployable on unpublished capstone work with industry partners under
NDA — the case where a cloud tool cannot be used at all.

**Scalability.** No server, no per-student cost, no institutional data processor
agreement. Distribution is an MSI or NSIS installer; state is a local SQLite trace
store. Marginal cost per additional student is zero, and the load scales with the
student's own hardware.

**Future applications.** The same three-tier structure (decidable locally /
decidable from a registry / requires the source) generalises to: methodology
sections (does the stated method match the cited protocol), grant and tender
submissions, systematic-review screening, and supervisor-side batch triage across
a cohort. The failure-mode taxonomy is data, not code, so a discipline with
different conventions (legal citation, standards-heavy engineering) can be
supported by extending it.

---

## 4. AI approach: tools, techniques, models

### 4.1 Architecture

```
Tauri desktop app (single process, no server)
├── Webview — React 19 + TypeScript + Tailwind v4
│   ├── Ingestion:  pdf.js (PDF), mammoth (DOCX)
│   ├── Integrity:  30 deterministic failure modes + false-positive guards
│   ├── Domain:     Socratic planner, dual-reasoning evaluator, scoring
│   └── Export:     Markdown + PDF (jsPDF), rendered in-process
└── Rust core — the only component with network or disk authority
    ├── commands/llm.rs       loopback-pinned bridge to Ollama
    ├── commands/metadata.rs  host allow-listed Crossref + OpenAlex client
    ├── commands/ingest.rs    scoped file read, guarded export write
    └── db.rs                 SQLite auditable trace store
```

**Why Tauri rather than Electron or a web app.** The privacy requirement is
structural, not a promise: the webview's CSP has no remote `connect-src`, so no
frontend dependency can exfiltrate report text even if compromised. Outbound
network capability is confined to two Rust modules — `metadata.rs` (467 lines) and
`llm.rs` (188 lines) — each with its allow-list check at the top of the call path,
so the entire egress surface can be read in one sitting. A web app cannot offer
this property; Electron would ship a browser with full network access.

**Why parsing in the webview rather than a Python service.** The original design
called for PyMuPDF/GROBID. pdf.js and mammoth remove a Python runtime from the
install footprint, keep the bytes in one process, and expose per-item geometry that
the line-reassembly heuristics need. The trade-off — weaker layout analysis than
GROBID — is acceptable because reference-list segmentation is regex-and-heuristic
work either way, and it was validated against the benchmark corpus (18/20/20
entries segmented correctly).

### 4.2 Models

- **Reasoning:** a local instruction model via Ollama — `llama3` (8B) by default,
  `mistral` and `llama3.2:3b` supported. Loopback only; a non-loopback endpoint is
  refused by the Rust core unless an operator sets `SCC_ALLOW_REMOTE_LLM=1` for an
  institutionally hosted server.
- **Why the design tolerates a small local model.** The model is never asked to
  *retrieve* facts. Every fact in the prompt is supplied: the claim, the reference
  metadata, the student's excerpt, their rationale. The task is bounded comparison
  and classification over provided text, and anything that must be exact is carried
  by the deterministic layer instead. **Not yet evidenced:** we have not run a real
  model end-to-end. The model path was exercised against a stub daemon serving
  canned JSON, which verifies the transport, parsing, coercion and persistence, but
  says nothing about answer quality. Measuring output quality against a locally
  installed `llama3` is the first task of the next phase.
- **No embedding model.** Similarity between the student's rationale and the AI
  reading is computed lexically (stemmed Jaccard plus directional coverage).
  Reason: the signal feeds a coarse three-way classification, an embedding model
  would add a second inference path and another download to the install footprint,
  and the lexical measure is inspectable — a supervisor can see *which* terms
  overlapped. Whether an embedding model would improve the classification is
  untested.

### 4.3 Prompt engineering strategy

All prompts live in one auditable file (`src/lib/ai/prompts.ts`) so a supervisor or
ethics reviewer can read exactly what is asked. Four techniques:

1. **Negative constraints in the system prompt.** The Socratic prompt forbids
   stating the answer, summarising the source, or writing the student's rationale —
   because a coach that answers its own question destroys the exercise. The
   constraint is a design requirement; its effect on model output has not yet been
   measured against a real model.
2. **Grounding fences on the evaluator.** "Judge only the text provided. Never
   invent findings, numbers or page contents that are not present." The evaluator's
   failure mode is confabulating source content; this is the mitigation, backed by
   the fact that it is never given source text to confabulate from.
3. **Schema-constrained output.** `format: "json"` plus an explicit target shape,
   parsed by a balanced-brace extractor (fenced-code tolerant), one retry that
   restates the format requirement, then coercion: unknown alignment values fall
   back to the heuristic verdict, scores on 0–1 or 0–10 scales are rescaled, gap
   kinds outside the taxonomy become `superficial`.
4. **One claim per call.** The Ollama request sets `num_ctx: 4096` and each call
   carries a single claim. This bounds the context a small model has to hold and
   makes the trace attributable — each evaluation records which model produced it
   and its elapsed time.

### 4.4 Document processing pipeline

```
bytes → text extraction (pdf.js line reassembly by baseline / mammoth)
      → block segmentation (heading-aware, so headings do not fuse into sentences)
      → sentence segmentation (abbreviation- and citation-aware)
      → inline citation detection (numeric, cross-bracket ranges, parenthetical,
        narrative; diacritic-safe)
      → reference-list segmentation (IEEE / Vancouver / APA)
      → marker ↔ entry resolution
      → integrity analysis (offline)
      → metadata verification (Crossref + OpenAlex)
      → integrity analysis (re-run with registry records)
```

Two details that matter more than they look:

- **Range expansion before set difference.** `[1]-[8]` cites eight sources. A
  naive set difference over literal markers reports the six interior references as
  orphans — six false positives on one document. Interior members are marked
  `viaRange` and reported as a block-citation consequence instead.
- **Repair is recorded, not silent.** A DOI printed with U+2011 hyphens is
  normalised for lookup, but the printed form is retained in `doiAsWritten` and
  reported. Silently fixing it would hide the fault from the student.

### 4.5 Citation analysis workflow

Findings are typed against the supplied taxonomy (`FAILURE_MODES.md`) across four
levels — structural, reference, source, use — each with severity
(critical/major/moderate/advisory) and confidence (`confirmed` /
`needs-evidence`). Scoring is deliberately three-dimensional and separable:

```
overall = 0.30 · authenticity + 0.35 · relevance + 0.35 · depth
```

so a supervisor can see *why* a citation scored badly rather than receiving one
opaque number. Health bands (High quality / Valid / Weak grounding / Unverified)
place source-integrity problems in a different category from
weak-justification problems, because they call for different remedies.

### 4.6 Validation logic

- **False-positive guards are first-class.** Diacritics are folded for comparison
  only and never stored folded; particle surnames (`van Beek`), single-syllable
  surnames (`He`) and hyphenated initials (`T.-Y.`) are handled; standards and
  statutes are exempt from both the missing-DOI check and registry lookup; vendor
  *documentation* is distinguished from vendor *blogs* by URL; proceedings without
  DOIs are advisory, not faults. Each guard writes its reasoning into the finding.
- **Fabrication requires a failed identifier.** Absence from two registries is
  never sufficient. This was tightened during the audit after it produced three
  false positives, and because Crossref title search proved nondeterministic —
  the same document returned 10 verified / 7 not-found on one run and 7 / 11 on
  another.
- **Model output is bounded by heuristics**, as described in §4.2–4.3.

### 4.7 Technologies

Tauri 2 · Rust (reqwest with rustls, rusqlite bundled, serde) · React 19 ·
TypeScript 5.9 (strict) · Vite 8 · Tailwind CSS 4 · pdf.js 6 · mammoth 1.12 ·
jsPDF 4 · lucide-react · Ollama · SQLite · WiX + NSIS bundling.

---

## 5. Prototype plan

### 5.1 Current implementation status

**Working, end-to-end, in the packaged desktop application.** Not a mock-up: the
Windows installers build, the app launches, ingests real DOCX chapters, calls live
registries, runs local model inference, persists to SQLite and writes exports.

| Component | Status | Evidence |
| --- | --- | --- |
| Ingestion (PDF/DOCX/TXT/MD) | Complete | 3 benchmark DOCX chapters parsed; 18/20/20 reference entries segmented; parse + analysis 118–144 ms per chapter |
| Integrity engine (30 modes) | Complete | 46/46 offline expectations hit, 0 false positives on 15 control references |
| Registry verification | Complete | 26/26 live checks in the packaged app; 10.8–21.8 s per chapter |
| Socratic checkpoint UI | Complete | Driven end-to-end via WebView2 remote debugging |
| Dual-reasoning evaluator | Transport complete, quality unmeasured | Model output rendered, scored and persisted — verified against a **stub** daemon; heuristic fallback verified. No real model has been run end-to-end |
| Trace store (SQLite) | Complete | Round-trip verified: claims, references, checkpoints, evaluations, provenance |
| Markdown + PDF export | Complete | Valid PDF (2 pages, `%%EOF`) written to Documents |
| Installers (MSI + NSIS) | Complete | Built and launched; unsigned |

### 5.2 Core features completed

Local-first ingestion and parsing · citation-integrity engine with explicit
false-positive guards · metadata-only source verification against two registries ·
finding-driven Socratic questioning · dual-reasoning comparison with heuristic
fallback · three-dimensional citation quality metric and health matrix · auditable
reasoning-trace export · privacy guards enforced in Rust (loopback-pinned
inference, host allow-listing, path-traversal and extension guards on export).

### 5.3 Remaining milestones

| # | Milestone | Rationale |
| --- | --- | --- |
| 1 | Resume a saved trace in the UI | `load_trace` works at the command level and is verified, but no component calls it, so a half-finished checkpoint cannot be reopened after closing the app. Highest-value gap. |
| 2 | Code-sign the installers | SmartScreen warns on first run; blocks institutional distribution. |
| 3 | Supervisor batch mode | Run the deterministic layer across a cohort's drafts and rank by finding severity, so supervision time goes where it is needed. |
| 4 | Optional student-supplied source text | When the student legitimately holds the PDF, allow local-only comparison to reach patchwriting and quote-mining without any upload. |
| 5 | Additional registries | DataCite, OpenLibrary and a standards catalogue, to shrink the "not indexed here" category. |
| 6 | Escape-to-close and auto-recheck of model status | Minor UX defects found in audit. |

### 5.4 Testing strategy

Four layers, all reproducible:

1. **Module-level harness** over the deterministic core (parsing, citation
   mapping, salience, heuristic evaluation, matrix, export). Run as a one-off
   script; the harness is not committed, so its assertion count is not
   reproducible from the repository — promoting it to a committed suite is the
   first item in this section's backlog.
2. **Real-browser harness** for DOM-dependent paths (pdf.js worker, mammoth),
   driven by headless Chrome against the dev server.
3. **Packaged-app harness** driven through WebView2 remote debugging, exercising
   the actual Rust commands: live registry calls, local model calls against a stub
   daemon, SQLite round-trip, native export, and every privacy guard (a
   non-loopback endpoint, path traversal, disallowed extensions, malformed base64).
4. **Benchmark scoring** against the three supplied cases and their keys,
   measuring hits, misses **and false positives** on the references the keys
   declare sound.

Harnesses are temporary by design and removed after each run; the app ships no
test scaffolding. The next step here is to promote layers 1 and 4 into a committed
Vitest suite so scoring runs in CI.

### 5.5 Evaluation methodology

The benchmark is scored on three numbers, because two of them are easy to game
alone:

- **Recall** — expected findings detected. Currently **46/46** on the offline pass
  (30 per-reference expectations plus 16 document-level ones, across the three
  chapters) and **26/26** on the live-registry pass.
- **Precision** — accusations against references the keys declare sound.
  Currently **0** false positives: 15 control references on the offline pass, 17 on
  the live pass. Weighted equally with recall, because case 02's key states that "a
  student told that seven of twenty references are broken when four are will stop
  reading the output by week three".
- **Honesty** — proportion of findings correctly labelled `needs-evidence` rather
  than asserted. Checked by inspection during the audit; four fixes were applied to
  correct over-assertion.

Every factual claim the keys make was independently confirmed against live
Crossref, OpenAlex, arXiv and DNS (23/23) so that the benchmark itself is not
taken on trust. Two imprecisions in the keys' own wording were found and reported
rather than silently accommodated.

For the next phase, evaluation moves to real bibliographies: measure supervisor
agreement with each finding (accept / reject / needs judgement) on anonymised
capstone drafts, and treat the rejection rate as the precision metric that matters.

### 5.6 Future improvements

Priority order reflects measured weakness, not novelty: trace resumption (a
built-but-unwired feature), then precision on real bibliographies, then reducing
the "not indexed" category with more registries, then optional local source-text
comparison to reach the source-content failure modes, then supervisor cohort
triage. Model-side, the evaluator would benefit from a small labelled set of
student rationales scored by supervisors, used to calibrate the depth dimension —
currently a defensible heuristic rather than a validated measure.

### 5.7 Demo workflow

1. **Launch the installed app.** Point out the sidebar's "Local-first" panel and
   the model-status pill: the app states its own trust posture before it is given
   anything.
2. **Drop in `02_edge_detection_lit_review.docx`.** Parsing completes in well under
   a second and verification takes about 20 s against live registries; findings then
   appear grouped by consequence (50–52 across our runs, the variation coming from
   Crossref title-search results).
3. **Show three findings that no formatter would catch.** `[13]`'s DOI resolves to
   Fawcett's ROC paper, not the pruning review named in the entry. `[20]` duplicates
   `[7]` character for character. `[6]`'s DOI is printed with non-breaking hyphens
   and can never resolve.
4. **Show restraint.** `[12]` (Ren, **He**, Girshick, Sun) and `[15]` (Lin, …,
   **Dollár**) are untouched, and `[17]` NVIDIA documentation is not accused of
   fabrication despite being absent from Crossref — with the guard note explaining
   why.
5. **Enter the Socratic checkpoint.** Answer one question badly, then well; show
   the alignment verdict move from *misaligned* to *aligned* and the depth score
   move with it, side by side with the AI's independent reading.
6. **Export the Reasoning Trace Log** and open the PDF: findings, questions,
   rationales, comparison, and the privacy statement recording that no report text
   left the device.
7. **Close with the benchmark numbers** — 46/46 and 26/26 with zero false
   positives — and with what the tool deliberately does not claim to detect.
