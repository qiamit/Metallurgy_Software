// Parity with the old Python/OpenCV API: same JSON and pixel-identical overlays.
// Fixtures were produced by test/fixtures/generate_python_expected.py against the old
// FastAPI apps/api (removed in this rewrite; see git history).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { loadCv, decodeToBgr, ANALYZERS } from '../lib/analysis.mjs'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const expected = JSON.parse(fs.readFileSync(path.join(dir, 'python-expected.json'), 'utf8'))

async function rawRgb(buffer) {
  return sharp(buffer).removeAlpha().raw().toBuffer()
}

for (const [type, analyze] of Object.entries(ANALYZERS)) {
  test(`${type} matches Python result and overlay`, async () => {
    const { cv } = await loadCv()
    const image = await decodeToBgr(cv, fs.readFileSync(path.join(dir, `${type}.png`)))
    const [sx, sy] = expected.scales[type]
    const { result, overlay } = analyze(cv, image, sx, sy)
    assert.deepEqual(result, expected.results[type])

    const rgba = new cv.Mat()
    cv.cvtColor(overlay, rgba, cv.COLOR_BGR2RGBA)
    const ours = await rawRgb(
      await sharp(Buffer.from(rgba.data), { raw: { width: rgba.cols, height: rgba.rows, channels: 4 } })
        .png()
        .toBuffer(),
    )
    const theirs = await rawRgb(fs.readFileSync(path.join(dir, `${type}_py_overlay.png`)))
    assert.equal(Buffer.compare(ours, theirs), 0, 'overlay pixels differ')
    for (const m of [image, overlay, rgba]) m.delete()
  })
}
