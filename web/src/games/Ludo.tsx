import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents } from '../lib/net'
import { sfx } from '../lib/sound'
import { intro, ordinal } from '../lib/ui'
import { lowPower } from '../lib/perf'
import Avatar from '../components/Avatar'
import { TimerBar, TurnBanner } from './shared'
import './Ludo.css'

/* ---------- board geometry (15 x 15 cells, red's yard top-left, play runs clockwise) ---------- */

const S = 40                                     // svg units per cell
export const LUDO_HEX = ['#ff5d73', '#43d17a', '#ffc93c', '#3d8bff']
const LUDO_NAME = ['Red', 'Green', 'Yellow', 'Blue']
const HOME = 56
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47])
const STARTS = new Set([0, 13, 26, 39])

type Pt = [number, number]                       // [x, y] in cell units (cell centres sit on .5)

/** The 52 shared squares as [row, col], starting on red's start square. */
const TRACK_RC: Pt[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
]
const HOME_RC: Pt[][] = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
]
const YARD_ORIGIN: Pt[] = [[0, 0], [9, 0], [9, 9], [0, 9]]        // [x, y] of each 6x6 yard
const GOAL: Pt[] = [[6.85, 7.5], [7.5, 6.85], [8.15, 7.5], [7.5, 8.15]]
const cell = ([r, c]: Pt): Pt => [c + 0.5, r + 0.5]

/** Turn the board a quarter turn anticlockwise k times, so the viewer's own yard sits bottom-left. */
function rot([x, y]: Pt, k: number): Pt {
  let p: Pt = [x, y]
  for (let i = 0; i < k; i++) p = [p[1], 15 - p[0]]
  return p
}

function tokenSpot(color: number, progress: number, idx: number): Pt {
  if (progress < 0) {
    const [ox, oy] = YARD_ORIGIN[color]
    return [ox + (idx % 2 ? 4 : 2), oy + (idx < 2 ? 2 : 4)]
  }
  if (progress <= 50) return cell(TRACK_RC[(color * 13 + progress) % 52])
  if (progress < HOME) return cell(HOME_RC[color][progress - 51])
  const [gx, gy] = GOAL[color]
  const spread = [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]][idx]
  return [gx + spread[0] * (color % 2 ? 1.4 : 0.7), gy + spread[1] * (color % 2 ? 0.7 : 1.4)]
}

/** Every square a token passes through, start to finish (for the hop animation). */
function pathOf(color: number, from: number, to: number, idx: number): Pt[] {
  if (from < 0) return [tokenSpot(color, -1, idx), tokenSpot(color, 0, idx)]
  const pts: Pt[] = []
  for (let p = from; p <= to; p++) pts.push(tokenSpot(color, p, idx))
  return pts
}

/* ---------- static board ---------- */

const Board = memo(function Board({ k }: { k: number }) {
  const R = (p: Pt) => rot(p, k)
  const sq = (rc: Pt, fill: string, key: string, extra?: React.ReactNode) => {
    const [x, y] = R(cell(rc))
    return (
      <g key={key}>
        <rect x={(x - 0.5) * S} y={(y - 0.5) * S} width={S} height={S} fill={fill} stroke="#1d3a6e" strokeWidth="1.6" />
        {extra}
      </g>
    )
  }
  const star = (x: number, y: number, color: string) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? S * 0.15 : S * 0.34
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      return `${x * S + Math.cos(a) * r},${y * S + Math.sin(a) * r}`
    }).join(' ')
    return <polygon points={pts} fill={color} stroke="#1d3a6e" strokeWidth="1.6" strokeLinejoin="round" />
  }
  return (
    <g className="ld-boardart">
      <rect x={-10} y={-10} width={15 * S + 20} height={15 * S + 20} rx={34} fill="#1d3a6e" />
      <rect x={0} y={0} width={15 * S} height={15 * S} rx={22} fill="#fff8ec" />
      {/* yards */}
      {YARD_ORIGIN.map((o, c) => {
        const [x, y] = R([o[0] + 3, o[1] + 3])
        return (
          <g key={`y${c}`} className="ld-yard" data-color={c}>
            <rect x={(x - 3) * S + 3} y={(y - 3) * S + 3} width={6 * S - 6} height={6 * S - 6} rx={20} fill={LUDO_HEX[c]} stroke="#1d3a6e" strokeWidth="3" />
            <rect x={(x - 2) * S} y={(y - 2) * S} width={4 * S} height={4 * S} rx={18} fill="#fff" stroke="#1d3a6e" strokeWidth="3" />
            {[0, 1, 2, 3].map((i) => {
              const [sx, sy] = R(tokenSpot(c, -1, i))
              return <circle key={i} cx={sx * S} cy={sy * S} r={S * 0.42} fill={LUDO_HEX[c]} fillOpacity="0.25" stroke={LUDO_HEX[c]} strokeWidth="3" />
            })}
          </g>
        )
      })}
      {/* shared track */}
      {TRACK_RC.map((rc, i) => {
        const owner = STARTS.has(i) ? i / 13 : -1
        const [x, y] = R(cell(rc))
        return sq(rc, owner >= 0 ? LUDO_HEX[owner] : '#ffffff', `t${i}`,
          SAFE.has(i) ? star(x, y, owner >= 0 ? '#ffffff' : '#ffe08a') : null)
      })}
      {/* home columns */}
      {HOME_RC.map((col, c) => col.map((rc, i) => sq(rc, LUDO_HEX[c], `h${c}${i}`)))}
      {/* the finish: four triangles */}
      {[0, 1, 2, 3].map((c) => {
        const corners: Pt[][] = [[[6, 6], [6, 9]], [[6, 6], [9, 6]], [[9, 6], [9, 9]], [[6, 9], [9, 9]]]
        const pts = [...corners[c], [7.5, 7.5] as Pt].map((p) => R(p)).map(([x, y]) => `${x * S},${y * S}`).join(' ')
        return <polygon key={`g${c}`} points={pts} fill={LUDO_HEX[c]} stroke="#1d3a6e" strokeWidth="2.5" strokeLinejoin="round" />
      })}
      {(() => { const [x, y] = R([7.5, 7.5]); return <circle cx={x * S} cy={y * S} r={S * 0.42} fill="#fff8ec" stroke="#1d3a6e" strokeWidth="2.5" /> })()}
    </g>
  )
})

/* ---------- die ---------- */

const PIPS: Record<number, Pt[]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}
function DieFace({ n }: { n: number }) {
  return (
    <svg viewBox="-58 -58 116 116" className="ld-die-face" aria-hidden>
      <rect className="ld-die-ring" x={-52} y={-52} width={104} height={104} rx={28} fill="none" strokeWidth="6" />
      <rect x={-46} y={-46} width={92} height={92} rx={22} fill="#fff" stroke="#1d3a6e" strokeWidth="6" />
      {(PIPS[n] ?? []).map(([x, y], i) => <circle key={i} cx={x * 22} cy={y * 22} r={9.5} fill={n === 1 ? '#ff5d73' : '#1d3a6e'} />)}
    </svg>
  )
}

/* ---------- move physics ---------- */

type XY = { x: number; y: number }
type Seg =
  | { kind: 'crouch'; at: XY; dur: number }
  | { kind: 'fly'; a: XY; b: XY; dur: number; v0: number }
  | { kind: 'land'; at: XY; dur: number; last: boolean; step: number }

const GRAVITY = 95 * S          // svg units / s²: a one-square hop takes ~0.2s
const FEET = S * 0.28           // squash pivots on the base of the pawn

/**
 * Hops a token through `pts` (offsets from where React drew it) one square at a
 * time under gravity: a crouch before take-off, stretch in the air, a squash on
 * every landing and a damped wobble when it settles. The shadow stays on the
 * ground and shrinks with height. Calls `onLand` once it has settled and
 * returns a cancel function that snaps it to the end.
 */
function hop(el: SVGGElement, pts: XY[], fromYard: boolean, onLand: () => void): () => void {
  const lift = el.querySelector<SVGGElement>('.ld-lift')
  const shadow = el.querySelector<SVGEllipseElement>('.ld-shadow')
  const quick = lowPower ? 0.8 : 1
  const segs: Seg[] = [{ kind: 'crouch', at: pts[0], dur: 0.09 * quick }]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const d = Math.hypot(b.x - a.x, b.y - a.y) / S
    // longer jumps (out of the yard, onto the goal) go higher and hang longer
    const h = S * (fromYard ? 1.5 : Math.min(1.3, 0.38 + d * 0.12))
    const v0 = Math.sqrt(2 * GRAVITY * h)
    segs.push({ kind: 'fly', a, b, dur: (2 * v0) / GRAVITY * quick, v0 })
    const last = i === pts.length - 1
    segs.push({ kind: 'land', at: b, dur: (last ? 0.5 : 0.075) * quick, last, step: i })
  }
  const total = segs.reduce((t, sg) => t + sg.dur, 0)
  let start = 0, raf = 0, landed = 0, done = false

  const pose = (p: XY, height: number, squash: number, lean: number) => {
    gsap.set(el, { x: p.x, y: p.y })
    // squash > 0 flattens, < 0 stretches; volume roughly kept
    const sy = 1 - squash, sx = 1 + squash * 0.7
    lift?.setAttribute('transform', `translate(0 ${-height}) translate(0 ${FEET}) rotate(${lean}) scale(${sx} ${sy}) translate(0 ${-FEET})`)
    const k = 1 - 0.55 * Math.min(1, height / (S * 1.4))
    shadow?.setAttribute('transform', `translate(0 ${S * 0.3}) scale(${k}) translate(0 ${-S * 0.3})`)
    shadow?.setAttribute('opacity', String(0.3 * k))
  }

  const finish = () => {
    if (done) return
    done = true
    cancelAnimationFrame(raf)
    pose({ x: 0, y: 0 }, 0, 0, 0)
    lift?.removeAttribute('transform')
    shadow?.removeAttribute('transform')
    shadow?.setAttribute('opacity', '0.3')
    gsap.set(el, { x: 0, y: 0 })
    onLand()
  }

  const frame = (now: number) => {
    if (!start) start = now
    let t = (now - start) / 1000
    if (t >= total) return finish()
    for (const sg of segs) {
      if (t > sg.dur) { t -= sg.dur; continue }
      const u = t / sg.dur
      if (sg.kind === 'crouch') {
        pose(sg.at, 0, 0.2 * Math.sin(u * Math.PI / 2), 0)
      } else if (sg.kind === 'fly') {
        const x = sg.a.x + (sg.b.x - sg.a.x) * u, y = sg.a.y + (sg.b.y - sg.a.y) * u
        const height = sg.v0 * t - 0.5 * GRAVITY * t * t
        const vy = sg.v0 - GRAVITY * t
        const dir = Math.sign(sg.b.x - sg.a.x) || Math.sign(sg.b.y - sg.a.y) * 0.4
        pose({ x, y }, Math.max(0, height), -0.16 * Math.abs(vy) / sg.v0, dir * 9 * Math.sin(u * Math.PI))
      } else {
        if (sg.step > landed) { landed = sg.step; sfx.step(sg.step) }
        // impact squash: a short spring between hops, a damped wobble on the final landing
        const sq = sg.last
          ? 0.3 * Math.exp(-u * 5) * Math.cos(u * Math.PI * 3.2)
          : 0.24 * Math.sin((1 - u) * Math.PI / 2) * (1 - u * 0.4)
        pose(sg.at, 0, sq, 0)
      }
      break
    }
    raf = requestAnimationFrame(frame)
  }
  pose(pts[0], 0, 0, 0)
  raf = requestAnimationFrame(frame)
  return finish
}

/* ---------- game ---------- */

type Callout = { text: string; sub?: string; color: string; key: number }

export default function Ludo({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const seats: string[] = state.seats
  const colors: Record<string, number> = state.colors
  const tokens: Record<string, number[]> = state.tokens
  const places: Record<string, number> = state.places ?? {}
  const gone: string[] = state.left ?? []
  const legal: number[] = state.legal ?? []
  const myTurn = state.turn === me && !spectator && !state.over
  const canRoll = myTurn && state.phase === 'roll'
  const canMove = myTurn && state.phase === 'move'
  const turnColor = colors[state.turn] ?? 0
  // the viewer's own yard sits bottom-left; spectators see it from the first seat
  const viewColor = colors[me] ?? colors[seats[0]] ?? 0
  const k = (viewColor + 1) % 4
  const name = (pid: string) => (pid === me ? 'You' : players.find((p) => p.id === pid)?.name ?? room.players.find((p) => p.id === pid)?.name ?? '…')

  const [face, setFace] = useState<number>(state.dice ?? 6)
  const [rolling, setRolling] = useState(false)
  const [callout, setCallout] = useState<Callout | null>(null)
  const calloutTimer = useRef<number | undefined>(undefined)
  const shout = (text: string, color: string, sub?: string, hold = 1500) => {
    setCallout({ text, color, sub, key: Date.now() + Math.random() })
    clearTimeout(calloutTimer.current)
    calloutTimer.current = window.setTimeout(() => setCallout(null), hold)
  }

  // where each token is drawn; tokens sharing a square shuffle aside and shrink a little
  const spots = useMemo(() => {
    const at = new Map<string, { pid: string; i: number }[]>()
    const out: Record<string, { x: number; y: number; s: number }> = {}
    for (const pid of seats) {
      if (gone.includes(pid)) continue
      tokens[pid].forEach((p, i) => {
        const [x, y] = rot(tokenSpot(colors[pid], p, i), k)
        out[`${pid}:${i}`] = { x, y, s: 1 }
        if (p >= 0 && p < HOME) {
          const key = `${x},${y}`
          at.set(key, [...(at.get(key) ?? []), { pid, i }])
        }
      })
    }
    for (const group of at.values()) {
      if (group.length < 2) continue
      group.forEach(({ pid, i }, n) => {
        const a = (n / group.length) * Math.PI * 2 - Math.PI / 4
        const o = out[`${pid}:${i}`]
        out[`${pid}:${i}`] = { x: o.x + Math.cos(a) * 0.2, y: o.y + Math.sin(a) * 0.2, s: 0.72 }
      })
    }
    return out
  }, [JSON.stringify(tokens), k, gone.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // board drops in, tokens pop out of their yards
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.ld-board', ...intro({ y: 160, rotate: -6, scale: 0.9, duration: 0.9, ease: 'back.out(1.5)', delay: 0.6 }))
      gsap.fromTo('.ld-pawn', ...intro({ scale: 0, transformOrigin: '50% 80%', duration: 0.45, ease: 'back.out(3)', stagger: 0.03, delay: 1.1 }))
    }, root)
    return () => ctx.revert()
  }, [])

  // hop the moved token square by square, then knock any captured tokens home
  const seenMove = useRef<number | null>(state.last?.id ?? null)
  useLayoutEffect(() => {
    const last = state.last
    if (!last || last.id === seenMove.current) return
    seenMove.current = last.id
    const el = root.current?.querySelector<SVGGElement>(`.ld-tok[data-k="${last.pid}:${last.token}"] .ld-tok-in`)
    const end = spots[`${last.pid}:${last.token}`]
    if (!el || !end) return
    const color = colors[last.pid]
    const pts = pathOf(color, last.from, last.to, last.token).map((p) => rot(p, k))
    pts[pts.length - 1] = [end.x, end.y]
    const off = (p: Pt) => ({ x: (p[0] - end.x) * S, y: (p[1] - end.y) * S })
    gsap.killTweensOf(el)
    const tl = gsap.timeline({ paused: true })
    const hopper = hop(el, pts.map(off), last.from < 0, () => tl.play())
    for (const c of last.caught ?? []) {
      const v = root.current?.querySelector<SVGGElement>(`.ld-tok[data-k="${c.pid}:${c.token}"] .ld-tok-in`)
      const home = spots[`${c.pid}:${c.token}`]
      if (!v || !home) continue
      const hit = off(pts[pts.length - 1])
      const from = { x: hit.x + (end.x - home.x) * S, y: hit.y + (end.y - home.y) * S }
      gsap.killTweensOf(v)
      gsap.set(v, { ...from, rotate: 0 })
      // knocked out: a ballistic arc back to the yard, a spin, then a little bounce on landing
      tl.call(() => { sfx.hit(0.9); boom(end.x, end.y) }, undefined, 0)
        .to(v, { x: 0, duration: 0.7, ease: 'none' }, 0)
        .to(v, { rotate: from.x > 0 ? -540 : 540, duration: 0.7, ease: 'power1.out' }, 0)
        .to(v, { keyframes: [
          { y: Math.min(from.y, 0) - S * 3, duration: 0.32, ease: 'power2.out' },
          { y: 0, duration: 0.38, ease: 'bounce.out' },
        ] }, 0)
        .set(v, { rotate: 0 })
    }
    return () => { hopper(); tl.progress(1).kill() }
  }, [state.last?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const boom = (x: number, y: number) => {
    const ring = root.current?.querySelector<SVGCircleElement>('.ld-boom')
    if (!ring) return
    ring.setAttribute('cx', String(x * S)); ring.setAttribute('cy', String(y * S))
    gsap.fromTo(ring, { attr: { r: S * 0.3 }, opacity: 1 }, { attr: { r: S * 1.6 }, opacity: 0, duration: 0.5, ease: 'power2.out' })
  }

  // events → die tumble, callouts and sounds
  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) {
      switch (e.kind) {
        case 'roll': {
          setRolling(true)
          sfx.dice()
          let n = 0
          const spin = window.setInterval(() => {
            setFace(1 + Math.floor(Math.random() * 6))
            if (++n >= 6) {
              window.clearInterval(spin)
              setFace(e.dice)
              setRolling(false)
              const die = root.current?.querySelector('.ld-die')
              if (die) gsap.fromTo(die, { scale: 1.3 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
              if (e.dice === 6 && e.sixes < 3) shout('Six!', LUDO_HEX[colors[e.pid] ?? 0], e.pid === me ? 'roll again after you move' : `${name(e.pid)} rolls again`, 1100)
            }
          }, 70)
          break
        }
        case 'stuck':
          window.setTimeout(() => shout('No moves', '#1d3a6e', `${name(e.pid)} rolled a ${e.dice}`, 1100), 500)
          break
        case 'three6':
          window.setTimeout(() => { sfx.bad(); shout('Three 6s!', '#ff5d73', `${name(e.pid)} ${e.pid === me ? 'lose' : 'loses'} the turn`) }, 500)
          break
        case 'capture':
          window.setTimeout(() => {
            shout('Gotcha!', LUDO_HEX[colors[e.pid] ?? 0], `${name(e.pid)} sent ${e.victim === me ? 'you' : name(e.victim)} home · bonus roll`, 1700)
            if (e.victim === me) sfx.lose(); else if (e.pid === me) sfx.point()
          }, 400)
          break
        case 'home':
          window.setTimeout(() => { sfx.uno(); shout('Home!', LUDO_HEX[colors[e.pid] ?? 0], `${name(e.pid)} · ${e.count} in`, 1300) }, 500)
          break
        case 'out':
          window.setTimeout(() => {
            if (e.pid === me) { sfx.win(); shout(`${ordinal(e.place)}!`, '#ffb424', 'All home · watch the rest', 3000) }
            else { sfx.uno(); shout(`${name(e.pid)} finished!`, '#ffb424', `${ordinal(e.place)} place · the rest play on`, 2600) }
          }, 900)
          break
        case 'left':
          shout('Left', '#1d3a6e', `${name(e.pid)} left the board`)
          break
      }
    }
  }), [me, players, colors]) // eslint-disable-line react-hooks/exhaustive-deps

  // nudge when it's my go
  useEffect(() => { if (canRoll) sfx.pop() }, [canRoll])

  const roll = () => {
    if (!canRoll || rolling) return
    act({ type: 'roll' })
  }
  const move = (i: number) => {
    if (!canMove) return
    if (!legal.includes(i)) { sfx.bad(); return }
    sfx.click()
    act({ type: 'move', token: i })
  }

  // space / enter rolls, 1-4 picks a token
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return
      if ((e.key === ' ' || e.key === 'Enter') && canRoll) { e.preventDefault(); roll() }
      if (canMove && /^[1-4]$/.test(e.key)) move(Number(e.key) - 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const myTokens = tokens[me] ?? []
  const inYard = canRoll ? myTokens.filter((p) => p < 0).length : 0
  const banner = state.over ? 'Game over' :
    myTurn ? (state.phase === 'move' ? 'Pick a token!' : state.phase === 'roll' ? 'Your roll!' : 'Hold on…') :
    `${name(state.turn)}${state.phase === 'move' ? ' is moving…' : '’s roll'}`
  const hint = state.over ? '' :
    canMove ? (legal.length > 1 ? 'Tap a glowing token (or press 1–4)' : 'Moving your only option…') :
    canRoll ? (inYard > 0 && myTokens.every((p) => p < 0 || p === HOME) ? 'You need a 6 to bring a token out' : 'Tap the die (or press space)') :
    state.phase === 'wait' ? (state.sixes === 3 ? 'Three 6s — turn over' : 'No move this time') : ' '

  return (
    <div ref={root} className={`ld ${myTurn ? 'my-turn' : ''}`} style={{ ['--tc' as string]: LUDO_HEX[turnColor] }}>
      <TurnBanner state={state} me={me} players={players} spectator={spectator} text={banner} />

      <div className="ld-wrap">
        <svg viewBox={`-12 -12 ${15 * S + 24} ${15 * S + 24}`} className="ld-board">
          <Board k={k} />
          {/* glow on the yard whose turn it is */}
          {!state.over && (() => {
            const [x, y] = rot([YARD_ORIGIN[turnColor][0] + 3, YARD_ORIGIN[turnColor][1] + 3], k)
            return <rect className="ld-turnglow" x={(x - 3) * S + 3} y={(y - 3) * S + 3} width={6 * S - 6} height={6 * S - 6} rx={20} fill="none" stroke="#fff" strokeWidth="6" />
          })()}
          {/* names on the yards */}
          {seats.map((pid) => {
            const c = colors[pid]
            const [x, y] = rot([YARD_ORIGIN[c][0] + 3, YARD_ORIGIN[c][1] + 3], k)
            const place = places[pid]
            return (
              <g key={`n${pid}`} className={`ld-yardname ${gone.includes(pid) ? 'quit' : ''}`}>
                <text x={x * S} y={(y + 2.62) * S} textAnchor="middle" className="ld-yardlabel">{name(pid)}</text>
                {place && (
                  <g transform={`translate(${x * S} ${y * S})`} className="ld-medal">
                    <circle r={S * 0.95} fill="#ffb424" stroke="#1d3a6e" strokeWidth="4" />
                    <text dy="0.36em" textAnchor="middle" className="ld-medal-t">{ordinal(place)}</text>
                  </g>
                )}
              </g>
            )
          })}
          {/* where each movable token would land */}
          {canMove && legal.map((i) => {
            const p = myTokens[i]
            const [x, y] = rot(tokenSpot(colors[me], p < 0 ? 0 : Math.min(HOME, p + (state.dice ?? 0)), i), k)
            return <circle key={`d${i}`} className="ld-dest" cx={x * S} cy={y * S} r={S * 0.3} fill="none" stroke={LUDO_HEX[colors[me]]} strokeWidth="4" strokeDasharray="6 5" />
          })}
          {/* tokens: own colour on top so they're easy to tap */}
          {[...seats].sort((a, b) => (a === me ? 1 : 0) - (b === me ? 1 : 0)).map((pid) => (
            gone.includes(pid) ? null : tokens[pid].map((p, i) => {
              const sp = spots[`${pid}:${i}`]
              const c = colors[pid]
              const can = canMove && pid === me && legal.includes(i)
              return (
                <g key={`${pid}:${i}`} data-k={`${pid}:${i}`} className={`ld-tok ${can ? 'can' : ''} ${p === HOME ? 'done' : ''}`}
                  transform={`translate(${sp.x * S} ${sp.y * S}) scale(${sp.s * (p === HOME ? 0.6 : 1)})`} onClick={() => pid === me && move(i)}>
                  <g className="ld-tok-in">
                    <ellipse className="ld-shadow" cy={S * 0.3} rx={S * 0.32} ry={S * 0.11} fill="#1d3a6e" opacity="0.3" />
                    <g className="ld-lift"><g className="ld-pawn">
                      {can && <circle className="ld-halo" r={S * 0.52} fill="none" stroke="#fff" strokeWidth="4" />}
                      <path d={`M${-S * 0.27} ${S * 0.26} Q${-S * 0.22} ${-S * 0.02} ${-S * 0.08} ${-S * 0.06} L${S * 0.08} ${-S * 0.06} Q${S * 0.22} ${-S * 0.02} ${S * 0.27} ${S * 0.26} Z`}
                        fill={LUDO_HEX[c]} stroke="#1d3a6e" strokeWidth="2.6" strokeLinejoin="round" />
                      <circle cy={-S * 0.2} r={S * 0.17} fill={LUDO_HEX[c]} stroke="#1d3a6e" strokeWidth="2.6" />
                      <circle cx={-S * 0.06} cy={-S * 0.25} r={S * 0.05} fill="#fff" opacity="0.85" />
                    </g></g>
                    <circle r={S * 0.62} fill="transparent" />
                  </g>
                </g>
              )
            })
          ))}
          <circle className="ld-boom" r="0" fill="none" stroke="#fff" strokeWidth="7" opacity="0" />
        </svg>
      </div>

      <div className="ld-dock">
        <button className={`ld-die ${canRoll ? 'live' : ''} ${rolling ? 'rolling' : ''}`} onClick={roll} disabled={!canRoll}
          data-cursor={canRoll ? 'Roll!' : undefined} aria-label="Roll the die">
          <span className="ld-die-body"><DieFace n={face} /></span>
          {canRoll && !rolling && <span className="ld-die-tag display">Roll</span>}
        </button>
        <div className="ld-dock-info">
          <p className="ld-hint">{hint}</p>
          <TimerBar left={state.timeLeft} total={state.timeTotal ?? 15} k={`${state.seq}`} running={state.timeLeft != null && state.timeLeft > 1} />
        </div>
      </div>

      <div className="ld-legend">
        {seats.map((pid) => {
          const c = colors[pid]
          const p = room.players.find((x) => x.id === pid)
          const home = (tokens[pid] ?? []).filter((x) => x === HOME).length
          const place = places[pid]
          const quit = gone.includes(pid)
          return (
            <span key={pid} className={`ld-seat ${state.turn === pid && !state.over ? 'turn' : ''} ${quit ? 'quit' : ''} ${pid === me ? 'me' : ''}`} style={{ ['--sc' as string]: LUDO_HEX[c] }}>
              <i><Avatar config={p?.avatar} size={30} track="none" expression={place ? 'happy' : state.turn === pid ? 'focus' : 'idle'} /></i>
              <b className="display">{name(pid)}</b>
              <em>{quit ? 'left' : place ? `${ordinal(place)} ✓` : `${home}/${state.goal} home`}</em>
            </span>
          )
        })}
      </div>

      {callout && (
        <div key={callout.key} className="ld-callout" style={{ ['--co' as string]: callout.color }}>
          <b className="display">{callout.text}</b>
          {callout.sub && <span>{callout.sub}</span>}
        </div>
      )}
      <span className="ld-sr" aria-live="polite">{LUDO_NAME[turnColor]} to play</span>
    </div>
  )
}
