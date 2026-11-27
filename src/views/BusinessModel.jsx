import { useState } from 'react'
import { fmtINR } from '../lib/streams.js'
import { useStore } from '../lib/store.jsx'
import { Card, CardTitle, PageHeader } from '../components/ui.jsx'

// Illustrative unit economics. Assumptions are adjustable with the sliders below.
const PRICE = { complianceFee: 4999, perKgCoordination: 4 }
const COST = { fieldLead: 1200, logistics: 1100, platform: 180 }
const KG_PER_GUEST = 0.48
const DRY_SHARE = 0.23, DRY_RATE = 9, REV_SHARE = 0.2 // dry scrap sold by MRF at ₹9/kg, 20% platform share

export default function BusinessModel() {
  const { t } = useStore()
  const [events, setEvents] = useState(120)
  const [guests, setGuests] = useState(500)
  const kg = guests * KG_PER_GUEST
  const rev = { fee: PRICE.complianceFee, coord: kg * PRICE.perKgCoordination, share: kg * DRY_SHARE * DRY_RATE * REV_SHARE }
  const revenue = rev.fee + rev.coord + rev.share
  const cost = COST.fieldLead + COST.logistics + COST.platform
  const margin = revenue - cost

  return (
    <>
      <PageHeader title={t('nav.business')} subtitle="We own no trucks or plants. We earn from compliance software, coordination, and a share of recovered value." />

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardTitle title="Per-event unit economics" subtitle="Illustrative pricing. Drag to model a typical event." />
          <Slider label="Guests per event" value={guests} min={100} max={2000} step={50} onChange={setGuests} note={`about ${Math.round(kg)} kg of waste`} />
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <Ledger title="Revenue per event" rows={[
              ['EBWGR compliance fee', rev.fee],
              [`Coordination at ₹${PRICE.perKgCoordination}/kg`, rev.coord],
              [`Share of dry scrap sales (${REV_SHARE * 100}%)`, rev.share],
            ]} total={revenue} />
            <Ledger title="Cost per event" rows={[
              ['Field Coordinator shift', COST.fieldLead],
              ['Partner logistics', COST.logistics],
              ['Cloud, AI & messaging', COST.platform],
            ]} total={cost} />
          </div>
          <div className="rounded-2xl bg-forest text-white px-6 py-5 mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-lg font-medium">Contribution margin per event</span>
            <span className="text-3xl font-bold">{fmtINR(margin)} <span className="text-lg font-medium text-[#A8D5BD]">({Math.round((margin / revenue) * 100)}%)</span></span>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle title="Partner revenue sharing" subtitle="Everyone in the chain earns or saves" />
          <ul className="space-y-4">
            <Share color="#1B4D3E" who="Venue" what="Avoids ₹25,000+ in penalties per event and gets a green certificate for clients." />
            <Share color="#2563EB" who="Dry waste MRF" what="Receives sorted, weighed scrap and shares 20% of resale value." />
            <Share color="#059669" who="Compost facility" what="Gets clean organic material with a verified weight record." />
            <Share color="#DC2626" who="NGO" what="Free to use. Receives safety-checked food and route guidance." />
            <Share color="#7C3AED" who="Field Coordinators" what="Paid per shift: local jobs for trained staff." />
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle title="Scaling with the city" subtitle="From one banquet cluster to Rajasthan's major cities" />
        <Slider label="Events per month, city-wide" value={events} min={10} max={1500} step={10} onChange={setEvents} note={`${fmtINR(margin * events)} monthly contribution`} />
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[
            ['Pilot', 'Tonk Road cluster', '25 venues, 1 MRF, 1 NGO'],
            ['City', 'All Jaipur banquet clusters', 'About 150 venues, 3 MRFs, 5 NGOs'],
            ['Municipal partnership', 'Jaipur Municipal Corporation', 'Ward-level dashboards for the city'],
            ['State', 'Udaipur, Jodhpur, Ajmer, Kota', 'Same platform, local partners'],
          ].map(([phase, where, what], i) => (
            <li key={phase} className="rounded-2xl border border-line p-5">
              <div className="flex items-center gap-3"><span className="grid place-items-center size-9 rounded-full bg-sage text-forest font-bold">{i + 1}</span><span className="text-lg font-semibold text-ink">{phase}</span></div>
              <p className="font-semibold text-ink mt-3">{where}</p>
              <p className="text-muted mt-0.5">{what}</p>
            </li>
          ))}
        </ol>
        <p className="text-muted mt-5">All figures are planning assumptions for illustration, not audited financials.</p>
      </Card>
    </>
  )
}

function Slider({ label, value, min, max, step, onChange, note }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="text-lg font-semibold text-ink">{label}</label>
        <span><b className="text-2xl text-forest">{value.toLocaleString('en-IN')}</b><span className="text-muted ml-2">{note}</span></span>
      </div>
      <input type="range" className="range mt-3" min={min} max={max} step={step} value={value} style={{ '--fill': `${((value - min) / (max - min)) * 100}%` }} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  )
}

function Ledger({ title, rows, total }) {
  return (
    <div className="rounded-2xl border border-line p-5">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <dl className="mt-3">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted">{k}</dt><dd className="font-semibold tabular-nums">{fmtINR(v)}</dd></div>)}
        <div className="flex justify-between gap-4 border-t border-line pt-3 mt-1"><dt className="font-semibold">Total</dt><dd className="text-lg font-bold tabular-nums">{fmtINR(total)}</dd></div>
      </dl>
    </div>
  )
}

const Share = ({ color, who, what }) => (
  <li className="flex gap-3.5"><span className="mt-1.5 size-3.5 rounded-full shrink-0" style={{ background: color }} /><span><b className="text-ink text-lg">{who}</b><span className="block text-muted">{what}</span></span></li>
)
