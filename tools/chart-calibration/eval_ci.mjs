import fs from 'node:fs'
const [, , lib, dir, outDir] = process.argv
const L = await import(lib)
const { cv } = await L.loadCv()
const idx = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8'))
async function run(name, fn, um) {
  const img = await L.decodeToBgr(cv, fs.readFileSync(`${dir}/${name}.png`))
  const { result, overlay } = fn(cv, img, um, um)
  if (outDir) fs.writeFileSync(`${outDir}/${name}.png`, await L.encodeBgrToPng(cv, overlay))
  img.delete(); overlay.delete(); return result
}
console.log('== Nodularity (chart 0122, ISO 945 / E2567)')
let err = []
for (const n of Object.keys(idx).filter((k) => k.startsWith('NOD_'))) {
  const r = await run(n, L.analyzeNodularity, 0.8)
  err.push(Math.abs(r.nodularity_percent - idx[n].nodularity))
  console.log(`${n.padEnd(8)} chart ${String(idx[n].nodularity).padStart(3)}%  measured ${r.nodularity_percent}% (incl. ½ intermediate ${r.nodularity_incl_intermediate_percent}%)  particles ${r.particles_counted}`)
}
console.log('mean |Δ| nodularity', (err.reduce((s, v) => s + v, 0) / err.length).toFixed(1), 'points')
console.log('\n== Graphite form (chart 0135 A247 Types I–VII)')
for (const n of Object.keys(idx).filter((k) => k.startsWith('FORM_'))) {
  const r = await run(n, L.analyzeNodularity, 0.8)
  console.log(`${n.padEnd(9)} nodularity ${String(r.nodularity_percent).padStart(5)}%`)
}
async function sizeSeries(prefix, fn, field, label) {
  const items = Object.keys(idx).filter((k) => k.startsWith(prefix)).map((k) => ({ k, c: idx[k].size_class }))
  // measure in px (um = 1) then fit one print scale s (µm/px) so classes agree best
  for (const it of items) it.px = (await run(it.k, fn, 1))[field]
  let best = null
  for (let s = 0.05; s < 20; s *= 1.01) {
    const e = items.reduce((acc, it) => acc + Math.abs(L.a247SizeClass(it.px * s) - it.c), 0)
    if (!best || e < best.e) best = { s, e }
  }
  console.log(`\n== ${label}: fitted print scale ${best.s.toFixed(3)} µm/px`)
  let ok = 0
  for (const it of items) {
    const c = L.a247SizeClass(it.px * best.s); if (c === it.c) ok += 1
    console.log(`class ${it.c}: ${field} ${it.px.toFixed(0).padStart(5)} px -> ${(it.px * best.s).toFixed(0).padStart(5)} µm -> class ${c}${c === it.c ? '' : '  ✗'}`)
  }
  const ratios = items.slice(1).map((it, i) => (items[i].px / it.px).toFixed(2))
  console.log(`${ok}/${items.length} classes correct with one scale; size ratio between successive classes: ${ratios.join(', ')} (A247 nominal 2.0)`)
}
await sizeSeries('NSIZE_', L.analyzeNodularity, 'median_nodule_diameter_um', 'Nodule size class (0135, A247)')
await sizeSeries('FSIZE138_', L.analyzeGraphiteFlake, 'longest_flakes_mean_um', 'Flake size class (0138 Plate I, drawn)')
await sizeSeries('FSIZE135_', L.analyzeGraphiteFlake, 'longest_flakes_mean_um', 'Flake size class (0135, photos)')
process.exit(0)
