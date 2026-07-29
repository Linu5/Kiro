import { llmGenerate, llmStatus, CoreUnavailableError } from "../ipc";
import type { AppSettings, LlmStatus } from "@/types";

/**
 * Local model bridge. All traffic goes through the Rust core
 * (`commands/llm.rs`), which pins the endpoint to loopback by default; the
 * webview itself has no network permission.
 */

export class LlmUnavailableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "LlmUnavailableError";
  }
}

export async function checkLlm(settings: AppSettings): Promise<LlmStatus> {
  try {
    return await llmStatus(settings.llmBaseUrl);
  } catch (error) {
    const detail =
      error instanceof CoreUnavailableError
        ? "Browser preview mode: the local model bridge needs the desktop build."
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

/**
 * Ask the local model for JSON, with one retry that restates the format
 * requirement. Throws `LlmUnavailableError` so callers can fall back to the
 * deterministic heuristics instead of failing the workflow.
 */
export async function generateJson<T>(options: GenerateJsonOptions): Promise<{
  value: T;
  model: string;
  elapsedMs: number;
}> {
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
