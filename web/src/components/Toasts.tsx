import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import gsap from 'gsap'
import { useNet } from '../lib/net'
import { sfx } from '../lib/sound'
import { toast, useToasts, type Toast, type ToastKind } from '../lib/toast'
import './Toasts.css'

const ICON: Record<ToastKind, ReactElement> = {
  error: <path d="M8 8 L16 16 M16 8 L8 16" />,
  warn: <><path d="M12 6 L12 13" /><circle cx="12" cy="17.5" r="0.6" /></>,
  info: <><circle cx="12" cy="6.8" r="0.6" /><path d="M12 11 L12 18" /></>,
  success: <path d="M6.5 12.5 L10.5 16.5 L17.5 8" />,
}

/** Stack of dismissable, self-expiring notices. Also reports the socket dropping. */
export function Toasts() {
  const items = useToasts((s) => s.items)
  useConnectionToast()
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => <ToastCard key={t.id} t={t} />)}
    </div>
  )
}

function ToastCard({ t }: { t: Toast }) {
  const ref = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)
  const [paused, setPaused] = useState(false)
  const drag = useRef<{ x: number; dx: number; t: number; id: number } | null>(null)

  // pop in; replay a little wiggle when the same toast fires again
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (t.rev === 0) {
      gsap.fromTo(el, { y: -26, scale: 0.7, rotate: -5 }, { y: 0, scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.4)', clearProps: 'transform' })
    } else {
      gsap.fromTo(el, { rotate: -4, scale: 1.05 }, { rotate: 0, scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)', clearProps: 'transform' })
    }
  }, [t.rev])

  useEffect(() => {
    if (t.rev === 0 && (t.kind === 'error' || t.kind === 'warn')) sfx.bad()
  }, [t.rev, t.kind])

  const leave = (dir = 1) => {
    const el = ref.current
    if (!el || leaving.current) return
    leaving.current = true
    gsap.to(el, {
      x: dir * (el.offsetWidth + 40), rotate: dir * 10, duration: 0.38, ease: 'power3.in',
      onComplete: () => toast.dismiss(t.id),
    })
  }

  // swipe sideways to throw it away
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, dx: 0, t: performance.now(), id: e.pointerId }
    setPaused(true)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    d.dx = e.clientX - d.x
    if (Math.abs(d.dx) > 6 && !ref.current!.hasPointerCapture(e.pointerId)) ref.current!.setPointerCapture(e.pointerId)
    gsap.set(ref.current, { x: d.dx, rotate: d.dx / 24 })
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    setPaused(false)
    if (!d || d.id !== e.pointerId) return
    const w = ref.current!.offsetWidth
    const speed = Math.abs(d.dx) / Math.max(1, performance.now() - d.t)
    if (Math.abs(d.dx) > w * 0.3 || (speed > 0.6 && Math.abs(d.dx) > 20)) leave(Math.sign(d.dx) || 1)
    else gsap.to(ref.current, { x: 0, rotate: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' })
  }

  return (
    <div ref={ref} className={`toast k-${t.kind} ${paused ? 'paused' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && !drag.current && setPaused(false)}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <span className="toast-icon">
        <svg viewBox="0 0 24 24" aria-hidden>{ICON[t.kind]}</svg>
      </span>
      <p className="toast-msg">{t.msg}</p>
      <button className="toast-x" aria-label="Dismiss" onClick={() => { sfx.click(); leave(1) }}>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M7 7 L17 17 M17 7 L7 17" /></svg>
      </button>
      {t.ttl > 0 && (
        // the bar *is* the timer: when its animation ends the toast leaves, so pausing it pauses the TTL
        <i key={t.rev} className="toast-ttl" style={{ animationDuration: `${t.ttl}ms` }} onAnimationEnd={() => leave(1)} />
      )}
      {t.ttl === 0 && <i className="toast-wait" aria-hidden />}
    </div>
  )
}

/** "Reconnecting…" only after a short grace period, then "back" once it recovers. */
function useConnectionToast() {
  const status = useNet((s) => s.status)
  const shown = useRef(false)
  useEffect(() => {
    if (status === 'closed') {
      const timer = window.setTimeout(() => {
        shown.current = true
        toast.warn('Reconnecting to the party…', { id: 'conn', ttl: 0 })
      }, 1200)
      return () => clearTimeout(timer)
    }
    if (status === 'open' && shown.current) {
      shown.current = false
      toast.success('Back in the party!', { id: 'conn' })
    }
  }, [status])
}
