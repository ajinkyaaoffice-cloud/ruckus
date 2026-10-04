import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { sfx } from '../lib/sound'

/**
 * "Rux", the site mascot: a jelly blob whose outline is re-generated every
 * frame from layered sine noise, with googly eyes that chase the pointer,
 * random blinks, and a squash-and-giggle when poked.
 */
const SKINS = [
  { body: '#e64fe0', belly: '#f6b8f7', cheek: '#ff9a62' },
  { body: '#45b8ff', belly: '#a7ecff', cheek: '#e64fe0' },
  { body: '#ffb424', belly: '#ffe3a3', cheek: '#ff6b7d' },
  { body: '#a596ff', belly: '#ddd7ff', cheek: '#e64fe0' },
  { body: '#9bd63a', belly: '#d9f66b', cheek: '#ff9a62' },
]

function blobPath(t: number, r: number, cx: number, cy: number, squash: number): string {
  const n = 48
  let d = ''
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + 0.045 * Math.sin(3 * a + t * 1.7) + 0.03 * Math.sin(5 * a - t * 2.3) + 0.02 * Math.sin(2 * a + t)
    // flatter bottom, squash/stretch vertically
    const x = cx + Math.cos(a) * r * k * (1 + squash * 0.18)
    let y = cy + Math.sin(a) * r * k * (1 - squash * 0.2)
    if (Math.sin(a) > 0.55) y = cy + (y - cy) * 0.94
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return d + 'Z'
}

export default function Mascot({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const body = useRef<SVGPathElement>(null)
  const shadow = useRef<SVGPathElement>(null)
  const eyes = useRef<SVGGElement>(null)
  const lids = useRef<SVGGElement>(null)
  const mouth = useRef<SVGPathElement>(null)
  const [skin, setSkin] = useState(0)
  const squash = useRef({ v: 0 })

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = (now: number) => {
      const t = (now - t0) / 1000
      const s = squash.current.v
      body.current?.setAttribute('d', blobPath(t, 74, 100, 108, s))
      shadow.current?.setAttribute('d', blobPath(t + 0.3, 74, 100, 116, s))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const pupils = eyes.current!.querySelectorAll<SVGCircleElement>('.mx-pupil')
    const tos = Array.from(pupils).map((p) => ({ x: gsap.quickTo(p, 'x', { duration: 0.35, ease: 'power3' }), y: gsap.quickTo(p, 'y', { duration: 0.35, ease: 'power3' }) }))
    const move = (e: PointerEvent) => {
      const r = svg.current!.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.42)
      const len = Math.hypot(dx, dy) || 1, k = Math.min(1, len / 300)
      tos.forEach((p) => { p.x((dx / len) * 7 * k); p.y((dy / len) * 7 * k) })
    }
    window.addEventListener('pointermove', move)

    const blink = () => {
      gsap.fromTo(lids.current!.children, { scaleY: 0 }, { scaleY: 1, duration: 0.07, yoyo: true, repeat: 1, transformOrigin: '50% 0%', ease: 'power1.in' })
      timer = window.setTimeout(blink, 1800 + Math.random() * 3200)
    }
    let timer = window.setTimeout(blink, 1500)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); clearTimeout(timer) }
  }, [])

  const poke = () => {
    sfx.pop()
    setTimeout(() => sfx.tap(), 90)
    gsap.timeline()
      .to(squash.current, { v: 1, duration: 0.1, ease: 'power2.out' })
      .to(squash.current, { v: 0, duration: 0.9, ease: 'elastic.out(1.2, 0.25)' })
    gsap.fromTo(mouth.current, { scaleY: 1 }, { scaleY: 1.8, duration: 0.15, yoyo: true, repeat: 1, transformOrigin: '50% 0%' })
    gsap.fromTo(svg.current, { rotate: 0 }, { rotate: gsap.utils.random(-12, 12), duration: 0.12, yoyo: true, repeat: 1 })
    setSkin((s) => (s + 1) % SKINS.length)
  }

  const c = SKINS[skin]
  return (
    <svg ref={svg} viewBox="0 0 200 200" className={className} onClick={poke} data-cursor="POKE" style={{ overflow: 'visible' }}>
      <ellipse cx="100" cy="192" rx="62" ry="8" fill="#1d3a6e" opacity="0.18" />
      <path ref={shadow} fill="#1d3a6e" />
      <path ref={body} fill={c.body} style={{ transition: 'fill .3s' }} />
      {/* party hat */}
      <g transform="rotate(14 100 30)">
        <path d="M84 44 L100 4 L116 44 Z" fill="#d9f66b" stroke="#1d3a6e" strokeWidth="4" strokeLinejoin="round" />
        <path d="M90 30 L110 30 M87 38 L113 38" stroke="#e64fe0" strokeWidth="4" />
        <circle cx="100" cy="4" r="6" fill="#ffb424" stroke="#1d3a6e" strokeWidth="3" />
      </g>
      <ellipse cx="100" cy="132" rx="40" ry="28" fill={c.belly} opacity="0.55" />
      <g ref={eyes}>
        {[74, 126].map((x) => (
          <g key={x}>
            <circle cx={x} cy="88" r="19" fill="#fff" stroke="#1d3a6e" strokeWidth="4" />
            <circle className="mx-pupil" cx={x} cy="88" r="8.5" fill="#1d3a6e" />
          </g>
        ))}
      </g>
      <g ref={lids}>
        {[74, 126].map((x) => <rect key={x} x={x - 21} y="67" width="42" height="42" rx="21" fill={c.body} style={{ transform: 'scaleY(0)' }} />)}
      </g>
      <circle cx="54" cy="116" r="9" fill={c.cheek} opacity="0.6" />
      <circle cx="146" cy="116" r="9" fill={c.cheek} opacity="0.6" />
      <path ref={mouth} d="M84 118 Q100 140 116 118 Q100 126 84 118Z" fill="#1d3a6e" stroke="#1d3a6e" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}
