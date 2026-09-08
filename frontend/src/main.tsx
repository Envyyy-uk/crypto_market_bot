import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: реєстрація service worker (Завдання 16).
//
// Тільки в прод-збірці. У деві кешована оболонка перекриває свіжий код і
// розробник годинами дивиться на стару версію, не розуміючи чому — саме це
// й сталося: воркер, зареєстрований у деві влітку, продовжував віддавати
// липневу оболонку навіть після оновлення коду.
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {
        /* SW недоступний (напр., dev по http без localhost) — застосунок працює як сайт */
      });
    });
  } else {
    // Прибираємо воркер, залишений попередніми дев-сесіями на цьому origin,
    // разом з його кешами — інакше він переживе будь-яку зміну коду.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) reg.unregister();
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
}
