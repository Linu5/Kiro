// Runs the blind test document through the packaged application's own workflow
// and dumps exactly what the application produced. No detection logic touched.
import puppeteer from "puppeteer-core";
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DOC = "test_cases/test_cases/blind_test_fall_detection.docx";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(m);

const version = await (await fetch("http://localhost:9222/json/version")).json();
const browser = await puppeteer.connect({
  browserWSEndpoint: version.webSocketDebuggerUrl,
  protocolTimeout: 0,
});
const app = (await browser.pages()).find((p) => !p.url().startsWith("devtools"));
const errors = [];
app.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
app.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const out = { document: DOC, webview: version.Browser, errors: [] };

// --- baseline configuration, recorded so the run is reproducible -----------
const CONFIG = {
  llmBaseUrl: "http://127.0.0.1:11434",
  llmModel: "llama3",
  metadataEnabled: true,
  checkpointBudget: 8,
  studentName: "",
  supervisorName: "",
  projectTitle: "",
  checkpointLabel: "Blind benchmark 04_fall_detection",
  checkpointDate: new Date().toISOString().slice(0, 10),
};
await app.evaluate((cfg) => localStorage.setItem("scc.settings.v1", JSON.stringify(cfg)), CONFIG);
out.config = CONFIG;

// Clear stored traces and exports so this run's artefacts are unambiguous.
await app.evaluate(async () => {
  const docs = await window.__TAURI_INTERNALS__.invoke("list_documents");
  for (const d of docs) await window.__TAURI_INTERNALS__.invoke("delete_document", { documentId: d.id });
});
const exportsDir = join(homedir(), "Documents", "SocraticCitationCoach");
rmSync(exportsDir, { recursive: true, force: true });

await app.reload({ waitUntil: "networkidle2" });
await app.waitForSelector("nav[aria-label='Main']", { timeout: 20000 });
await wait(1500);

out.llmStatus = await app.evaluate(() =>
  window.__TAURI_INTERNALS__.invoke("llm_status", { baseUrl: "http://127.0.0.1:11434" }),
);
log(`llm status: ${JSON.stringify(out.llmStatus)}`);

// --- S1 ingest -------------------------------------------------------------
const fileInput = await app.$('input[type="file"]');
if (!fileInput) throw new Error("no file input: app not in a clean state");
const t0 = Date.now();
await fileInput.uploadFile(DOC);

const pollUntil = async (fn, timeoutMs, label) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await wait(500);
  }
  throw new Error(`timed out waiting for ${label}`);
};

await pollUntil(
  async () => (await app.$eval("header", (el) => el.textContent ?? "")).includes("references"),
  120000,
  "parse",
);
const parseMs = Date.now() - t0;
out.header = await app.$eval("header", (el) => el.textContent?.replace(/\s+/g, " ").trim() ?? "");

// --- S3 verification (live registries) ------------------------------------
const t1 = Date.now();
await pollUntil(
  async () =>
    !(await app.evaluate(() => /Verifying |Parsing |Preparing Socratic/.test(document.body.textContent ?? ""))),
  600000,
  "verification",
);
const verifyMs = Date.now() - t1;
out.timings = { parseMs, verifyMs };
log(`parse ${parseMs}ms, verification ${verifyMs}ms`);

// --- overview: parse summary, reference verdicts, findings -----------------
out.parseSummary = await app.evaluate(() =>
  [...document.querySelectorAll("main dl div")].map((d) => ({
    label: d.querySelector("dt")?.textContent?.trim() ?? "",
    value: d.querySelector("dd")?.textContent?.trim() ?? "",
  })),
);

out.references = await app.evaluate(() => {
  const list = [...document.querySelectorAll("main ul li")].filter((li) =>
    /Source (verified|not found|suspicious)|Not checked/.test(li.textContent ?? ""),
  );
  return list.map((li) => {
    const pills = [...li.querySelectorAll("span")].map((s) => s.textContent?.trim() ?? "");
    const paragraphs = [...li.querySelectorAll("p")].map((p) => p.textContent?.trim() ?? "");
    return {
      marker: pills[0] ?? "",
      verdict: pills.find((p) => /Source (verified|not found|suspicious)|Not checked/.test(p)) ?? "",
      registries: pills.find((p) => /crossref|openalex/.test(p)) ?? "",
      modePills: pills.filter((p) =>
        /reference|metadata|locator|venue|source|citation|date|version|Duplicate|Orphan|Phantom|link|Fabricated|Identifier/i.test(p),
      ),
      title: paragraphs[0] ?? "",
      meta: paragraphs[1] ?? "",
      flags: paragraphs.slice(2),
    };
  });
});

out.findingsFromUi = await app.evaluate(() => {
  const items = [...document.querySelectorAll("main li")].filter((li) =>
    /^(Critical|Major|Moderate|Advisory)/.test((li.textContent ?? "").trim()),
  );
  return items.map((li) => {
    const pills = [...li.querySelectorAll("span")].map((s) => s.textContent?.trim() ?? "").filter(Boolean);
    const paragraphs = [...li.querySelectorAll("p")].map((p) => p.textContent?.replace(/\s+/g, " ").trim() ?? "");
    return {
      severity: pills[0] ?? "",
      mode: pills[1] ?? "",
      markers: pills.slice(2).filter((p) => /^\[/.test(p)),
      needsEvidence: pills.includes("needs your evidence"),
      summary: paragraphs[0] ?? "",
      detail: paragraphs[1] ?? "",
      question: paragraphs.find((p) => p.endsWith("?")) ?? "",
      guardNote: paragraphs[paragraphs.length - 1] ?? "",
    };
  });
});
log(`findings in UI: ${out.findingsFromUi.length}`);

out.findingsFilterCounts = await app.evaluate(() =>
  [...document.querySelectorAll("main button")]
    .map((b) => (b.textContent ?? "").trim())
    .filter((t) => /^(All|What the citation asserts|What the source is|How the source serves|Document and list)/.test(t)),
);

// --- S4 checkpoint (real model) -------------------------------------------
const t2 = Date.now();
const clicked = await app.evaluate(() => {
  const b = [...document.querySelectorAll("main button")].find((x) =>
    (x.textContent ?? "").includes("Start checkpoint"),
  );
  if (!b || b.disabled) return false;
  b.click();
  return true;
});
if (!clicked) throw new Error("start-checkpoint button not clickable");
await pollUntil(
  async () => (await app.$eval("main", (el) => el.textContent ?? "")).includes("Question 1 of"),
  900000,
  "question planning",
);
out.timings.planMs = Date.now() - t2;
out.checkpointNotice = await app.evaluate(
  () => document.querySelector("[role='status']")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
);
out.firstQuestion = await app.evaluate(() => {
  const p = [...document.querySelectorAll("main p")].map((x) => (x.textContent ?? "").trim());
  return {
    dimension: p.find((t) => /Evidence grounding|Direct relevance|Source limitations|Selection rationale|Synthesis/.test(t)) ?? "",
    prompt: p.find((t) => t.length > 20 && t.endsWith("?")) ?? "",
    counter: [...document.querySelectorAll("main span")].map((s) => s.textContent ?? "").find((t) => /Question \d+ of \d+/.test(t)) ?? "",
  };
});
log(`planning ${out.timings.planMs}ms; ${out.checkpointNotice}`);

// --- S5 export (the application's canonical serialisation) ----------------
await app.evaluate(() => {
  const nav = [...document.querySelectorAll("nav[aria-label='Main'] button")];
  nav[3]?.click();
});
await pollUntil(
  async () => (await app.$eval("main", (el) => el.textContent ?? "")).includes("Citation Reasoning Trace Log"),
  60000,
  "audit view",
);
await app.evaluate(() => {
  const b = [...document.querySelectorAll("main button")].find((x) => (x.textContent ?? "").trim() === "Markdown");
  b?.click();
});
await wait(2500);
const written = existsSync(exportsDir) ? readdirSync(exportsDir) : [];
out.exportFiles = written;
if (written.length > 0) {
  copyFileSync(join(exportsDir, written[0]), "tmp/blind-export.md");
  out.exportChars = readFileSync("tmp/blind-export.md", "utf8").length;
}

out.errors = errors;
writeFileSync("tmp/blind-output.json", JSON.stringify(out, null, 2), "utf8");
log(`\nexport: ${written.join(", ")} (${out.exportChars ?? 0} chars) | console errors: ${errors.length}`);
await browser.disconnect();
