import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center print-modal-root" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/45 no-print" onClick={onClose} />
      <div className={`relative bg-canvas w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl print-modal`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 bg-white border-b border-line no-print">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="grid place-items-center size-11 rounded-xl hover:bg-[#EEEBE5]" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="p-5 sm:p-7">{children}</div>
      </div>
    </div>
  )
}
