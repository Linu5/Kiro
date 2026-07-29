import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Tauri expects a fixed dev-server port and does not tolerate the port hopping
// Vite normally does, hence `strictPort`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) },
      // mammoth's default entry pulls in `fs`/`path`; the shipped browser
      // bundle is the one we want inside the webview.
      { find: /^mammoth$/, replacement: "mammoth/mammoth.browser.js" },
    ],
  },
  // The webview never talks to a remote origin: everything is bundled locally.
  build: {
    target: "es2022",
    sourcemap: true,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Rust sources are watched by the Tauri CLI, not Vite.
      ignored: ["**/src-tauri/**"],
    },
  },
});
