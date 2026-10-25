// Decarburization (ISO 3887 profile) and micro phase checks on synthetic sections with known geometry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCv, analyzeDecarb, analyzeMicro } from '../lib/analysis.mjs'

/** Mount (dark) | ferrite band (light) | core (mid-grey, textured), surface on the given side. */
function section(cv, side, mountPx, ferritePx, um = 1) {
  const W = 600
  const H = 400
  const img = new cv.Mat(H, W, cv.CV_8UC3, new cv.Scalar(0, 0, 0, 255))
  const d = img.data
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const depth = side === 'left' ? x : side === 'right' ? W - 1 - x : side === 'top' ? y : H - 1 - y
      let v
      if (depth < mountPx) v = 25 + rnd() * 10
      else if (depth < mountPx + ferritePx) v = 215 + rnd() * 10
      else v = 90 + rnd() * 50 // pearlite / martensite core
      const p = (y * W + x) * 3
      d[p] = d[p + 1] = d[p + 2] = v
    }
  }
  return img
}

for (const side of ['left', 'bottom']) {
  test(`decarb: finds the surface on the ${side} and a 120 µm ferrite layer`, async () => {
    const { cv } = await loadCv()
    const img = section(cv, side, 60, 120)
    const { result, overlay } = analyzeDecarb(cv, img, 1, 1)
    img.delete(); overlay.delete()
    assert.equal(result.surface_side, side)
    assert.equal(result.decarb_detected, true)
    assert.ok(Math.abs(result.complete_decarb_depth_um - 120) <= 12, `complete ${result.complete_decarb_depth_um}`)
    assert.ok(result.total_decarb_depth_um >= result.complete_decarb_depth_um)
  })
}

test('decarb: no light layer → not detected', async () => {
  const { cv } = await loadCv()
  const img = section(cv, 'left', 60, 0)
  const { result, overlay } = analyzeDecarb(cv, img, 1, 1)
  img.delete(); overlay.delete()
  assert.equal(result.decarb_detected, false)
})

test('micro: smooth light ferrite is recognised; two textured shades are not', async () => {
  const { cv } = await loadCv()
  const W = 400
  const H = 300
  let seed = 3
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const make = (lightTextured) => {
    const img = new cv.Mat(H, W, cv.CV_8UC3)
    const d = img.data
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const darkPatch = Math.floor(x / 50) % 4 === 0 && Math.floor(y / 50) % 2 === 0 // 12.5 % "pearlite"
        const lam = (x + y) % 4 < 2 ? 1 : -1 // lamellae
        const v = darkPatch ? 70 + 30 * lam : lightTextured ? 170 + 30 * lam : 200 + rnd() * 4
        const p = (y * W + x) * 3
        d[p] = d[p + 1] = d[p + 2] = v
      }
    }
    return img
  }
  const fp = make(false)
  const r1 = analyzeMicro(cv, fp, 1, 1)
  fp.delete(); r1.overlay.delete()
  assert.equal(r1.result.light_phase_is_ferrite, true, String(r1.result.light_phase_texture_ratio))
  assert.ok(Math.abs(r1.result.dark_phase_fraction - 0.125) < 0.03, String(r1.result.dark_phase_fraction))
  const pp = make(true)
  const r2 = analyzeMicro(cv, pp, 1, 1)
  pp.delete(); r2.overlay.delete()
  assert.equal(r2.result.light_phase_is_ferrite, false, String(r2.result.light_phase_texture_ratio))
})
