import { useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import {
  FE_C,
  FIELD_NAME,
  HT_PROCESSES,
  a3,
  acm,
  diagramLines,
  htBand,
  phaseField,
  tieLine,
  type HtKey,
} from '@/features/phase-diagram/feC'

const W = 760
const H = 480
const M = { l: 56, r: 58, t: 14, b: 42 }
const PW = W - M.l - M.r
const PH = H - M.t - M.b

type ViewKey = 'full' | 'steel' | 'delta'
type Label = { text: ReactNode; c: number; t: number; to?: [number, number]; size?: number }
type View = {
  name: string
  cMax: number
  tMin: number
  tMax: number
  cTicks: number[]
  tTicks: number[]
  fTicks: number[]
  labels: Label[]
}

const range = (a: number, b: number, s: number) => Array.from({ length: Math.round((b - a) / s) + 1 }, (_, i) => +(a + i * s).toFixed(4))
const sub = (base: string, s: string) => (
  <>
    {base}
    <tspan fontSize="0.75em" dy="3">{s}</tspan>
  </>
)

const VIEWS: Record<ViewKey, View> = {
  full: {
    name: 'Full',
    cMax: FE_C.cementiteC,
    tMin: 400,
    tMax: 1600,
    cTicks: range(0, 6, 1),
    tTicks: range(400, 1600, 100),
    fTicks: range(800, 2800, 200),
    labels: [
      { text: 'L', c: 3.2, t: 1450 },
      { text: 'L + γ', c: 1.9, t: 1290 },
      { text: 'L + Fe₃C', c: 5.45, t: 1162, size: 10 },
      { text: 'γ', c: 0.75, t: 1060 },
      { text: 'γ + Fe₃C', c: 3.6, t: 950 },
      { text: 'α + γ', c: 0.3, t: 790, size: 10 },
      { text: 'α + Fe₃C', c: 3.2, t: 560 },
      { text: 'α', c: 0.4, t: 620, to: [0.006, 650], size: 10 },
      { text: 'δ', c: 0.3, t: 1585, to: [0.015, 1460], size: 10 },
      { text: 'L + δ', c: 0.65, t: 1560, to: [0.08, 1515], size: 10 },
      { text: 'δ + γ', c: 1.0, t: 1525, to: [0.09, 1450], size: 10 },
    ],
  },
  steel: {
    name: 'Steel 0–2.11 % C',
    cMax: FE_C.gammaMaxC,
    tMin: 500,
    tMax: 1000,
    cTicks: range(0, 2, 0.25),
    tTicks: range(500, 1000, 50),
    fTicks: range(1000, 1800, 100),
    labels: [
      { text: 'γ', c: 0.6, t: 905 },
      { text: 'α + γ', c: 0.22, t: 765 },
      { text: 'γ + Fe₃C', c: 1.65, t: 830 },
      { text: 'α + Fe₃C', c: 1.05, t: 610 },
      { text: 'α', c: 0.14, t: 670, to: [0.008, 690] },
    ],
  },
  delta: {
    name: 'δ region',
    cMax: 0.6,
    tMin: 1350,
    tMax: 1560,
    cTicks: range(0, 0.6, 0.1),
    tTicks: range(1350, 1550, 25),
    fTicks: range(2500, 2800, 50),
    labels: [
      { text: 'L', c: 0.47, t: 1530 },
      { text: 'L + δ', c: 0.19, t: 1506 },
      { text: 'δ', c: 0.022, t: 1445 },
      { text: 'δ + γ', c: 0.1, t: 1478, size: 10 },
      { text: 'γ', c: 0.3, t: 1400 },
      { text: 'L + γ', c: 0.46, t: 1462 },
    ],
  },
}

const HT_COLOR: Record<HtKey, string> = {
  anneal: 'var(--accent)',
  normalise: 'var(--ok)',
  harden: 'var(--danger)',
  spheroidise: 'var(--warn)',
  stress: 'var(--steel)',
  process: 'var(--muted)',
  hotwork: 'var(--accent-hover)',
}

export type CompositionLines = { ac1: number; ac3: (c: number) => number; c: number }

type Props = {
  c: number
  t: number
  onSelect: (c: number, t: number) => void
  composition: CompositionLines | null
}

const fmtC = (c: number) => (c < 0.1 ? c.toFixed(3) : c.toFixed(2))

export function Diagram({ c, t, onSelect, composition }: Props) {
  const [viewKey, setViewKey] = useState<ViewKey>('full')
  const [overlays, setOverlays] = useState<HtKey[]>([])
  const [showComp, setShowComp] = useState(true)
  const [hover, setHover] = useState<{ c: number; t: number } | null>(null)
  const v = VIEWS[viewKey]

  const px = (cc: number) => M.l + (cc / v.cMax) * PW
  const py = (tt: number) => M.t + ((v.tMax - tt) / (v.tMax - v.tMin)) * PH
  const path = (pts: [number, number][]) => pts.map(([cc, tt], i) => `${i ? 'L' : 'M'}${px(cc).toFixed(1)},${py(tt).toFixed(1)}`).join(' ')
  const inView = (cc: number, tt: number) => cc >= 0 && cc <= v.cMax && tt >= v.tMin && tt <= v.tMax

  const lines = useMemo(() => diagramLines(), [])
  const bands = useMemo(() => HT_PROCESSES.map((p) => ({ p, pts: htBand(p) })), [])
  const tie = tieLine(c, t)

  function toData(e: MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const sx = ((e.clientX - r.left) / r.width) * W
    const sy = ((e.clientY - r.top) / r.height) * H
    if (sx < M.l || sx > W - M.r || sy < M.t || sy > H - M.b) return null
    return { c: ((sx - M.l) / PW) * v.cMax, t: v.tMax - ((sy - M.t) / PH) * (v.tMax - v.tMin) }
  }

  const fToC = (f: number) => ((f - 32) * 5) / 9
  const a1Label = Math.min(v.cMax, FE_C.cementiteC) * 0.97
  const lineLabels: { text: ReactNode; c: number; t: number; dx: number; dy: number; anchor?: 'end' }[] = [
    { text: 'A₁', c: a1Label, t: FE_C.eutectoidT, dx: 0, dy: -5, anchor: 'end' },
    { text: 'A₃', c: 0.3, t: a3(0.3), dx: 6, dy: -4 },
    { text: sub('A', 'cm'), c: 1.35, t: acm(1.35), dx: -6, dy: -4, anchor: 'end' },
    { text: 'A₂', c: 0.02, t: FE_C.curie, dx: 4, dy: -4 },
    { text: '1148 °C', c: Math.min(v.cMax, FE_C.cementiteC) * 0.97, t: FE_C.eutecticT, dx: 0, dy: 13, anchor: 'end' },
  ]
  if (viewKey === 'delta') lineLabels.push({ text: '1495 °C', c: 0.54, t: FE_C.peritecticT, dx: 4, dy: 4 })

  const readout = hover && (
    <g pointerEvents="none">
      <line x1={px(hover.c)} x2={px(hover.c)} y1={M.t} y2={H - M.b} stroke="var(--muted)" strokeDasharray="2 3" />
      <line x1={M.l} x2={W - M.r} y1={py(hover.t)} y2={py(hover.t)} stroke="var(--muted)" strokeDasharray="2 3" />
      {(() => {
        const bx = px(hover.c) > M.l + PW / 2 ? M.l + 8 : W - M.r - 198
        return (
          <g transform={`translate(${bx},${M.t + 8})`}>
            <rect width={190} height={42} fill="var(--panel)" stroke="var(--line-strong)" />
            <text x={8} y={16} fontSize="11" fill="var(--ink)">
              {hover.c.toFixed(2)} % C · {hover.t.toFixed(0)} °C · {((hover.t * 9) / 5 + 32).toFixed(0)} °F
            </text>
            <text x={8} y={32} fontSize="11" fontWeight={600} fill="var(--ink)">{FIELD_NAME[phaseField(hover.c, hover.t)]}</text>
          </g>
        )
      })()}
    </g>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
          <button key={k} type="button" className={`btn ${k === viewKey ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewKey(k)}>
            {VIEWS[k].name}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none cursor-crosshair"
        role="img"
        aria-label="Iron–carbon phase diagram"
        onMouseMove={(e) => setHover(toData(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const d = toData(e)
          if (d) onSelect(Math.round(d.c * 100) / 100, Math.round(d.t))
        }}
      >
        <defs>
          <clipPath id="fec-plot">
            <rect x={M.l} y={M.t} width={PW} height={PH} />
          </clipPath>
        </defs>
        <rect x={M.l} y={M.t} width={PW} height={PH} fill="var(--panel)" stroke="var(--line-strong)" />

        {v.tTicks.map((tt) => (
          <g key={`t${tt}`}>
            <line x1={M.l} x2={W - M.r} y1={py(tt)} y2={py(tt)} stroke="var(--line)" />
            <text x={M.l - 6} y={py(tt) + 3.5} fontSize="10" textAnchor="end" fill="var(--muted)">{tt}</text>
          </g>
        ))}
        {v.fTicks.map((f) => (
          <text key={`f${f}`} x={W - M.r + 6} y={py(fToC(f)) + 3.5} fontSize="10" fill="var(--muted)">{f}</text>
        ))}
        {v.cTicks.map((cc) => (
          <g key={`c${cc}`}>
            <line x1={px(cc)} x2={px(cc)} y1={M.t} y2={H - M.b} stroke="var(--line)" />
            <text x={px(cc)} y={H - M.b + 14} fontSize="10" textAnchor="middle" fill="var(--muted)">{cc}</text>
          </g>
        ))}
        <text x={M.l + PW / 2} y={H - 8} fontSize="11" textAnchor="middle" fill="var(--muted)">Carbon, wt %</text>
        <text transform={`translate(14,${M.t + PH / 2}) rotate(-90)`} fontSize="11" textAnchor="middle" fill="var(--muted)">°C</text>
        <text transform={`translate(${W - 10},${M.t + PH / 2}) rotate(90)`} fontSize="11" textAnchor="middle" fill="var(--muted)">°F</text>

        <g clipPath="url(#fec-plot)">
          {bands
            .filter(({ p, pts }) => overlays.includes(p.key) && pts.length > 1)
            .map(({ p, pts }) => {
              const d = `${path(pts.map(([cc, , hi]) => [cc, hi]))} ${path([...pts].reverse().map(([cc, lo]) => [cc, lo])).replace(/^M/, 'L')} Z`
              const col = HT_COLOR[p.key]
              return (
                <path
                  key={p.key}
                  d={d}
                  fill={`color-mix(in srgb, ${col} 18%, transparent)`}
                  stroke={`color-mix(in srgb, ${col} 70%, transparent)`}
                  strokeWidth={1}
                />
              )
            })}

          {lines.map((l) => (
            <path
              key={l.id}
              d={path(l.pts)}
              fill="none"
              stroke={l.dashed ? 'var(--muted)' : 'var(--ink)'}
              strokeWidth={l.dashed ? 1.2 : 1.8}
              strokeDasharray={l.dashed ? '5 4' : undefined}
              strokeLinejoin="round"
            />
          ))}
          {[
            [FE_C.peritecticC, FE_C.peritecticT],
            [FE_C.eutecticC, FE_C.eutecticT],
            [FE_C.eutectoidC, FE_C.eutectoidT],
          ].map(([cc, tt]) => (
            <circle key={`${cc}`} cx={px(cc)} cy={py(tt)} r={3} fill="var(--ink)" />
          ))}

          {composition && showComp && (
            <g stroke="var(--accent)" fill="none" strokeWidth={1.6} strokeDasharray="6 4">
              <path d={path([[0, composition.ac1], [Math.min(v.cMax, FE_C.gammaMaxC), composition.ac1]])} />
              <path
                d={path(
                  Array.from({ length: 41 }, (_, i) => (i / 40) * 1.2)
                    .map((cc) => [cc, composition.ac3(cc)] as [number, number])
                    .filter(([, tt]) => tt >= composition.ac1),
                )}
              />
              <text x={px(Math.min(v.cMax, FE_C.gammaMaxC) * 0.6)} y={py(composition.ac1) + 13} fontSize="11" fill="var(--accent)" stroke="none">
                Ac₁
              </text>
              {composition.ac3(composition.c) > composition.ac1 && (
                <circle cx={px(composition.c)} cy={py(composition.ac3(composition.c))} r={3.5} fill="var(--accent)" stroke="none" />
              )}
              <text x={px(0.05)} y={py(composition.ac3(0.05)) - 6} fontSize="11" fill="var(--accent)" stroke="none">
                Ac₃
              </text>
            </g>
          )}

          {lineLabels
            .filter((l) => inView(l.c, l.t))
            .map((l, i) => (
              <text key={i} x={px(l.c) + l.dx} y={py(l.t) + l.dy} fontSize="11" fontStyle="italic" textAnchor={l.anchor} fill="var(--muted)">
                {l.text}
              </text>
            ))}

          {v.labels.map((l, i) => (
            <g key={i}>
              {l.to && <line x1={px(l.c)} y1={py(l.t)} x2={px(l.to[0])} y2={py(l.to[1])} stroke="var(--muted)" strokeWidth={0.8} />}
              <text
                x={px(l.c)}
                y={py(l.t)}
                fontSize={l.size ?? 12}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--ink)"
                stroke="var(--panel)"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {l.text}
              </text>
            </g>
          ))}

          {tie && (
            <g>
              <line x1={px(tie.left.c)} x2={px(tie.right.c)} y1={py(t)} y2={py(t)} stroke="var(--accent)" strokeWidth={2.2} />
              {[tie.left, tie.right].map((e, i) => (
                <g key={i}>
                  <circle cx={px(e.c)} cy={py(t)} r={4} fill="var(--accent)" stroke="var(--panel)" strokeWidth={1.5} />
                  {px(tie.right.c) - px(tie.left.c) > 70 && (
                  <text
                    x={px(e.c) + (i ? -4 : 4)}
                    y={py(t) - 8}
                    fontSize="10"
                    textAnchor={i ? 'end' : 'start'}
                    fill="var(--accent-ink)"
                    stroke="var(--panel)"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {e.phase} {fmtC(e.c)}
                  </text>
                  )}
                </g>
              ))}
            </g>
          )}

          <line x1={px(c)} x2={px(c)} y1={M.t} y2={H - M.b} stroke="var(--danger)" strokeDasharray="3 3" opacity={0.5} />
          <circle cx={px(c)} cy={py(t)} r={5.5} fill="var(--danger)" stroke="var(--panel)" strokeWidth={2} />
        </g>

        {readout}
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {HT_PROCESSES.map((p) => (
          <label key={p.key} className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={overlays.includes(p.key)}
              onChange={(e) => setOverlays((o) => (e.target.checked ? [...o, p.key] : o.filter((k) => k !== p.key)))}
            />
            <span
              className="inline-block w-3 h-3"
              style={{ background: `color-mix(in srgb, ${HT_COLOR[p.key]} 35%, transparent)`, border: `1px solid ${HT_COLOR[p.key]}` }}
            />
            {p.name}
          </label>
        ))}
        {composition && (
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showComp} onChange={(e) => setShowComp(e.target.checked)} />
            <span className="inline-block w-3 h-0 border-t-2 border-dashed border-[var(--accent)]" />
            Ac₁ / Ac₃ (composition)
          </label>
        )}
      </div>
    </div>
  )
}
