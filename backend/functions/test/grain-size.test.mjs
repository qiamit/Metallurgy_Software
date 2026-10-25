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
