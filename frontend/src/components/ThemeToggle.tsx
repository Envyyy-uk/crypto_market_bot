import { useTheme, type ThemeMode } from "../context/ThemeContext";

const NEXT: Record<ThemeMode, ThemeMode> = { system: "dark", dark: "light", light: "system" };
const LABEL: Record<ThemeMode, string> = { system: "Auto", dark: "Dark", light: "Light" };

export default function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();

  return (
    <button
      onClick={() => setMode(NEXT[mode])}
      title={`Theme: ${LABEL[mode]} (tap to change)`}
      aria-label={`Theme: ${LABEL[mode]}. Tap to change.`}
      className="flex items-center gap-1.5 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink"
    >
      {mode === "system" ? (
        <AutoIcon />
      ) : resolved === "dark" ? (
        <MoonIcon />
      ) : (
        <SunIcon />
      )}
      {LABEL[mode]}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.8 6.8 0 0 0 21 12.8Z" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
