import { useRef, useState } from 'react'
import { Camera, Cpu, RefreshCw, ScanEye, Sparkles } from 'lucide-react'
import { fileToDataUrl } from '../lib/image.js'
import { STREAMS } from '../lib/streams.js'
import { useStore } from '../lib/store.jsx'
import { Button } from './ui.jsx'

/** Native rear-camera capture: opens the phone camera directly; on desktop opens a file picker. */
export function CaptureButton({ onCapture, label, variant = 'primary', size = 'lg', icon = Camera, className = '', maxSide = 768 }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <input
        ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setBusy(true)
          try { onCapture(await fileToDataUrl(f, maxSide, maxSide < 768 ? 0.65 : 0.8)) } finally { setBusy(false) }
        }}
      />
      <Button variant={variant} size={size} icon={busy ? RefreshCw : icon} className={className} onClick={() => ref.current?.click()} disabled={busy}>{label}</Button>
    </>
  )
}

/** Captured photo with AI bounding-box overlays. */
export function AIPhoto({ photo, result, analyzing }) {
  const { t } = useStore()
  const color = result ? STREAMS[result.stream].color : '#2E9E6B'
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1C1F23] aspect-[4/3]">
      <img src={photo} alt="Captured waste bag" className="absolute inset-0 size-full object-cover" />
      {analyzing && (
        <div className="absolute inset-0 bg-black/40 grid place-items-center">
          <div className="absolute inset-x-0 h-0.5 bg-mint shadow-[0_0_16px_4px_rgba(16,185,129,0.7)] animate-scan" />
          <span className="flex items-center gap-2 bg-white/95 text-forest font-semibold text-base px-4 py-2.5 rounded-full"><ScanEye size={18} /> {t('field.analyzing')}</span>
        </div>
      )}
      {result && result.items.map((it, i) => {
        const [y0, x0, y1, x1] = it.box
        return (
          <div key={i} className="absolute rounded-md animate-fadein" style={{ top: `${y0 * 100}%`, left: `${x0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%`, boxShadow: `0 0 0 2px ${color}, 0 0 0 4px rgba(255,255,255,0.7)`, animationDelay: `${i * 120}ms` }}>
            <span className="absolute -top-px left-0 -translate-y-full text-[13px] font-semibold text-white px-2 py-0.5 rounded-t-md whitespace-nowrap" style={{ background: color }}>{it.label}</span>
          </div>
        )
      })}
      {result && (
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
          <Chip>{result.sealIntact ? '✓ Seal intact' : '⚠ Seal open'}</Chip>
          <Chip>{result.contamination === 'none' ? '✓ No contamination' : `⚠ Contamination: ${result.contamination}`}</Chip>
          <Chip>{Math.round(result.confidence * 100)}% confidence</Chip>
        </div>
      )}
    </div>
  )
}

const Chip = ({ children }) => <span className="text-sm font-semibold bg-white/95 text-ink px-2.5 py-1 rounded-lg shadow-sm">{children}</span>

export function AIVerdict({ result, expected }) {
  const { lang } = useStore()
  if (!result) return null
  const match = result.stream === expected
  return (
    <div className={`rounded-2xl px-5 py-4 text-base ${match ? 'bg-sage' : 'bg-[#FEF5E6]'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-ink flex items-center gap-2">
          {result.source === 'gemini' ? <Sparkles size={18} className="text-forest" /> : <Cpu size={18} className="text-forest" />}
          {match ? `Matches: ${STREAMS[result.stream].label[lang]}` : `AI suggests: ${STREAMS[result.stream].label[lang]}`}
        </span>
        <span className="text-[15px] text-muted">{result.source === 'gemini' ? `Gemini Vision · ${result.ms} ms` : `On-device fallback · ${result.ms} ms`}</span>
      </div>
      {result.note && <p className="text-muted mt-1">{result.note}</p>}
      {result.fallbackReason && <p className="text-[15px] text-muted mt-1">{result.fallbackReason}, so the on-device check was used.</p>}
    </div>
  )
}
