// Reports what the live UI actually exposes, so selectors match reality.
import puppeteer from "puppeteer-core";

const version = await (await fetch("http://localhost:9222/json/version")).json();
const browser = await puppeteer.connect({
  browserWSEndpoint: version.webSocketDebuggerUrl,
  protocolTimeout: 0,
});
const app = (await browser.pages()).find((p) => !p.url().startsWith("devtools"));

const inventory = await app.evaluate(() => ({
  view: document.querySelector("nav[aria-label='Main'] [aria-current='page']")?.textContent?.slice(0, 30) ?? null,
  headerSubtitle: document.querySelector("header p")?.textContent?.slice(0, 90) ?? null,
  busyVisible: (document.body.textContent ?? "").includes("Verifying ") || (document.body.textContent ?? "").includes("Preparing Socratic"),
  textareas: [...document.querySelectorAll("main textarea")].map((t) => ({
    placeholder: (t.placeholder ?? "").slice(0, 50),
    ariaLabel: t.getAttribute("aria-label"),
    rows: t.rows,
  })),
  buttons: [...document.querySelectorAll("main button")]
    .map((b) => ({ text: (b.textContent ?? "").trim().slice(0, 30), disabled: b.disabled }))
    .slice(0, 16),
  fileInputs: document.querySelectorAll('input[type="file"]').length,
}));

console.log(JSON.stringify(inventory, null, 1));
await browser.disconnect();
