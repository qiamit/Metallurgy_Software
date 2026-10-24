import { Link, useLocation, useNavigate } from "react-router-dom";
import { type FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand hidden md:flex">
        <p className="text-xs tracking-[0.12em] text-teal-200/80 font-semibold mb-4">
          Metallurgy Lab SaaS
        </p>
        <h1>Sign In to Your Lab Workspace</h1>
        <p className="mt-4 text-teal-100/70 max-w-sm leading-relaxed">
          Standards-Aligned Grain Size, Inclusion, Decarburization, Micro and Macro
          Analysis — With AI Cross-Check and Multi-Tenant RBAC.
        </p>
      </div>
      <div className="auth-form-wrap">
        <form onSubmit={onSubmit} className="auth-card">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Access Your Metallurgy Workspace</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] tracking-wide">Email</label>
              <input className="input mt-1.5" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] tracking-wide">Password</label>
              <input className="input mt-1.5" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? "Signing In…" : "Sign In"}
            </button>
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            <Link className="text-[var(--accent)] font-semibold hover:underline" to="/reset-password">Forgot Password?</Link>
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            No Account? <Link className="text-[var(--accent)] font-semibold hover:underline" to="/register">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
