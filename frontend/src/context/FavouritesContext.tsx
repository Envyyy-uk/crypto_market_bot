import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const LOCAL_KEY = "cmb_favourites";

interface FavouritesValue {
  favourites: string[];
  isFavourite: (symbol: string) => boolean;
  toggle: (symbol: string) => void;
  move: (symbol: string, direction: -1 | 1) => void;
}

const FavouritesContext = createContext<FavouritesValue | null>(null);

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [favourites, setFavourites] = useState<string[]>(readLocal);
  const syncedRef = useRef(false);

  // Після входу: об'єднуємо локальний список зі збереженим у БД і синхронізуємо
  useEffect(() => {
    if (!token) {
      syncedRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/favourites`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const remote: string[] = await res.json();
        const local = readLocal();
        // Об'єднання: спершу порядок із БД, потім нові локальні
        const merged = [...remote, ...local.filter((s) => !remote.includes(s))];
        setFavourites(merged);
        syncedRef.current = true;
        if (merged.length !== remote.length) {
          await pushRemote(merged, token);
        }
      } catch {
        /* офлайн — працюємо з localStorage */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Будь-яка зміна: завжди в localStorage, і в БД якщо авторизовані
  const persist = useCallback(
    (next: string[]) => {
      setFavourites(next);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      if (token && syncedRef.current) {
        pushRemote(next, token).catch(() => {
          /* тимчасова помилка мережі — localStorage залишається джерелом правди */
        });
      }
    },
    [token]
  );

  const isFavourite = useCallback(
    (symbol: string) => favourites.includes(symbol),
    [favourites]
  );

  const toggle = useCallback(
    (symbol: string) => {
      persist(
        favourites.includes(symbol)
          ? favourites.filter((s) => s !== symbol)
          : [...favourites, symbol]
      );
    },
    [favourites, persist]
  );

  const move = useCallback(
    (symbol: string, direction: -1 | 1) => {
      const i = favourites.indexOf(symbol);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= favourites.length) return;
      const next = [...favourites];
      [next[i], next[j]] = [next[j], next[i]];
      persist(next);
    },
    [favourites, persist]
  );

  return (
    <FavouritesContext.Provider value={{ favourites, isFavourite, toggle, move }}>
      {children}
    </FavouritesContext.Provider>
  );
}

async function pushRemote(symbols: string[], token: string) {
  await fetch(`${API_BASE}/api/favourites`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ symbols }),
  });
}

export function useFavourites(): FavouritesValue {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error("useFavourites must be used inside FavouritesProvider");
  return ctx;
}
