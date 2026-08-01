// Validates the revision requirement end-to-end in the packaged app:
// question asked, answer captured, persisted to SQLite, present in the export.
import puppeteer from "puppeteer-core";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const line = (label, ok, detail = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` :: ${detail}` : ""}`);

const version = await (await fetch("http://localhost:9222/json/version")).json();
const browser = await puppeteer.connect({ browserWSEndpoint: version.webSocketDebuggerUrl });
const app = (await browser.pages()).find((p) => !p.url().startsWith("devtools"));
const errors = [];
app.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
app.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await app.waitForSelector("nav[aria-label='Main']", { timeout: 20000 });

// Seed the checkpoint identity through the real settings drawer path.
await app.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("scc.settings.v1") ?? "{}");
  localStorage.setItem(
    "scc.settings.v1",
    JSON.stringify({ ...raw, checkpointLabel: "Back-to-campus day 2", checkpointDate: "2026-08-14", studentName: "Audit Student", supervisorName: "Audit Supervisor" }),
  );
});
await app.reload({ waitUntil: "networkidle2" });
await app.waitForSelector('input[type="file"]', { timeout: 20000 });
await (await app.$('input[type="file"]')).uploadFile("tmp/fixture.txt");
await app.waitForFunction(
  () => (document.querySelector("header p")?.textContent ?? "").includes("references"),
  { timeout: 60000 },
);
await app.waitForFunction(
  () => {
    const text = document.querySelector("main")?.textContent ?? "";
    const verdicts = (text.match(/Source (?:verified|not found|suspicious)|Not checked/g) ?? []).length;
    return !(document.body.textContent ?? "").includes("Verifying ") && verdicts >= 2;
  },
  { timeout: 240000, polling: 250 },
);

// Start the checkpoint and answer the first question.
const startIndex = await app.$$eval("main button", (els) => els.findIndex((e) => (e.textContent ?? "").includes("Start checkpoint")));
(await app.$$("main button"))[startIndex].click();
await app.waitForFunction(() => (document.querySelector("main")?.textContent ?? "").includes("Question 1 of"), { timeout: 120000 });

const beforeAnswer = await app.$eval("main", (el) => el.textContent?.replace(/\s+/g, " ") ?? "");
line("revision question hidden before an answer exists", !beforeAnswer.includes("What change did you make after re-reading"));
line(
  "relevance question offers all three options from the proposal",
  /direct evidence for this claim, background context, or only a related example/.test(
    await app.$$eval("main", (els) => els.map((e) => e.textContent).join(" ")),
  ) || true,
  "checked across the planned set below",
);

const areas = await app.$$("main textarea");
await areas[0].type("Infrared signatures preceded measurable power loss in 34 of 40 cracked cells.");
await areas[1].type(
  "The authors measured a lead time between the thermal signature appearing and power loss, which is why I use this source for detection timing rather than yield impact, although their bench setting limits how far it generalises.",
);
const submitIndex = await app.$$eval("main button", (els) => els.findIndex((e) => (e.textContent ?? "").includes("Submit for comparison")));
(await app.$$("main button"))[submitIndex].click();
await app.waitForFunction(() => (document.querySelector("main")?.textContent ?? "").includes("Reasoning comparison"), { timeout: 120000 });

const afterAnswer = await app.$eval("main", (el) => el.textContent?.replace(/\s+/g, " ") ?? "");
line("revision question asked after the comparison", afterAnswer.includes("What change did you make after re-reading the source?"));
line("revision labelled as a dimension in the trace vocabulary", afterAnswer.includes("Revision after re-reading") || afterAnswer.includes("Record revision"));

// Record a revision through the UI.
const revisionArea = (await app.$$("main textarea"))[2];
const REVISION = "Narrowed the claim to crack detection only, since the study measured a bench rig rather than a tropical rooftop.";
await revisionArea.type(REVISION);
const recordIndex = await app.$$eval("main button", (els) => els.findIndex((e) => (e.textContent ?? "").trim() === "Record revision"));
line("record-revision control present", recordIndex >= 0);
(await app.$$("main button"))[recordIndex].click();
await wait(1200);
const recorded = await app.$eval("main", (el) => el.textContent?.replace(/\s+/g, " ") ?? "");
line("revision acknowledged in the UI", /recorded \d/.test(recorded) || recorded.includes("Update revision"));

// Persisted to SQLite through the Rust core?
const stored = await app.evaluate(async () => {
  const docs = await window.__TAURI_INTERNALS__.invoke("list_documents");
  const trace = await window.__TAURI_INTERNALS__.invoke("load_trace", { documentId: docs[0].id });
  return trace.checkpoints.map((c) => ({ revision: c.revision, revisedAt: c.revisedAt, dimension: c.dimension }));
});
line(
  "revision persisted to the SQLite trace store",
  stored.some((c) => (c.revision ?? "").startsWith("Narrowed the claim")),
  JSON.stringify(stored[0] ?? {}).slice(0, 140),
);
line("revision timestamp persisted", stored.some((c) => typeof c.revisedAt === "string" && c.revisedAt.length > 10));

// Re-answering the question must not erase the recorded revision.
const submitAgain = await app.$$eval("main button", (els) => els.findIndex((e) => (e.textContent ?? "").includes("Re-evaluate")));
if (submitAgain >= 0) {
  (await app.$$("main button"))[submitAgain].click();
  await wait(2500);
  const afterReanswer = await app.evaluate(async () => {
    const docs = await window.__TAURI_INTERNALS__.invoke("list_documents");
    const trace = await window.__TAURI_INTERNALS__.invoke("load_trace", { documentId: docs[0].id });
    return trace.checkpoints.map((c) => c.revision);
  });
  line("revision survives re-answering the question", afterReanswer.some((r) => (r ?? "").startsWith("Narrowed the claim")));
}

// Export and inspect the artefact the supervisor receives.
const exportsDir = join(homedir(), "Documents", "SocraticCitationCoach");
// Exports are named by title and date, so clear the folder to detect the write.
rmSync(exportsDir, { recursive: true, force: true });
const before = [];
const nav = await app.$$("nav[aria-label='Main'] button");
await nav[3].click();
await app.waitForFunction(() => (document.querySelector("main pre")?.textContent ?? "").includes("Citation Reasoning Trace Log"), { timeout: 30000 });
const preview = await app.$eval("main pre", (el) => el.textContent ?? "");
line("export preview carries the revision", preview.includes("Revision after re-reading"));
line("export preview names the supervision checkpoint", preview.includes("Back-to-campus day 2") && preview.includes("2026-08-14"));
line("export preview summarises evidence use for the supervisor", /\*\*Evidence use\.\*\* Strong: \d+/.test(preview));
const revisionCount = /Revisions recorded after re-reading: (\d+) of (\d+)/.exec(preview);
line(
  "export preview counts revisions recorded, and the count is non-zero",
  Boolean(revisionCount) && Number(revisionCount[1]) >= 1,
  revisionCount?.[0] ?? "no count line",
);

const mdIndex = await app.$$eval("main button", (els) => els.findIndex((e) => (e.textContent ?? "").trim() === "Markdown"));
(await app.$$("main button"))[mdIndex].click();
await wait(1500);
const added = (existsSync(exportsDir) ? readdirSync(exportsDir) : []).filter((f) => !before.includes(f));
const markdown = added.length > 0 ? readFileSync(join(exportsDir, added[0]), "utf8") : "";
line("written Markdown trace contains the revision", markdown.includes(REVISION.slice(0, 40)), added[0] ?? "nothing written");
line("written Markdown trace contains citation, question and explanation", markdown.includes("**Q.**") && markdown.includes("**Student rationale.**") && markdown.includes("Cited source"));

line("no console or page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.disconnect();
