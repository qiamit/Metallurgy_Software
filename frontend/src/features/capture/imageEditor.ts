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
  | "zoom-in"
  | "zoom-out";

export type ImageAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  blackPoint: number;
  whitePoint: number;
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
  rotation: 0,
  flipH: false,
  flipV: false,
  grayscale: false,
  invert: false,
  zoom: 100,
};

function applyBlackWhiteLevels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blackPoint: number,
  whitePoint: number,
) {
  if (blackPoint === 0 && whitePoint === 100) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const blackVal = (blackPoint / 100) * 255;
  const whiteVal = Math.max(blackVal + 1, (whitePoint / 100) * 255);
  const scale = 255 / (whiteVal - blackVal);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      data[i + channel] = Math.min(
        255,
        Math.max(0, (data[i + channel] - blackVal) * scale),
      );
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export async function renderEditedImage(
  source: Blob,
  adj: ImageAdjustments,
  annotationCanvas?: HTMLCanvasElement | null,
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
  applyBlackWhiteLevels(ctx, canvas.width, canvas.height, adj.blackPoint, adj.whitePoint);

  if (annotationCanvas && annotationCanvas.width === canvas.width && annotationCanvas.height === canvas.height) {
    ctx.drawImage(annotationCanvas, 0, 0);
  }

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || source), "image/jpeg", 0.92);
  });
}
