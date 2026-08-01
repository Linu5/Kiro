// Creates a traces.sqlite with the PRE-migration checkpoints schema, plus a row,
// so launching the app exercises the ALTER TABLE path over real data.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.env.APPDATA, "sg.edu.sit.socratic-citation-coach");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const path = join(dir, "traces.sqlite");

const db = new DatabaseSync(path);
db.exec(`
CREATE TABLE documents (
    id TEXT PRIMARY KEY, file_name TEXT NOT NULL, title TEXT NOT NULL,
    thesis TEXT NOT NULL DEFAULT '', executive_summary TEXT NOT NULL DEFAULT '',
    page_count INTEGER NOT NULL DEFAULT 0, word_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL);
CREATE TABLE claims (
    id TEXT PRIMARY KEY, document_id TEXT NOT NULL, text TEXT NOT NULL,
    page INTEGER NOT NULL DEFAULT 1, section TEXT, citation_markers TEXT NOT NULL DEFAULT '[]');
CREATE TABLE refs (
    id TEXT PRIMARY KEY, document_id TEXT NOT NULL, marker TEXT NOT NULL, raw TEXT NOT NULL,
    doi TEXT, title TEXT, year INTEGER, authenticity_json TEXT);
-- The old checkpoints table: no revision, no revised_at.
CREATE TABLE checkpoints (
    id TEXT PRIMARY KEY, document_id TEXT NOT NULL, claim_id TEXT NOT NULL, reference_id TEXT,
    dimension TEXT NOT NULL, question TEXT NOT NULL,
    student_rationale TEXT NOT NULL DEFAULT '', evidence_excerpt TEXT NOT NULL DEFAULT '',
    answered_at TEXT NOT NULL);
CREATE TABLE evaluations (
    id TEXT PRIMARY KEY, checkpoint_id TEXT NOT NULL, document_id TEXT NOT NULL,
    ai_insight TEXT NOT NULL, ai_expected_evidence TEXT NOT NULL DEFAULT '',
    student_summary TEXT NOT NULL DEFAULT '', alignment TEXT NOT NULL,
    similarity REAL NOT NULL DEFAULT 0, gaps_json TEXT NOT NULL DEFAULT '[]',
    authenticity INTEGER NOT NULL DEFAULT 0, relevance INTEGER NOT NULL DEFAULT 0,
    depth INTEGER NOT NULL DEFAULT 0, overall INTEGER NOT NULL DEFAULT 0,
    model TEXT NOT NULL DEFAULT '', generated_by TEXT NOT NULL DEFAULT 'heuristic',
    created_at TEXT NOT NULL);
INSERT INTO documents (id, file_name, title, page_count, word_count, created_at)
  VALUES ('doc_legacy', 'legacy.docx', 'A legacy trace', 3, 900, '2026-07-01T00:00:00.000Z');
INSERT INTO claims (id, document_id, text, page) VALUES ('claim_legacy', 'doc_legacy', 'A legacy claim [1].', 1);
INSERT INTO checkpoints (id, document_id, claim_id, dimension, question, student_rationale, evidence_excerpt, answered_at)
  VALUES ('q_legacy', 'doc_legacy', 'claim_legacy', 'grounding', 'Legacy question?', 'Legacy rationale.', 'Legacy excerpt.', '2026-07-01T00:05:00.000Z');
`);
const columns = db.prepare("SELECT name FROM pragma_table_info('checkpoints')").all().map((r) => r.name);
db.close();
console.log(`old DB written: ${path}`);
console.log(`old checkpoints columns: ${columns.join(", ")}`);
console.log(`has revision column before launch: ${columns.includes("revision")}`);
