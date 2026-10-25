import { Link, useNavigate } from "react-router-dom";
import { type FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    organization_name: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(form);
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand hidden md:flex">
        <p className="text-xs tracking-[0.12em] text-white/60 font-semibold mb-4">
          Get Started Free
        </p>
        <h1>Create Your Lab Workspace</h1>
        <p className="mt-4 text-white/70 max-w-sm leading-relaxed">
          You Become the Organization Owner. Invite Analysts, Reviewers, and Admins
          With Role-Based Access Control.
        </p>
      </div>
      <div className="auth-form-wrap">
        <form onSubmit={onSubmit} className="auth-card">
          <h1 className="text-2xl font-bold">Create Lab Workspace</h1>
          <div className="mt-6 space-y-4">
            {(
              [
                ["full_name", "Full Name", "text"],
                ["organization_name", "Organization / Lab Name", "text"],
                ["email", "Email", "email"],
                ["password", "Password (Min 8)", "password"],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  type={type}
                  required
                  minLength={key === "password" ? 10 : undefined}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? "Creating…" : "Create Workspace"}
            </button>
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Already Registered? <Link className="text-[var(--accent)] font-semibold hover:underline" to="/login">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
