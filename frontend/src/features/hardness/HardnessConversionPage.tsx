import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalculatorsTab } from '@/features/hardness/CalculatorsTab'
import { ConverterTab, type ConverterState } from '@/features/hardness/ConverterTab'
import { ScalesTab } from '@/features/hardness/ScalesTab'
import { TablesTab } from '@/features/hardness/TablesTab'
import { resolveTable, type TableId } from '@/features/hardness/e140'
import { num } from '@/features/hardness/calc'

const TABS = [
  { id: 'converter', label: 'Converter' },
  { id: 'calculators', label: 'Calculators' },
  { id: 'scales', label: 'Scales' },
  { id: 'tables', label: 'E140 Tables' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function HardnessConversionPage() {
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'converter'
  const [conv, setConv] = useState<ConverterState>({ scaleKey: 'HRC', raw: '40', choice: 'auto' })
  const value = num(conv.raw)
  const convTable = resolveTable(conv.choice, conv.scaleKey, value)
  const [tableView, setTableView] = useState<TableId | null>(null)

  function selectTab(id: TabId) {
    const next = new URLSearchParams(params)
    if (id === 'converter') next.delete('tab')
    else next.set('tab', id)
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <h1 className="page-title">Hardness</h1>

      <div role="tablist" className="flex flex-wrap border-b border-[var(--line)]">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-[var(--accent)] text-[var(--accent-ink)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'converter' && <ConverterTab state={conv} onChange={setConv} />}
      {tab === 'calculators' && <CalculatorsTab />}
      {tab === 'scales' && <ScalesTab />}
      {tab === 'tables' && (
        <TablesTab table={tableView ?? convTable} onTable={setTableView} scaleKey={conv.scaleKey} value={value} />
      )}
    </div>
  )
}
