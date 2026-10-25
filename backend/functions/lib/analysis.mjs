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

const N8 = (w) => [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]

/**
 * One seed per grain: maxima of the distance-to-boundary map, kept when they are separated from a higher
 * maximum by a saddle lower than `ratio` × their height (a gap in a boundary is a narrow waist).
 * Union–find flooding from the top, like computing h-maxima dynamics. Returns seed pixel indices.
 */
function grainSeeds(dt, w, h, ratio, minR) {
  let maxD = 0
  for (let p = 0; p < dt.length; p += 1) if (dt[p] > maxD) maxD = dt[p]
  const nb = Math.ceil(maxD * 4) + 1
  const counts = new Int32Array(nb + 1)
  for (let p = 0; p < dt.length; p += 1) if (dt[p] >= 1) counts[Math.round(dt[p] * 4)] += 1
  const start = new Int32Array(nb + 1)
  for (let b = nb - 1, acc = 0; b >= 0; b -= 1) { start[b] = acc; acc += counts[b] }
  const order = new Int32Array(start[0] + counts[0])
  const fill = start.slice()
  for (let p = 0; p < dt.length; p += 1) if (dt[p] >= 1) order[fill[Math.round(dt[p] * 4)]++] = p
  const parent = new Int32Array(dt.length).fill(-1)
  const peak = new Float32Array(dt.length)
  const peakPix = new Int32Array(dt.length)
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  const off = N8(w)
  const seeds = []
  for (let i = 0; i < order.length; i += 1) {
    const p = order[i]
    const x = p % w
    if (x === 0 || x === w - 1 || p < w || p >= dt.length - w) continue
    const roots = []
    for (const o of off) { const q = p + o; if (parent[q] >= 0) { const r = find(q); if (!roots.includes(r)) roots.push(r) } }
    parent[p] = p
    if (!roots.length) { peak[p] = dt[p]; peakPix[p] = p; continue }
    roots.sort((a, b) => peak[b] - peak[a])
    const top = roots[0]
    for (let k = 1; k < roots.length; k += 1) {
      const r = roots[k]
      if (peak[r] >= minR && dt[p] < ratio * peak[r]) seeds.push(peakPix[r])
      parent[r] = top
    }
    parent[p] = top
  }
  for (let i = 0; i < order.length; i += 1) {
    const p = order[i]
    if (parent[p] === p && peak[p] >= minR) seeds.push(peakPix[p])
  }
  return seeds
}

/** Priority-flood watershed from seeds over an 8-bit elevation (boundaries high). Returns Int32 labels. */
function floodFromSeeds(elev, w, h, seeds) {
  const label = new Int32Array(w * h)
  const queues = Array.from({ length: 256 }, () => [])
  seeds.forEach((p, i) => { label[p] = i + 1; queues[elev[p]].push(p) })
  const off = [-w, -1, 1, w]
  for (let lvl = 0; lvl < 256; lvl += 1) {
    const q = queues[lvl]
    while (q.length) {
      const p = q.pop()
      const x = p % w
      for (const o of off) {
        const n = p + o
        if (n < 0 || n >= label.length || label[n]) continue
        if ((o === -1 && x === 0) || (o === 1 && x === w - 1)) continue
        label[n] = label[p]
        queues[Math.max(lvl, elev[n])].push(n)
      }
    }
  }
  return label
}

/**
 * Otsu threshold of an 8-bit image after clipping at its 99th percentile: a few very strong outliers
 * (dust, pits, inclusions) otherwise pull the threshold above the faint grain boundaries.
 */
function clippedOtsu(cv, img) {
  const d = img.data
  const hist = new Uint32Array(256)
  for (let p = 0; p < d.length; p += 1) hist[d[p]] += 1
  let acc = 0
  let p99 = 255
  for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= 0.99 * d.length) { p99 = v; break } }
  if (p99 < 255) { for (let v = p99 + 1; v < 256; v += 1) { hist[p99] += hist[v]; hist[v] = 0 } }
  let sum = 0
  for (let v = 0; v < 256; v += 1) sum += v * hist[v]
  let sumB = 0
  let wB = 0
  let bestT = 0
  let bestVar = -1
  for (let t = 0; t < 256; t += 1) {
    wB += hist[t]
    if (!wB) continue
    const wF = d.length - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > bestVar) { bestVar = between; bestT = t }
  }
  return bestT
}

/**
 * Contrast-etched specimens (tinted / colour etch, E112 Plate III style) separate grains by shade more than
 * by a dark line. Adds the shade gradient to the flooding elevation and one seed for every flat, uniform
 * interior that holds no seed yet. Used only when the lab selects contrast etch: on line-etched images
 * shade noise inside grains would split them.
 */
function addContrastCue(cv, gray, elev, seeds, width) {
  const sm = new cv.Mat()
  const gx = new cv.Mat()
  const gy = new cv.Mat()
  const mag = new cv.Mat()
  const g8 = new cv.Mat()
  const flat = new cv.Mat()
  const labels = new cv.Mat()
  const stats = new cv.Mat()
  const centroids = new cv.Mat()
  try {
    cv.GaussianBlur(gray, sm, new cv.Size(0, 0), 1.5)
    cv.Sobel(sm, gx, cv.CV_32F, 1, 0)
    cv.Sobel(sm, gy, cv.CV_32F, 0, 1)
    cv.magnitude(gx, gy, mag)
    const m = mag.data32F
    const sorted = Float32Array.from(m).sort()
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 1
    g8.create(gray.rows, gray.cols, cv.CV_8U)
    const g = g8.data
    for (let p = 0; p < m.length; p += 1) g[p] = Math.min(255, (m[p] / p99) * 255)
    // flat interiors: low gradient, eroded a little so neighbouring grains do not touch
    cv.threshold(g8, flat, GRAIN_SEG.flatFrac * clippedOtsu(cv, g8), 255, cv.THRESH_BINARY_INV)
    const k = cv.Mat.ones(3, 3, cv.CV_8U)
    cv.erode(flat, flat, k, new cv.Point(-1, -1), 2)
    k.delete()
    const n = cv.connectedComponentsWithStats(flat, labels, stats, centroids, 8)
    const lab = labels.data32S
    const has = new Uint8Array(n)
    for (const p of seeds) has[lab[p]] = 1
    const minArea = GRAIN_SEG.flatMinPx
    const pick = new Int32Array(n).fill(-1)
    for (let p = 0; p < lab.length; p += 1) {
      const c = lab[p]
      if (c && !has[c] && pick[c] < 0 && stats.intAt(c, cv.CC_STAT_AREA) >= minArea) {
        // a pixel near the component centre
        const cx = Math.round(centroids.doubleAt(c, 0))
        const cy = Math.round(centroids.doubleAt(c, 1))
        const q = cy * gray.cols + cx
        pick[c] = lab[q] === c ? q : p
      }
    }
    const extra = []
    for (let c = 1; c < n; c += 1) if (pick[c] >= 0) extra.push(pick[c])
    const added = extra.length
    if (added) {
      seeds.push(...extra)
      const e = elev.data
      for (let p = 0; p < e.length; p += 1) if (g[p] > e[p]) e[p] = g[p]
    }
    return added
  } finally {
    for (const mm of [sm, gx, gy, mag, g8, flat, labels, stats, centroids]) mm.delete()
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

// Grain segmentation constants (working resolution: a typical grain spans ~40 px).
// Tuned on ASTM E112 Plates I-B and IV (docs/CHART_CALIBRATION.md).
const GRAIN_SEG = {
  seedRatio: 0.7, // a distance peak is its own grain when the saddle to a higher peak is < 70 % of its height
  seedMinR: 1.5, // px; and ≥ 0.25 × boundary width
  seedWidthR: 0.25,
  minPiecePx: 16, // boundary-mask pieces smaller than this are specks
  keepPiecePx: 64, // pieces 16–64 px stay only if they enclose a grain (needles do not)
  flatFrac: 0.5, // flat = shade gradient below this × its (clipped) Otsu level
  flatMinPx: 150, // smallest flat interior that gets its own seed
}

/** Pixels enclosed by component `i` inside its bounding box (holes). */
function enclosedArea(lab, W0, i, left, top, bw, bh, area) {
  const fw = bw + 2
  const fh = bh + 2
  const seen = new Uint8Array(fw * fh)
  const member = (x, y) => x >= 1 && y >= 1 && x <= bw && y <= bh && lab[(top + y - 1) * W0 + left + x - 1] === i
  const stack = [0]
  seen[0] = 1
  let reached = 0
  while (stack.length) {
    const q = stack.pop()
    reached += 1
    const x = q % fw
    const y = (q - x) / fw
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue
      const k = ny * fw + nx
      if (seen[k] || member(nx, ny)) continue
      seen[k] = 1
      stack.push(k)
    }
  }
  return fw * fh - reached - area
}

/**
 * Grain boundaries as a closed 1-px network (marker-controlled watershed).
 * - Polarity: boundaries are the THIN connected phase (dark lines on ferrite, or light lines on
 *   McQuaid-Ehn / oxidised austenite) — decided by line thickness, not by area.
 * - A top-hat sized to the measured boundary width keeps boundaries and drops uneven illumination.
 * - Specks and needles are dropped from the boundary mask; one seed per grain interior (distance peaks),
 *   then the smoothed image is flooded from the seeds. Every boundary is closed: etch gaps do not merge
 *   grains, and texture inside a grain (martensite needles, carbides) does not add boundaries.
 */
function grainBoundaries(cv, gray, contrastEtch = false) {
  const darkM = new cv.Mat()
  const brightM = new cv.Mat()
  const work = new cv.Mat()
  const tophat = new cv.Mat()
  const mask = new cv.Mat()
  const closeK = cv.Mat.ones(3, 3, cv.CV_8U)
  const labels = new cv.Mat()
  const stats = new cv.Mat()
  const centroids = new cv.Mat()
  const interior = new cv.Mat()
  const dt = new cv.Mat()
  const elev = new cv.Mat()
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
    cv.threshold(tophat, mask, clippedOtsu(cv, tophat), 255, cv.THRESH_BINARY)
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, closeK, new cv.Point(-1, -1), 1)

    const w = gray.cols
    const h = gray.rows
    const n = cv.connectedComponentsWithStats(mask, labels, stats, centroids, 8)
    const big = 0.2 * Math.min(w, h)
    const holeMin = Math.max(16, (2 * width) ** 2)
    const lab = labels.data32S
    const keep = new Uint8Array(n)
    for (let i = 1; i < n; i += 1) {
      const bw = stats.intAt(i, cv.CC_STAT_WIDTH)
      const bh = stats.intAt(i, cv.CC_STAT_HEIGHT)
      const side = Math.max(bw, bh)
      if (side < Math.min(big, GRAIN_SEG.minPiecePx)) continue
      if (side >= Math.min(big, GRAIN_SEG.keepPiecePx)) { keep[i] = 1; continue }
      const left = stats.intAt(i, cv.CC_STAT_LEFT)
      const top = stats.intAt(i, cv.CC_STAT_TOP)
      keep[i] = enclosedArea(lab, w, i, left, top, bw, bh, stats.intAt(i, cv.CC_STAT_AREA)) >= holeMin ? 1 : 0
    }
    const m = mask.data
    for (let p = 0; p < lab.length; p += 1) m[p] = keep[lab[p]] ? 255 : 0

    cv.bitwise_not(mask, interior)
    cv.distanceTransform(interior, dt, cv.DIST_L2, 3)
    const seeds = grainSeeds(dt.data32F, w, h, GRAIN_SEG.seedRatio, Math.max(GRAIN_SEG.seedMinR, width * GRAIN_SEG.seedWidthR))
    cv.GaussianBlur(work, elev, new cv.Size(0, 0), Math.max(1, width / 2))
    if (contrastEtch) addContrastCue(cv, gray, elev, seeds, width)
    const region = floodFromSeeds(elev.data, w, h, seeds)
    const skeleton = cv.Mat.zeros(h, w, cv.CV_8U)
    const sd = skeleton.data
    for (let y = 0; y < h - 1; y += 1) {
      for (let x = 0; x < w - 1; x += 1) {
        const p = y * w + x
        if (region[p] !== region[p + 1] || region[p] !== region[p + w]) sd[p] = 255
      }
    }
    return { skeleton, lightBoundaries, boundaryWidthPx: width, seeds: seeds.length }
  } finally {
    for (const mm of [darkM, brightM, work, tophat, mask, closeK, labels, stats, centroids, interior, dt, elev]) mm.delete()

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
function measureGrains(cv, gray, um, contrastEtch) {
  const { skeleton, lightBoundaries, boundaryWidthPx } = grainBoundaries(cv, gray, contrastEtch)
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

export function analyzeGrainSize(cv, imageBgr, umPerPxX = 1, umPerPxY = 1, options = {}) {
  // etch: 'line' (boundaries etched as lines, E112 Plates I/II/IV — default) or 'contrast' (grains told
  // apart by shade / tint, E112 Plate III)
  const contrastEtch = options.etch === 'contrast'
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
    m = measureGrains(cv, work, um0 / scale, contrastEtch)
    let passes = 1
    // contrast etch: no adaptive rescaling (the shade cue works at native resolution and a poor first pass
    // would otherwise shrink the image further)
    while (!contrastEtch && m.interceptPx > GRAIN_TARGET_INTERCEPT_PX * 1.2 && passes < 4) {
      const next = scale * (GRAIN_TARGET_INTERCEPT_PX / m.interceptPx)
      const nw = Math.round(W * next)
      const nh = Math.round(H * next)
      if (Math.min(nw, nh) < 200) break
      scale = next
      cv.resize(gray, work, new cv.Size(nw, nh), 0, 0, cv.INTER_AREA)
      m.skeleton.delete()
      m = measureGrains(cv, work, um0 / scale, contrastEtch)
      passes += 1
    }
    // very fine grains: work above native resolution so each grain interior still holds a seed
    const maxUp = 2
    if (!contrastEtch && m.interceptPx < GRAIN_TARGET_INTERCEPT_PX / 1.6 && scale < maxUp) {
      const next = Math.min(maxUp, scale * (GRAIN_TARGET_INTERCEPT_PX / 1.6 / m.interceptPx))
      if (next > scale * 1.15) {
        scale = next
        cv.resize(gray, work, new cv.Size(Math.round(W * scale), Math.round(H * scale)), 0, 0, cv.INTER_CUBIC)
        m.skeleton.delete()
        m = measureGrains(cv, work, um0 / scale, contrastEtch)
      }
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
    if (m.areas.filter((v) => v >= Math.max(30, (2.5 * m.boundaryWidthPx) ** 2)).length >= 30) {
      // slivers along boundaries / triple points (only a few boundary widths across) are not grains:
      // left in, they lower the median and make ordinary grains look "coarse"
      const sliver = Math.max(30, (2.5 * m.boundaryWidthPx) ** 2)
      const sorted = [...m.areas].filter((v) => v >= sliver).sort((a, b) => a - b)
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
      method: 'Heyn lineal intercept (primary) + Jeffries planimetric, watershed boundaries',
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
      etch_mode: contrastEtch ? 'contrast (tint) etch' : 'line etch',
      etch_mode_note: contrastEtch ? 'Contrast-etch mode (beta): twin bands that differ in shade are counted as grains — check the overlay.' : null,
      // fewer than ~8 px per mean intercept at the image's own resolution: boundaries are not resolved
      resolution_warning:
        meanUm > 0 && meanUm / um0 < 8
          ? `Grains are only ~${round(meanUm / um0, 1)} px across: G is unreliable — capture at a higher magnification (aim for ≥ 15 px per grain).`
          : null,
      working_scale: round(scale, 3),
      um_per_px_x: umPerPxX,
      um_per_px_y: umPerPxY,
      image_width_px: W,
      image_height_px: H,
      notes:
        'Heyn intercept is primary (calibrated on ASTM E112 plates). Boundaries are closed by marker-controlled ' +
        'watershed, so etch gaps and texture inside grains are handled; twin boundaries are not separated from ' +
        'grain boundaries — check the green overlay. Duplex flagged when ≥ 10 % of grain area (≥ 3 grains) is ' +
        '≥ 3 G numbers coarser (ASTM E1181) — confirm on the overlay.',
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
    const dWidth = Math.max(...g.map((x) => x.p.deficitWidthUm))
    const elongated = g.filter((x) => x.p.aspect >= 3)
    let type
    if (g.length >= 3 && elongated.length < g.length / 2) type = 'B'
    else if (elongated.length) {
      // sulphides (A) are mid-grey, silicates (C) dark — from mean particle intensity vs the field
      const tone = g.reduce((s, x) => s + x.p.tone, 0) / g.length
      type = tone > 0.35 ? 'A' : 'C'
    } else type = null
    if (type) {
      const series = dWidth <= JK_THIN_MAX_WIDTH[type] ? 'thin' : 'heavy'
      totals[type][series] += span
      inclusions.push({ type, series, length_um: round(span, 1), width_um: round(width, 1), deficit_width_um: round(dWidth, 1), particles: g.length, members: g })
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
    // Blur-independent width: the intensity deficit (matrix − pixel) summed across a particle equals
    // width × full contrast whatever the optics / scan blur, so width = Σ deficit / (contrast × length).
    // Matrix level = median of the field; full contrast from the darkest particles (2nd percentile).
    const hist = new Float64Array(256)
    const gd = gray.data
    for (let p = 0; p < gd.length; p += 1) hist[gd[p]] += 1
    const pct = (q) => { let acc = 0; for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= q * gd.length) return v } return 255 }
    const matrixLevel = pct(0.5)
    const darkLevel = Math.min(pct(0.002), otsuT * 0.6)
    const contrast = Math.max(1, matrixLevel - darkLevel)
    const ring = new cv.Mat()
    const ringK = cv.Mat.ones(5, 5, cv.CV_8U)
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
      // deficit over the particle plus a 2-px halo (where blur moved part of its darkness)
      const pad = 3
      const rx = Math.max(0, r.x - pad)
      const ry = Math.max(0, r.y - pad)
      const rr = new cv.Rect(rx, ry, Math.min(W, r.x + r.width + pad) - rx, Math.min(H, r.y + r.height + pad) - ry)
      const mr = mask.roi(rr)
      cv.dilate(mr, ring, ringK)
      mr.delete()
      const rd = ring.data
      let deficit = 0
      for (let yy = 0; yy < rr.height; yy += 1) {
        for (let xx = 0; xx < rr.width; xx += 1) {
          if (!rd[yy * rr.width + xx]) continue
          const v = gd[(rr.y + yy) * W + rr.x + xx]
          if (v < matrixLevel) deficit += Math.min(contrast, matrixLevel - v)
        }
      }
      const deficitWidthUm = (deficit / contrast / Math.max(rw, 1)) * um
      particles.push({
        cx: rect.center.x * um,
        cy: rect.center.y * um,
        lengthUm,
        widthUm,
        aspect: lengthUm / Math.max(widthUm, 1e-6),
        angle,
        tone: Math.max(0, Math.min(1, (meanIn - 0) / Math.max(otsuT, 1))), // 0 = black, 1 = at threshold
        deficitWidthUm,
        rect,
      })
    })
    mask.delete()
    ring.delete()
    ringK.delete()

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
// Surface side → rotation that brings it to the left edge (and back for the overlay).
const TO_LEFT = { left: null, right: 'ROTATE_180', top: 'ROTATE_90_COUNTERCLOCKWISE', bottom: 'ROTATE_90_CLOCKWISE' }
const FROM_LEFT = { left: null, right: 'ROTATE_180', top: 'ROTATE_90_CLOCKWISE', bottom: 'ROTATE_90_COUNTERCLOCKWISE' }

/** Mean of each column of an 8-bit or float single-channel Mat → Float64Array (length = cols). */
function columnMeans(m) {
  const w = m.cols
  const h = m.rows
  const d = m.type() === 5 ? m.data32F : m.data
  const out = new Float64Array(w)
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) out[x] += d[y * w + x]
  for (let x = 0; x < w; x += 1) out[x] /= h
  return out
}

function smooth1d(a, r) {
  const out = new Float64Array(a.length)
  for (let i = 0; i < a.length; i += 1) {
    let s = 0
    let n = 0
    for (let k = Math.max(0, i - r); k <= Math.min(a.length - 1, i + r); k += 1) { s += a[k]; n += 1 }
    out[i] = s / n
  }
  return out
}

/**
 * Decarburization — ISO 3887 metallographic method.
 * 1. Free surface: the side where the image starts with a band clearly darker than the specimen (mounting
 *    resin / air); without one, the side whose outer zone is lightest (ferrite) is taken.
 * 2. Brightness profile inward from the surface (decarburized ferrite is light, the core darker: pearlite
 *    or martensite). Core level = median of the inner half of the profile.
 * 3. Complete decarburization: depth while the profile stays within 10 % of the surface-zone level (ferrite
 *    only). Total decarburization: depth where it first comes within 10 % of the core level.
 * The surface must run roughly parallel to an image edge.
 */
export function analyzeDecarb(cv, imageBgr, umPerPxX = 1, umPerPxY = 1) {
  const gray = new cv.Mat()
  const blur = new cv.Mat()
  const rg = new cv.Mat()
  let overlay = null
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    cv.GaussianBlur(gray, blur, new cv.Size(0, 0), 1.5)
    const bd = blur.data
    const sortedI = Uint8Array.from(bd).sort()
    const medI = sortedI[Math.floor(sortedI.length / 2)]
    // pick the surface side: the mount (resin / air) is an edge band clearly darker than the specimen
    const sides = []
    for (const side of ['left', 'right', 'top', 'bottom']) {
      const rot = TO_LEFT[side]
      if (rot) cv.rotate(blur, rg, cv[rot])
      else blur.copyTo(rg)
      const ip = smooth1d(columnMeans(rg), 2)
      // darkest point of the outer 15 % (image borders / frame lines can make the first columns brighter)
      const band = Math.max(3, Math.round(ip.length * 0.15))
      let dark = 0
      for (let i = 1; i < band; i += 1) if (ip[i] < ip[dark]) dark = i
      const outerI = ip[dark]
      const mount = outerI < 0.5 * medI
      // surface = first column after it that is brighter than halfway between the mount and the specimen
      let surface = 0
      if (mount) { surface = dark; while (surface < ip.length - 1 && ip[surface] < (outerI + medI) / 2) surface += 1 }
      let edgeI = 0
      const n = Math.max(3, Math.round(ip.length * 0.1))
      for (let i = surface; i < Math.min(ip.length, surface + n); i += 1) edgeI += ip[i] / n
      sides.push({ side, mount, outerI, edgeI, surface, profile: ip, len: ip.length })
    }
    // a mount side first (darkest), otherwise the side whose outer zone is lightest (ferrite)
    sides.sort((a, b) => (a.mount === b.mount ? (a.mount ? a.outerI - b.outerI : b.edgeI - a.edgeI) : a.mount ? -1 : 1))
    const S = sides[0]
    const um = S.side === 'left' || S.side === 'right' ? umPerPxX : umPerPxY
    const prof = smooth1d(S.profile, Math.max(2, Math.round(S.len * 0.01)))
    const inner = Array.from(prof.slice(S.surface + Math.floor((S.len - S.surface) / 2))).sort((a, b) => a - b)
    const core = inner[Math.floor(inner.length / 2)]
    const zoneN = Math.max(3, Math.round((S.len - S.surface) * 0.05))
    let surfLevel = -Infinity
    for (let i = S.surface; i < Math.min(S.len, S.surface + zoneN * 2); i += 1) surfLevel = Math.max(surfLevel, prof[i])
    const span = surfLevel - core
    let completePx = 0
    let totalPx = 0
    const measurable = span > 8 // grey levels: a lighter surface zone exists
    if (measurable) {
      let i = S.surface
      while (i < S.len && prof[i] < surfLevel - 0.1 * span) i += 1 // step over the surface edge itself
      let j = i
      while (j < S.len && prof[j] >= surfLevel - 0.1 * span) j += 1
      completePx = Math.max(0, j - S.surface)
      while (j < S.len && prof[j] > core + 0.1 * span) j += 1
      totalPx = Math.max(completePx, j - S.surface)
    }
    const completeUm = completePx * um
    const totalUm = totalPx * um

    // overlay drawn in the surface-left frame, then rotated back
    const rot = TO_LEFT[S.side]
    overlay = new cv.Mat()
    if (rot) cv.rotate(imageBgr, overlay, cv[rot])
    else imageBgr.copyTo(overlay)
    const H = overlay.rows
    const line = (x, c) => cv.line(overlay, new cv.Point(x, 0), new cv.Point(x, H - 1), c, 2)
    line(S.surface, color(cv, 0, 255, 0))
    if (measurable) {
      line(S.surface + completePx, color(cv, 0, 200, 255))
      line(S.surface + totalPx, color(cv, 0, 0, 255))
    }
    const back = FROM_LEFT[S.side]
    if (back) { const tmp = new cv.Mat(); cv.rotate(overlay, tmp, cv[back]); overlay.delete(); overlay = tmp }
    cv.putText(overlay, measurable ? `Decarb total ${totalUm.toFixed(1)} um, complete ${completeUm.toFixed(1)} um` : 'No decarburized layer found', new cv.Point(10, 24), cv.FONT_HERSHEY_SIMPLEX, 0.7, color(cv, 0, 0, 255), 2)

    const result = {
      standard: 'ISO 3887:2017',
      method: 'metallographic profile from the free surface',
      decarb_depth_um: round(totalUm, 2),
      decarb_depth_mm: round(totalUm / 1000, 5),
      total_decarb_depth_um: round(totalUm, 2),
      complete_decarb_depth_um: round(completeUm, 2),
      surface_side: S.side,
      surface_found_by: S.mount ? 'mounting / background band' : 'lightest edge (no mount visible)',
      decarb_detected: measurable,
      notes:
        'Green = free surface, yellow = end of complete decarburization (ferrite only), red = total decarburization ' +
        '(structure back to core). The surface must run roughly parallel to an image edge; etch (nital) and ' +
        'image the edge so the mount is visible.',
    }
    return { result, overlay }
  } catch (err) {
    if (overlay) overlay.delete()
    throw err
  } finally {
    for (const m of [gray, blur, rg]) m.delete()
  }
}

// ---------------------------------------------------------------------------
// Micro — phase area fractions
// ---------------------------------------------------------------------------
// Light-class / dark-class local texture above this → the light class is not smooth ferrite. Real ferrite–
// pearlite micrographs gave 0.16 and 0.42; fully pearlitic / tinted low-magnification fields 0.80–0.89.
const MICRO_FERRITE_TEXTURE_RATIO = 0.6
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

    // Is the light phase ferrite? Ferrite grains are smooth; when the light class is about as textured as
    // the dark one, the field is fully pearlitic / tinted and the two classes are two shades of one phase.
    const g32 = new cv.Mat()
    const m = new cv.Mat()
    const m2 = new cv.Mat()
    gray.convertTo(g32, cv.CV_32F)
    cv.blur(g32, m, new cv.Size(7, 7))
    cv.multiply(g32, g32, m2)
    cv.blur(m2, m2, new cv.Size(7, 7))
    const md = m.data32F
    const m2d = m2.data32F
    const bd = binary.data
    const sdLight = []
    const sdDark = []
    for (let p = 0; p < bd.length; p += 7) {
      const sd = Math.sqrt(Math.max(0, m2d[p] - md[p] * md[p]))
      ;(bd[p] ? sdLight : sdDark).push(sd)
    }
    for (const mm of [g32, m, m2]) mm.delete()
    const median = (a) => (a.length ? a.sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0)
    const textureRatio = median(sdDark) > 0 ? median(sdLight) / median(sdDark) : 1
    const lightIsFerrite = textureRatio < MICRO_FERRITE_TEXTURE_RATIO

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
      light_phase_texture_ratio: round(textureRatio, 2),
      light_phase_is_ferrite: lightIsFerrite,
      warning: lightIsFerrite
        ? null
        : 'The light phase is as textured as the dark one: probably fully pearlitic, tinted or low magnification. ' +
          'Phase fractions do not mean ferrite / pearlite here — no carbon estimate.',
      notes:
        'Two-phase split (Otsu). For ferrite–pearlite steels image a nital-etched section at 100–500× so ferrite ' +
        'grains are smooth and pearlite is dark.',
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
function graphiteParticles(cv, gray, um, closePx = 0) {
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
    if (closePx > 1) {
      // flakes: rejoin a thin flake broken at faint spots (does not merge separate flakes much at this size)
      const kc = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(closePx, closePx))
      cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, kc)
      kc.delete()
    }
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
    const found = graphiteParticles(cv, gray, um, 5)
    particles = found.particles
    const flakes = particles.filter((p) => p.feretUm >= 5)
    const lengths = flakes.map((p) => p.feretUm).sort((a, b) => b - a)
    const top = lengths.slice(0, Math.min(5, lengths.length))
    const longest = top.length ? top.reduce((s, v) => s + v, 0) / top.length : 0
    const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0
    // A247 rates size by the longest flakes: mean of the 5 longest. (The 95th percentile matched the drawn
    // chart's crowded classes 7–8 better but rated real grey-iron fields 1–2 classes too fine, because long
    // thin flakes leave many short fragments.)
    const p95 = lengths.length ? lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * 0.05))] : 0
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
      flake_size_class_note: cutByEdge
        ? `class ${sizeClass} or coarser: the longest flakes run off the field — rate classes 1–2 at a lower magnification (50×) or on a wider field`
        : null,
      flake_length_p95_um: round(p95, 1),
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
