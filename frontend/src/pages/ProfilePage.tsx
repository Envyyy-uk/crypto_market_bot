import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFavourites } from "../context/FavouritesContext";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { favourites, toggle, move } = useFavourites();
  const navigate = useNavigate();

  if (!user) {
    return (
      <main className="mx-auto max-w-sm px-4 pb-16 pt-8 sm:px-6">
        <div className="rounded-2xl border border-border bg-panel p-6 text-center">
          <p className="text-sm text-muted">You are not signed in.</p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-deep"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
      <div className="mt-4 rounded-2xl border border-border bg-panel p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Profile</h2>
        <p className="mt-2 text-sm text-muted">
          Signed in as <span className="text-ink">{user.email}</span>
        </p>
        {user.createdAt && (
          <p className="mt-1 text-xs text-muted">
            Member since {new Date(user.createdAt).toLocaleDateString()}
          </p>
        )}
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-bear/40 hover:text-bear"
        >
          Sign out
        </button>
      </div>

      {/* Керування обраним: видалення і зміна порядку (Завдання 12) */}
      <div className="mt-6 rounded-2xl border border-border bg-panel">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-display text-sm font-medium text-ink">Favourite assets</h3>
          <p className="mt-0.5 text-xs text-muted">
            Add coins with the ★ button in the markets list. Reorder or remove them here.
          </p>
        </div>
        {favourites.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No favourites yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {favourites.map((symbol, i) => (
              <li key={symbol} className="flex items-center justify-between px-5 py-2.5">
                <Link
                  to={`/analyze/${symbol}`}
                  className="font-mono text-sm text-ink hover:text-amber"
                >
                  {symbol.replace("USDT", "")}
                  <span className="text-muted">/USDT</span>
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => move(symbol, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${symbol} up`}
                    className="rounded-md px-2 py-1 text-muted transition-colors hover:text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(symbol, 1)}
                    disabled={i === favourites.length - 1}
                    aria-label={`Move ${symbol} down`}
                    className="rounded-md px-2 py-1 text-muted transition-colors hover:text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => toggle(symbol)}
                    aria-label={`Remove ${symbol} from favourites`}
                    className="rounded-md px-2 py-1 text-muted transition-colors hover:text-bear"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
