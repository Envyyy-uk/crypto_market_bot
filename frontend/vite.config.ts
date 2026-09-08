import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Штампує в service-worker.js ідентифікатор збірки.
 *
 * Назва кеша воркера має змінюватись від збірки до збірки — інакше його
 * обробник activate (він видаляє кеші з ІНШОЮ назвою) не видаляє нічого,
 * і відвідувач назавжди залишається на тій версії оболонки, яку побачив
 * першою. Файл лежить у public/ і не проходить через збірку Vite, тож
 * підставляємо значення вручну після запису dist.
 *
 * Ідентифікатор — хеш від зібраного index.html: він містить імена
 * файлів із хешами вмісту, тож змінюється рівно тоді, коли змінився
 * застосунок, і не змінюється при повторній збірці того самого коду.
 */
function stampServiceWorker(): Plugin {
  return {
    name: "stamp-service-worker",
    apply: "build",
    closeBundle() {
      const dist = resolve(__dirname, "dist");
      const swPath = resolve(dist, "service-worker.js");
      const html = readFileSync(resolve(dist, "index.html"), "utf-8");
      const buildId = createHash("sha256").update(html).digest("hex").slice(0, 12);

      const sw = readFileSync(swPath, "utf-8");
      if (!sw.includes("__BUILD_ID__")) {
        throw new Error(
          "service-worker.js не містить __BUILD_ID__ — кеш не отримає версію збірки"
        );
      }
      writeFileSync(swPath, sw.replace("__BUILD_ID__", buildId), "utf-8");
      this.info?.(`service worker: BUILD_ID=${buildId}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  server: {
    port: 5173,
    host: true,
  },
});
