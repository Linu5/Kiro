// Verifies the four changes end-to-end against the packaged app:
//   1. recency-aware citation scoring (citationSignal / citationsPerYear)
//   2. OA fields parsed from OpenAlex and surfaced per reference
//   3. citation-count guard line present
//   4. SettingsDrawer fade/slide instead of a snap
//   5. staged progress captions during question planning
import puppeteer from "puppeteer-core";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";

const DOC = "test_cases/test_cases/blind_test_fall_detection.docx";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(m);

// Another process on this machine also listens on 9222 (IPv4), while WebView2
// binds IPv6, so the endpoint has to be resolved rather than assumed.
const endpoint = await (async () => {
  for (const host of ["[::1]", "127.0.0.1"]) {
    try {
      const probe = await (await fetch(`http://${host}:9222/json/version`)).json();
      if (String(probe.Browser ?? "").includes("Edg")) return { host, probe };
    } catch {
      /* try the next family */
    }
  }
  throw new Error("no WebView2 DevTools endpoint on 9222");
})();
const version = endpoint.probe;
const targets = await (await fetch(`http://${endpoint.host}:9222/json/list`)).json();
if (!targets.some((t) => /tauri\.localhost|^http:\/\/localhost\/|asset/.test(t.url))) {
  log(`warning: app targets are ${targets.map((t) => t.url).join(", ")}`);
}
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

const out = { webview: version.Browser, document: DOC };

await app.evaluate((cfg) => localStorage.setItem("scc.settings.v1", JSON.stringify(cfg)), {
  llmBaseUrl: "http://127.0.0.1:11434",
  llmModel: "llama3",
  metadataEnabled: true,
  checkpointBudget: 8,
  studentName: "",
  supervisorName: "",
  projectTitle: "",
  checkpointLabel: "Improvement verification",
  checkpointDate: new Date().toISOString().slice(0, 10),
});
await app.evaluate(async () => {
  const docs = await window.__TAURI_INTERNALS__.invoke("list_documents");
  for (const d of docs) await window.__TAURI_INTERNALS__.invoke("delete_document", { documentId: d.id });
});
await app.reload({ waitUntil: "networkidle2" });
await app.waitForSelector("nav[aria-label='Main']", { timeout: 20000 });
await wait(1200);

const pollUntil = async (fn, timeoutMs, label) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await wait(400);
  }
  throw new Error(`timed out waiting for ${label}`);
};

// --- 4. drawer transition, measured before any document is loaded ----------
const drawerSample = async () =>
  app.evaluate(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return null;
    const aside = dialog.querySelector("aside");
    const style = getComputedStyle(dialog);
    const asideStyle = aside ? getComputedStyle(aside) : null;
    return {
      overlayOpacity: Number(style.opacity),
      overlayTransition: style.transitionProperty + " " + style.transitionDuration,
      panelTransform: asideStyle?.transform ?? "",
      panelTransition: asideStyle ? asideStyle.transitionProperty + " " + asideStyle.transitionDuration : "",
    };
  });

out.drawer = { beforeOpen: await drawerSample(), frames: [] };
await app.evaluate(() => {
  const b = [...document.querySelectorAll("header button, nav button")].find((x) =>
    (x.getAttribute("title") ?? x.getAttribute("aria-label") ?? x.textContent ?? "").match(/settings/i),
  );
  b?.click();
});
for (let i = 0; i < 6; i++) {
  out.drawer.frames.push({ atMs: i * 60, ...(await drawerSample()) });
  await wait(60);
}
await wait(400);
out.drawer.settled = await drawerSample();
// close: the drawer must survive `open=false` long enough to slide out
await app.evaluate(() => document.querySelector("[aria-label='Close settings']")?.click());
await wait(60);
out.drawer.duringClose = await drawerSample();
await wait(500);
out.drawer.afterClose = await drawerSample();
log(`drawer: settled ${JSON.stringify(out.drawer.settled)} | duringClose ${JSON.stringify(out.drawer.duringClose)} | afterClose ${out.drawer.afterClose}`);

// --- ingest + verification -------------------------------------------------
const fileInput = await app.$('input[type="file"]');
if (!fileInput) throw new Error("no file input: app not in a clean state");
await fileInput.uploadFile(DOC);
await pollUntil(
  async () => (await app.$eval("header", (el) => el.textContent ?? "")).includes("references"),
  120000,
  "parse",
);
await pollUntil(
  async () =>
    !(await app.evaluate(() => /Verifying |Parsing |Planning questions|Assembling/.test(document.body.textContent ?? ""))),
  600000,
  "verification",
);

// --- 1+2+3. registry strip per reference, straight from the raw verdicts ---
// Straight through the Rust command, so the scoring path itself is exercised:
// an old heavily cited work, a 2025 paper inside the lag window, and a mid-age
// one, plus a deliberately fabricated DOI.
out.verdicts = await app.evaluate(async () => {
  const queries = [
    { doi: "10.1038/nature14539", title: "Deep learning", year: 2015 },
    { doi: "10.1016/j.measen.2025.101870", year: 2025 },
    { doi: "10.1109/ACCESS.2019.2902718", year: 2019 },
    { doi: "10.9999/jaus.2021.04117", year: 2021 },
  ];
  const results = [];
  for (const query of queries) {
    try {
      const verdict = await window.__TAURI_INTERNALS__.invoke("verify_source", { query });
      results.push({ query: query.doi, ...verdict });
    } catch (error) {
      results.push({ query: query.doi, error: String(error) });
    }
  }
  return results;
});
for (const v of out.verdicts) {
  log(
    `${v.query} -> ${v.status} ${v.score} | year ${v.year} | cited ${v.citedByCount} ` +
      `| ${v.citationSignal ?? "no signal"} ${v.citationsPerYear ?? ""} | oa ${v.isOpenAccess} ${v.oaStatus ?? ""}`,
  );
}

out.referenceRows = await app.evaluate(() =>
  [...document.querySelectorAll("main ul li")]
    .filter((li) => /Source (verified|not found|suspicious)|Not checked/.test(li.textContent ?? ""))
    .map((li) => ({
      marker: li.querySelector("span")?.textContent?.trim() ?? "",
      strip: [...li.querySelectorAll("div > span, div > div > span")]
        .map((s) => s.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean),
      registryLine:
        [...li.querySelectorAll("div div span, div div")]
          .map((n) => n.textContent?.replace(/\s+/g, " ").trim() ?? "")
          .find((t) => /cited|too recent|not cited|Open access|Paywalled/.test(t)) ?? "",
    })),
);

out.guardLine = await app.evaluate(
  () =>
    [...document.querySelectorAll("main p")]
      .map((p) => p.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .find((t) => t.startsWith("Citation counts reflect")) ?? "",
);
log(`guard line: ${out.guardLine ? "present" : "MISSING"}`);

// --- 5. staged planning captions ------------------------------------------
const captions = [];
// Read the BusyBar element itself: matching on text across all divs picks up
// the app shell and reports one unchanging caption.
const sampler = setInterval(async () => {
  try {
    const caption = await app.evaluate(() => {
      const bar = document.querySelector("div.bg-brand-soft");
      if (!bar) return null;
      const text = bar.querySelector("p")?.textContent?.trim() ?? "";
      const counter = [...bar.querySelectorAll("span")].map((s) => s.textContent?.trim() ?? "").join(" ");
      return `${text} | ${counter}`;
    });
    if (caption && captions.at(-1) !== caption) captions.push(caption);
  } catch {
    /* page busy */
  }
}, 250);

await app.evaluate(() => {
  const b = [...document.querySelectorAll("main button")].find((x) =>
    (x.textContent ?? "").includes("Start checkpoint"),
  );
  b?.click();
});
await pollUntil(
  async () => (await app.$eval("main", (el) => el.textContent ?? "")).includes("Question 1 of"),
  900000,
  "question planning",
);
clearInterval(sampler);
out.planningCaptions = captions;
log(`planning captions captured: ${captions.length}`);

out.errors = errors;
writeFileSync("tmp/verify-improvements.json", JSON.stringify(out, null, 2), "utf8");
log(`console errors: ${errors.length}`);
await browser.disconnect();
