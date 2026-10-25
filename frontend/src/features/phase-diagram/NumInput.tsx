import { useState } from 'react'

type Props = {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  ariaLabel?: string
}

/** Number input that keeps the typed text (e.g. "0.") while emitting clamped numbers. */
export function NumInput({ value, onChange, min, max, step, className = 'input', ariaLabel }: Props) {
  const [text, setText] = useState(String(value))
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    if (Number(text) !== value) setText(String(value))
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      className={className}
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() === '' || !Number.isFinite(n)) return
        const v = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n))
        setShown(v)
        onChange(v)
      }}
    />
  )
}
