const INVARIANTS = [
  { name: 'Peritectic', t: '1495 °C', reaction: 'L (0.53) + δ (0.09) → γ (0.17)', product: '—' },
  { name: 'Eutectic', t: '1148 °C', reaction: 'L (4.30) → γ (2.11) + Fe₃C (6.67)', product: 'Ledeburite' },
  { name: 'Eutectoid', t: '727 °C', reaction: 'γ (0.77) → α (0.022) + Fe₃C (6.67)', product: 'Pearlite' },
]

const PHASES = [
  { name: 'Ferrite (α)', type: 'Phase', structure: 'BCC', carbon: '≤ 0.022', hardness: '80–90 HV', note: 'Soft, ductile; magnetic below 770 °C' },
  { name: 'Austenite (γ)', type: 'Phase', structure: 'FCC', carbon: '≤ 2.11', hardness: '—', note: 'Non-magnetic; stable above A₁' },
  { name: 'δ-ferrite', type: 'Phase', structure: 'BCC', carbon: '≤ 0.09', hardness: '—', note: '1394–1538 °C' },
  { name: 'Cementite (Fe₃C)', type: 'Phase', structure: 'Orthorhombic', carbon: '6.67', hardness: '~800 HV', note: 'Hard, brittle' },
  { name: 'Pearlite', type: 'Microconstituent', structure: 'α + Fe₃C lamellae', carbon: '0.77', hardness: '200–250 HV', note: 'Eutectoid product' },
  { name: 'Ledeburite', type: 'Microconstituent', structure: 'γ + Fe₃C (→ P + Fe₃C)', carbon: '4.30', hardness: 'High', note: 'Eutectic in white iron' },
  { name: 'Martensite', type: 'Metastable', structure: 'BCT', carbon: 'As austenite', hardness: 'C-dependent', note: 'Diffusionless, quench product' },
  { name: 'Bainite', type: 'Microconstituent', structure: 'α + carbides (non-lamellar)', carbon: 'As austenite', hardness: '300–600 HV', note: 'Between pearlite and Ms' },
]

const CRITICAL = [
  { sym: 'A₀', t: '210 °C', meaning: 'Cementite Curie point' },
  { sym: 'A₁', t: '727 °C', meaning: 'Eutectoid (lower critical)' },
  { sym: 'A₂', t: '770 °C', meaning: 'Ferrite Curie point' },
  { sym: 'A₃', t: '912 → 727 °C', meaning: 'α + γ / γ boundary (upper critical, hypo)' },
  { sym: 'A_cm', t: '727 → 1148 °C', meaning: 'γ / γ + Fe₃C boundary (hyper)' },
  { sym: 'A₄', t: '1394 °C', meaning: 'γ ⇄ δ in pure iron' },
]

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="table-head">
          <tr>
            {head.map((h) => (
              <th key={h} className="text-left px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--line)]">
              {r.map((cell, j) => (
                <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'font-semibold' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReferenceTables() {
  return (
    <div className="space-y-6">
      <div className="card p-4 space-y-3">
        <h2 className="section-title">Invariant reactions</h2>
        <Table head={['Reaction', 'T', 'Wt % C', 'Product']} rows={INVARIANTS.map((r) => [r.name, r.t, r.reaction, r.product])} />
      </div>
      <div className="card p-4 space-y-3">
        <h2 className="section-title">Phases and microconstituents</h2>
        <Table
          head={['Name', 'Type', 'Structure', '% C', 'Hardness', 'Note']}
          rows={PHASES.map((p) => [p.name, p.type, p.structure, p.carbon, p.hardness, p.note])}
        />
      </div>
      <div className="card p-4 space-y-3">
        <h2 className="section-title">Critical temperatures</h2>
        <Table head={['Symbol', 'T', 'Meaning']} rows={CRITICAL.map((r) => [r.sym, r.t, r.meaning])} />
      </div>
    </div>
  )
}
