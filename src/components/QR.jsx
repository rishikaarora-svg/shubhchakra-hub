import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import jsQR from 'jsqr'
import { CameraOff, Keyboard, ScanLine } from 'lucide-react'
import { STREAMS, destinationFor } from '../lib/streams.js'
import { bagQrUrl, parseQrPayload, useStore } from '../lib/store.jsx'
import { Button } from './ui.jsx'

/**
 * Scannable colour QR tag. The matrix sits alone in a pure-white quiet-zone box —
 * nothing overlaps it (no countdown rings, no badges), so Google Lens / native cameras read it instantly.
 */
export function QRTag({ bag, size = 200 }) {
  const { lang } = useStore()
  const s = STREAMS[bag.stream]
  return (
    <div className="rounded-2xl overflow-hidden border-2 print-tag" style={{ borderColor: s.color }}>
      <div className="px-5 py-3 text-white flex items-center justify-between gap-2" style={{ background: s.color }}>
        <span className="font-semibold text-base">{s.tag} tag · {s.label[lang]}</span>
        <span className="font-semibold text-base">{bag.declaredKg} kg</span>
      </div>
      <div className="bg-white p-5 flex flex-col items-center gap-3">
        <div className="bg-white p-3 rounded-lg ring-1 ring-line">
          <QRCodeSVG value={bagQrUrl(bag)} size={size} fgColor={s.qr} bgColor="#FFFFFF" level="M" marginSize={2} title={`QR tag ${bag.id}`} />
        </div>
        <div className="text-center">
          <div className="font-bold text-2xl text-ink tracking-wide">{bag.id}</div>
          <div className="text-base text-muted">→ {destinationFor(bag).name}</div>
          {bag.foods?.length > 0 && <div className="text-[15px] text-ink mt-1">{bag.foods.map((f) => f.name).join(', ')}</div>}
        </div>
      </div>
    </div>
  )
}

/** Live camera QR scanner (jsQR on video frames) with manual-ID fallback. */
export function QRScanner({ onResult, accent = '#1B4D3E', hint }) {
  const { t } = useStore()
  const videoRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState(null)
  const [manual, setManual] = useState('')
  const cb = useRef(onResult)
  cb.current = onResult

  useEffect(() => {
    if (!active) return
    let stream, raf, stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) return
        const v = videoRef.current
        v.srcObject = stream
        await v.play()
        const loop = () => {
          if (stopped) return
          if (v.readyState >= 2) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight
            ctx.drawImage(v, 0, 0)
            const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
            const parsed = code && parseQrPayload(code.data)
            if (parsed) { navigator.vibrate?.(80); setActive(false); cb.current(parsed); return }
          }
          raf = requestAnimationFrame(loop)
        }
        loop()
      } catch (e) {
        setError(e?.name === 'NotAllowedError' ? 'Camera permission denied' : 'Camera not available on this device')
        setActive(false)
      }
    })()
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((tr) => tr.stop()) }
  }, [active])

  const submitManual = (e) => {
    e.preventDefault()
    const p = parseQrPayload(manual)
    if (p) { onResult(p); setManual('') } else setError('That does not look like a ShubhChakra bag ID (for example FR-1042)')
  }

  return (
    <div className="space-y-4">
      {active ? (
        <div className="relative rounded-2xl overflow-hidden bg-[#1C1F23] aspect-[4/3]">
          <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-[18%] rounded-2xl border-[3px]" style={{ borderColor: accent }} />
          <div className="absolute inset-x-[18%] h-0.5 bg-white/90 animate-scan" />
          <Button variant="outline" size="sm" className="absolute bottom-3 right-3" onClick={() => setActive(false)} icon={CameraOff}>Stop</Button>
        </div>
      ) : (
        <Button size="lg" className="w-full" icon={ScanLine} style={{ background: accent }} onClick={() => { setError(null); setActive(true) }}>{hint}</Button>
      )}
      {error && <p className="text-base text-[#B91C1C]">{error}</p>}
      <form onSubmit={submitManual} className="flex gap-2">
        <label className="relative flex-1">
          <Keyboard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t('common.manual')} className="w-full min-h-12 pl-11 pr-3 rounded-2xl border border-line bg-white text-base uppercase placeholder:normal-case focus:outline-2 focus:outline-mint" />
        </label>
        <Button variant="outline" type="submit">{t('common.open')}</Button>
      </form>
    </div>
  )
}
