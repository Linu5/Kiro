# Socratic Citation Coach - System Architecture

Local-first desktop application for SIT capstone students and faculty supervisors.
The guiding constraint is **zero third-party leakage of report text**: the full text
of a student report is parsed, reasoned over and stored entirely on the student's
machine. Only bibliographic identifiers (DOI, title, author surname, year) ever
leave the device, and only towards open scholarly APIs.

---

## 1. Layer diagram

```mermaid
graph TD
  subgraph Device["Student device (trust boundary)"]
    subgraph Webview["Tauri Webview - React + TypeScript"]
      UI["UI shell<br/>Sidebar - 4 views"]
      PARSE["Ingestion engine<br/>pdf.js / mammoth<br/>claim + citation mapping"]
      DOMAIN["Domain layer<br/>Socratic planner<br/>Dual-reasoning evaluator<br/>Citation quality metric"]
      EXPORT["Audit exporter<br/>Markdown + PDF (jsPDF)"]
    end

    subgraph Core["Tauri Core - Rust"]
      IPC["Typed command surface<br/>(commands/*.rs)"]
      LLM["LLM bridge<br/>localhost:11434"]
      META["Metadata client<br/>allow-listed hosts only"]
      DB["Trace store<br/>rusqlite (embedded SQLite)"]
      FSR["File ingest<br/>scoped read of chosen file"]
    end

    OLLAMA["Ollama daemon<br/>llama3 / mistral"]
    SQLITE[("traces.sqlite<br/>app data dir")]
    FILES[("Report PDF / DOCX")]
  end

  CROSSREF["Crossref API"]
  OPENALEX["OpenAlex API"]

  UI --> PARSE --> DOMAIN --> EXPORT
  DOMAIN -->|invoke| IPC
  PARSE -->|invoke| IPC
  EXPORT -->|invoke| IPC
  IPC --> LLM --> OLLAMA
  IPC --> META
  IPC --> DB --> SQLITE
  IPC --> FSR --> FILES
  META -->|metadata only| CROSSREF
  META -->|metadata only| OPENALEX

  classDef remote fill:#7f1d1d,stroke:#fca5a5,color:#fff
  class CROSSREF,OPENALEX remote
```

Everything inside `Device` is local. The two red nodes are the only network
egress points, and the Rust metadata client is the only component allowed to
reach them (the webview CSP forbids remote connections altogether).

## 2. Pipeline

```mermaid
sequenceDiagram
  autonumber
  actor S as Student
  participant UI as React UI
  participant P as Parser (webview)
  participant R as Rust core
  participant O as Ollama (local)
  participant X as Crossref / OpenAlex

  S->>UI: Drop report.pdf
  UI->>P: extractDocument(bytes)
  P->>P: page text, thesis, references, inline citations -> claims
  P->>R: save_document(trace)
  loop per reference
    UI->>R: verify_source({doi,title,year})
    R->>X: GET /works/{doi}
    X-->>R: publisher, type, indexed flags
    R-->>UI: AuthenticityVerdict
  end
  UI->>R: llm_generate(socratic prompt)
  R->>O: POST /api/generate (format=json)
  O-->>R: Socratic questions
  R-->>UI: questions
  S->>UI: highlight evidence + type rationale
  UI->>R: llm_generate(dual-reasoning prompt)
  R->>O: POST /api/generate
  O-->>R: AI insight + gap analysis
  UI->>UI: score authenticity / relevance / depth
  UI->>R: save_checkpoint + save_evaluation
  S->>UI: Export reasoning trace
  UI->>UI: Markdown + PDF built in-process
```

## 3. Module map

| Path | Responsibility |
| --- | --- |
| `src/types/index.ts` | Single source of truth for the domain model shared with Rust payload shapes. |
| `src/lib/env.ts` | Runtime detection of the Tauri host vs. plain browser (dev/demo mode). |
| `src/lib/ipc.ts` | Typed wrappers around `invoke`, with graceful degradation when the Rust core is absent. |
| `src/lib/parsing/extractText.ts` | PDF (pdf.js) and DOCX (mammoth) text extraction, page-aware. |
| `src/lib/parsing/references.ts` | Reference-list segmentation, DOI/venue/year extraction. |
| `src/lib/parsing/citations.ts` | Inline citation detection (`[12]`, `(Smith et al., 2023)`) and claim-sentence mapping. |
| `src/lib/parsing/index.ts` | Orchestrates ingestion into a `ReportDocument`. |
| `src/lib/ai/prompts.ts` | All LLM prompt templates (Socratic + dual reasoning). Auditable in one place. |
| `src/lib/ai/ollama.ts` | JSON-constrained local LLM calls with retry and schema coercion. |
| `src/lib/ai/socratic.ts` | Socratic question planning; deterministic fallback bank when no model is running. |
| `src/lib/ai/evaluator.ts` | AI-vs-student comparison, alignment classification, gap detection. |
| `src/lib/scoring.ts` | Authenticity / relevance / depth metric and citation health roll-up. |
| `src/lib/export/markdown.ts` | Reasoning Trace Log in Markdown. |
| `src/lib/export/pdf.ts` | Same log rendered to PDF via jsPDF. |
| `src/lib/persistence.ts` | Trace persistence: SQLite through Rust, `localStorage` in browser mode. |
| `src/state/AppStore.tsx` | Reducer-based application state and derived selectors. |
| `src/views/*` | The four sidebar destinations. |
| `src-tauri/src/commands/*` | `ingest`, `llm`, `metadata`, `traces` command modules. |
| `src-tauri/src/db.rs` | Schema + queries for the auditable trace store. |

## 4. Data model (SQLite)

```mermaid
erDiagram
  DOCUMENTS ||--o{ REFERENCES_TBL : cites
  DOCUMENTS ||--o{ CLAIMS : contains
  CLAIMS ||--o{ CHECKPOINTS : questioned_by
  CHECKPOINTS ||--o| EVALUATIONS : scored_by
  DOCUMENTS {
    string id PK
    string title
    string thesis
    string file_name
    int    page_count
    string created_at
  }
  REFERENCES_TBL {
    string id PK
    string document_id FK
    string marker
    string raw
    string doi
    string authenticity_json
  }
  CLAIMS {
    string id PK
    string document_id FK
    string text
    int    page
    string citation_markers_json
  }
  CHECKPOINTS {
    string id PK
    string claim_id FK
    string question
    string dimension
    string student_rationale
    string evidence_excerpt
    string answered_at
  }
  EVALUATIONS {
    string id PK
    string checkpoint_id FK
    string ai_insight
    string alignment
    string gaps_json
    int    authenticity
    int    relevance
    int    depth
    string model
    string created_at
  }
```

## 5. Privacy controls, concretely

1. `tauri.conf.json` sets a CSP without remote `connect-src`, so the webview
   cannot reach the internet even if a dependency tried.
2. Network access lives only in `commands/metadata.rs`, which refuses any host
   outside `api.crossref.org` / `api.openalex.org` and only serialises the
   `SourceQuery` struct (DOI, title, first author, year).
3. `commands/llm.rs` refuses any base URL that is not loopback unless the
   operator explicitly configures an institutional endpoint, and records which
   endpoint produced each evaluation in the trace log.
4. Report bytes are read by Rust from a path the user picked, handed to the
   webview in memory, and persisted only inside the OS app-data directory.
