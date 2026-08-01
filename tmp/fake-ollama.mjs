import { createServer } from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";

const LOG = "tmp/ollama-log.txt";
writeFileSync(LOG, "");
const QUESTIONS = {
  questions: [
    { dimension: "grounding", prompt: "MODEL-Q which measured result supports this claim?", hint: "Quote the number." },
    { dimension: "relevance", prompt: "MODEL-Q is this direct evidence, background context, or only a related example?", hint: "Say which." },
  ],
};
const EVALUATION = {
  aiInsight: "MODEL-INSIGHT the cited work reports a bench measurement, which supports detection timing but not a field-wide claim.",
  aiExpectedEvidence: "MODEL-EVIDENCE quote the measured detection lead time.",
  studentSummary: "The student argues the source shows early detection.",
  alignment: "surface",
  similarity: 0.42,
  gaps: [{ kind: "over-generalisation", detail: "MODEL-GAP extends a bench result to all rooftops." }],
  relevance: 71,
  depth: 64,
};

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    appendFileSync(LOG, `${req.method} ${req.url} kind=${body.includes("Socratic question asked") ? "EVALUATION" : body.includes("Write one Socratic question") ? "QUESTIONS" : "other"} json=${/"format":"json"/.test(body)}\n`);
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/tags") {
      res.end(JSON.stringify({ models: [{ name: "llama3:latest" }] }));
      return;
    }
    if (req.url === "/api/generate") {
      const payload = body.includes("Socratic question asked") ? EVALUATION : QUESTIONS;
      res.end(JSON.stringify({ model: "llama3:fake", response: JSON.stringify(payload), done: true }));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
}).listen(11434, "127.0.0.1", () => console.log("fake ollama on 127.0.0.1:11434"));
