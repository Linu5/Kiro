// Ollama integration against the REAL locally installed llama3, end-to-end in
// the packaged app: status, generation, question planning, dual-reasoning.
//
// Selector notes, learned from the live DOM rather than assumed:
//  - Textareas exist only in the Socratic Checkpoint view. On Document Overview
//    `main textarea` returns an empty list, so positional access (`areas[0]`)
//    throws a TypeError that hides the real problem.
//  - Textareas are identified by placeholder / aria-label, never by index: a
//    third one (the revision box) appears after an evaluation exists.
//  - `input[type=file]` disappears once a report is loaded.
//  - A disabled button silently swallows `.click()`, so clicks poll for enabled.
//  - The findings panel re-renders and shifts button indices, so buttons are
//    found by text inside a single page evaluation.
import puppeteer from "puppeteer-core";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { pass: 0, fail: 0 };
const line = (label, ok, detail = "") => {
  results[ok ? "pass" : "fail"] += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` :: ${detail}` : ""}`);
};

const version = await (await fetch("http://localhost:9222/json/version")).json();
// Real generation on an 8B model outruns puppeteer's default protocol timeout.
const browser = await puppeteer.connect({
  browserWSEndpoint: version.webSocketDebuggerUrl,
  protocolTimeout: 0,
});
const app = (await browser.pages()).find((p) => !p.url().startsWith("devtools"));
if (!app) throw new Error("no application page on the devtools endpoint");

const errors = [];
app.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
app.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

// --- diagnostics -----------------------------------------------------------
const snapshot = () =>
  app.evaluate(() => ({
    view: document.querySelector("nav[aria-label='Main'] [aria-current='page']")?.textContent?.slice(0, 30) ?? null,
    header: document.querySelector("header p")?.textContent?.slice(0, 80) ?? null,
    banner: document.querySelector("[role='status']")?.textContent?.replace(/\s+/g, " ").slice(0, 120) ?? null,
    busy: /Verifying |Preparing Socratic|Comparing your reasoning|Parsing /.exec(document.body.textContent ?? "")?.[0] ?? null,
    textareas: [...document.querySelectorAll("main textarea")].map((t) =>
      ((t.getAttribute("aria-label") || t.placeholder) ?? "").slice(0, 40),
    ),
    buttons: [...document.querySelectorAll("main button")]
      .map((b) => `${(b.textContent ?? "").trim().slice(0, 24)}${b.disabled ? " [disabled]" : ""}`)
      .slice(0, 10),
  }));

class HarnessError extends Error {}

async function fatal(message) {
  const state = await snapshot().catch(() => null);
  throw new HarnessError(`${message}\n  app state: ${JSON.stringify(state)}`);
}

// --- interaction helpers ---------------------------------------------------

/** Click a button by its text, waiting until it exists and is enabled. */
async function clickByText(text, timeoutMs = 240000) {
  const deadline = Date.now() + timeoutMs;
  let last = "absent";
  for (;;) {
    last = await app.evaluate((needle) => {
      const button = [...document.querySelectorAll("main button")].find((b) =>
        (b.textContent ?? "").includes(needle),
      );
      if (!button) return "absent";
      if (button.disabled) return "disabled";
      button.click();
      return "clicked";
    }, text);
    if (last === "clicked") return;
    if (Date.now() > deadline) await fatal(`button "${text}" never became clickable (last state: ${last})`);
    await wait(1000);
  }
}

/**
 * Poll `main` for text. Explicit polling because raf-based `waitForFunction`
 * does not settle reliably while the model occupies the event loop and
 * `protocolTimeout` is disabled.
 */
async function pollForText(needle, timeoutMs, selector = "main") {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await app.$eval(selector, (el) => el.textContent ?? "").catch(() => "");
    if (text.includes(needle)) return true;
    await wait(1000);
  }
  return false;
}

/** Resolve a textarea by placeholder or aria-label substring, never by index. */
async function textareaBy(match, label, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const handles = await app.$$("main textarea");
    for (const handle of handles) {
      const key = await handle.evaluate((el) => `${el.getAttribute("aria-label") ?? ""}||${el.placeholder ?? ""}`);
      if (key.toLowerCase().includes(match.toLowerCase())) return handle;
    }
    if (Date.now() > deadline) await fatal(`textarea for ${label} (match "${match}") not found`);
    await wait(500);
  }
}

async function typeInto(match, label, text) {
  const handle = await textareaBy(match, label);
  await handle.click();
  await handle.type(text);
}

/** The question prompt, found by shape rather than by a Tailwind class. */
const firstQuestionText = () =>
  app.evaluate(
    () =>
      [...document.querySelectorAll("main p")]
        .map((p) => (p.textContent ?? "").trim())
        .find((t) => t.length > 20 && t.endsWith("?")) ?? "",
  );

async function run() {
  await app.reload({ waitUntil: "networkidle2" });
  await app.waitForSelector("nav[aria-label='Main']", { timeout: 20000 });
  await wait(2000);

  // --- Ollama reachable through the Rust bridge ---------------------------
  const status = await app.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke("llm_status", { baseUrl: "http://127.0.0.1:11434" }),
  );
  line("llm_status reports the real daemon reachable", status?.reachable === true, `models: ${(status?.models ?? []).join(", ")}`);
  line("llama3 present in the model list", (status?.models ?? []).some((m) => m.startsWith("llama3")));

  const started = Date.now();
  const gen = await app.evaluate(async () => {
    try {
      return await window.__TAURI_INTERNALS__.invoke("llm_generate", {
        request: {
          baseUrl: "http://127.0.0.1:11434",
          model: "llama3",
          system: "You answer only with JSON.",
          prompt: 'Return JSON of the form {"ok":true} and nothing else.',
          json: true,
          temperature: 0,
        },
      });
    } catch (error) {
      return { error: String(error) };
    }
  });
  line(
    "llm_generate returns real model output through the Rust bridge",
    typeof gen?.text === "string" && /\{/.test(gen.text),
    gen?.error ?? `model=${gen.model} elapsed=${gen.elapsedMs}ms wall=${Date.now() - started}ms text=${(gen.text ?? "").replace(/\s+/g, " ").slice(0, 50)}`,
  );

  // --- ingest -------------------------------------------------------------
  // The upload zone is only mounted when no report is loaded; a reload clears
  // in-memory state, so assert rather than dereference a null handle.
  const fileInput = await app.$('input[type="file"]');
  if (!fileInput) await fatal("no file input: a report is still loaded after reload");
  await fileInput.uploadFile("tmp/fixture.txt");

  // The reference count is reported in the header, not in `main`.
  const parsed = await pollForText("references", 60000, "header");
  if (!parsed) await fatal("parsing did not complete");
  line("report parsed on device", parsed, (await snapshot()).header ?? "");

  // Verification is network-bound; wait for the busy bar to clear rather than
  // counting badges, because "Not checked" renders before verification starts.
  const deadline = Date.now() + 300000;
  for (;;) {
    const { busy } = await snapshot();
    if (!busy) break;
    if (Date.now() > deadline) await fatal(`verification never settled (busy: ${busy})`);
    await wait(1000);
  }

  // --- question planning against the real model ---------------------------
  const planStart = Date.now();
  await clickByText("Start checkpoint");
  const rendered = await pollForText("Question 1 of", 600000);
  const planMs = Date.now() - planStart;
  line("questions rendered after planning", rendered, `${(planMs / 1000).toFixed(1)}s`);
  if (!rendered) await fatal("checkpoint questions never rendered");

  // Provenance on the card describes only the *active* question, and question 1
  // is legitimately a finding-derived prompt. The planning notice reports it for
  // the whole set, so assert there.
  const notice = await app.evaluate(
    () => document.querySelector("[role='status']")?.textContent?.replace(/\s+/g, " ") ?? "",
  );
  line(
    "planning notice reports questions generated by the local model",
    /generated by the local model/.test(notice),
    notice.slice(0, 130),
  );
  const cardProvenance = await app.$eval("main", (el) => el.textContent ?? "");
  line(
    "active question declares its provenance",
    /local model|built-in bank/.test(cardProvenance),
    (/local model|built-in bank/.exec(cardProvenance) ?? [""])[0],
  );
  const prompt = await firstQuestionText();
  line("first question is a real question ending in '?'", prompt.length > 20 && prompt.endsWith("?"), prompt.slice(0, 110));
  line("question does not answer itself", !/^the (paper|source|study) (shows|states|reports)/i.test(prompt));

  // --- dual reasoning against the real model ------------------------------
  await typeInto(
    "Highlight the passage",
    "evidence excerpt",
    "Infrared signatures preceded measurable power loss in 34 of 40 cracked cells under controlled illumination.",
  );
  await typeInto(
    "In your own words",
    "student rationale",
    "The authors measured an eleven day lead time between the thermal signature appearing and measurable power loss, which is why I cite it for detection timing rather than yield impact, although the controlled rig is not a tropical rooftop so I do not extend it to all installations.",
  );
  line("evidence and rationale entered by matched selector", true);

  const evalStart = Date.now();
  await clickByText("Submit for comparison");
  const compared = await pollForText("Reasoning comparison", 600000);
  const evalMs = Date.now() - evalStart;
  line("comparison rendered", compared, `${(evalMs / 1000).toFixed(1)}s`);
  if (!compared) await fatal("dual-reasoning comparison never rendered");

  const comparison = await app.$eval("main", (el) => el.textContent?.replace(/\s+/g, " ") ?? "");
  line("alignment verdict produced", /Aligned|Surface-level|Misaligned/.test(comparison), (/Aligned|Surface-level|Misaligned/.exec(comparison) ?? [""])[0]);
  line("evaluation attributed to the real model", /llama3/.test(comparison), (/llama3[^ ]*/.exec(comparison) ?? [""])[0]);

  // The revision box only exists once an evaluation exists - proof the third
  // textarea is not positional.
  const revisionHandle = await textareaBy("What change did you make", "revision", 30000);
  line("revision question rendered after the comparison", Boolean(revisionHandle));

  const stored = await app.evaluate(async () => {
    const docs = await window.__TAURI_INTERNALS__.invoke("list_documents");
    if (!docs?.length) return [];
    const trace = await window.__TAURI_INTERNALS__.invoke("load_trace", { documentId: docs[0].id });
    return (trace?.evaluations ?? []).map((e) => ({
      by: e.generatedBy,
      model: e.model,
      alignment: e.alignment,
      insight: (e.aiInsight ?? "").slice(0, 80),
    }));
  });
  line("trace records local-llm provenance", stored.some((e) => e.by === "local-llm"), JSON.stringify(stored[0] ?? {}).slice(0, 170));
  line(
    "model insight is substantive, not the heuristic fallback",
    (stored[0]?.insight ?? "").length > 40 && !(stored[0]?.insight ?? "").startsWith("Local analysis (no model)"),
  );

  line("no console or page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
}

try {
  await run();
} catch (error) {
  if (error instanceof HarnessError) {
    results.fail += 1;
    console.log(`FAIL  harness aborted :: ${error.message}`);
  } else {
    throw error;
  }
} finally {
  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  await browser.disconnect();
  process.exitCode = results.fail === 0 ? 0 : 1;
}
