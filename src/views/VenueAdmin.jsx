import { useState } from 'react'
import { Award, ClipboardCheck, FileJson, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { useStore } from '../lib/store.jsx'
import { MENUS, STREAMS, STREAM_KEYS, VENUE, destinationFor, fmtINR, fmtKg } from '../lib/streams.js'
import { AnimatedNumber, Button, Card, CardTitle, KeyValue, Note, PageHeader, Stat } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'

const INPUT = 'w-full min-h-12 px-4 rounded-2xl border border-line bg-white text-base text-ink focus:outline-2 focus:outline-mint disabled:bg-[#FAF8F5]'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-muted mb-1.5">{label}</span>
      {children}
    </label>
  )
}

const menuLabel = (key) => MENUS.find((x) => x.key === key)?.label || key

export default function VenueAdmin() {
  const { state, dispatch, metrics: m, t, lang } = useStore()
  const { event } = state
  const [certOpen, setCertOpen] = useState(false)
  const fill = ((event.guests - 100) / 1900) * 100
  const set = (patch) => dispatch({ type: 'SET_EVENT', patch })

  return (
    <>
      <PageHeader title={t('nav.venue')} subtitle={event.venue}
        action={<Button size="lg" icon={FileText} onClick={() => setCertOpen(true)}>{t('venue.cert')}</Button>} />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle title={t('venue.reg')} subtitle={event.registered ? 'Details are locked once the CPCB event ID is created.' : 'The waste estimate updates from guest count and menu.'} className="mb-6" />
          <fieldset disabled={event.registered} className="space-y-5 disabled:opacity-80">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Venue"><input className={INPUT} value={event.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="Venue name" /></Field>
              <Field label="Event title"><input className={INPUT} value={event.name} onChange={(e) => set({ name: e.target.value })} placeholder="Event title" /></Field>
            </div>

            <div>
              <div className="flex items-end justify-between gap-3">
                <label htmlFor="guests" className="text-lg font-semibold text-ink">{t('venue.guests')}</label>
                <span className="text-4xl font-bold text-forest tracking-tight">{event.guests}</span>
              </div>
              <input id="guests" type="range" className="range mt-2" min={100} max={2000} step={50} value={event.guests}
                style={{ '--fill': `${fill}%` }} onChange={(e) => set({ guests: Number(e.target.value) })} />
              <div className="flex justify-between text-[15px] text-muted"><span>100</span><span>2,000</span></div>
            </div>

            <Field label="Menu">
              <select className={INPUT} value={event.menu} onChange={(e) => set({ menu: e.target.value })}>
                {MENUS.map((mn) => <option key={mn.key} value={mn.key}>{mn.label}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Starts"><input type="time" className={INPUT} value={event.start} onChange={(e) => set({ start: e.target.value })} /></Field>
              <Field label="Ends"><input type="time" className={INPUT} value={event.end} onChange={(e) => set({ end: e.target.value })} /></Field>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-2xl border border-line px-5 py-4 cursor-pointer">
              <span>
                <span className="block font-semibold text-ink">Auto-submit 3-day municipal event intimation</span>
                <span className="block text-muted text-[15px] mt-0.5">Applies to events over 100 guests. Filed to the CPCB portal with the event ID.</span>
              </span>
              <input type="checkbox" className="sr-only peer" checked={event.autoIntimation} onChange={(e) => set({ autoIntimation: e.target.checked })} />
              <span aria-hidden className="relative shrink-0 w-14 h-8 rounded-full bg-[#D6D1C8] peer-checked:bg-forest transition-colors after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-6 peer-focus-visible:outline-2 peer-focus-visible:outline-mint" />
            </label>
          </fieldset>

          <div className="flex items-baseline justify-between mt-6 mb-3">
            <p className="text-muted">{t('venue.estimate')}</p>
            <p className="font-semibold text-ink">{m.targetTotal} kg total</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {STREAM_KEYS.map((k) => (
              <div key={k} className="rounded-xl border-l-4 px-4 sm:px-5 py-4" style={{ background: STREAMS[k].soft, borderColor: STREAMS[k].color }}>
                <div className="text-[26px] font-bold text-ink leading-tight">{m.targets[k]} kg</div>
                <div className="text-muted mt-1">{STREAMS[k].label[lang]}</div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            {event.registered ? (
              <Note>✅ {t('venue.registered')} <b className="font-mono font-bold break-all">{event.cpcbId}</b></Note>
            ) : (
              <Button size="lg" className="w-full" icon={ClipboardCheck} disabled={!event.venue.trim() || !event.name.trim()} onClick={() => dispatch({ type: 'REGISTER_EVENT' })}>{t('venue.register')}</Button>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle title={t('venue.impact')} className="mb-1" />
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <span className="text-6xl sm:text-7xl font-bold text-forest tracking-tight"><AnimatedNumber value={m.pct} decimals={1} suffix="%" /></span>
            <span className="text-lg text-muted pb-2"><b className="text-ink font-semibold">{fmtKg(m.diverted)}</b> / {fmtKg(m.base)} {t('venue.diverted')}</span>
          </div>
          <div className="h-4 rounded-full bg-track overflow-hidden mt-4" role="img" aria-label={`${m.pct.toFixed(1)}% of waste diverted from landfill`}>
            <div className="h-full rounded-full bg-gradient-to-r from-forest to-mint transition-all duration-700" style={{ width: `${Math.min(100, m.pct)}%` }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <Stat value={<AnimatedNumber value={m.meals} />} label={t('venue.meals')} />
            <Stat value={<AnimatedNumber value={m.co2} decimals={1} suffix=" kg" />} label={t('venue.co2')} />
            <Stat value={<AnimatedNumber value={m.ecAvoided} prefix="₹" />} label={t('venue.fine')} />
          </div>
          <p className="text-muted mt-5">{t('venue.countNote')}</p>
        </Card>
      </div>

      <Modal open={certOpen} onClose={() => setCertOpen(false)} title="EBWGR & CPCB return package" wide>
        <CertificatePackage />
      </Modal>
    </>
  )
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function buildReturn(state, m) {
  return {
    schema: 'EBWGR-CPCB-Return/2026.1',
    generatedAt: new Date().toISOString(),
    generator: { name: state.event.venue, ward: VENUE.ward, category: 'Bulk Waste Generator (>100 kg/day)', city: 'Jaipur', state: 'Rajasthan' },
    event: { name: state.event.name, guests: state.event.guests, menu: menuLabel(state.event.menu), start: state.event.start, end: state.event.end, municipalIntimation: state.event.autoIntimation, cpcbIntimationId: state.event.cpcbId },
    totals: { divertedKg: Number(m.diverted.toFixed(1)), baselineKg: Number(m.base.toFixed(1)), diversionPct: Number(m.pct.toFixed(1)), foodRescuedKg: m.rescuedFood, mealsRescued: m.meals, co2eSavedKg: m.co2, ecPenaltyAvoidedINR: m.ecAvoided },
    streams: Object.fromEntries(STREAM_KEYS.map((k) => [STREAMS[k].label.en, { kg: Number(m.byStream[k].toFixed(1)) }])),
    custodyChain: state.bags.map((b) => ({
      bagId: b.id, stream: STREAMS[b.stream].label.en, foods: (b.foods || []).map((f) => `${f.name} (${f.type})`), rerouted: Boolean(b.rerouted), declaredKg: b.declaredKg, facilityKg: b.facilityKg ?? null,
      variancePct: b.variance != null ? Number((b.variance * 100).toFixed(2)) : null, status: b.status, handler: destinationFor(b).name,
      events: b.history.map((h) => ({ at: new Date(h.at).toISOString(), event: h.msg })),
    })),
    issuedOn: new Date(state.event.registeredAt || Date.now()).toISOString().slice(0, 10),
  }
}

function CertificatePackage() {
  const { state, metrics: m } = useStore()
  const [tab, setTab] = useState('ebwgr')
  const ret = buildReturn(state, m)
  const ref = state.event.cpcbId || 'Pending: register the event first'
  const csv = () => {
    const head = 'bag_id,stream,rerouted,declared_kg,facility_kg,variance_pct,status,handler'
    const rows = ret.custodyChain.map((b) => [b.bagId, b.stream, b.rerouted, b.declaredKg, b.facilityKg ?? '', b.variancePct ?? '', b.status, `"${b.handler}"`].join(','))
    download('EBWGR_CPCB_return.csv', [head, ...rows].join('\n'), 'text/csv')
  }
  return (
    <div className="space-y-5">
      <div className="flex gap-1 p-1 bg-[#EEEBE5] rounded-2xl no-print" role="tablist">
        {[['ebwgr', 'EBWGR & CPCB certificate'], ['green', 'Client green certificate']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 min-h-12 rounded-xl text-base font-semibold ${tab === k ? 'bg-white shadow-sm text-forest' : 'text-muted'}`}>{l}</button>
        ))}
      </div>

      {tab === 'ebwgr' ? (
        <article className="bg-white border-2 border-forest rounded-2xl p-6 sm:p-8 print-area">
          <div className="flex items-start justify-between gap-4 border-b-2 border-forest pb-5">
            <div>
              <p className="font-semibold text-mint">Extended Bulk Waste Generator Responsibility</p>
              <h3 className="text-2xl font-bold text-forest mt-1">EBWGR compliance & CPCB return</h3>
              <p className="text-muted mt-1">Solid Waste Management Rules 2026 · FSSAI surplus food recovery</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 py-2">
            <KeyValue k="CPCB reference" v={<span className="font-mono">{ref}</span>} />
            <KeyValue k="Generator" v={state.event.venue} />
            <KeyValue k="Event" v={`${state.event.name}, ${state.event.guests} guests`} />
            <KeyValue k="Issued on" v={ret.issuedOn} />
            <KeyValue k="Menu & timing" v={`${menuLabel(state.event.menu)}, ${state.event.start}–${state.event.end}`} />
          </div>
          <table className="w-full text-base my-5">
            <thead><tr className="text-left text-muted border-b border-line"><th className="py-2 font-medium">Stream</th><th className="py-2 font-medium text-right">Weight</th><th className="py-2 pl-6 font-medium">Processed by</th></tr></thead>
            <tbody>
              {STREAM_KEYS.map((k) => (
                <tr key={k} className="border-b border-line"><td className="py-3"><span className="inline-block size-3 rounded-full mr-2.5 align-middle" style={{ background: STREAMS[k].color }} />{STREAMS[k].label.en}</td><td className="py-3 text-right font-semibold tabular-nums">{fmtKg(m.byStream[k])}</td>
                  <td className="py-3 pl-6 text-muted">{destinationFor({ stream: k, destination: k === 'food' ? 'ngo' : 'recycler' }).name}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['Diversion', `${m.pct.toFixed(1)}%`], ['Meals rescued', m.meals], ['CO₂e saved', `${m.co2} kg`], ['EC fine avoided', fmtINR(m.ecAvoided)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-sage p-3 text-center"><div className="text-xl font-bold text-forest">{v}</div><div className="text-[15px] text-muted">{k}</div></div>
            ))}
          </div>
          <p className="text-[15px] text-muted mt-5">Chain of custody: {ret.custodyChain.length} QR-tagged bags with timestamped handovers, AI photo checks and weighbridge readings within ±5%. Demo document, not an official government filing.</p>
        </article>
      ) : (
        <article className="bg-white rounded-2xl p-8 sm:p-10 text-center border-[6px] border-double border-mint print-area">
          <Award size={44} strokeWidth={1.6} className="mx-auto text-forest" />
          <p className="font-semibold text-mint mt-3">Certificate of green celebration</p>
          <h3 className="text-3xl font-bold text-forest mt-2">{state.event.name}</h3>
          <p className="text-lg text-muted mt-1">hosted at {state.event.venue}</p>
          <p className="mt-6 text-lg text-ink max-w-lg mx-auto leading-relaxed">This celebration kept <b>{fmtKg(m.diverted)}</b> of waste out of landfill, shared <b>{m.meals} meals</b> with Jaipur families through Roti Bank Jaipur, and saved <b>{m.co2} kg CO₂e</b>.</p>
          <p className="mt-6 font-mono text-muted">{ref}</p>
        </article>
      )}

      <div className="grid sm:grid-cols-3 gap-3 no-print">
        <Button icon={Printer} onClick={() => window.print()}>Print / save PDF</Button>
        <Button variant="outline" icon={FileJson} onClick={() => download('EBWGR_CPCB_return.json', JSON.stringify(ret, null, 2), 'application/json')}>Portal JSON</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={csv}>Portal CSV</Button>
      </div>
    </div>
  )
}
