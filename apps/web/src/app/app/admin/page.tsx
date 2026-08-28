"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Suspense } from "react";
import { api, fileUrl, getApiUrl, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatRole } from "@/lib/text";
import { ANALYSIS_LABELS, type AnalysisType, type Role } from "@/lib/types";

type Member = {
  id: string;
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  role: Role;
};

type AiSettings = {
  provider: string;
  model: string;
  configured: boolean;
  api_key_hint: string | null;
};

type LabSettings = {
  company_name: string;
  gst_number: string;
  contact_person_name: string;
  mobile_number: string;
  email_id: string;
  address: string;
  pin_code: string;
  city: string;
  state: string;
  country: string;
  company_logo_key: string | null;
  company_header_key: string | null;
  company_footer_key: string | null;
  watermark_key: string | null;
};

const ROLE_MODEL = [
  ["Owner", "Full Control"],
  ["Admin", "Users & Calibrations"],
  ["Analyst", "Capture & Run Analysis"],
  ["Reviewer", "Approve / Reject Results"],
  ["Viewer", "Read-Only"],
] as const;

const SECTION_TITLE: Record<string, string> = {
  lab: "Laboratory Setting",
  users: "User Management",
  roles: "Roles & Module Access",
  ai: "AI Setting",
  contact: "Contact Us",
  help: "Help",
};

const LAB_ASSETS = [
  ["logo", "Company Logo", "company_logo_key"],
  ["header", "Company Header", "company_header_key"],
  ["footer", "Company Footer", "company_footer_key"],
  ["watermark", "Water Mark", "watermark_key"],
] as const;

function AdminContent() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section") || "lab";
  const { orgId, orgs, refresh } = useAuth();
  const org = orgs.find((o) => o.id === orgId);
  const canAccessAdmin = org?.role === "owner" || org?.role === "admin";

  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");
  const [labError, setLabError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [labBusy, setLabBusy] = useState(false);
  const [assetBusy, setAssetBusy] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [labSettings, setLabSettings] = useState<LabSettings | null>(null);
  const [labForm, setLabForm] = useState({
    company_name: "",
    gst_number: "",
    contact_person_name: "",
    mobile_number: "",
    email_id: "",
    address: "",
    pin_code: "",
    city: "",
    state: "",
    country: "",
  });
  const [aiForm, setAiForm] = useState({
    provider: "deepseek",
    model: "deepseek-v4-flash-vision-exp",
    api_key: "",
    clear_key: false,
  });
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "analyst" as Role,
  });
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [inviteMenuOpen, setInviteMenuOpen] = useState(false);
  const headerActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (headerActionsRef.current && !headerActionsRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
        setInviteMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadMembers() {
    if (!orgId || !canAccessAdmin) return;
    const data = await api<Member[]>(`/api/auth/organizations/${orgId}/members`);
    setMembers(data);
  }

  async function loadAiSettings() {
    if (!orgId || !canAccessAdmin) return;
    const data = await api<AiSettings>(`/api/orgs/${orgId}/ai-settings`);
    setAiSettings(data);
    setAiForm((prev) => ({
      ...prev,
      provider: data.provider,
      model: data.model,
      api_key: "",
      clear_key: false,
    }));
  }

  async function loadLabSettings() {
    if (!orgId || !canAccessAdmin) return;
    const data = await api<LabSettings>(`/api/orgs/${orgId}/lab-settings`);
    setLabSettings(data);
    setLabForm({
      company_name: data.company_name,
      gst_number: data.gst_number,
      contact_person_name: data.contact_person_name,
      mobile_number: data.mobile_number,
      email_id: data.email_id,
      address: data.address,
      pin_code: data.pin_code,
      city: data.city,
      state: data.state,
      country: data.country,
    });
  }

  useEffect(() => {
    if (!canAccessAdmin) return;
    if (section === "lab") loadLabSettings().catch((e) => setLabError(e.message));
    if (section === "users") loadMembers().catch((e) => setError(e.message));
    if (section === "ai") loadAiSettings().catch((e) => setAiError(e.message));
  }, [orgId, canAccessAdmin, section]);

  async function onSaveLab(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setLabBusy(true);
    setLabError("");
    try {
      const data = await api<LabSettings>(`/api/orgs/${orgId}/lab-settings`, {
        method: "PUT",
        body: JSON.stringify(labForm),
      });
      setLabSettings(data);
      await refresh();
    } catch (err) {
      setLabError(err instanceof Error ? err.message : "Save Failed");
    } finally {
      setLabBusy(false);
    }
  }

  async function onUploadAsset(assetType: string, file: File | null) {
    if (!orgId || !file) return;
    setAssetBusy(assetType);
    setLabError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getToken();
      const res = await fetch(`${getApiUrl()}/api/orgs/${orgId}/lab-settings/assets/${assetType}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Upload Failed");
      }
      const data = (await res.json()) as LabSettings;
      setLabSettings(data);
    } catch (err) {
      setLabError(err instanceof Error ? err.message : "Upload Failed");
    } finally {
      setAssetBusy(null);
    }
  }

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
      setInviteMenuOpen(false);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite Failed");
    }
  }

  async function onSaveAi(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setAiBusy(true);
    setAiError("");
    try {
      const data = await api<AiSettings>(`/api/orgs/${orgId}/ai-settings`, {
        method: "PUT",
        body: JSON.stringify({
          provider: aiForm.provider,
          model: aiForm.model,
          api_key: aiForm.api_key.trim() || null,
          clear_key: aiForm.clear_key,
        }),
      });
      setAiSettings(data);
      setAiForm((prev) => ({ ...prev, api_key: "", clear_key: false }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Save Failed");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="page-title">{SECTION_TITLE[section] || "Settings"}</h1>
      </div>

      {section === "lab" && canAccessAdmin && (
        <form onSubmit={onSaveLab} className="card p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {(
                [
                  ["company_name", "Company Name"],
                  ["gst_number", "GST Number"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-[var(--muted)]">{label}</label>
                  <input
                    className="input mt-1"
                    type="text"
                    required={key === "company_name"}
                    value={labForm[key]}
                    onChange={(e) => setLabForm({ ...labForm, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {(
                [
                  ["contact_person_name", "Contact Person Name"],
                  ["mobile_number", "Mobile Number"],
                  ["email_id", "Email ID"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-[var(--muted)]">{label}</label>
                  <input
                    className="input mt-1"
                    type={key === "email_id" ? "email" : key === "mobile_number" ? "tel" : "text"}
                    value={labForm[key]}
                    onChange={(e) => setLabForm({ ...labForm, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Address</label>
              <input
                className="input mt-1"
                value={labForm.address}
                onChange={(e) => setLabForm({ ...labForm, address: e.target.value })}
              />
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              {(
                [
                  ["pin_code", "PIN Code"],
                  ["city", "City"],
                  ["state", "State"],
                  ["country", "Country"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-[var(--muted)]">{label}</label>
                  <input
                    className="input mt-1"
                    value={labForm[key]}
                    onChange={(e) => setLabForm({ ...labForm, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--line)] pt-6">
            <h2 className="font-semibold mb-4">Branding Assets</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {LAB_ASSETS.map(([assetType, label, keyField]) => {
                const assetKey = labSettings?.[keyField as keyof LabSettings] as string | null;
                return (
                  <div key={assetType} className="border border-[var(--line)] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs text-[var(--muted)]">{label}</label>
                      <label className="btn btn-ghost cursor-pointer inline-flex shrink-0">
                        {assetBusy === assetType ? "Uploading…" : "Upload Image"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={assetBusy !== null}
                          onChange={(e) => onUploadAsset(assetType, e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                    {assetKey && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={fileUrl(assetKey)}
                        alt={label}
                        className="max-h-24 border border-[var(--line)] object-contain bg-white w-full"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {labError && <p className="text-sm text-[var(--danger)]">{labError}</p>}
          <button className="btn btn-primary" type="submit" disabled={labBusy}>
            {labBusy ? "Saving…" : "Save Laboratory Settings"}
          </button>
        </form>
      )}

      {section === "users" && canAccessAdmin && (
        <section className="card p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="font-semibold">User Management</h2>
            <div className="flex flex-wrap items-center gap-2 shrink-0" ref={headerActionsRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setInviteMenuOpen(false);
                    setRoleMenuOpen((open) => !open);
                  }}
                  className="btn btn-ghost flex items-center gap-2"
                >
                  Role Model
                  <ChevronDown size={16} className={roleMenuOpen ? "rotate-180" : ""} />
                </button>
                {roleMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-2rem))] border border-[var(--line)] bg-white shadow-[var(--shadow-lg)] p-4">
                    <ul className="text-sm text-[var(--muted)] space-y-1.5">
                      {ROLE_MODEL.map(([role, desc]) => (
                        <li key={role}>
                          <b className="text-[var(--ink)]">{role}</b> — {desc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setRoleMenuOpen(false);
                    setInviteMenuOpen((open) => !open);
                  }}
                  className="btn btn-primary flex items-center gap-2"
                >
                  Add Employee
                  <ChevronDown size={16} className={inviteMenuOpen ? "rotate-180" : ""} />
                </button>
                {inviteMenuOpen && (
                  <form
                    onSubmit={onInvite}
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(360px,calc(100vw-2rem))] border border-[var(--line)] bg-white shadow-[var(--shadow-lg)] p-5 space-y-4"
                  >
                    {(
                      [
                        ["full_name", "Full Name", "text"],
                        ["email", "Email", "email"],
                        ["password", "Temp Password", "password"],
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
                            {formatRole(r)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
                    <button className="btn btn-primary w-full" type="submit">
                      Add Employee
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-hidden border border-[var(--line)]">
            <table className="w-full text-sm">
              <thead className="table-head">
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
                    <td className="px-4 py-3">{formatRole(m.role)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {section === "roles" && canAccessAdmin && (
        <section className="card p-6 space-y-4">
          <h2 className="font-semibold">Roles & Module Access</h2>
          <ul className="text-sm text-[var(--muted)] space-y-1.5">
            {ROLE_MODEL.map(([role, desc]) => (
              <li key={role}>
                <b className="text-[var(--ink)]">{role}</b> — {desc}
              </li>
            ))}
          </ul>
          <div className="border-t border-[var(--line)] pt-4">
            <h3 className="text-sm font-semibold mb-2">Analysis Modules</h3>
            <ul className="text-sm text-[var(--muted)] space-y-1">
              {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((key) => (
                <li key={key}>{ANALYSIS_LABELS[key]}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {section === "ai" && canAccessAdmin && (
        <form onSubmit={onSaveAi} className="card p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-semibold">AI Setting</h2>
            <span className={`badge ${aiSettings?.configured ? "badge-ok" : "badge-warn"}`}>
              {aiSettings?.configured ? "API Key Configured" : "Not Configured"}
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--muted)]">AI Provider</label>
              <select
                className="input mt-1"
                value={aiForm.provider}
                onChange={(e) =>
                  setAiForm({
                    ...aiForm,
                    provider: e.target.value,
                    model: e.target.value === "deepseek" ? "deepseek-v4-flash-vision-exp" : "gpt-4o-mini",
                  })
                }
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Model</label>
              <input
                className="input mt-1"
                value={aiForm.model}
                onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--muted)]">API Key</label>
              <input
                className="input mt-1"
                type="password"
                value={aiForm.api_key}
                onChange={(e) => setAiForm({ ...aiForm, api_key: e.target.value, clear_key: false })}
                placeholder={
                  aiSettings?.api_key_hint
                    ? `Saved Key ${aiSettings.api_key_hint} — Enter New Key to Replace`
                    : "Paste Your DeepSeek API Key"
                }
                autoComplete="off"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={aiForm.clear_key}
              onChange={(e) => setAiForm({ ...aiForm, clear_key: e.target.checked, api_key: "" })}
            />
            Remove Saved API Key
          </label>
          {aiError && <p className="text-sm text-[var(--danger)]">{aiError}</p>}
          <button className="btn btn-primary" type="submit" disabled={aiBusy}>
            {aiBusy ? "Saving…" : "Save AI Settings"}
          </button>
        </form>
      )}

      {section === "contact" && (
        <section className="card p-6 space-y-3">
          <h2 className="font-semibold">Contact Us</h2>
          <p className="text-sm text-[var(--muted)]">
            For Laboratory Support, Billing, or Technical Assistance, Reach Out to Your Account Team.
          </p>
          <div className="text-sm space-y-1">
            <p><b>Email:</b> support@metallurgylab.app</p>
            <p><b>Lab:</b> {org?.name || "—"}</p>
          </div>
        </section>
      )}

      {section === "help" && (
        <section className="card p-6 space-y-3">
          <h2 className="font-semibold">Help</h2>
          <ul className="text-sm text-[var(--muted)] space-y-2 list-disc pl-5">
            <li>Use Capture Studio to Upload or Capture Microscope Images.</li>
            <li>Set Calibration Before Running Grain Size or Depth Analysis.</li>
            <li>Software Results Are Primary; AI Comparison Is Advisory Only.</li>
            <li>Reviewers Can Approve or Reject Jobs From the Job Detail Page.</li>
          </ul>
        </section>
      )}

      {canAccessAdmin && !["lab", "users", "roles", "ai", "contact", "help"].includes(section) && (
        <p className="text-sm text-[var(--muted)]">Select a Settings Option From the Profile Menu.</p>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="text-[var(--muted)]">Loading Settings…</div>}>
      <AdminContent />
    </Suspense>
  );
}
