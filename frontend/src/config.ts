/**
 * Єдине джерело правди для адрес бекенду.
 *
 * VITE_API_BASE не задано  -> дев-режим: бекенд на http://localhost:8000
 * VITE_API_BASE порожній   -> прод: фронт і API за одним reverse proxy
 *                             (той самий origin), шляхи відносні
 * VITE_API_BASE = URL      -> фронт і API на різних доменах
 */
const configured = import.meta.env.VITE_API_BASE?.trim();

export const API_BASE = configured === undefined ? "http://localhost:8000" : configured;

/**
 * WebSocket, на відміну від fetch, НЕ приймає відносний шлях — потрібен
 * абсолютний URL зі схемою. Тому для режиму "той самий origin" збираємо
 * адресу з window.location, а не з порожнього рядка.
 */
function resolveWsBase(): string {
  if (API_BASE === "") {
    const { protocol, host } = window.location;
    return `${protocol === "https:" ? "wss:" : "ws:"}//${host}`;
  }
  return API_BASE.startsWith("https")
    ? API_BASE.replace("https", "wss")
    : API_BASE.replace("http", "ws");
}

export const WS_BASE = resolveWsBase();
