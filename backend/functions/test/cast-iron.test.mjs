// Nodularity (ISO 945-4 / E2567) and graphite flake size (A247) on synthetic fields of known geometry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCv, analyzeNodularity, analyzeGraphiteFlake, a247SizeClass } from '../lib/analysis.mjs'

const ink = (cv) => new cv.Scalar(30, 30, 30, 255)
function blank(cv, n = 800) {
  return new cv.Mat(n, n, cv.CV_8UC3, new cv.Scalar(225, 225, 225, 255))
}

test('A247 size classes', () => {
  assert.equal(a247SizeClass(1500), 1)
  assert.equal(a247SizeClass(200), 4) // 20 mm at 100× -> class 4 (16–32 mm)
  assert.equal(a247SizeClass(100), 5)
  assert.equal(a247SizeClass(30), 7)
  assert.equal(a247SizeClass(15), 8)
})

test('round nodules give ~100 % nodularity, correct count and size class', async () => {
  const { cv } = await loadCv()
  const img = blank(cv)
  let n = 0
  for (let y = 60; y < 760; y += 100) for (let x = 60; x < 760; x += 100) { cv.circle(img, new cv.Point(x, y), 20, ink(cv), -1); n += 1 }
  const um = 1 // 40 µm nodules
  const { result, overlay } = analyzeNodularity(cv, img, um, um)
  img.delete(); overlay.delete()
  assert.ok(result.nodularity_percent > 95, `nodularity ${result.nodularity_percent}`)
  const expectedPerMm2 = n / 0.64
  assert.ok(Math.abs(result.nodule_count_per_mm2 - expectedPerMm2) / expectedPerMm2 < 0.05, `count ${result.nodule_count_per_mm2}`)
  assert.equal(result.nodule_size_class_a247, 6) // ~41 µm -> 4.1 mm at 100× -> class 6 (4–8 mm)
})

test('half the graphite area as flakes gives ~50 % nodularity', async () => {
  const { cv } = await loadCv()
  const img = blank(cv)
  // 16 nodules r=20 (area ≈ 1257 each) and 16 flakes 160×8 (area 1280 each), well separated
  for (let i = 0; i < 16; i += 1) {
    cv.circle(img, new cv.Point(60 + (i % 4) * 90, 60 + Math.floor(i / 4) * 180), 20, ink(cv), -1)
    const x = 420 + (i % 4) * 90
    const y = 40 + Math.floor(i / 4) * 190
    cv.rectangle(img, new cv.Point(x, y), new cv.Point(x + 8, y + 160), ink(cv), -1)
  }
  const { result, overlay } = analyzeNodularity(cv, img, 1, 1)
  img.delete(); overlay.delete()
  assert.ok(Math.abs(result.nodularity_percent - 50) < 5, `nodularity ${result.nodularity_percent}`)
})

test('flake size class follows the longest flakes', async () => {
  const { cv } = await loadCv()
  const img = blank(cv)
  for (let i = 0; i < 12; i += 1) {
    const x = 40 + (i % 6) * 120
    const y = 60 + Math.floor(i / 6) * 380
    cv.line(img, new cv.Point(x, y), new cv.Point(x + 60, y + 280), ink(cv), 4) // ~286 µm long
  }
  const { result, overlay } = analyzeGraphiteFlake(cv, img, 1, 1)
  img.delete(); overlay.delete()
  assert.equal(result.flake_size_class, 4, `longest ${result.longest_flakes_mean_um}`) // 28.6 mm at 100× -> class 4
})
