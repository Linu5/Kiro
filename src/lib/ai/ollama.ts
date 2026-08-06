import { llmGenerate, llmStatus, CoreUnavailableError } from "../ipc";
import type { AppSettings, LlmStatus } from "@/types";

/**
 * Model bridge supporting local Ollama (via Rust desktop core) and Cloud LLMs (via Groq API).
 */

export class LlmUnavailableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "LlmUnavailableError";
  }
}

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];

export function getGroqApiKey(settings: AppSettings): string | undefined {
  return settings.groqApiKey?.trim() || (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim() || undefined;
}

export async function checkLlm(settings: AppSettings): Promise<LlmStatus> {
  const apiKey = getGroqApiKey(settings);
  const isGroq = settings.llmProvider === "groq" || Boolean(apiKey);

  if (isGroq) {
    if (!apiKey) {
      return {
        reachable: false,
        baseUrl: "https://api.groq.com",
        models: GROQ_MODELS,
        detail: "Groq selected. Set VITE_GROQ_API_KEY in project environment or Settings.",
      };
    }
    return {
      reachable: true,
      baseUrl: "https://api.groq.com",
      models: GROQ_MODELS,
      detail: (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim()
        ? "Connected via global VITE_GROQ_API_KEY environment variable"
        : "Connected to Groq Cloud API",
    };
  }

  try {
    return await llmStatus(settings.llmBaseUrl);
  } catch (error) {
    const detail =
      error instanceof CoreUnavailableError
        ? "Browser mode: Set VITE_GROQ_API_KEY in Vercel environment variables or use desktop build for local Ollama."
        : String(error);
    return { reachable: false, baseUrl: settings.llmBaseUrl, models: [], detail };
  }
}

/** Pull the first balanced JSON object out of a model response. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;

  const start = body.indexOf("{");
  if (start < 0) throw new Error("Model response contained no JSON object.");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i += 1) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(body.slice(start, i + 1));
    }
  }
  throw new Error("Model response contained an unterminated JSON object.");
}

export interface GenerateJsonOptions {
  settings: AppSettings;
  system: string;
  prompt: string;
  temperature?: number;
  attempts?: number;
}

async function generateGroqJson<T>(options: GenerateJsonOptions): Promise<{
  value: T;
  model: string;
  elapsedMs: number;
}> {
  const apiKey = getGroqApiKey(options.settings);
  if (!apiKey) {
    throw new LlmUnavailableError(
      "Groq API Key is missing. Please set VITE_GROQ_API_KEY in Vercel environment variables or enter a key in Settings.",
    );
  }

  const model = options.settings.llmModel || "llama-3.3-70b-versatile";
  const start = performance.now();

  const systemContent = options.system
    ? `${options.system}\nYou MUST return a valid JSON object.`
    : "You MUST return a valid JSON object.";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: options.prompt },
      ],
      response_format: { type: "json_object" },
      temperature: options.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LlmUnavailableError(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq API returned an empty response.");

  const elapsedMs = Math.round(performance.now() - start);
  return {
    value: extractJson(content) as T,
    model,
    elapsedMs,
  };
}

export async function generateJson<T>(options: GenerateJsonOptions): Promise<{
  value: T;
  model: string;
  elapsedMs: number;
}> {
  const apiKey = getGroqApiKey(options.settings);
  if (options.settings.llmProvider === "groq" || Boolean(apiKey)) {
    return generateGroqJson<T>(options);
  }

  const attempts = options.attempts ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const prompt =
      attempt === 0
        ? options.prompt
        : `${options.prompt}\n\nYour previous answer was not valid JSON. Return only the JSON object, with no commentary.`;
    try {
      const response = await llmGenerate({
        baseUrl: options.settings.llmBaseUrl,
        model: options.settings.llmModel,
        system: options.system,
        prompt,
        json: true,
        temperature: options.temperature ?? 0.2,
      });
      return {
        value: extractJson(response.text) as T,
        model: response.model,
        elapsedMs: response.elapsedMs,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof CoreUnavailableError) break;
    }
  }

  throw new LlmUnavailableError(
    lastError instanceof Error ? lastError.message : String(lastError ?? "unknown error"),
  );
}
