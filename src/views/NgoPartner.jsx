import { useCallback, useEffect, useState } from 'react'
import { BellRing, Camera, CheckCircle2, MessageCircle, Navigation, Truck, Undo2, UtensilsCrossed } from 'lucide-react'
import { bagFromPayload, parseQrPayload, useStore } from '../lib/store.jsx'
import { KG_PER_MEAL, PARTNERS, TRANSIT_MS } from '../lib/streams.js'
import { Button, Card, CardTitle, Empty, GroupedFoodList, Note, PageHeader, SlaTimer, StatusPill, dietSummary, foodNames, timeStr, useNow } from '../components/ui.jsx'
import { CaptureButton } from '../components/Camera.jsx'
import { QRScanner } from '../components/QR.jsx'

const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('Chokhi Dhani, Tonk Road, Jaipur')}&destination=${encodeURIComponent('Malviya Nagar, Jaipur')}&travelmode=driving`

export default function NgoPartner({ params }) {
  const { state, dispatch, t, now } = useStore()
  const [focus, setFocus] = useState(params.bagId?.toUpperCase() || null)
  const [msg, setMsg] = useState(null)

  // Deep link (?role=ngo&bagId=…): rebuild the bag from the QR payload if this device has never seen it.
  useEffect(() => {
    if (!params.bagId) return
    const p = parseQrPayload(window.location.href)
    if (p && !state.bags.some((b) => b.id === p.id)) dispatch({ type: 'IMPORT_BAG', bag: bagFromPayload({ ...p, role: 'ngo' }, now()) })
    setFocus(params.bagId.toUpperCase())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.bagId])

  const mine = state.bags.filter((b) => b.stream === 'food' && (b.destination === 'ngo' || b.rerouted))
  const incoming = mine.filter((b) => b.destination === 'ngo' && ['tagged', 'in_transit', 'arrived'].includes(b.status))
    .sort((a, b) => (b.id === focus) - (a.id === focus))
  const proofReqs = mine.filter((b) => b.proof?.requestedAt && !b.proof.fulfilledAt)
  const done = mine.filter((b) => b.status === 'accepted' || b.rerouted).sort((a, b) => (b.closedAt || b.dispatchedAt) - (a.closedAt || a.dispatchedAt))

  const onScan = useCallback((p) => {
    const bag = state.bags.find((b) => b.id === p.id)
    if (!bag) { dispatch({ type: 'IMPORT_BAG', bag: bagFromPayload({ ...p, role: 'ngo' }, now()) }); setFocus(p.id); setMsg(`${p.id} loaded from QR code`); return }
    if (bag.stream !== 'food') { setMsg(`${p.id} is not a red food tag. It belongs at the Recovery Partner gate.`); return }
    if (bag.status === 'in_transit' || bag.status === 'tagged') dispatch({ type: 'ARRIVE', id: bag.id })
    setFocus(bag.id); setMsg(`${bag.id} scanned ✓`)
  }, [state.bags, dispatch, now])

  return (
    <>
      <PageHeader title={t('nav.ngo')} subtitle={`${PARTNERS.ngo.name}, ${PARTNERS.ngo.area}`} />

      {proofReqs.map((b) => (
        <div key={b.id} className="rounded-3xl border-2 border-[#F5C77E] bg-[#FEF5E6] p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4 animate-fadein">
          <BellRing size={28} className="text-[#B45309] shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-lg font-semibold text-[#7C4A03]">{t('ngo.proofReq')}</p>
            <p className="text-[#7C4A03]/85">Bag <b>{b.id}</b>, requested at {timeStr(b.proof.requestedAt)}. Take a photo of the bag with your vehicle or kitchen visible.</p>
          </div>
          <CaptureButton size="md" maxSide={360} icon={Camera} label={t('ngo.sendProof')} onCapture={(photo) => dispatch({ type: 'FULFILL_PROOF', id: b.id, photo })} />
        </div>
      ))}

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardTitle title={t('ngo.title')} subtitle="Red-tagged surplus food heading to you" />
          <div className="space-y-4">
            {incoming.length === 0 && <Empty icon={UtensilsCrossed}>{t('ngo.none')}</Empty>}
            {incoming.map((b) => <IncomingCard key={b.id} bag={b} focused={focus === b.id} />)}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardTitle title={t('ngo.scan')} subtitle="Scanning marks the bag as arrived" />
            <QRScanner onResult={onScan} accent="#DC2626" hint={t('ngo.scan')} />
            {msg && <p className="font-semibold text-forest mt-3">{msg}</p>}
          </Card>
          {done[0] && <WhatsAppReceipt bag={done[0]} />}
        </div>
      </div>

      {done.length > 0 && (
        <Card className="mt-6">
          <CardTitle title="Completed handovers" className="mb-2" />
          <ul>
            {done.map((b) => (
              <li key={b.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-line last:border-0">
                <span className="font-semibold">{b.id}</span>
                <span className="text-muted flex-1 min-w-40">{b.rerouted ? `Sent to compost: ${b.rerouteReason}` : `${b.foods?.length ? `${foodNames(b.foods)} · ` : ''}${b.declaredKg} kg, about ${Math.round(b.declaredKg / KG_PER_MEAL)} meals`}</span>
                <StatusPill status={b.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function IncomingCard({ bag, focused }) {
  const { dispatch, t, state } = useStore()
  const n = useNow()
  const progress = bag.status === 'arrived' ? 1 : bag.dispatchedAt ? Math.min(0.95, (n - bag.dispatchedAt) / TRANSIT_MS) : 0
  const stages = ['Packed', 'On the road', 'Arrived', 'Handed over']
  const idx = bag.status === 'tagged' ? 0 : bag.status === 'in_transit' ? 1 : 2
  const eta = bag.dispatchedAt ? Math.max(0, Math.ceil((bag.dispatchedAt + TRANSIT_MS - n) / 60000)) : null
  return (
    <article className={`rounded-2xl border-2 p-5 transition-shadow ${focused ? 'border-crimson shadow-[0_0_0_4px_rgba(220,38,38,0.10)]' : 'border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-ink">{bag.id}</p>
          <p className="text-muted mt-0.5">{bag.declaredKg} kg · about {Math.round(bag.declaredKg / KG_PER_MEAL)} meals · from {state.event.venue.split(',')[0]}</p>
        </div>
        {bag.slaDeadline ? <SlaTimer deadline={bag.slaDeadline} /> : <StatusPill status={bag.status} />}
      </div>

      {bag.foods?.length > 0
        ? <div className="mt-4"><p className="font-semibold text-ink mb-2">Food in this bag: {bag.foods.length} item{bag.foods.length === 1 ? '' : 's'}{dietSummary(bag.foods) && <span className="font-normal text-muted"> · {dietSummary(bag.foods)}</span>}</p><GroupedFoodList foods={bag.foods} /></div>
        : <p className="text-muted mt-4">Food items not recorded for this bag.</p>}

      <div className="mt-6">
        <div className="relative h-2.5 rounded-full bg-track">
          <div className="absolute inset-y-0 left-0 rounded-full bg-crimson transition-all duration-1000" style={{ width: `${progress * 100}%` }} />
          <Truck size={24} className="absolute -top-2.5 text-crimson transition-all duration-1000 bg-white rounded" style={{ left: `calc(${progress * 100}% - 12px)` }} />
        </div>
        <ol className="grid grid-cols-4 mt-3 text-[15px]">
          {stages.map((s, i) => <li key={s} className={`${i <= idx ? 'text-ink font-medium' : 'text-[#A8A29E]'} ${i === 3 ? 'text-right' : i > 0 ? 'text-center' : ''}`}>{s}</li>)}
        </ol>
        {bag.status === 'in_transit' && <p className="text-muted mt-2">Arriving in about {eta} min</p>}
      </div>

      <div className="grid xl:grid-cols-2 gap-3 mt-5">
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2.5 min-h-12 rounded-2xl border border-line bg-white font-semibold hover:bg-[#FAF8F5]"><Navigation size={19} /> {t('ngo.route')}</a>
        {bag.proof?.fulfilledAt
          ? <span className="inline-flex items-center justify-center gap-2 min-h-12 rounded-2xl bg-sage text-forest font-semibold"><CheckCircle2 size={18} /> Photo sent at {timeStr(bag.proof.fulfilledAt)}</span>
          : null}
      </div>
      <div className="grid gap-3 mt-3">
        <Button size="lg" icon={CheckCircle2} disabled={bag.status !== 'arrived'} onClick={() => dispatch({ type: 'NGO_ACCEPT', id: bag.id })}>{t('ngo.accept')}</Button>
        <Button size="lg" variant="danger" icon={Undo2} disabled={bag.status === 'tagged'} onClick={() => dispatch({ type: 'REROUTE', id: bag.id, reason: 'NGO rejected the batch' })}>{t('ngo.reject')}</Button>
      </div>
      {bag.status !== 'arrived' && <p className="text-muted mt-3">{bag.status === 'tagged' ? 'Waiting for the venue to dispatch this bag.' : 'Scan the red QR tag when the vehicle arrives to unlock pickup.'}</p>}
    </article>
  )
}

function WhatsAppReceipt({ bag }) {
  const { t, state } = useStore()
  const meals = Math.round(bag.declaredKg / KG_PER_MEAL)
  const text = bag.rerouted
    ? `ShubhChakra Hub ♻️\nBatch ${bag.id} (${bag.declaredKg} kg) was sent to ${PARTNERS.compost.name} for composting.\nReason: ${bag.rerouteReason}.\nCompliance record intact.`
    : `ShubhChakra Hub ✅ Handover proof\nBag: ${bag.id}\nFrom: ${state.event.venue}\nTo: ${PARTNERS.ngo.name}\n${bag.foods?.length ? `Food: ${foodNames(bag.foods)}${dietSummary(bag.foods) ? ` (${dietSummary(bag.foods).toLowerCase()})` : ''}\n` : ''}Quantity: ${bag.declaredKg} kg (about ${meals} meals)\nTime: ${bag.closedAt ? new Date(bag.closedAt).toLocaleString('en-IN') : ''}\nFood safety check: passed\nResponsibility closed under SWM Rules 2026.`
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="bg-[#075E54] text-white px-6 py-4 flex items-center gap-2.5"><MessageCircle size={20} /><span className="text-lg font-semibold">{t('ngo.receipt')}</span></div>
      <div className="p-5 bg-[#ECE5DD]">
        <div className="ml-auto max-w-[94%] bg-[#DCF8C6] rounded-2xl rounded-tr-none p-4 shadow-sm">
          <pre className="whitespace-pre-wrap font-sans text-base text-ink leading-relaxed">{text}</pre>
          <p className="text-right text-sm text-[#667781] mt-1">{bag.closedAt ? timeStr(bag.closedAt) : ''} ✓✓</p>
        </div>
      </div>
      <div className="p-5">
        <a className="inline-flex w-full items-center justify-center gap-2.5 min-h-12 rounded-2xl bg-[#25D366] text-white font-semibold" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}><MessageCircle size={19} /> Share on WhatsApp</a>
      </div>
    </Card>
  )
}
