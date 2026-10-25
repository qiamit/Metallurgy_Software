// Software analysis (primary result). Line-for-line port of the old FastAPI services
// grain_size.py + phase2_analysis.py, using OpenCV.js (WASM) instead of Python OpenCV.
// Images stay in BGR so overlay colours match the Python code exactly.
import { createRequire } from 'node:module'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
let cvPromise = null

// The emscripten module is a thenable: never return it from an async function or
// resolve a promise with it (that loops on its `then`). Callers do `const { cv } = await loadCv()`.
export function loadCv() {
  if (!cvPromise) {
    cvPromise = (async () => {
      const mod = require('@techstark/opencv-js')
      // onRuntimeInitialized can fire before we hook it, so poll for the bindings instead.
      const started = Date.now()
      while (!mod.Mat) {
        if (Date.now() - started > 60000) throw new Error('OpenCV runtime failed to initialise')
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
      return { cv: mod }
    })()
  }
  return cvPromise
}

/** Python round(x, n) for display values. */
function round(value, digits) {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** np.linspace(int(a), int(b), n, dtype=int) */
function linspaceInt(a, b, n) {
  const start = Math.trunc(a)
  const stop = Math.trunc(b)
  const out = []
  for (let i = 0; i < n; i += 1) out.push(Math.trunc(start + ((stop - start) * i) / (n - 1)))
  return out
}

// Refuse decompression bombs / huge scans before they reach OpenCV (default 50 MP).
const MAX_IMAGE_PIXELS = Number(process.env.MAX_IMAGE_PIXELS || 50_000_000)

/** Decode any image (png/jpeg/webp/tiff/bmp) into a BGR Mat. Caller deletes it. */
export async function decodeToBgr(cv, buffer) {
  let decoded
  try {
    decoded = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/pixel limit/i.test(message)) {
      throw new Error(`Image is too large (over ${Math.round(MAX_IMAGE_PIXELS / 1e6)} megapixels). Please downscale it.`)
    }
    throw new Error(`Could not read the image: ${message}`)
  }
  const { data, info } = decoded
  const rgba = cv.matFromArray(info.height, info.width, cv.CV_8UC4, data)
  const bgr = new cv.Mat()
  cv.cvtColor(rgba, bgr, cv.COLOR_RGBA2BGR)
  rgba.delete()
  return bgr
}

export async function encodeBgrToPng(cv, bgr) {
  const rgba = new cv.Mat()
  cv.cvtColor(bgr, rgba, cv.COLOR_BGR2RGBA)
  const buf = await sharp(Buffer.from(rgba.data), {
    raw: { width: rgba.cols, height: rgba.rows, channels: 4 },
  })
    .png()
    .toBuffer()
  rgba.delete()
  return buf
}

export async function encodeBgrToJpeg(cv, bgr, quality = 85) {
  const rgba = new cv.Mat()
  cv.cvtColor(bgr, rgba, cv.COLOR_BGR2RGBA)
  const buf = await sharp(Buffer.from(rgba.data), {
    raw: { width: rgba.cols, height: rgba.rows, channels: 4 },
  })
    .removeAlpha()
    .jpeg({ quality })
    .toBuffer()
  rgba.delete()
  return buf
}

function ones3(cv) {
  return cv.Mat.ones(3, 3, cv.CV_8U)
}

function color(cv, b, g, r) {
  return new cv.Scalar(b, g, r, 255)
}

function eachContour(cv, contours, fn) {
  for (let i = 0; i < contours.size(); i += 1) {
    const cnt = contours.get(i)
    try {
      fn(cnt)
    } finally {
      cnt.delete()
    }
  }
}

// ---------------------------------------------------------------------------
// Grain size — ASTM E112-13 / ISO 643:2019
// Calibrated against the ASTM E112 Plate I-B comparison chart (G 3.0–10.0 at 100×):
// Heyn intercept within ±0.4 G for G 3.0–9.5 (see docs/CHART_CALIBRATION.md).
// ---------------------------------------------------------------------------
/** ASTM E112-13 eq. for the mean lineal intercept ℓ in mm. */
export function gFromIntercept(meanInterceptMm) {
  if (!(meanInterceptMm > 0)) return 0
  return -6.643856 * Math.log10(meanInterceptMm) - 3.288
}

/** ASTM E112-13 eq. for N_A, grains per mm² at 1×. */
export function gFromGrainsPerMm2(na) {
  if (!(na > 0)) return 0
  return 3.321928 * Math.log10(na) - 2.954
}

/** Morphological skeleton (thin, 1-px boundary network) of a binary mask. */
function skeletonize(cv, binary) {
  const skel = cv.Mat.zeros(binary.rows, binary.cols, cv.CV_8U)
  const img = binary.clone()
  const opened = new cv.Mat()
  const temp = new cv.Mat()
  const eroded = new cv.Mat()
  const el = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3))
  try {
    for (let i = 0; i < 200 && cv.countNonZero(img) > 0; i += 1) {
      cv.morphologyEx(img, opened, cv.MORPH_OPEN, el)
      cv.subtract(img, opened, temp)
      cv.bitwise_or(skel, temp, skel)
      cv.erode(img, eroded, el)
      eroded.copyTo(img)
    }
    return skel
  } finally {
    for (const m of [img, opened, temp, eroded, el]) m.delete()
  }
}

/** Largest 8-connected component of a binary mask (the main boundary network). Caller deletes. */
function largestComponent(cv, mask) {
  const labels = new cv.Mat()
  const stats = new cv.Mat()
  const centroids = new cv.Mat()
  const out = cv.Mat.zeros(mask.rows, mask.cols, cv.CV_8U)
  try {
    const n = cv.connectedComponentsWithStats(mask, labels, stats, centroids, 8)
    let best = 0
    let bestArea = 0
    for (let i = 1; i < n; i += 1) {
      const a = stats.intAt(i, cv.CC_STAT_AREA)
      if (a > bestArea) {
        bestArea = a
        best = i
      }
    }
    if (best) {
      const lab = labels.data32S
      const o = out.data
      for (let p = 0; p < lab.length; p += 1) if (lab[p] === best) o[p] = 255
    }
    return out
  } finally {
    for (const m of [labels, stats, centroids]) m.delete()
  }
}

/** Typical line thickness of a mask: 2 × median distance-to-edge along its skeleton (px). */
function lineThickness(cv, mask) {
  if (cv.countNonZero(mask) === 0) return Infinity
  const dt = new cv.Mat()
  const sk = skeletonize(cv, mask)
  try {
    cv.distanceTransform(mask, dt, cv.DIST_L2, 3)
    const d = dt.data32F
    const s = sk.data
    const vals = []
    for (let p = 0; p < s.length; p += 1) if (s[p]) vals.push(d[p])
    if (!vals.length) return Infinity
    vals.sort((x, y) => x - y)
    return vals[Math.floor(vals.length / 2)] * 2
  } finally {
    dt.delete()
    sk.delete()
  }
}

/**
 * Grain boundaries as a 1-px network.
 * - Polarity: boundaries are the THIN connected phase (dark lines on ferrite, or light lines on
 *   McQuaid-Ehn / oxidised austenite) — decided by line thickness, not by area.
 * - A top-hat sized to the measured boundary width keeps boundaries and drops uneven illumination.
 * - Short isolated pieces (martensite needles, pits, dust) are dropped; the network spans the field.
 * Calibrated on ASTM E112 Plates I-B and IV (docs/CHART_CALIBRATION.md).
 */
function grainBoundaries(cv, gray) {
  const darkM = new cv.Mat()
  const brightM = new cv.Mat()
  const work = new cv.Mat()
  const tophat = new cv.Mat()
  const mask = new cv.Mat()
  const closeK = cv.Mat.ones(3, 3, cv.CV_8U)
  const labels = new cv.Mat()
  const stats = new cv.Mat()
  const centroids = new cv.Mat()
  let netBright = null
  let netDark = null
  try {
    cv.threshold(gray, darkM, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)
    cv.bitwise_not(darkM, brightM)
    netBright = largestComponent(cv, brightM)
    netDark = largestComponent(cv, darkM)
    const tBright = lineThickness(cv, netBright)
    const tDark = lineThickness(cv, netDark)
    const lightBoundaries = tBright < tDark
    if (lightBoundaries) gray.copyTo(work)
    else cv.bitwise_not(gray, work)
    const width = Math.max(2, Math.min(lightBoundaries ? tBright : tDark, 40))
    const k = Math.max(9, Math.trunc(4 * width)) | 1
    const el = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(k, k))
    cv.morphologyEx(work, tophat, cv.MORPH_TOPHAT, el)
    el.delete()
    cv.threshold(tophat, mask, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, closeK, new cv.Point(-1, -1), 1)
    // keep pieces whose extent is ≥ 20 % of the field (the boundary network), drop needles / specks
    const n = cv.connectedComponentsWithStats(mask, labels, stats, centroids, 8)
    const minSide = 0.2 * Math.min(gray.rows, gray.cols)
    const keep = new Uint8Array(n)
    for (let i = 1; i < n; i += 1) {
      const side = Math.max(stats.intAt(i, cv.CC_STAT_WIDTH), stats.intAt(i, cv.CC_STAT_HEIGHT))
      keep[i] = side >= minSide ? 1 : 0
    }
    const lab = labels.data32S
    const m = mask.data
    for (let p = 0; p < lab.length; p += 1) m[p] = keep[lab[p]] ? 255 : 0
    return { skeleton: skeletonize(cv, mask), lightBoundaries, boundaryWidthPx: width }
  } finally {
    for (const mm of [darkM, brightM, work, tophat, mask, closeK, labels, stats, centroids]) mm.delete()
    if (netBright) netBright.delete()
    if (netDark) netDark.delete()
  }
}

/** Boundary crossings along a pixel run; hits closer than minGap px are one boundary. */
function countCrossings(values, minGap = 3) {
  let count = 0
  let last = -Infinity
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] > 0) {
      if (i - last > minGap) count += 1
      last = i
    }
  }
  return count
}

/** One measurement pass at the given working resolution. Caller deletes `skeleton`. */
function measureGrains(cv, gray, um) {
  const { skeleton, lightBoundaries, boundaryWidthPx } = grainBoundaries(cv, gray)
  const h = gray.rows
  const w = gray.cols
  const sk = skeleton.data
  const x0 = Math.round(w * 0.05)
  const x1 = Math.round(w * 0.95)
  const y0 = Math.round(h * 0.05)
  const y1 = Math.round(h * 0.95)
  let crossings = 0
  let lengthPx = 0
  const lines = []
  const marks = []
  for (let i = 0; i < 9; i += 1) {
    const y = Math.round(y0 + ((y1 - y0) * (i + 0.5)) / 9)
    const row = sk.subarray(y * w + x0, y * w + x1)
    crossings += countCrossings(row)
    lengthPx += x1 - x0
    lines.push([x0, y, x1, y])
    let last = -Infinity
    for (let x = 0; x < row.length; x += 1) if (row[x] > 0) { if (x - last > 3) marks.push([x0 + x, y]); last = x }
  }
  for (let i = 0; i < 9; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * (i + 0.5)) / 9)
    const col = new Uint8Array(y1 - y0)
    for (let y = y0; y < y1; y += 1) col[y - y0] = sk[y * w + x]
    crossings += countCrossings(col)
    lengthPx += y1 - y0
    lines.push([x, y0, x, y1])
    let last = -Infinity
    for (let y = 0; y < col.length; y += 1) if (col[y] > 0) { if (y - last > 3) marks.push([x, y0 + y]); last = y }
  }

  // Jeffries planimetric: N = N_inside + ½·N_intercepted + 1 over the whole field.
  const dil = new cv.Mat()
  const grains = new cv.Mat()
  const labels = new cv.Mat()
  const stats = new cv.Mat()
  const centroids = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
  const areas = []
  let inside = 0
  let touching = 0
  try {
    cv.dilate(skeleton, dil, kernel)
    cv.bitwise_not(dil, grains)
    const n = cv.connectedComponentsWithStats(grains, labels, stats, centroids, 4)
    for (let i = 1; i < n; i += 1) {
      const area = stats.intAt(i, cv.CC_STAT_AREA)
      if (area < 4) continue
      const left = stats.intAt(i, cv.CC_STAT_LEFT)
      const top = stats.intAt(i, cv.CC_STAT_TOP)
      const bw = stats.intAt(i, cv.CC_STAT_WIDTH)
      const bh = stats.intAt(i, cv.CC_STAT_HEIGHT)
      if (left <= 0 || top <= 0 || left + bw >= w || top + bh >= h) touching += 1
      else {
        inside += 1
        areas.push(area)
      }
    }
  } finally {
    for (const m of [dil, grains, labels, stats, centroids, kernel]) m.delete()
  }
  const areaMm2 = ((w * um) / 1000) * ((h * um) / 1000)
  const grainsCounted = inside + 0.5 * touching + 1
  return {
    skeleton,
    lightBoundaries,
    boundaryWidthPx,
    crossings,
    lengthPx,
    interceptPx: crossings > 0 ? lengthPx / crossings : Infinity,
    lines,
    marks,
    areas,
    grainsCounted,
    na: areaMm2 > 0 ? grainsCounted / areaMm2 : 0,
  }
}

const GRAIN_MAX_SIDE = 1200
const GRAIN_TARGET_INTERCEPT_PX = 40

export function analyzeGrainSize(cv, imageBgr, umPerPxX = 1, umPerPxY = 1) {
  const gray = new cv.Mat()
  const overlay = imageBgr.clone()
  let work = null
  let m = null
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    const H = gray.rows
    const W = gray.cols
    const um0 = (umPerPxX + umPerPxY) / 2
    // Work at a resolution where a typical grain spans ~40 px: fine enough for small grains,
    // coarse enough that texture inside large grains (needles, carbides) does not read as boundaries.
    let scale = Math.min(1, GRAIN_MAX_SIDE / Math.max(W, H))
    work = new cv.Mat()
    if (scale < 1) cv.resize(gray, work, new cv.Size(Math.round(W * scale), Math.round(H * scale)), 0, 0, cv.INTER_AREA)
    else gray.copyTo(work)
    m = measureGrains(cv, work, um0 / scale)
    let passes = 1
    while (m.interceptPx > GRAIN_TARGET_INTERCEPT_PX * 1.2 && passes < 4) {
      const next = scale * (GRAIN_TARGET_INTERCEPT_PX / m.interceptPx)
      const nw = Math.round(W * next)
      const nh = Math.round(H * next)
      if (Math.min(nw, nh) < 200) break
      scale = next
      cv.resize(gray, work, new cv.Size(nw, nh), 0, 0, cv.INTER_AREA)
      m.skeleton.delete()
      m = measureGrains(cv, work, um0 / scale)
      passes += 1
    }
    const um = um0 / scale
    const meanUm = Number.isFinite(m.interceptPx) ? m.interceptPx * um : 0
    const meanMm = meanUm / 1000
    const gIntercept = meanMm > 0 ? gFromIntercept(meanMm) : 0
    const gPlanimetric = gFromGrainsPerMm2(m.na)

    // Duplex (ASTM E1181): area share of grains ≥ 3 G numbers coarser (≥ 8× median area).
    // Needs ≥ 30 grains, ≥ 3 coarse grains and ≥ 10 % of area: on calibration plates of uniform
    // grains the coarse share stayed below 7 %, and gaps in the boundary network merge a few grains.
    let duplexPct = 0
    let coarseGrains = 0
    if (m.areas.length >= 30) {
      const sorted = [...m.areas].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      const total = sorted.reduce((s, v) => s + v, 0)
      const coarse = sorted.filter((v) => v >= 8 * median)
      coarseGrains = coarse.length
      duplexPct = total > 0 ? (coarse.reduce((s, v) => s + v, 0) / total) * 100 : 0
    }

    // Overlay at full resolution: boundary network (green), test lines, crossings (red).
    const big = new cv.Mat()
    const thick = new cv.Mat()
    const k = cv.Mat.ones(3, 3, cv.CV_8U)
    cv.resize(m.skeleton, big, new cv.Size(W, H), 0, 0, cv.INTER_NEAREST)
    cv.dilate(big, thick, k, new cv.Point(-1, -1), scale < 0.6 ? 2 : 1)
    const green = new cv.Mat(H, W, cv.CV_8UC3, color(cv, 0, 220, 0))
    green.copyTo(overlay, thick)
    for (const mm of [green, big, thick, k]) mm.delete()
    const inv = 1 / scale
    for (const [a, b, c, d] of m.lines) {
      cv.line(overlay, new cv.Point(a * inv, b * inv), new cv.Point(c * inv, d * inv), color(cv, 0, 200, 255), 1)
    }
    for (const [mx, my] of m.marks) cv.circle(overlay, new cv.Point(mx * inv, my * inv), 3, color(cv, 0, 0, 255), -1)

    const result = {
      standard: 'ASTM E112-13 / ISO 643:2019',
      method: 'Heyn lineal intercept (primary) + Jeffries planimetric',
      grain_size_number_G: round(gIntercept, 2),
      grain_size_number_G_planimetric: round(gPlanimetric, 2),
      astm_grain_size_number: Math.round(gIntercept * 2) / 2,
      mean_intercept_um: round(meanUm, 3),
      mean_intercept_mm: round(meanMm, 6),
      intercept_count: m.crossings,
      test_line_length_mm: round((m.lengthPx * um) / 1000, 4),
      grains_per_mm2: round(m.na, 2),
      grain_count_estimate: Math.round(m.grainsCounted),
      average_grain_diameter_um: round(m.na > 0 ? 1000 / Math.sqrt(m.na) : 0, 2),
      duplex_coarse_area_percent: round(duplexPct, 1),
      duplex_suspected: duplexPct >= 10 && coarseGrains >= 3,
      boundary_polarity: m.lightBoundaries ? 'light boundaries on dark grains' : 'dark boundaries on light grains',
      working_scale: round(scale, 3),
      um_per_px_x: umPerPxX,
      um_per_px_y: umPerPxY,
      image_width_px: W,
      image_height_px: H,
      notes:
        'Heyn intercept is primary (calibrated on ASTM E112 plates). Check the green boundary overlay: heavy ' +
        'texture inside very coarse grains (e.g. martensite needles) can raise G. Duplex flagged when ≥ 10 % of ' +
        'grain area (≥ 3 grains) is ≥ 3 G numbers coarser (ASTM E1181) — confirm on the overlay.',
    }
    return { result, overlay }
  } finally {
    gray.delete()
    if (work) work.delete()
    if (m) m.skeleton.delete()
  }
}

// ---------------------------------------------------------------------------
// Inclusion rating — ISO 4967:2013 Method A / ASTM E45 Method A (JK chart)
// Severity limits are the minimum values from ASTM E45 Plate I-r (identical to ISO 4967:2013 Table).
// Calibrated on the E45 Plate I-r chart fields (docs/CHART_CALIBRATION.md).
// ---------------------------------------------------------------------------
const INCLUSION_COLORS = {
  A: [0, 0, 255],
  B: [0, 165, 255],
  C: [0, 255, 255],
  D: [0, 200, 0],
  DS: [255, 0, 255],
}

const JK_STEPS = [0.5, 1, 1.5, 2, 2.5, 3]
export const JK_LIMITS = {
  A: [37, 127, 261, 436, 649, 898], // total length, µm per 0.50 mm²
  B: [17, 77, 184, 343, 555, 822],
  C: [18, 76, 176, 320, 510, 746],
  D: [1, 4, 9, 16, 25, 36], // count per 0.50 mm²
  DS: [13, 19, 27, 38, 53, 76], // diameter, µm
}
// Thin / heavy series: maximum width (µm) of the thin series per type
const JK_THIN_MAX_WIDTH = { A: 4, B: 9, C: 5, D: 8 }
const JK_FIELD_MM = 0.71 // 0.71 mm × 0.71 mm ≈ 0.50 mm²
const JK_MIN_WIDTH_UM = 2 // narrower particles are not rated
const JK_LINK_GAP_UM = 40 // along the rolling direction
const JK_LINK_LATERAL_UM = 10

export function jkSeverity(type, value) {
  const limits = JK_LIMITS[type]
  let rating = 0
  for (let i = 0; i < limits.length; i += 1) if (value >= limits[i]) rating = JK_STEPS[i]
  return rating
}

/** Rolling direction (radians) from length-weighted orientation of elongated particles; default vertical. */
function rollingDirection(particles) {
  let sx = 0
  let sy = 0
  for (const p of particles) {
    if (p.aspect < 2) continue
    sx += p.lengthUm * Math.cos(2 * p.angle)
    sy += p.lengthUm * Math.sin(2 * p.angle)
  }
  if (sx === 0 && sy === 0) return Math.PI / 2
  return Math.atan2(sy, sx) / 2
}

function rateField(particles, dir) {
  const cos = Math.cos(dir)
  const sin = Math.sin(dir)
  // coordinates: u along the rolling direction, v across it
  const items = particles.map((p, i) => {
    const u = p.cx * cos + p.cy * sin
    const v = -p.cx * sin + p.cy * cos
    const d = Math.abs(Math.cos(p.angle - dir))
    const halfAlong = (p.lengthUm * d + p.widthUm * Math.sqrt(Math.max(0, 1 - d * d))) / 2
    return { i, u, v, u0: u - halfAlong, u1: u + halfAlong, p }
  })
  // link particles into one inclusion when close along and across the rolling direction
  const parent = items.map((_, i) => i)
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const sorted = [...items].sort((a, b) => a.u0 - b.u0)
  for (let a = 0; a < sorted.length; a += 1) {
    for (let b = a + 1; b < sorted.length; b += 1) {
      const A = sorted[a]
      const B = sorted[b]
      if (B.u0 - A.u1 > JK_LINK_GAP_UM) break
      if (Math.abs(A.v - B.v) <= JK_LINK_LATERAL_UM) parent[find(A.i)] = find(B.i)
    }
  }
  const groups = new Map()
  for (const it of items) {
    const r = find(it.i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(it)
  }

  const totals = {
    A: { thin: 0, heavy: 0 },
    B: { thin: 0, heavy: 0 },
    C: { thin: 0, heavy: 0 },
    D: { thin: 0, heavy: 0 },
  }
  let dsMax = 0
  const inclusions = []
  for (const g of groups.values()) {
    const span = Math.max(...g.map((x) => x.u1)) - Math.min(...g.map((x) => x.u0))
    const width = Math.max(...g.map((x) => x.p.widthUm))
    const elongated = g.filter((x) => x.p.aspect >= 3)
    let type
    if (g.length >= 3 && elongated.length < g.length / 2) type = 'B'
    else if (elongated.length) {
      // sulphides (A) are mid-grey, silicates (C) dark — from mean particle intensity vs the field
      const tone = g.reduce((s, x) => s + x.p.tone, 0) / g.length
      type = tone > 0.35 ? 'A' : 'C'
    } else type = null
    if (type) {
      const series = width <= JK_THIN_MAX_WIDTH[type] ? 'thin' : 'heavy'
      totals[type][series] += span
      inclusions.push({ type, series, length_um: round(span, 1), width_um: round(width, 1), particles: g.length, members: g })
    } else {
      // isolated globular particles: D, or DS when one is ≥ 13 µm
      for (const x of g) {
        const dia = Math.max(x.p.lengthUm, x.p.widthUm)
        if (dia >= JK_LIMITS.DS[0]) {
          dsMax = Math.max(dsMax, dia)
          inclusions.push({ type: 'DS', series: 'heavy', length_um: round(dia, 1), width_um: round(x.p.widthUm, 1), particles: 1, members: [x] })
        } else if (x.p.widthUm >= 3 || dia >= 3) {
          const series = dia <= JK_THIN_MAX_WIDTH.D ? 'thin' : 'heavy'
          totals.D[series] += 1
          inclusions.push({ type: 'D', series, length_um: round(dia, 1), width_um: round(x.p.widthUm, 1), particles: 1, members: [x] })
        }
      }
    }
  }
  return { totals, dsMax, inclusions }
}

export function analyzeInclusion(cv, imageBgr, umPerPxX = 1, umPerPxY = 1) {
  const gray = new cv.Mat()
  const blur = new cv.Mat()
  const thresh = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const overlay = imageBgr.clone()
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0)
    const otsuT = cv.threshold(blur, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE)
    const um = (umPerPxX + umPerPxY) / 2
    const W = gray.cols
    const H = gray.rows
    const particles = []
    const mask = cv.Mat.zeros(H, W, cv.CV_8U)
    eachContour(cv, contours, (cnt) => {
      const areaPx = cv.contourArea(cnt)
      if (areaPx < 2) return
      const rect = cv.minAreaRect(cnt)
      let { width: rw, height: rh } = rect.size
      let angle = (rect.angle * Math.PI) / 180
      if (rw < rh) {
        ;[rw, rh] = [rh, rw]
        angle += Math.PI / 2
      }
      const lengthUm = rw * um
      // mean width = area / length: the rotated box's short side includes scan blur and jagged edges
      const widthUm = Math.min(rh, (areaPx + rw) / Math.max(rw, 1)) * um
      if (widthUm < JK_MIN_WIDTH_UM) return // ISO 4967: particles narrower than 2 µm are not rated
      const r = cv.boundingRect(cnt)
      const roi = gray.roi(r)
      mask.setTo(new cv.Scalar(0))
      const vec = new cv.MatVector()
      vec.push_back(cnt)
      cv.drawContours(mask, vec, 0, new cv.Scalar(255), -1)
      vec.delete()
      const mroi = mask.roi(r)
      const meanIn = cv.mean(roi, mroi)[0]
      roi.delete()
      mroi.delete()
      particles.push({
        cx: rect.center.x * um,
        cy: rect.center.y * um,
        lengthUm,
        widthUm,
        aspect: lengthUm / Math.max(widthUm, 1e-6),
        angle,
        tone: Math.max(0, Math.min(1, (meanIn - 0) / Math.max(otsuT, 1))), // 0 = black, 1 = at threshold
        rect,
      })
    })
    mask.delete()

    const dir = rollingDirection(particles)
    // Method A rates 0.50 mm² fields; a larger image is split into fields and the worst field counts.
    const fieldUm = JK_FIELD_MM * 1000
    const imgWUm = W * um
    const imgHUm = H * um
    const nx = Math.max(1, Math.round(imgWUm / fieldUm))
    const ny = Math.max(1, Math.round(imgHUm / fieldUm))
    const areaMm2 = (imgWUm / 1000) * (imgHUm / 1000)
    const fieldAreaMm2 = areaMm2 / (nx * ny)
    // normalise to 0.50 mm² only when the field is clearly smaller (e.g. a high-magnification image)
    const norm = fieldAreaMm2 < 0.375 ? 0.5 / fieldAreaMm2 : 1
    const worst = {}
    for (const t of ['A', 'B', 'C', 'D']) worst[t] = { thin: 0, heavy: 0 }
    let worstDS = 0
    const allInclusions = []
    for (let fy = 0; fy < ny; fy += 1) {
      for (let fx = 0; fx < nx; fx += 1) {
        const inField = particles.filter(
          (p) =>
            p.cx >= (fx * imgWUm) / nx && p.cx < ((fx + 1) * imgWUm) / nx &&
            p.cy >= (fy * imgHUm) / ny && p.cy < ((fy + 1) * imgHUm) / ny,
        )
        const { totals, dsMax, inclusions } = rateField(inField, dir)
        allInclusions.push(...inclusions)
        for (const t of ['A', 'B', 'C', 'D']) {
          for (const sr of ['thin', 'heavy']) {
            worst[t][sr] = Math.max(worst[t][sr], jkSeverity(t, totals[t][sr] * norm))
          }
        }
        worstDS = Math.max(worstDS, jkSeverity('DS', dsMax))
      }
    }

    // overlay: rotated boxes per particle, coloured by the inclusion type it was rated as
    for (const inc of allInclusions) {
      const c = color(cv, ...INCLUSION_COLORS[inc.type])
      for (const m of inc.members) {
        const pts = cv.RotatedRect.points(m.p.rect)
        for (let k = 0; k < 4; k += 1) {
          const p1 = pts[k]
          const p2 = pts[(k + 1) % 4]
          cv.line(overlay, new cv.Point(p1.x, p1.y), new cv.Point(p2.x, p2.y), c, 2)
        }
      }
      const first = inc.members[0].p.rect.center
      cv.putText(overlay, `${inc.type}${inc.series === 'heavy' ? 'H' : ''}`, new cv.Point(first.x + 6, first.y), cv.FONT_HERSHEY_SIMPLEX, 0.5, c, 1)
    }

    const rating = {}
    for (const t of ['A', 'B', 'C', 'D']) rating[t] = { thin: worst[t].thin, heavy: worst[t].heavy }
    const typeCounts = { A: 0, B: 0, C: 0, D: 0, DS: 0 }
    for (const inc of allInclusions) typeCounts[inc.type] += 1
    const worstIndex = Math.max(worstDS, ...Object.values(rating).flatMap((r) => [r.thin, r.heavy]))
    const result = {
      standard: 'ISO 4967:2013 Method A / ASTM E45 Method A',
      jk_rating: rating,
      ds_rating: worstDS,
      worst_severity_index: worstIndex,
      jk_summary: ['A', 'B', 'C', 'D']
        .map((t) => `${t} ${rating[t].thin}/${rating[t].heavy}`)
        .concat(`DS ${worstDS}`)
        .join('  '),
      inclusion_count: allInclusions.length,
      type_counts: typeCounts,
      fields_rated: nx * ny,
      field_area_mm2: round(fieldAreaMm2, 3),
      rolling_direction_deg: round((dir * 180) / Math.PI, 1),
      inclusions: allInclusions.slice(0, 200).map(({ members: _m, ...rest }) => rest),
      notes:
        'Ratings shown as thin/heavy per type (worst field). A vs C is decided by particle tone (sulphides ' +
        'mid-grey, silicates dark) — confirm on the image. Image should be at 100× on an unetched, polished section.' +
        (norm > 1 ? ` Image covers ${round(areaMm2, 3)} mm²; lengths scaled to 0.50 mm².` : ''),
    }
    return { result, overlay }
  } finally {
    for (const m of [gray, blur, thresh, hierarchy]) m.delete()
    contours.delete()
  }
}

// ---------------------------------------------------------------------------
// Decarburization — ISO 3887
// ---------------------------------------------------------------------------
export function analyzeDecarb(cv, imageBgr, umPerPxX = 1, _umPerPxY = 1) {
  const gray = new cv.Mat()
  const overlay = imageBgr.clone()
  let profileMat = null
  const smoothMat = new cv.Mat()
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    const h = gray.rows
    const w = gray.cols
    const g = gray.data
    // Assume left edge is free surface; measure transition of mean intensity profile
    const profile = new Float32Array(w)
    for (let x = 0; x < w; x += 1) {
      let sum = 0
      for (let y = 0; y < h; y += 1) sum += g[y * w + x]
      profile[x] = sum / h
    }
    profileMat = cv.matFromArray(1, w, cv.CV_32F, Array.from(profile))
    cv.GaussianBlur(profileMat, smoothMat, new cv.Size(1, 31), 0)
    const smooth = smoothMat.data32F
    // np.gradient: central differences inside, one-sided at the ends
    const grad = new Float64Array(w)
    for (let i = 0; i < w; i += 1) {
      if (w === 1) grad[i] = 0
      else if (i === 0) grad[i] = Math.abs(smooth[1] - smooth[0])
      else if (i === w - 1) grad[i] = Math.abs(smooth[w - 1] - smooth[w - 2])
      else grad[i] = Math.abs((smooth[i + 1] - smooth[i - 1]) / 2)
    }
    // Search transition in outer 40% of width
    const searchLen = Math.min(w, Math.max(10, Math.trunc(w * 0.4)))
    let edgeIdx = 0
    for (let i = 1; i < searchLen; i += 1) if (grad[i] > grad[edgeIdx]) edgeIdx = i
    const depthUm = edgeIdx * umPerPxX

    cv.line(overlay, new cv.Point(edgeIdx, 0), new cv.Point(edgeIdx, h - 1), color(cv, 0, 0, 255), 2)
    cv.line(overlay, new cv.Point(0, 0), new cv.Point(0, h - 1), color(cv, 0, 255, 0), 2)
    cv.putText(
      overlay,
      `Decarb depth ~ ${depthUm.toFixed(1)} um`,
      new cv.Point(10, 24),
      cv.FONT_HERSHEY_SIMPLEX,
      0.7,
      color(cv, 0, 0, 255),
      2,
    )

    const result = {
      standard: 'ISO 3887:2017',
      method: 'metallographic_edge_transition',
      decarb_depth_um: round(depthUm, 2),
      decarb_depth_mm: round(depthUm / 1000, 5),
      edge_pixel: edgeIdx,
      notes: 'Assumes free surface on image left. Reorient sample if needed.',
    }
    return { result, overlay }
  } finally {
    gray.delete()
    smoothMat.delete()
    if (profileMat) profileMat.delete()
  }
}

// ---------------------------------------------------------------------------
// Micro — phase area fractions
// ---------------------------------------------------------------------------
export function analyzeMicro(cv, imageBgr, umPerPxX = 1, umPerPxY = 1) {
  const gray = new cv.Mat()
  const blur = new cv.Mat()
  const binary = new cv.Mat()
  const zeros = new cv.Mat()
  const mask = new cv.Mat()
  const planes = new cv.MatVector()
  const overlay = new cv.Mat()
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
    cv.threshold(blur, binary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    const total = binary.rows * binary.cols
    const lightFrac = total ? cv.countNonZero(binary) / total : 0
    const darkFrac = 1 - lightFrac

    zeros.create(binary.rows, binary.cols, cv.CV_8U)
    zeros.setTo(new cv.Scalar(0))
    planes.push_back(zeros)
    planes.push_back(binary)
    planes.push_back(zeros)
    cv.merge(planes, mask)
    cv.addWeighted(imageBgr, 0.7, mask, 0.3, 0, overlay)

    const areaUm2 = gray.rows * gray.cols * umPerPxX * umPerPxY
    const result = {
      standard: 'Micro Analysis',
      light_phase_fraction: round(lightFrac, 4),
      dark_phase_fraction: round(darkFrac, 4),
      field_area_um2: round(areaUm2, 2),
      notes: 'Binary phase split via Otsu. Extend with trained classifiers as needed.',
    }
    return { result, overlay }
  } catch (err) {
    overlay.delete()
    throw err
  } finally {
    for (const m of [gray, blur, binary, zeros, mask]) m.delete()
    planes.delete()
  }
}

// ---------------------------------------------------------------------------
// Macro — IS 10138 stringers >= 1 mm
// ---------------------------------------------------------------------------
export function analyzeMacro(cv, imageBgr, umPerPxX = 1, umPerPxY = 1) {
  const gray = new cv.Mat()
  const blur = new cv.Mat()
  const thresh = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const overlay = imageBgr.clone()
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    cv.GaussianBlur(gray, blur, new cv.Size(7, 7), 0)
    cv.threshold(blur, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    const umPerPx = (umPerPxX + umPerPxY) / 2
    const stringers = []
    eachContour(cv, contours, (cnt) => {
      const { x, y, width: w, height: h } = cv.boundingRect(cnt)
      const lengthMm = (Math.max(w, h) * umPerPx) / 1000
      if (lengthMm < 1.0) return
      const thicknessMm = (Math.min(w, h) * umPerPx) / 1000
      stringers.push({ length_mm: round(lengthMm, 3), thickness_mm: round(thicknessMm, 3) })
      cv.rectangle(overlay, new cv.Point(x, y), new cv.Point(x + w, y + h), color(cv, 255, 0, 0), 2)
    })
    const result = {
      standard: 'IS 10138:2010',
      stringer_count: stringers.length,
      total_length_mm: round(
        stringers.reduce((s, v) => s + v.length_mm, 0),
        3,
      ),
      stringers: stringers.slice(0, 200),
      notes:
        'Macroscopic inclusions >= 1 mm length. Units depend on calibration (use mm scale for macro).',
    }
    return { result, overlay }
  } finally {
    for (const m of [gray, blur, thresh, hierarchy]) m.delete()
    contours.delete()
  }
}

// ---------------------------------------------------------------------------
// Cast iron graphite — shared particle measurement
// ---------------------------------------------------------------------------
/**
 * Dark graphite particles on a light (unetched or lightly etched) matrix.
 * Returns per particle: area µm², max Feret µm (min enclosing circle), roundness = 4A / (π·Fmax²).
 */
function graphiteParticles(cv, gray, um) {
  const blur = new cv.Mat()
  const bin = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const out = []
  try {
    cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0)
    cv.threshold(blur, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)
    const k = cv.Mat.ones(3, 3, cv.CV_8U)
    cv.morphologyEx(bin, bin, cv.MORPH_OPEN, k)
    k.delete()
    cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE)
    const W = gray.cols
    const H = gray.rows
    for (let i = 0; i < contours.size(); i += 1) {
      const cnt = contours.get(i)
      const areaPx = cv.contourArea(cnt) + cv.arcLength(cnt, true) / 2 // include the boundary pixels
      if (areaPx >= 6) {
        const { center, radius } = cv.minEnclosingCircle(cnt)
        const r = cv.boundingRect(cnt)
        const fmax = Math.max(2 * radius, 1)
        out.push({
          cnt,
          areaUm2: areaPx * um * um,
          feretUm: fmax * um,
          roundness: Math.min(1, (4 * areaPx) / (Math.PI * fmax * fmax)),
          touchesEdge: r.x <= 0 || r.y <= 0 || r.x + r.width >= W || r.y + r.height >= H,
          center,
        })
      } else cnt.delete()
    }
    return { particles: out, graphiteAreaFraction: cv.countNonZero(bin) / (W * H) }
  } finally {
    for (const m of [blur, bin, hierarchy]) m.delete()
    contours.delete()
  }
}

// A247 size classes by maximum dimension at 100× (mm): class n spans [2^(8-n), 2^(9-n)) mm, i.e.
// real size [10·2^(8-n), 10·2^(9-n)) µm; class 1 ≥ 1280 µm, class 8 < 20 µm.
export function a247SizeClass(maxDimUm) {
  const at100mm = maxDimUm / 10
  if (at100mm >= 128) return 1
  if (at100mm < 2) return 8
  return Math.min(8, Math.max(1, 8 - Math.floor(Math.log2(at100mm))))
}

// ---------------------------------------------------------------------------
// Nodularity — ISO 945-4 / ASTM E2567 / A247 (spheroidal graphite iron)
// Roundness R = 4A/(π·Fmax²): nodular ≥ 0.60 (ASTM E2567), intermediate 0.525–0.60.
// Particles with max Feret < 10 µm are not counted (ISO 945-4, E2567).
// ---------------------------------------------------------------------------
export function analyzeNodularity(cv, imageBgr, umPerPxX = 1, umPerPxY = 1) {
  const gray = new cv.Mat()
  const overlay = imageBgr.clone()
  let particles = []
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    const um = (umPerPxX + umPerPxY) / 2
    const found = graphiteParticles(cv, gray, um)
    particles = found.particles
    const counted = particles.filter((p) => p.feretUm >= 10)
    let nodArea = 0
    let interArea = 0
    let totalArea = 0
    const nodules = []
    for (const p of counted) {
      totalArea += p.areaUm2
      p.kind = p.roundness >= 0.6 ? 'nodular' : p.roundness >= 0.525 ? 'intermediate' : 'non-nodular'
      if (p.kind === 'nodular') {
        nodArea += p.areaUm2
        nodules.push(p)
      } else if (p.kind === 'intermediate') interArea += p.areaUm2
    }
    const fieldMm2 = ((gray.cols * umPerPxX) / 1000) * ((gray.rows * umPerPxY) / 1000)
    // count: nodules fully inside + ½ of those cut by the field edge
    const noduleCount = nodules.filter((p) => !p.touchesEdge).length + 0.5 * nodules.filter((p) => p.touchesEdge).length
    const sizes = nodules.map((p) => p.feretUm).sort((a, b) => a - b)
    const medianNodule = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0
    for (const p of counted) {
      const c = p.kind === 'nodular' ? color(cv, 0, 200, 0) : p.kind === 'intermediate' ? color(cv, 0, 200, 255) : color(cv, 0, 0, 255)
      const v = new cv.MatVector()
      v.push_back(p.cnt)
      cv.drawContours(overlay, v, 0, c, 2)
      v.delete()
    }
    const nodularity = totalArea > 0 ? (nodArea / totalArea) * 100 : 0
    const result = {
      standard: 'ISO 945-4 / ASTM E2567 / ASTM A247',
      nodularity_percent: round(nodularity, 1),
      nodularity_incl_intermediate_percent: round(totalArea > 0 ? ((nodArea + 0.5 * interArea) / totalArea) * 100 : 0, 1),
      nodule_count_per_mm2: round(fieldMm2 > 0 ? noduleCount / fieldMm2 : 0, 1),
      median_nodule_diameter_um: round(medianNodule, 1),
      nodule_size_class_a247: medianNodule > 0 ? a247SizeClass(medianNodule) : null,
      graphite_area_percent: round(found.graphiteAreaFraction * 100, 2),
      particles_counted: counted.length,
      nodules: nodules.length,
      field_area_mm2: round(fieldMm2, 4),
      notes:
        'Use an unetched, polished section at 100×. Nodular = roundness ≥ 0.60 (green, ASTM E2567), intermediate ' +
        '0.525–0.60 (yellow), non-nodular (red). Particles under 10 µm are ignored.',
    }
    return { result, overlay }
  } finally {
    gray.delete()
    for (const p of particles) p.cnt.delete()
  }
}

// ---------------------------------------------------------------------------
// Graphite flakes — ASTM A247 / ISO 945-1 (grey iron)
// Size class from the longest flakes (mean of the 5 longest), A247 Table 1 classes.
// ---------------------------------------------------------------------------
export function analyzeGraphiteFlake(cv, imageBgr, umPerPxX = 1, umPerPxY = 1) {
  const gray = new cv.Mat()
  const overlay = imageBgr.clone()
  let particles = []
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    const um = (umPerPxX + umPerPxY) / 2
    const found = graphiteParticles(cv, gray, um)
    particles = found.particles
    const flakes = particles.filter((p) => p.feretUm >= 5)
    const lengths = flakes.map((p) => p.feretUm).sort((a, b) => b - a)
    const top = lengths.slice(0, Math.min(5, lengths.length))
    const longest = top.length ? top.reduce((s, v) => s + v, 0) / top.length : 0
    const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0
    const sizeClass = longest > 0 ? a247SizeClass(longest) : null
    // longest flakes cut by the field edge are longer than measured: the class is then this or coarser
    const cutByEdge = flakes
      .slice()
      .sort((a, b) => b.feretUm - a.feretUm)
      .slice(0, 5)
      .some((p) => p.touchesEdge)
    // Rough type hint from flake size and spacing: very fine, crowded flakes suggest
    // interdendritic D/E; otherwise uniform type A is the common case. Confirm against the chart.
    const nearest = []
    for (let i = 0; i < flakes.length && i < 400; i += 1) {
      let best = Infinity
      for (let j = 0; j < flakes.length && j < 400; j += 1) {
        if (i === j) continue
        const dx = (flakes[i].center.x - flakes[j].center.x) * um
        const dy = (flakes[i].center.y - flakes[j].center.y) * um
        best = Math.min(best, Math.hypot(dx, dy))
      }
      if (Number.isFinite(best)) nearest.push(best)
    }
    nearest.sort((a, b) => a - b)
    const spacing = nearest.length ? nearest[Math.floor(nearest.length / 2)] : 0
    const typeHint = sizeClass >= 7 && spacing < 25 ? 'D/E (interdendritic) suspected' : 'A (uniform, random) likely'
    for (const p of flakes) {
      const v = new cv.MatVector()
      v.push_back(p.cnt)
      cv.drawContours(overlay, v, 0, color(cv, 0, 200, 255), 1)
      v.delete()
    }
    for (const p of flakes.slice().sort((a, b) => b.feretUm - a.feretUm).slice(0, 5)) {
      const v = new cv.MatVector()
      v.push_back(p.cnt)
      cv.drawContours(overlay, v, 0, color(cv, 0, 0, 255), 3)
      v.delete()
    }
    const result = {
      standard: 'ASTM A247 / ISO 945-1',
      flake_size_class: sizeClass,
      flake_size_class_note: cutByEdge ? `class ${sizeClass} or coarser (longest flakes run off the field)` : null,
      longest_flakes_mean_um: round(longest, 1),
      median_flake_length_um: round(median, 1),
      flake_count: flakes.length,
      graphite_area_percent: round(found.graphiteAreaFraction * 100, 2),
      median_flake_spacing_um: round(spacing, 1),
      graphite_type_hint: typeHint,
      notes:
        'Unetched section at 100×. Size class from the 5 longest flakes (red). Graphite type A–E is a hint ' +
        'only — compare with the A247 Plate II chart and confirm.',
    }
    return { result, overlay }
  } finally {
    gray.delete()
    for (const p of particles) p.cnt.delete()
  }
}

export const ANALYZERS = {
  grain_size: analyzeGrainSize,
  inclusion: analyzeInclusion,
  decarb: analyzeDecarb,
  micro: analyzeMicro,
  macro: analyzeMacro,
  nodularity: analyzeNodularity,
  graphite_flake: analyzeGraphiteFlake,
}
