import type { ReactNode } from 'react'

/** Compact label → value rows for calculator results. */
export function ResultList({ items }: { items: { label: string; value: ReactNode; tone?: 'warn' | 'main' }[] }) {
  return (
    <dl className="mt-4 border-t border-[var(--line)] text-sm">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-1.5">
          <dt className="text-[var(--muted)]">{it.label}</dt>
          <dd
            className={`font-mono text-right ${it.tone === 'main' ? 'text-base font-semibold text-[var(--accent-ink)]' : ''} ${
              it.tone === 'warn' ? 'text-[var(--warn)]' : ''
            }`}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function CardHead({ title, badge }: { title: string; badge?: string }) {
  return (
    <h2 className="section-title flex items-center justify-between gap-2">
      <span>{title}</span>
      {badge && <span className="badge badge-muted normal-case tracking-normal">{badge}</span>}
    </h2>
  )
}
