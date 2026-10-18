import { redirect } from "next/navigation";
import { sessionEmail } from "../../lib/auth.ts";
import { login } from "./actions.ts";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await sessionEmail()) redirect("/");
  const error = (await searchParams).error;

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">A</div>
        <p className="eyebrow">Anchorpoint Fire &amp; Safety</p>
        <h1>Launch Control</h1>
        <p className="login-copy">Sign in to the read-only RevOps workspace.</p>
        <form action={login} className="login-form">
          <label>
            Work email
            <input autoComplete="username" name="email" required type="email" />
          </label>
          <label>
            Password
            <input autoComplete="current-password" name="password" required type="password" />
          </label>
          {error ? <p className="login-error">The email or password was not accepted.</p> : null}
          <button type="submit">Sign in</button>
        </form>
        {process.env.NODE_ENV !== "production" ? (
          <small>Local demo: revops@anchorpoint.example / anchorpoint-local</small>
        ) : null}
      </section>
    </main>
  );
}
