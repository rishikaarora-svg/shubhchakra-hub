import { useEffect, useState } from 'react'
import { Building2, ScanLine, HandHeart, Recycle, RadioTower, ChartNoAxesColumn } from 'lucide-react'
import { useStore } from './lib/store.jsx'
import VenueAdmin from './views/VenueAdmin.jsx'
import FieldLead from './views/FieldLead.jsx'
import NgoPartner from './views/NgoPartner.jsx'
import RecyclerGate from './views/RecyclerGate.jsx'
import ControlTower from './views/ControlTower.jsx'
import BusinessModel from './views/BusinessModel.jsx'

const VIEWS = [
  { key: 'venue', icon: Building2, C: VenueAdmin },
  { key: 'field', icon: ScanLine, C: FieldLead },
  { key: 'ngo', icon: HandHeart, C: NgoPartner },
  { key: 'recycler', icon: Recycle, C: RecyclerGate },
  { key: 'tower', icon: RadioTower, C: ControlTower },
  { key: 'business', icon: ChartNoAxesColumn, C: BusinessModel },
]

function readRoute() {
  const p = new URLSearchParams(window.location.search)
  const role = p.get('role')
  return { view: VIEWS.some((v) => v.key === role) ? role : 'venue', params: Object.fromEntries(p) }
}

export const CONTAINER = 'max-w-[1180px] mx-auto px-4 sm:px-8'

export default function App() {
  const { t, lang, state } = useStore()
  const [{ view, params }, setRoute] = useState(readRoute)

  const go = (key, extra = {}) => {
    const p = new URLSearchParams({ role: key, ...extra })
    window.history.pushState(null, '', `?${p}`)
    setRoute({ view: key, params: Object.fromEntries(p) })
    window.scrollTo({ top: 0 })
  }
  useEffect(() => {
    const onPop = () => setRoute(readRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => { document.documentElement.lang = lang === 'hi' ? 'hi' : 'en' }, [lang])

  const Active = VIEWS.find((v) => v.key === view).C
  const atRisk = state.bags.some((b) => b.stream === 'food' && b.destination === 'ngo' && b.slaDeadline && ['in_transit', 'arrived'].includes(b.status) && b.slaDeadline - (Date.now() + state.timeOffset) < 30 * 60 * 1000)

  return (
    <div className="min-h-dvh bg-canvas text-ink pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
      <header className="bg-white no-print">
        <div className={`${CONTAINER} flex items-center gap-4 h-[76px] sm:h-[92px]`}>
          <button onClick={() => go('venue')} className="flex items-center gap-3.5 min-w-0 text-left" aria-label="ShubhChakra Hub home">
            <img src="/icon.svg" alt="" className="size-9 sm:size-12 shrink-0" />
            <span className="min-w-0">
              <span className="block font-bold text-forest text-lg sm:text-[26px] leading-tight tracking-tight whitespace-nowrap">ShubhChakra Hub</span>
              <span className="hidden sm:block text-base text-muted leading-snug">{t('app.tagline')}</span>
            </span>
          </button>
          <LangToggle className="ml-auto" />
        </div>
      </header>

      <div className={`no-print ${atRisk ? 'bg-[#FEF1DC] text-[#7C4A03]' : 'bg-sage text-forest-dark'}`} role="status">
        <p className={`${CONTAINER} py-3.5 sm:py-4 text-center text-[15px] sm:text-lg font-medium leading-snug`}>
          {atRisk ? '🟠 ' : '🟢 '}{t(atRisk ? 'shield.risk' : 'shield.ok')}
        </p>
      </div>

      <nav className="hidden md:block sticky top-0 z-40 bg-white border-b border-line no-print" aria-label="Views">
        <div className={`${CONTAINER} flex gap-1 overflow-x-auto scrollbar-none`}>
          {VIEWS.map((v) => {
            const Icon = v.icon, on = view === v.key
            return (
              <button key={v.key} onClick={() => go(v.key)} aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-2 h-[68px] px-3 lg:px-3.5 border-b-[3px] -mb-px whitespace-nowrap text-base lg:text-[17px] font-medium transition-colors ${on ? 'border-forest text-forest' : 'border-transparent text-muted hover:text-ink'}`}>
                <Icon size={20} strokeWidth={1.8} />{t(`nav.${v.key}`)}
              </button>
            )
          })}
        </div>
      </nav>

      <main className={`${CONTAINER} py-7 sm:py-10`}>
        <Active go={go} params={params} />
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line grid grid-cols-6 pb-[env(safe-area-inset-bottom)] no-print" aria-label="Views">
        {VIEWS.map((v) => {
          const Icon = v.icon, on = view === v.key
          return (
            <button key={v.key} onClick={() => go(v.key)} aria-current={on ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 min-h-[68px] text-[12px] font-medium ${on ? 'text-forest' : 'text-muted'}`}>
              <span className={`grid place-items-center h-8 w-12 rounded-full ${on ? 'bg-sage' : ''}`}><Icon size={21} strokeWidth={on ? 2.2 : 1.8} /></span>
              <span className="truncate max-w-full px-0.5">{t(`nav.short.${v.key}`)}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function LangToggle({ className = '' }) {
  const { lang, dispatch } = useStore()
  return (
    <div className={`flex items-center rounded-full border-2 border-forest overflow-hidden shrink-0 ${className}`} role="group" aria-label="Language">
      {[['en', 'EN'], ['hi', 'हिंदी']].map(([k, l]) => (
        <button key={k} onClick={() => dispatch({ type: 'SET_LANG', lang: k })} aria-pressed={lang === k}
          className={`min-h-10 sm:min-h-12 px-3.5 sm:px-5 text-[15px] sm:text-lg font-semibold transition-colors ${lang === k ? 'bg-forest text-white' : 'bg-white text-forest'}`}
          style={k === 'hi' ? { fontFamily: '"Noto Sans Devanagari", Inter, sans-serif' } : undefined}>{l}</button>
      ))}
    </div>
  )
}
