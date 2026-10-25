export function getContainedImageRect(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
) {
  const containerAspect = containerWidth / containerHeight;
  const imageAspect = imageWidth / imageHeight;
  if (imageAspect > containerAspect) {
    const width = containerWidth;
    const height = containerWidth / imageAspect;
    return { x: 0, y: (containerHeight - height) / 2, width, height };
  }
  const height = containerHeight;
  const width = containerHeight * imageAspect;
  return { x: (containerWidth - width) / 2, y: 0, width, height };
}

export function pointerToImageCoords(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  pan: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } | null {
  const cw = containerRect.width;
  const ch = containerRect.height;
  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;
  const zoomScale = zoom / 100;
  const centerX = cw / 2;
  const centerY = ch / 2;
  const unzoomedX = (localX - centerX) / zoomScale + centerX;
  const unzoomedY = (localY - centerY) / zoomScale + centerY;
  const contained = getContainedImageRect(cw, ch, imageWidth, imageHeight);
  const imageLeft = contained.x + pan.x / zoomScale;
  const imageTop = contained.y + pan.y / zoomScale;
  const imageWidthPx = contained.width;
  const imageHeightPx = contained.height;
  if (
    unzoomedX < imageLeft ||
    unzoomedY < imageTop ||
    unzoomedX > imageLeft + imageWidthPx ||
    unzoomedY > imageTop + imageHeightPx
  ) {
    return null;
  }
  return {
    x: ((unzoomedX - imageLeft) / imageWidthPx) * imageWidth,
    y: ((unzoomedY - imageTop) / imageHeightPx) * imageHeight,
  };
}

export function normalizeRect(x0: number, y0: number, x1: number, y1: number) {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}

export function hexToRgba(hex: string, alpha = 1) {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
    a: Math.round(alpha * 255),
  };
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  lineWidth: number,
) {
  const head = Math.max(10, lineWidth * 3.5);
  const angle = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - head * Math.cos(angle - Math.PI / 6),
    y1 - head * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x1 - head * Math.cos(angle + Math.PI / 6),
    y1 - head * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

export function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const r = normalizeRect(x0, y0, x1, y1);
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  ctx.beginPath();
  ctx.moveTo(cx, r.y);
  ctx.lineTo(r.x + r.width, cy);
  ctx.lineTo(cx, r.y + r.height);
  ctx.lineTo(r.x, cy);
  ctx.closePath();
  ctx.stroke();
}

export function floodFillCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fillHex: string,
) {
  const canvas = ctx.canvas;
  const { width, height } = canvas;
  const startX = Math.floor(x);
  const startY = Math.floor(y);
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const startIndex = (startY * width + startX) * 4;
  const target = {
    r: data[startIndex],
    g: data[startIndex + 1],
    b: data[startIndex + 2],
    a: data[startIndex + 3],
  };
  const fill = hexToRgba(fillHex);
  if (
    target.r === fill.r &&
    target.g === fill.g &&
    target.b === fill.b &&
    target.a === fill.a
  ) {
    return;
  }

  const matches = (index: number) =>
    data[index] === target.r &&
    data[index + 1] === target.g &&
    data[index + 2] === target.b &&
    data[index + 3] === target.a;

  const paint = (index: number) => {
    data[index] = fill.r;
    data[index + 1] = fill.g;
    data[index + 2] = fill.b;
    data[index + 3] = fill.a;
  };

  const stack: [number, number][] = [[startX, startY]];
  while (stack.length > 0) {
    const [px, py] = stack.pop()!;
    const index = (py * width + px) * 4;
    if (!matches(index)) continue;
    paint(index);
    if (px > 0) stack.push([px - 1, py]);
    if (px < width - 1) stack.push([px + 1, py]);
    if (py > 0) stack.push([px, py - 1]);
    if (py < height - 1) stack.push([px, py + 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}
