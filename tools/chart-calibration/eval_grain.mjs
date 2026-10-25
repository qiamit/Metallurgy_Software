import fs from 'node:fs'
const [, , lib, dir, outDir] = process.argv
const { loadCv, decodeToBgr, encodeBgrToPng, analyzeGrainSize } = await import(lib)
const { cv } = await loadCv()
const idx = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8'))
const rows = []
for (const [name, f] of Object.entries(idx)) {
  const img = await decodeToBgr(cv, fs.readFileSync(`${dir}/${name}.png`))
  const t = Date.now()
  const { result, overlay } = analyzeGrainSize(cv, img, f.um_per_px, f.um_per_px)
  if (outDir) fs.writeFileSync(`${outDir}/${name}_overlay.png`, await encodeBgrToPng(cv, overlay))
  img.delete(); overlay.delete()
  rows.push({ name, plate: f.plate, ref: f.G, gi: result.grain_size_number_G, gp: result.grain_size_number_G_planimetric, ms: Date.now() - t, pol: result.boundary_polarity[0], duplex: result.duplex_coarse_area_percent })
}
rows.sort((a, b) => a.name.localeCompare(b.name) || a.ref - b.ref)
for (const r of rows) console.log(`${r.name.padEnd(9)} ref ${String(r.ref).padStart(4)}  intercept ${r.gi.toFixed(2).padStart(5)} (Δ ${(r.gi - r.ref).toFixed(2).padStart(5)})  planimetric ${r.gp.toFixed(2).padStart(5)} (Δ ${(r.gp - r.ref).toFixed(2).padStart(5)})  ${r.pol} dup ${r.duplex}% ${r.ms}ms`)
for (const plate of [...new Set(rows.map((r) => r.plate))]) {
  const set = rows.filter((r) => r.plate === plate)
  const mi = set.reduce((s, r) => s + Math.abs(r.gi - r.ref), 0) / set.length
  const mp = set.reduce((s, r) => s + Math.abs(r.gp - r.ref), 0) / set.length
  console.log(`${plate}: mean |ΔG| intercept ${mi.toFixed(2)}, planimetric ${mp.toFixed(2)}, max intercept ${Math.max(...set.map((r) => Math.abs(r.gi - r.ref))).toFixed(2)}`)
}
fs.writeFileSync(`${dir}/results.json`, JSON.stringify(rows, null, 1))
process.exit(0)
