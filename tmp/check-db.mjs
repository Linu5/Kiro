import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const path = join(process.env.APPDATA, "sg.edu.sit.socratic-citation-coach", "traces.sqlite");
const db = new DatabaseSync(path, { readOnly: true });
const columns = db.prepare("SELECT name FROM pragma_table_info('checkpoints')").all().map((r) => r.name);
const legacy = db.prepare("SELECT id, student_rationale, revision FROM checkpoints WHERE id = 'q_legacy'").get();
const docs = db.prepare("SELECT id, title FROM documents").all();
db.close();

const line = (label, ok, detail = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` :: ${detail}` : ""}`);
line("migration added the revision column", columns.includes("revision"), columns.join(", "));
line("migration added the revised_at column", columns.includes("revised_at"));
line("legacy checkpoint row preserved", legacy?.student_rationale === "Legacy rationale.", JSON.stringify(legacy ?? null));
line("legacy revision is NULL, not a crash", legacy?.revision === null || legacy?.revision === undefined);
line("legacy document preserved", docs.some((d) => d.id === "doc_legacy"), `${docs.length} documents`);
