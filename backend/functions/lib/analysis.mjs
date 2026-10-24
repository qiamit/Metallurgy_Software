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
// Grain size — ISO 643
// ---------------------------------------------------------------------------
function gFromMeanIntercept(meanInterceptMm) {
  if (meanInterceptMm <= 0) return 0
  return -6.6457 * Math.log10(meanInterceptMm) - 3.298
}

export function analyzeGrainSize(cv, imageBgr, umPerPxX = 1, umPerPxY = 1, method = 'intercept') {
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const enhanced = new cv.Mat()
  const edges = new cv.Mat()
  const boundaries = new cv.Mat()
  const closed = new cv.Mat()
  const inv = new cv.Mat()
  const labels = new cv.Mat()
  const kernel = ones3(cv)
  const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8))
  const overlay = imageBgr.clone()
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
    clahe.apply(blurred, enhanced)
    cv.Canny(enhanced, edges, 40, 120)
    cv.dilate(edges, boundaries, kernel, new cv.Point(-1, -1), 1)

    const h = gray.rows
    const w = gray.cols
    const b = boundaries.data
    const umPerPx = (umPerPxX + umPerPxY) / 2
    const intercepts = []

    for (const y of linspaceInt(h * 0.15, h * 0.85, 7)) {
      const crossings = []
      for (let x = 0; x < w - 1; x += 1) {
        if (b[y * w + x + 1] > 0 && b[y * w + x] === 0) crossings.push(x)
      }
      cv.line(overlay, new cv.Point(0, y), new cv.Point(w - 1, y), color(cv, 0, 200, 255), 1)
      if (crossings.length >= 2) {
        for (let i = 0; i < crossings.length - 1; i += 1) {
          intercepts.push((crossings[i + 1] - crossings[i]) * umPerPx)
          cv.circle(overlay, new cv.Point(crossings[i], y), 2, color(cv, 0, 255, 0), -1)
        }
      }
    }

    for (const x of linspaceInt(w * 0.15, w * 0.85, 7)) {
      const crossings = []
      for (let y = 0; y < h - 1; y += 1) {
        if (b[(y + 1) * w + x] > 0 && b[y * w + x] === 0) crossings.push(y)
      }
      cv.line(overlay, new cv.Point(x, 0), new cv.Point(x, h - 1), color(cv, 255, 180, 0), 1)
      if (crossings.length >= 2) {
        for (let i = 0; i < crossings.length - 1; i += 1) {
          intercepts.push((crossings[i + 1] - crossings[i]) * umPerPx)
          cv.circle(overlay, new cv.Point(x, crossings[i]), 2, color(cv, 0, 255, 0), -1)
        }
      }
    }

    const meanUm = intercepts.length ? intercepts.reduce((s, v) => s + v, 0) / intercepts.length : 0
    const meanMm = meanUm / 1000
    const gValue = meanMm > 0 ? gFromMeanIntercept(meanMm) : 0

    // Planimetric grain count estimate via connected components on inverted boundaries
    cv.morphologyEx(boundaries, closed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 2)
    cv.bitwise_not(closed, inv)
    const numLabels = cv.connectedComponents(inv, labels)
    const grainCount = Math.max(numLabels - 1, 0)
    const areaMm2 = ((w * umPerPxX) / 1000) * ((h * umPerPxY) / 1000)
    const na = areaMm2 > 0 ? grainCount / areaMm2 : 0
    const gPlanimetric = na > 0 ? Math.log2(na) + 1 : 0

    const result = {
      standard: 'ISO 643:2019',
      method,
      mean_intercept_um: round(meanUm, 3),
      mean_intercept_mm: round(meanMm, 6),
      grain_size_number_G: round(gValue, 2),
      grain_count_estimate: grainCount,
      na_per_mm2: round(na, 3),
      grain_size_number_G_planimetric: round(gPlanimetric, 2),
      intercept_count: intercepts.length,
      um_per_px_x: umPerPxX,
      um_per_px_y: umPerPxY,
      image_width_px: w,
      image_height_px: h,
      notes: 'Deterministic CV estimate. Validate on etched specimens with reviewer.',
    }
    return { result, overlay }
  } finally {
    for (const m of [gray, blurred, enhanced, edges, boundaries, closed, inv, labels, kernel]) m.delete()
    clahe.delete()
  }
}

// ---------------------------------------------------------------------------
// Inclusion — ISO 4967
// ---------------------------------------------------------------------------
const INCLUSION_COLORS = {
  A: [0, 0, 255],
  B: [0, 165, 255],
  C: [0, 255, 255],
  D: [0, 255, 0],
  DS: [255, 0, 255],
}

export function analyzeInclusion(cv, imageBgr, umPerPxX = 1, umPerPxY = 1) {
  const gray = new cv.Mat()
  const blur = new cv.Mat()
  const thresh = new cv.Mat()
  const clean = new cv.Mat()
  const kernel = ones3(cv)
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const overlay = imageBgr.clone()
  try {
    cv.cvtColor(imageBgr, gray, cv.COLOR_BGR2GRAY)
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
    cv.threshold(blur, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)
    cv.morphologyEx(thresh, clean, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 1)
    cv.findContours(clean, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const umPerPx = (umPerPxX + umPerPxY) / 2
    const particles = []
    const typeCounts = { A: 0, B: 0, C: 0, D: 0, DS: 0 }

    eachContour(cv, contours, (cnt) => {
      const area = cv.contourArea(cnt)
      if (area < 8) return
      const { x, y, width: w, height: h } = cv.boundingRect(cnt)
      const lengthUm = Math.max(w, h) * umPerPx
      const widthUm = Math.min(w, h) * umPerPx
      const aspect = lengthUm / Math.max(widthUm, 1e-6)
      let itype
      if (aspect > 5 && lengthUm > 20) itype = 'A'
      else if (aspect > 3) itype = 'B'
      else if (aspect > 2) itype = 'C'
      else if (lengthUm > 50) itype = 'DS'
      else itype = 'D'
      typeCounts[itype] += 1
      const severity = Math.min(5, Math.floor(lengthUm / 25) + 1)
      particles.push({
        type: itype,
        length_um: round(lengthUm, 2),
        width_um: round(widthUm, 2),
        area_px: area,
        severity_index: severity,
      })
      const c = color(cv, ...INCLUSION_COLORS[itype])
      cv.rectangle(overlay, new cv.Point(x, y), new cv.Point(x + w, y + h), c, 1)
      cv.putText(overlay, itype, new cv.Point(x, Math.max(12, y - 2)), cv.FONT_HERSHEY_SIMPLEX, 0.4, c, 1)
    })

    const worst = particles.reduce((m, p) => Math.max(m, p.severity_index), 0)
    const result = {
      standard: 'ISO 4967:1998',
      inclusion_count: particles.length,
      type_counts: typeCounts,
      worst_severity_index: worst,
      particles: particles.slice(0, 200),
      notes: 'Heuristic classification vs chart types A/B/C/D/DS. Reviewer confirmation required.',
    }
    return { result, overlay }
  } finally {
    for (const m of [gray, blur, thresh, clean, kernel, hierarchy]) m.delete()
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

export const ANALYZERS = {
  grain_size: analyzeGrainSize,
  inclusion: analyzeInclusion,
  decarb: analyzeDecarb,
  micro: analyzeMicro,
  macro: analyzeMacro,
}
