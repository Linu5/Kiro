// Regression: Ollama integration still works after the requirement changes.
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const line = (label, ok, detail = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` :: ${detail}` : ""}`);

const version = await (await fetch("http://localhost:9222/json/version")).json();
const browser = await puppeteer.connect({ browserWSEndpoint: version.webSocketDebuggerUrl });
const app = (await browser.pages()).find((p) => !p.url().startsWith("devtools"));
const errors = [];
app.on("pageerror", (e) => errors.push(e.message));
app.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await app.reload({ waitUntil: "networkidle2" });
await app.waitForSelector("nav[aria-label='Main']", { timeout: 20000 });
await wait(2500);

const header = await app.$eval("header", (el) => el.textContent ?? "");
line("llm_status reaches the UI (model reported ready)", /ready/.test(header), header.replace(/\s+/g, " ").slice(-60));

const gen = await app.evaluate(async () => {
  try {
    return await window.__TAURI_INTERNALS__.invoke("llm_generate", {
      request: { baseUrl: "http://127.0.0.1:11434", model: "llama3", prompt: "Write one Socratic question", json: true, temperature: 0.3 },
    });
  } catch (error) {
    return { error: String(error) };
  }
});
line("llm_generate round-trips through the Rust bridge", typeof gen.text === "string" && gen.text.includes("MODEL-Q"), `model=${gen.model ?? gen.error}`);

const guard = await app.evaluate(async () => {
  try {
    await window.__TAURI_INTERNALS__.invoke("llm_generate", {
      request: { baseUrl: "https://api.openai.com", model: "gpt", prompt: "leak", json: false },
    });
    return "not blocked";
  } catch (error) {
    return String(error);
  }
});
line("loopback privacy guard still enforced", /privacy policy|loopback/.test(guard), guard.slice(0, 80));

// Model-generated questions still reach the checkpoint.
await (await app.$('input[type="file"]')).uploadFile("tmp/fixture.txt");
await app.waitForFunction(() => (document.querySelector("header p")?.textContent ?? "").includes("references"), { timeout: 60000 });
await app.waitForFunction(
  () => {
    const text = document.querySelector("main")?.textContent ?? "";
    const verdicts = (text.match(/Source (?:verified|not found|suspicious)|Not checked/g) ?? []).length;
    return !(document.body.textContent ?? "").includes("Verifying ") && verdicts >= 2;
  },
  { timeout: 240000, polling: 250 },
);
const startIndex = await app.$$eval("main button", (els) => els.findIndex((e) => (e.textContent ?? "").includes("Start checkpoint")));
(await app.$$("main button"))[startIndex].click();
await app.waitForFunction(() => (document.querySelector("main")?.textContent ?? "").includes("Question 1 of"), { timeout: 120000 });
const checkpoint = await app.$eval("main", (el) => el.textContent?.replace(/\s+/g, " ") ?? "");
line("model-generated questions rendered", checkpoint.includes("MODEL-Q"));
line("provenance shown as local model", checkpoint.includes("local model"));

const log = readFileSync("tmp/ollama-log.txt", "utf8");
line("daemon received JSON-constrained question requests", /kind=QUESTIONS json=true/.test(log), log.split("\n").filter(Boolean).length + " requests");

line("no console or page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.disconnect();
