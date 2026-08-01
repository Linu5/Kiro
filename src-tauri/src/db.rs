use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::CoreResult;

/// Storage records. Field names mirror `src/types/index.ts` / `src/lib/ipc.ts`
/// exactly (camelCase on the wire), so the TypeScript wrappers need no mapping.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaimRecord {
    pub id: String,
    pub text: String,
    pub page: i64,
    #[serde(default)]
    pub section: Option<String>,
    #[serde(default)]
    pub citation_markers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceRecord {
    pub id: String,
    pub marker: String,
    pub raw: String,
    #[serde(default)]
    pub doi: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub year: Option<i64>,
    #[serde(default)]
    pub authenticity_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRecord {
    pub id: String,
    pub file_name: String,
    pub title: String,
    pub thesis: String,
    #[serde(default)]
    pub executive_summary: String,
    pub page_count: i64,
    pub word_count: i64,
    pub created_at: String,
    #[serde(default)]
    pub claims: Vec<ClaimRecord>,
    #[serde(default)]
    pub references: Vec<ReferenceRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointRecord {
    pub id: String,
    pub document_id: String,
    pub claim_id: String,
    #[serde(default)]
    pub reference_id: Option<String>,
    pub dimension: String,
    pub question: String,
    pub student_rationale: String,
    pub evidence_excerpt: String,
    pub answered_at: String,
    /// What the student changed after re-reading the source.
    #[serde(default)]
    pub revision: Option<String>,
    #[serde(default)]
    pub revised_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationRecord {
    pub id: String,
    pub checkpoint_id: String,
    pub document_id: String,
    pub ai_insight: String,
    pub ai_expected_evidence: String,
    pub student_summary: String,
    pub alignment: String,
    pub similarity: f64,
    pub gaps_json: String,
    pub authenticity: i64,
    pub relevance: i64,
    pub depth: i64,
    pub overall: i64,
    pub model: String,
    pub generated_by: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSummary {
    pub id: String,
    pub title: String,
    pub file_name: String,
    pub created_at: String,
    pub claim_count: i64,
    pub answered_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredTrace {
    pub document: DocumentRecord,
    pub checkpoints: Vec<CheckpointRecord>,
    pub evaluations: Vec<EvaluationRecord>,
}

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
    id                TEXT PRIMARY KEY,
    file_name         TEXT NOT NULL,
    title             TEXT NOT NULL,
    thesis            TEXT NOT NULL DEFAULT '',
    executive_summary TEXT NOT NULL DEFAULT '',
    page_count        INTEGER NOT NULL DEFAULT 0,
    word_count        INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
    id                TEXT PRIMARY KEY,
    document_id       TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    text              TEXT NOT NULL,
    page              INTEGER NOT NULL DEFAULT 1,
    section           TEXT,
    citation_markers  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS refs (
    id                TEXT PRIMARY KEY,
    document_id       TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    marker            TEXT NOT NULL,
    raw               TEXT NOT NULL,
    doi               TEXT,
    title             TEXT,
    year              INTEGER,
    authenticity_json TEXT
);

CREATE TABLE IF NOT EXISTS checkpoints (
    id                TEXT PRIMARY KEY,
    document_id       TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    claim_id          TEXT NOT NULL,
    reference_id      TEXT,
    dimension         TEXT NOT NULL,
    question          TEXT NOT NULL,
    student_rationale TEXT NOT NULL DEFAULT '',
    evidence_excerpt  TEXT NOT NULL DEFAULT '',
    answered_at       TEXT NOT NULL,
    revision          TEXT,
    revised_at        TEXT
);

CREATE TABLE IF NOT EXISTS evaluations (
    id                   TEXT PRIMARY KEY,
    checkpoint_id        TEXT NOT NULL,
    document_id          TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ai_insight           TEXT NOT NULL,
    ai_expected_evidence TEXT NOT NULL DEFAULT '',
    student_summary      TEXT NOT NULL DEFAULT '',
    alignment            TEXT NOT NULL,
    similarity           REAL NOT NULL DEFAULT 0,
    gaps_json            TEXT NOT NULL DEFAULT '[]',
    authenticity         INTEGER NOT NULL DEFAULT 0,
    relevance            INTEGER NOT NULL DEFAULT 0,
    depth                INTEGER NOT NULL DEFAULT 0,
    overall              INTEGER NOT NULL DEFAULT 0,
    model                TEXT NOT NULL DEFAULT '',
    generated_by         TEXT NOT NULL DEFAULT 'heuristic',
    created_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_document ON claims(document_id);
CREATE INDEX IF NOT EXISTS idx_refs_document ON refs(document_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_document ON checkpoints(document_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_checkpoint ON evaluations(checkpoint_id);
"#;

/// Auditable reasoning-trace store. Lives in the OS app-data directory and
/// never leaves the device.
pub struct TraceStore {
    conn: Connection,
}

impl TraceStore {
    pub fn open(path: &Path) -> CoreResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;
        let store = Self { conn };
        store.migrate()?;
        Ok(store)
    }

    /// Additive migrations for stores created by an earlier version.
    ///
    /// `CREATE TABLE IF NOT EXISTS` leaves an existing table untouched, so a new
    /// column has to be added explicitly. Checked against `PRAGMA table_info`
    /// rather than by catching the error, so a genuine failure is not swallowed.
    fn migrate(&self) -> CoreResult<()> {
        for (table, column, definition) in [
            ("checkpoints", "revision", "TEXT"),
            ("checkpoints", "revised_at", "TEXT"),
        ] {
            if !self.has_column(table, column)? {
                self.conn
                    .execute_batch(&format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"))?;
            }
        }
        Ok(())
    }

    fn has_column(&self, table: &str, column: &str) -> CoreResult<bool> {
        let mut stmt = self
            .conn
            .prepare(&format!("SELECT 1 FROM pragma_table_info('{table}') WHERE name = ?1"))?;
        Ok(stmt.exists([column])?)
    }

    pub fn save_document(&mut self, document: &DocumentRecord) -> CoreResult<()> {
        let tx = self.conn.transaction()?;
        tx.execute(
            "INSERT INTO documents (id, file_name, title, thesis, executive_summary, page_count, word_count, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
               file_name = excluded.file_name,
               title = excluded.title,
               thesis = excluded.thesis,
               executive_summary = excluded.executive_summary,
               page_count = excluded.page_count,
               word_count = excluded.word_count",
            params![
                document.id,
                document.file_name,
                document.title,
                document.thesis,
                document.executive_summary,
                document.page_count,
                document.word_count,
                document.created_at,
            ],
        )?;

        // Re-ingesting the same report replaces its parse result wholesale.
        tx.execute("DELETE FROM claims WHERE document_id = ?1", params![document.id])?;
        tx.execute("DELETE FROM refs WHERE document_id = ?1", params![document.id])?;

        for claim in &document.claims {
            tx.execute(
                "INSERT INTO claims (id, document_id, text, page, section, citation_markers)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    claim.id,
                    document.id,
                    claim.text,
                    claim.page,
                    claim.section,
                    serde_json::to_string(&claim.citation_markers)?,
                ],
            )?;
        }

        for reference in &document.references {
            tx.execute(
                "INSERT INTO refs (id, document_id, marker, raw, doi, title, year, authenticity_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    reference.id,
                    document.id,
                    reference.marker,
                    reference.raw,
                    reference.doi,
                    reference.title,
                    reference.year,
                    reference.authenticity_json,
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn update_reference_authenticity(
        &mut self,
        reference_id: &str,
        authenticity_json: &str,
    ) -> CoreResult<()> {
        self.conn.execute(
            "UPDATE refs SET authenticity_json = ?2 WHERE id = ?1",
            params![reference_id, authenticity_json],
        )?;
        Ok(())
    }

    pub fn save_checkpoint(&mut self, checkpoint: &CheckpointRecord) -> CoreResult<()> {
        self.conn.execute(
            "INSERT INTO checkpoints (id, document_id, claim_id, reference_id, dimension, question, student_rationale, evidence_excerpt, answered_at, revision, revised_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(id) DO UPDATE SET
               student_rationale = excluded.student_rationale,
               evidence_excerpt = excluded.evidence_excerpt,
               answered_at = excluded.answered_at,
               -- A later answer must not erase a revision already recorded.
               revision = COALESCE(excluded.revision, checkpoints.revision),
               revised_at = COALESCE(excluded.revised_at, checkpoints.revised_at)",
            params![
                checkpoint.id,
                checkpoint.document_id,
                checkpoint.claim_id,
                checkpoint.reference_id,
                checkpoint.dimension,
                checkpoint.question,
                checkpoint.student_rationale,
                checkpoint.evidence_excerpt,
                checkpoint.answered_at,
                checkpoint.revision,
                checkpoint.revised_at,
            ],
        )?;
        Ok(())
    }

    pub fn save_evaluation(&mut self, evaluation: &EvaluationRecord) -> CoreResult<()> {
        // One evaluation per checkpoint: a re-answered question replaces it.
        self.conn.execute(
            "DELETE FROM evaluations WHERE checkpoint_id = ?1 AND id <> ?2",
            params![evaluation.checkpoint_id, evaluation.id],
        )?;
        self.conn.execute(
            "INSERT INTO evaluations (id, checkpoint_id, document_id, ai_insight, ai_expected_evidence, student_summary, alignment, similarity, gaps_json, authenticity, relevance, depth, overall, model, generated_by, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
             ON CONFLICT(id) DO UPDATE SET
               ai_insight = excluded.ai_insight,
               ai_expected_evidence = excluded.ai_expected_evidence,
               student_summary = excluded.student_summary,
               alignment = excluded.alignment,
               similarity = excluded.similarity,
               gaps_json = excluded.gaps_json,
               authenticity = excluded.authenticity,
               relevance = excluded.relevance,
               depth = excluded.depth,
               overall = excluded.overall,
               model = excluded.model,
               generated_by = excluded.generated_by,
               created_at = excluded.created_at",
            params![
                evaluation.id,
                evaluation.checkpoint_id,
                evaluation.document_id,
                evaluation.ai_insight,
                evaluation.ai_expected_evidence,
                evaluation.student_summary,
                evaluation.alignment,
                evaluation.similarity,
                evaluation.gaps_json,
                evaluation.authenticity,
                evaluation.relevance,
                evaluation.depth,
                evaluation.overall,
                evaluation.model,
                evaluation.generated_by,
                evaluation.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_documents(&self) -> CoreResult<Vec<DocumentSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT d.id, d.title, d.file_name, d.created_at,
                    (SELECT COUNT(*) FROM claims c WHERE c.document_id = d.id),
                    (SELECT COUNT(*) FROM checkpoints k WHERE k.document_id = d.id)
             FROM documents d
             ORDER BY d.created_at DESC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DocumentSummary {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    file_name: row.get(2)?,
                    created_at: row.get(3)?,
                    claim_count: row.get(4)?,
                    answered_count: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn load_trace(&self, document_id: &str) -> CoreResult<Option<StoredTrace>> {
        let document = self
            .conn
            .query_row(
                "SELECT id, file_name, title, thesis, executive_summary, page_count, word_count, created_at
                 FROM documents WHERE id = ?1",
                params![document_id],
                |row| {
                    Ok(DocumentRecord {
                        id: row.get(0)?,
                        file_name: row.get(1)?,
                        title: row.get(2)?,
                        thesis: row.get(3)?,
                        executive_summary: row.get(4)?,
                        page_count: row.get(5)?,
                        word_count: row.get(6)?,
                        created_at: row.get(7)?,
                        claims: Vec::new(),
                        references: Vec::new(),
                    })
                },
            )
            .optional()?;

        let Some(mut document) = document else {
            return Ok(None);
        };

        let mut claim_stmt = self.conn.prepare(
            "SELECT id, text, page, section, citation_markers FROM claims WHERE document_id = ?1",
        )?;
        document.claims = claim_stmt
            .query_map(params![document_id], |row| {
                let markers: String = row.get(4)?;
                Ok(ClaimRecord {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    page: row.get(2)?,
                    section: row.get(3)?,
                    citation_markers: serde_json::from_str(&markers).unwrap_or_default(),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut ref_stmt = self.conn.prepare(
            "SELECT id, marker, raw, doi, title, year, authenticity_json FROM refs WHERE document_id = ?1",
        )?;
        document.references = ref_stmt
            .query_map(params![document_id], |row| {
                Ok(ReferenceRecord {
                    id: row.get(0)?,
                    marker: row.get(1)?,
                    raw: row.get(2)?,
                    doi: row.get(3)?,
                    title: row.get(4)?,
                    year: row.get(5)?,
                    authenticity_json: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut checkpoint_stmt = self.conn.prepare(
            "SELECT id, document_id, claim_id, reference_id, dimension, question, student_rationale, evidence_excerpt, answered_at, revision, revised_at
             FROM checkpoints WHERE document_id = ?1 ORDER BY answered_at",
        )?;
        let checkpoints = checkpoint_stmt
            .query_map(params![document_id], |row| {
                Ok(CheckpointRecord {
                    id: row.get(0)?,
                    document_id: row.get(1)?,
                    claim_id: row.get(2)?,
                    reference_id: row.get(3)?,
                    dimension: row.get(4)?,
                    question: row.get(5)?,
                    student_rationale: row.get(6)?,
                    evidence_excerpt: row.get(7)?,
                    answered_at: row.get(8)?,
                    revision: row.get(9)?,
                    revised_at: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut evaluation_stmt = self.conn.prepare(
            "SELECT id, checkpoint_id, document_id, ai_insight, ai_expected_evidence, student_summary, alignment, similarity, gaps_json, authenticity, relevance, depth, overall, model, generated_by, created_at
             FROM evaluations WHERE document_id = ?1 ORDER BY created_at",
        )?;
        let evaluations = evaluation_stmt
            .query_map(params![document_id], |row| {
                Ok(EvaluationRecord {
                    id: row.get(0)?,
                    checkpoint_id: row.get(1)?,
                    document_id: row.get(2)?,
                    ai_insight: row.get(3)?,
                    ai_expected_evidence: row.get(4)?,
                    student_summary: row.get(5)?,
                    alignment: row.get(6)?,
                    similarity: row.get(7)?,
                    gaps_json: row.get(8)?,
                    authenticity: row.get(9)?,
                    relevance: row.get(10)?,
                    depth: row.get(11)?,
                    overall: row.get(12)?,
                    model: row.get(13)?,
                    generated_by: row.get(14)?,
                    created_at: row.get(15)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(Some(StoredTrace {
            document,
            checkpoints,
            evaluations,
        }))
    }

    pub fn delete_document(&mut self, document_id: &str) -> CoreResult<()> {
        let tx = self.conn.transaction()?;
        tx.execute("DELETE FROM evaluations WHERE document_id = ?1", params![document_id])?;
        tx.execute("DELETE FROM checkpoints WHERE document_id = ?1", params![document_id])?;
        tx.execute("DELETE FROM claims WHERE document_id = ?1", params![document_id])?;
        tx.execute("DELETE FROM refs WHERE document_id = ?1", params![document_id])?;
        tx.execute("DELETE FROM documents WHERE id = ?1", params![document_id])?;
        tx.commit()?;
        Ok(())
    }
}
