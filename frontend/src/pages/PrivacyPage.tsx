import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";

/**
 * Політика конфіденційності.
 *
 * Написана за фактичною поведінкою коду, а не за шаблоном: перелік
 * зберігання звірено з backend/app/models/db_models.py і з ключами
 * localStorage у context/*.tsx. Якщо додасте аналітику, сторонні скрипти
 * або нові поля в БД — оновіть і цей текст.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-5 first:border-t-0 sm:px-6">
      <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-lg font-semibold text-ink">Privacy Policy</h1>
        <Link to="/" className="text-sm text-muted transition-colors hover:text-ink">
          ← Back
        </Link>
      </div>

      <Card>
        <Section title="Short version">
          <p>
            This app sets <strong className="text-ink">no cookies at all</strong> and runs no
            analytics, advertising or tracking scripts. You can use every market feature —
            prices, charts, indicators, signals, backtests — without an account and without
            giving us any personal data.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            None are set. Sign-in uses a token sent in an <code>Authorization</code> header,
            not a cookie, so there is no cookie banner because there is nothing to consent to.
          </p>
        </Section>

        <Section title="Stored in your browser">
          <p>
            Three values are kept in your device's local storage. They never leave your
            browser on their own and are not readable by other sites:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <code>cmb_theme</code> — your light / dark / auto choice.
            </li>
            <li>
              <code>cmb_favourites</code> — the coins you starred, so guests keep their list.
            </li>
            <li>
              <code>cmb_token</code> — your sign-in token, if you have an account. Signing out
              deletes it.
            </li>
          </ul>
          <p>
            Clearing site data in your browser removes all three and returns the app to its
            initial state.
          </p>
        </Section>

        <Section title="Stored on the server">
          <p>Only if you choose to create an account:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong className="text-ink">Email address</strong> and the date you registered.
            </li>
            <li>
              <strong className="text-ink">Password</strong> — never in readable form. Only a
              bcrypt hash with a per-password salt is stored, which cannot be turned back into
              your password.
            </li>
            <li>
              <strong className="text-ink">Your favourite coins</strong> and their order.
            </li>
            <li>
              <strong className="text-ink">Your alerts</strong> — coin, condition, and when one
              fired.
            </li>
            <li>
              <strong className="text-ink">Push subscription</strong> — the address your
              browser gives us to deliver notifications, and its encryption keys. Created only
              when you enable notifications, deleted when you disable them or when your browser
              reports the subscription as expired.
            </li>
          </ul>
          <p>
            Signal history and backtest results describe the market, not you: they contain no
            link to any account.
          </p>
        </Section>

        <Section title="IP addresses">
          <p>
            Your IP address is used in memory only, to limit how many requests one visitor can
            make per minute — this protects the service from abuse and passwords from
            brute-force attempts. It is not written to any database and not kept after the
            counting window passes. Web-server access logs are not enabled.
          </p>
        </Section>

        <Section title="Third parties">
          <p>
            Market data (prices, candles) is fetched by our server from public exchange
            endpoints, not by your browser, so exchanges never see your address.
          </p>
          <p>
            One exception: page fonts load from Google Fonts, which means your browser contacts
            Google's servers and they can see your IP address. Nothing else is sent, and no
            account of yours is involved.
          </p>
          <p>
            Push notifications are delivered through the push service your browser vendor
            provides (Apple, Google or Mozilla, depending on your device) — that is how web
            push works everywhere.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Alerts and favourites can be removed inside the app at any time. To delete your
            account and everything attached to it, contact us through the repository linked in
            the footer.
          </p>
        </Section>

        <Section title="Security">
          <p>
            The whole site is served over HTTPS. Passwords are stored only as bcrypt hashes.
            The API is rate-limited. No exchange API keys are used anywhere, because the app
            only ever reads public market data — it cannot place trades or touch anyone's
            funds.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If what the app stores ever changes, this page changes with it. It describes the
            behaviour of the version currently deployed.
          </p>
        </Section>
      </Card>

      <p className="mt-4 text-center text-xs text-muted">
        This app provides analytical information only and is not financial advice.
      </p>
    </main>
  );
}
