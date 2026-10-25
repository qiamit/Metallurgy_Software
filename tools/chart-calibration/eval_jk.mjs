import fs from 'node:fs'
const [, , lib, dir, outDir] = process.argv
const { loadCv, decodeToBgr, encodeBgrToPng, analyzeInclusion, jkSeverity, JK_LIMITS } = await import(lib)
const { cv } = await loadCv()
const idx = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8'))
const steps = [0.5, 1, 1.5, 2, 2.5, 3]
let exact = 0, within = 0, seriesOk = 0, n = 0
const rows = []
for (const [name, f] of Object.entries(idx).sort()) {
  const img = await decodeToBgr(cv, fs.readFileSync(`${dir}/${name}.png`))
  const { result, overlay } = analyzeInclusion(cv, img, f.um_per_px, f.um_per_px)
  if (outDir) fs.writeFileSync(`${outDir}/${name}_jk.png`, await encodeBgrToPng(cv, overlay))
  img.delete(); overlay.delete()
  const incs = result.inclusions
  let measured, rated, seriesFound
  if (f.type === 'D') {
    const d = incs.filter((i) => i.type === 'D' || i.type === 'DS')
    measured = d.length
    seriesFound = d.filter((i) => i.series === f.series).length >= d.length / 2
  } else {
    const want = f.type === 'B' ? ['B'] : ['A', 'C']
    const g = incs.filter((i) => want.includes(i.type))
    measured = g.reduce((s, i) => s + i.length_um, 0)
    const len = (sr) => g.filter((i) => i.series === sr).reduce((s, i) => s + i.length_um, 0)
    seriesFound = len(f.series) >= len(f.series === 'thin' ? 'heavy' : 'thin')
  }
  rated = jkSeverity(f.type, measured)
  const nominal = JK_LIMITS[f.type][steps.indexOf(f.severity)]
  n += 1; if (rated === f.severity) exact += 1; if (Math.abs(rated - f.severity) <= 0.5) within += 1; if (seriesFound) seriesOk += 1
  rows.push(`${name.padEnd(14)} nominal ${String(nominal).padStart(4)}  measured ${measured.toFixed(0).padStart(4)} (${((measured / nominal - 1) * 100).toFixed(0).padStart(4)}%)  rated ${rated} vs ${f.severity}  series ${seriesFound ? 'ok' : 'WRONG'}  [${result.jk_summary}]`)
}
console.log(rows.join('\n'))
console.log(`\nJK chart fields: ${n}; severity exact ${exact}/${n}, within ±0.5 ${within}/${n}; thin/heavy series correct ${seriesOk}/${n}`)
process.exit(0)
