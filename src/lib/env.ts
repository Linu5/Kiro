import { isTauri } from "@tauri-apps/api/core";

/**
 * The app is designed to run in two hosts:
 *
 * - Tauri desktop: full feature set (SQLite traces, Ollama bridge, metadata
 *   verification, native export dialogs).
 * - Plain browser (`npm run dev` opened directly): used for UI work and demos.
 *   Parsing, scoring and export still run, but persistence falls back to
 *   `localStorage`, the LLM bridge is unavailable and sources stay `unverified`.
 */
export const isDesktop = (): boolean => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

export const hostLabel = (): string => (isDesktop() ? "Desktop (Tauri core)" : "Browser preview");

export const APP_VERSION = "0.1.0";
