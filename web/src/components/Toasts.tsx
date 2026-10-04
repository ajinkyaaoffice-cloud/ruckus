import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import gsap from 'gsap'
import { api, reconnect, useNet } from '../lib/net'
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
  return (
    <div className="toasts" aria-live="polite">
      <ServerWake />
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

/* The free server sleeps when nobody has played for a while and needs roughly
   this long to boot again. */
const WAKE_SECS = 50
const SHOW_AFTER = 1500      // short blips never show anything
const BLIP = 4000            // after a drop, call it "reconnecting" this long before assuming a restart

type Outage = { start: number; first: boolean }

/** A pinned card while the line is down: a live countdown to when the server
    should be awake, then how long it actually took once it answers. */
function ServerWake() {
  const status = useNet((s) => s.status)
  const everOpen = useRef(false)
  const [outage, setOutage] = useState<Outage | null>(null)
  const [done, setDone] = useState<{ took: number; first: boolean } | null>(null)
  const [visible, setVisible] = useState(false)
  const [, tick] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // start / end an outage
  useEffect(() => {
    if (status === 'open') {
      if (outage && visible) setDone({ took: (Date.now() - outage.start) / 1000, first: outage.first })
      everOpen.current = true
      setOutage(null)
      return
    }
    if (!outage) setOutage({ start: Date.now(), first: !everOpen.current })
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // only show it if the outage outlasts a blip
  useEffect(() => {
    if (!outage) return
    const t = window.setTimeout(() => { setDone(null); setVisible(true) }, SHOW_AFTER)
    return () => clearTimeout(t)
  }, [outage])

  // tick the countdown in real time, and knock on the server's door every couple of seconds:
  // the moment it answers, dial straight in instead of waiting out the socket's backoff
  useEffect(() => {
    if (!outage || !visible) return
    let raf = 0
    const frame = () => { tick((n) => n + 1); raf = window.setTimeout(frame, 200) }
    frame()
    const knock = window.setInterval(async () => {
      try {
        const ctl = new AbortController()
        const t = window.setTimeout(() => ctl.abort(), 4000)
        const r = await fetch(api('/api/health'), { cache: 'no-store', signal: ctl.signal })
        clearTimeout(t)
        if (r.ok && useNet.getState().status !== 'open') reconnect()
      } catch { /* still asleep */ }
    }, 2500)
    return () => { clearTimeout(raf); clearInterval(knock) }
  }, [outage, visible])

  // the success card leaves on its own
  useEffect(() => {
    if (!done) return
    sfx.point()
    const t = window.setTimeout(() => {
      gsap.to(ref.current, { x: 440, rotate: 10, duration: 0.38, ease: 'power3.in', onComplete: () => { setVisible(false); setDone(null) } })
    }, 3400)
    return () => clearTimeout(t)
  }, [done])

  useLayoutEffect(() => {
    if (visible && ref.current) gsap.fromTo(ref.current, { y: -26, scale: 0.7, rotate: -5 }, { y: 0, scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.4)', clearProps: 'transform' })
  }, [visible])
  useLayoutEffect(() => {
    if (done && ref.current) gsap.fromTo(ref.current, { rotate: -4, scale: 1.06 }, { rotate: 0, scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)', clearProps: 'transform' })
  }, [done])

  if (!visible || (!outage && !done)) return null

  let kind: ToastKind = 'warn', title = '', sub = '', progress = 0, badge = '…'
  if (done) {
    kind = 'success'
    const took = Math.max(1, Math.round(done.took))
    const early = WAKE_SECS - took
    title = done.first || done.took * 1000 > BLIP ? `Server's awake — took ${took}s` : 'Back in the party!'
    sub = early >= 2 && done.took * 1000 > BLIP ? `${early}s sooner than expected. Let's go!` : 'All set.'
    progress = 1
  } else if (outage) {
    const el = (Date.now() - outage.start) / 1000
    const left = Math.ceil(WAKE_SECS - el)
    if (!outage.first && el * 1000 < BLIP) {
      title = 'Reconnecting to the party…'
      sub = 'Hang tight'
    } else if (left > 0) {
      title = outage.first ? 'Waking up the server…' : 'The server is restarting…'
      sub = `Ready in about ${left}s · it naps when nobody's playing`
      badge = String(left)
    } else {
      title = 'Almost there…'
      sub = `Taking a little longer than usual · ${Math.round(el)}s`
    }
    progress = Math.min(1, el / WAKE_SECS)
  }

  return (
    <div ref={ref} className={`toast wake k-${kind}`} role="status">
      <span className="toast-icon">
        {done ? <svg viewBox="0 0 24 24" aria-hidden>{ICON.success}</svg> : <span className="wake-num display">{badge}</span>}
      </span>
      <p className="toast-msg"><b>{title}</b><small>{sub}</small></p>
      <i className="wake-bar" style={{ transform: `scaleX(${progress})` }} />
    </div>
  )
}
