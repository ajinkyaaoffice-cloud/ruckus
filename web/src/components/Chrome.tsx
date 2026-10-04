import { useEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { useNet } from '../lib/net'
import { isMuted, onMuted, setMuted, sfx } from '../lib/sound'
import { useTransition } from './Transition'
import './Chrome.css'

/** Split a string into per-character spans (words kept together) for staggered motion. */
export function Split({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((w, wi, arr) => (
        <span key={wi} className="split-word" aria-hidden>
          {Array.from(w).map((ch, ci) => (
            <span key={ci} className="split-char">{ch}</span>
          ))}
          {wi < arr.length - 1 && <span className="split-char">&nbsp;</span>}
        </span>
      ))}
    </span>
  )
}

/** Giant faint brush X / O marks drifting behind app screens (XOX vibes). */
export function BrushMarks({ color = '#ffffff', opacity = 0.28 }: { color?: string; opacity?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const marks = ref.current!.querySelectorAll('.bm')
    const tw = gsap.to(marks, { rotate: '+=8', y: '+=24', duration: 6, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 1.2 })
    const paths = ref.current!.querySelectorAll<SVGPathElement>('path')
    paths.forEach((p) => {
      const l = p.getTotalLength()
      gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 1.1, ease: 'power3.out', delay: 0.3 + Math.random() * 0.6 })
    })
    return () => { tw.kill() }
  }, [])
  return (
    <svg ref={ref} className="brush-marks" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <filter id="bm-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.03 0.2" numOctaves="2" seed="8" />
          <feDisplacementMap in="SourceGraphic" scale="14" />
        </filter>
      </defs>
      <g filter="url(#bm-rough)" fill="none" stroke={color} strokeLinecap="round" opacity={opacity} strokeWidth="70">
        <g className="bm"><path d="M-40 120 L240 420" /><path d="M240 110 L-30 430" /></g>
        <g className="bm"><path d="M880 640 A120 120 0 1 1 879 640" /></g>
        <g className="bm"><path d="M700 -60 L960 260" /><path d="M960 -40 L690 250" /></g>
        <g className="bm"><path d="M150 800 A90 90 0 1 1 149 800" /></g>
      </g>
    </svg>
  )
}

export function SoundToggle() {
  const [m, setM] = useState(isMuted())
  useEffect(() => { const off = onMuted(setM); return () => { off() } }, [])
  return (
    <button className="icon-btn" onClick={() => { setMuted(!m); if (m) sfx.pop() }} data-cursor={m ? 'SOUND ON' : 'MUTE'} aria-label="Toggle sound">
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {m ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          : <path d="M16 8c2 2 2 6 0 8M18.5 5.5c3.5 3.5 3.5 9.5 0 13" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      </svg>
    </button>
  )
}

export function Logo({ onClick, small }: { onClick?: () => void; small?: boolean }) {
  const { go } = useTransition()
  return (
    <button className={`logo display ${small ? 'small' : ''}`} onClick={onClick ?? (() => go('/', { label: 'HOME', reverse: true }))} data-cursor="HOME">
      <span>R</span><span>u</span><span>c</span><span>k</span><span>u</span><span>s</span>
    </button>
  )
}

export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-side">{left ?? <Logo small />}</div>
      <div className="topbar-side right">{right}<SoundToggle /></div>
    </header>
  )
}

/** Error toasts that bounce in from the bottom whenever the server rejects something. */
export function Toasts() {
  const error = useNet((s) => s.error)
  const status = useNet((s) => s.status)
  const [items, setItems] = useState<{ key: number; msg: string }[]>([])
  useEffect(() => {
    if (!error) return
    sfx.bad()
    setItems((it) => [...it.slice(-2), error])
    const t = setTimeout(() => setItems((it) => it.filter((x) => x.key !== error.key)), 2800)
    return () => clearTimeout(t)
  }, [error])
  return (
    <div className="toasts">
      {status === 'closed' && <div className="toast warn">Reconnecting to the party…</div>}
      {items.map((t) => <div key={t.key} className="toast">{t.msg}</div>)}
    </div>
  )
}
