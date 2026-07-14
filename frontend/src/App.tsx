import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { MarketStreamProvider, useMarkets } from "./context/MarketStreamContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FavouritesProvider } from "./context/FavouritesContext";
import { ThemeProvider } from "./context/ThemeContext";
import ConnectionStatus from "./components/ConnectionStatus";
import ThemeToggle from "./components/ThemeToggle";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";
import AnalyzePage from "./pages/AnalyzePage";
import SignalsPage from "./pages/SignalsPage";
import ProfilePage from "./pages/ProfilePage";
import AlertsPage from "./pages/AlertsPage";
import MarketsPage from "./pages/MarketsPage";
import BottomNav from "./components/BottomNav";
import Footer from "./components/Footer";
import { LoginPage, RegisterPage } from "./pages/AuthPages";

/** Спільна шапка: ticker tape + назва + навігація + статус з'єднання. */
function Shell({ children }: { children: React.ReactNode }) {
  const { tickers, status } = useMarkets();
  const { user } = useAuth();

  const majorSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT", "ADAUSDT", "DOGEUSDT", "TRXUSDT"];
  const tape = majorSymbols
    .map((s) => tickers.find((t) => t.symbol === s))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const tapeLoop = [...tape, ...tape];

  return (
    <div className="pt-safe content-with-tabbar min-h-screen bg-base text-ink">
      <div className="overflow-hidden border-b border-border bg-panel py-2">
        {tapeLoop.length > 0 ? (
          <div className="flex w-max animate-ticker gap-8 whitespace-nowrap px-4">
            {tapeLoop.map((t, i) => (
              <span key={`${t.symbol}-${i}`} className="tabular text-xs text-muted">
                {t.symbol.replace("USDT", "")}/USDT{" "}
                <span className={t.change24h >= 0 ? "text-bull" : "text-bear"}>
                  {t.change24h >= 0 ? "+" : ""}
                  {t.change24h.toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        ) : (
          <div className="px-4 text-xs text-muted">Connecting to live market data…</div>
        )}
      </div>

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-base font-semibold tracking-tight">
            Crypto Market Bot
          </h1>
          <p className="hidden text-xs text-muted sm:block">
            Analytical signals — not financial advice.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden gap-3 text-sm sm:flex">
            <Link to="/" className="text-muted transition-colors hover:text-ink">
              Markets
            </Link>
            <Link to="/signals" className="text-muted transition-colors hover:text-ink">
              Signals
            </Link>
            <Link to="/alerts" className="text-muted transition-colors hover:text-ink">
              Alerts
            </Link>
            {user ? (
              <Link to="/profile" className="text-muted transition-colors hover:text-ink">
                Profile
              </Link>
            ) : (
              <Link to="/login" className="text-muted transition-colors hover:text-ink">
                Sign in
              </Link>
            )}
          </nav>
          <ThemeToggle />
          <ConnectionStatus status={status} />
        </div>
      </header>

      {children}
      <Footer />
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <FavouritesProvider>
          <MarketStreamProvider>
            <Shell>
              <ErrorBoundary>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/markets" element={<MarketsPage />} />
                <Route path="/analyze/:symbol" element={<AnalyzePage />} />
                <Route path="/signals" element={<SignalsPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
              </ErrorBoundary>
            </Shell>
          </MarketStreamProvider>
        </FavouritesProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
