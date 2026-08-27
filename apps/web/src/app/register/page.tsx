"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
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
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4" style={{ background: "var(--hero-grad)" }}>
      <form onSubmit={onSubmit} className="card w-full max-w-md p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Create lab workspace</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">You become the organization owner</p>
        <div className="mt-6 space-y-4">
          {(
            [
              ["full_name", "Full name", "text"],
              ["organization_name", "Organization / Lab name", "text"],
              ["email", "Email", "email"],
              ["password", "Password (min 8)", "password"],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <label className="text-xs text-[var(--muted)]">{label}</label>
              <input
                className="input mt-1"
                type={type}
                required
                minLength={key === "password" ? 8 : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Already registered? <Link className="text-[var(--accent)]" href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
