"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Calibration } from "@/lib/types";

export default function CalibrationsPage() {
  const { orgId } = useAuth();
  const [items, setItems] = useState<Calibration[]>([]);
  const [form, setForm] = useState({
    name: "10X",
    objective: "10X",
    um_per_px_x: 0.65,
    um_per_px_y: 0.65,
    unit: "um",
    notes: "",
  });
  const [error, setError] = useState("");

  async function load() {
    if (!orgId) return;
    const data = await api<Calibration[]>(`/api/orgs/${orgId}/calibrations`);
    setItems(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [orgId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setError("");
    try {
      await api(`/api/orgs/${orgId}/calibrations`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="page-title">Calibration</h1>
        <p className="page-subtitle">
          Stage Micrometer Calibrations (µm/px) per Objective — Required Before Accurate Analysis.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card p-6 grid md:grid-cols-2 gap-4">
        {(
          [
            ["name", "Name"],
            ["objective", "Objective"],
            ["um_per_px_x", "µm per px (X)"],
            ["um_per_px_y", "µm per px (Y)"],
            ["unit", "Unit"],
            ["notes", "Notes"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label className="text-xs text-[var(--muted)]">{label}</label>
            <input
              className="input mt-1"
              type={key.startsWith("um_") ? "number" : "text"}
              step="any"
              value={String(form[key])}
              onChange={(e) =>
                setForm({
                  ...form,
                  [key]: key.startsWith("um_") ? Number(e.target.value) : e.target.value,
                })
              }
              required={key !== "notes"}
            />
          </div>
        ))}
        {error && <p className="text-sm text-[var(--danger)] md:col-span-2">{error}</p>}
        <div className="md:col-span-2">
          <button className="btn btn-primary" type="submit">
            Save Calibration
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Objective</th>
              <th className="text-left px-4 py-3">X µm/px</th>
              <th className="text-left px-4 py-3">Y µm/px</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3">{c.objective}</td>
                <td className="px-4 py-3">{c.um_per_px_x}</td>
                <td className="px-4 py-3">{c.um_per_px_y}</td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={4}>
                  No Calibrations Yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
