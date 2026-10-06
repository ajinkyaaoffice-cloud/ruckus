import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Logotype from './Logotype'
import Glyph from './Glyph'
import { lowPower } from '../lib/perf'
import { toast } from '../lib/toast'
import { CHANGELOG, markReleasesSeen, unseenReleases, type Release } from '../lib/changelog'
import './Splash.css'

declare const __BUILD_ID__: string
declare const __BUILD_AT__: number

const SEEN = 'ruckus-build'
const OPEN_NEWS = 'ruckus:news'

/** Reopen the splash as a "what's new" sheet (from the menu). */
export function showWhatsNew() {
  window.dispatchEvent(new Event(OPEN_NEWS))
}
const POLL = 60_000

function seenBuild(): string | null {
  try { return localStorage.getItem(SEEN) } catch { return null }
}
function markSeen() {
  try { localStorage.setItem(SEEN, __BUILD_ID__) } catch { /* private mode */ }
}

/**
 * Shows on the first load after each deploy: the logo assembles piece by piece
 * over the brand colours with a "fresh update" tag, then waits for a tap on the
 * button so nobody misses that something changed. Tapping early skips to the button.
 * Also keeps an eye on /version.json so open tabs learn about newer deploys.
 */
export default function Splash() {
  // 'update': first load after a deploy; 'news': reopened from the menu to reread the changelog
  const [mode, setMode] = useState<'update' | 'news' | null>(() => (seenBuild() !== __BUILD_ID__ ? 'update' : null))
  const show = mode !== null
  const first = useRef(seenBuild() === null)
  // what changed since this player's last visit (nothing to list on a first visit)
  const [news, setNews] = useState<Release[]>(() => (first.current ? [] : unseenReleases()))

  useEffect(() => {
    const open = () => {
      first.current = false
      leaving.current = false
      setNews(CHANGELOG.slice(0, 4))
      setMode('news')
    }
    window.addEventListener(OPEN_NEWS, open)
    return () => window.removeEventListener(OPEN_NEWS, open)
  }, [])

  // Escape (or Enter once the animation's done) closes it; any key skips the intro
  useEffect(() => {
    if (!show) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
      else if (tl.current && tl.current.progress() < 1) tl.current.progress(1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  const root = useRef<HTMLDivElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const leaving = useRef(false)

  useLayoutEffect(() => {
    if (!show) return
    const el = root.current!
    const ctx = gsap.context(() => {
      const t = gsap.timeline()
      tl.current = t
      t.fromTo('.lt-piece', { scale: 0, rotate: () => gsap.utils.random(-120, 120), transformOrigin: '50% 50%', y: () => gsap.utils.random(-80, 80) },
        { scale: 1, rotate: 0, y: 0, duration: lowPower ? 0.45 : 0.6, ease: 'back.out(2)', stagger: { each: lowPower ? 0.03 : 0.045, from: 'random' } })
        .fromTo('.sp-glyph', { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(3)', stagger: 0.08 }, 0.2)
        .fromTo('.sp-tag', { yPercent: 120, autoAlpha: 0, rotate: 8 }, { yPercent: 0, autoAlpha: 1, rotate: -3, duration: 0.45, ease: 'back.out(2.4)' }, '-=0.25')
        .fromTo('.sp-sub', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.3 }, '-=0.2')
        .fromTo('.sp-news', { autoAlpha: 0, y: 30, rotate: -2 }, { autoAlpha: 1, y: 0, rotate: 0, duration: 0.45, ease: 'back.out(1.8)' }, '-=0.1')
        .fromTo('.sp-news li', { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.35, ease: 'back.out(2)', stagger: lowPower ? 0.03 : 0.06 }, '-=0.2')
        .fromTo('.sp-go', { scale: 0, rotate: -10 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2.6)',
          onComplete: () => el.querySelector<HTMLButtonElement>('.sp-go')?.focus({ preventScroll: true }) }, '-=0.1')
    }, el)
    return () => ctx.revert()
  }, [show])

  const dismiss = () => {
    if (leaving.current || !root.current) return
    leaving.current = true
    markSeen()
    markReleasesSeen()
    tl.current?.progress(1)
    gsap.timeline({ onComplete: () => setMode(null) })
      .to(root.current.querySelector('.sp-logo'), { scale: 1.15, autoAlpha: 0, duration: 0.3, ease: 'power2.in' })
      .to(root.current, { clipPath: 'circle(0% at 50% 50%)', duration: 0.5, ease: 'power3.inOut' }, '-=0.1')
  }

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
    <div ref={root} className={`sp ${news.length ? 'sp-has-news' : ''}`} onClick={() => tl.current?.progress(1)} role="dialog" aria-modal="true" aria-label={first.current ? 'Welcome to Ruckus' : 'Ruckus has been updated'}>
      <div className="sp-bg" aria-hidden>
        <span className="sp-glyph g1"><Glyph name="x" color="#e64fe0" size={120} /></span>
        <span className="sp-glyph g2"><Glyph name="o" color="#a7ecff" size={96} /></span>
        <span className="sp-glyph g3"><Glyph name="star" color="#d9f66b" size={80} /></span>
        <span className="sp-glyph g4"><Glyph name="heart" color="#ffb424" size={70} /></span>
      </div>
      <div className="sp-logo">
        <Logotype className="sp-mark" color="#fff" />
        <span className="sp-tag display">{first.current ? 'Let’s get loud' : mode === 'news' ? 'What’s new' : 'Fresh update!'}</span>
        <span className="sp-sub">{first.current ? 'Party games for tiny crowds' : mode === 'news' ? `This build · ${when}` : `New build · ${when}`}</span>
        {news.length > 0 && (
          <section className="sp-news" aria-label="What's new">
            {/* the newest release open, anything older folded away */}
            <Rel r={news[0]} />
            {news.length > 1 && (
              <details className="sp-older">
                <summary>Earlier updates <small>({news.length - 1})</small></summary>
                {news.slice(1).map((r) => <Rel key={r.id} r={r} />)}
              </details>
            )}
          </section>
        )}
        <button className="sp-go bubble-btn big magenta" onClick={(e) => { e.stopPropagation(); dismiss() }}>
          {first.current ? 'Let’s play' : mode === 'news' ? 'Back to it' : 'Got it, let’s go'}
        </button>
        {!first.current && <span className="sp-keys">press Esc to close</span>}
      </div>
    </div>
  )
}

function Rel({ r }: { r: Release }) {
  return (
    <div className="sp-rel">
      <h3 className="display">{r.title}</h3>
      <ul>{r.items.map((it) => <li key={it}>{it}</li>)}</ul>
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
