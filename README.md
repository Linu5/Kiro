# Socratic Citation Coach

A local-first Tauri desktop app that coaches SIT capstone students through
justifying every citation in their literature review, then produces an auditable
reasoning trace their faculty supervisor can review.

- Full architecture and data model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Prompt templates (auditable in one place): [`src/lib/ai/prompts.ts`](src/lib/ai/prompts.ts)

## What it does

| Phase | Capability |
| --- | --- |
| 1. Ingestion | Drag-and-drop PDF/DOCX, thesis extraction, inline-citation to claim mapping, source verification against Crossref/OpenAlex. |
| 2. Socratic checkpoint | Targeted questions per claim; student highlights the exact excerpt and writes their own rationale. |
| 3. Dual reasoning | The local model reasons about the claim/citation link independently, then the two reasonings are compared for gaps, over-generalisation and surface-level use. |
| 4. Audit | Citation health matrix, side-by-side comparison cards, exportable Markdown/PDF Reasoning Trace Log. |

## Prerequisites

| Tool | Why | Status on this machine |
| --- | --- | --- |
| Node.js 20+ | webview build | installed (v24) |
| Rust toolchain (`rustup`, MSVC build tools) | Tauri core | installed (rustc 1.97.1, MSVC host) |
| [Ollama](https://ollama.com) with `llama3` or `mistral` | local reasoning | optional - the app falls back to a deterministic question bank and heuristic evaluator |

```powershell
# Rust (Windows)
winget install Rustlang.Rustup ; rustup default stable-msvc
# Local model
ollama pull llama3
```

## Running

```powershell
npm install

# Webview only (browser mode: parsing, scoring, export all work;
# SQLite falls back to localStorage, LLM falls back to heuristics)
npm run dev

# Full desktop app (needs the Rust toolchain)
npm run tauri:dev

# Typecheck + production webview bundle
npm run build
```

## Building the installers

```powershell
npm run tauri:build
```

Outputs, both x64 and unsigned:

| Artifact | Path |
| --- | --- |
| MSI (WiX, per-machine) | `src-tauri/target/release/bundle/msi/Socratic Citation Coach_0.1.0_x64_en-US.msi` |
| NSIS setup (per-user, no admin prompt) | `src-tauri/target/release/bundle/nsis/Socratic Citation Coach_0.1.0_x64-setup.exe` |
| Portable executable | `src-tauri/target/release/socratic-citation-coach.exe` |

If `cargo` cannot find the MSVC linker (common when only a Visual Studio
*Insiders* build is installed, which `vswhere` does not report), run the build
from a developer shell:

```powershell
cmd /c "call ""C:\Program Files\Microsoft Visual Studio\18\Insiders\VC\Auxiliary\Build\vcvars64.bat"" && npx tauri build"
```

The first bundle run downloads WiX 3.14 and NSIS 3.11 into the Tauri cache, so it
needs network access once. Both installers are unsigned: Windows SmartScreen will
warn on first run until they are code-signed with an institutional certificate
(`bundle.windows.certificateThumbprint` in `tauri.conf.json`).

Bundle icons are already generated in `src-tauri/icons/` from `src-tauri/app-icon.png`.
To rebrand, replace that PNG and regenerate:

```powershell
npx tauri icon .\src-tauri\app-icon.png
```

Note on drag-and-drop: `dragDropEnabled` is `false` in `tauri.conf.json` on purpose, so the
webview receives standard HTML5 drop events and reads the file bytes in-process. Nothing is
copied or uploaded; the Rust file-read command is used only for the native "Browse" dialog.

## Configuration

Runtime settings live in the app's Settings drawer and are persisted locally:

- `llmBaseUrl` - default `http://127.0.0.1:11434`. Non-loopback hosts are
  rejected by the Rust core unless `SCC_ALLOW_REMOTE_LLM=1` is set for an
  institutionally hosted endpoint.
- `llmModel` - default `llama3`.
- `metadataEnabled` - when off, no network call is made at all and every source
  is reported as `unverified`.

## Privacy model

Report text never leaves the device. The webview CSP has no remote
`connect-src`; the only outbound requests are made by `src-tauri/src/commands/metadata.rs`,
which is host-allow-listed to `api.crossref.org` and `api.openalex.org` and
sends only DOI/title/author/year. See section 5 of the architecture doc.

## Project layout

```
.
├── docs/ARCHITECTURE.md        # diagrams, module map, data model
├── index.html
├── src/                        # React + TypeScript webview
│   ├── components/             # shell + reusable UI
│   ├── views/                  # Document Overview, Socratic Checkpoint,
│   │                           # Reasoning Comparison, Supervisor Audit
│   ├── lib/parsing/            # pdf.js / mammoth ingestion + citation mapping
│   ├── lib/ai/                 # prompts, Ollama bridge, planner, evaluator
│   ├── lib/export/             # Markdown + PDF trace log
│   ├── lib/scoring.ts          # authenticity / relevance / depth metric
│   ├── state/AppStore.tsx      # reducer + selectors
│   └── types/index.ts          # shared domain model
└── src-tauri/                  # Rust core
    ├── src/commands/           # ingest, llm, metadata, traces
    ├── src/db.rs               # SQLite trace store
    └── tauri.conf.json         # window, CSP, bundle
```

## Milestone status

1. Tauri scaffold with Rust hooks for file access, SQLite and Ollama - **done**
2. PDF/DOCX parser with claim + citation mapping - **done**
3. React Socratic Q&A workflow - **done**
4. AI vs. student evaluation pipeline - **done**
5. Dashboard + audit exporter (Markdown/PDF) - **done**

## Verification status

Verified on this machine:

- `npx tsc --noEmit` clean.
- `npx vite build` clean; pdf.js, mammoth and jsPDF are code-split so the initial
  chunk stays around 90 kB gzipped.
- The deterministic core was exercised end to end on a synthetic IEEE-style
  report: reference segmentation (3/3 entries with DOI, year and title), inline
  citation detection and resolution (`[1]`, `[2]`, `[3]` resolved, an unmatched
  `(Tan & Lee, 2020)` correctly flagged as orphan), claim salience ranking,
  heuristic dual-reasoning evaluation (a thin answer scored `misaligned`, a
  grounded one `aligned`), the health matrix roll-up, and Markdown trace export.

- The Rust core compiles clean in release mode (no warnings) and both installers
  bundle successfully.
- The built executable launches, stays up, closes cleanly, and creates its SQLite
  trace store at `%APPDATA%\sg.edu.sit.socratic-citation-coach\traces.sqlite`,
  which exercises the setup hook and the schema migration.

Not verified end to end: `llm_generate` against a live Ollama daemon and
`verify_source` against Crossref/OpenAlex, since neither was running here. Both
degrade to documented fallbacks rather than failing.
