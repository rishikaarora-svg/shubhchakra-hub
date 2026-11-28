// SWM Rules 2026 source-segregation streams used throughout the platform.
export const STREAMS = {
  food: {
    key: 'food', code: 'FR', firstSeq: 1043, tag: 'Red', color: '#DC2626', qr: '#B91C1C', soft: '#FDEEEC', ring: '#F6C9C4',
    label: { en: 'Food rescue', hi: 'Bacha hua shuddh khana' },
    dest: 'ngo', perGuest: 0.12, co2PerKg: 2.0,
  },
  organic: {
    key: 'organic', code: 'OR', firstSeq: 2033, tag: 'Green', color: '#059669', qr: '#047857', soft: '#EAF5EF', ring: '#BCDFCC',
    label: { en: 'Organic compost', hi: 'Geela kachra (khaad)' },
    dest: 'recycler', perGuest: 0.22, co2PerKg: 0.3,
  },
  dry: {
    key: 'dry', code: 'DR', firstSeq: 3013, tag: 'Blue', color: '#2563EB', qr: '#1D4ED8', soft: '#EEF3FE', ring: '#C5D5FA',
    label: { en: 'Dry recyclables', hi: 'Sookha kachra (recycle)' },
    dest: 'recycler', perGuest: 0.11, co2PerKg: 0.46,
  },
  sanitary: {
    key: 'sanitary', code: 'SN', firstSeq: 4006, tag: 'Purple', color: '#7C3AED', qr: '#6D28D9', soft: '#F4EFFE', ring: '#DCCDFB',
    label: { en: 'Sanitary & special care', hi: 'Sanitary / khaas dhyan' },
    dest: 'incinerator', perGuest: 0.03, co2PerKg: 0,
  },
}
export const STREAM_KEYS = ['food', 'organic', 'dry', 'sanitary']
export const CODE_TO_STREAM = Object.fromEntries(STREAM_KEYS.map((k) => [STREAMS[k].code, k]))

export const BINS = [
  { key: 'crate', kg: 15, label: { en: 'Small crate', hi: 'Chhota crate' } },
  { key: 'drum', kg: 40, label: { en: 'Standard drum', hi: 'Normal drum' } },
  { key: 'bin', kg: 80, label: { en: 'Large banquet bin', hi: 'Bada banquet bin' } },
]

export const KG_PER_MEAL = 0.5
export const EC_FINE_AVOIDED = 25000 // ₹ per compliant event
export const FOOD_SLA_MS = 2 * 60 * 60 * 1000 // FSSAI 2-hour rescue window
export const TRANSIT_MS = 20 * 60 * 1000 // modelled drive time venue → partner
export const VARIANCE_LIMIT = 0.05 // ±5% weighbridge tolerance

export const PARTNERS = {
  ngo: { name: 'Roti Bank Jaipur', area: 'Malviya Nagar, Jaipur' },
  recycler: { name: 'Sewapura MRF', area: 'Sewapura, Jaipur' },
  compost: { name: 'Langariyawas MRF', area: 'Langariyawas, Jaipur' },
  incinerator: { name: 'Sanitary incineration unit', area: 'Sanganer, Jaipur' },
}

export const VENUE = { name: 'Chokhi Dhani Banquet Lawn, Jaipur', event: 'Royal Heritage Wedding', ward: 'Ward 112, Tonk Road' }

// Menu changes how much food and kitchen waste a guest generates; dry and sanitary stay per-guest.
export const MENUS = [
  { key: 'buffet', label: 'Full Indian buffet', food: 1, organic: 1 },
  { key: 'plated', label: 'Plated sit-down dinner', food: 0.75, organic: 0.85 },
  { key: 'live', label: 'Buffet with live counters', food: 1.15, organic: 1.2 },
  { key: 'hitea', label: 'High tea & snacks', food: 0.5, organic: 0.6 },
]

export function targetsFor(guests, menu = 'buffet') {
  const m = MENUS.find((x) => x.key === menu) || MENUS[0]
  return Object.fromEntries(STREAM_KEYS.map((k) => [k, Math.round(guests * STREAMS[k].perGuest * (m[k] ?? 1))]))
}

export function destinationFor(bag) {
  if (bag.destination === 'ngo') return PARTNERS.ngo
  if (bag.stream === 'sanitary') return PARTNERS.incinerator
  if (bag.stream === 'dry') return PARTNERS.recycler
  return PARTNERS.compost
}

/** Weight shown in ledgers: the facility weighbridge figure once verified, otherwise the declared weight. */
export const bagKg = (b) => b.facilityKg ?? b.declaredKg

export const fmtKg = (n) => `${(Math.round(n * 10) / 10).toLocaleString('en-IN')} kg`
export const fmtINR = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`
