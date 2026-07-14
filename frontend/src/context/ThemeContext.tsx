import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Тема (Завдання 18): за замовчуванням — системна тема пристрою;
 * користувач може вручну обрати dark/light; вибір зберігається.
 */

export type ThemeMode = "system" | "dark" | "light";

const STORAGE_KEY = "cmb_theme";

interface ThemeValue {
  mode: ThemeMode;                 // що обрав користувач
  resolved: "dark" | "light";      // що реально застосовано
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function systemPrefersLight(): boolean {
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

function resolve(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") return systemPrefersLight() ? "light" : "dark";
  return mode;
}

function apply(resolved: "dark" | "light") {
  document.documentElement.classList.toggle("light", resolved === "light");
  // Колір системної смуги статусу (iPhone) під тему
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#F1F5F9" : "#0A0F1A");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
  });
  const [resolved, setResolved] = useState<"dark" | "light">(() => resolve(mode));

  // Застосування при зміні режиму
  useEffect(() => {
    const r = resolve(mode);
    setResolved(r);
    apply(r);
  }, [mode]);

  // Слідкуємо за системною темою, поки обрано "system"
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const r = resolve("system");
      setResolved(r);
      apply(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, m);
    setModeState(m);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
