// JK inclusion rating (ISO 4967:2013 Method A / ASTM E45 Method A) on synthetic 0.50 mm² fields.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCv, analyzeInclusion, jkSeverity, JK_LIMITS } from '../lib/analysis.mjs'

const UM_PER_PX = 1 // 710 px field = 0.71 mm × 0.71 mm

function field(cv, draw) {
  const img = new cv.Mat(710, 710, cv.CV_8UC3, new cv.Scalar(225, 225, 225, 255))
  draw(img)
  return img
}
const black = (cv) => new cv.Scalar(25, 25, 25, 255)

test('severity limits follow the minimum values of ISO 4967 / E45 Plate I-r', () => {
  assert.equal(jkSeverity('A', 36), 0)
  assert.equal(jkSeverity('A', 37), 0.5)
  assert.equal(jkSeverity('A', 436), 2)
  assert.equal(jkSeverity('B', 900), 3)
  assert.equal(jkSeverity('D', 9), 1.5)
  assert.equal(jkSeverity('DS', 20), 1)
  assert.deepEqual(JK_LIMITS.C, [18, 76, 176, 320, 510, 746])
})

test('dark elongated stringers total ~436 µm rate C 2, heavy series for 7 µm width', async () => {
  const { cv } = await loadCv()
  const img = field(cv, (m) => {
    for (const [x, y0, len] of [[150, 100, 150], [350, 200, 146], [550, 300, 140]]) {
      cv.rectangle(m, new cv.Point(x, y0), new cv.Point(x + 6, y0 + len), black(cv), -1)
    }
  })
  const { result, overlay } = analyzeInclusion(cv, img, UM_PER_PX, UM_PER_PX)
  img.delete(); overlay.delete()
  assert.equal(result.jk_rating.C.heavy, 2, result.jk_summary)
  assert.equal(result.jk_rating.C.thin, 0, result.jk_summary)
  assert.ok(Math.abs(result.rolling_direction_deg) > 80, `rolling direction ${result.rolling_direction_deg}`)
})

test('aligned globular particles form a B stringer; scattered ones count as D', async () => {
  const { cv } = await loadCv()
  const img = field(cv, (m) => {
    // B: 12 particles, 5 µm, 25 µm pitch along the same column -> one stringer of ~280 µm
    for (let i = 0; i < 12; i += 1) cv.circle(m, new cv.Point(200, 150 + i * 25), 3, black(cv), -1)
    // a short elongated hint so the rolling direction is vertical
    cv.rectangle(m, new cv.Point(600, 80), new cv.Point(603, 140), black(cv), -1)
    // D: 9 scattered globules, 6 µm, far apart
    const pts = [[400, 120], [520, 260], [450, 420], [620, 560], [330, 620], [560, 650], [420, 300], [640, 380], [300, 500]]
    for (const [x, y] of pts) cv.circle(m, new cv.Point(x, y), 3, black(cv), -1)
  })
  const { result, overlay } = analyzeInclusion(cv, img, UM_PER_PX, UM_PER_PX)
  img.delete(); overlay.delete()
  assert.equal(result.jk_rating.B.thin, 1.5, result.jk_summary) // 184 ≤ ~280 < 343
  assert.equal(result.jk_rating.D.thin, 1.5, result.jk_summary) // 9 particles
})

test('a single large globule is DS', async () => {
  const { cv } = await loadCv()
  const img = field(cv, (m) => cv.circle(m, new cv.Point(355, 355), 15, black(cv), -1)) // ~30 µm
  const { result, overlay } = analyzeInclusion(cv, img, UM_PER_PX, UM_PER_PX)
  img.delete(); overlay.delete()
  assert.equal(result.ds_rating, 1.5, result.jk_summary) // 27 ≤ 30 < 38
})

test('thin/heavy series uses a blur-independent width: a blurred 3 µm sulphide stays thin', async () => {
  const { cv } = await loadCv()
  const grey = new cv.Scalar(90, 90, 90, 255) // sulphide tone (mid-grey)
  const make = (wPx) => {
    const img = field(cv, (m) => {
      for (const [x, y0] of [[200, 100], [400, 200]]) cv.rectangle(m, new cv.Point(x, y0), new cv.Point(x + wPx - 1, y0 + 199), grey, -1)
      cv.circle(m, new cv.Point(600, 600), 12, black(cv), -1) // a dark reference particle (full contrast)
    })
    const blurred = new cv.Mat()
    cv.GaussianBlur(img, blurred, new cv.Size(0, 0), 1.5) // optics / focus blur widens the thresholded line
    img.delete()
    return blurred
  }
  const thin = make(3)
  const r1 = analyzeInclusion(cv, thin, UM_PER_PX, UM_PER_PX)
  thin.delete(); r1.overlay.delete()
  const a1 = r1.result.inclusions.filter((i) => i.type === 'A' || i.type === 'C')
  assert.ok(a1.length >= 2, r1.result.jk_summary)
  assert.ok(a1.every((i) => i.series === 'thin'), JSON.stringify(a1))
  const heavy = make(9)
  const r2 = analyzeInclusion(cv, heavy, UM_PER_PX, UM_PER_PX)
  heavy.delete(); r2.overlay.delete()
  const a2 = r2.result.inclusions.filter((i) => i.type === 'A' || i.type === 'C')
  assert.ok(a2.length >= 2 && a2.every((i) => i.series === 'heavy'), JSON.stringify(a2))
})
