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
      { title: 'Wild cards', text: 'A Wild can go on anything, and you pick the new colour. Wild +4 also makes the next player take 4 — but only play it if no card matches the colour. They can challenge you if they think you cheated!', Scene: UnoWild },
      { title: 'Shout UNO!', text: 'When you get down to one card, hit the UNO! button. If someone catches you before you do, you take 2 cards.', Scene: UnoCall },
      { title: 'Winning', text: 'Play your last card to win. You score points for every card left in the other players’ hands. No stacking: a +2 can’t be passed on with another +2.', Scene: UnoWin },
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
}
