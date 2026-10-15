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
const CH: Record<string, string> = {
  red: '#ff5d73', yellow: '#ffc93c', green: '#43d17a', blue: '#3d8bff', wild: '#1b1f3f',
  pink: '#ff5fb8', teal: '#14b8a6', purple: '#8b5cf6', orange: '#ff8a1f',
}

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

/** `dark`: an UNO Flip dark-side face — black frame and oval, glyph in the card's colour. */
function MiniCard({ cls, c, t, back, dark }: { cls: string; c?: string; t?: string; back?: boolean; dark?: boolean }) {
  const col = back ? '#1b1f3f' : CH[c ?? 'red']
  const wheel = dark ? [CH.pink, CH.teal, CH.orange, CH.purple] : [CH.red, CH.blue, CH.yellow, CH.green]
  return (
    <g className={cls} data-o>
      <rect x={-17} y={-25} width={34} height={50} rx={5} fill={dark ? '#1b1f3f' : '#fff'} stroke="rgba(27,31,63,.3)" />
      <rect className="in" x={-14} y={-22} width={28} height={44} rx={3.5} fill={col} />
      <ellipse rx={10.5} ry={17} transform="rotate(28)" fill={back ? '#ff5d73' : dark ? '#1b1f3f' : '#fff'} />
      {back && <text dy="0.36em" textAnchor="middle" transform="rotate(-18)" className="rs-uno">UNO</text>}
      {!back && c === 'wild' && (!t || dark) && (
        <g transform="rotate(28)" opacity={t ? 0.55 : 1}>
          <path d="M0 0 L0 -15 A10 15 0 0 1 9 0 Z" fill={wheel[0]} />
          <path d="M0 0 L9 0 A10 15 0 0 1 0 15 Z" fill={wheel[1]} />
          <path d="M0 0 L0 15 A10 15 0 0 1 -9 0 Z" fill={wheel[2]} />
          <path d="M0 0 L-9 0 A10 15 0 0 1 0 -15 Z" fill={wheel[3]} />
        </g>
      )}
      {!back && t && <text dy="0.36em" textAnchor="middle" className="rs-num" fontSize={t.length > 1 ? 13 : 18} fill={c === 'wild' && dark ? '#fff' : col}>{t}</text>}
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

/* ---------- UNO Flip ---------- */

/** One card that can show either face; `.lt` / `.dk` swap mid-turn. */
function TwoFace({ cls, l, d }: { cls: string; l: [string, string?]; d: [string, string?] }) {
  return (
    <g className={cls} data-o>
      <g className="lt"><MiniCard cls="f" c={l[0]} t={l[1]} /></g>
      <g className="dk"><MiniCard cls="f" c={d[0]} t={d[1]} dark /></g>
    </g>
  )
}

const UnoFlipTurn = () => (
  <Scene build={(tl) => {
    const all = '.pile, .h1, .h2, .h3, .fl'
    tl.set(...hand('.pile', 120, 46, -4)).set(...hand('.h1', 72, 122, -10)).set(...hand('.h2', 120, 118)).set(...hand('.h3', 168, 122, 10))
      .set(...hand('.fl', 214, 64, 12)).set(`${all} .lt`, { opacity: 1 }).set(`${all} .dk`, { opacity: 0 })
      .set('.night', { opacity: 0 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
      .to('.fl', { x: 122, y: 44, rotation: 6, duration: 0.6, ease: 'back.out(1.3)' }, 0.4)
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .to(all, { scaleX: 0, duration: 0.2, ease: 'power1.in', stagger: 0.06 }, '+=0.5')
      // the pile turns over as a stack: the Flip goes to the bottom, the old bottom card is on top
      .set(`${all} .lt`, { opacity: 0 }).set(`${all} .dk`, { opacity: 1 }).set('.fl', { opacity: 0 })
      .to('.night', { opacity: 1, duration: 0.4 }, '<')
      .to(all, { scaleX: 1, duration: 0.3, ease: 'back.out(2)', stagger: 0.06 })
      .to('.l1', { opacity: 0, duration: 0.2 }, '<')
      .to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <rect className="night" x={-20} y={-20} width={280} height={190} fill="#1b1f3f" />
    <TwoFace cls="pile" l={['green', '4']} d={['purple', '8']} />
    <TwoFace cls="h1" l={['red', '2']} d={['teal', '+5']} />
    <TwoFace cls="h2" l={['blue', '7']} d={['orange', '3']} />
    <TwoFace cls="h3" l={['wild']} d={['pink', '6']} />
    <TwoFace cls="fl" l={['yellow', '↻']} d={['pink', '1']} />
    <Pill cls="l1" x={120} y={84} text="flip!" bg={CH.yellow} fg="#1b1f3f" />
    <Pill cls="l2" x={120} y={84} text="everything turns over" bg={CH.purple} />
  </Scene>
)

const UnoFlipLight = () => (
  <Scene build={(tl) => {
    tl.set('.k1, .k2, .k3', { scale: 0, rotation: -30, y: 56 }).set('.k1', { x: 50 }).set('.k2', { x: 120 }).set('.k3', { x: 190 })
      .set('.p1, .p2, .p3', { opacity: 0, scale: 0.4 })
    ;(['1', '2', '3'] as const).forEach((n, i) => {
      tl.to(`.k${n}`, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.4)' }, i === 0 ? 0.3 : '+=0.35')
        .to(`.p${n}`, { opacity: 1, scale: 1, ease: 'back.out(3)' }, '-=0.2')
    })
    tl.to('.k1', { y: 48, duration: 0.15, yoyo: true, repeat: 3 }, '+=0.3')
      .to('.k2', { scaleX: -1, duration: 0.4, yoyo: true, repeat: 1, ease: 'power2.inOut' }, '<0.2')
      .to('.k3', { rotation: 12, duration: 0.1, yoyo: true, repeat: 5 }, '<0.2')
  }}>
    <MiniCard cls="k1" c="red" t="+1" />
    <MiniCard cls="k2" c="yellow" t="↻" />
    <MiniCard cls="k3" c="wild" t="+2" />
    <Pill cls="p1" x={50} y={112} text="draw 1, miss go" />
    <Pill cls="p2" x={120} y={112} text="flip the table" />
    <Pill cls="p3" x={190} y={112} text="wild draw 2" bg={CH.red} />
  </Scene>
)

const UnoFlipDark = () => (
  <Scene build={(tl) => {
    tl.set('.k1, .k2, .k3', { scale: 0, rotation: -30, y: 56 }).set('.k1', { x: 50 }).set('.k2', { x: 120 }).set('.k3', { x: 190 })
      .set('.p1, .p2, .p3', { opacity: 0, scale: 0.4 }).set('.ring', { opacity: 0, scale: 0.5 })
    ;(['1', '2', '3'] as const).forEach((n, i) => {
      tl.to(`.k${n}`, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.4)' }, i === 0 ? 0.3 : '+=0.35')
        .to(`.p${n}`, { opacity: 1, scale: 1, ease: 'back.out(3)' }, '-=0.2')
    })
    tl.to('.k1', { y: 48, duration: 0.12, yoyo: true, repeat: 5 }, '+=0.3')
      .to('.ring', { opacity: 1, scale: 1.4, duration: 0.5, ease: 'expo.out' }, '<0.2')
      .to('.ring', { opacity: 0, duration: 0.3 })
      .to('.k3', { rotation: 360, duration: 0.6, ease: 'power2.inOut' }, '<')
  }}>
    <rect x={-20} y={-20} width={280} height={190} fill="#1b1f3f" />
    <circle className="ring" cx={0} cy={0} r={30} fill="none" stroke={CH.teal} strokeWidth={3} transform="translate(120 56)" data-o />
    <MiniCard cls="k1" c="pink" t="+5" dark />
    <MiniCard cls="k2" c="teal" t="⊘" dark />
    <MiniCard cls="k3" c="wild" t="+?" dark />
    <Pill cls="p1" x={50} y={112} text="draw 5, miss go" bg={CH.pink} />
    <Pill cls="p2" x={120} y={112} text="skip everyone" bg={CH.teal} />
    <Pill cls="p3" x={190} y={112} text="draw till colour" bg={CH.purple} />
  </Scene>
)

const UnoDrawColour = () => (
  <Scene build={(tl) => {
    tl.set(...hand('.w', 64, 56, -6)).set('.w .in', { fill: CH.wild }).set('.chip', { x: 64, y: 104, opacity: 0, scale: 0.4 })
      .set('.d0, .d1, .d2, .d3', { x: 120, y: 56, opacity: 0, scale: 0.6, rotation: 0 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.w', { scale: 1.12, duration: 0.15, yoyo: true, repeat: 1 }, 0.3)
      .to('.w .in', { fill: CH.orange, duration: 0.3 }, '<')
      .to('.chip', { opacity: 1, scale: 1, ease: 'back.out(3)' })
    ;[0, 1, 2, 3].forEach((i) => {
      tl.to(`.d${i}`, { opacity: 1, scale: 0.85, x: 128 + i * 26, y: 100, rotation: -8 + i * 6, duration: 0.4, ease: 'back.out(1.8)' }, '+=0.25')
    })
    tl.to('.d3', { y: 92, scale: 1, duration: 0.25, ease: 'back.out(3)' })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '<')
  }}>
    <rect x={-20} y={-20} width={280} height={190} fill="#1b1f3f" />
    <MiniCard cls="w" c="wild" t="+?" dark />
    <g className="chip" data-o>
      <rect x={-30} y={-9} width={60} height={18} rx={9} fill={CH.orange} />
      <text dy="0.36em" textAnchor="middle" className="rs-pill" fill="#fff">orange!</text>
    </g>
    <MiniCard cls="d0" c="purple" t="3" dark />
    <MiniCard cls="d1" c="teal" t="9" dark />
    <MiniCard cls="d2" c="pink" t="+5" dark />
    <MiniCard cls="d3" c="orange" t="2" dark />
    <Pill cls="l1" x={160} y={30} text="drawing stops on orange" bg={CH.orange} />
  </Scene>
)

/* ---------- UNO No Mercy ---------- */

const UnoMercyStack = () => (
  <Scene build={(tl) => {
    tl.set('.s0, .s1, .s2, .s3', { x: 120, y: -60, opacity: 0, rotation: 0 }).set('.tot', { opacity: 0, scale: 0.4 }).set('.l1', { opacity: 0, scale: 0.4 })
    ;[0, 1, 2, 3].forEach((i) => {
      tl.to(`.s${i}`, { opacity: 1, y: 60 - i * 3, x: 96 + i * 16, rotation: -14 + i * 9, duration: 0.45, ease: 'back.out(1.8)' }, i === 0 ? 0.3 : '+=0.35')
        .to('.tot', { opacity: 1, scale: 1.25, duration: 0.15, ease: 'power2.out' }, '<0.2')
        .set('.tot text', { opacity: 0 }).set(`.tot .t${i}`, { opacity: 1 })
        .to('.tot', { scale: 1, duration: 0.3, ease: 'back.out(3)' })
    })
    tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' }, '+=0.2')
  }}>
    <MiniCard cls="s0" c="red" t="+2" />
    <MiniCard cls="s1" c="blue" t="+4" />
    <MiniCard cls="s2" c="wild" t="+6" />
    <MiniCard cls="s3" c="wild" t="+10" />
    <g className="tot" transform="translate(205 40)" data-o>
      <rect x={-26} y={-15} width={52} height={30} rx={10} fill={CH.red} />
      {['+2', '+6', '+12', '+22'].map((t, i) => <text key={t} className={`rs-num t${i}`} dy="0.36em" textAnchor="middle" fontSize={17} fill="#fff" opacity={i ? 0 : 1}>{t}</text>)}
    </g>
    <Pill cls="l1" x={120} y={128} text="can’t stack? take the lot" bg={CH.red} />
  </Scene>
)

const UnoMercyCards = () => (
  <Scene build={(tl) => {
    tl.set('.k1, .k2, .k3', { scale: 0, rotation: -30, y: 56 }).set('.k1', { x: 50 }).set('.k2', { x: 120 }).set('.k3', { x: 190 })
      .set('.p1, .p2, .p3', { opacity: 0, scale: 0.4 })
    ;(['1', '2', '3'] as const).forEach((n, i) => {
      tl.to(`.k${n}`, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.4)' }, i === 0 ? 0.3 : '+=0.35')
        .to(`.p${n}`, { opacity: 1, scale: 1, ease: 'back.out(3)' }, '-=0.2')
    })
    tl.to('.k1', { x: 64, duration: 0.3, yoyo: true, repeat: 3, ease: 'power2.inOut' }, '+=0.3')
      .to('.k2', { rotation: 360, duration: 0.7, ease: 'power2.inOut' }, '<')
      .to('.k3', { y: 44, duration: 0.15, yoyo: true, repeat: 3 }, '<0.2')
  }}>
    <MiniCard cls="k1" c="green" t="7" />
    <MiniCard cls="k2" c="yellow" t="0" />
    <MiniCard cls="k3" c="blue" t="≡" />
    <Pill cls="p1" x={50} y={112} text="swap hands" />
    <Pill cls="p2" x={120} y={112} text="pass hands on" />
    <Pill cls="p3" x={190} y={112} text="dump the colour" bg={CH.blue} />
  </Scene>
)

const UnoMercyKO = () => (
  <Scene build={(tl) => {
    tl.set('.f', { x: 120, y: 64, opacity: 0, rotation: 0, scale: 0.7 }).set('.ko', { opacity: 0, scale: 3, rotation: -30 })
      .to('.f', { opacity: 1, x: (i: number) => 40 + (i % 9) * 20, y: (i: number) => 50 + Math.floor(i / 9) * 26, rotation: () => gsap.utils.random(-20, 20), duration: 0.35, stagger: 0.07, ease: 'back.out(1.6)' }, 0.3)
      .to('.ko', { opacity: 1, scale: 1, rotation: -8, duration: 0.5, ease: 'back.out(2.4)' }, '+=0.2')
  }}>
    {Array.from({ length: 25 }, (_, i) => <MiniCard key={i} cls="f" c={(['red', 'yellow', 'green', 'blue'] as const)[i % 4]} t={String((i * 7) % 10)} />)}
    <g className="ko" transform="translate(120 70)" data-o>
      <rect x={-62} y={-20} width={124} height={40} rx={12} fill={CH.red} stroke="#1d3a6e" strokeWidth={3} />
      <text className="rs-num" dy="0.36em" textAnchor="middle" fontSize={20} fill="#fff">50 = OUT</text>
    </g>
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

/* ---------- Mogul ---------- */

const MSKY = '#8fd8ff', MPINK = '#ff5fb8', MNAVY = '#3d5bd9', MLIME = '#d9f66b'
const mx = (x0: number, i: number) => x0 + i * 26

/** A row of board tiles with colour bands; `go` marks the GO tile. */
function MRow({ x0, y, n, band = () => null, go = -1 }: { x0: number; y: number; n: number; band?: (i: number) => string | null; go?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const b = band(i)
        return (
          <g key={i}>
            <rect x={mx(x0, i) - 13} y={y - 18} width={26} height={36} fill={i === go ? MLIME : '#fff8ec'} stroke="#1d3a6e" strokeWidth={1.5} />
            {b && <rect x={mx(x0, i) - 13} y={y - 18} width={26} height={8} fill={b} stroke="#1d3a6e" strokeWidth={1.5} />}
            {i === go && <text x={mx(x0, i)} y={y + 2} dy="0.36em" textAnchor="middle" className="rs-num" fontSize={11} fill="#e64fe0">GO</text>}
          </g>
        )
      })}
    </g>
  )
}
function MToken({ cls, color }: { cls: string; color: string }) {
  return (
    <g className={cls} data-o>
      <ellipse cy={9} rx={8} ry={2.6} fill="#1d3a6e" opacity={0.25} />
      <circle r={8} fill={color} stroke="#1d3a6e" strokeWidth={2} />
      <circle cx={-2.6} cy={-1.5} r={1.4} fill="#1d3a6e" /><circle cx={2.6} cy={-1.5} r={1.4} fill="#1d3a6e" />
      <path d="M-3 2.6 Q0 5 3 2.6" stroke="#1d3a6e" strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </g>
  )
}
function MDice() {
  return (
    <g className="dice" data-o>
      {[[-15, 3], [15, 4]].map(([x, n]) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <rect x={-12} y={-12} width={24} height={24} rx={6} fill="#fff" stroke="#1d3a6e" strokeWidth={2.2} />
          {DIE_PIPS[n].map(([px, py], i) => <circle key={i} cx={px * 6} cy={py * 6} r={2.4} fill="#1d3a6e" />)}
        </g>
      ))}
    </g>
  )
}
const rollDice = (tl: gsap.core.Timeline, pos?: gsap.Position) =>
  tl.to('.dice', { rotation: '+=360', y: '-=12', duration: 0.32, ease: 'power2.out' }, pos).to('.dice', { y: '+=12', duration: 0.25, ease: 'bounce.out' })
function MCoin({ cls }: { cls: string }) {
  return (
    <g className={cls} data-o>
      <circle r={7} fill="#ffc93c" stroke="#1d3a6e" strokeWidth={1.8} />
      <text dy="0.36em" textAnchor="middle" className="rs-num" fontSize={9} fill="#1d3a6e">$</text>
    </g>
  )
}
function MHouse({ cls, hotel }: { cls: string; hotel?: boolean }) {
  return <path className={cls} data-o d={hotel ? 'M-9 4 V-3 L0 -8 L9 -3 V4 Z' : 'M-4.5 4 V-1 L0 -5 L4.5 -1 V4 Z'} fill={hotel ? '#ff5d73' : '#43d17a'} stroke="#1d3a6e" strokeWidth={1.5} strokeLinejoin="round" />
}
function MDeed({ cls, color, name, price }: { cls: string; color: string; name: string; price: string }) {
  return (
    <g className={cls} data-o>
      <rect x={-34} y={-24} width={68} height={48} rx={6} fill="#fff" stroke="#1d3a6e" strokeWidth={2} />
      <rect x={-34} y={-24} width={68} height={16} rx={6} fill={color} stroke="#1d3a6e" strokeWidth={2} />
      <text y={-16} dy="0.36em" textAnchor="middle" className="rs-pill" fill="#1d3a6e">{name}</text>
      <text y={8} dy="0.36em" textAnchor="middle" className="rs-num" fontSize={15} fill="#1d3a6e">{price}</text>
    </g>
  )
}

const MogulMove = () => (
  <Scene build={(tl) => {
    tl.set('.dice', { x: 196, y: 36, rotation: 0 }).set('.p', { x: mx(30, 0), y: 106 }).set('.c', { x: mx(30, 2), y: 106, opacity: 0, scale: 0.4 })
      .set('.l1', { opacity: 0, scale: 0.4 })
    rollDice(tl, 0.4)
    for (const i of [1, 2, 3, 4]) {
      tl.to('.p', { keyframes: [{ y: 92, duration: 0.09, ease: 'power1.out' }, { x: mx(30, i), y: 106, duration: 0.11, ease: 'power1.in' }] })
      if (i === 2) tl.to('.c', { opacity: 1, scale: 1, y: 72, duration: 0.35, ease: 'back.out(2)' }, '<').to('.c', { opacity: 0, y: 52, duration: 0.3 }, '+=0.15')
    }
    tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <MRow x0={30} y={106} n={8} go={2} band={(i) => (i === 4 ? MSKY : i === 6 ? MPINK : null)} />
    <MDice />
    <MCoin cls="c" />
    <MToken cls="p" color="#e64fe0" />
    <Pill cls="l1" x={110} y={40} text="passing GO pays $200" bg="#1d3a6e" />
  </Scene>
)

const MogulBuy = () => (
  <Scene build={(tl) => {
    tl.set('.p', { x: mx(56, 0), y: 112 }).set('.d', { x: mx(56, 2), y: 52, scale: 0, opacity: 1 }).set('.tap', { x: 196, y: 128, opacity: 0 })
      .set('.own', { scaleX: 0, transformOrigin: '50% 50%' }).set('.l1, .b1', { opacity: 0, scale: 0.4 })
    for (const i of [1, 2]) tl.to('.p', { keyframes: [{ y: 98, duration: 0.09 }, { x: mx(56, i), y: 112, duration: 0.11 }] }, i === 1 ? 0.4 : undefined)
    tl.to('.d', { scale: 1, duration: 0.45, ease: 'back.out(2.5)' })
      .to('.b1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .to('.tap', { opacity: 1, duration: 0.2 }, '+=0.3')
    tap(tl, '.tap')
    tl.to('.d', { scale: 0.3, opacity: 0, x: mx(56, 2), y: 112, duration: 0.35, ease: 'power2.in' }, '+=0.1')
      .to('.own', { scaleX: 1, duration: 0.3, ease: 'back.out(2)' })
      .to('.b1, .tap', { opacity: 0, duration: 0.2 }, '<')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <MRow x0={56} y={112} n={5} band={(i) => (i >= 1 && i <= 3 ? MSKY : null)} />
    <rect className="own" data-o x={mx(56, 2) - 13} y={124} width={26} height={6} fill="#e64fe0" stroke="#1d3a6e" strokeWidth={1.2} />
    <MToken cls="p" color="#e64fe0" />
    <MDeed cls="d" color={MSKY} name="Kite Row" price="$100" />
    <Pill cls="b1" x={196} y={128} text="Buy $100" bg="#e64fe0" />
    <Tap />
    <Pill cls="l1" x={120} y={22} text="yours! or pass → everyone bids" bg="#1d3a6e" />
  </Scene>
)

const MogulRent = () => (
  <Scene build={(tl) => {
    tl.set('.p', { x: mx(70, 0), y: 100 }).set('.o', { x: 206, y: 40 }).set('.c1, .c2', { x: mx(70, 2), y: 100, opacity: 0 })
      .set('.l1', { opacity: 0, scale: 0.4 })
    for (const i of [1, 2]) tl.to('.p', { keyframes: [{ y: 86, duration: 0.09 }, { x: mx(70, i), y: 100, duration: 0.11 }] }, i === 1 ? 0.4 : undefined)
    tl.to('.c1', { keyframes: [{ opacity: 1, y: 80, duration: 0.15 }, { x: 206, y: 40, duration: 0.45, ease: 'power1.in' }, { opacity: 0, duration: 0.1 }] })
      .to('.c2', { keyframes: [{ opacity: 1, y: 80, duration: 0.15 }, { x: 206, y: 40, duration: 0.45, ease: 'power1.in' }, { opacity: 0, duration: 0.1 }] }, '-=0.5')
      .to('.o', { scale: 1.2, yoyo: true, repeat: 1, duration: 0.15 })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <MRow x0={70} y={100} n={5} band={(i) => (i >= 1 && i <= 3 ? MPINK : null)} />
    {[1, 2, 3].map((i) => <rect key={i} x={mx(70, i) - 13} y={112} width={26} height={6} fill="#45b8ff" stroke="#1d3a6e" strokeWidth={1.2} />)}
    <MToken cls="o" color="#45b8ff" />
    <MToken cls="p" color="#e64fe0" />
    <MCoin cls="c1" /><MCoin cls="c2" />
    <Pill cls="l1" x={110} y={36} text="whole set? rent doubles" bg="#45b8ff" />
  </Scene>
)

const MogulBuild = () => {
  const xs = [80, 120, 160]
  return (
    <Scene build={(tl) => {
      tl.set('.h1a, .h1b, .h1c, .h2a, .h2b, .h2c', { opacity: 0, y: -24 }).set('.ht', { opacity: 0, scale: 0 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
      for (const k of ['h1a', 'h1b', 'h1c', 'h2a', 'h2b', 'h2c']) tl.to(`.${k}`, { opacity: 1, y: 0, duration: 0.25, ease: 'bounce.out' }, k === 'h1a' ? 0.4 : '+=0.05')
      tl.to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
        .to('.l1', { opacity: 0, duration: 0.2 }, '+=0.9')
        .to('.h1a, .h2a', { opacity: 0, scale: 0.4, duration: 0.2 })
        .to('.ht', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(3)' })
        .to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' })
    }}>
      {xs.map((x) => (
        <g key={x}>
          <rect x={x - 18} y={64} width={36} height={50} fill="#fff8ec" stroke="#1d3a6e" strokeWidth={1.5} />
          <rect x={x - 18} y={64} width={36} height={12} fill="#ff8a1f" stroke="#1d3a6e" strokeWidth={1.5} />
        </g>
      ))}
      {['a', 'b', 'c'].map((s, i) => (
        <g key={s}>
          <g transform={`translate(${xs[i] - 7} 70)`}><MHouse cls={`h1${s}`} /></g>
          <g transform={`translate(${xs[i] + 7} 70)`}><MHouse cls={`h2${s}`} /></g>
        </g>
      ))}
      <g transform={`translate(${xs[0]} 70)`}><MHouse cls="ht" hotel /></g>
      <Pill cls="l1" x={120} y={34} text="build evenly across the set" bg="#ff8a1f" />
      <Pill cls="l2" x={120} y={34} text="4 houses → a hotel" bg="#ff5d73" />
      <text x={120} y={134} textAnchor="middle" className="rs-pill" fill="currentColor">one house each before a second</text>
    </Scene>
  )
}

const MogulCards = () => (
  <Scene build={(tl) => {
    tl.set('.back', { scaleX: 1, opacity: 1 }).set('.front', { scaleX: 0 }).set('.cd', { x: 120, y: 66, scale: 0.4, opacity: 0 })
      .set('.p', { x: 40, y: 126 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.cd', { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' }, 0.3)
      .to('.back', { scaleX: 0, duration: 0.18, ease: 'power1.in' }, '+=0.2')
      .to('.front', { scaleX: 1, duration: 0.18, ease: 'power1.out' })
      .to('.p', { keyframes: [{ y: 96, duration: 0.25, ease: 'power2.out' }, { x: 200, y: 126, duration: 0.45, ease: 'bounce.out' }] }, '+=0.5')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <rect x={186} y={110} width={28} height={30} fill={MLIME} stroke="#1d3a6e" strokeWidth={1.5} />
    <text x={200} y={125} dy="0.36em" textAnchor="middle" className="rs-num" fontSize={11} fill="#e64fe0">GO</text>
    <g className="cd" data-o>
      <g className="back" data-o>
        <rect x={-46} y={-30} width={92} height={60} rx={8} fill="#e64fe0" stroke="#1d3a6e" strokeWidth={2.5} />
        <text dy="0.36em" textAnchor="middle" className="rs-num" fontSize={34} fill="#fff">?</text>
      </g>
      <g className="front" data-o>
        <rect x={-46} y={-30} width={92} height={60} rx={8} fill="#fff8ec" stroke="#1d3a6e" strokeWidth={2.5} />
        <text y={-12} textAnchor="middle" className="rs-pill" fill="#e64fe0">CHANCE</text>
        <text y={6} textAnchor="middle" className="rs-pill" fill="#1d3a6e">Advance to GO</text>
        <text y={18} textAnchor="middle" className="rs-pill" fill="#1d3a6e">collect $200</text>
      </g>
    </g>
    <MToken cls="p" color="#e64fe0" />
    <Pill cls="l1" x={92} y={18} text="16 Chance + 16 Chest cards" bg="#1d3a6e" />
  </Scene>
)

const MogulJail = () => (
  <Scene build={(tl) => {
    tl.set('.p', { x: 40, y: 110, rotation: 0 }).set('.o1, .o2, .o3', { opacity: 0, scale: 0.4 })
      .to('.p', { keyframes: [{ x: 70, y: 40, rotation: 180, duration: 0.35, ease: 'power2.out' }, { x: 92, y: 80, rotation: 360, duration: 0.35, ease: 'bounce.out' }] }, 0.4)
      .set('.p', { rotation: 0 })
      .to('.o1, .o2, .o3', { opacity: 1, scale: 1, ease: 'back.out(3)', stagger: 0.25 }, '+=0.3')
  }}>
    <rect x={62} y={52} width={60} height={60} rx={8} fill="#ffd9a8" stroke="#1d3a6e" strokeWidth={2.5} />
    <MToken cls="p" color="#e64fe0" />
    {[0, 1, 2, 3].map((k) => <line key={k} x1={72 + k * 13} x2={72 + k * 13} y1={56} y2={108} stroke="#1d3a6e" strokeWidth={3} />)}
    <Pill cls="o1" x={182} y={48} text="pay $50" bg="#1d3a6e" />
    <Pill cls="o2" x={182} y={78} text="use a free card" bg="#43d17a" fg="#1d3a6e" />
    <Pill cls="o3" x={182} y={108} text="or roll doubles" bg="#e64fe0" />
  </Scene>
)

const MogulCash = () => (
  <Scene build={(tl) => {
    tl.set('.m', { opacity: 0, scale: 0.4 }).set('.c1', { x: 84, y: 76, opacity: 0 }).set('.l1, .l2', { opacity: 0, scale: 0.4 })
      .to('.m', { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' }, 0.5)
      .to('.c1', { keyframes: [{ opacity: 1, y: 56, duration: 0.25 }, { x: 180, y: 76, duration: 0.4 }, { opacity: 0, duration: 0.1 }] })
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
      .to('.l1', { opacity: 0, duration: 0.2 }, '+=1')
      .to('.l2', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <rect x={62} y={52} width={44} height={60} fill="#fff8ec" stroke="#1d3a6e" strokeWidth={1.5} />
    <rect x={62} y={52} width={44} height={13} fill={MNAVY} stroke="#1d3a6e" strokeWidth={1.5} />
    <g className="m" data-o>
      <rect x={64} y={67} width={40} height={43} fill="rgba(29,58,110,0.2)" />
      <circle cx={84} cy={88} r={10} fill="#1d3a6e" />
      <text x={84} y={88} dy="0.36em" textAnchor="middle" className="rs-num" fontSize={11} fill="#fff">M</text>
    </g>
    <MCoin cls="c1" />
    <circle cx={180} cy={76} r={14} fill="#e64fe0" stroke="#1d3a6e" strokeWidth={2} />
    <Pill cls="l1" x={120} y={132} text="mortgage: half the price back" bg="#1d3a6e" />
    <Pill cls="l2" x={120} y={132} text="still short? bankrupt — you're out" bg="#ff5d73" />
  </Scene>
)

const MogulTrade = () => (
  <Scene build={(tl) => {
    tl.set('.a', { x: 22, y: 64 }).set('.b', { x: 218, y: 64 }).set('.d1', { x: 56, y: 64 }).set('.d2', { x: 184, y: 64 }).set('.c', { x: 56, y: 106, opacity: 1 }).set('.l1', { opacity: 0, scale: 0.4 })
      .to('.d1', { x: 184, duration: 0.6, ease: 'power2.inOut' }, 0.6)
      .to('.d2', { x: 56, duration: 0.6, ease: 'power2.inOut' }, '<')
      .to('.c', { x: 184, duration: 0.6, ease: 'power2.inOut' }, '<0.1')
      .to('.l1', { opacity: 1, scale: 1, ease: 'back.out(3)' })
  }}>
    <MToken cls="a" color="#e64fe0" />
    <MToken cls="b" color="#45b8ff" />
    <MDeed cls="d1" color={MPINK} name="Neon Strip" price="$160" />
    <MDeed cls="d2" color={MSKY} name="Kite Row" price="$100" />
    <MCoin cls="c" />
    <Pill cls="l1" x={120} y={132} text="swap streets, cash and jail cards" bg="#1d3a6e" />
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
      { title: 'Wild cards', text: 'A Wild can go on anything, and you pick the new colour. Wild +4 also makes the next player take 4, but you may only play it when no other card in your hand could go down (with the official rule: no card of the current colour). The next player can challenge: a bluffer takes the 4 themselves; a wrong challenge costs 6, and you’re shown their hand as proof.', Scene: UnoWild },
      { title: 'Shout UNO!', text: 'When you get down to one card, hit the UNO! button. You get a couple of seconds’ head start. Forget, and anyone can hit the big Catch! button — you take 2 cards.', Scene: UnoCall },
      { title: 'Going out', text: 'Play your last card and you’re out — 1st place, plus points for every card left in the other hands. You watch while everyone else plays on for 2nd, 3rd and so on, until one player is left. No stacking: a +2 can’t be passed on with another +2.', Scene: UnoWin },
      { title: 'UNO Flip: two sides', text: 'Pick the Flip deck and every card has a light side and a dark side. Play starts on the light side. A Flip card turns the whole table over (your hand, the deck and the pile) and everyone carries on with the dark side until someone flips it back. You can’t see the other side of your own cards, but you can see it on everyone else’s.', Scene: UnoFlipTurn },
      { title: 'Light side cards', text: 'Red, yellow, green and blue. Draw One: the next player takes 1 and misses their go. Skip, Reverse and Flip go on the same colour or the same symbol. Wild Draw Two: the next player takes 2, but only play it with no card of the colour in play. It can be challenged: a bluffer takes 2, and a wrong challenge takes 4.', Scene: UnoFlipLight },
      { title: 'Dark side cards', text: 'Pink, teal, purple and orange. Draw Five: the next player takes 5 and misses their go. Skip Everyone skips the whole table, so you go again. Reverse and Flip work just like on the light side.', Scene: UnoFlipDark },
      { title: 'Wild Draw Colour', text: 'Name a colour: the next player draws until they get a card of that colour, and misses their go. Like +4, it can be challenged: a bluffer draws until the colour instead, and a wrong challenge draws until the colour plus 2 more. Cards score by the side in play: Skip Everyone 30, Wild 40, Wild Draw Two 50, Wild Draw Colour 60.', Scene: UnoDrawColour },
      { title: 'No Mercy: stack it', text: 'Pick the No Mercy deck (168 cards, no challenges). Any draw card can be answered with a draw card at least as big, in any colour: +2, +4, Wild Reverse +4, +6, +10. The pile grows until someone can’t or won’t stack, and they take the whole lot and miss their go. Wild Reverse +4 turns play round first, so it heads back the way it came.', Scene: UnoMercyStack },
      { title: 'No Mercy: wild new cards', text: 'Play a 7 to swap hands with anyone. Play a 0 and every hand passes one seat along. Discard All throws away every other card of that colour you hold. Colour Roulette makes the next player name a colour and turn cards over until it shows, keeping them all. Can’t play? Keep drawing until you can.', Scene: UnoMercyCards },
      { title: 'No Mercy: the mercy rule', text: 'Hold 50 cards or more and you’re knocked out of the round. Everyone else plays on; the last ones standing take the top places.', Scene: UnoMercyKO },
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
  dots: {
    goal: 'Close more boxes than anyone else.',
    pages: [
      { title: 'Draw a line', text: 'On your turn, draw one line between two dots that sit next to each other.', Scene: DotsLine },
      { title: 'Close a box', text: 'Draw the last side of a box and it’s yours. You also get to go again!', Scene: DotsBox },
      { title: 'Careful with side three', text: 'Drawing the third side of a box lets the next player close it. Try to make your friends do that instead.', Scene: DotsCareful },
      { title: 'Chains', text: 'Closing one box can set up the next one, so you can grab a whole row in one go. When every box is taken, the most boxes wins.', Scene: DotsChain },
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
  quickdraw: {
    goal: 'Tap faster than everyone when it says DRAW!',
    pages: [
      { title: 'Wait for it', text: 'Keep your finger still. Tumbleweeds, birds and dust will try to fool you.', Scene: QdFake },
      { title: 'DRAW!', text: 'When the screen turns red and says DRAW!, tap as fast as you can. The fastest tap wins the round.', Scene: QdDraw },
      { title: 'No cheating', text: 'Tap too early and you’re out for that round. Seven rounds — most wins takes it.', Scene: QdFoul },
    ],
  },
  mogul: {
    goal: 'Buy streets, charge rent, build up your sets — and be the last one with money.',
    pages: [
      { title: 'Roll and move', text: 'Roll both dice and walk round the board. Every time you pass or land on GO, the bank pays you $200. Doubles mean roll again — but three in a row sends you to jail.', Scene: MogulMove },
      { title: 'Buy it or bid', text: 'Land on a street, station or utility nobody owns and you can buy it at the printed price. Pass, and it goes to auction: everyone can bid (you too), and the top bid wins.', Scene: MogulBuy },
      { title: 'Collect rent', text: 'Anyone landing on your property pays you rent. Own a whole colour set and the rent doubles. Stations pay more the more lines you own; utilities charge 4× (or 10×) the dice.', Scene: MogulRent },
      { title: 'Build houses', text: 'With a full set, build houses on your turn. Build evenly — one on each before a second on any. Four houses become a hotel. Tap your property to build.', Scene: MogulBuild },
      { title: 'Chance and Chest', text: 'Landing on one draws a card: move somewhere, collect money, pay fees or repairs, or a Get Out of Jail Free card to keep.', Scene: MogulCards },
      { title: 'Jail', text: 'Go To Jail, a card, or three doubles locks you up. On your turn pay $50, play a free card, or roll for doubles. Miss three times and you pay and move. You still collect rent inside.', Scene: MogulJail },
      { title: 'Short on cash', text: 'Can’t pay? Sell houses (half price back), mortgage property (half its price; no rent while mortgaged) or trade. If you still can’t, you’re bankrupt and everything goes to whoever you owe.', Scene: MogulCash },
      { title: 'Trade and win', text: 'Tap a player’s name on your turn to offer a trade. Last one with money wins — or, with a time limit, the richest by net worth when the clock runs out.', Scene: MogulTrade },
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
}
