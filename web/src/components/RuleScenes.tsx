import { useLayoutEffect, useRef, type ComponentType, type ReactNode } from 'react'
import gsap from 'gsap'
import { GLYPH_PATHS, type GlyphName } from './Glyph'
import { reducedMotion } from '../lib/perf'

/**
 * Tiny looping demos for the rulebook. Every scene is a 240x150 SVG whose
 * timeline starts by `set`-ing every piece into place, so each repeat begins
 * from a clean board. Colours come from the book's theme (--rs-ink, --rs-bg).
 */

const ME = '#e64fe0'
const YOU = '#45b8ff'
const CH: Record<string, string> = { red: '#ff5d73', yellow: '#ffc93c', green: '#43d17a', blue: '#3d8bff', wild: '#1b1f3f' }

type Build = (tl: gsap.core.Timeline, svg: SVGSVGElement) => void

function Scene({ build, children }: { build: Build; children: ReactNode }) {
  const ref = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const svg = ref.current!
    const ctx = gsap.context(() => {
      gsap.set(svg.querySelectorAll('[data-o]'), { transformOrigin: '50% 50%' })
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1, defaults: { duration: 0.4, ease: 'power2.out' } })
      build(tl, svg)
      // reduced motion: show the finished picture instead of looping
      if (reducedMotion) tl.pause(tl.duration() - 0.05)
    }, svg)
    return () => ctx.revert()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return <svg ref={ref} className="rs" viewBox="0 0 240 150" aria-hidden>{children}</svg>
}

/* ---------- bits ---------- */

function Pill({ cls, x, y, text, bg = '#1d3a6e', fg = '#fff' }: { cls: string; x: number; y: number; text: string; bg?: string; fg?: string }) {
  const w = text.length * 5.4 + 16
  return (
    <g className={cls} data-o>
      <rect x={x - w / 2} y={y - 9} width={w} height={18} rx={9} fill={bg} />
      <text x={x} y={y} dy="0.36em" textAnchor="middle" className="rs-pill" fill={fg}>{text}</text>
    </g>
  )
}

/** A fingertip: press it with `tap()` to make the ring ripple. */
function Tap({ cls = 'tap', color = '#1d3a6e' }: { cls?: string; color?: string }) {
  return (
    <g className={cls}>
      <circle className="tap-ring" r={10} fill="none" stroke={color} strokeWidth={2} data-o />
      <circle r={6} fill="#fff" stroke={color} strokeWidth={2.5} />
    </g>
  )
}
function tap(tl: gsap.core.Timeline, sel: string, pos?: gsap.Position) {
  tl.fromTo(`${sel} .tap-ring`, { scale: 0.4, opacity: 1 }, { scale: 2.2, opacity: 0, duration: 0.45 }, pos)
}

function G({ name, color, size = 20, cls }: { name: GlyphName; color: string; size?: number; cls?: string }) {
  const g = GLYPH_PATHS[name]
  const k = size / 100
  return (
    <path className={cls} d={g.d} transform={`translate(${-size / 2} ${-size / 2}) scale(${k})`}
      fill={g.stroke ? 'none' : color} stroke={g.stroke ? color : 'none'} strokeWidth={g.stroke ? 14 : 0} strokeLinecap="round" strokeLinejoin="round" />
  )
}

function MiniCard({ cls, c, t, back }: { cls: string; c?: string; t?: string; back?: boolean }) {
  const col = back ? '#1b1f3f' : CH[c ?? 'red']
  return (
    <g className={cls} data-o>
      <rect x={-17} y={-25} width={34} height={50} rx={5} fill="#fff" stroke="rgba(27,31,63,.3)" />
      <rect className="in" x={-14} y={-22} width={28} height={44} rx={3.5} fill={col} />
      <ellipse rx={10.5} ry={17} transform="rotate(28)" fill={back ? '#ff5d73' : '#fff'} />
      {back && <text dy="0.36em" textAnchor="middle" transform="rotate(-18)" className="rs-uno">UNO</text>}
      {!back && c === 'wild' && !t && (
        <g transform="rotate(28)">
          <path d="M0 0 L0 -15 A10 15 0 0 1 9 0 Z" fill={CH.red} />
          <path d="M0 0 L9 0 A10 15 0 0 1 0 15 Z" fill={CH.blue} />
          <path d="M0 0 L0 15 A10 15 0 0 1 -9 0 Z" fill={CH.yellow} />
          <path d="M0 0 L-9 0 A10 15 0 0 1 0 -15 Z" fill={CH.green} />
        </g>
      )}
      {!back && t && <text dy="0.36em" textAnchor="middle" className="rs-num" fontSize={t.length > 1 ? 13 : 18} fill={col}>{t}</text>}
    </g>
  )
}

const hand = (sel: string, x: number, y: number, r = 0) => [sel, { x, y, rotation: r, opacity: 1, scale: 1, scaleX: 1 }] as const

/* ---------- UNO ---------- */

const UnoMatch = () => (
  <Scene build={(tl) => {
    tl.set(...hand('.pile', 120, 46, -4)).set(...hand('.a', 72, 120, -10)).set(...hand('.b', 120, 116)).set(...hand('.d', 168, 120, 10))
      .set('.l1, .l2, .no', { opacity: 0, scale: 0.4 })
      .to('.a', { y: 104, duration: 0.25 }, 0.4)
      .to('.a', { x: 122, y: 44, rotation: 6, duration: 0.55, ease: 'back.out(1.3)' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '-=0.1')
      .to('.l1', { opacity: 0, duration: 0.25 }, '+=1')
      .to('.b', { y: 100, duration: 0.25 })
      .to('.b', { x: 118, y: 42, rotation: -5, duration: 0.55, ease: 'back.out(1.3)' })
      .to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '-=0.1')
      .to('.d', { rotation: 18, duration: 0.08, yoyo: true, repeat: 5 }, '+=0.4')
      .to('.no', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
  }}>
    <MiniCard cls="pile" c="red" t="7" />
    <MiniCard cls="d" c="green" t="4" />
    <MiniCard cls="a" c="red" t="2" />
    <MiniCard cls="b" c="blue" t="7" />
    <Pill cls="l1" x={192} y={40} text="same colour!" bg={CH.red} />
    <Pill cls="l2" x={192} y={40} text="same number!" bg={CH.blue} />
    <Pill cls="no" x={200} y={84} text="nope" bg="#fff" fg="#1b1f3f" />
  </Scene>
)

const UnoDraw = () => (
  <Scene build={(tl) => {
    tl.set(...hand('.pile', 170, 46, 4)).set(...hand('.h1', 84, 120, -8)).set(...hand('.h2', 156, 120, 8))
      .set('.dr', { x: 70, y: 46, rotation: 0, scaleX: 1 }).set('.dr .front', { opacity: 0 }).set('.dr .back', { opacity: 1 })
      .set('.tap', { x: 82, y: 60, opacity: 0 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
      .to('.h1, .h2', { rotation: '+=10', duration: 0.08, yoyo: true, repeat: 5 }, 0.3)
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
      .to('.l1', { opacity: 0 }, '+=0.6')
      .to('.tap', { opacity: 1, duration: 0.2 })
    tap(tl, '.tap')
    tl.to('.tap', { opacity: 0, duration: 0.2 })
      .to('.dr', { x: 120, y: 112, duration: 0.5, ease: 'power3.out' }, '<')
      .to('.dr', { scaleX: 0, duration: 0.15, ease: 'power1.in' })
      .set('.dr .front', { opacity: 1 }).set('.dr .back', { opacity: 0 })
      .to('.dr', { scaleX: 1, duration: 0.2, ease: 'back.out(2)' })
      .to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .to('.dr', { x: 168, y: 44, rotation: -6, duration: 0.55, ease: 'back.out(1.3)' }, '+=0.5')
  }}>
    <MiniCard cls="deck0" back />
    <g transform="translate(73 49)"><MiniCard cls="deck1" back /></g>
    <MiniCard cls="pile" c="yellow" t="3" />
    <MiniCard cls="h1" c="blue" t="5" />
    <MiniCard cls="h2" c="green" t="9" />
    <g className="dr" data-o>
      <g className="back"><MiniCard cls="x" back /></g>
      <g className="front"><MiniCard cls="x" c="yellow" t="8" /></g>
    </g>
    <Tap />
    <Pill cls="l1" x={120} y={80} text="nothing fits…" />
    <Pill cls="l2" x={198} y={112} text="it fits!" bg={CH.yellow} fg="#1b1f3f" />
  </Scene>
)

const UnoActions = () => (
  <Scene build={(tl) => {
    tl.set('.k1, .k2, .k3', { scale: 0, rotation: -30, y: 56 }).set('.k1', { x: 50 }).set('.k2', { x: 120 }).set('.k3', { x: 190 })
      .set('.p1, .p2, .p3', { opacity: 0, scale: 0.4 })
    ;(['1', '2', '3'] as const).forEach((n, i) => {
      tl.to(`.k${n}`, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.4)' }, i === 0 ? 0.3 : '+=0.35')
        .to(`.p${n}`, { opacity: 1, scale: 1, ease: 'back.out(3)' }, '-=0.2')
    })
    tl.to('.k1', { rotation: 360, duration: 0.6, ease: 'power2.inOut' }, '+=0.3')
      .to('.k2', { rotation: 180, duration: 0.5, yoyo: true, repeat: 1 }, '<0.2')
      .to('.k3', { y: 48, duration: 0.15, yoyo: true, repeat: 3 }, '<0.2')
  }}>
    <MiniCard cls="k1" c="red" t="⊘" />
    <MiniCard cls="k2" c="green" t="⇅" />
    <MiniCard cls="k3" c="blue" t="+2" />
    <Pill cls="p1" x={50} y={112} text="skip next" />
    <Pill cls="p2" x={120} y={112} text="turn around" />
    <Pill cls="p3" x={190} y={112} text="draw 2" />
  </Scene>
)

const UnoWild = () => (
  <Scene build={(tl) => {
    tl.set(...hand('.w', 74, 64, -6)).set('.w .in', { fill: CH.wild }).set('.w4', { x: 260, y: 64, rotation: 20 })
      .set('.wheel', { x: 172, y: 64, scale: 0, rotation: 0 }).set('.tap', { x: 186, y: 78, opacity: 0 })
      .set('.l1, .l2', { opacity: 0, scale: 0.4 }).set('.bk', { x: 74, y: 64, opacity: 0, scale: 0.6 })
      .to('.wheel', { scale: 1, rotation: 360, duration: 0.8, ease: 'back.out(1.6)' }, 0.3)
      .to('.tap', { opacity: 1, duration: 0.2 })
    tap(tl, '.tap')
    tl.to('.w .in', { fill: CH.blue, duration: 0.3 }, '<')
      .to('.w', { scale: 1.12, duration: 0.15, yoyo: true, repeat: 1 }, '<')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .to('.wheel, .tap, .l1', { opacity: 0, duration: 0.25 }, '+=0.8')
      .to('.w4', { x: 78, rotation: 4, duration: 0.6, ease: 'back.out(1.4)' })
      .to('.bk', { opacity: 1, scale: 0.5, x: (i: number) => 150 + i * 18, y: 70, rotation: (i: number) => -10 + i * 7, stagger: 0.1, duration: 0.45, ease: 'back.out(2)' })
      .to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '-=0.2')
  }}>
    <MiniCard cls="w" c="wild" />
    <g className="wheel" data-o>
      <circle r={22} fill="#fff" />
      <path d="M0 0 L0 -18 A18 18 0 0 1 18 0 Z" fill={CH.red} />
      <path d="M0 0 L18 0 A18 18 0 0 1 0 18 Z" fill={CH.blue} />
      <path d="M0 0 L0 18 A18 18 0 0 1 -18 0 Z" fill={CH.yellow} />
      <path d="M0 0 L-18 0 A18 18 0 0 1 0 -18 Z" fill={CH.green} />
    </g>
    {[0, 1, 2, 3].map((i) => <MiniCard key={i} cls="bk" back />)}
    <MiniCard cls="w4" c="wild" t="+4" />
    <Tap />
    <Pill cls="l1" x={120} y={124} text="you pick the colour" />
    <Pill cls="l2" x={160} y={124} text="next player takes 4!" bg={CH.red} />
  </Scene>
)

const UnoCall = () => (
  <Scene build={(tl) => {
    tl.set(...hand('.pile', 70, 46, -4)).set(...hand('.a', 52, 120, -8)).set(...hand('.b', 92, 120, 8))
      .set('.btn', { x: 180, y: 96, scale: 1 }).set('.tap', { x: 190, y: 108, opacity: 0 })
      .set('.say', { x: 180, y: 34, scale: 0, rotation: -20 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.a', { x: 72, y: 44, rotation: 8, duration: 0.55, ease: 'back.out(1.3)' }, 0.4)
      .to('.b', { x: 72, rotation: 0, duration: 0.3 }, '<0.2')
      .to('.btn', { scale: 1.15, duration: 0.25, yoyo: true, repeat: 3, ease: 'sine.inOut' })
      .to('.tap', { opacity: 1, duration: 0.2 }, '-=0.3')
    tap(tl, '.tap')
    tl.to('.btn', { scale: 0.85, duration: 0.1, yoyo: true, repeat: 1 }, '<')
      .to('.say', { scale: 1, rotation: -6, duration: 0.5, ease: 'back.out(3)' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '+=0.3')
  }}>
    <MiniCard cls="pile" c="green" t="1" />
    <MiniCard cls="b" c="red" t="6" />
    <MiniCard cls="a" c="green" t="6" />
    <g className="btn" data-o>
      <circle r={24} fill={CH.red} stroke="#fff" strokeWidth={3} />
      <text dy="0.36em" textAnchor="middle" className="rs-num" fontSize={12} fill="#ffc93c">UNO!</text>
    </g>
    <g className="say" data-o>
      <path d="M-34 -16 Q-34 -24 -26 -24 L26 -24 Q34 -24 34 -16 L34 10 Q34 18 26 18 L4 18 L-6 28 L-6 18 L-26 18 Q-34 18 -34 10 Z" fill="#fff" />
      <text dy="0.1em" y={-3} textAnchor="middle" className="rs-num" fontSize={17} fill={CH.red}>UNO!</text>
    </g>
    <Tap />
    <Pill cls="l1" x={120} y={140} text="forget it & get caught = +2 cards" bg={CH.red} />
  </Scene>
)

const UnoWin = () => (
  <Scene build={(tl, svg) => {
    const pts = svg.querySelector('.pts tspan')!
    const n = { v: 0 }
    tl.set(...hand('.pile', 120, 50, -4)).set(...hand('.last', 120, 122, 0)).set('.burst', { x: 120, y: 50, scale: 0, rotation: 0, opacity: 1 })
      .set('.pts', { opacity: 0, scale: 0.4 }).set(n, { v: 0 }).call(() => { pts.textContent = '0' })
      .set('.o1, .o2', { x: (i: number) => (i ? 206 : 34), y: 50, opacity: 1, scale: 1 })
      .to('.last', { x: 122, y: 48, rotation: 10, duration: 0.6, ease: 'back.out(1.3)' }, 0.5)
      .to('.burst', { scale: 1.6, rotation: 90, duration: 0.6, ease: 'expo.out' }, '-=0.1')
      .to('.burst', { opacity: 0, duration: 0.4 }, '-=0.1')
      .to('.pts', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
      .to('.o1, .o2', { x: 120, y: 120, scale: 0.3, opacity: 0, duration: 0.5, ease: 'power2.in', stagger: 0.15 })
      .to(n, { v: 42, duration: 0.8, ease: 'power1.out', onUpdate: () => { pts.textContent = String(Math.round(n.v)) } }, '<')
  }}>
    <g className="burst" data-o><G name="burst" color="#ffc93c" size={90} /></g>
    <MiniCard cls="pile" c="blue" t="4" />
    <MiniCard cls="o1" c="red" t="9" />
    <MiniCard cls="o2" back />
    <MiniCard cls="last" c="blue" t="⊘" />
    <g className="pts" data-o>
      <rect x={-50} y={102} width={100} height={30} rx={15} fill="#ffc93c" />
      <text y={117} dy="0.36em" textAnchor="middle" className="rs-num" fontSize={15} fill="#1b1f3f">+<tspan>0</tspan> pts</text>
    </g>
  </Scene>
)

/* ---------- Ping Pong (vertical table, you at the bottom) ---------- */

function Table({ children }: { children?: ReactNode }) {
  return (
    <>
      <rect x={80} y={6} width={80} height={138} rx={6} fill="#1d3a6e" />
      <rect x={84} y={10} width={72} height={130} rx={3} fill="none" stroke="#fff" strokeWidth={1.5} />
      <line x1={120} y1={10} x2={120} y2={140} stroke="rgba(255,255,255,.35)" strokeWidth={1} />
      <line x1={78} y1={75} x2={162} y2={75} stroke="#fff" strokeWidth={2.5} strokeDasharray="4 3" />
      {children}
      <rect className="top" x={-13} y={-3} width={26} height={6} rx={3} fill={YOU} data-o />
      <rect className="bot" x={-13} y={-3} width={26} height={6} rx={3} fill={ME} data-o />
      <circle className="ball" r={4} fill="#fff" stroke="#1b1f3f" strokeWidth={1} />
    </>
  )
}

const PongMove = () => (
  <Scene build={(tl) => {
    tl.set('.top', { x: 120, y: 16 }).set('.bot', { x: 120, y: 134 }).set('.ball', { opacity: 0 })
      .set('.tap', { x: 120, y: 134, opacity: 0.9 }).set('.l1, .l2', { opacity: 1, scale: 1 })
      .to('.bot, .tap', { x: 96, duration: 0.6, ease: 'sine.inOut' }, 0.3)
      .to('.bot, .tap', { x: 144, duration: 0.9, ease: 'sine.inOut' })
      .to('.bot, .tap', { x: 112, duration: 0.7, ease: 'sine.inOut' })
      .to('.top', { x: 104, duration: 0.8, ease: 'sine.inOut' }, 0.6)
      .to('.top', { x: 136, duration: 0.8, ease: 'sine.inOut' })
  }}>
    <Table />
    <Tap />
    <Pill cls="l1" x={40} y={134} text="you" bg={ME} />
    <Pill cls="l2" x={40} y={16} text="friend" bg={YOU} />
    <Pill cls="l3" x={200} y={134} text="◀ drag ▶" />
  </Scene>
)

const PongRally = () => (
  <Scene build={(tl) => {
    tl.set('.top', { x: 130, y: 16 }).set('.bot', { x: 120, y: 134 }).set('.ball', { x: 130, y: 22, opacity: 1 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.ball', { x: 104, y: 128, duration: 1, ease: 'none' }, 0.3)
      .to('.bot', { x: 106, duration: 0.7 }, 0.4)
      .to('.bot', { y: 130, duration: 0.08, yoyo: true, repeat: 1 }, 1.25)
      .to('.ball', { x: 142, y: 22, duration: 0.75, ease: 'none' }, 1.3)
      .to('.top', { x: 140, duration: 0.5 }, 1.4)
      .to('.ball', { x: 112, y: 128, duration: 0.55, ease: 'none' }, 2.05)
      .to('.bot', { x: 114, duration: 0.3 }, 2.1)
      .to('.ball', { x: 96, y: 22, duration: 0.4, ease: 'none' }, 2.6)
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, 2.3)
      .to('.top', { x: 98, duration: 0.3 }, 2.6)
  }}>
    <Table />
    <Pill cls="l1" x={202} y={75} text="faster each hit!" bg={ME} />
  </Scene>
)

const PongAngle = () => (
  <Scene build={(tl) => {
    tl.set('.top', { x: 120, y: 16 }).set('.bot', { x: 120, y: 134 }).set('.ball', { x: 131, y: 20, opacity: 1 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
      .to('.ball', { y: 128, duration: 0.8, ease: 'none' }, 0.3)
      .to('.ball', { x: 155, y: 92, duration: 0.3, ease: 'none' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
      .to('.ball', { x: 98, y: 20, duration: 0.6, ease: 'none' })
      .to('.l1', { opacity: 0 }, '+=0.4')
      .set('.ball', { x: 120, y: 20 })
      .to('.ball', { y: 128, duration: 0.8, ease: 'none' })
      .to('.ball', { y: 20, duration: 0.8, ease: 'none' })
      .to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
  }}>
    <Table />
    <Pill cls="l1" x={40} y={100} text="edge = angle" bg={ME} />
    <Pill cls="l2" x={40} y={100} text="middle = straight" />
  </Scene>
)

const PongScore = () => (
  <Scene build={(tl, svg) => {
    const s = svg.querySelector('.sc text')!
    tl.set('.top', { x: 140, y: 16 }).set('.bot', { x: 110, y: 134 }).set('.ball', { x: 110, y: 128, opacity: 1 })
      .set('.sc', { x: 40, y: 60, scale: 1 }).call(() => { s.textContent = '4' }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.ball', { x: 102, y: -6, duration: 0.9, ease: 'none' }, 0.3)
      .to('.top', { x: 118, duration: 0.6 }, 0.4)
      .to('.sc', { scale: 1.5, duration: 0.15 }, '>-0.1')
      .call(() => { s.textContent = '5' })
      .to('.sc', { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
  }}>
    <Table />
    <g className="sc" data-o>
      <circle r={20} fill={ME} />
      <text dy="0.36em" textAnchor="middle" className="rs-num" fontSize={20} fill="#fff">4</text>
    </g>
    <Pill cls="l0" x={40} y={92} text="your score" />
    <Pill cls="l1" x={200} y={60} text="+1 point" bg={ME} />
  </Scene>
)

/* ---------- Tic Tac Toe ---------- */

const T0 = 66, TC = 36
const cell = (i: number) => [T0 + (i % 3 + 0.5) * TC, 21 + (Math.floor(i / 3) + 0.5) * TC] as const
function Grid() {
  return (
    <g stroke="currentColor" strokeWidth={4} strokeLinecap="round" opacity={0.85}>
      <path d={`M${T0 + TC} 25 L${T0 + TC} 125 M${T0 + TC * 2} 25 L${T0 + TC * 2} 125 M${T0 + 4} ${21 + TC} L${T0 + TC * 3 - 4} ${21 + TC} M${T0 + 4} ${21 + TC * 2} L${T0 + TC * 3 - 4} ${21 + TC * 2}`} fill="none" />
    </g>
  )
}
function Mark({ cls, kind, i }: { cls: string; kind: 'x' | 'o'; i: number }) {
  const [x, y] = cell(i)
  return kind === 'x'
    ? <path className={`draw ${cls}`} pathLength={1} d={`M${x - 10} ${y - 10} L${x + 10} ${y + 10} M${x + 10} ${y - 10} L${x - 10} ${y + 10}`} stroke={ME} strokeWidth={6} strokeLinecap="round" fill="none" />
    : <circle className={`draw ${cls}`} pathLength={1} cx={x} cy={y} r={11} stroke={YOU} strokeWidth={6} fill="none" transform={`rotate(-90 ${x} ${y})`} />
}
const ink = (tl: gsap.core.Timeline, sel: string, pos?: gsap.Position, d = 0.35) =>
  tl.to(sel, { strokeDashoffset: 0, duration: d, ease: 'power2.inOut' }, pos)
const blank = (tl: gsap.core.Timeline) => tl.set('.draw', { strokeDasharray: 1, strokeDashoffset: 1 })
const tapAt = (tl: gsap.core.Timeline, x: number, y: number, pos?: gsap.Position) => {
  tl.to('.tap', { x, y, opacity: 1, duration: 0.35, ease: 'power2.inOut' }, pos)
  tap(tl, '.tap')
}

const TttTurns = () => (
  <Scene build={(tl) => {
    blank(tl).set('.tap', { x: 210, y: 120, opacity: 0 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
    tapAt(tl, ...cell(4), 0.3); ink(tl, '.m1').to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
    tapAt(tl, ...cell(0), '+=0.4'); ink(tl, '.m2').to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
    tapAt(tl, ...cell(8), '+=0.4'); ink(tl, '.m3')
    tl.to('.tap', { opacity: 0 }, '+=0.2')
  }}>
    <Grid />
    <Mark cls="m1" kind="x" i={4} /><Mark cls="m2" kind="o" i={0} /><Mark cls="m3" kind="x" i={8} />
    <Tap />
    <Pill cls="l1" x={208} y={58} text="X goes" bg={ME} />
    <Pill cls="l2" x={34} y={58} text="then O" bg={YOU} />
  </Scene>
)

const TttRow = () => (
  <Scene build={(tl) => {
    blank(tl).set('.l1', { opacity: 0, scale: 0.4 })
    ;['.m1', '.m2', '.m3', '.m4', '.m5'].forEach((m, i) => ink(tl, m, i ? '+=0.15' : 0.3, 0.3))
    ink(tl, '.win', '+=0.2', 0.45).to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <Grid />
    <Mark cls="m1" kind="x" i={3} /><Mark cls="m2" kind="o" i={0} /><Mark cls="m3" kind="x" i={4} /><Mark cls="m4" kind="o" i={8} /><Mark cls="m5" kind="x" i={5} />
    <path className="draw win" pathLength={1} d={`M${T0 - 4} 75 L${T0 + TC * 3 + 4} 75`} stroke="#ffc93c" strokeWidth={7} strokeLinecap="round" />
    <Pill cls="l1" x={120} y={140} text="three in a row — you win!" bg={ME} />
  </Scene>
)

const TttBlock = () => (
  <Scene build={(tl) => {
    blank(tl).set('.tap', { x: 210, y: 120, opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 }).set('.gap', { opacity: 0 })
    ink(tl, '.m1', 0.2, 0.25); ink(tl, '.m2', '+=0.1', 0.25); ink(tl, '.m3', '+=0.1', 0.25)
    tl.to('.gap', { opacity: 1, duration: 0.2, yoyo: true, repeat: 3 }, '+=0.2')
    tapAt(tl, ...cell(2)); ink(tl, '.m4').to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
    tl.to('.tap', { opacity: 0 }, '+=0.3')
  }}>
    <Grid />
    <circle className="gap" cx={cell(2)[0]} cy={cell(2)[1]} r={15} fill="#ffc93c" opacity={0} />
    <Mark cls="m1" kind="o" i={0} /><Mark cls="m2" kind="x" i={4} /><Mark cls="m3" kind="o" i={1} /><Mark cls="m4" kind="x" i={2} />
    <Tap />
    <Pill cls="l1" x={208} y={40} text="blocked!" bg={ME} />
  </Scene>
)

/* ---------- Connect Four ---------- */

const C0x = 57, C0y = 36, CS = 16
const slot = (c: number, r: number) => [C0x + 8 + CS * c + c * 2, C0y + 8 + CS * r + r * 2] as const
function Board() {
  return (
    <g>
      <rect x={C0x - 4} y={C0y - 4} width={7 * 18 + 6} height={6 * 18 + 6} rx={10} fill="#1d3a6e" />
      {Array.from({ length: 42 }, (_, i) => {
        const [x, y] = slot(i % 7, Math.floor(i / 7))
        return <circle key={i} cx={x} cy={y} r={6.5} fill="var(--rs-bg)" />
      })}
    </g>
  )
}
function Disc({ cls, color }: { cls: string; color: string }) {
  return <circle className={cls} r={7} fill={color} stroke="rgba(27,31,63,.35)" strokeWidth={1.5} data-o />
}
const put = (tl: gsap.core.Timeline, sel: string, c: number, r: number) => tl.set(sel, { x: slot(c, r)[0], y: slot(c, r)[1], opacity: 1, scale: 1 })
const drop = (tl: gsap.core.Timeline, sel: string, c: number, r: number, pos?: gsap.Position) => {
  tl.set(sel, { x: slot(c, 0)[0], y: 18, opacity: 1, scale: 1 }, pos)
    .fromTo(sel, { scale: 0 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' })
    .to(sel, { y: slot(c, r)[1], duration: 0.3 + r * 0.06, ease: 'bounce.out' }, '+=0.15')
}

const C4Drop = () => (
  <Scene build={(tl) => {
    tl.set('.d1, .d2', { opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
    drop(tl, '.d1', 3, 5, 0.3)
    tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
    drop(tl, '.d2', 3, 4, '+=0.3')
  }}>
    <Board /><Disc cls="d1" color={ME} /><Disc cls="d2" color={YOU} />
    <Pill cls="l1" x={210} y={120} text="falls down" />
  </Scene>
)

const C4Four = () => (
  <Scene build={(tl) => {
    put(tl, '.a1', 1, 5); put(tl, '.a2', 2, 5); put(tl, '.a3', 3, 5); put(tl, '.b1', 1, 4); put(tl, '.b2', 2, 4); put(tl, '.b3', 5, 5)
    tl.set('.a4', { opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 }).set('.draw', { strokeDasharray: 1, strokeDashoffset: 1 })
    drop(tl, '.a4', 4, 5, 0.5)
    tl.to('.a1, .a2, .a3, .a4', { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, stagger: 0.08 })
    ink(tl, '.win', '-=0.1', 0.4)
    tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <Board />
    <Disc cls="a1" color={ME} /><Disc cls="a2" color={ME} /><Disc cls="a3" color={ME} /><Disc cls="a4" color={ME} />
    <Disc cls="b1" color={YOU} /><Disc cls="b2" color={YOU} /><Disc cls="b3" color={YOU} />
    <path className="draw win" pathLength={1} d={`M${slot(1, 5)[0]} ${slot(1, 5)[1]} L${slot(4, 5)[0]} ${slot(4, 5)[1]}`} stroke="#ffc93c" strokeWidth={4} strokeLinecap="round" />
    <Pill cls="l1" x={120} y={18} text="four in a row!" bg={ME} />
  </Scene>
)

const C4Trap = () => (
  <Scene build={(tl) => {
    put(tl, '.a1', 2, 5); put(tl, '.a2', 3, 5); put(tl, '.b1', 2, 4); put(tl, '.b2', 3, 4)
    tl.set('.a3, .b3, .a4', { opacity: 0 }).set('.g1, .g2', { opacity: 0, scale: 1 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
    drop(tl, '.a3', 4, 5, 0.4)
    tl.to('.g1, .g2', { opacity: 1, scale: 1.5, duration: 0.4, yoyo: true, repeat: 3, ease: 'sine.inOut' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
    drop(tl, '.b3', 1, 5, '+=0.2')
    tl.set('.g1', { opacity: 0 })
    drop(tl, '.a4', 5, 5, '+=0.2')
    tl.set('.g2', { opacity: 0 }, '<').to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <Board />
    <circle className="g1" cx={slot(1, 5)[0]} cy={slot(1, 5)[1]} r={7} fill="#ffc93c" data-o />
    <circle className="g2" cx={slot(5, 5)[0]} cy={slot(5, 5)[1]} r={7} fill="#ffc93c" data-o />
    <Disc cls="a1" color={ME} /><Disc cls="a2" color={ME} /><Disc cls="a3" color={ME} /><Disc cls="a4" color={ME} />
    <Disc cls="b1" color={YOU} /><Disc cls="b2" color={YOU} /><Disc cls="b3" color={YOU} />
    <Pill cls="l1" x={120} y={18} text="two ways to win" />
    <Pill cls="l2" x={120} y={18} text="they can't block both!" bg={ME} />
  </Scene>
)

/* ---------- Dots & Boxes ---------- */

const DX = [60, 100, 140, 180], DY = [35, 75, 115]
function Dots() {
  return <g fill="currentColor">{DY.flatMap((y) => DX.map((x) => <circle key={`${x},${y}`} cx={x} cy={y} r={4.5} />))}</g>
}
function Ln({ cls, a, b, color = 'currentColor', faint }: { cls: string; a: [number, number]; b: [number, number]; color?: string; faint?: boolean }) {
  return <path className={`draw ${cls}`} pathLength={1} d={`M${DX[a[0]]} ${DY[a[1]]} L${DX[b[0]]} ${DY[b[1]]}`} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={faint ? 0.45 : 1} />
}
function Box({ cls, c, r, color, glyph }: { cls: string; c: number; r: number; color: string; glyph: GlyphName }) {
  return (
    <g className={cls} data-o transform={`translate(${DX[c] + 20} ${DY[r] + 20})`}>
      <rect x={-16} y={-16} width={32} height={32} rx={5} fill={color} opacity={0.85} />
      <G name={glyph} color="#fff" size={16} />
    </g>
  )
}
const showLines = (tl: gsap.core.Timeline, sel: string) => tl.set(sel, { strokeDashoffset: 0 })

const DotsLine = () => (
  <Scene build={(tl) => {
    blank(tl).set('.tap', { x: 60, y: 35, opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.tap', { opacity: 1, duration: 0.2 }, 0.3)
    tap(tl, '.tap')
    tl.to('.tap', { x: 100, duration: 0.45, ease: 'power2.inOut' })
    ink(tl, '.a', '<', 0.45)
    tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }).to('.tap', { opacity: 0 })
    ink(tl, '.b', '+=0.3')
  }}>
    <Ln cls="a" a={[0, 0]} b={[1, 0]} color={ME} />
    <Ln cls="b" a={[2, 1]} b={[2, 2]} color={YOU} />
    <Dots />
    <Tap />
    <Pill cls="l1" x={120} y={140} text="join two dots next to each other" />
  </Scene>
)

const DotsBox = () => (
  <Scene build={(tl) => {
    blank(tl); showLines(tl, '.s'); tl.set('.bx', { scale: 0, rotation: -40 }).set('.l1', { opacity: 0, scale: 0.4 })
    ink(tl, '.last', 0.6, 0.4)
    tl.to('.bx', { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.4)' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
  }}>
    <Box cls="bx" c={1} r={0} color={ME} glyph="star" />
    <Ln cls="s" a={[1, 0]} b={[2, 0]} faint /><Ln cls="s" a={[1, 0]} b={[1, 1]} faint /><Ln cls="s" a={[1, 1]} b={[2, 1]} faint />
    <Ln cls="last" a={[2, 0]} b={[2, 1]} color={ME} />
    <Dots />
    <Pill cls="l1" x={120} y={138} text="it's yours — go again!" bg={ME} />
  </Scene>
)

const DotsCareful = () => (
  <Scene build={(tl) => {
    blank(tl); showLines(tl, '.s'); tl.set('.bx', { scale: 0 }).set('.warn', { opacity: 0, scale: 0.5 }).set('.l1', { opacity: 0, scale: 0.4 })
    ink(tl, '.mine', 0.5)
    tl.to('.warn', { opacity: 1, scale: 1.2, duration: 0.3, yoyo: true, repeat: 3 })
    ink(tl, '.theirs', '+=0.1')
    tl.to('.bx', { scale: 1, duration: 0.5, ease: 'back.out(2.4)' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
  }}>
    <Box cls="bx" c={1} r={0} color={YOU} glyph="heart" />
    <circle className="warn" cx={120} cy={55} r={20} fill="none" stroke="#ff5d73" strokeWidth={4} data-o />
    <Ln cls="s" a={[1, 0]} b={[2, 0]} faint /><Ln cls="s" a={[1, 1]} b={[2, 1]} faint />
    <Ln cls="mine" a={[1, 0]} b={[1, 1]} color={ME} />
    <Ln cls="theirs" a={[2, 0]} b={[2, 1]} color={YOU} />
    <Dots />
    <Pill cls="l1" x={120} y={138} text="3rd side = a gift for them" bg="#ff5d73" />
  </Scene>
)

const DotsChain = () => (
  <Scene build={(tl, svg) => {
    const s = svg.querySelector('.cnt tspan')!
    blank(tl); showLines(tl, '.s'); tl.set('.c1, .c2, .c3', { scale: 0 }).call(() => { s.textContent = '0' })
    ;['1', '2', '3'].forEach((n, i) => {
      ink(tl, `.k${n}`, i ? '+=0.1' : 0.5, 0.3)
      tl.to(`.c${n}`, { scale: 1, duration: 0.35, ease: 'back.out(2.4)' }).call(() => { s.textContent = String(i + 1) })
    })
  }}>
    <Box cls="c1" c={0} r={1} color={ME} glyph="star" /><Box cls="c2" c={1} r={1} color={ME} glyph="bolt" /><Box cls="c3" c={2} r={1} color={ME} glyph="heart" />
    <Ln cls="s" a={[0, 1]} b={[0, 2]} faint /><Ln cls="s" a={[0, 1]} b={[1, 1]} faint /><Ln cls="s" a={[0, 2]} b={[1, 2]} faint />
    <Ln cls="s" a={[1, 1]} b={[2, 1]} faint /><Ln cls="s" a={[1, 2]} b={[2, 2]} faint />
    <Ln cls="s" a={[2, 1]} b={[3, 1]} faint /><Ln cls="s" a={[2, 2]} b={[3, 2]} faint />
    <Ln cls="k1" a={[1, 1]} b={[1, 2]} color={ME} /><Ln cls="k2" a={[2, 1]} b={[2, 2]} color={ME} />
    <Ln cls="k3" a={[3, 1]} b={[3, 2]} color={ME} />
    <Dots />
    <g className="cnt">
      <rect x={90} y={14} width={60} height={22} rx={11} fill={ME} />
      <text x={120} y={25} dy="0.36em" textAnchor="middle" className="rs-num" fontSize={13} fill="#fff">+<tspan>0</tspan> boxes</text>
    </g>
  </Scene>
)

/* ---------- Memory Match ---------- */

const MX = [60, 100, 140, 180], MY = [52, 108]
function Flip({ cls, i, glyph, color }: { cls: string; i: number; glyph: GlyphName; color: string }) {
  return (
    <g className={`mc ${cls}`} data-o data-x={MX[i % 4]} data-y={MY[Math.floor(i / 4)]}>
      <g className="back">
        <rect x={-16} y={-22} width={32} height={44} rx={6} fill="#a596ff" stroke="#fff" strokeWidth={2.5} />
        <text dy="0.36em" textAnchor="middle" className="rs-num" fontSize={16} fill="#fff">?</text>
      </g>
      <g className="front" opacity={0}>
        <rect x={-16} y={-22} width={32} height={44} rx={6} fill="#fff" stroke={color} strokeWidth={2.5} />
        <G name={glyph} color={color} size={20} />
      </g>
    </g>
  )
}
const deal = (tl: gsap.core.Timeline, svg: SVGSVGElement) => {
  svg.querySelectorAll<SVGGElement>('.mc').forEach((el) => tl.set(el, { x: +el.dataset.x!, y: +el.dataset.y!, scale: 1, scaleX: 1, rotation: 0, opacity: 1 }))
  tl.set('.mc .front', { opacity: 0 }).set('.mc .back', { opacity: 1 })
}
const flip = (tl: gsap.core.Timeline, sel: string, up: boolean, pos?: gsap.Position) =>
  tl.to(sel, { scaleX: 0, duration: 0.14, ease: 'power1.in' }, pos)
    .set(`${sel} .front`, { opacity: up ? 1 : 0 }).set(`${sel} .back`, { opacity: up ? 0 : 1 })
    .to(sel, { scaleX: 1, duration: 0.2, ease: 'back.out(2)' })
const tapCard = (tl: gsap.core.Timeline, i: number, pos?: gsap.Position) => tapAt(tl, MX[i % 4] + 6, MY[Math.floor(i / 4)] + 10, pos)

const memoryCards = (
  <>
    <Flip cls="c0" i={0} glyph="star" color="#ffb424" /><Flip cls="c1" i={1} glyph="moon" color="#a596ff" />
    <Flip cls="c2" i={2} glyph="heart" color="#ff5d73" /><Flip cls="c3" i={3} glyph="bolt" color="#45b8ff" />
    <Flip cls="c4" i={4} glyph="heart" color="#ff5d73" /><Flip cls="c5" i={5} glyph="star" color="#ffb424" />
    <Flip cls="c6" i={6} glyph="bolt" color="#45b8ff" /><Flip cls="c7" i={7} glyph="moon" color="#a596ff" />
  </>
)

const MemFlip = () => (
  <Scene build={(tl, svg) => {
    deal(tl, svg); tl.set('.tap', { x: 210, y: 140, opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
    tapCard(tl, 1, 0.3); flip(tl, '.c1', true)
    tapCard(tl, 6, '+=0.2'); flip(tl, '.c6', true)
    tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }).to('.tap', { opacity: 0 }, '<')
  }}>
    {memoryCards}<Tap />
    <Pill cls="l1" x={120} y={140} text="flip any two cards" />
  </Scene>
)

const MemMatch = () => (
  <Scene build={(tl, svg) => {
    deal(tl, svg); tl.set('.tap', { x: 210, y: 140, opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
    tapCard(tl, 0, 0.3); flip(tl, '.c0', true)
    tapCard(tl, 5, '+=0.2'); flip(tl, '.c5', true)
    tl.to('.tap', { opacity: 0 }).to('.c0, .c5', { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1 }, '<')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .to('.c0, .c5', { x: 222, y: 20, scale: 0.4, rotation: 20, duration: 0.6, ease: 'power3.in', stagger: 0.1 }, '+=0.5')
  }}>
    {memoryCards}<Tap />
    <Pill cls="l1" x={120} y={140} text="match! keep them & go again" bg="#2fbf8f" />
  </Scene>
)

const MemMiss = () => (
  <Scene build={(tl, svg) => {
    deal(tl, svg); tl.set('.tap', { x: 210, y: 140, opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
    tapCard(tl, 2, 0.3); flip(tl, '.c2', true)
    tapCard(tl, 3, '+=0.2'); flip(tl, '.c3', true)
    tl.to('.tap', { opacity: 0 }).to('.c2, .c3', { rotation: 8, duration: 0.07, yoyo: true, repeat: 5 }, '<')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
    flip(tl, '.c2', false, '+=0.5'); flip(tl, '.c3', false, '<')
  }}>
    {memoryCards}<Tap />
    <Pill cls="l1" x={120} y={140} text="no match — remember where they were!" bg="#ff5d73" />
  </Scene>
)

/* ---------- Odd One Out ---------- */

const OX = [45, 75, 105, 135, 165, 195], OY = [34, 70, 106], ODD = 9
function Stars({ wrongTint }: { wrongTint?: boolean }) {
  return (
    <g>
      {OY.flatMap((y, r) => OX.map((x, c) => {
        const i = r * 6 + c
        return (
          <g key={i} className={`st s${i}`} data-o transform={`translate(${x} ${y})`}>
            <g transform={i === ODD ? 'rotate(18)' : undefined}><G name="star" color={wrongTint && i === 4 ? '#ffb424' : '#ff9a62'} size={24} /></g>
          </g>
        )
      }))}
    </g>
  )
}
const [oddX, oddY] = [OX[ODD % 6], OY[Math.floor(ODD / 6)]]

const OddSpot = () => (
  <Scene build={(tl) => {
    tl.set('.st', { scale: 0 }).set('.lens', { x: 20, y: 130, opacity: 0 }).set('.ring', { opacity: 0, scale: 2 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.st', { scale: 1, duration: 0.4, ease: 'back.out(2.4)', stagger: { each: 0.02, from: 'random' } }, 0.2)
      .to('.lens', { opacity: 1, x: 75, y: 34, duration: 0.6 })
      .to('.lens', { x: 165, y: 106, duration: 0.6 }, '+=0.15')
      .to('.lens', { x: oddX, y: oddY, duration: 0.6 }, '+=0.15')
      .to('.ring', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(3)' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
  }}>
    <Stars />
    <circle className="ring" cx={oddX} cy={oddY} r={17} fill="none" stroke="#ff5d73" strokeWidth={4} data-o />
    <g className="lens">
      <circle r={16} fill="rgba(255,255,255,.35)" stroke="#1d3a6e" strokeWidth={3.5} />
      <path d="M11 11 L22 22" stroke="#1d3a6e" strokeWidth={5} strokeLinecap="round" />
    </g>
    <Pill cls="l1" x={120} y={138} text="this one is turned!" bg="#ff5d73" />
  </Scene>
)

const OddRace = () => (
  <Scene build={(tl) => {
    tl.set('.t1', { x: 30, y: 140, opacity: 1 }).set('.t2', { x: 210, y: 140, opacity: 1 }).set('.plus', { opacity: 0, y: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.t1', { x: oddX, y: oddY, duration: 0.9, ease: 'power2.inOut' }, 0.4)
      .to('.t2', { x: oddX + 30, y: oddY + 30, duration: 1.15, ease: 'power2.inOut' }, 0.4)
    tap(tl, '.t1', 1.3)
    tl.to('.s' + ODD, { scale: 1.4, duration: 0.2, yoyo: true, repeat: 1 }, 1.3)
      .to('.plus', { opacity: 1, y: -14, duration: 0.5, ease: 'back.out(3)' }, 1.35)
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '+=0.2')
  }}>
    <Stars />
    <text className="plus rs-num" x={oddX} y={oddY - 18} textAnchor="middle" fontSize={16} fill={ME}>+1</text>
    <Tap cls="t2" color={YOU} /><Tap cls="t1" color={ME} />
    <Pill cls="l1" x={120} y={140} text="first tap wins the round" bg={ME} />
  </Scene>
)

const OddWrong = () => (
  <Scene build={(tl) => {
    tl.set('.tap', { x: 210, y: 140, opacity: 0 }).set('.bad', { opacity: 0, scale: 0.4 }).set('.lock', { opacity: 0, scale: 0.4 }).set('.l1', { opacity: 0, scale: 0.4 }).set('.st', { opacity: 1 })
    tapAt(tl, OX[4], OY[0], 0.3)
    tl.to('.bad', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .to('.st', { opacity: 0.35, duration: 0.3 })
      .to('.lock', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <Stars wrongTint />
    <g className="bad" data-o transform={`translate(${OX[4]} ${OY[0]})`}><G name="x" color="#ff5d73" size={30} /></g>
    <g className="lock" data-o transform="translate(120 70)">
      <rect x={-18} y={-6} width={36} height={28} rx={6} fill="#1d3a6e" />
      <path d="M-10 -6 V-14 A10 10 0 0 1 10 -14 V-6" fill="none" stroke="#1d3a6e" strokeWidth={5} />
      <circle cy={7} r={4} fill="#fff" />
    </g>
    <Tap />
    <Pill cls="l1" x={120} y={138} text="wrong = locked out this round" bg="#ff5d73" />
  </Scene>
)

/* ---------- Echo ---------- */

const PADS = ['#e64fe0', '#45b8ff', '#ffb424', '#d9f66b']
function sector(i: number, r1: number, r2: number) {
  const g = 0.07, a0 = -Math.PI / 2 + i * Math.PI / 2 + g, a1 = a0 + Math.PI / 2 - 2 * g
  const p = (r: number, a: number) => `${(120 + Math.cos(a) * r).toFixed(1)} ${(78 + Math.sin(a) * r).toFixed(1)}`
  return `M${p(r2, a0)} A${r2} ${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`
}
const padMid = (i: number) => { const a = -Math.PI / 4 + i * Math.PI / 2; return [120 + Math.cos(a) * 42, 78 + Math.sin(a) * 42] as const }
function Pads() {
  return (
    <g>
      {PADS.map((c, i) => <path key={i} className={`pad p${i}`} d={sector(i, 22, 62)} fill={c} opacity={0.3} />)}
      <circle cx={120} cy={78} r={16} fill="rgba(255,255,255,.15)" />
    </g>
  )
}
const glow = (tl: gsap.core.Timeline, i: number, pos?: gsap.Position, color?: string) =>
  tl.to(`.p${i}`, { opacity: 1, duration: 0.12, ...(color ? { fill: color } : {}) }, pos).to(`.p${i}`, { opacity: 0.3, duration: 0.3, ...(color ? { fill: PADS[i] } : {}) }, '+=0.25')

const EchoWatch = () => (
  <Scene build={(tl) => {
    tl.set('.pad', { opacity: 0.3 }).set('.l1', { opacity: 1, scale: 1 })
    ;[0, 2, 1].forEach((p, k) => glow(tl, p, k ? '+=0.12' : 0.4))
  }}>
    <Pads />
    <Pill cls="l1" x={120} y={142} text="watch closely…" />
  </Scene>
)

const EchoRepeat = () => (
  <Scene build={(tl) => {
    tl.set('.pad', { opacity: 0.3 }).set('.tap', { x: 210, y: 140, opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
    ;[0, 2, 1].forEach((p, k) => { tapAt(tl, ...padMid(p), k ? '+=0.05' : 0.3); glow(tl, p, '<0.25') })
    tl.to('.tap', { opacity: 0 }).to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
  }}>
    <Pads /><Tap />
    <Pill cls="l1" x={120} y={142} text="same pads, same order ✓" bg="#2fbf8f" />
  </Scene>
)

const EchoGrow = () => (
  <Scene build={(tl) => {
    tl.set('.pad', { opacity: 0.3, fill: (i: number) => PADS[i] }).set('.tap', { x: 210, y: 140, opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
      .set('.step', { scale: 0 })
    ;[0, 2, 1, 3].forEach((p, k) => { glow(tl, p, k ? '+=0.08' : 0.3); tl.to(`.step${k}`, { scale: 1, ease: 'back.out(3)', duration: 0.3 }, '<') })
    ;[0, 2].forEach((p) => { tapAt(tl, ...padMid(p), '+=0.1'); glow(tl, p, '<0.25') })
    tapAt(tl, ...padMid(3), '+=0.1')
    glow(tl, 3, '<0.25', '#ff5d73')
    tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<').to('.tap', { opacity: 0 }, '<')
  }}>
    <Pads />
    {[0, 1, 2, 3].map((k) => <circle key={k} className={`step step${k}`} cx={198 + (k % 2) * 16} cy={22 + Math.floor(k / 2) * 16} r={6} fill={PADS[[0, 2, 1, 3][k]]} data-o />)}
    <Tap />
    <Pill cls="l1" x={120} y={142} text="wrong pad = you're out" bg="#ff5d73" />
  </Scene>
)

/* ---------- Sea Battle ---------- */

const SB = 20, SBX = 60, SBY = 12
const sc = (c: number, r: number) => [SBX + SB * c + SB / 2, SBY + SB * r + SB / 2] as const
function Sea6() {
  return (
    <g>
      <rect x={SBX} y={SBY} width={SB * 6} height={SB * 6} rx={8} fill="#3d8bff" />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M${SBX + SB * (i + 1)} ${SBY} V${SBY + SB * 6} M${SBX} ${SBY + SB * (i + 1)} H${SBX + SB * 6}`} stroke="#fff" strokeOpacity={0.2} />
      ))}
    </g>
  )
}
function Boat({ cls, c, r, len, vertical, color = ME }: { cls: string; c: number; r: number; len: number; vertical?: boolean; color?: string }) {
  const [x, y] = [SBX + SB * c + 3, SBY + SB * r + 3]
  const w = vertical ? SB - 6 : SB * len - 6, h = vertical ? SB * len - 6 : SB - 6
  return <rect className={cls} data-o x={x} y={y} width={w} height={h} rx={7} fill={color} stroke="#fff" strokeOpacity={0.5} strokeWidth={2} />
}
function Boom({ cls, c, r }: { cls: string; c: number; r: number }) {
  const [x, y] = sc(c, r)
  return (
    <g className={cls} data-o transform={`translate(${x} ${y})`}>
      <path d="M0 -9 L3 -3 L9 -4 L5 1 L8 8 L0 4 L-8 8 L-5 1 L-9 -4 L-3 -3Z" fill="#ff5d73" /><circle r={3} fill="#ffb424" />
    </g>
  )
}
function Splash({ cls, c, r }: { cls: string; c: number; r: number }) {
  const [x, y] = sc(c, r)
  return <g className={cls} data-o transform={`translate(${x} ${y})`}><circle r={6} fill="none" stroke="#fff" strokeWidth={2} /><circle r={2.5} fill="#fff" /></g>
}

const SeaHide = () => (
  <Scene build={(tl) => {
    tl.set('.b', { scale: 0, opacity: 1 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.b', { scale: 1, duration: 0.35, ease: 'back.out(3)', stagger: 0.12 }, 0.3)
      .to('.b', { opacity: 0, duration: 0.2 }, '+=0.6')
      .set('.b', { scale: 0 })
      .set('.b1', { x: 20, y: 40 }).set('.b2', { x: -40, y: -20 }).set('.b3', { x: 40, y: 0 })
      .to('.b', { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)', stagger: 0.1 })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .set('.b1, .b2, .b3', { x: 0, y: 0 }, '+=1.2')
  }}>
    <Sea6 />
    <Boat cls="b b1" c={0} r={0} len={4} /><Boat cls="b b2" c={4} r={2} len={3} vertical /><Boat cls="b b3" c={1} r={4} len={2} />
    <Pill cls="l1" x={120} y={140} text="shuffle, then press Ready" bg={ME} />
  </Scene>
)

const SeaFire = () => (
  <Scene build={(tl) => {
    tl.set('.tap', { x: 210, y: 140, opacity: 0 }).set('.m1, .h1, .h2', { scale: 0 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
    tapAt(tl, ...sc(1, 1), 0.3)
    tl.to('.m1', { scale: 1, ease: 'back.out(3)' }).to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
      .to('.l1', { opacity: 0, duration: 0.2 }, '+=0.8')
    tapAt(tl, ...sc(3, 3))
    tl.to('.h1', { scale: 1, ease: 'back.out(3)' }).to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
    tapAt(tl, ...sc(4, 3), '+=0.4')
    tl.to('.h2', { scale: 1, ease: 'back.out(3)' })
  }}>
    <Sea6 />
    <Splash cls="m1" c={1} r={1} /><Boom cls="h1" c={3} r={3} /><Boom cls="h2" c={4} r={3} />
    <Tap />
    <Pill cls="l1" x={120} y={140} text="miss: their turn" />
    <Pill cls="l2" x={120} y={140} text="hit: fire again!" bg={ME} />
  </Scene>
)

const SeaSink = () => (
  <Scene build={(tl) => {
    tl.set('.h', { scale: 1 }).set('.ship', { opacity: 0, scale: 0.6 }).set('.l1', { opacity: 0, scale: 0.4 }).set('.h3', { scale: 0 }).set('.tap', { x: 210, y: 140, opacity: 0 })
    tapAt(tl, ...sc(4, 2), 0.3)
    tl.to('.h3', { scale: 1, ease: 'back.out(3)' })
      .to('.ship', { opacity: 1, scale: 1, ease: 'back.out(2)' }, '+=0.2')
      .to('.h', { scale: 0.7, duration: 0.2 }, '<')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <Sea6 />
    <Boat cls="ship" c={2} r={2} len={3} color={YOU} />
    <Boom cls="h" c={2} r={2} /><Boom cls="h" c={3} r={2} /><Boom cls="h3" c={4} r={2} />
    <Tap />
    <Pill cls="l1" x={120} y={140} text="sink their whole fleet to win" bg={ME} />
  </Scene>
)

/* ---------- Checkers ---------- */

const KX = 72, KY = 8, KS = 24
const kc = (c: number, r: number) => [KX + KS * c + KS / 2, KY + KS * r + KS / 2] as const
function CkBoard() {
  return (
    <g>
      {Array.from({ length: 20 }, (_, i) => {
        const c = i % 4, r = Math.floor(i / 4)
        return <rect key={i} x={KX + c * KS} y={KY + r * KS} width={KS} height={KS} fill={(c + r) % 2 ? '#ff5d73' : '#ffe3ea'} />
      })}
    </g>
  )
}
function Man({ cls, color, king }: { cls: string; color: string; king?: boolean }) {
  return (
    <g className={cls}>
      <circle r={9.5} fill={color} stroke="#fff" strokeWidth={2} />
      <path className="crown" data-o d="M-6 3 L-7 -4 L-3 -1 L0 -6 L3 -1 L7 -4 L6 3Z" fill="#ffb424" stroke="#1d3a6e" strokeWidth={1.2} opacity={king ? 1 : 0} />
    </g>
  )
}
const at = (tl: gsap.core.Timeline, sel: string, c: number, r: number) => tl.set(sel, { x: kc(c, r)[0], y: kc(c, r)[1], opacity: 1, scale: 1 })

const CkMove = () => (
  <Scene build={(tl) => {
    at(tl, '.me', 0, 4); at(tl, '.you', 3, 0)
    tl.set('.l1', { opacity: 0, scale: 0.4 })
      .to('.me', { x: kc(1, 3)[0], y: kc(1, 3)[1], duration: 0.5, ease: 'power2.inOut' }, 0.4)
      .to('.you', { x: kc(2, 1)[0], y: kc(2, 1)[1], duration: 0.5, ease: 'power2.inOut' }, '+=0.3')
      .to('.me', { x: kc(2, 2)[0], y: kc(2, 2)[1], duration: 0.5, ease: 'power2.inOut' }, '+=0.3')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <CkBoard />
    <Man cls="you" color={YOU} /><Man cls="me" color={ME} />
    <Pill cls="l1" x={120} y={140} text="one step diagonally forward" />
  </Scene>
)

const CkJump = () => (
  <Scene build={(tl) => {
    at(tl, '.me', 0, 4); at(tl, '.y1', 1, 3); at(tl, '.y2', 1, 1)
    tl.set('.l1', { opacity: 0, scale: 0.4 })
      .to('.me', { keyframes: [{ x: kc(1, 3)[0], y: kc(1, 3)[1] - 10, duration: 0.25 }, { x: kc(2, 2)[0], y: kc(2, 2)[1], duration: 0.25 }] }, 0.5)
      .to('.y1', { scale: 0, opacity: 0, duration: 0.25 }, '-=0.1')
      .to('.me', { keyframes: [{ x: kc(1, 1)[0], y: kc(1, 1)[1] - 10, duration: 0.25 }, { x: kc(0, 0)[0], y: kc(0, 0)[1], duration: 0.25 }] }, '+=0.35')
      .to('.y2', { scale: 0, opacity: 0, duration: 0.25 }, '-=0.1')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <CkBoard />
    <Man cls="y1" color={YOU} /><Man cls="y2" color={YOU} /><Man cls="me" color={ME} />
    <Pill cls="l1" x={120} y={140} text="jumps are a must — and they chain!" bg={ME} />
  </Scene>
)

const CkKing = () => (
  <Scene build={(tl) => {
    at(tl, '.me', 2, 1)
    tl.set('.me .crown', { opacity: 0, scale: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.me', { x: kc(3, 0)[0], y: kc(3, 0)[1], duration: 0.5, ease: 'power2.inOut' }, 0.4)
      .to('.me .crown', { opacity: 1, scale: 1.3, duration: 0.4, ease: 'back.out(3)' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .to('.me', { x: kc(1, 2)[0], y: kc(1, 2)[1], duration: 0.7, ease: 'power2.inOut' }, '+=0.3')
  }}>
    <CkBoard />
    <Man cls="me" color={ME} />
    <Pill cls="l1" x={120} y={140} text="reach the far side: king! moves both ways" bg={ME} />
  </Scene>
)

/* ---------- Reversi ---------- */

const RX = [48, 84, 120, 156, 192]
function RDisc({ cls, color }: { cls: string; color: string }) {
  return <circle className={cls} data-o r={14} fill={color} stroke="#1d3a6e" strokeWidth={2} />
}
const RvFlip = () => (
  <Scene build={(tl) => {
    tl.set('.tap', { x: 210, y: 140, opacity: 0 }).set('.d0', { x: RX[0], y: 62 }).set('.d1, .d2', { fill: YOU, scaleX: 1 })
      .set('.d1', { x: RX[1], y: 62 }).set('.d2', { x: RX[2], y: 62 }).set('.d3', { x: RX[3], y: 62, scale: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
    tapAt(tl, RX[3], 70, 0.3)
    tl.to('.d3', { scale: 1, ease: 'back.out(3)' })
      .to('.d2', { scaleX: 0, duration: 0.15 }).set('.d2', { fill: ME }).to('.d2', { scaleX: 1, duration: 0.15 })
      .to('.d1', { scaleX: 0, duration: 0.15 }).set('.d1', { fill: ME }).to('.d1', { scaleX: 1, duration: 0.15 })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <rect x={26} y={40} width={188} height={44} rx={10} fill="#2fbf8f" />
    <RDisc cls="d0" color={ME} /><RDisc cls="d1" color={YOU} /><RDisc cls="d2" color={YOU} /><RDisc cls="d3" color={ME} />
    <Tap />
    <Pill cls="l1" x={120} y={122} text="trap a line of theirs to flip it" bg={ME} />
  </Scene>
)

const RvCount = () => {
  const cols = [ME, YOU, ME, ME, YOU, ME, ME, YOU, YOU, ME, ME, ME, YOU, ME, YOU, ME]
  return (
    <Scene build={(tl) => {
      tl.set('.q', { scale: 0 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
        .to('.q', { scale: 1, duration: 0.25, ease: 'back.out(3)', stagger: 0.05 }, 0.2)
        .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
        .to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '+=0.3')
    }}>
      <rect x={66} y={6} width={108} height={108} rx={10} fill="#2fbf8f" />
      {cols.map((c, i) => <circle key={i} className="q" data-o cx={80 + (i % 4) * 27} cy={20 + Math.floor(i / 4) * 27} r={11} fill={c} />)}
      <Pill cls="l1" x={70} y={134} text={`you ${cols.filter((c) => c === ME).length}`} bg={ME} />
      <Pill cls="l2" x={170} y={134} text={`them ${cols.filter((c) => c === YOU).length}`} bg={YOU} />
    </Scene>
  )
}

/* ---------- Light Cycles ---------- */

const CyDrive = () => (
  <Scene build={(tl) => {
    tl.set('.draw', { strokeDasharray: 1, strokeDashoffset: 1 }).set('.l1', { opacity: 0, scale: 0.4 }).set('.k', { scale: 1 })
    ink(tl, '.tr1', 0.3, 1.6)
    tl.to('.k1', { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1 }, 0.75)
      .to('.k2', { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1 }, 1.3)
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <rect x={20} y={8} width={200} height={110} rx={10} fill="#132a52" />
    <path className="draw tr1" pathLength={1} d="M36 100 H110 V40 H200" stroke={ME} strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    <g className="k k1" data-o transform="translate(110 100)"><rect x={-9} y={-9} width={18} height={18} rx={4} fill="#fff" /><path d="M-4 3 L0 -3 L4 3" stroke="#1d3a6e" strokeWidth={2} fill="none" /></g>
    <g className="k k2" data-o transform="translate(110 40)"><rect x={-9} y={-9} width={18} height={18} rx={4} fill="#fff" /><path d="M-3 -4 L3 0 L-3 4" stroke="#1d3a6e" strokeWidth={2} fill="none" /></g>
    <Pill cls="l1" x={120} y={136} text="swipe or use arrows to turn" />
  </Scene>
)

const CyCrash = () => (
  <Scene build={(tl) => {
    tl.set('.draw', { strokeDasharray: 1, strokeDashoffset: 1 }).set('.bang', { scale: 0 }).set('.l1', { opacity: 0, scale: 0.4 }).set('.tr2', { opacity: 1 })
    ink(tl, '.tr1', 0.2, 1)
    ink(tl, '.tr2', 0.5, 0.9)
    tl.to('.bang', { scale: 1, ease: 'back.out(3)' }).to('.tr2', { opacity: 0.35, duration: 0.3 }, '<')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <rect x={20} y={8} width={200} height={110} rx={10} fill="#132a52" />
    <path className="draw tr1" pathLength={1} d="M40 64 H200" stroke={ME} strokeWidth={5} fill="none" strokeLinecap="round" />
    <path className="draw tr2" pathLength={1} d="M150 112 V100 H130 V68" stroke={YOU} strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    <g className="bang" data-o transform="translate(130 66)"><path d="M0 -14 L4 -5 L14 -6 L7 1 L12 12 L0 6 L-12 12 L-7 1 L-14 -6 L-4 -5Z" fill="#ffb424" /></g>
    <Pill cls="l1" x={120} y={136} text="hit any wall or trail = out" bg="#ff5d73" />
  </Scene>
)

const CyWin = () => (
  <Scene build={(tl) => {
    tl.set('.pip', { fill: 'transparent' }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.pip', { fill: ME, duration: 0.2, stagger: 0.5 }, 0.4)
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <rect x={60} y={30} width={120} height={60} rx={30} fill={ME} opacity={0.2} />
    <text x={120} y={58} textAnchor="middle" className="rs-num" fontSize={20} fill="#fff">ROUNDS</text>
    {[0, 1, 2].map((i) => <circle key={i} className="pip" cx={96 + i * 24} cy={76} r={7} stroke={ME} strokeWidth={3} />)}
    <Pill cls="l1" x={120} y={124} text="last rider moving wins the round" bg={ME} />
  </Scene>
)

/* ---------- Quick Draw ---------- */

function Desert({ cls }: { cls?: string }) {
  return (
    <g>
      <rect className={cls} x={20} y={6} width={200} height={112} rx={12} fill="#ffc93c" />
      <circle cx={170} cy={40} r={18} fill="#fff3c4" />
      <path d="M20 96 Q120 86 220 96 V118 H20Z" fill="#c97a3a" />
      <g fill="#2fbf8f"><rect x={44} y={66} width={8} height={34} rx={4} /><rect x={36} y={74} width={6} height={12} rx={3} /><rect x={54} y={72} width={6} height={12} rx={3} /></g>
    </g>
  )
}
const QdFake = () => (
  <Scene build={(tl) => {
    tl.set('.weed', { x: 10, rotation: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.weed', { x: 230, rotation: 540, duration: 2, ease: 'none' }, 0.2)
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, 0.8)
  }}>
    <Desert />
    <text x={120} y={58} textAnchor="middle" className="rs-num" fontSize={22} fill="#fff">WAIT…</text>
    <g className="weed"><g transform="translate(0 90)"><circle r={9} fill="none" stroke="#8a6b3d" strokeWidth={2} /><path d="M-7 -3 Q0 6 7 -4 M0 -9 Q-4 0 0 9" stroke="#8a6b3d" strokeWidth={2} fill="none" /></g></g>
    <Pill cls="l1" x={120} y={136} text="fakes roll by — don't tap yet!" />
  </Scene>
)

const QdDraw = () => (
  <Scene build={(tl) => {
    tl.set('.bg', { fill: '#ffc93c' }).set('.dw', { scale: 0 }).set('.ms', { opacity: 0 }).set('.tap', { x: 200, y: 140, opacity: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.bg', { fill: '#ff3d5a', duration: 0.05 }, 0.8)
      .to('.dw', { scale: 1, duration: 0.25, ease: 'back.out(3)' }, 0.8)
    tapAt(tl, 120, 80, 0.95)
    tl.to('.ms', { opacity: 1, duration: 0.1 }).to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <Desert cls="bg" />
    <text className="dw" data-o x={120} y={62} textAnchor="middle" fontSize={30} fill="#fff" style={{ fontFamily: 'var(--font-display)' }}>DRAW!</text>
    <text className="ms rs-num" x={190} y={26} textAnchor="middle" fontSize={13} fill="#fff">184ms</text>
    <Tap />
    <Pill cls="l1" x={120} y={136} text="fastest tap takes the point" bg={ME} />
  </Scene>
)

const QdFoul = () => (
  <Scene build={(tl) => {
    tl.set('.tap', { x: 200, y: 140, opacity: 0 }).set('.foul', { scale: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
    tapAt(tl, 120, 80, 0.4)
    tl.to('.foul', { scale: 1, ease: 'back.out(3)' }).to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <Desert />
    <text x={120} y={40} textAnchor="middle" className="rs-num" fontSize={16} fill="#fff">WAIT…</text>
    <g className="foul" data-o><text x={120} y={70} textAnchor="middle" fontSize={22} fill="#ff3d5a" style={{ fontFamily: 'var(--font-display)' }}>TOO EARLY!</text></g>
    <Tap />
    <Pill cls="l1" x={120} y={136} text="early tap = out for that round" bg="#ff5d73" />
  </Scene>
)

/* ---------- Showdown ---------- */

function HandIcon({ kind, color }: { kind: string; color: string }) {
  if (kind === 'rock') return <path d="M-12 0 C-14 -10 -6 -15 0 -14 C10 -16 15 -8 13 2 C15 11 7 15 0 14 C-9 15 -15 9 -12 0Z" fill={color} />
  if (kind === 'paper') return <rect x={-11} y={-14} width={22} height={28} rx={3} fill={color} transform="rotate(-6)" />
  return <g fill={color}><path d="M-2 2 L14 -12 L16 -9 L1 5Z" /><path d="M-2 -2 L14 12 L16 9 L1 -5Z" /><circle cx={-8} cy={-6} r={5} fill="none" stroke={color} strokeWidth={3} /><circle cx={-8} cy={6} r={5} fill="none" stroke={color} strokeWidth={3} /></g>
}
const SdPick = () => (
  <Scene build={(tl) => {
    tl.set('.tap', { x: 200, y: 140, opacity: 0 }).set('.h', { scale: 1 }).set('.card2', { fill: '#fff' }).set('.ok', { scale: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
      .set('.timer', { scaleX: 1, transformOrigin: '0% 50%' })
      .to('.timer', { scaleX: 0, duration: 3, ease: 'none' }, 0)
    tapAt(tl, 120, 70, 0.6)
    tl.to('.card2', { fill: '#d9f66b', duration: 0.2 }).to('.ok', { scale: 1, ease: 'back.out(3)' }, '<')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <rect className="timer" x={40} y={10} width={160} height={6} rx={3} fill={ME} />
    {['rock', 'paper', 'scissors'].map((k, i) => (
      <g key={k} transform={`translate(${64 + i * 56} 66)`}>
        <rect className={`card${i + 1}`} x={-22} y={-28} width={44} height={56} rx={10} fill="#fff" stroke="#1d3a6e" strokeWidth={2} />
        <HandIcon kind={k} color="#1d3a6e" />
      </g>
    ))}
    <g className="ok" data-o transform="translate(138 42)"><circle r={8} fill={ME} /><path d="M-4 0 L-1 3 L4 -3" stroke="#fff" strokeWidth={2} fill="none" /></g>
    <Tap />
    <Pill cls="l1" x={120} y={124} text="pick in secret before time runs out" />
  </Scene>
)

const SdScore = () => {
  const ps = [{ k: 'rock', c: ME, g: 2 }, { k: 'scissors', c: YOU, g: 1 }, { k: 'scissors', c: '#ffb424', g: 1 }, { k: 'paper', c: '#2fbf8f', g: 1 }]
  return (
    <Scene build={(tl) => {
      tl.set('.rc', { scaleX: 0 }).set('.gn', { scale: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
        .to('.rc', { scaleX: 1, duration: 0.3, ease: 'back.out(2)', stagger: 0.15 }, 0.3)
        .to('.gn', { scale: 1, ease: 'back.out(3)', stagger: 0.1 })
        .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
    }}>
      {ps.map((p, i) => (
        <g key={i} transform={`translate(${48 + i * 48} 60)`}>
          <g className="rc" data-o>
            <rect x={-20} y={-26} width={40} height={52} rx={9} fill="#fff" stroke={p.c} strokeWidth={3} />
            <HandIcon kind={p.k} color={p.c} />
          </g>
          <g className="gn" data-o transform="translate(16 -26)"><circle r={9} fill={p.g > 1 ? ME : '#1d3a6e'} /><text dy="0.36em" textAnchor="middle" fontSize={9} fill="#fff" className="rs-pill">+{p.g}</text></g>
        </g>
      ))}
      <Pill cls="l1" x={120} y={124} text="1 point for every player you beat" bg={ME} />
    </Scene>
  )
}

/* ---------- Quick Maths ---------- */

const QM_OPTS = [40, 42, 48, 36]
function Sum() {
  return (
    <g>
      <rect x={60} y={6} width={120} height={36} rx={10} fill="#fff" stroke="#1d3a6e" strokeWidth={2} />
      <text x={120} y={30} textAnchor="middle" fontSize={20} fill="#1d3a6e" style={{ fontFamily: 'var(--font-display)' }}>6 × 7 = ?</text>
      {QM_OPTS.map((v, i) => (
        <g key={v} transform={`translate(${86 + (i % 2) * 68} ${62 + Math.floor(i / 2) * 32})`}>
          <rect className={`o${i}`} x={-30} y={-12} width={60} height={24} rx={8} fill="#fff" stroke="#1d3a6e" strokeWidth={2} />
          <text dy="0.36em" textAnchor="middle" fontSize={14} fill="#1d3a6e" style={{ fontFamily: 'var(--font-display)' }}>{v}</text>
        </g>
      ))}
    </g>
  )
}
const QmRight = () => (
  <Scene build={(tl) => {
    tl.set('.tap', { x: 210, y: 140, opacity: 0 }).set('.o1', { fill: '#fff' }).set('.plus', { opacity: 0, y: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
    tapAt(tl, 154, 66, 0.5)
    tl.to('.o1', { fill: '#d9f66b', duration: 0.2 }).to('.plus', { opacity: 1, y: -10, ease: 'back.out(3)' }, '<')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <Sum />
    <text className="plus rs-num" x={196} y={58} textAnchor="middle" fontSize={16} fill={ME}>+1</text>
    <Tap />
    <Pill cls="l1" x={120} y={136} text="first right answer scores" bg={ME} />
  </Scene>
)
const QmWrong = () => (
  <Scene build={(tl) => {
    tl.set('.tap', { x: 210, y: 140, opacity: 0 }).set('.o2', { fill: '#fff' }).set('.lk', { opacity: 0, scale: 0.4 }).set('.l1', { opacity: 0, scale: 0.4 })
    tapAt(tl, 86, 98, 0.5)
    tl.to('.o2', { fill: '#ff5d73', duration: 0.2 }).to('.lk', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <Sum />
    <g className="lk" data-o transform="translate(210 80)">
      <rect x={-12} y={-4} width={24} height={18} rx={4} fill="#1d3a6e" />
      <path d="M-7 -4 V-9 A7 7 0 0 1 7 -9 V-4" fill="none" stroke="#1d3a6e" strokeWidth={3.5} />
    </g>
    <Tap />
    <Pill cls="l1" x={120} y={136} text="wrong = locked out for that sum" bg="#ff5d73" />
  </Scene>
)


/* ---------- Ludo ---------- */

const LR = '#ff5d73', LG = '#43d17a', LY = '#ffc93c', LB = '#3d8bff'

function LPawn({ cls, color }: { cls: string; color: string }) {
  return (
    <g className={cls} data-o>
      <ellipse cy={9} rx={9} ry={3} fill="#1d3a6e" opacity={0.25} />
      <path d="M-8 8 Q-7 -1 -2.5 -2 L2.5 -2 Q7 -1 8 8Z" fill={color} stroke="#1d3a6e" strokeWidth={1.8} strokeLinejoin="round" />
      <circle cy={-6} r={5.4} fill={color} stroke="#1d3a6e" strokeWidth={1.8} />
      <circle cx={-1.8} cy={-7.6} r={1.5} fill="#fff" opacity={0.85} />
    </g>
  )
}

const DIE_PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}
/** A die with every face drawn; `face()` shows one of them. */
function LDie({ faces }: { faces: number[] }) {
  return (
    <g className="die" data-o>
      <rect x={-14} y={-14} width={28} height={28} rx={7} fill="#fff" stroke="#1d3a6e" strokeWidth={2.5} />
      {faces.map((n) => (
        <g key={n} className={`f${n}`}>
          {DIE_PIPS[n].map(([x, y], i) => <circle key={i} cx={x * 7} cy={y * 7} r={2.8} fill={n === 1 ? LR : '#1d3a6e'} />)}
        </g>
      ))}
    </g>
  )
}
function face(tl: gsap.core.Timeline, n: number, faces: number[], pos?: gsap.Position) {
  tl.to('.die', { rotation: '+=360', y: '-=10', duration: 0.3, ease: 'power2.out' }, pos)
    .set(faces.map((f) => `.f${f}`).join(','), { opacity: 0 })
    .set(`.f${n}`, { opacity: 1 })
    .to('.die', { y: '+=10', duration: 0.25, ease: 'bounce.out' })
}
/** Hop a pawn square by square through xs at height y. */
function hop(tl: gsap.core.Timeline, sel: string, xs: number[], y: number) {
  for (const x of xs) tl.to(sel, { keyframes: [{ y: y - 12, duration: 0.09, ease: 'power1.out' }, { x, y, duration: 0.11, ease: 'power1.in' }] })
}
function LRow({ x0, y, n, fill = () => '#fff', star = [] as number[] }: { x0: number; y: number; n: number; fill?: (i: number) => string; star?: number[] }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={x0 + i * 22 - 11} y={y - 11} width={22} height={22} fill={fill(i)} stroke="#1d3a6e" strokeWidth={1.5} />
        </g>
      ))}
      {star.map((i) => <g key={`s${i}`} transform={`translate(${x0 + i * 22} ${y})`}><G name="star" color="#ffe08a" size={16} /></g>)}
    </g>
  )
}
const sqx = (x0: number, i: number) => x0 + i * 22

const LudoStart = () => {
  const F = [3, 6]
  return (
    <Scene build={(tl) => {
      tl.set('.die', { x: 190, y: 40, rotation: 0 }).set('.f3', { opacity: 1 }).set('.f6', { opacity: 0 })
        .set('.p', { x: 50, y: 64, scale: 1 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
      face(tl, 3, F, 0.4)
      tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }).to('.p', { x: 46, duration: 0.07, yoyo: true, repeat: 3 }, '<')
        .to('.l1', { opacity: 0, duration: 0.2 }, '+=0.7')
      face(tl, 6, F)
      hop(tl, '.p', [sqx(104, 0)], 118)
      tl.to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' })
    }}>
      <rect x={18} y={28} width={68} height={72} rx={12} fill={LR} stroke="#1d3a6e" strokeWidth={2.5} />
      <rect x={30} y={40} width={44} height={48} rx={9} fill="#fff" stroke="#1d3a6e" strokeWidth={2} />
      <LRow x0={104} y={118} n={6} fill={(i) => (i === 0 ? LR : '#fff')} />
      <LDie faces={F} />
      <LPawn cls="p" color={LR} />
      <Pill cls="l1" x={190} y={76} text="need a 6 to get out" bg="#1d3a6e" />
      <Pill cls="l2" x={180} y={76} text="out! and roll again" bg={LR} />
    </Scene>
  )
}

const LudoRace = () => {
  const F = [4]
  return (
    <Scene build={(tl) => {
      tl.set('.die', { x: 120, y: 38, rotation: 0 }).set('.f4', { opacity: 1 }).set('.p', { x: sqx(42, 0), y: 100, scale: 1 }).set('.l1', { opacity: 0, scale: 0.4 })
      face(tl, 4, F, 0.4)
      hop(tl, '.p', [1, 2, 3, 4].map((i) => sqx(42, i)), 100)
      tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
    }}>
      <LRow x0={42} y={100} n={8} />
      <LDie faces={F} />
      <LPawn cls="p" color={LG} />
      <Pill cls="l1" x={120} y={134} text="move exactly what you roll" bg={LG} />
    </Scene>
  )
}

const LudoCapture = () => {
  const F = [3]
  return (
    <Scene build={(tl) => {
      tl.set('.die', { x: 40, y: 40, rotation: 0 }).set('.f3', { opacity: 1 }).set('.p', { x: sqx(54, 1), y: 104 }).set('.v', { x: sqx(54, 4), y: 104, rotation: 0, scale: 1, opacity: 1 })
        .set('.l1', { opacity: 0, scale: 0.4 }).set('.boom', { x: sqx(54, 4), y: 104, scale: 0, opacity: 1 })
      face(tl, 3, F, 0.4)
      hop(tl, '.p', [2, 3, 4].map((i) => sqx(54, i)), 104)
      tl.to('.boom', { scale: 1.6, opacity: 0, duration: 0.45 }, '-=0.05')
        .to('.v', { keyframes: [{ x: 196, y: 30, rotation: 360, duration: 0.35 }, { x: 206, y: 40, rotation: 720, duration: 0.3 }] }, '<')
        .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
    }}>
      <rect x={178} y={16} width={52} height={50} rx={10} fill={LB} stroke="#1d3a6e" strokeWidth={2.5} />
      <LRow x0={54} y={104} n={7} />
      <circle className="boom" data-o r={16} fill="none" stroke="#ffc93c" strokeWidth={4} />
      <LDie faces={F} />
      <LPawn cls="v" color={LB} />
      <LPawn cls="p" color={LR} />
      <Pill cls="l1" x={120} y={138} text="sent home! you roll again" bg={LR} />
    </Scene>
  )
}

const LudoSafe = () => {
  const F = [3]
  return (
    <Scene build={(tl) => {
      tl.set('.die', { x: 40, y: 40, rotation: 0 }).set('.f3', { opacity: 1 }).set('.p', { x: sqx(54, 1), y: 100 }).set('.v', { x: sqx(54, 4), y: 100 })
        .set('.l1', { opacity: 0, scale: 0.4 })
      face(tl, 3, F, 0.4)
      hop(tl, '.p', [2, 3].map((i) => sqx(54, i)), 100)
      tl.to('.p', { keyframes: [{ y: 88, duration: 0.09 }, { x: sqx(54, 4) - 6, y: 100, duration: 0.11 }] })
        .to('.v', { x: sqx(54, 4) + 6, duration: 0.2 }, '<')
        .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
    }}>
      <LRow x0={54} y={100} n={7} star={[4]} />
      <LDie faces={F} />
      <LPawn cls="v" color={LB} />
      <LPawn cls="p" color={LR} />
      <Pill cls="l1" x={120} y={136} text="stars + start squares are safe" bg="#1d3a6e" />
    </Scene>
  )
}

const LudoHome = () => {
  const F = [5, 2]
  return (
    <Scene build={(tl) => {
      tl.set('.die', { x: 40, y: 40, rotation: 0 }).set('.f5', { opacity: 1 }).set('.f2', { opacity: 0 }).set('.p', { x: sqx(70, 3), y: 96, scale: 1 })
        .set('.l1, .l2', { opacity: 0, scale: 0.4 }).set('.burst', { x: 196, y: 96, scale: 0, rotation: 0, opacity: 1 })
      face(tl, 5, F, 0.4)
      tl.to('.p', { x: sqx(70, 3) + 4, duration: 0.07, yoyo: true, repeat: 3 }).to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
        .to('.l1', { opacity: 0, duration: 0.2 }, '+=0.7')
      face(tl, 2, F)
      hop(tl, '.p', [sqx(70, 4), 196], 96)
      tl.to('.burst', { scale: 1.5, rotation: 90, duration: 0.5, ease: 'expo.out' }, '-=0.05').to('.burst', { opacity: 0, duration: 0.3 })
        .to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
    }}>
      <LRow x0={70} y={96} n={5} fill={(i) => (i === 0 ? '#fff' : LY)} />
      <polygon points="181,74 181,118 214,96" fill={LY} stroke="#1d3a6e" strokeWidth={2} strokeLinejoin="round" />
      <g className="burst" data-o><G name="burst" color="#fff" size={60} /></g>
      <LDie faces={F} />
      <LPawn cls="p" color={LY} />
      <Pill cls="l1" x={140} y={134} text="too far: needs the exact number" bg="#1d3a6e" />
      <Pill cls="l2" x={140} y={134} text="home! bonus roll" bg={LY} fg="#1d3a6e" />
    </Scene>
  )
}

const LudoFinish = () => (
  <Scene build={(tl) => {
    tl.set('.m', { x: 60, y: 62, scale: 0, rotation: -60 }).set('.p1, .p2, .p3, .p4', { y: 62, x: (i: number) => 44 + i * 10, scale: 1, opacity: 1 })
      .set('.q1', { x: 150, y: 70 }).set('.q2', { x: 190, y: 70 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.p1, .p2, .p3, .p4', { scale: 0.6, x: 60, y: 62, opacity: 0, duration: 0.4, stagger: 0.12 }, 0.4)
      .to('.m', { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2.5)' })
      .to('.q1', { keyframes: [{ y: 58, duration: 0.12 }, { y: 70, x: 162, duration: 0.12 }, { y: 58, duration: 0.12 }, { y: 70, x: 174, duration: 0.12 }] }, '+=0.2')
      .to('.q2', { keyframes: [{ y: 58, duration: 0.12 }, { y: 70, x: 202, duration: 0.12 }] })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <polygon points="30,40 30,86 60,63" fill={LR} stroke="#1d3a6e" strokeWidth={2} strokeLinejoin="round" />
    <polygon points="90,40 90,86 60,63" fill={LG} stroke="#1d3a6e" strokeWidth={2} strokeLinejoin="round" />
    <LPawn cls="p1" color={LR} /><LPawn cls="p2" color={LR} /><LPawn cls="p3" color={LR} /><LPawn cls="p4" color={LR} />
    <g className="m" data-o>
      <circle r={20} fill="#ffc93c" stroke="#1d3a6e" strokeWidth={3} />
      <text dy="0.36em" textAnchor="middle" className="rs-num" fontSize={15} fill="#fff">1st</text>
    </g>
    <LRow x0={150} y={80} n={4} />
    <LPawn cls="q1" color={LB} />
    <LPawn cls="q2" color={LY} />
    <Pill cls="l1" x={120} y={130} text="first home wins · the rest race on" bg="#1d3a6e" />
  </Scene>
)

/* ---------- the books ---------- */

export type RulePage = { title: string; text: string; Scene: ComponentType }
export type RuleBook = { goal: string; pages: RulePage[] }

export const RULES: Record<string, RuleBook> = {
  uno: {
    goal: 'Be the first to get rid of all your cards.',
    pages: [
      { title: 'Match the top card', text: 'On your turn, play one card that matches the top card by colour, number or picture.', Scene: UnoMatch },
      { title: 'Stuck? Draw one', text: 'Nothing fits? Take one card from the deck. If it fits, you can play it right away. If not, press Pass.', Scene: UnoDraw },
      { title: 'Action cards', text: 'Skip jumps over the next player. Reverse turns the order around. Draw Two makes the next player take 2 cards and miss their go.', Scene: UnoActions },
      { title: 'Wild cards', text: 'A Wild can go on anything, and you pick the new colour. Wild +4 also makes the next player take 4, but you may only play it when no other card in your hand could go down (with the official rule: no card of the current colour). The next player can challenge: bluffers take the 4 themselves, a wrong challenge costs 6 — and the challenger gets to see the hand.', Scene: UnoWild },
      { title: 'Shout UNO!', text: 'When you get down to one card, hit the UNO! button. Forget, and anyone can hit the big Catch! button before the next player moves — you take 2 cards.', Scene: UnoCall },
      { title: 'Going out', text: 'Play your last card and you’re out — 1st place, plus points for every card left in the other hands. You watch while everyone else plays on for 2nd, 3rd and so on, until one player is left. No stacking: a +2 can’t be passed on with another +2.', Scene: UnoWin },
    ],
  },
  pong: {
    goal: 'Get the ball past your friend’s paddle.',
    pages: [
      { title: 'Your paddle', text: 'You are the paddle at the bottom. Drag your finger or move your mouse left and right to move it.', Scene: PongMove },
      { title: 'Keep it going', text: 'Don’t let the ball get past you. Every hit makes it a little bit faster.', Scene: PongRally },
      { title: 'Aim with the edges', text: 'Hit the ball with the edge of your paddle to send it off at an angle. Hit it in the middle to send it straight.', Scene: PongAngle },
      { title: 'Scoring', text: 'If the ball gets past your friend, you get a point. First to the target (5, 7 or 11 — the host picks) wins.', Scene: PongScore },
    ],
  },
  tictactoe: {
    goal: 'Get three of your marks in a line.',
    pages: [
      { title: 'Take turns', text: 'X goes first (it’s picked at random). Tap an empty square to draw your mark, then it’s O’s turn.', Scene: TttTurns },
      { title: 'Three in a row', text: 'Line up three marks across, down or corner to corner and you win.', Scene: TttRow },
      { title: 'Block them', text: 'If your friend has two in a line, put your mark in the gap! If the board fills up with no line, it’s a draw.', Scene: TttBlock },
    ],
  },
  connect4: {
    goal: 'Connect four of your discs in a line.',
    pages: [
      { title: 'Drop a disc', text: 'On your turn, tap a column. Your disc falls down to the lowest empty spot.', Scene: C4Drop },
      { title: 'Four in a row', text: 'Get four of your colour in a line — across, up and down, or slanted — and you win.', Scene: C4Four },
      { title: 'Set a trap', text: 'Make two ways to win at once. Your friend can only block one of them! A full board with no winner is a draw.', Scene: C4Trap },
    ],
  },
  dots: {
    goal: 'Close more boxes than anyone else.',
    pages: [
      { title: 'Draw a line', text: 'On your turn, draw one line between two dots that sit next to each other.', Scene: DotsLine },
      { title: 'Close a box', text: 'Draw the last side of a box and it’s yours. You also get to go again!', Scene: DotsBox },
      { title: 'Careful with side three', text: 'Drawing the third side of a box lets the next player close it. Try to make your friends do that instead.', Scene: DotsCareful },
      { title: 'Chains', text: 'Closing one box can set up the next one, so you can grab a whole row in one go. When every box is taken, the most boxes wins.', Scene: DotsChain },
    ],
  },
  memory: {
    goal: 'Find more matching pairs than anyone else.',
    pages: [
      { title: 'Flip two', text: 'On your turn, tap two cards to turn them over. Everyone gets to see them.', Scene: MemFlip },
      { title: 'A match!', text: 'If both cards are the same, you keep the pair and take another turn.', Scene: MemMatch },
      { title: 'No match', text: 'If they’re different, they flip back over and the next player goes. Try to remember where everything was! Most pairs at the end wins.', Scene: MemMiss },
    ],
  },
  oddone: {
    goal: 'Spot the shape that’s different, fast.',
    pages: [
      { title: 'Find the odd one', text: 'You’ll see lots of the same shape. One of them is a little different — a different colour, turned, flipped, a different size, or a different number of points.', Scene: OddSpot },
      { title: 'Be the quickest', text: 'Everyone plays at the same time. The first person to tap the odd one gets the point.', Scene: OddRace },
      { title: 'Don’t guess', text: 'Tap the wrong one and you’re out for the rest of that round. There are 10 rounds and they get harder. Most points wins.', Scene: OddWrong },
    ],
  },
  echo: {
    goal: 'Copy the pattern for longer than everyone else.',
    pages: [
      { title: 'Watch', text: 'The pads light up one after another. Watch the order closely.', Scene: EchoWatch },
      { title: 'Copy it', text: 'Now tap the same pads in the same order. Everyone does it at the same time.', Scene: EchoRepeat },
      { title: 'It keeps growing', text: 'Each round adds one more step. Tap a wrong pad or run out of time and you’re out. Last one left wins — if it’s a tie, the fastest wins.', Scene: EchoGrow },
    ],
  },
  seabattle: {
    goal: 'Sink all of the other player’s ships first.',
    pages: [
      { title: 'Hide your fleet', text: 'Your five ships are placed for you. Don’t like the spot? Shuffle them. Press Ready when you’re happy — you can’t see their ships, and they can’t see yours.', Scene: SeaHide },
      { title: 'Take a shot', text: 'Tap a square on their sea. A splash means you missed and it’s their turn. A bang means you hit — and you get to shoot again!', Scene: SeaFire },
      { title: 'Sink them all', text: 'Hit every square of a ship and it sinks. The first player to sink the whole enemy fleet wins.', Scene: SeaSink },
    ],
  },
  checkers: {
    goal: 'Take all of their pieces, or leave them with no move.',
    pages: [
      { title: 'Step forward', text: 'Pieces move one square diagonally, forward only. Tap a piece, then tap where it should go.', Scene: CkMove },
      { title: 'Jump to capture', text: 'Hop over an enemy piece into the empty square behind it to take it. If you can jump, you must! If you can jump again, keep going.', Scene: CkJump },
      { title: 'Crown a king', text: 'Reach the far side and your piece becomes a king. Kings can move forwards and backwards.', Scene: CkKing },
    ],
  },
  reversi: {
    goal: 'Have the most discs of your colour when the board fills up.',
    pages: [
      { title: 'Trap and flip', text: 'Place a disc so a line of their discs is stuck between two of yours — across, up and down, or diagonally. All of them flip to your colour. Every move has to flip at least one.', Scene: RvFlip },
      { title: 'Count up', text: 'Can’t flip anything? Your turn is skipped. When nobody can move, the player with the most discs wins.', Scene: RvCount },
    ],
  },
  cycles: {
    goal: 'Be the last rider still moving.',
    pages: [
      { title: 'Drive and turn', text: 'Your bike never stops and leaves a glowing wall behind it. Swipe, use the arrow buttons, or the arrow keys to turn.', Scene: CyDrive },
      { title: 'Don’t crash', text: 'Hit the edge, your own wall, or anyone else’s wall and you’re out of the round. Cut in front of people to box them in!', Scene: CyCrash },
      { title: 'Win rounds', text: 'The last rider moving wins the round. Win enough rounds (three with two players, two with more) to win the game.', Scene: CyWin },
    ],
  },
  quickdraw: {
    goal: 'Tap faster than everyone when it says DRAW!',
    pages: [
      { title: 'Wait for it', text: 'Keep your finger still. Tumbleweeds, birds and dust will try to fool you.', Scene: QdFake },
      { title: 'DRAW!', text: 'When the screen turns red and says DRAW!, tap as fast as you can. The fastest tap wins the round.', Scene: QdDraw },
      { title: 'No cheating', text: 'Tap too early and you’re out for that round. Seven rounds — most wins takes it.', Scene: QdFoul },
    ],
  },
  showdown: {
    goal: 'Beat as many players as you can with rock, paper or scissors.',
    pages: [
      { title: 'Pick a hand', text: 'Everyone picks rock, paper or scissors in secret. You can change your mind until the timer runs out. No pick? You get a random one.', Scene: SdPick },
      { title: 'Score points', text: 'Rock beats scissors, scissors beats paper, paper beats rock. You get one point for every player you beat. Seven rounds, most points wins.', Scene: SdScore },
    ],
  },
  ludo: {
    goal: 'Get all four of your tokens round the board and home first.',
    pages: [
      { title: 'Roll a 6 to start', text: 'Tap the die on your turn. Your tokens wait in your corner until you roll a 6 — then one hops out onto your start square.', Scene: LudoStart },
      { title: 'Race round', text: 'Move one token exactly the number you rolled, clockwise round the board. Pick which token by tapping it (if only one can move, it goes by itself).', Scene: LudoRace },
      { title: 'Knock them home', text: 'Land right on someone else’s token and it goes back to their corner. You get another roll for it!', Scene: LudoCapture },
      { title: 'Safe squares', text: 'Nobody can be knocked home on a star or on any start square — tokens just share it there. Your own tokens can always share a square.', Scene: LudoSafe },
      { title: 'The home stretch', text: 'After one lap, your token turns up your coloured path to the middle. You need the exact number to land home — getting there earns another roll.', Scene: LudoHome },
      { title: 'Sixes and finishing', text: 'A 6 always means roll again, but three 6s in a row and your turn is over. Get all four home (two in Quick mode) to finish. You watch while the others race on for the next places.', Scene: LudoFinish },
    ],
  },
  quickmaths: {
    goal: 'Answer the most sums right, first.',
    pages: [
      { title: 'Be quick', text: 'A sum pops up with four answers. Everyone races — the first right answer gets the point. The sums get harder as you go.', Scene: QmRight },
      { title: 'Be sure', text: 'Pick a wrong answer and you’re locked out of that sum. Ten sums in all, most points wins.', Scene: QmWrong },
    ],
  },
}
