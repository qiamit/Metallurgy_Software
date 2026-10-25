import { Camera, Loader2, Save, Upload, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";

import {
  RingEditor,
  type RingEditorToolbarApi,
  type RingEditorToolbarState,
} from "@/features/ring-test/RingEditor";
import type { Circle, DiameterBox, RingResult } from "@/features/ring-test/analysis";
import type { AnalysisResults } from "@/features/ring-test/types";
import {
  clearNewTestDraft,
  loadNewTestDraft,
  saveNewTestDraft,
  type EditorGeometryDraft,
} from "@/features/ring-test/draft";
import { todayIso, timeNowHHMM } from "@/features/ring-test/utils";

import { saveTest } from "@/features/ring-test/ringTestApi";
import { assertMicrographUpload } from "@/lib/validateUpload";

interface Style {
  inner: { color: string; width: number };
  outer: { color: string; width: number };
  diam: { color: string; width: number };
  thick: { color: string; width: number };
}

interface Defaults {
  mmPerPxOverride: number | null;
  angularCorrectionDeg: number;
  thicknessOuterGapPx: number;
  thicknessInnerGapPx: number;
  units: string;
  style?: Partial<Style>;
}

export function RingTestWorkflow({ defaults }: { defaults: Defaults }) {
  const [draftReady, setDraftReady] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imgDim, setImgDim] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const [sampleDescription, setSampleDescription] = useState("");
  const [sampleDiameter, setSampleDiameter] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [testerName, setTesterName] = useState("");
  const [testDate, setTestDate] = useState(todayIso());
  const [testTime, setTestTime] = useState(timeNowHHMM());
  const [observations, setObservations] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [operatorNameInput, setOperatorNameInput] = useState("");
  const [observationInput, setObservationInput] = useState("");

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisMounted, setAnalysisMounted] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  const [result, setResult] = useState<RingResult | null>(null);
  const [geometry, setGeometry] = useState<EditorGeometryDraft | null>(null);
  const [editorMetrics, setEditorMetrics] = useState<{
    mmPerPx: number;
    thicknessMean: number | null;
    thicknessPoints: number;
    fpAreaPx2: number | null;
    tmAreaPx2: number | null;
    totalAreaPx2: number | null;
    tmAreaPercent: number | null;
    diameterLineCount: number;
    diameterSinglePx: number | null;
    diameterAveragePx: number | null;
    diameterSingleMm: number | null;
    diameterAverageMm: number | null;
    thicknessEnabled: boolean;
  }>({
    mmPerPx: 0,
    thicknessMean: null,
    thicknessPoints: 0,
    fpAreaPx2: null,
    tmAreaPx2: null,
    totalAreaPx2: null,
    tmAreaPercent: null,
    diameterLineCount: 0,
    diameterSinglePx: null,
    diameterAveragePx: null,
    diameterSingleMm: null,
    diameterAverageMm: null,
    thicknessEnabled: false,
  });
  const [editorState, setEditorState] = useState<{
    inner: Circle | null;
    outer: Circle | null;
    diam: DiameterBox | null;
  }>({ inner: null, outer: null, diam: null });

  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const editorSnapshotRef = useRef<(() => string | null) | null>(null);
  const editorToolbarApiRef = useRef<RingEditorToolbarApi | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [editorToolbar, setEditorToolbar] = useState<RingEditorToolbarState>({
    mmpxActive: false,
    imgReady: false,
  });
  const [cameraOn, setCameraOn] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  useLayoutEffect(() => {
    const draft = loadNewTestDraft();
    if (draft) {
      setImageSrc(draft.imageSrc);
      setImgDim(draft.imgDim);
      setSampleDescription(draft.sampleDescription);
      setSampleDiameter(draft.sampleDiameter);
      setBatchNumber(draft.batchNumber);
      setMfgDate(draft.mfgDate);
      setTesterName(draft.testerName);
      setTestDate(draft.testDate || todayIso());
      setTestTime(draft.testTime || timeNowHHMM());
      setObservations(draft.observations);
      setGeometry(draft.geometry);
      setResult(draft.result);
      setEditorState({
        inner: draft.geometry?.inner ?? null,
        outer: draft.geometry?.outer ?? null,
        diam: draft.geometry?.diam ?? null,
      });
      if (draft.imageSrc || draft.geometry) {
        setAnalysisMounted(true);
      }
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    saveNewTestDraft({
      imageSrc,
      imgDim,
      sampleDescription,
      sampleDiameter,
      batchNumber,
      mfgDate,
      testerName,
      testDate,
      testTime,
      observations,
      geometry,
      result,
    });
  }, [
    draftReady,
    imageSrc,
    imgDim,
    sampleDescription,
    sampleDiameter,
    batchNumber,
    mfgDate,
    testerName,
    testDate,
    testTime,
    observations,
    geometry,
    result,
  ]);

  const handleFile = useCallback((file: File) => {
    try {
      assertMicrographUpload(file);
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : "Invalid image file." });
      return;
    }
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const targetW = 590;
      const targetH = 590;
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        setToast({ kind: "err", text: "Could not process image for upload." });
        return;
      }
      ctx.drawImage(im, 0, 0, targetW, targetH);
      const resizedUrl = canvas.toDataURL("image/png");
      URL.revokeObjectURL(url);
      setImgDim({ w: targetW, h: targetH });
      setImageSrc(resizedUrl);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      setToast({ kind: "err", text: "Invalid image file." });
    };
    im.src = url;
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const startCamera = useCallback(async () => {
    if (cameraOn) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch (err) {
      setToast({ kind: "err", text: `Camera access denied: ${(err as Error).message}` });
    }
  }, [cameraOn]);

  useEffect(() => {
    if (!cameraOn || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
  }, [cameraOn]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const validateSampleInfo = useCallback(() => {
    if (!sampleDescription.trim()) return "Enter Sample Description.";
    if (!sampleDiameter || Number(sampleDiameter) <= 0) return "Enter a valid Sample Diameter (mm).";
    if (!batchNumber.trim()) return "Enter Batch Number.";
    if (!mfgDate) return "Select MFG Date.";
    return null;
  }, [sampleDescription, sampleDiameter, batchNumber, mfgDate]);

  const captureFromCamera = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/png");
    setImgDim({ w: canvas.width, h: canvas.height });
    setImageSrc(url);
    stopCamera();
  }, [stopCamera]);

  const onSave = useCallback(async (overrides?: { testerName?: string; observations?: string }) => {
    const effectiveTesterName = (overrides?.testerName ?? testerName).trim();
    const effectiveObservations = (overrides?.observations ?? observations).trim();
    if (!imageSrc || !result || !editorState.inner || !editorState.outer) {
      setToast({ kind: "err", text: "Place inner and outer rings, then enter sample diameter." });
      return;
    }
    const sampleError = validateSampleInfo();
    if (sampleError) {
      setToast({ kind: "err", text: sampleError });
      return;
    }
    const annotated = editorSnapshotRef.current?.() ?? null;
    if (!annotated) {
      setToast({ kind: "err", text: "Could not capture editor screenshot. Please try again." });
      return;
    }

    const analysisResults: AnalysisResults = {
      sample_diameter_mm: Number(sampleDiameter),
      mm_per_px:
        editorMetrics.mmPerPx > 0
          ? editorMetrics.mmPerPx
          : defaults.mmPerPxOverride && defaults.mmPerPxOverride > 0
            ? defaults.mmPerPxOverride
            : 0,
      inner_circle: editorState.inner,
      outer_circle: editorState.outer,
      diameter_box: editorState.diam,
      thickness_measurements: result.thicknessPairs.map((p) => ({
        label: p.label,
        angle_deg: p.angle_deg,
        thickness_mm: p.thickness_mm,
        inner_xy: p.inner_xy,
        outer_xy: p.outer_xy,
        rib_shift_deg: p.rib_shift_deg ?? 0,
        rib_core: p.rib_core ?? false,
        uncertain: p.uncertain ?? false,
      })),
      thickness_min_mm: result.thicknessMin,
      thickness_max_mm: result.thicknessMax,
      thickness_mean_mm: result.thicknessMean,
      thickness_in_range: result.thicknessInRange,
      thickness_range_low_mm: result.thicknessLow,
      thickness_range_high_mm: result.thicknessHigh,
      area_tm_mm2: result.areaTM,
      area_fp_mm2: result.areaFP,
      tm_area_fraction_percent: result.tmShare,
      tm_area_share_in_range: result.tmShareInRange,
      overall_pass: result.overallPass,
      observations: effectiveObservations,
      nominal_diameter_mm: result.nominalDiameterMm ?? null,
      measured_diameter_mm: result.measuredDiameterMm ?? null,
      equivalent_diameter_mm: result.equivalentDiameterMm ?? null,
      concentricity_mm: result.concentricityMm ?? null,
      thickness_spread_mm: result.thicknessSpreadMm ?? null,
      rib_mode: result.ribMode,
      warnings: result.warnings ?? [],
    };

    startTransition(async () => {
      const res = await saveTest({
        sample_description: sampleDescription,
        sample_diameter_mm: Number(sampleDiameter),
        batch_number: batchNumber,
        mfg_date: mfgDate,
        tester_name: effectiveTesterName,
        test_date: testDate,
        test_time: testTime,
        observations: effectiveObservations,
        results: analysisResults,
        imageDataUrl: annotated,
      });
      if (res.ok) {
        setToast({ kind: "ok", text: "Saved to your account." });
        clearNewTestDraft();
        setImageSrc(null);
        setImgDim({ w: 0, h: 0 });
        setResult(null);
        setGeometry(null);
        setEditorState({ inner: null, outer: null, diam: null });
        setSampleDescription("");
        setSampleDiameter("");
        setBatchNumber("");
        setMfgDate("");
        setObservations("");
        setTestDate(todayIso());
        setTestTime(timeNowHHMM());
        setEditorKey((k) => k + 1);
        setResultsOpen(false);
        setAnalysisOpen(false);
        setAnalysisMounted(false);
      } else {
        setToast({ kind: "err", text: res.error });
      }
    });
  }, [
    imageSrc,
    result,
    editorState,
    sampleDescription,
    sampleDiameter,
    batchNumber,
    mfgDate,
    testerName,
    testDate,
    testTime,
    observations,
    defaults,
    editorMetrics.mmPerPx,
    validateSampleInfo,
  ]);

  const deleteImage = useCallback(() => {
    stopCamera();
    setImageSrc(null);
    setImgDim({ w: 0, h: 0 });
    setResult(null);
    setGeometry(null);
    setEditorState({ inner: null, outer: null, diam: null });
    setEditorKey((k) => k + 1);
  }, [stopCamera]);

  const openSaveDialog = useCallback(() => {
    setOperatorNameInput(testerName);
    setObservationInput(observations);
    setSaveDialogOpen(true);
  }, [testerName, observations]);

  const confirmSaveFromDialog = useCallback(async () => {
    await onSave({ testerName: operatorNameInput, observations: observationInput });
    setTesterName(operatorNameInput.trim());
    setObservations(observationInput.trim());
    setSaveDialogOpen(false);
  }, [onSave, operatorNameInput, observationInput]);

  const openAnalysis = useCallback(() => {
    const sampleError = validateSampleInfo();
    if (sampleError) {
      setToast({ kind: "err", text: `${sampleError} before analysis.` });
      return;
    }
    setAnalysisMounted(true);
    setAnalysisOpen(true);
    setToast(null);
  }, [validateSampleInfo]);

  const closeAnalysis = useCallback(() => {
    stopCamera();
    setResultsOpen(false);
    setAnalysisOpen(false);
  }, [stopCamera]);

  const verdictReady = !!result && editorMetrics.thicknessEnabled;
  const verdictLabel = !verdictReady ? "IN-PROGRESS" : result.overallPass ? "PASS" : "FAIL";
  const verdictClass = !verdictReady
    ? "pill-neutral"
    : result.overallPass
      ? "pill-pass"
      : "pill-fail";

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileInput}
      />

      {toast ? (
        <div
          className={
            toast.kind === "ok"
              ? "rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          }
        >
          {toast.text}
        </div>
      ) : null}

      {/* Step 1 — Sample Information */}
      <div className="max-w-xl">
        <div className="card h-fit space-y-4 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-white">Sample Information</h2>
          <Field label="Sample Description" required>
            <input
              value={sampleDescription}
              onChange={(e) => setSampleDescription(e.target.value)}
              className="input"
              placeholder="e.g. TMT ring specimen"
              required
            />
          </Field>
          <Field label="Sample Diameter in mm" required>
            <input
              type="number"
              step="0.01"
              value={sampleDiameter}
              onChange={(e) => setSampleDiameter(e.target.value)}
              className="input"
              placeholder="e.g. 12"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Batch Number" required>
              <input
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="input"
                placeholder="e.g. B-001"
                required
              />
            </Field>
            <Field label="MFG Date" required>
              <input
                type="date"
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                className="input"
                required
              />
            </Field>
          </div>
          <button type="button" className="btn-primary w-full" onClick={openAnalysis}>
            Do Analysis
          </button>
        </div>

      </div>

      {/* Step 2 — Analysis window (RingEditor) */}
      {analysisMounted && draftReady ? (
        <div
          className={
            analysisOpen
              ? "fixed inset-0 z-40 flex flex-col bg-slate-950"
              : "hidden"
          }
          aria-hidden={!analysisOpen}
        >
          <header className="flex shrink-0 flex-col gap-2 border-b border-[--color-border] px-2 py-2 sm:flex-row sm:items-center sm:gap-2 sm:overflow-x-auto sm:px-4">
            <h2 className="shrink-0 text-sm font-semibold whitespace-nowrap text-white">
              Do Analysis
            </h2>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:flex-nowrap sm:gap-2">
              <button
                type="button"
                className="btn-secondary shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                Upload
              </button>
              {!cameraOn ? (
                <button
                  type="button"
                  className="btn-secondary shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
                  onClick={startCamera}
                >
                  <Camera size={14} />
                  Camera
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-primary shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
                    onClick={captureFromCamera}
                  >
                    <Camera size={14} />
                    Capture
                  </button>
                  <button
                    type="button"
                    className="btn-secondary shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
                    onClick={stopCamera}
                  >
                    <X size={14} />
                    Stop
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => editorToolbarApiRef.current?.openMmpx()}
                className={
                  editorToolbar.mmpxActive
                    ? "btn-secondary shrink-0 px-2.5 text-xs ring-2 ring-[var(--rt-accent)] sm:px-3 sm:text-sm"
                    : "btn-secondary shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
                }
              >
                mm/px
              </button>
              <button
                type="button"
                className="btn-primary shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
                onClick={() => setResultsOpen(true)}
              >
                Result
              </button>
              <button
                type="button"
                className="btn-secondary shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
                onClick={closeAnalysis}
              >
                <X size={14} />
                Close
              </button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
            <RingEditor
              key={editorKey}
              imageSrc={imageSrc}
              imageWidth={imgDim.w}
              imageHeight={imgDim.h}
              sampleDiameterMm={sampleDiameter ? Number(sampleDiameter) : null}
              mmPerPxOverride={defaults.mmPerPxOverride}
              angularCorrectionDeg={defaults.angularCorrectionDeg}
              thicknessOuterGapPx={defaults.thicknessOuterGapPx}
              thicknessInnerGapPx={defaults.thicknessInnerGapPx}
              style={defaults.style}
              initialGeometry={geometry}
              onResult={setResult}
              onStateChange={setEditorState}
              onGeometryChange={setGeometry}
              onMetricsChange={setEditorMetrics}
              cameraOn={cameraOn}
              cameraVideoRef={videoRef}
              onDeleteImage={deleteImage}
              snapshotRef={editorSnapshotRef}
              onImageReplace={(nextImageSrc, dims) => {
                setImageSrc(nextImageSrc);
                setImgDim(dims);
              }}
              hideHeaderToolsInSidebar
              toolbarApiRef={editorToolbarApiRef}
              onToolbarStateChange={setEditorToolbar}
              canvasOverlay={
                <button
                  type="button"
                  className={`${verdictClass} pointer-events-auto cursor-pointer px-3 py-1.5 text-xs font-semibold shadow-lg`}
                  onClick={() => setResultsOpen(true)}
                  title="View analysis result"
                >
                  {verdictLabel}
                </button>
              }
            />
          </div>
        </div>
      ) : null}

      {/* Step 3 — Results window */}
      {resultsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
          <div className="flex max-h-[min(920px,100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[--color-border] bg-slate-950 shadow-2xl">
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[--color-border] px-4 py-3">
              <h2 className="text-sm font-semibold text-white sm:text-base">Analysis Results</h2>
              <button type="button" className="btn-ghost" onClick={() => setResultsOpen(false)}>
                <X size={14} />
                Close
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ResultsPanel result={result} editorMetrics={editorMetrics} />
            </div>
            <footer className="flex shrink-0 justify-end gap-2 border-t border-[--color-border] px-4 py-3">
              <button type="button" className="btn-ghost" onClick={() => setResultsOpen(false)}>
                Back to Analysis
              </button>
              <button type="button" disabled={pending} className="btn-primary" onClick={openSaveDialog}>
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Result
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {saveDialogOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[--color-border] bg-slate-950 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Save Test Result</h3>
            <div className="space-y-3">
              <Field label="Operator Name">
                <input
                  value={operatorNameInput}
                  onChange={(e) => setOperatorNameInput(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Observation">
                <textarea
                  value={observationInput}
                  onChange={(e) => setObservationInput(e.target.value)}
                  className="input min-h-[84px]"
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSaveDialogOpen(false)} className="btn-ghost">
                Cancel
              </button>
              <button type="button" disabled={pending} onClick={confirmSaveFromDialog} className="btn-primary">
                {pending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-1 block">
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function ResultsPanel({
  result,
  editorMetrics,
}: {
  result: RingResult | null;
  editorMetrics: {
    mmPerPx: number;
    fpAreaPx2: number | null;
    tmAreaPx2: number | null;
    totalAreaPx2: number | null;
    tmAreaPercent: number | null;
    diameterLineCount: number;
    diameterSinglePx: number | null;
    diameterAveragePx: number | null;
    diameterSingleMm: number | null;
    diameterAverageMm: number | null;
    thicknessEnabled: boolean;
  };
}) {
  const areaToMm2 = (areaPx2: number | null) =>
    areaPx2 !== null && editorMetrics.mmPerPx > 0 ? areaPx2 * editorMetrics.mmPerPx * editorMetrics.mmPerPx : null;
  const mm = (v: number | null | undefined, d = 3) => (v != null && Number.isFinite(v) ? `${v.toFixed(d)} mm` : "----");
  const designationOrder = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
  const sortedPairs = result
    ? [...result.thicknessPairs].sort(
        (a, b) => designationOrder.indexOf(a.label.toLowerCase()) - designationOrder.indexOf(b.label.toLowerCase()),
      )
    : Array.from({ length: 8 }, (_, i) => ({ label: `t${i + 1}`, angle_deg: i * 45, thickness_mm: null, uncertain: false, rib_shift_deg: 0, rib_core: false }));
  const showThickness = !!result && editorMetrics.thicknessEnabled;
  const inRange = (v: number | null) =>
    v !== null && result ? v >= result.thicknessLow && v <= result.thicknessHigh : true;
  const rows: Array<[string, string]> = [
    ["Minimum", showThickness ? mm(result?.thicknessMin) : "----"],
    ["Maximum", showThickness ? mm(result?.thicknessMax) : "----"],
    ["Average", showThickness ? mm(result?.thicknessMean) : "----"],
    ["Spread (Max − Min)", showThickness ? mm(result?.thicknessSpreadMm) : "----"],
    ["Total Area", areaToMm2(editorMetrics.totalAreaPx2) !== null ? `${areaToMm2(editorMetrics.totalAreaPx2)!.toFixed(2)} mm²` : "----"],
    ["F&P Area", areaToMm2(editorMetrics.fpAreaPx2) !== null ? `${areaToMm2(editorMetrics.fpAreaPx2)!.toFixed(2)} mm²` : "----"],
    ["TM Area", areaToMm2(editorMetrics.tmAreaPx2) !== null ? `${areaToMm2(editorMetrics.tmAreaPx2)!.toFixed(2)} mm²` : "----"],
    ["TM Area %", editorMetrics.tmAreaPercent !== null ? `${editorMetrics.tmAreaPercent.toFixed(2)} %` : "----"],
    ["Nominal Ø", mm(result?.nominalDiameterMm, 2)],
    ["Measured Ø", mm(result?.measuredDiameterMm, 2)],
    ["Equivalent Ø", mm(result?.equivalentDiameterMm, 2)],
    ["Concentricity", mm(result?.concentricityMm)],
    ["mm/px", editorMetrics.mmPerPx > 0 ? editorMetrics.mmPerPx.toFixed(5) : "----"],
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Analysis</h3>
        <span
          className={
            !result || !editorMetrics.thicknessEnabled
              ? "pill-neutral"
              : result.overallPass
                ? "pill-pass"
                : "pill-fail"
          }
        >
          {!result || !editorMetrics.thicknessEnabled ? "IN-PROGRESS" : result.overallPass ? "PASS" : "FAIL"}
        </span>
      </div>
      <div className="grid gap-3 text-xs sm:grid-cols-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-800/60 text-slate-200">
              <th className="border border-[--color-border] p-1.5 text-center">Point</th>
              <th className="border border-[--color-border] p-1.5 text-center">Thickness</th>
              <th className="border border-[--color-border] p-1.5 text-center">Ray</th>
            </tr>
          </thead>
          <tbody>
            {sortedPairs.map((p) => (
              <tr key={p.label} className={p.uncertain ? "text-red-300" : "text-slate-100"}>
                <td className="border border-[--color-border] px-2 py-1 text-center">{p.label.toUpperCase()}</td>
                <td
                  className={`border border-[--color-border] px-2 py-1 text-center font-mono ${
                    showThickness && !inRange(p.thickness_mm) ? "text-red-300" : ""
                  }`}
                >
                  {showThickness && p.thickness_mm !== null ? p.thickness_mm.toFixed(3) : "----"}
                </td>
                <td className="border border-[--color-border] px-2 py-1 text-center text-slate-400">
                  {p.rib_core ? "core" : p.rib_shift_deg ? `${p.angle_deg + p.rib_shift_deg}°` : `${p.angle_deg}°`}
                  {p.uncertain ? " · check" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full border-collapse">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="border border-[--color-border] px-2 py-1 text-slate-400">{k}</td>
                <td className="border border-[--color-border] px-2 py-1 text-center font-mono text-slate-100">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border border-[--color-border] bg-slate-900/40 px-2 py-1.5 text-center text-xs text-slate-300">
        Requirement: Thickness{" "}
        {result ? `${result.thicknessLow.toFixed(3)} – ${result.thicknessHigh.toFixed(3)} mm (0.07d – 0.15d)` : "----"} · TM
        Area 30 – 50 %
      </div>
      {result?.warnings?.length ? (
        <ul className="space-y-1 border-l-4 border-amber-400 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
