import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
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
 * Ідентифікатор — хеш від УСЬОГО вмісту dist, окрім самого воркера.
 * Спершу тут був хеш лише index.html, і цього не вистачало: файли з
 * public/ (manifest.json, іконки) потрапляють у збірку без хешів у назві
 * й не згадуються в index.html, тож їхня зміна не зрушувала версію — а
 * вони лежать у кеші оболонки й лишались би там старими назавжди.
 */
function hashDir(dir: string, skip: string): string {
  const hash = createHash("sha256");
  const walk = (current: string) => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const rel = relative(dir, full).split("\\").join("/");
      if (rel === skip) continue;
      // Шлях теж у хеш: перейменування файлу має рахуватись як зміна
      hash.update(rel);
      hash.update(readFileSync(full));
    }
  };
  walk(dir);
  return hash.digest("hex").slice(0, 12);
}
function stampServiceWorker(): Plugin {
  return {
    name: "stamp-service-worker",
    apply: "build",
    closeBundle() {
      const dist = resolve(__dirname, "dist");
      const swPath = resolve(dist, "service-worker.js");
      const buildId = hashDir(dist, "service-worker.js");

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
