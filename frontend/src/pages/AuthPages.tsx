import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const inputCls =
  "w-full rounded-lg border border-border bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-amber";

function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isLogin) await login(email, password);
      else await register(email, password);
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 pb-16 sm:px-6">
      <div className="mt-8 rounded-2xl border border-border bg-panel p-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          {isLogin ? "Sign in" : "Create account"}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {isLogin
            ? "Sign in to sync favourites and set up alerts."
            : "Your favourites and alerts will be saved to your account."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder={isLogin ? "Password" : "Password (min 8 characters)"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />

          {error && (
            <p className="rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-deep transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          {isLogin ? (
            <>
              No account?{" "}
              <Link to="/register" className="text-amber hover:underline">
                Create one
              </Link>
            </>
          ) : (
            <>
              Already registered?{" "}
              <Link to="/login" className="text-amber hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

export function LoginPage() {
  return <AuthForm mode="login" />;
}

export function RegisterPage() {
  return <AuthForm mode="register" />;
}
