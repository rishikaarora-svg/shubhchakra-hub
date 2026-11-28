import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, ClipboardCheck, MapPin, Minus, Plus, Printer, QrCode, RotateCcw, Send, Truck } from 'lucide-react'
import { nextBagId, useStore } from '../lib/store.jsx'
import { analyzeWasteImageWithAI, geminiTimeout, warmUpAI } from '../lib/gemini.js'
import { thumbnail } from '../lib/image.js'
import { BINS, STREAMS, STREAM_KEYS, destinationFor } from '../lib/streams.js'
import { Button, Card, CardTitle, DietMark, FoodList, Note, PageHeader, StatusPill, StreamBadge, Toggle } from '../components/ui.jsx'
import { AIPhoto, AIVerdict, CaptureButton } from '../components/Camera.jsx'
import { QRTag } from '../components/QR.jsx'

const BIN_ICONS = { crate: '🧺', drum: '🛢️', bin: '🗑️' }
const SAFETY = ['field.safety1', 'field.safety2', 'field.safety3', 'field.safety4']
const SAFETY_EN = ['Covered or sealed', 'Temperature controlled (>60°C or <5°C)', 'Cooked within 4 hours', 'No contamination']

export default function FieldLead({ go }) {
  const { state, dispatch, t, lang } = useStore()
  const [step, setStep] = useState(1)
  const [stream, setStream] = useState('food')
  const [photo, setPhoto] = useState(null)
  const [ai, setAi] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [bin, setBin] = useState(null)
  const [qty, setQty] = useState(1)
  const [safety, setSafety] = useState([false, false, false, false])
  const [bagId, setBagId] = useState(null)
  const [gps, setGps] = useState(null)
  const [foods, setFoods] = useState([])
  const shotRef = useRef(0)

  const bag = state.bags.find((b) => b.id === bagId)

  // Wake the AI server function while the coordinator is choosing a stream, so the first photo isn't slowed by a cold start.
  useEffect(() => { warmUpAI() }, [])

  if (!state.event.registered) {
    return (
      <>
        <PageHeader title={t('nav.field')} subtitle={t('field.subtitle')} />
        <Card className="max-w-xl mx-auto text-center">
          <ClipboardCheck size={40} strokeWidth={1.6} className="mx-auto text-forest" />
          <h2 className="text-2xl font-semibold text-ink mt-4">{t('field.registerFirst')}</h2>
          <p className="text-muted text-lg mt-2">SWM Rules 2026 require the venue to notify CPCB before waste leaves the site.</p>
          <Button size="lg" className="w-full mt-6" onClick={() => dispatch({ type: 'REGISTER_EVENT' })}>{t('venue.register')}</Button>
        </Card>
      </>
    )
  }

  const onCapture = async (dataUrl) => {
    setPhoto(dataUrl); setAi(null); setAnalyzing(true)
    navigator.geolocation?.getCurrentPosition((p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { timeout: 3000, maximumAge: 60000 })
    const shot = ++shotRef.current
    const applyFoods = (list) => { if (list?.length) setFoods((cur) => [...cur, ...list.filter((f) => !cur.some((c) => c.name.toLowerCase() === f.name.toLowerCase()))]) }
    const r = await analyzeWasteImageWithAI(dataUrl, stream, {
      // Gemini answered after the guardrail: swap in the real result and its dishes (if this is still the current photo)
      onLateResult: (late) => { if (shotRef.current === shot) { setAi(late); applyFoods(late.foods) } },
    })
    if (shotRef.current !== shot) return
    setAi(r); setAnalyzing(false)
    applyFoods(r.foods)
  }

  const reset = () => { shotRef.current++; setStep(1); setPhoto(null); setAi(null); setBin(null); setQty(1); setSafety([false, false, false, false]); setBagId(null); setGps(null); setFoods([]) }

  const createBag = async () => {
    const binDef = BINS.find((b) => b.key === bin)
    const thumb = photo && photo !== 'skipped' ? await thumbnail(photo) : null
    const id = nextBagId(state, stream)
    dispatch({
      type: 'CREATE_BAG',
      bag: {
        stream, bin, qty, declaredKg: binDef.kg * qty, photo: thumb, gps, foods: stream === 'food' ? foods : [],
        ai: ai ? { source: ai.source, confidence: ai.confidence, stream: ai.stream, sealIntact: ai.sealIntact, contamination: ai.contamination } : null,
        safetyCheck: stream === 'food' ? { passed: true, items: SAFETY_EN } : null,
      },
    })
    setBagId(id)
    setStep(3)
  }

  const step1Done = Boolean(ai) || photo === 'skipped'
  const step2Done = bin && (stream !== 'food' || (safety.every(Boolean) && foods.length > 0 && foods.every((f) => f.type !== 'unknown')))
  const steps = [t('field.s1'), t('field.s2'), t('field.s3')]

  return (
    <>
      <PageHeader title={t('nav.field')} subtitle={t('field.subtitle')} />
      <div className="max-w-2xl mx-auto space-y-5">
        {/* pinned guide */}
        <div className="sticky top-0 md:top-[69px] z-30 -mx-4 px-4 py-2 bg-canvas/95 backdrop-blur">
          <div className="bg-white border border-line rounded-3xl px-5 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted">{t('field.now')}</p>
              <p className="font-semibold text-forest">{t('field.step')} {step} {t('field.of')} 3</p>
            </div>
            <p className="text-xl font-semibold text-ink mt-1">{steps[step - 1]}</p>
            <div className="grid grid-cols-3 gap-2 mt-3" aria-hidden>
              {[1, 2, 3].map((i) => <div key={i} className={`h-2 rounded-full transition-colors ${i < step ? 'bg-mint' : i === step ? 'bg-forest' : 'bg-track'}`} />)}
            </div>
          </div>
        </div>

        {step === 1 && (
          <Card className="space-y-6">
            <div>
              <CardTitle title={t('field.pickStream')} className="mb-4" />
              <div className="grid grid-cols-2 gap-3">
                {STREAM_KEYS.map((k) => {
                  const on = stream === k
                  return (
                    <button key={k} onClick={() => { setStream(k); setAi(null); if (photo && photo !== 'skipped') setPhoto(null) }} aria-pressed={on}
                      className="min-h-24 rounded-2xl px-4 py-4 text-left border-2 transition-all"
                      style={{ borderColor: on ? STREAMS[k].color : '#E6E1D9', background: on ? STREAMS[k].soft : '#fff' }}>
                      <span className="flex items-center gap-2.5"><span className="size-4 rounded-full shrink-0" style={{ background: STREAMS[k].color }} /><span className="text-lg font-semibold text-ink leading-tight">{STREAMS[k].label[lang]}</span></span>
                      <span className="block text-muted mt-1.5 ml-[26px]">{STREAMS[k].tag} QR tag</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {photo && photo !== 'skipped' ? (
              <div className="space-y-4">
                <AIPhoto photo={photo} result={ai} analyzing={analyzing} />
                <AIVerdict result={ai} expected={stream} />
                {ai && ai.stream !== stream && (
                  <Button variant="outline" className="w-full" onClick={() => setStream(ai.stream)}>Switch to {STREAMS[ai.stream].label[lang]}</Button>
                )}
                <CaptureButton onCapture={onCapture} label={t('field.retake')} variant="outline" size="md" icon={RotateCcw} className="w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                <CaptureButton onCapture={onCapture} label={t('field.snap')} className="w-full" icon={Camera} />
                <p className="text-muted text-center">Gemini Vision checks the photo and names the food. If it takes longer than {geminiTimeout / 1000} seconds you can carry on, and the result fills in when it arrives.</p>
                <button className="w-full text-muted underline underline-offset-4 min-h-11" onClick={() => setPhoto('skipped')}>{t('field.skipPhoto')}</button>
              </div>
            )}
            {photo === 'skipped' && <Note tone="amber">No photo: this bag will be marked “unverified” in the audit trail.</Note>}

            <Button size="lg" className="w-full" icon={ArrowRight} disabled={!step1Done || analyzing} onClick={() => setStep(2)}>{t('field.next')}</Button>
          </Card>
        )}

        {step === 2 && (
          <Card className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StreamBadge stream={stream} />
              {gps && <span className="text-muted flex items-center gap-1.5"><MapPin size={16} /> Location recorded</span>}
            </div>
            <div>
              <CardTitle title={t('field.binSize')} className="mb-4" />
              <div className="grid grid-cols-3 gap-3">
                {BINS.map((b) => {
                  const on = bin === b.key
                  return (
                    <button key={b.key} onClick={() => setBin(b.key)} aria-pressed={on}
                      className={`rounded-2xl border-2 p-3 min-h-36 flex flex-col items-center justify-center text-center transition-all ${on ? 'border-forest bg-sage' : 'border-line bg-white hover:bg-[#FAF8F5]'}`}>
                      <span className="text-4xl" aria-hidden>{BIN_ICONS[b.key]}</span>
                      <span className="font-semibold text-ink mt-2 leading-tight">{b.label[lang]}</span>
                      <span className="text-lg font-bold text-forest">~{b.kg} kg</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-5 py-3">
              <span className="text-lg font-semibold text-ink">{t('field.count')}</span>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="w-12 !px-0" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={20} /></Button>
                <span className="text-3xl font-bold w-10 text-center">{qty}</span>
                <Button variant="outline" className="w-12 !px-0" aria-label="More" onClick={() => setQty((q) => Math.min(20, q + 1))}><Plus size={20} /></Button>
              </div>
            </div>
            {bin && <p className="text-center text-lg text-muted">Declared weight: <b className="text-ink text-2xl">{BINS.find((b) => b.key === bin).kg * qty} kg</b></p>}

            {stream === 'food' && (
              <div>
                <CardTitle title={t('field.foods')} subtitle={t('field.foodsHint')} className="mb-4" />
                <FoodEditor foods={foods} onChange={setFoods} />
              </div>
            )}

            {stream === 'food' && (
              <div>
                <CardTitle title={t('field.safety')} subtitle="All four must be true before food goes to the NGO." className="mb-4" />
                <div className="space-y-2.5">
                  {SAFETY.map((k, i) => <Toggle key={k} label={t(k)} color="#DC2626" checked={safety[i]} onChange={(v) => setSafety((a) => a.map((x, j) => (j === i ? v : x)))} />)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-3">
              <Button variant="outline" size="lg" icon={ArrowLeft} onClick={() => setStep(1)}>{t('field.back')}</Button>
              <Button size="lg" icon={QrCode} disabled={!step2Done} onClick={createBag}>{t('field.makeQr')}</Button>
            </div>
          </Card>
        )}

        {step === 3 && bag && (
          <Card className="space-y-5">
            <div className="max-w-xs mx-auto"><QRTag bag={bag} size={220} /></div>
            <p className="text-center text-muted">Scan with Google Lens or any phone camera. It opens the {bag.destination === 'ngo' ? 'NGO Partner' : 'Recovery Partner'} page for this bag.</p>
            {bag.status === 'tagged' ? (
              <div className="grid gap-3">
                <Button size="lg" icon={Truck} onClick={() => dispatch({ type: 'DISPATCH', id: bag.id })}>{t('field.dispatch')} to {destinationFor(bag).name}</Button>
                <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print tag</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Note>
                  <b className="block text-lg">✅ {t('field.dispatched')}</b>
                  {bag.stream === 'food' ? 'The 2-hour food rescue window has started. Control Tower is tracking it.' : 'The facility will weigh it and check it is within ±5%.'}
                </Note>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Button size="lg" icon={RotateCcw} onClick={reset}>{t('field.newBag')}</Button>
                  <Button size="lg" variant="outline" icon={Send} onClick={() => go(bag.destination === 'ngo' ? 'ngo' : 'recycler', { bagId: bag.id })}>Open {bag.destination === 'ngo' ? 'NGO' : 'Recovery'} page</Button>
                </div>
              </div>
            )}
          </Card>
        )}

        <Card>
          <CardTitle title="Bags tagged today" className="mb-2" />
          <ul>
            {state.bags.slice(0, 6).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3.5 border-b border-line last:border-0">
                <span className="font-semibold">{b.id}</span>
                <span className="flex items-center gap-3"><span className="text-muted">{b.declaredKg} kg</span><StatusPill status={b.status} /></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

/** Add / remove the dishes in a food rescue bag (pre-filled from the AI photo check). */
function FoodEditor({ foods, onChange }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('veg')
  const add = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n || foods.some((f) => f.name.toLowerCase() === n.toLowerCase())) return
    onChange([...foods, { name: n.charAt(0).toUpperCase() + n.slice(1), type }])
    setName('')
  }
  return (
    <div className="space-y-3">
      {foods.length ? (
        <>
          <FoodList foods={foods} onRemove={(i) => onChange(foods.filter((_, j) => j !== i))} onToggle={(i, type) => onChange(foods.map((f, j) => (j === i ? { ...f, type } : f)))} />
          {foods.some((f) => f.type === 'unknown') && <Note tone="amber">Tap the <b>?</b> to mark {foods.filter((f) => f.type === 'unknown').map((f) => f.name).join(', ')} as veg or non-veg.</Note>}
          <p className="text-[15px] text-muted">Check the names and veg / non-veg marks before dispatch. The AI can confuse similar-looking dishes, like paneer and chicken curries. Tap a mark to change it.</p>
        </>
      ) : <Note tone="amber">Add at least one dish. The NGO needs to know what food is coming.</Note>}
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a dish, e.g. Dal makhani" aria-label="Dish name"
          className="flex-1 min-w-48 min-h-12 px-4 rounded-2xl border border-line bg-white text-base focus:outline-2 focus:outline-mint" />
        <div className="flex rounded-2xl border border-line overflow-hidden" role="group" aria-label="Veg or non-veg">
          {[['veg', 'Veg'], ['non-veg', 'Non-veg']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
              className={`flex items-center gap-2 min-h-12 px-3.5 text-[15px] font-medium ${type === k ? 'bg-sage text-forest' : 'bg-white text-muted'}`}><DietMark type={k} />{l}</button>
          ))}
        </div>
        <Button type="submit" variant="outline" disabled={!name.trim()}>Add</Button>
      </form>
    </div>
  )
}
