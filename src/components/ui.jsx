import { useEffect, useRef, useState } from 'react'
import { FOOD_CATEGORIES, STREAMS } from '../lib/streams.js'
import { useStore } from '../lib/store.jsx'

export function Card({ className = '', children, ...rest }) {
  return <section className={`bg-white border border-line rounded-3xl p-5 sm:p-8 ${className}`} {...rest}>{children}</section>
}

export function CardTitle({ title, subtitle, right, className = 'mb-5' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-ink leading-snug">{title}</h2>
        {subtitle && <p className="text-base text-muted mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-8">
      <div>
        <h1 className="text-[28px] sm:text-[34px] font-bold text-forest leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="text-lg text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const BTN = {
  primary: 'bg-forest text-white hover:bg-forest-dark',
  outline: 'bg-white text-ink border border-line hover:bg-[#FAF8F5]',
  danger: 'bg-white text-[#B91C1C] border border-[#F3C9C4] hover:bg-[#FDF3F2]',
  ghost: 'bg-transparent text-forest hover:bg-sage',
}
export function Button({ variant = 'primary', size = 'md', className = '', icon: Icon, children, ...rest }) {
  const sz = size === 'lg' ? 'min-h-14 px-6 text-lg' : size === 'sm' ? 'min-h-10 px-4 text-[15px]' : 'min-h-12 px-5 text-base'
  return (
    <button className={`inline-flex items-center justify-center gap-2.5 rounded-2xl font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint ${sz} ${BTN[variant]} ${className}`} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 17 : 20} strokeWidth={2} />}
      {children}
    </button>
  )
}

export function StreamBadge({ stream, rerouted }) {
  const { lang } = useStore()
  const s = STREAMS[stream]
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[15px] font-medium whitespace-nowrap" style={{ background: s.soft, color: s.color, borderColor: s.ring }}>
      <span className="size-2 rounded-full" style={{ background: s.color }} />
      {s.label[lang]}{rerouted && ' → compost'}
    </span>
  )
}

const STATUS = {
  tagged: ['Tagged at venue', 'bg-[#EEEBE5] text-[#57534E]'],
  in_transit: ['In transit', 'bg-[#FEF5E6] text-[#B45309]'],
  arrived: ['Arrived', 'bg-[#E8F1FB] text-[#1D4ED8]'],
  accepted: ['Received by NGO', 'bg-sage text-forest'],
  verified: ['Verified at facility', 'bg-sage text-forest'],
  flagged: ['Weight mismatch', 'bg-[#FDECEA] text-[#B91C1C]'],
}
export function StatusPill({ status }) {
  const [label, cls] = STATUS[status] || [status, 'bg-[#EEEBE5]']
  return <span className={`inline-flex rounded-lg px-3 py-1 text-[15px] font-medium whitespace-nowrap ${cls}`}>{label}</span>
}

export function Stat({ value, label, tone = 'text-ink' }) {
  return (
    <div className="rounded-2xl border border-line px-4 py-4 sm:py-5">
      <div className={`text-2xl xl:text-[28px] font-bold leading-tight whitespace-nowrap ${tone}`}>{value}</div>
      <div className="text-base text-muted mt-1.5">{label}</div>
    </div>
  )
}

export function KeyValue({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3.5 border-b border-line">
      <span className="text-muted">{k}</span>
      <span className="font-semibold text-ink text-right">{v}</span>
    </div>
  )
}

export function Note({ tone = 'sage', children, className = '' }) {
  const cls = tone === 'amber' ? 'bg-[#FEF5E6] text-[#7C4A03]' : tone === 'red' ? 'bg-[#FDECEA] text-[#8F1D1D]' : 'bg-sage text-forest-dark'
  return <div className={`rounded-2xl px-5 py-4 text-base leading-relaxed ${cls} ${className}`}>{children}</div>
}

/** Table with the roomy ledger styling from the reference design. */
export function Table({ head, children, minWidth = 640 }) {
  return (
    <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
      <table className="w-full text-base" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line text-left">
            {head.map((h, i) => <th key={i} className={`py-3 px-3 first:pl-3 font-medium text-muted text-[17px] ${h.right ? 'text-right' : ''}`}>{h.label ?? h}</th>)}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&_td]:py-4 [&_td]:px-3">{children}</tbody>
      </table>
    </div>
  )
}

// Re-render every second using the simulated clock.
export function useNow(interval = 1000) {
  const { now } = useStore()
  const [n, setN] = useState(now())
  useEffect(() => { const id = setInterval(() => setN(now()), interval); return () => clearInterval(id) }, [now, interval])
  return Math.max(n, now())
}

export function fmtDuration(ms) {
  const neg = ms < 0
  const s = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${neg ? '−' : ''}${h ? `${h}h ` : ''}${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

export function SlaTimer({ deadline }) {
  const n = useNow()
  const left = deadline - n
  const urgent = left < 30 * 60 * 1000
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-[15px] font-semibold tabular-nums whitespace-nowrap ${left <= 0 ? 'bg-crimson text-white' : urgent ? 'bg-[#FDECEA] text-[#B91C1C]' : 'bg-[#EEEBE5] text-ink'}`}>
      <span className={`size-2 rounded-full ${left <= 0 ? 'bg-white' : 'bg-crimson'} ${urgent ? 'animate-pulse' : ''}`} />
      {left <= 0 ? 'Time limit passed' : `${fmtDuration(left)} left`}
    </span>
  )
}

export function AnimatedNumber({ value, decimals = 0, prefix = '', suffix = '', duration = 900 }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value
    if (a === b) return
    let raf
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration)
      setShown(a + (b - a) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = b
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); from.current = b }
  }, [value, duration])
  return <>{prefix}{shown.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>
}

export function Toggle({ checked, onChange, label, color = '#1B4D3E' }) {
  return (
    <label className={`flex items-center gap-4 min-h-14 px-4 rounded-2xl border cursor-pointer select-none transition-colors ${checked ? 'bg-sage border-[#C5DCCF]' : 'bg-white border-line hover:bg-[#FAF8F5]'}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="grid place-items-center size-7 rounded-lg border-2 shrink-0" style={{ borderColor: checked ? color : '#CFC9C0', background: checked ? color : 'white' }}>
        {checked && <svg viewBox="0 0 16 16" className="size-4 text-white"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span className="text-base text-ink">{label}</span>
    </label>
  )
}

export function Empty({ icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-12 px-4 text-muted">
      {Icon && <Icon size={32} strokeWidth={1.6} className="text-[#BDB6AB]" />}
      <p className="text-base">{children}</p>
    </div>
  )
}

export const timeStr = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

/** Indian food-label mark: green dot in a square for veg, brown triangle for non-veg. */
export function DietMark({ type }) {
  if (type !== 'veg' && type !== 'non-veg') return null
  const c = type === 'veg' ? '#15803D' : '#9A3412'
  return (
    <span role="img" aria-label={type === 'veg' ? 'Vegetarian' : 'Non-vegetarian'} title={type === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}
      className="inline-grid place-items-center size-4 border-2 rounded-[3px] shrink-0 bg-white" style={{ borderColor: c }}>
      {type === 'veg'
        ? <span className="size-2 rounded-full" style={{ background: c }} />
        : <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `7px solid ${c}` }} />}
    </span>
  )
}

const NEXT_TYPE = { veg: 'non-veg', 'non-veg': 'veg', unknown: 'veg' }

export function FoodList({ foods, className = '', onRemove, onToggle }) {
  if (!foods?.length) return null
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {foods.map((f, i) => (
        <li key={`${f.name}-${i}`} className={`inline-flex items-center gap-2 rounded-full border bg-white pl-3 pr-3 py-1 text-[15px] font-medium text-ink ${f.type === 'unknown' && onToggle ? 'border-[#F5C77E]' : 'border-line'}`}>
          {onToggle ? (
            <button type="button" onClick={() => onToggle(i, NEXT_TYPE[f.type] || 'veg')} className="grid place-items-center -ml-1 size-7 rounded-full hover:bg-[#EEEBE5]"
              aria-label={`${f.name}: ${f.type === 'unknown' ? 'veg or non-veg not set' : f.type}. Tap to change`}>
              {f.type === 'unknown' ? <span className="grid place-items-center size-4 border-2 border-[#B45309] rounded-[3px] text-[10px] font-bold text-[#B45309]">?</span> : <DietMark type={f.type} />}
            </button>
          ) : <DietMark type={f.type} />}
          {f.name}
          {onRemove && <button type="button" onClick={() => onRemove(i)} className="-mr-1 grid place-items-center size-6 rounded-full text-muted hover:bg-[#EEEBE5]" aria-label={`Remove ${f.name}`}>×</button>}
        </li>
      ))}
    </ul>
  )
}

export function dietSummary(foods = []) {
  const types = new Set(foods.map((f) => f.type))
  if (types.has('non-veg')) return types.has('veg') ? 'Veg & non-veg' : 'Non-veg'
  return types.has('veg') ? 'Veg' : ''
}

export const foodNames = (foods = []) => foods.map((f) => f.name).join(', ')

/** Food items grouped by category ("Fruits: Banana, Papaya…"). */
export function GroupedFoodList({ foods, onRemove, onToggle, className = '' }) {
  if (!foods?.length) return null
  const indexed = foods.map((f, i) => ({ ...f, _i: i }))
  return (
    <div className={`space-y-3 ${className}`}>
      {FOOD_CATEGORIES.map((c) => {
        const group = indexed.filter((f) => (f.category || 'other') === c.key)
        if (!group.length) return null
        return (
          <div key={c.key}>
            <p className="text-[15px] text-muted mb-1.5">{c.label} <span className="text-[#A8A29E]">· {group.length}</span></p>
            <FoodList foods={group}
              onRemove={onRemove && ((i) => onRemove(group[i]._i))}
              onToggle={onToggle && ((i, type) => onToggle(group[i]._i, type))} />
          </div>
        )
      })}
    </div>
  )
}
