import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import PhysicalConstantsTab from '@/features/constants/PhysicalConstantsTab'
import MaterialsTab from '@/features/constants/MaterialsTab'
import UnitConverterTab from '@/features/constants/UnitConverterTab'
import MetallurgyTab from '@/features/constants/MetallurgyTab'

const TABS = [
  { id: 'physical', label: 'Physical Constants' },
  { id: 'materials', label: 'Materials' },
  { id: 'units', label: 'Unit Converter' },
  { id: 'metallurgy', label: 'Metallurgy' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function ConstantsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : 'physical'
  const [query, setQuery] = useState('')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Constants &amp; Units</h1>
        {tab === 'physical' && (
          <label className="relative w-full sm:w-72">
            <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              className="input pl-8"
              type="search"
              placeholder="Search"
              aria-label="Search constants"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
      </div>

      <div role="tablist" className="flex flex-wrap items-end border-b border-[var(--line)]">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParams({ tab: t.id }, { replace: true })}
              className={`-mb-px px-4 py-2 text-sm font-semibold border-b-2 ${
                active
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {t.label}
            </button>
          )
        })}
        {tab === 'physical' && <span className="badge badge-muted mb-2 ml-auto">CODATA 2018</span>}
      </div>

      {tab === 'physical' && <PhysicalConstantsTab query={query} />}
      {tab === 'materials' && <MaterialsTab />}
      {tab === 'units' && <UnitConverterTab />}
      {tab === 'metallurgy' && <MetallurgyTab />}
    </div>
  )
}
