"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

type Member = {
  id: string;
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  role: Role;
};

export default function AdminPage() {
  const { orgId, orgs } = useAuth();
  const org = orgs.find((o) => o.id === orgId);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "analyst" as Role,
  });

  async function load() {
    if (!orgId) return;
    const data = await api<Member[]>(`/api/auth/organizations/${orgId}/members`);
    setMembers(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [orgId]);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setError("");
    try {
      await api(`/api/auth/organizations/${orgId}/members`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ email: "", full_name: "", password: "", role: "analyst" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold">Admin & RBAC</h1>
        <p className="text-[var(--muted)] mt-1">
          Manage organization members and roles for {org?.name || "your lab"}.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">Role model</h2>
        <ul className="mt-3 text-sm text-[var(--muted)] space-y-1">
          <li><b>owner</b> — full control</li>
          <li><b>admin</b> — users & calibrations</li>
          <li><b>analyst</b> — capture & run analysis</li>
          <li><b>reviewer</b> — approve / reject results</li>
          <li><b>viewer</b> — read-only</li>
        </ul>
      </div>

      <form onSubmit={onInvite} className="card p-6 grid md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 font-semibold">Invite member</h2>
        {(
          [
            ["full_name", "Full name", "text"],
            ["email", "Email", "email"],
            ["password", "Temp password", "password"],
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
        <div>
          <label className="text-xs text-[var(--muted)]">Role</label>
          <select
            className="input mt-1"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {(["admin", "analyst", "reviewer", "viewer"] as Role[]).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-[var(--danger)] md:col-span-2">{error}</p>}
        <div className="md:col-span-2">
          <button className="btn btn-primary" type="submit">
            Add member
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--accent)] text-white">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3">{m.full_name}</td>
                <td className="px-4 py-3">{m.email}</td>
                <td className="px-4 py-3 capitalize">{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
