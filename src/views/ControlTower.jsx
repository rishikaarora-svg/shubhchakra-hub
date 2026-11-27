import { AlarmClock, Camera, CheckCircle2, FastForward, RotateCcw, Send, Truck, Zap } from 'lucide-react'
import { nextBagId, useStore } from '../lib/store.jsx'
import { BINS, PARTNERS, STREAMS, TRANSIT_MS, bagKg, destinationFor } from '../lib/streams.js'
import { Button, Card, CardTitle, PageHeader, SlaTimer, Stat, StatusPill, StreamBadge, Table, fmtDuration, timeStr, useNow } from '../components/ui.jsx'

// Stylised Jaipur layout (not to scale), viewBox 600×420
const NODES = {
  venue: { x: 318, y: 352 },
  ngo: { x: 300, y: 232, label: 'Roti Bank Jaipur', color: '#DC2626', above: true },
  recycler: { x: 486, y: 96, label: 'Sewapura MRF', color: '#2563EB' },
  compost: { x: 104, y: 330, label: 'Langariyawas MRF', color: '#059669' },
  incinerator: { x: 224, y: 372, label: 'Sanitary incineration', color: '#7C3AED' },
}
const CLUSTERS = [
  { x: 126, y: 232, label: 'Ajmer Road', venues: 38 },
  { x: 160, y: 124, label: 'Vaishali Nagar', venues: 22 },
  { x: 360, y: 62, label: 'Amer / Delhi Road', venues: 17 },
  { x: 462, y: 300, label: 'Jagatpura', venues: 26 },
  { x: 318, y: 352, label: 'Tonk Road', venues: 41, side: true },
]
const WARDS = [
  'M180,90 L270,70 L300,140 L230,170 L170,150 Z', 'M270,70 L380,40 L420,110 L330,150 L300,140 Z', 'M420,110 L520,120 L510,220 L420,210 L380,160 Z',
  'M80,170 L170,150 L230,170 L220,260 L110,280 Z', 'M230,170 L330,150 L380,160 L370,250 L250,265 L220,260 Z', 'M380,160 L420,210 L510,220 L520,300 L410,300 L370,250 Z',
  'M110,280 L220,260 L250,265 L260,330 L170,380 L90,350 Z', 'M250,265 L370,250 L410,300 L400,390 L260,390 L260,330 Z', 'M410,300 L520,300 L530,400 L400,390 Z',
]

const destNode = (b) => (b.destination === 'ngo' ? 'ngo' : b.stream === 'sanitary' ? 'incinerator' : b.stream === 'dry' ? 'recycler' : 'compost')

export default function ControlTower({ go }) {
  const { state, dispatch, metrics: m, t, now } = useStore()
  const n = useNow()
  const custody = state.bags.filter((b) => ['tagged', 'in_transit', 'arrived'].includes(b.status))
  const atRisk = custody.filter((b) => b.slaDeadline && b.destination === 'ngo' && b.slaDeadline - n < 30 * 60 * 1000)
  const foodOpen = custody.filter((b) => b.destination === 'ngo' && b.slaDeadline)
  const tagged = custody.filter((b) => b.status === 'tagged')

  const spawnFood = () => {
    const id = nextBagId(state, 'food')
    dispatch({ type: 'CREATE_BAG', bag: { stream: 'food', bin: 'drum', qty: 1, declaredKg: BINS[1].kg, ai: { source: 'local', confidence: 0.9, stream: 'food' }, safetyCheck: { passed: true } } })
    dispatch({ type: 'DISPATCH', id })
  }
  const jumpToBreach = () => {
    const next = Math.min(...foodOpen.map((b) => b.slaDeadline))
    if (Number.isFinite(next)) dispatch({ type: 'FAST_FORWARD', ms: Math.max(0, next - now()) + 2000 })
  }
  const dispatchTagged = () => tagged.forEach((b) => dispatch({ type: 'DISPATCH', id: b.id }))
  const arriveAll = () => custody.filter((b) => b.status === 'in_transit').forEach((b) => dispatch({ type: 'ARRIVE', id: b.id }))
  const closeGates = () => custody.filter((b) => b.destination === 'recycler' && b.status !== 'tagged').forEach((b) => dispatch({ type: 'GATE_VERIFY', id: b.id, facilityKg: Math.round(b.declaredKg * (0.98 + Math.random() * 0.03) * 10) / 10 }))

  return (
    <>
      <PageHeader title={t('nav.tower')} subtitle={t('tower.subtitle')}
        action={<p className="text-lg text-muted">Clock {new Date(n).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{state.timeOffset > 0 && <span className="text-[#B45309] font-semibold"> (+{Math.round(state.timeOffset / 60000)} min)</span>}</p>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat value={custody.length} label="Bags in transit or waiting" />
        <Stat value={atRisk.length} label="Food pickups under 30 min left" tone={atRisk.length ? 'text-[#B45309]' : 'text-ink'} />
        <Stat value={`${m.pct.toFixed(1)}%`} label="Landfill diversion" tone="text-forest" />
        <Stat value={m.flagged} label="Weight mismatches" tone={m.flagged ? 'text-[#B91C1C]' : 'text-ink'} />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardTitle title={t('tower.map')} subtitle="Banquet clusters, partners and live vehicle movement" />
          <svg viewBox="0 0 600 420" className="w-full h-auto rounded-2xl bg-[#F1EEE8]" role="img" aria-label="Map of Jaipur wards with venue clusters, NGO, recovery facilities and live transits">
            {WARDS.map((d, i) => <path key={i} d={d} fill={i % 2 ? '#FFFFFF' : '#FAF8F5'} stroke="#DDD7CE" strokeWidth="1.2" />)}
            <path d="M262,118 L318,104 L336,150 L282,166 Z" fill="#FBE9D6" stroke="#E5A96B" strokeWidth="1" strokeDasharray="3 2" />
            <text x="299" y="139" textAnchor="middle" fontSize="11" fill="#8A4B12" fontWeight="600">Walled City</text>
            <g stroke="#B9B2A7" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6">
              <path d="M300,150 L318,352 L330,410" /><path d="M300,150 L126,232 L40,280" /><path d="M300,150 L360,62 L390,10" /><path d="M300,150 L486,96 L570,70" /><path d="M300,150 L462,300 L560,330" />
              <ellipse cx="300" cy="230" rx="230" ry="160" strokeDasharray="6 6" strokeWidth="2" />
            </g>
            {CLUSTERS.map((c) => (
              <g key={c.label}>
                <circle cx={c.x} cy={c.y} r={10 + c.venues / 4} fill="#2E9E6B" opacity="0.16" />
                <circle cx={c.x} cy={c.y} r="5.5" fill="#1B4D3E" />
                <text x={c.side ? c.x + 24 : c.x} y={c.side ? c.y + 2 : c.y - 16 - c.venues / 4} textAnchor={c.side ? 'start' : 'middle'} fontSize="13" fontWeight="600" fill="#1C1F23">{c.label}</text>
                <text x={c.side ? c.x + 24 : c.x} y={c.side ? c.y + 18 : c.y + 22 + c.venues / 4} textAnchor={c.side ? 'start' : 'middle'} fontSize="12" fill="#5F6670">{c.venues} venues</text>
              </g>
            ))}
            {['ngo', 'recycler', 'compost', 'incinerator'].map((k) => {
              const nd = NODES[k]
              return (
                <g key={k}>
                  <rect x={nd.x - 10} y={nd.y - 10} width="20" height="20" rx="5" fill="#fff" stroke={nd.color} strokeWidth="3" />
                  <text x={nd.x} y={nd.above ? nd.y - 17 : nd.y + 28} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={nd.color}>{nd.label}</text>
                </g>
              )
            })}
            {custody.filter((b) => b.status !== 'tagged').map((b) => {
              const a = NODES.venue, z = NODES[destNode(b)]
              const p = b.status === 'arrived' ? 1 : Math.min(1, (n - b.dispatchedAt) / TRANSIT_MS)
              const col = STREAMS[b.stream].color
              return (
                <g key={b.id}>
                  <line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke={col} strokeWidth="2.5" strokeDasharray="6 5" opacity="0.7" />
                  <circle cx={a.x + (z.x - a.x) * p} cy={a.y + (z.y - a.y) * p} r="8" fill={col} stroke="#fff" strokeWidth="3"><title>{b.id}: {b.status}</title></circle>
                </g>
              )
            })}
          </svg>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-muted">
            <span className="flex items-center gap-2"><span className="size-3 rounded-full bg-forest" />Banquet cluster</span>
            <span className="flex items-center gap-2"><span className="size-3 rounded border-2 border-crimson" />NGO</span>
            <span className="flex items-center gap-2"><span className="size-3 rounded border-2 border-cobalt" />Recovery facility</span>
            <span className="flex items-center gap-2"><span className="size-3 rounded-full bg-crimson" />Vehicle on the way</span>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardTitle title={t('tower.ff')} subtitle="Shortcuts for a smooth live demo" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <Button variant="outline" icon={Zap} onClick={spawnFood}>New food dispatch</Button>
              <Button variant="outline" icon={Send} onClick={dispatchTagged} disabled={!tagged.length}>Dispatch tagged bags</Button>
              <Button variant="outline" icon={Truck} onClick={arriveAll} disabled={!custody.some((b) => b.status === 'in_transit')}>All vehicles arrive</Button>
              <Button variant="outline" icon={FastForward} onClick={() => dispatch({ type: 'FAST_FORWARD', ms: 15 * 60000 })}>Skip 15 minutes</Button>
              <Button variant="outline" icon={AlarmClock} onClick={jumpToBreach} disabled={!foodOpen.length}>Expire food window</Button>
              <Button variant="outline" icon={CheckCircle2} onClick={closeGates} disabled={!custody.some((b) => b.destination === 'recycler' && b.status !== 'tagged')}>Check in all at facility</Button>
            </div>
            <Button variant="danger" icon={RotateCcw} className="w-full mt-3" onClick={() => { if (confirm('Reset the demo to its starting state?')) dispatch({ type: 'RESET' }) }}>Reset demo</Button>
          </Card>

          <Card>
            <CardTitle title={t('tower.log')} className="mb-3" />
            <ol className="max-h-80 overflow-y-auto -mr-2 pr-2" aria-live="polite">
              {state.log.map((l, i) => (
                <li key={i} className="flex gap-3 py-2.5 border-b border-line last:border-0">
                  <span className={`mt-2 size-2.5 rounded-full shrink-0 ${l.kind === 'success' ? 'bg-mint' : l.kind === 'warn' ? 'bg-[#E59A1A]' : l.kind === 'error' ? 'bg-crimson' : 'bg-[#C9C4BC]'}`} />
                  <span className="flex-1"><span className="text-muted mr-2 tabular-nums">{timeStr(l.at)}</span>{l.msg}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardTitle title={t('tower.audit')} subtitle={`Food not handed over within 2 hours is automatically sent to ${PARTNERS.compost.name} for composting.`} className="mb-3" />
        <Table head={['Bag', 'Stream', 'kg', 'Going to', 'Status', 'Time', 'Photo proof']} minWidth={980}>
          {custody.length === 0 && <tr><td colSpan="7" className="text-center text-muted !py-10">All bags are closed. Use “New food dispatch” or the Field Coordinator page to start another.</td></tr>}
          {custody.map((b) => (
            <tr key={b.id}>
              <td className="font-semibold whitespace-nowrap">{b.id}</td>
              <td><StreamBadge stream={b.stream} rerouted={b.rerouted} /></td>
              <td className="tabular-nums">{bagKg(b)}</td>
              <td className="whitespace-nowrap">{destinationFor(b).name}</td>
              <td><StatusPill status={b.status} /></td>
              <td>{b.slaDeadline && b.destination === 'ngo' ? <SlaTimer deadline={b.slaDeadline} /> : <span className="text-muted tabular-nums whitespace-nowrap">{b.dispatchedAt ? `${fmtDuration(n - b.dispatchedAt)} ago` : 'Not dispatched'}</span>}</td>
              <td>
                {b.status === 'tagged' ? <Button size="sm" variant="outline" icon={Send} onClick={() => dispatch({ type: 'DISPATCH', id: b.id })}>Dispatch</Button>
                  : b.destination !== 'ngo' ? <span className="text-muted">Taken at the gate</span>
                  : b.proof?.fulfilledAt ? (
                    <span className="flex items-center gap-2.5">{b.proof.photo && <img src={b.proof.photo} alt="" className="size-10 rounded-lg object-cover ring-1 ring-line" />}<span className="text-forest font-semibold whitespace-nowrap">Received {timeStr(b.proof.fulfilledAt)}</span></span>
                  ) : b.proof?.requestedAt ? (
                    <button onClick={() => go('ngo', { bagId: b.id })} className="text-[#B45309] font-semibold underline underline-offset-4 whitespace-nowrap">Waiting for NGO…</button>
                  ) : (
                    <Button size="sm" variant="outline" icon={Camera} onClick={() => dispatch({ type: 'REQUEST_PROOF', id: b.id })}>{t('tower.requestProof')}</Button>
                  )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  )
}
