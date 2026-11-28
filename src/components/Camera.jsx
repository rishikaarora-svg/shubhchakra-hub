import { useEffect, useRef, useState } from 'react'
import { Camera, Cpu, ImageUp, RefreshCw, ScanEye, Sparkles, SwitchCamera, X } from 'lucide-react'
import { downscale, fileToDataUrl } from '../lib/image.js'
import { geminiTimeout, warmUpAI } from '../lib/gemini.js'
import { STREAMS } from '../lib/streams.js'
import { useStore } from '../lib/store.jsx'
import { Button, FoodList, dietSummary } from './ui.jsx'

const canUseLiveCamera = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext

/**
 * Photo button. Opens a live in-app camera (laptop webcam or phone camera) with a shutter button.
 * Falls back to the device's own camera / file picker when live camera access isn't available.
 */
export function CaptureButton({ onCapture, label, variant = 'primary', size = 'lg', icon = Camera, className = '', maxSide = 768 }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const quality = maxSide < 768 ? 0.65 : 0.8
  const pickFile = () => fileRef.current?.click()
  return (
    <>
      <input
        ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setBusy(true)
          try { onCapture(await fileToDataUrl(f, maxSide, quality)) } finally { setBusy(false) }
        }}
      />
      <Button variant={variant} size={size} icon={busy ? RefreshCw : icon} className={className} disabled={busy}
        onClick={() => { warmUpAI(); if (canUseLiveCamera()) setOpen(true); else pickFile() }}>{label}</Button>
      {open && (
        <LiveCamera
          maxSide={maxSide} quality={quality}
          onCapture={(d) => { setOpen(false); onCapture(d) }}
          onClose={() => setOpen(false)}
          onUpload={() => { setOpen(false); pickFile() }}
        />
      )}
    </>
  )
}

/** Full-screen viewfinder using getUserMedia, rear camera preferred. */
function LiveCamera({ onCapture, onClose, onUpload, maxSide, quality }) {
  const videoRef = useRef(null)
  const [facing, setFacing] = useState('environment')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [multiCam, setMultiCam] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let stream, cancelled = false
    setReady(false); setError(null)
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return }
        const v = videoRef.current
        v.srcObject = stream
        await v.play()
        setReady(true)
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        setMultiCam(devices.filter((d) => d.kind === 'videoinput').length > 1)
      } catch (e) {
        if (cancelled) return
        setError(e?.name === 'NotAllowedError'
          ? 'Camera permission was blocked. Allow camera access in your browser’s address bar, or upload a photo instead.'
          : e?.name === 'NotFoundError' ? 'No camera was found on this device. Upload a photo instead.'
          : 'The camera could not be started. It may be in use by another app. Upload a photo instead.')
      }
    })()
    return () => { cancelled = true; stream?.getTracks().forEach((tr) => tr.stop()) }
  }, [facing])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const shoot = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    setFlash(true)
    navigator.vibrate?.(40)
    const data = downscale(v, maxSide, quality)
    setTimeout(() => onCapture(data), 120)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Take a photo">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 text-white">
        <span className="text-lg font-semibold">Take a photo</span>
        <button onClick={onClose} className="grid place-items-center size-12 rounded-full hover:bg-white/10" aria-label="Close camera"><X size={26} /></button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay
          className={`max-h-full max-w-full object-contain ${facing === 'user' ? '-scale-x-100' : ''} ${ready ? '' : 'opacity-0'}`} />
        {!ready && !error && <p className="absolute text-white/80 text-lg">Starting camera…</p>}
        {error && (
          <div className="absolute inset-x-6 max-w-md mx-auto text-center text-white space-y-5">
            <p className="text-lg leading-relaxed">{error}</p>
            <Button size="lg" icon={ImageUp} onClick={onUpload}>Upload a photo</Button>
          </div>
        )}
        {flash && <div className="absolute inset-0 bg-white animate-fadein" />}
      </div>

      <div className="grid grid-cols-3 items-center px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button onClick={onUpload} className="justify-self-start flex flex-col items-center gap-1 text-white/90 text-sm min-h-12 px-2" aria-label="Upload a photo instead">
          <ImageUp size={26} />Upload
        </button>
        <button onClick={shoot} disabled={!ready} aria-label="Take photo"
          className="justify-self-center size-20 rounded-full border-4 border-white grid place-items-center disabled:opacity-40 active:scale-95 transition-transform">
          <span className="size-[62px] rounded-full bg-white" />
        </button>
        {multiCam ? (
          <button onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} className="justify-self-end flex flex-col items-center gap-1 text-white/90 text-sm min-h-12 px-2" aria-label="Switch camera">
            <SwitchCamera size={26} />Flip
          </button>
        ) : <span />}
      </div>
    </div>
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
      {result.foods?.length > 0 && (
        <div className="mt-3">
          <p className="font-semibold text-ink">Food identified{dietSummary(result.foods) && <span className="font-normal text-muted"> · {dietSummary(result.foods)}</span>}</p>
          <FoodList foods={result.foods} className="mt-2" />
        </div>
      )}
      {result.fallbackReason && <p className="text-[15px] text-muted mt-1">{result.fallbackReason}, so the on-device check was used.</p>}
      {result.liveStillRunning && (
        <p className="text-[15px] text-forest mt-2 flex items-center gap-2"><RefreshCw size={15} className="animate-spin shrink-0" />{expected === 'food' ? 'Gemini is still identifying the food. Dishes will appear here in a few seconds.' : 'Gemini is still checking. The result will update in a few seconds.'}</p>
      )}
      {result.late && <p className="text-[15px] text-muted mt-1">Gemini answered after the {Math.round(geminiTimeout / 1000)} s limit, so this result replaced the on-device check.</p>}
    </div>
  )
}
