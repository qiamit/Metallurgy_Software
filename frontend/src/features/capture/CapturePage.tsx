import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ImageEditToolbar } from "@/features/capture/ImageEditToolbar";
import { createCalibration, fetchCalibrations } from "@/features/calibrations/calibrationsApi";
import { createSample, fetchSamples } from "@/features/analysis/samplesApi";
import { createAndRunJob } from "@/features/analysis/analysisApi";
import { hasRole } from "@/lib/roles";
import { useAuth } from "@/hooks/useAuth";
import {
  drawArrow,
  drawDiamond,
  floodFillCanvas,
  getContainedImageRect,
  normalizeRect,
  pointerToImageCoords,
} from "@/features/capture/imageCanvasUtils";
import {
  DEFAULT_IMAGE_ADJUSTMENTS,
  type EditTool,
  type ImageAdjustments,
  renderEditedImage,
} from "@/features/capture/imageEditor";
import {
  ANALYSIS_LABELS,
  type AnalysisType,
  type Calibration,
  type Sample,
} from "@/types";

type SettingsPanel = "calibration" | "sample";
type CalibrationMode = "existing" | "new";
type SampleMode = "existing" | "new";

const DEFAULT_NEW_CALIBRATION = {
  name: "10X",
  objective: "10X",
  um_per_px_x: 0.65,
  um_per_px_y: 0.65,
  unit: "um",
  notes: "",
};

const DEFAULT_NEW_SAMPLE = {
  sample_code: "",
  material: "",
  description: "",
};

const PANEL_TITLES: Record<SettingsPanel, string> = {
  calibration: "Calibration",
  sample: "Sample Details",
};

const DRAWING_TOOLS: EditTool[] = [
  "pencil",
  "highlighter",
  "eraser",
  "text",
  "line",
  "arrow",
  "rectangle",
  "ellipse",
  "diamond",
  "crop",
  "fill",
  "marker",
  "eyedropper",
];

function SettingsModal({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        type="button"
      />
      <div
        className={`relative z-10 w-full border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-lg)] ${wide ? "max-w-2xl" : "max-w-lg"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h3 id="settings-modal-title" className="text-sm font-bold text-[var(--ink)]">
            {title}
          </h3>
          <button
            aria-label="Close"
            className="btn btn-ghost px-2 py-1"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export default function CapturePage() {
  const { orgId, role } = useAuth();
  const canAnalyze = hasRole(role, "analyst");
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationRef = useRef<HTMLCanvasElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const geomRef = useRef({
    rotation: DEFAULT_IMAGE_ADJUSTMENTS.rotation,
    flipH: DEFAULT_IMAGE_ADJUSTMENTS.flipH,
    flipV: DEFAULT_IMAGE_ADJUSTMENTS.flipV,
  });
  const annotationHistoryRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);

  const [streamReady, setStreamReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cals, setCals] = useState<Calibration[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sampleId, setSampleId] = useState("");
  const [sampleMode, setSampleMode] = useState<SampleMode>("existing");
  const [newSampleForm, setNewSampleForm] = useState(DEFAULT_NEW_SAMPLE);
  const [calibrationId, setCalibrationId] = useState("");
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>("existing");
  const [newCalForm, setNewCalForm] = useState(DEFAULT_NEW_CALIBRATION);
  const [calSaving, setCalSaving] = useState(false);
  const [calError, setCalError] = useState("");
  const [searchParams] = useSearchParams();
  const [analysisType, setAnalysisType] = useState<AnalysisType>(() => {
    const t = searchParams.get("type") as AnalysisType | null;
    return t && t in ANALYSIS_LABELS ? t : "grain_size";
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [, setBlob] = useState<Blob | null>(null);
  const [imageAdjustments, setImageAdjustments] = useState<ImageAdjustments>(
    DEFAULT_IMAGE_ADJUSTMENTS,
  );
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [activeTool, setActiveTool] = useState<EditTool>("select");
  const [strokeColor, setStrokeColor] = useState("#14b8a6");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({ display: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState<SettingsPanel | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const imageReady = Boolean(sourceBlob);
  const showImage = Boolean(preview);
  const showPlaceholder = !streamReady && !preview;
  const showLiveVideo = streamReady && !preview;
  const selectedSample = samples.find((s) => s.id === sampleId) ?? null;
  const canvasInteractive = imageReady && DRAWING_TOOLS.includes(activeTool);

  const syncHistoryFlags = useCallback((index: number, length: number) => {
    setCanUndo(index > 0);
    setCanRedo(index >= 0 && index < length - 1);
  }, []);

  const captureCanvasState = useCallback((): ImageData | null => {
    const canvas = annotationRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return null;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const applyCanvasState = useCallback((state: ImageData) => {
    const canvas = annotationRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.putImageData(state, 0, 0);
  }, []);

  const refreshPreviewFromAnnotations = useCallback(async () => {
    if (!sourceBlob) return;
    const edited = await renderEditedImage(
      sourceBlob,
      imageAdjustments,
      annotationRef.current,
    );
    setBlob(edited);
    const url = URL.createObjectURL(edited);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, [sourceBlob, imageAdjustments]);

  const resetAnnotationHistory = useCallback(() => {
    const blank = captureCanvasState();
    if (!blank) {
      annotationHistoryRef.current = [];
      historyIndexRef.current = -1;
      syncHistoryFlags(-1, 0);
      return;
    }
    annotationHistoryRef.current = [blank];
    historyIndexRef.current = 0;
    syncHistoryFlags(0, 1);
  }, [captureCanvasState, syncHistoryFlags]);

  const pushAnnotationHistory = useCallback(() => {
    const state = captureCanvasState();
    if (!state) return;
    const trimmed = annotationHistoryRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push(state);
    if (trimmed.length > 40) trimmed.shift();
    annotationHistoryRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    syncHistoryFlags(historyIndexRef.current, trimmed.length);
  }, [captureCanvasState, syncHistoryFlags]);

  const undoAnnotation = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const state = annotationHistoryRef.current[historyIndexRef.current];
    if (!state) return;
    applyCanvasState(state);
    syncHistoryFlags(historyIndexRef.current, annotationHistoryRef.current.length);
    void refreshPreviewFromAnnotations();
  }, [applyCanvasState, refreshPreviewFromAnnotations, syncHistoryFlags]);

  const redoAnnotation = useCallback(() => {
    if (historyIndexRef.current >= annotationHistoryRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const state = annotationHistoryRef.current[historyIndexRef.current];
    if (!state) return;
    applyCanvasState(state);
    syncHistoryFlags(historyIndexRef.current, annotationHistoryRef.current.length);
    void refreshPreviewFromAnnotations();
  }, [applyCanvasState, refreshPreviewFromAnnotations, syncHistoryFlags]);

  const clearAnnotations = useCallback(() => {
    const canvas = annotationRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const clearAnnotationsWithHistory = useCallback(() => {
    clearAnnotations();
    pushAnnotationHistory();
    void refreshPreviewFromAnnotations();
  }, [clearAnnotations, pushAnnotationHistory, refreshPreviewFromAnnotations]);

  const resetAllEdits = useCallback(() => {
    setImageAdjustments(DEFAULT_IMAGE_ADJUSTMENTS);
    geomRef.current = {
      rotation: DEFAULT_IMAGE_ADJUSTMENTS.rotation,
      flipH: DEFAULT_IMAGE_ADJUSTMENTS.flipH,
      flipV: DEFAULT_IMAGE_ADJUSTMENTS.flipV,
    };
    clearAnnotations();
    setPanOffset({ x: 0, y: 0 });
    setActiveTool("select");
    requestAnimationFrame(() => resetAnnotationHistory());
  }, [clearAnnotations, resetAnnotationHistory]);

  function clearPreview() {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSourceBlob(null);
    setBlob(null);
    setImageMeta(null);
    resetAllEdits();
    setActivePanel(null);
  }

  function setNewSource(nextBlob: Blob) {
    setSourceBlob(nextBlob);
    resetAllEdits();
  }

  function openPanel(panel: SettingsPanel) {
    if (panel === "calibration") {
      setCalError("");
    }
    setActivePanel(panel);
  }

  function selectExistingSample(id: string) {
    setSampleId(id);
    if (id) setSampleMode("existing");
  }

  async function saveNewCalibration() {
    if (!orgId) return;
    setCalSaving(true);
    setCalError("");
    try {
      const created = await createCalibration(orgId, newCalForm);
      setCals((prev) => [created, ...prev]);
      setCalibrationId(created.id);
      setCalibrationMode("existing");
      setNewCalForm(DEFAULT_NEW_CALIBRATION);
    } catch (err) {
      setCalError(err instanceof Error ? err.message : "Save Failed");
    } finally {
      setCalSaving(false);
    }
  }

  function closePanel() {
    setActivePanel(null);
  }

  const updateOverlayPosition = useCallback(() => {
    const panel = previewPanelRef.current;
    if (!panel || !imageMeta) {
      setOverlayStyle({ display: "none" });
      return;
    }
    const rect = panel.getBoundingClientRect();
    const contained = getContainedImageRect(
      rect.width,
      rect.height,
      imageMeta.width,
      imageMeta.height,
    );
    const zoomScale = imageAdjustments.zoom / 100;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const scaledW = contained.width * zoomScale;
    const scaledH = contained.height * zoomScale;
    setOverlayStyle({
      position: "absolute",
      left: centerX - scaledW / 2 + panOffset.x,
      top: centerY - scaledH / 2 + panOffset.y,
      width: scaledW,
      height: scaledH,
      zIndex: 3,
      cursor: canvasInteractive ? "crosshair" : activeTool === "hand" ? "grab" : "default",
      touchAction: "none",
    });
  }, [imageMeta, imageAdjustments.zoom, canvasInteractive, activeTool, panOffset]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (!sourceBlob) {
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setBlob(null);
      setImageMeta(null);
      return;
    }

    let cancelled = false;
    renderEditedImage(sourceBlob, imageAdjustments, annotationRef.current).then((edited) => {
      if (cancelled) return;
      const url = URL.createObjectURL(edited);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setBlob(edited);
      createImageBitmap(edited).then((bitmap) => {
        if (!cancelled) {
          setImageMeta({ width: bitmap.width, height: bitmap.height });
        }
        bitmap.close();
      });
    });

    return () => {
      cancelled = true;
    };
  }, [sourceBlob, imageAdjustments]);

  useEffect(() => {
    const canvas = annotationRef.current;
    if (!canvas || !imageMeta) return;

    const prev = geomRef.current;
    const geomChanged =
      prev.rotation !== imageAdjustments.rotation ||
      prev.flipH !== imageAdjustments.flipH ||
      prev.flipV !== imageAdjustments.flipV;

    if (geomChanged) {
      clearAnnotations();
      geomRef.current = {
        rotation: imageAdjustments.rotation,
        flipH: imageAdjustments.flipH,
        flipV: imageAdjustments.flipV,
      };
    }

    if (canvas.width !== imageMeta.width || canvas.height !== imageMeta.height) {
      canvas.width = imageMeta.width;
      canvas.height = imageMeta.height;
    }
    requestAnimationFrame(() => resetAnnotationHistory());
  }, [
    imageMeta,
    imageAdjustments.rotation,
    imageAdjustments.flipH,
    imageAdjustments.flipV,
    clearAnnotations,
    resetAnnotationHistory,
  ]);

  useEffect(() => {
    updateOverlayPosition();
    const panel = previewPanelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(updateOverlayPosition);
    observer.observe(panel);
    window.addEventListener("resize", updateOverlayPosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateOverlayPosition);
    };
  }, [updateOverlayPosition]);

  useEffect(() => {
    if (!orgId) return;
    Promise.all([fetchCalibrations(orgId), fetchSamples(orgId)]).then(([c, s]) => {
      setCals(c);
      setSamples(s);
      if (c[0]) setCalibrationId(c[0].id);
      if (s[0]) setSampleId(s[0].id);
    });
  }, [orgId]);

  function getPointerPoint(clientX: number, clientY: number) {
    const panel = previewPanelRef.current;
    if (!panel || !imageMeta) return null;
    return pointerToImageCoords(
      clientX,
      clientY,
      panel.getBoundingClientRect(),
      imageMeta.width,
      imageMeta.height,
      imageAdjustments.zoom,
      panOffset,
    );
  }

  function saveSnapshot() {
    const canvas = annotationRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function restoreSnapshot() {
    const canvas = annotationRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !snapshotRef.current) return;
    ctx.putImageData(snapshotRef.current, 0, 0);
  }

  function drawPreviewShape(end: { x: number; y: number }) {
    const start = drawStartRef.current;
    const canvas = annotationRef.current;
    const ctx = canvas?.getContext("2d");
    if (!start || !canvas || !ctx) return;
    restoreSnapshot();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.setLineDash(activeTool === "crop" ? [8, 6] : []);
    if (activeTool === "line") {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (activeTool === "arrow") {
      drawArrow(ctx, start.x, start.y, end.x, end.y, strokeWidth);
    } else if (activeTool === "rectangle" || activeTool === "crop") {
      const r = normalizeRect(start.x, start.y, end.x, end.y);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    } else if (activeTool === "ellipse") {
      const r = normalizeRect(start.x, start.y, end.x, end.y);
      ctx.beginPath();
      ctx.ellipse(
        r.x + r.width / 2,
        r.y + r.height / 2,
        Math.max(r.width / 2, 0.5),
        Math.max(r.height / 2, 0.5),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (activeTool === "diamond") {
      drawDiamond(ctx, start.x, start.y, end.x, end.y);
    }
    ctx.setLineDash([]);
  }

  function commitShape(end: { x: number; y: number }) {
    const start = drawStartRef.current;
    const canvas = annotationRef.current;
    const ctx = canvas?.getContext("2d");
    if (!start || !canvas || !ctx) return;
    restoreSnapshot();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    if (activeTool === "line") {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (activeTool === "arrow") {
      drawArrow(ctx, start.x, start.y, end.x, end.y, strokeWidth);
    } else if (activeTool === "rectangle") {
      const r = normalizeRect(start.x, start.y, end.x, end.y);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    } else if (activeTool === "ellipse") {
      const r = normalizeRect(start.x, start.y, end.x, end.y);
      ctx.beginPath();
      ctx.ellipse(
        r.x + r.width / 2,
        r.y + r.height / 2,
        Math.max(r.width / 2, 0.5),
        Math.max(r.height / 2, 0.5),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (activeTool === "diamond") {
      drawDiamond(ctx, start.x, start.y, end.x, end.y);
    }
    snapshotRef.current = null;
  }

  async function applyCrop(end: { x: number; y: number }) {
    const start = drawStartRef.current;
    if (!start || !sourceBlob) return;
    const r = normalizeRect(start.x, start.y, end.x, end.y);
    if (r.width < 4 || r.height < 4) return;

    const composite = await renderEditedImage(
      sourceBlob,
      imageAdjustments,
      annotationRef.current,
    );
    const img = await createImageBitmap(composite);
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(Math.round(r.width), img.width);
    canvas.height = Math.min(Math.round(r.height), img.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      img.close();
      return;
    }
    ctx.drawImage(
      img,
      Math.round(r.x),
      Math.round(r.y),
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    img.close();

    canvas.toBlob((b) => {
      if (!b) return;
      clearAnnotations();
      setImageAdjustments(DEFAULT_IMAGE_ADJUSTMENTS);
      setSourceBlob(b);
      setActiveTool("select");
    }, "image/jpeg", 0.92);
  }

  async function pickColorAt(point: { x: number; y: number }) {
    if (!preview) return;
    const img = await createImageBitmap(await fetch(preview).then((r) => r.blob()));
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      img.close();
      return;
    }
    ctx.drawImage(img, 0, 0);
    img.close();
    const px = ctx.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data;
    const hex = `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    setStrokeColor(hex);
    setActiveTool("pencil");
  }

  function addTextAt(point: { x: number; y: number }) {
    const text = window.prompt("Enter Label Text");
    if (!text?.trim()) return;
    const canvas = annotationRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.font = `${Math.max(14, strokeWidth * 5)}px sans-serif`;
    ctx.fillStyle = strokeColor;
    ctx.fillText(text.trim(), point.x, point.y);
    pushAnnotationHistory();
    void refreshPreviewFromAnnotations();
  }

  function placeMarkerAt(point: { x: number; y: number }) {
    const canvas = annotationRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(4, strokeWidth * 1.5), 0, Math.PI * 2);
    ctx.fill();
    pushAnnotationHistory();
    void refreshPreviewFromAnnotations();
  }

  function fillAt(point: { x: number; y: number }) {
    const canvas = annotationRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    floodFillCanvas(ctx, point.x, point.y, strokeColor);
    pushAnnotationHistory();
    void refreshPreviewFromAnnotations();
  }

  function handlePanDown(e: React.PointerEvent<HTMLDivElement>) {
    if (activeTool !== "hand" || !imageReady) return;
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: panOffset.x,
      oy: panOffset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePanMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!panStartRef.current || activeTool !== "hand") return;
    setPanOffset({
      x: panStartRef.current.ox + (e.clientX - panStartRef.current.x),
      y: panStartRef.current.oy + (e.clientY - panStartRef.current.y),
    });
  }

  function handlePanUp(e: React.PointerEvent<HTMLDivElement>) {
    panStartRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!imageReady || !imageMeta) return;
    const point = getPointerPoint(e.clientX, e.clientY);
    if (!point) return;

    if (activeTool === "eyedropper") {
      void pickColorAt(point);
      return;
    }
    if (activeTool === "text") {
      addTextAt(point);
      return;
    }
    if (activeTool === "fill") {
      fillAt(point);
      return;
    }
    if (activeTool === "marker") {
      placeMarkerAt(point);
      return;
    }
    if (activeTool === "select" || activeTool === "hand") return;

    e.currentTarget.setPointerCapture(e.pointerId);
    drawStartRef.current = point;
    isDrawingRef.current = true;

    if (activeTool === "pencil" || activeTool === "eraser" || activeTool === "highlighter") {
      const ctx = annotationRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (activeTool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1;
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else if (activeTool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(strokeWidth * 2.5, 8);
        ctx.strokeStyle = strokeColor;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
      }
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    } else {
      saveSnapshot();
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !drawStartRef.current) return;
    const point = getPointerPoint(e.clientX, e.clientY);
    if (!point) return;

    if (activeTool === "pencil" || activeTool === "eraser" || activeTool === "highlighter") {
      const ctx = annotationRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    } else if (
      activeTool === "line" ||
      activeTool === "arrow" ||
      activeTool === "rectangle" ||
      activeTool === "ellipse" ||
      activeTool === "diamond" ||
      activeTool === "crop"
    ) {
      drawPreviewShape(point);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const point = getPointerPoint(e.clientX, e.clientY);
    isDrawingRef.current = false;
    let committed = false;

    if (activeTool === "pencil" || activeTool === "eraser" || activeTool === "highlighter") {
      const ctx = annotationRef.current?.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      committed = true;
    } else if (point && drawStartRef.current) {
      if (activeTool === "crop") {
        void applyCrop(point);
        restoreSnapshot();
        snapshotRef.current = null;
      } else if (
        activeTool === "line" ||
        activeTool === "arrow" ||
        activeTool === "rectangle" ||
        activeTool === "ellipse" ||
        activeTool === "diamond"
      ) {
        commitShape(point);
        committed = true;
      }
    }

    drawStartRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (committed) {
      pushAnnotationHistory();
      void refreshPreviewFromAnnotations();
    }
  }

  async function startCamera() {
    setCameraError("");
    clearPreview();
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
          : "Camera Unavailable — Use Upload Instead.",
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
      setNewSource(b);
    }, "image/jpeg", 0.92);
  }

  function onUpload(file: File | null) {
    if (!file) return;
    stopCamera();
    setNewSource(file);
  }

  async function ensureSample(): Promise<string> {
    if (sampleMode === "existing") {
      if (!sampleId) throw new Error("Select a Sample");
      return sampleId;
    }
    if (!orgId || !newSampleForm.sample_code.trim()) throw new Error("Enter a Sample Code");
    const sample = await createSample(orgId, {
      sample_code: newSampleForm.sample_code,
      material: newSampleForm.material,
      description: newSampleForm.description,
    });
    setSampleId(sample.id);
    setSamples((prev) => [sample, ...prev]);
    setSampleMode("existing");
    setNewSampleForm(DEFAULT_NEW_SAMPLE);
    return sample.id;
  }

  async function submit() {
    if (!orgId || !sourceBlob) return;
    setBusy(true);
    setError("");
    try {
      const sid = await ensureSample();
      const finalBlob = await renderEditedImage(
        sourceBlob,
        imageAdjustments,
        annotationRef.current,
      );
      const job = await createAndRunJob({
        orgId,
        sampleId: sid,
        analysisType,
        calibrationId: calibrationId || null,
        runAi: true,
        image: finalBlob,
      });
      stopCamera();
      navigate(`/app/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const toolbarProps = {
    activeTool,
    adjustments: imageAdjustments,
    canRedo,
    canUndo,
    disabled: !imageReady,
    onAdjustmentsChange: setImageAdjustments,
    onClearAnnotations: clearAnnotationsWithHistory,
    onRedo: redoAnnotation,
    onReset: resetAllEdits,
    onStrokeColorChange: setStrokeColor,
    onStrokeWidthChange: setStrokeWidth,
    onToolChange: setActiveTool,
    onUndo: undoAnnotation,
    strokeColor,
    strokeWidth,
  };

  return (
    <div className="relative space-y-6 min-h-[calc(100dvh-3.5rem)]">
      <div className="card-elevated overflow-hidden flex flex-col w-full">
        <div className="p-5 pb-4 space-y-4 shrink-0">
        <div className="flex flex-wrap gap-2 items-center justify-center">
          {!streamReady ? (
            <button className="btn btn-primary" onClick={startCamera} type="button">
              Start Camera
            </button>
          ) : (
            <>
              <button className="btn btn-primary" onClick={snap} type="button">
                Capture Frame
              </button>
              <button className="btn btn-ghost" onClick={stopCamera} type="button">
                Stop Camera
              </button>
            </>
          )}
          <label className="btn btn-ghost cursor-pointer">
            Upload Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0] || null)}
            />
          </label>

          <div className="hidden sm:block w-px h-8 bg-[var(--line)] mx-1" aria-hidden />

          <button
            className={`btn btn-ghost ${activePanel === "calibration" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
            disabled={!imageReady}
            onClick={() => openPanel("calibration")}
            type="button"
          >
            Calibration
          </button>
          <button
            className={`btn btn-ghost ${activePanel === "sample" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
            disabled={!imageReady}
            onClick={() => openPanel("sample")}
            type="button"
          >
            Sample Details
          </button>
          <button
            className="btn btn-primary"
            disabled={!imageReady || busy || !canAnalyze}
            onClick={submit}
            title={canAnalyze ? undefined : "Requires the Analyst role or higher"}
            type="button"
          >
            {busy ? "Analyzing…" : "Run Analysis"}
          </button>
        </div>

        {cameraError && <p className="text-sm text-[var(--warn)]">{cameraError}</p>}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        </div>

        <div className="capture-workspace">
          <ImageEditToolbar placement="left" {...toolbarProps} />

            <div
              ref={previewPanelRef}
              className={`preview-panel capture-preview-panel capture-workspace-preview relative min-w-0 min-h-0 bg-black overflow-hidden ${activeTool === "hand" && imageReady ? "cursor-grab active:cursor-grabbing" : ""}`}
              onPointerDown={handlePanDown}
              onPointerLeave={handlePanUp}
              onPointerMove={handlePanMove}
              onPointerUp={handlePanUp}
            >
            <div className="capture-preview-viewport">
            <video
              ref={videoRef}
              className={`capture-preview-media absolute inset-0 z-[2] ${showLiveVideo ? "" : "hidden"}`}
              muted
              playsInline
              autoPlay
            />
            {showImage && preview && (
              <div
                className="capture-preview-layer absolute inset-0 z-[2]"
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${imageAdjustments.zoom / 100})`,
                }}
              >
                <img
                  src={preview}
                  alt="Capture Preview"
                  className="capture-preview-media select-none pointer-events-none"
                  draggable={false}
                />
              </div>
            )}
            {showImage && imageMeta && (
              <canvas
                ref={annotationRef}
                className={canvasInteractive ? "pointer-events-auto" : "pointer-events-none"}
                height={imageMeta.height}
                onPointerDown={handlePointerDown}
                onPointerLeave={handlePointerUp}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={overlayStyle}
                width={imageMeta.width}
              />
            )}
            {showPlaceholder && (
              <div className="absolute inset-0 z-[2] grid place-items-center text-slate-400 text-sm px-6 text-center">
                Camera Preview Will Appear Here. If the Microscope USB Camera Is Not
                Exposed as a Webcam, Use Upload.
              </div>
            )}
            </div>
            </div>

          <ImageEditToolbar placement="right" {...toolbarProps} />
          <ImageEditToolbar placement="bottom" {...toolbarProps} />
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {activePanel && imageReady && (
        <SettingsModal
          title={PANEL_TITLES[activePanel]}
          onClose={closePanel}
          wide={activePanel === "sample"}
        >
          {activePanel === "calibration" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  className={`btn btn-ghost ${calibrationMode === "existing" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
                  onClick={() => setCalibrationMode("existing")}
                  type="button"
                >
                  Old Calibration
                </button>
                <button
                  className={`btn btn-ghost ${calibrationMode === "new" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
                  onClick={() => setCalibrationMode("new")}
                  type="button"
                >
                  New Calibration
                </button>
              </div>

              {calibrationMode === "existing" ? (
                <div>
                  <label className="text-xs text-[var(--muted)]">Select Calibration</label>
                  <select
                    className="input mt-1"
                    value={calibrationId}
                    onChange={(e) => setCalibrationId(e.target.value)}
                  >
                    <option value="">None (1 µm/px Default)</option>
                    {cals.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.objective} · {c.um_per_px_x} µm/px
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
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
                    <div key={key} className={key === "notes" ? "sm:col-span-2" : ""}>
                      <label className="text-xs text-[var(--muted)]">{label}</label>
                      <input
                        className="input mt-1"
                        type={key.startsWith("um_") ? "number" : "text"}
                        step={key.startsWith("um_") ? "any" : undefined}
                        required={key !== "notes"}
                        value={String(newCalForm[key])}
                        onChange={(e) =>
                          setNewCalForm({
                            ...newCalForm,
                            [key]: key.startsWith("um_")
                              ? Number(e.target.value)
                              : e.target.value,
                          })
                        }
                      />
                    </div>
                  ))}
                  {calError && <p className="text-sm text-[var(--danger)] sm:col-span-2">{calError}</p>}
                  <div className="sm:col-span-2">
                    <button
                      className="btn btn-primary"
                      disabled={calSaving}
                      onClick={saveNewCalibration}
                      type="button"
                    >
                      {calSaving ? "Saving…" : "Save Calibration"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activePanel === "sample" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--muted)]">Analysis Module</label>
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

              <div className="flex flex-wrap gap-2">
                <button
                  className={`btn btn-ghost ${sampleMode === "existing" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
                  onClick={() => setSampleMode("existing")}
                  type="button"
                >
                  Old Sample
                </button>
                <button
                  className={`btn btn-ghost ${sampleMode === "new" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
                  onClick={() => {
                    setSampleMode("new");
                    setSampleId("");
                  }}
                  type="button"
                >
                  New Sample
                </button>
              </div>

              {sampleMode === "existing" ? (
                <>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Select Sample</label>
                    <select
                      className="input mt-1"
                      value={sampleId}
                      onChange={(e) => selectExistingSample(e.target.value)}
                    >
                      <option value="">Choose Sample…</option>
                      {samples.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.sample_code}
                          {s.material ? ` · ${s.material}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedSample ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-[var(--muted)]">Sample Code</label>
                        <input className="input mt-1" readOnly value={selectedSample.sample_code} />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted)]">Material</label>
                        <input
                          className="input mt-1"
                          readOnly
                          value={selectedSample.material || "—"}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-[var(--muted)]">Description</label>
                        <textarea
                          className="input mt-1 min-h-20 resize-y"
                          readOnly
                          value={selectedSample.description || "—"}
                        />
                      </div>
                      {selectedSample.created_at && (
                        <div className="sm:col-span-2">
                          <label className="text-xs text-[var(--muted)]">Created On</label>
                          <input
                            className="input mt-1"
                            readOnly
                            value={new Date(selectedSample.created_at).toLocaleString()}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">
                      Select an existing sample or switch to New Sample to create one.
                    </p>
                  )}
                </>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--muted)]">Sample Code</label>
                    <input
                      className="input mt-1"
                      placeholder="e.g. HT-2026-001"
                      required
                      value={newSampleForm.sample_code}
                      onChange={(e) =>
                        setNewSampleForm({ ...newSampleForm, sample_code: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Material</label>
                    <input
                      className="input mt-1"
                      placeholder="e.g. AISI 4140"
                      value={newSampleForm.material}
                      onChange={(e) =>
                        setNewSampleForm({ ...newSampleForm, material: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-[var(--muted)]">Description</label>
                    <textarea
                      className="input mt-1 min-h-20 resize-y"
                      placeholder="Heat treatment, batch, customer reference, etc."
                      value={newSampleForm.description}
                      onChange={(e) =>
                        setNewSampleForm({ ...newSampleForm, description: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button className="btn btn-primary" onClick={closePanel} type="button">
              Done
            </button>
          </div>
        </SettingsModal>
      )}
    </div>
  );
}
