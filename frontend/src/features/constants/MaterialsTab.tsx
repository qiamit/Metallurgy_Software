import { FE_CONSTANTS, MATERIALS, type MaterialRow } from '@/features/constants/materials'

type NumKey = Exclude<keyof MaterialRow, 'name' | 'melting'>

const COLUMNS: { key: NumKey | 'melting'; label: string; unit: string }[] = [
  { key: 'density', label: 'ρ', unit: 'g/cm³' },
  { key: 'E', label: 'E', unit: 'GPa' },
  { key: 'G', label: 'G', unit: 'GPa' },
  { key: 'poisson', label: 'ν', unit: '' },
  { key: 'expansion', label: 'α', unit: '10⁻⁶/K' },
  { key: 'conductivity', label: 'k', unit: 'W/(m·K)' },
  { key: 'specificHeat', label: 'cₚ', unit: 'J/(kg·K)' },
  { key: 'melting', label: 'Melting', unit: '°C' },
  { key: 'resistivity', label: 'ρₑ', unit: 'µΩ·cm' },
]

export default function MaterialsTab() {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="section-title flex-1">Engineering materials · 20 °C</h2>
          <span className="badge badge-muted ml-3 mb-[0.9rem]">typical</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="text-left px-4 py-3">Material</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="text-right px-3 py-3 whitespace-nowrap normal-case">
                    <div>{c.label}</div>
                    <div className="font-normal opacity-80">{c.unit}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map((m) => (
                <tr key={m.name} className="border-t border-[var(--line)]">
                  <td className="px-4 py-2 whitespace-nowrap font-medium">{m.name}</td>
                  {COLUMNS.map((c) => {
                    const v = m[c.key]
                    return (
                      <td key={c.key} className="px-3 py-2 text-right font-mono whitespace-nowrap">
                        {v == null ? <span className="text-[var(--muted)]">—</span> : v}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card max-w-2xl">
        <h2 className="section-title px-4 pt-4">Iron &amp; steel</h2>
        <table className="w-full text-sm">
          <tbody>
            {FE_CONSTANTS.map((f) => (
              <tr key={f.name} className="border-t border-[var(--line)]">
                <td className="px-4 py-2">{f.name}</td>
                <td className="px-4 py-2 text-right font-mono whitespace-nowrap">{f.value}</td>
                <td className="px-4 py-2 text-[var(--muted)] whitespace-nowrap">{f.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
