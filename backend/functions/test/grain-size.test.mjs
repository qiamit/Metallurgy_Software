// Grain size on synthetic hexagonal grains, where G is known exactly:
// N_A = 1 / hexagon area  ->  G = 3.321928·log10(N_A) − 2.954 (ASTM E112-13).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCv, analyzeGrainSize, gFromGrainsPerMm2, gFromIntercept } from '../lib/analysis.mjs'

function hexGrains(cv, size, side, lineWidth, { lightBoundaries = false } = {}) {
  const bg = lightBoundaries ? 40 : 235
  const fg = lightBoundaries ? 235 : 40
  const img = new cv.Mat(size, size, cv.CV_8UC3, new cv.Scalar(bg, bg, bg, 255))
  const ink = new cv.Scalar(fg, fg, fg, 255)
  const w = Math.sqrt(3) * side // pointy-top hexagon width
  for (let row = -1; row * 1.5 * side < size + side; row += 1) {
    for (let col = -1; col * w < size + w; col += 1) {
      const cx = col * w + (row % 2 ? w / 2 : 0)
      const cy = row * 1.5 * side
      for (let k = 0; k < 6; k += 1) {
        const a1 = ((60 * k - 30) * Math.PI) / 180
        const a2 = ((60 * (k + 1) - 30) * Math.PI) / 180
        cv.line(
          img,
          new cv.Point(Math.round(cx + side * Math.cos(a1)), Math.round(cy + side * Math.sin(a1))),
          new cv.Point(Math.round(cx + side * Math.cos(a2)), Math.round(cy + side * Math.sin(a2))),
          ink,
          lineWidth,
        )
      }
    }
  }
  return img
}

const cases = [
  { side: 30, um: 1.0 },
  { side: 18, um: 1.0 },
  { side: 45, um: 2.5 },
]

for (const { side, um } of cases) {
  test(`hexagons side ${side}px @ ${um} µm/px: G within 0.4 of exact`, async () => {
    const { cv } = await loadCv()
    const img = hexGrains(cv, 960, side, 2)
    const hexAreaMm2 = ((3 * Math.sqrt(3)) / 2) * ((side * um) / 1000) ** 2
    const exact = gFromGrainsPerMm2(1 / hexAreaMm2)
    const { result, overlay } = analyzeGrainSize(cv, img, um, um)
    img.delete()
    overlay.delete()
    assert.ok(Math.abs(result.grain_size_number_G_planimetric - exact) < 0.4, `planimetric ${result.grain_size_number_G_planimetric} vs ${exact.toFixed(2)}`)
    assert.ok(Math.abs(result.grain_size_number_G - exact) < 0.4, `intercept ${result.grain_size_number_G} vs ${exact.toFixed(2)}`)
    assert.equal(result.boundary_polarity, 'dark boundaries on light grains')
    assert.equal(result.duplex_suspected, false)
  })
}

test('light boundaries on dark grains (McQuaid-Ehn style) are detected the same way', async () => {
  const { cv } = await loadCv()
  const img = hexGrains(cv, 960, 30, 3, { lightBoundaries: true })
  const exact = gFromGrainsPerMm2(1 / (((3 * Math.sqrt(3)) / 2) * (30 / 1000) ** 2))
  const { result, overlay } = analyzeGrainSize(cv, img, 1, 1)
  img.delete()
  overlay.delete()
  assert.equal(result.boundary_polarity, 'light boundaries on dark grains')
  assert.ok(Math.abs(result.grain_size_number_G_planimetric - exact) < 0.4, `${result.grain_size_number_G_planimetric} vs ${exact.toFixed(2)}`)
})

test('ASTM E112-13 relations', () => {
  // E112 Table 4: G = 0 ↔ ℓ = 0.320 mm and N_A ≈ 7.75 /mm²; G = 8 ↔ ℓ ≈ 0.0200 mm, N_A ≈ 1984 /mm²
  assert.ok(Math.abs(gFromIntercept(0.32) - 0) < 0.03)
  assert.ok(Math.abs(gFromIntercept(0.02) - 8) < 0.03)
  assert.ok(Math.abs(gFromGrainsPerMm2(7.75) - 0) < 0.03)
  assert.ok(Math.abs(gFromGrainsPerMm2(1984) - 8) < 0.03)
})

test('faint boundaries with a few black specks (dust, pits): G still within 0.4', async () => {
  const { cv } = await loadCv()
  const side = 30
  const img = new cv.Mat(960, 960, cv.CV_8UC3, new cv.Scalar(235, 235, 235, 255))
  const lines = hexGrains(cv, 960, side, 2)
  // boundaries only ~45 grey levels below the matrix
  const d = img.data
  const l = lines.data
  for (let p = 0; p < d.length; p += 1) if (l[p] < 128) d[p] = 190
  lines.delete()
  let seed = 11
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let i = 0; i < 60; i += 1) cv.circle(img, new cv.Point(Math.round(rnd() * 960), Math.round(rnd() * 960)), 3, new cv.Scalar(0, 0, 0, 255), -1)
  const exact = gFromGrainsPerMm2(1 / (((3 * Math.sqrt(3)) / 2) * (side / 1000) ** 2))
  const { result, overlay } = analyzeGrainSize(cv, img, 1, 1)
  img.delete()
  overlay.delete()
  assert.ok(Math.abs(result.grain_size_number_G - exact) < 0.4, `intercept ${result.grain_size_number_G} vs ${exact.toFixed(2)}`)
})

test('contrast (tint) etch: grains told apart by shade only are segmented with etch=contrast', async () => {
  const { cv } = await loadCv()
  const side = 40
  const size = 960
  const img = new cv.Mat(size, size, cv.CV_8UC3)
  const d = img.data
  const w = Math.sqrt(3) * side
  // nearest hexagon centre → shade per grain (no boundary lines at all)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const row = Math.round(y / (1.5 * side))
      let best = Infinity
      let id = 0
      for (let r = row - 1; r <= row + 1; r += 1) {
        const off = r % 2 ? w / 2 : 0
        const col = Math.round((x - off) / w)
        for (let c = col - 1; c <= col + 1; c += 1) {
          const dd = (x - (c * w + off)) ** 2 + (y - r * 1.5 * side) ** 2
          // axial-coordinate 3-colouring: neighbouring grains never share a shade
          if (dd < best) { best = dd; id = ((((c - (r - (r & 1)) / 2) - r) % 3) + 3) % 3 }
        }
      }
      const v = 90 + id * 60
      const p = (y * size + x) * 3
      d[p] = d[p + 1] = d[p + 2] = v
    }
  }
  const exact = gFromGrainsPerMm2(1 / (((3 * Math.sqrt(3)) / 2) * (side / 1000) ** 2))
  const { result, overlay } = analyzeGrainSize(cv, img, 1, 1, { etch: 'contrast' })
  img.delete()
  overlay.delete()
  assert.equal(result.etch_mode, 'contrast (tint) etch')
  assert.ok(Math.abs(result.grain_size_number_G_planimetric - exact) < 0.8, `planimetric ${result.grain_size_number_G_planimetric} vs ${exact.toFixed(2)}`)
})
