"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getApiUrl, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ANALYSIS_LABELS,
  type AnalysisType,
  type Calibration,
  type Sample,
} from "@/lib/types";

export default function CapturePage() {
  const { orgId } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cals, setCals] = useState<Calibration[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sampleCode, setSampleCode] = useState("");
  const [sampleId, setSampleId] = useState("");
  const [calibrationId, setCalibrationId] = useState("");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("grain_size");
  const [runAi, setRunAi] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      api<Calibration[]>(`/api/orgs/${orgId}/calibrations`),
      api<Sample[]>(`/api/orgs/${orgId}/samples`),
    ]).then(([c, s]) => {
      setCals(c);
      setSamples(s);
      if (c[0]) setCalibrationId(c[0].id);
      if (s[0]) setSampleId(s[0].id);
    });
  }, [orgId]);

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreamReady(true);
      }
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : "Camera unavailable — use Upload instead.",
      );
    }
  }

  function stopCamera() {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    setStreamReady(false);
  }

  function snap() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((b) => {
      if (!b) return;
      setBlob(b);
      setPreview(URL.createObjectURL(b));
    }, "image/jpeg", 0.92);
  }

  function onUpload(file: File | null) {
    if (!file) return;
    setBlob(file);
    setPreview(URL.createObjectURL(file));
  }

  async function ensureSample(): Promise<string> {
    if (sampleId) return sampleId;
    if (!orgId || !sampleCode.trim()) throw new Error("Enter a sample code");
    const sample = await api<Sample>(`/api/orgs/${orgId}/samples`, {
      method: "POST",
      body: JSON.stringify({ sample_code: sampleCode.trim(), material: "" }),
    });
    setSampleId(sample.id);
    setSamples((prev) => [sample, ...prev]);
    return sample.id;
  }

  async function submit() {
    if (!orgId || !blob) return;
    setBusy(true);
    setError("");
    try {
      const sid = await ensureSample();
      const fd = new FormData();
      fd.append("sample_id", sid);
      fd.append("analysis_type", analysisType);
      if (calibrationId) fd.append("calibration_id", calibrationId);
      fd.append("run_ai", String(runAi));
      fd.append("file", blob, "capture.jpg");

      const token = getToken();
      const res = await fetch(`${getApiUrl()}/api/orgs/${orgId}/jobs`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Analysis failed");
      }
      const job = await res.json();
      stopCamera();
      router.push(`/app/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Capture Studio</h1>
        <p className="text-[var(--muted)] mt-1">
          Live USB webcam capture or image upload when the camera is unavailable.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-4 space-y-3">
          <div className="aspect-video bg-[#111827] rounded-lg overflow-hidden relative">
            <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
            {!streamReady && (
              <div className="absolute inset-0 grid place-items-center text-white/70 text-sm px-6 text-center">
                Camera preview will appear here. If the microscope USB camera is not
                exposed as a webcam, use Upload.
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex flex-wrap gap-2">
            {!streamReady ? (
              <button className="btn btn-primary" onClick={startCamera} type="button">
                Start camera
              </button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={snap} type="button">
                  Capture frame
                </button>
                <button className="btn btn-ghost" onClick={stopCamera} type="button">
                  Stop camera
                </button>
              </>
            )}
            <label className="btn btn-ghost cursor-pointer">
              Upload image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          {cameraError && <p className="text-sm text-[var(--warn)]">{cameraError}</p>}
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Analysis setup</h2>
          <div>
            <label className="text-xs text-[var(--muted)]">Existing sample</label>
            <select
              className="input mt-1"
              value={sampleId}
              onChange={(e) => setSampleId(e.target.value)}
            >
              <option value="">Create new below…</option>
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sample_code}
                </option>
              ))}
            </select>
          </div>
          {!sampleId && (
            <div>
              <label className="text-xs text-[var(--muted)]">New sample code</label>
              <input
                className="input mt-1"
                value={sampleCode}
                onChange={(e) => setSampleCode(e.target.value)}
                placeholder="e.g. HT-2026-001"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-[var(--muted)]">Calibration</label>
            <select
              className="input mt-1"
              value={calibrationId}
              onChange={(e) => setCalibrationId(e.target.value)}
            >
              <option value="">None (1 µm/px default)</option>
              {cals.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.objective}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--muted)]">Analysis module</label>
            <select
              className="input mt-1"
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}
            >
              {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((k) => (
                <option key={k} value={k}>
                  {ANALYSIS_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={runAi} onChange={(e) => setRunAi(e.target.checked)} />
            Also run AI advisory analysis & comparison
          </label>

          {preview && (
            <div>
              <div className="text-xs text-[var(--muted)] mb-1">Selected frame</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Selected" className="rounded-lg border border-[var(--line)] max-h-48 object-contain w-full bg-white" />
            </div>
          )}

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button className="btn btn-primary w-full" disabled={!blob || busy} onClick={submit} type="button">
            {busy ? "Analyzing…" : "Run software analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}
