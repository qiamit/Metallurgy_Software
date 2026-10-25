/**
 * Ring Test geometry — pure functions (no DOM) used by the editor:
 * full-resolution sub-pixel edge refinement, robust circle fit, polygon areas,
 * rib profile for rib-aware thickness rays, and edge-quality scoring.
 */
import type { Circle } from "./index";

export type Pt = { x: number; y: number };
export type GrayImage = { data: Float32Array; w: number; h: number };

/** Shape in the editor's representation: base circle + per-vertex offsets (vertex i at angle 2πi/sides). */
export type RingShape = {
  circle: Circle;
  mode: "circle" | "polygon";
  sides: number;
  rotationDeg: number;
  pointOffsets: Array<{ dx: number; dy: number }>;
};

/** Edge found on one ray: radius from the centre, gradient strength (grey levels / px). */
export type EdgeHit = { angle: number; r: number; strength: number };

export type RefinedShape = {
  shape: RingShape;
  /** Per-vertex edge strength normalised by the median (1 = typical); NaN where no edge. */
  quality: number[];
  /** RMS of the circle fit as a fraction of the radius. */
  circleRelRms: number;
};

// ---------------------------------------------------------------------------
// Grey image helpers
// ---------------------------------------------------------------------------

export function grayFromRgba(rgba: Uint8ClampedArray, w: number, h: number): GrayImage {
  const data = new Float32Array(w * h);
  for (let i = 0, p = 0; p < data.length; i += 4, p++) {
    data[p] = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
  }
  return { data: blur3(blur3(data, w, h), w, h), w, h };
}

/** 3×3 box blur (two passes ≈ Gaussian σ ≈ 1 px): suppresses pixel noise before differentiating. */
function blur3(src: Float32Array, w: number, h: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const a = src[row + Math.max(0, x - 1)]!;
      const c = src[row + Math.min(w - 1, x + 1)]!;
      tmp[row + x] = (a + src[row + x]! + c) / 3;
    }
  }
  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1) * w;
    const dn = Math.min(h - 1, y + 1) * w;
    const row = y * w;
    for (let x = 0; x < w; x++) out[row + x] = (tmp[up + x]! + tmp[row + x]! + tmp[dn + x]!) / 3;
  }
  return out;
}

export function sampleGray(img: GrayImage, x: number, y: number): number {
  const { data, w, h } = img;
  // pixel i covers [i, i+1) in image coordinates, so its value sits at i + 0.5
  const xc = Math.min(w - 1.001, Math.max(0, x - 0.5));
  const yc = Math.min(h - 1.001, Math.max(0, y - 0.5));
  const x0 = Math.floor(xc);
  const y0 = Math.floor(yc);
  const fx = xc - x0;
  const fy = yc - y0;
  const i = y0 * w + x0;
  const a = data[i]!;
  const b = data[i + 1]!;
  const c = data[i + w]!;
  const d = data[i + w + 1]!;
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** Robust intensity spread (p95 − p5) of the image, used to normalise edge strength. */
export function grayContrast(img: GrayImage): number {
  const hist = new Uint32Array(256);
  const step = Math.max(1, Math.floor(img.data.length / 200000));
  let n = 0;
  for (let i = 0; i < img.data.length; i += step) {
    hist[Math.min(255, Math.max(0, Math.round(img.data[i]!)))]! += 1;
    n++;
  }
  const pick = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v]!;
      if (acc >= n * q) return v;
    }
    return 255;
  };
  return Math.max(1, pick(0.95) - pick(0.05));
}

// ---------------------------------------------------------------------------
// Sub-pixel radial edge search
// ---------------------------------------------------------------------------

const STEP = 0.25;

/**
 * Along each ray from (cx, cy), find the strongest edge of the given sign within ±win of the guess,
 * at sub-pixel precision (3 parallel rays averaged, central difference, parabolic peak fit).
 * sign +1: intensity rises outward (dark metal → light background); −1: falls (light core → dark rim).
 */
export function findRadialEdges(
  img: GrayImage,
  cx: number,
  cy: number,
  angles: number[],
  guess: (angle: number) => number,
  win: number,
  sign: 1 | -1,
): EdgeHit[] {
  return angles.map((angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const g = guess(angle);
    const r0 = Math.max(1, g - win);
    const r1 = g + win;
    const n = Math.floor((r1 - r0) / STEP) + 1;
    if (n < 12) return { angle, r: NaN, strength: 0 };
    const prof = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const r = r0 + k * STEP;
      let s = 0;
      for (const o of [-1, 0, 1]) s += sampleGray(img, cx + cos * r - sin * o, cy + sin * r + cos * o);
      prof[k] = s / 3;
    }
    const d = 4; // ±1 px
    let best = -1;
    let bestScore = 0;
    const deriv = new Float32Array(n);
    for (let k = d; k < n - d; k++) {
      deriv[k] = (sign * (prof[k + d]! - prof[k - d]!)) / (2 * d * STEP);
      const r = r0 + k * STEP;
      // mild preference for edges near the guess, so a neighbouring edge does not win on contrast alone
      const score = deriv[k]! * (1 - 0.35 * Math.min(1, Math.abs(r - g) / win));
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
    if (best < 0 || deriv[best]! <= 0) return { angle, r: NaN, strength: 0 };
    const y0 = deriv[best - 1] ?? deriv[best]!;
    const y1 = deriv[best]!;
    const y2 = deriv[best + 1] ?? deriv[best]!;
    const den = y0 - 2 * y1 + y2;
    const off = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0;
    return { angle, r: r0 + (best + off) * STEP, strength: y1 };
  });
}

// ---------------------------------------------------------------------------
// Circle fit, polygon helpers
// ---------------------------------------------------------------------------

/** Algebraic (Kåsa) least-squares circle fit. */
export function fitCircle(pts: Pt[]): Circle | null {
  if (pts.length < 3) return null;
  let mx = 0;
  let my = 0;
  for (const p of pts) {
    mx += p.x;
    my += p.y;
  }
  mx /= pts.length;
  my /= pts.length;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of pts) {
    const u = p.x - mx;
    const v = p.y - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return null;
  const b1 = 0.5 * (suuu + suvv);
  const b2 = 0.5 * (svvv + svuu);
  const uc = (b1 * svv - b2 * suv) / det;
  const vc = (suu * b2 - suv * b1) / det;
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / pts.length);
  return { cx: uc + mx, cy: vc + my, r };
}

/** Circle fit with iterative rejection of points beyond 2.5 × MAD (ribs, lugs, dirt). */
export function robustFitCircle(pts: Pt[]): { circle: Circle; inliers: boolean[]; relRms: number } | null {
  let inliers = pts.map(() => true);
  let circle = fitCircle(pts);
  if (!circle) return null;
  for (let it = 0; it < 4; it++) {
    const res = pts.map((p) => Math.hypot(p.x - circle!.cx, p.y - circle!.cy) - circle!.r);
    const abs = res.map(Math.abs).sort((a, b) => a - b);
    const mad = Math.max(0.5, abs[Math.floor(abs.length / 2)]! * 1.4826);
    const next = res.map((e) => Math.abs(e) <= 2.5 * mad);
    const kept = pts.filter((_, i) => next[i]);
    if (kept.length < Math.max(6, pts.length * 0.5)) break;
    const c = fitCircle(kept);
    if (!c) break;
    circle = c;
    inliers = next;
  }
  let ss = 0;
  let n = 0;
  pts.forEach((p, i) => {
    if (!inliers[i]) return;
    const e = Math.hypot(p.x - circle!.cx, p.y - circle!.cy) - circle!.r;
    ss += e * e;
    n++;
  });
  return { circle, inliers, relRms: Math.sqrt(ss / Math.max(1, n)) / circle.r };
}

export function shapePoints(shape: RingShape): Pt[] {
  const { circle: c } = shape;
  if (shape.mode === "circle") {
    return Array.from({ length: 180 }, (_, i) => {
      const t = (i / 180) * Math.PI * 2;
      return { x: c.cx + Math.cos(t) * c.r, y: c.cy + Math.sin(t) * c.r };
    });
  }
  const n = Math.max(3, Math.round(shape.sides));
  const rot = (shape.rotationDeg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const t = rot + (i / n) * Math.PI * 2;
    const off = shape.pointOffsets[i] ?? { dx: 0, dy: 0 };
    return { x: c.cx + Math.cos(t) * c.r + off.dx, y: c.cy + Math.sin(t) * c.r + off.dy };
  });
}

/** Area (px²) of the shape: πr² for a circle, shoelace for a polygon. */
export function shapeArea(shape: RingShape): number {
  if (shape.mode === "circle") return Math.PI * shape.circle.r * shape.circle.r;
  const p = shapePoints(shape);
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i]!.x * p[j]!.y - p[j]!.x * p[i]!.y;
  }
  return Math.abs(a) / 2;
}

/** Area centroid of the shape. */
export function shapeCentroid(shape: RingShape): Pt {
  if (shape.mode === "circle") return { x: shape.circle.cx, y: shape.circle.cy };
  const p = shapePoints(shape);
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    const cr = p[i]!.x * p[j]!.y - p[j]!.x * p[i]!.y;
    a += cr;
    x += (p[i]!.x + p[j]!.x) * cr;
    y += (p[i]!.y + p[j]!.y) * cr;
  }
  if (Math.abs(a) < 1e-9) return { x: shape.circle.cx, y: shape.circle.cy };
  return { x: x / (3 * a), y: y / (3 * a) };
}

/** Distance from (ox, oy) along angle to the shape boundary (nearest crossing); null when the ray misses. */
export function rayToShape(shape: RingShape, ox: number, oy: number, angle: number): number | null {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (shape.mode === "circle") {
    const dx = ox - shape.circle.cx;
    const dy = oy - shape.circle.cy;
    const B = 2 * (dx * cos + dy * sin);
    const C = dx * dx + dy * dy - shape.circle.r * shape.circle.r;
    const disc = B * B - 4 * C;
    if (disc < 0) return null;
    const t = (-B + Math.sqrt(disc)) / 2;
    return t > 1e-3 ? t : null;
  }
  const p = shapePoints(shape);
  let best: number | null = null;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = cos * ey - sin * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - ox) * ey - (a.y - oy) * ex) / den;
    const u = ((a.x - ox) * sin - (a.y - oy) * cos) / den;
    if (t > 1e-3 && u >= -1e-6 && u <= 1 + 1e-6 && (best === null || t < best)) best = t;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Refinement of a detected (coarse) ring into a sub-pixel shape
// ---------------------------------------------------------------------------

function fillGaps(values: number[]): number[] {
  const n = values.length;
  const out = values.slice();
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(out[i]!)) continue;
    let p = -1;
    let q = -1;
    for (let d = 1; d < n && (p < 0 || q < 0); d++) {
      if (p < 0 && Number.isFinite(values[(i - d + n) % n]!)) p = d;
      if (q < 0 && Number.isFinite(values[(i + d) % n]!)) q = d;
    }
    if (p < 0 && q < 0) continue;
    if (p < 0) out[i] = values[(i + q) % n]!;
    else if (q < 0) out[i] = values[(i - p + n) % n]!;
    else out[i] = (values[(i - p + n) % n]! * q + values[(i + q) % n]! * p) / (p + q);
  }
  return out;
}

/**
 * Refine a coarse ring at full resolution.
 * kind "inner": light core → dark TM rim (edge falls outward); kept as a circle when the fit is tight.
 * kind "outer": metal → background; polarity chosen from the data; kept as a polygon when ribs/lugs exist.
 * `center` fixes the ray origin (e.g. the outer centre for the inner ring); otherwise the coarse centre is used.
 */
export function refineRing(
  img: GrayImage,
  coarse: RingShape,
  kind: "inner" | "outer",
  opts: { sides?: number; center?: Pt | null; circleTolerance?: number } = {},
): RefinedShape | null {
  const first = refineRingOnce(img, coarse, kind, opts);
  if (!first || opts.center) return first;
  // second pass from the fitted centre: rays then cross the boundary square-on, and the centre is geometric
  const c = first.fitCenter;
  if (Math.hypot(c.x - coarse.circle.cx, c.y - coarse.circle.cy) < 0.3) return first;
  return refineRingOnce(img, first.shape, kind, { ...opts, center: c }) ?? first;
}

function refineRingOnce(
  img: GrayImage,
  coarse: RingShape,
  kind: "inner" | "outer",
  opts: { sides?: number; center?: Pt | null; circleTolerance?: number },
): (RefinedShape & { fitCenter: Pt }) | null {
  const sides = opts.sides ?? 72;
  const c0 = opts.center ?? { x: coarse.circle.cx, y: coarse.circle.cy };
  const angles = Array.from({ length: sides }, (_, i) => (i / sides) * Math.PI * 2);
  const guess = (a: number) => rayToShape(coarse, c0.x, c0.y, a) ?? coarse.circle.r;
  const win = Math.max(5, coarse.circle.r * 0.06);

  const pick = (sign: 1 | -1) => findRadialEdges(img, c0.x, c0.y, angles, guess, win, sign);
  let hits: EdgeHit[];
  if (kind === "inner") {
    hits = pick(-1);
  } else {
    const rise = pick(1);
    const fall = pick(-1);
    const med = (h: EdgeHit[]) => {
      const s = h.map((e) => e.strength).sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)] ?? 0;
    };
    hits = med(rise) >= med(fall) * 0.8 ? rise : fall;
  }

  const strengths = hits.map((h) => h.strength).filter((s) => s > 0).sort((a, b) => a - b);
  if (strengths.length < sides * 0.5) return null;
  const medS = strengths[Math.floor(strengths.length / 2)]!;
  // weak hits (< 25 % of the median edge) are treated as missing
  const radii = fillGaps(hits.map((h) => (h.strength >= medS * 0.25 && Number.isFinite(h.r) ? h.r : NaN)));
  const pts = radii.map((r, i) => ({ x: c0.x + Math.cos(angles[i]!) * r, y: c0.y + Math.sin(angles[i]!) * r }));
  const fit = robustFitCircle(pts.filter((_, i) => Number.isFinite(radii[i]!)));
  if (!fit) return null;
  const quality = hits.map((h) => (h.strength > 0 ? h.strength / medS : NaN));

  const tol = opts.circleTolerance ?? (kind === "inner" ? 0.012 : 0.008);
  // a circle only when every edge point sits on it: lugs / ribs / ovality keep the polygon
  const maxDev = Math.max(
    ...pts.map((p, i) => (Number.isFinite(radii[i]!) ? Math.abs(Math.hypot(p.x - fit.circle.cx, p.y - fit.circle.cy) - fit.circle.r) : 0)),
  );
  if (fit.relRms <= tol && maxDev <= Math.max(1.5, fit.circle.r * 0.012)) {
    return {
      shape: { circle: fit.circle, mode: "circle", sides, rotationDeg: 0, pointOffsets: angles.map(() => ({ dx: 0, dy: 0 })) },
      quality,
      circleRelRms: fit.relRms,
      fitCenter: { x: fit.circle.cx, y: fit.circle.cy },
    };
  }
  // Polygon: vertices at the refined edge, expressed around the ray origin (keeps rays and vertices aligned).
  const base: Circle = { cx: c0.x, cy: c0.y, r: fit.circle.r };
  const pointOffsets = pts.map((p, i) => ({
    dx: p.x - (base.cx + Math.cos(angles[i]!) * base.r),
    dy: p.y - (base.cy + Math.sin(angles[i]!) * base.r),
  }));
  return {
    shape: { circle: base, mode: "polygon", sides, rotationDeg: 0, pointOffsets },
    quality,
    circleRelRms: fit.relRms,
    fitCenter: { x: fit.circle.cx, y: fit.circle.cy },
  };
}

/** Scale a shape's coordinates by k (between image and working-grey coordinates). */
export function scaleShape(shape: RingShape, k: number): RingShape {
  return {
    ...shape,
    circle: { cx: shape.circle.cx * k, cy: shape.circle.cy * k, r: shape.circle.r * k },
    pointOffsets: shape.pointOffsets.map((o) => ({ dx: o.dx * k, dy: o.dy * k })),
  };
}

// ---------------------------------------------------------------------------
// Ribs: core outline of the outer boundary and rib-aware ray angles
// ---------------------------------------------------------------------------

export type RibProfile = {
  /** Outer boundary radius per degree (0..359) from the ray origin. */
  radius: number[];
  /** Core (rib-free) radius per degree. */
  core: number[];
  /** True where a rib/lug lifts the boundary above the core. */
  rib: boolean[];
};

/** Solve a small dense linear system (Gaussian elimination with partial pivoting). */
function solve(A: number[][], y: number[]): number[] | null {
  const n = y.length;
  const M = A.map((row, i) => [...row, y[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    if (Math.abs(M[p]![c]!) < 1e-12) return null;
    [M[c], M[p]] = [M[p]!, M[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / M[c]![c]!;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/**
 * Profile of the outer boundary seen from (ox, oy).
 * Core = robust low-order model R(θ) ≈ a0 + a1·cosθ + b1·sinθ + a2·cos2θ + b2·sin2θ (centre offset + ovality),
 * fitted beneath the ribs by iteratively excluding points that stand above it; rib = boundary > core + max(1.5 px, 1.2 %).
 */
export function ribProfile(outer: RingShape, ox: number, oy: number): RibProfile | null {
  const radius: number[] = [];
  for (let d = 0; d < 360; d++) radius.push(rayToShape(outer, ox, oy, (d * Math.PI) / 180) ?? NaN);
  if (radius.some((r) => !Number.isFinite(r))) return null;
  const basis = (d: number) => {
    const t = (d * Math.PI) / 180;
    return [1, Math.cos(t), Math.sin(t), Math.cos(2 * t), Math.sin(2 * t)];
  };
  let use = radius.map(() => true);
  let core = radius.slice();
  let thr = 1.5;
  for (let it = 0; it < 8; it++) {
    const A = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
    const y = new Array<number>(5).fill(0);
    for (let d = 0; d < 360; d++) {
      if (!use[d]) continue;
      const b = basis(d);
      for (let i = 0; i < 5; i++) {
        y[i]! += b[i]! * radius[d]!;
        for (let j = 0; j < 5; j++) A[i]![j]! += b[i]! * b[j]!;
      }
    }
    const coef = solve(A, y);
    if (!coef) break;
    core = radius.map((_, d) => basis(d).reduce((s, v, i) => s + v * coef[i]!, 0));
    thr = Math.max(1.5, coef[0]! * 0.012);
    const next = radius.map((r, d) => r - core[d]! <= thr);
    if (next.filter(Boolean).length < 360 * 0.4) break;
    if (next.every((v, d) => v === use[d])) break;
    use = next;
  }
  const rib = radius.map((r, d) => r > core[d]! + thr);
  return { radius, core, rib };
}

export type RibMode = "shift" | "core" | "include";

/**
 * Rib-aware ray for a nominal angle (degrees, canvas convention).
 * shift: nearest rib-free direction within ±maxShift (falls back to core when none);
 * core: keep the angle, measure to the core outline; include: unchanged.
 */
export function ribAwareRay(
  profile: RibProfile | null,
  angleDeg: number,
  mode: RibMode,
  maxShift = 10,
): { angleDeg: number; outerR: number | null; shifted: number; usedCore: boolean } {
  if (!profile || mode === "include") return { angleDeg, outerR: null, shifted: 0, usedCore: false };
  const at = (deg: number) => Math.round(((deg % 360) + 360) % 360) % 360;
  // rib-free with a 1° margin either side
  const clear = (deg: number) => !profile.rib[at(deg - 1)] && !profile.rib[at(deg)] && !profile.rib[at(deg + 1)];
  if (clear(angleDeg)) return { angleDeg, outerR: null, shifted: 0, usedCore: false };
  if (mode === "shift") {
    for (let s = 1; s <= maxShift; s++) {
      for (const dir of [1, -1]) {
        const a = angleDeg + dir * s;
        if (clear(a)) return { angleDeg: a, outerR: null, shifted: dir * s, usedCore: false };
      }
    }
  }
  return { angleDeg, outerR: profile.core[at(angleDeg)]!, shifted: 0, usedCore: true };
}

/**
 * Two perpendicular diameters that avoid ribs: the rotation (0–89°, nearest to 0) whose four ends are rib-free;
 * when none exists, ends go to the core outline. Returns end radii per direction (deg, r) for 0/90/180/270 + rot.
 */
export function ribFreeDiameters(profile: RibProfile): { rotationDeg: number; ends: Array<{ deg: number; r: number }> } {
  const at = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;
  const clear = (deg: number) => !profile.rib[at(deg - 1)] && !profile.rib[at(deg)] && !profile.rib[at(deg + 1)];
  const order = Array.from({ length: 90 }, (_, i) => (i % 2 ? -Math.ceil(i / 2) : i / 2)).map((v) => (v + 90) % 90);
  for (const rot of order) {
    const degs = [rot, rot + 90, rot + 180, rot + 270];
    if (degs.every(clear)) return { rotationDeg: rot, ends: degs.map((d) => ({ deg: d, r: profile.radius[at(d)]! })) };
  }
  return { rotationDeg: 0, ends: [0, 90, 180, 270].map((d) => ({ deg: d, r: profile.rib[d] ? profile.core[d]! : profile.radius[d]! })) };
}

// ---------------------------------------------------------------------------
// Edge quality at a measured point
// ---------------------------------------------------------------------------

/** Edge sharpness at (x, y) along direction angle: max |dI/dr| within ±2 px, as % of image contrast per px. */
export function edgeScoreAt(img: GrayImage, x: number, y: number, angle: number, contrast: number): number {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let best = 0;
  for (let t = -2; t <= 2; t += 0.5) {
    const a = sampleGray(img, x + cos * (t - 1), y + sin * (t - 1));
    const b = sampleGray(img, x + cos * (t + 1), y + sin * (t + 1));
    best = Math.max(best, Math.abs(b - a) / 2);
  }
  return (best / contrast) * 100;
}
