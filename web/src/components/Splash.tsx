import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Logotype from './Logotype'
import Glyph from './Glyph'
import { lowPower } from '../lib/perf'
import { toast } from '../lib/toast'
import './Splash.css'

declare const __BUILD_ID__: string
declare const __BUILD_AT__: number

const SEEN = 'ruckus-build'
const POLL = 60_000

function seenBuild(): string | null {
  try { return localStorage.getItem(SEEN) } catch { return null }
}
function markSeen() {
  try { localStorage.setItem(SEEN, __BUILD_ID__) } catch { /* private mode */ }
}

/**
 * Plays once on the first load after each deploy: the logo assembles piece by
 * piece over the brand colours with a "fresh update" tag. Tap to skip.
 * Also keeps an eye on /version.json so open tabs learn about newer deploys.
 */
export default function Splash() {
  const [show, setShow] = useState(() => seenBuild() !== __BUILD_ID__)
  const first = useRef(seenBuild() === null)
  const root = useRef<HTMLDivElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)

  useLayoutEffect(() => {
    if (!show) return
    markSeen()
    const el = root.current!
    const ctx = gsap.context(() => {
      const t = gsap.timeline({ onComplete: () => setShow(false) })
      tl.current = t
      t.fromTo('.lt-piece', { scale: 0, rotate: () => gsap.utils.random(-120, 120), transformOrigin: '50% 50%', y: () => gsap.utils.random(-80, 80) },
        { scale: 1, rotate: 0, y: 0, duration: lowPower ? 0.45 : 0.6, ease: 'back.out(2)', stagger: { each: lowPower ? 0.03 : 0.045, from: 'random' } })
        .fromTo('.sp-glyph', { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(3)', stagger: 0.08 }, 0.2)
        .fromTo('.sp-tag', { yPercent: 120, autoAlpha: 0, rotate: 8 }, { yPercent: 0, autoAlpha: 1, rotate: -3, duration: 0.45, ease: 'back.out(2.4)' }, '-=0.25')
        .fromTo('.sp-sub', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.3 }, '-=0.2')
        .to({}, { duration: 0.9 })
        .to('.sp-logo', { scale: 1.15, autoAlpha: 0, duration: 0.3, ease: 'power2.in' })
        .to(el, { clipPath: 'circle(0% at 50% 50%)', duration: 0.5, ease: 'power3.inOut' }, '-=0.1')
    }, el)
    return () => ctx.revert()
  }, [show])

  // a newer deploy while this tab is open: offer a refresh (never forced mid-game)
  useEffect(() => {
    if (!import.meta.env.PROD) return
    let told = false
    const check = async () => {
      if (told || document.hidden) return
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const { id } = await r.json()
        if (id && id !== __BUILD_ID__) {
          told = true
          toast.info('A fresh update of Ruckus is out — refresh when you’re between games', { id: 'update', ttl: 12000 })
          showRefresh()
        }
      } catch { /* offline: try again later */ }
    }
    const id = window.setInterval(check, POLL)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check) }
  }, [])

  if (!show) return null
  const when = new Date(__BUILD_AT__).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <div ref={root} className="sp" onClick={() => tl.current?.progress(1)} role="presentation">
      <div className="sp-bg" aria-hidden>
        <span className="sp-glyph g1"><Glyph name="x" color="#e64fe0" size={120} /></span>
        <span className="sp-glyph g2"><Glyph name="o" color="#a7ecff" size={96} /></span>
        <span className="sp-glyph g3"><Glyph name="star" color="#d9f66b" size={80} /></span>
        <span className="sp-glyph g4"><Glyph name="heart" color="#ffb424" size={70} /></span>
      </div>
      <div className="sp-logo">
        <Logotype className="sp-mark" color="#fff" />
        <span className="sp-tag display">{first.current ? 'Let’s get loud' : 'Fresh update!'}</span>
        <span className="sp-sub">{first.current ? 'Party games for tiny crowds' : `New build · ${when}`}</span>
      </div>
    </div>
  )
}

/** A floating "refresh" pill once a newer build is out. */
function showRefresh() {
  if (document.querySelector('.sp-refresh')) return
  const b = document.createElement('button')
  b.className = 'sp-refresh display'
  b.textContent = 'Refresh for the update'
  b.onclick = () => location.reload()
  document.body.appendChild(b)
}
