import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CopyButton({ text, label = 'Copy value' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
    >
      {copied ? <Check size={14} className="text-[var(--ok)]" /> : <Copy size={14} />}
    </button>
  )
}
