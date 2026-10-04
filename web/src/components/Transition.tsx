import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import Glyph, { type GlyphName } from './Glyph'
import { sfx } from '../lib/sound'
import './Transition.css'

/**
 * Page transitions are painted, not faded: three giant rough-edged brush
 * strokes sweep across the screen, a chunky label slams into the middle with a
 * burst of glyphs, the route swaps underneath, then the strokes keep travelling
 * and wipe themselves off the other side.
 */
type GoOptions = { label?: string; colors?: [string, string, string]; reverse?: boolean; replace?: boolean }
type Ctx = { go: (to: string, opts?: GoOptions) => Promise<void>; busy: () => boolean }

const TransitionCtx = createContext<Ctx>({ go: async () => {}, busy: () => false })
export const useTransition = () => useContext(TransitionCtx)

const BURST: { g: GlyphName; c: string }[] = [
  { g: 'x', c: '#fff' }, { g: 'o', c: '#d9f66b' }, { g: 'star', c: '#ffb424' }, { g: 'squiggle', c: '#a7ecff' },
  { g: 'tri', c: '#fff' }, { g: 'plus', c: '#e64fe0' }, { g: 'bolt', c: '#d9f66b' }, { g: 'heart', c: '#ff9a62' },
  { g: 'x', c: '#a7ecff' }, { g: 'o', c: '#fff' }, { g: 'burst', c: '#ffb424' }, { g: 'moon', c: '#fff' },
]

export function TransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const svg = useRef<SVGSVGElement>(null)
  const label = useRef<HTMLDivElement>(null)
  const glyphs = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)

  const go = useCallback(async (to: string, opts: GoOptions = {}) => {
    if (busyRef.current) return
    busyRef.current = true
    const el = svg.current!
    const w = window.innerWidth, h = window.innerHeight
    el.setAttribute('viewBox', `0 0 ${w} ${h}`)
    el.style.transform = opts.reverse ? 'scaleX(-1)' : ''
    const colors = opts.colors ?? ['#e64fe0', '#a596ff', '#1d3a6e']
    const paths = Array.from(el.querySelectorAll<SVGPathElement>('path.tr-stroke'))
    const sw = h * 0.46
    const rows = [0.16, 0.5, 0.84]
    paths.forEach((p, i) => {
      const y = rows[i] * h
      const dy = h * 0.07 * (i % 2 ? -1 : 1)
      p.setAttribute('d', `M ${-sw} ${y + dy} C ${w * 0.3} ${y - dy}, ${w * 0.7} ${y + dy * 1.4}, ${w + sw} ${y - dy}`)
      p.setAttribute('stroke-width', String(sw))
      p.setAttribute('stroke', colors[i])
      const len = p.getTotalLength()
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len })
    })
    const lab = label.current!
    lab.textContent = opts.label ?? ''
    const kids = Array.from(glyphs.current!.children) as HTMLElement[]
    const rnd = gsap.utils.random
    gsap.set(kids, { x: 0, y: 0, scale: 0, rotate: 0 })
    gsap.set(lab, { scale: 0, rotate: -24, yPercent: 0 })
    document.documentElement.classList.add('is-transitioning')
    sfx.whoosh()

    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve })
      tl.set(el.parentElement, { visibility: 'visible' })
        .to(paths, { strokeDashoffset: 0, duration: 0.62, ease: 'power3.in', stagger: 0.07 })
        .to(lab, { scale: 1, rotate: -6, duration: 0.5, ease: 'back.out(2.6)', onStart: () => opts.label && sfx.slam() }, 0.42)
        .to(kids, {
          x: () => rnd(-w * 0.42, w * 0.42), y: () => rnd(-h * 0.38, h * 0.38),
          scale: () => rnd(0.6, 1.4), rotate: () => rnd(-200, 200),
          duration: 0.7, ease: 'expo.out', stagger: 0.012,
        }, 0.5)
    })

    if (opts.replace) navigate(to, { replace: true })
    else navigate(to)
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, opts.label ? 380 : 160))

    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve })
      tl.to(lab, { scale: 0, rotate: 14, duration: 0.32, ease: 'back.in(2)' })
        .to(kids, { x: (i) => (i % 2 ? '+=' : '-=') + w * 0.6, scale: 0, rotate: '+=180', duration: 0.6, ease: 'power3.in', stagger: 0.01 }, 0)
        .to(paths, {
          strokeDashoffset: (_i: number, t: SVGPathElement) => -t.getTotalLength(),
          duration: 0.68, ease: 'power3.inOut', stagger: 0.06,
        }, 0.08)
        .set(el.parentElement, { visibility: 'hidden' })
    })
    document.documentElement.classList.remove('is-transitioning')
    busyRef.current = false
  }, [navigate])

  const value = useMemo(() => ({ go, busy: () => busyRef.current }), [go])

  return (
    <TransitionCtx.Provider value={value}>
      {children}
      <div className="tr-root" aria-hidden>
        <svg ref={svg} className="tr-svg" preserveAspectRatio="none">
          <defs>
            <filter id="tr-rough" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="2" seed="3" />
              <feDisplacementMap in="SourceGraphic" scale="46" />
            </filter>
          </defs>
          <g filter="url(#tr-rough)">
            <path className="tr-stroke" fill="none" strokeLinecap="round" />
            <path className="tr-stroke" fill="none" strokeLinecap="round" />
            <path className="tr-stroke" fill="none" strokeLinecap="round" />
          </g>
        </svg>
        <div ref={glyphs} className="tr-glyphs">
          {BURST.map((b, i) => (
            <div key={i} className="tr-glyph">
              <Glyph name={b.g} color={b.c} size={i % 3 ? 54 : 84} />
            </div>
          ))}
        </div>
        <div ref={label} className="tr-label display" />
      </div>
    </TransitionCtx.Provider>
  )
}
