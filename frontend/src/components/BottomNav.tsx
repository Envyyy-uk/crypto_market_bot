import { Link, useLocation } from "react-router-dom";

/**
 * Нижнє меню для мобільних (Завдання 17): Home / Markets / Signals / Alerts / Profile.
 * Ховається на десктопі (там навігація в шапці). Враховує нижню безпечну
 * зону iPhone через env(safe-area-inset-bottom) — клас pb-safe в index.css.
 */

const TABS = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/markets", label: "Markets", icon: MarketsIcon },
  { to: "/signals", label: "Signals", icon: SignalsIcon },
  { to: "/alerts", label: "Alerts", icon: AlertsIcon },
  { to: "/profile", label: "Profile", icon: ProfileIcon },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel/95 backdrop-blur sm:hidden">
      <div className="flex">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active =
            to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                active ? "text-amber" : "text-muted"
              }`}
            >
              <Icon active={active} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* Іконки: inline SVG, stroke успадковує колір тексту */

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarketsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M4 19V10M10 19V5M16 19v-7M21 19H3" strokeLinecap="round" />
    </svg>
  );
}

function SignalsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M3 14l4-4 4 3 5-6 5 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 20a1.7 1.7 0 0 0 3 0" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" strokeLinecap="round" />
    </svg>
  );
}
