export type EditTool =
  | "select"
  | "crop"
  | "hand"
  | "pencil"
  | "highlighter"
  | "eraser"
  | "text"
  | "line"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "fill"
  | "marker"
  | "eyedropper"
  | "measure"
  | "zoom-in"
  | "zoom-out";

export type ImageAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  blackPoint: number;
  whitePoint: number;
  /** 100 = linear; < 100 darkens mid-tones, > 100 lightens them. */
  gamma: number;
  /** Unsharp mask amount, 0–100. */
  sharpen: number;
  /** Gaussian noise reduction radius in px (0 = off). */
  denoise: number;
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  grayscale: boolean;
  invert: boolean;
  zoom: number;
};

export const DEFAULT_IMAGE_ADJUSTMENTS: ImageAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blackPoint: 0,
  whitePoint: 100,
  gamma: 100,
  sharpen: 0,
  denoise: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  grayscale: false,
  invert: false,
  zoom: 100,
};

/** Black / white levels and gamma in one pass through a lookup table. */
function applyLevelsAndGamma(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blackPoint: number,
  whitePoint: number,
  gamma: number,
) {
  if (blackPoint === 0 && whitePoint === 100 && gamma === 100) return;
  const blackVal = (blackPoint / 100) * 255;
  const whiteVal = Math.max(blackVal + 1, (whitePoint / 100) * 255);
  const g = 100 / Math.max(10, gamma);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v += 1) {
    const t = Math.min(1, Math.max(0, (v - blackVal) / (whiteVal - blackVal)));
    lut[v] = Math.round(255 * Math.pow(t, g));
  }
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Unsharp mask: out = in + amount·(in − blur(in)). */
function applySharpen(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, amount: number) {
  if (amount <= 0) return;
  const w = canvas.width;
  const h = canvas.height;
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = w;
  blurCanvas.height = h;
  const bctx = blurCanvas.getContext("2d");
  if (!bctx) return;
  bctx.filter = "blur(1.2px)";
  bctx.drawImage(canvas, 0, 0);
  const src = ctx.getImageData(0, 0, w, h);
  const blur = bctx.getImageData(0, 0, w, h).data;
  const d = src.data;
  const k = (amount / 100) * 1.5;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c += 1) d[i + c] = d[i + c] + k * (d[i + c] - blur[i + c]);
  }
  ctx.putImageData(src, 0, 0);
}

export type RenderOptions = {
  /** Draw the annotation layer into the image (preview / report). Analysis images leave it out. */
  annotations?: boolean;
  /** "png" (lossless, for analysis) or "jpeg". */
  format?: "png" | "jpeg";
};

export async function renderEditedImage(
  source: Blob,
  adj: ImageAdjustments,
  annotationCanvas?: HTMLCanvasElement | null,
  options: RenderOptions = {},
): Promise<Blob> {
  const img = await createImageBitmap(source);
  const radians = (adj.rotation * Math.PI) / 180;
  const swap = adj.rotation === 90 || adj.rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;

  const filters = [
    `brightness(${adj.brightness}%)`,
    `contrast(${adj.contrast}%)`,
    `saturate(${adj.saturation}%)`,
    adj.grayscale ? "grayscale(100%)" : "",
    adj.invert ? "invert(100%)" : "",
    adj.denoise > 0 ? `blur(${adj.denoise * 0.5}px)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  ctx.filter = filters;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.scale(adj.flipH ? -1 : 1, adj.flipV ? -1 : 1);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  img.close();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  applyLevelsAndGamma(ctx, canvas.width, canvas.height, adj.blackPoint, adj.whitePoint, adj.gamma);
  applySharpen(canvas, ctx, adj.sharpen);

  const withAnnotations = options.annotations ?? true;
  if (withAnnotations && annotationCanvas && annotationCanvas.width === canvas.width && annotationCanvas.height === canvas.height) {
    ctx.drawImage(annotationCanvas, 0, 0);
  }

  const png = options.format === "png";
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || source), png ? "image/png" : "image/jpeg", png ? undefined : 0.92);
  });
}

/**
 * Auto levels: black / white points at the 0.5 % and 99.5 % luminance percentiles of the image as currently
 * adjusted (levels and gamma reset), so the useful range fills 0–255.
 */
export async function computeAutoLevels(source: Blob, adj: ImageAdjustments): Promise<{ blackPoint: number; whitePoint: number }> {
  const flat = await renderEditedImage(source, { ...adj, blackPoint: 0, whitePoint: 100, gamma: 100, sharpen: 0 }, null, { annotations: false })
  const bmp = await createImageBitmap(flat);
  const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blackPoint: 0, whitePoint: 100 };
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])] += 1;
  const total = d.length / 4;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= total * 0.005) { lo = v; break } }
  acc = 0;
  for (let v = 255; v >= 0; v -= 1) { acc += hist[v]; if (acc >= total * 0.005) { hi = v; break } }
  if (hi - lo < 10) return { blackPoint: 0, whitePoint: 100 };
  return { blackPoint: Math.round((lo / 255) * 100), whitePoint: Math.round((hi / 255) * 100) };
}

/** One-click enhancement suited to each analysis (applied before Auto levels). */
export function enhancementPreset(analysisType: string): Partial<ImageAdjustments> {
  const base = { brightness: 100, contrast: 100, saturation: 100, gamma: 100, grayscale: true, invert: false };
  switch (analysisType) {
    case "grain_size":
      return { ...base, sharpen: 30, denoise: 0 }; // crisper boundary lines
    case "inclusion":
      return { ...base, sharpen: 0, denoise: 0 }; // keep small particles and true widths
    case "macro":
      return { ...base, sharpen: 20, denoise: 1 };
    case "nodularity":
    case "graphite_flake":
    case "micro":
      return { ...base, sharpen: 0, denoise: 1 }; // smoother phase edges for thresholding
    case "decarb":
      return { ...base, sharpen: 0, denoise: 2 }; // even out etch texture for the profile
    default:
      return { ...base, sharpen: 0, denoise: 0 };
  }
}
