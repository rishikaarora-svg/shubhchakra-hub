import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, Gauge, Inbox, RotateCcw, Scale } from 'lucide-react'
import { bagFromPayload, parseQrPayload, useStore } from '../lib/store.jsx'
import { STREAMS, VARIANCE_LIMIT, destinationFor } from '../lib/streams.js'
import { Button, Card, CardTitle, Empty, Note, PageHeader, StatusPill, StreamBadge, Table, timeStr } from '../components/ui.jsx'
import { CaptureButton } from '../components/Camera.jsx'
import { QRScanner } from '../components/QR.jsx'

export default function RecyclerGate({ params }) {
  const { state, dispatch, t, now } = useStore()
  const [selected, setSelected] = useState(params.bagId?.toUpperCase() || null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!params.bagId) return
    const p = parseQrPayload(window.location.href)
    if (p && !state.bags.some((b) => b.id === p.id)) dispatch({ type: 'IMPORT_BAG', bag: bagFromPayload({ ...p, role: 'recycler' }, now()) })
    setSelected(params.bagId.toUpperCase())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.bagId])

  const queue = state.bags.filter((b) => b.destination === 'recycler' && ['tagged', 'in_transit', 'arrived'].includes(b.status))
  const recent = state.bags.filter((b) => ['verified', 'flagged'].includes(b.status)).sort((a, b) => b.closedAt - a.closedAt).slice(0, 8)
  const bag = state.bags.find((b) => b.id === selected)

  const onScan = useCallback((p) => {
    const found = state.bags.find((b) => b.id === p.id)
    if (!found) { dispatch({ type: 'IMPORT_BAG', bag: bagFromPayload({ ...p, role: 'recycler' }, now()) }); setSelected(p.id); setMsg(null); return }
    if (found.destination === 'ngo') { setMsg(`${p.id} is a food rescue bag for the NGO, so it can't be accepted here.`); return }
    if (found.status === 'in_transit' || found.status === 'tagged') dispatch({ type: 'ARRIVE', id: found.id })
    setSelected(found.id); setMsg(null)
  }, [state.bags, dispatch, now])

  return (
    <>
      <PageHeader title={t('nav.recycler')} subtitle={t('rec.subtitle')} />

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardTitle title={t('rec.scan')} subtitle="Green, blue, purple, or red tags sent to compost" />
            <QRScanner onResult={onScan} accent="#2563EB" hint={t('rec.scan')} />
            {msg && <Note tone="amber" className="mt-4">{msg}</Note>}
          </Card>
          <Card>
            <CardTitle title={t('rec.queue')} subtitle={`${queue.length} bag${queue.length === 1 ? '' : 's'}`} className="mb-3" />
            {queue.length === 0 && <Empty icon={Inbox}>Nothing expected right now.</Empty>}
            <ul className="space-y-2">
              {queue.map((b) => (
                <li key={b.id}>
                  <button onClick={() => { if (b.status !== 'arrived') dispatch({ type: 'ARRIVE', id: b.id }); setSelected(b.id) }}
                    className={`w-full text-left rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 border transition-colors ${selected === b.id ? 'border-forest bg-sage' : 'border-line hover:bg-[#FAF8F5]'}`}>
                    <span className="space-y-1.5"><span className="block text-lg font-semibold">{b.id}</span><StreamBadge stream={b.stream} rerouted={b.rerouted} /></span>
                    <span className="text-right space-y-1.5"><span className="block font-semibold">{b.declaredKg} kg</span><StatusPill status={b.status} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {bag ? <IntakePanel key={bag.id} bag={bag} onDone={() => setSelected(null)} /> : (
            <Card className="h-full grid place-items-center"><Empty icon={Scale}>Scan a QR tag or pick a bag from the list to check it in.</Empty></Card>
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <Card className="mt-6">
          <CardTitle title="Recent check-ins" className="mb-3" />
          <Table head={['Bag', 'Stream', 'Declared', 'Weighbridge', 'Difference', 'Status']} minWidth={760}>
            {recent.map((b) => (
              <tr key={b.id}>
                <td className="font-semibold whitespace-nowrap">{b.id}</td>
                <td><StreamBadge stream={b.stream} rerouted={b.rerouted} /></td>
                <td className="tabular-nums">{b.declaredKg} kg</td>
                <td className="tabular-nums">{b.facilityKg} kg</td>
                <td className={`tabular-nums ${b.status === 'flagged' ? 'text-[#B91C1C] font-semibold' : ''}`}>{b.variance != null ? `${b.variance > 0 ? '+' : ''}${(b.variance * 100).toFixed(1)}%` : '—'}</td>
                <td><StatusPill status={b.status} /></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  )
}

function IntakePanel({ bag, onDone }) {
  const { dispatch, t } = useStore()
  const [photo, setPhoto] = useState(bag.arrivalPhoto || null)
  const [kg, setKg] = useState(bag.facilityKg ?? '')
  const s = STREAMS[bag.stream]
  const mass = Number(kg)
  const variance = mass > 0 ? (mass - bag.declaredKg) / bag.declaredKg : null
  const ok = variance != null && Math.abs(variance) <= VARIANCE_LIMIT
  const closed = ['verified', 'flagged'].includes(bag.status)
  const lo = (bag.declaredKg * (1 - VARIANCE_LIMIT)).toFixed(1), hi = (bag.declaredKg * (1 + VARIANCE_LIMIT)).toFixed(1)

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-6 sm:px-8 py-4 text-white flex items-center justify-between gap-3" style={{ background: s.color }}>
        <span className="text-lg font-semibold">{t('rec.title')}</span>
        <span className="text-xl font-bold">{bag.id}</span>
      </div>
      <div className="p-5 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <StreamBadge stream={bag.stream} rerouted={bag.rerouted} />
          <StatusPill status={bag.status} />
          <span className="text-muted">→ {destinationFor(bag).name}</span>
        </div>
        {bag.rerouted && <Note tone="red"><RotateCcw size={18} className="inline -mt-1 mr-1.5" />Red tag sent to compost: {bag.rerouteReason}.</Note>}

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-line p-4"><div className="text-muted">Declared</div><div className="text-2xl font-bold mt-1">{bag.declaredKg} kg</div></div>
          <div className="rounded-2xl border border-line p-4"><div className="text-muted">Accepted range</div><div className="text-lg font-bold mt-1.5">{lo}–{hi}</div></div>
          <div className="rounded-2xl border border-line p-4"><div className="text-muted">Tagged at</div><div className="text-lg font-bold mt-1.5">{timeStr(bag.createdAt)}</div></div>
        </div>

        <div>
          <p className="text-lg font-semibold text-ink mb-3">1. {t('rec.photo')}</p>
          {photo ? (
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-[#EEEBE5]">
              <img src={photo} alt="Arrival proof" className="size-full object-cover" />
              <span className="absolute top-3 left-3 bg-white/95 text-forest font-semibold px-3 py-1.5 rounded-lg">✓ Arrival photo</span>
              {!closed && <CaptureButton size="sm" maxSide={480} variant="outline" icon={Camera} label="Retake" className="absolute bottom-3 right-3" onCapture={setPhoto} />}
            </div>
          ) : <CaptureButton size="md" maxSide={480} variant="outline" icon={Camera} label={t('rec.photo')} className="w-full" onCapture={setPhoto} />}
        </div>

        <div>
          <label htmlFor="kg" className="block text-lg font-semibold text-ink mb-3">2. {t('rec.weigh')}</label>
          <div className="flex gap-3">
            <input id="kg" type="number" inputMode="decimal" min="0" step="0.1" value={kg} disabled={closed} onChange={(e) => setKg(e.target.value)} placeholder="0.0"
              className="flex-1 min-w-0 min-h-14 px-5 rounded-2xl border border-line text-2xl font-bold focus:outline-2 focus:outline-mint disabled:bg-[#FAF8F5]" />
            {!closed && <Button variant="outline" size="lg" icon={Gauge} onClick={() => setKg((bag.declaredKg * (0.97 + Math.random() * 0.05)).toFixed(1))}>Read scale</Button>}
          </div>
          {variance != null && (
            <p className={`mt-3 font-semibold flex items-center gap-2 ${ok ? 'text-forest' : 'text-[#B91C1C]'}`}>
              {ok ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
              {(variance * 100).toFixed(1)}% difference, {ok ? 'within the ±5% limit' : 'outside ±5%: will be flagged for audit'}
            </p>
          )}
        </div>

        {closed ? (
          <Note tone={bag.status === 'verified' ? 'sage' : 'red'} className="flex flex-wrap items-center gap-3">
            <span className="flex-1 font-semibold">{bag.status === 'verified' ? '✅ Accepted. Chain of custody closed.' : '⚠️ Flagged. Control Tower has been notified.'}</span>
            <Button variant="outline" size="sm" onClick={onDone}>Next bag</Button>
          </Note>
        ) : (
          <Button size="lg" className="w-full" icon={Scale} disabled={!(mass > 0)} onClick={() => dispatch({ type: 'GATE_VERIFY', id: bag.id, facilityKg: Math.round(mass * 10) / 10, photo })}>{t('rec.verify')}</Button>
        )}
      </div>
    </Card>
  )
}
