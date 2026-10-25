import { useSearchParams } from 'react-router-dom'
import PhysicalConstantsTab from '@/features/constants/PhysicalConstantsTab'
import MaterialsTab from '@/features/constants/MaterialsTab'
import UnitConverterTab from '@/features/constants/UnitConverterTab'
import MetallurgyTab from '@/features/constants/MetallurgyTab'

const TABS = [
  { id: 'physical', label: 'Physical constants' },
  { id: 'materials', label: 'Materials' },
  { id: 'units', label: 'Unit converter' },
  { id: 'metallurgy', label: 'Metallurgy' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function ConstantsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : 'physical'

  return (
    <div className="space-y-6">
      <h1 className="page-title">Constants &amp; Units</h1>

      <div role="tablist" className="flex flex-wrap border-b border-[var(--line)]">
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
      </div>

      {tab === 'physical' && <PhysicalConstantsTab />}
      {tab === 'materials' && <MaterialsTab />}
      {tab === 'units' && <UnitConverterTab />}
      {tab === 'metallurgy' && <MetallurgyTab />}
    </div>
  )
}
