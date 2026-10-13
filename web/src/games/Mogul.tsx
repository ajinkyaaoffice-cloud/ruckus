import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex, type Room } from '../lib/net'
import { sfx } from '../lib/sound'
import { confetti, intro } from '../lib/ui'
import { lowPower } from '../lib/perf'
import Avatar from '../components/Avatar'
import { TimerBar } from './shared'
import {
  B, C, GROUPS, GROUP_HEX, GROUP_NAME, JAIL, SPACES, STATIONS, UTILS, colorOf, liftCost, mortgageValue, ownable, priceOf, tileRect, tileSpot,
  type Group, type Space,
} from './mogulBoard'
import './Mogul.css'

const S = 50                                   // svg units per board unit
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

type St = {
  seats: string[]; turn: string; phase: 'roll' | 'wait' | 'buy' | 'auction' | 'end' | 'debt' | 'over'
  cash: Record<string, number>; pos: Record<string, number>; jail: Record<string, number>; jailCards: Record<string, number>
  owner: Record<string, string>; houses: Record<string, number>; mortgaged: number[]
  housesLeft: number; hotelsLeft: number; dice: [number, number] | null; doubles: number
  last: { id: number; pid: string; from: number; to: number; steps: number; kind: 'walk' | 'card' | 'back' | 'jail' } | null
  card: { id: number; pid: string; deck: 'chance' | 'chest'; text: string } | null
  offer: number | null
  auction: { space: number; bid: number; bidder: string | null; bids: number } | null
  debt: { pid: string; to: string | null; amount: number; why: string } | null
  trade: { id: number; from: string; to: string; give: Side; get: Side } | null
  manager: string | null; broke: string[]; left: string[]; worth: Record<string, number>; raisable: number
  endsIn: number | null; timeLeft: number | null; timeTotal: number; seq: number; over: boolean
}
type Side = { cash: number; spaces: number[]; cards: number }

/* ---------- rule tips: like UNO's card rules, each one pops up whenever it comes into play ---------- */

const TIPS: Record<string, { name: string; text: string; tile?: number }> = {
  buy: { name: 'Buy or auction', text: 'Buy it at the printed price, or pass and everyone bids for it — the top bid wins, even under price.' },
  auction: { name: 'Auction', text: 'Anyone can bid, you included. Each bid tops the last; the clock gives a few seconds after every bid.' },
  set: { name: 'Full set!', text: 'Owning a whole colour set doubles its base rent, and lets you build houses on it.' },
  build: { name: 'Build evenly', text: 'Every street in a set must be within one house of the others. Four houses, then a hotel.' },
  jail: { name: 'Jail', text: 'Pay $50, play a Get Out of Jail Free card, or roll for doubles. Miss three times and you pay $50 and move.' },
  doubles: { name: 'Doubles', text: 'Roll again! Three doubles in a row sends you straight to jail.' },
  debt: { name: 'Short on cash', text: 'Sell buildings for half what they cost, mortgage property for half its price, or trade. Still short? Bankrupt.' },
  mortgage: { name: 'Mortgaged', text: 'A mortgaged property charges no rent. Lifting the mortgage costs what you got plus 10%.' },
  station: { name: 'Stations', text: 'Rent is $25, $50, $100 or $200 for owning 1, 2, 3 or all 4 lines.' },
  util: { name: 'Utilities', text: 'Rent is 4× the dice if the owner has one, 10× if they own both.' },
  tax: { name: 'Tax', text: 'Paid to the bank. Free Parking is just a rest stop — nothing collects there.' },
  trade: { name: 'Trading', text: 'Swap property, cash and jail cards. Sets with buildings can’t be traded; mortgaged ones cost the taker 10%.' },
  go: { name: 'GO', text: 'Every time you pass or land on GO the bank pays you $200.' },
  rent: { name: 'Rent', text: 'Landing on someone’s property pays them rent. A full colour set doubles it; houses and hotels raise it a lot.' },
  own: { name: 'Your property', text: 'No rent on your own streets. Own the whole colour set to start building.' },
  chance: { name: 'Chance', text: 'Draw the top card and do what it says: move, pay, collect or go to jail. A jail card can be kept.' },
  chest: { name: 'Chest', text: 'Draw the top card: mostly money in or out, sometimes a move. A jail card can be kept or traded.' },
  parking: { name: 'Free Parking', text: 'A rest stop. Nothing to pay and nothing to collect.' },
  visit: { name: 'Just visiting', text: 'Landing on Jail by dice is only a visit. You’re free to carry on next turn.' },
  gotojail: { name: 'Go to jail', text: 'Straight to jail without passing GO or collecting $200. Your turn ends.' },
}

/* ---------- board ---------- */

function TileArt({ i }: { i: number }) {
  const s = SPACES[i]
  const r = tileRect(i)
  const w = (r.corner ? C : 1) * S, h = C * S
  const band = 0.32 * S
  const label = (t: string, y: number, size = 9.5, fill = '#1d3a6e') => (
    <text x={w / 2} y={y} textAnchor="middle" className="mg-tname" fontSize={size} fill={fill}>{t}</text>
  )
  // corners keep their own upright frame; edge tiles are drawn band-up and turned to face the middle
  if (r.corner) {
    return (
      <g transform={`translate(${r.x * S} ${r.y * S})`}>
        <rect width={w} height={h} fill={s.kind === 'go' ? '#d9f66b' : s.kind === 'jail' ? '#ffd9a8' : s.kind === 'parking' ? '#a7ecff' : '#ffc6e9'} stroke="#1d3a6e" strokeWidth="2" />
        {s.kind === 'go' && (
          <g transform={`translate(${w / 2} ${h / 2}) rotate(-45)`}>
            <text textAnchor="middle" dy="0.35em" className="mg-corner" fontSize="34" fill="#e64fe0">GO</text>
            <path d="M-26 22 H18 M8 13 L19 22 L8 31" stroke="#1d3a6e" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {s.kind === 'jail' && (
          <g>
            <rect x={w * 0.36} y={h * 0.08} width={w * 0.56} height={h * 0.56} rx="6" fill="#ff8a1f" stroke="#1d3a6e" strokeWidth="2.5" />
            {[0, 1, 2, 3].map((k) => <line key={k} x1={w * (0.45 + k * 0.125)} x2={w * (0.45 + k * 0.125)} y1={h * 0.1} y2={h * 0.62} stroke="#1d3a6e" strokeWidth="3" />)}
            <text x={w * 0.64} y={h * 0.86} textAnchor="middle" className="mg-corner" fontSize="15" fill="#1d3a6e">JAIL</text>
            <text x={w * 0.17} y={h * 0.5} textAnchor="middle" className="mg-tname mg-vis" fontSize="9" fill="#1d3a6e" transform={`rotate(-90 ${w * 0.17} ${h * 0.5})`}>JUST VISITING</text>
          </g>
        )}
        {s.kind === 'parking' && (
          <g transform={`translate(${w / 2} ${h / 2}) rotate(45)`}>
            <circle r={22} fill="#fff" stroke="#1d3a6e" strokeWidth="3" />
            <text textAnchor="middle" dy="0.36em" className="mg-corner" fontSize="28" fill="#3d8bff">P</text>
            <text y={36} textAnchor="middle" className="mg-tname" fontSize="10" fill="#1d3a6e">FREE PARKING</text>
          </g>
        )}
        {s.kind === 'gotojail' && (
          <g transform={`translate(${w / 2} ${h / 2}) rotate(-135)`}>
            <path d="M-20 0 H14 M4 -10 L15 0 L4 10" stroke="#ff5d73" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text y={-20} textAnchor="middle" className="mg-corner" fontSize="13" fill="#1d3a6e" transform="rotate(180)">GO TO JAIL</text>
          </g>
        )}
      </g>
    )
  }
  const turn = [`translate(${r.x * S} ${r.y * S})`, `translate(${(r.x + C) * S} ${r.y * S}) rotate(90)`,
    `translate(${(r.x + 1) * S} ${(r.y + C) * S}) rotate(180)`, `translate(${r.x * S} ${(r.y + 1) * S}) rotate(-90)`][r.side]
  return (
    <g transform={turn}>
      <rect width={w} height={h} fill="#fff8ec" stroke="#1d3a6e" strokeWidth="2" />
      {s.kind === 'street' && <rect width={w} height={band} fill={GROUP_HEX[s.group]} stroke="#1d3a6e" strokeWidth="2" />}
      {s.kind === 'street' && label(s.name.split(' ')[0].toUpperCase(), band + 13, 8.5)}
      {/* icons stay upright whichever side they're on */}
      <g transform={`rotate(${-[0, 90, 180, -90][r.side]} ${w / 2} ${h * 0.45})`}>
      {s.kind === 'station' && (
        <g transform={`translate(${w / 2} ${h * 0.46})`}>
          <rect x={-13} y={-11} width={26} height={19} rx={5} fill="#1d3a6e" />
          <rect x={-9} y={-7} width={8} height={6} rx={1.5} fill="#a7ecff" /><rect x={1} y={-7} width={8} height={6} rx={1.5} fill="#a7ecff" />
          <circle cx={-7} cy={11} r={3.6} fill="#1d3a6e" /><circle cx={7} cy={11} r={3.6} fill="#1d3a6e" />
        </g>
      )}
      {s.kind === 'util' && (i === 12
        ? <path transform={`translate(${w / 2} ${h * 0.44})`} d="M3 -16 L-9 3 H0 L-3 16 L10 -3 H1 Z" fill="#ffc93c" stroke="#1d3a6e" strokeWidth="2.5" strokeLinejoin="round" />
        : <path transform={`translate(${w / 2} ${h * 0.44})`} d="M0 -15 C6 -6 11 0 11 6 A11 11 0 0 1 -11 6 C-11 0 -6 -6 0 -15 Z" fill="#45b8ff" stroke="#1d3a6e" strokeWidth="2.5" />)}
      {s.kind === 'chance' && <text x={w / 2} y={h * 0.45} textAnchor="middle" dy="0.36em" className="mg-corner" fontSize="34" fill="#e64fe0">?</text>}
      {s.kind === 'chest' && (
        <g transform={`translate(${w / 2} ${h * 0.45})`}>
          <rect x={-14} y={-8} width={28} height={20} rx={4} fill="#ffb424" stroke="#1d3a6e" strokeWidth="2.5" />
          <path d="M-14 -2 Q0 -16 14 -2" fill="#ffc93c" stroke="#1d3a6e" strokeWidth="2.5" />
          <rect x={-3} y={-3} width={6} height={7} rx={1.5} fill="#1d3a6e" />
        </g>
      )}
      {s.kind === 'tax' && (
        <g transform={`translate(${w / 2} ${h * 0.42})`}>
          <circle r={14} fill="#d9f66b" stroke="#1d3a6e" strokeWidth="2.5" />
          <text textAnchor="middle" dy="0.36em" className="mg-corner" fontSize="17" fill="#1d3a6e">$</text>
        </g>
      )}
      </g>
      {'price' in s && label(money(s.price), h - 7, 9, '#1d3a6e')}
      {s.kind === 'tax' && label(money(s.amount), h - 7, 9, '#1d3a6e')}
    </g>
  )
}

const BoardArt = memo(function BoardArt() {
  return (
    <g className="mg-boardart">
      <rect x={-8} y={-8} width={B * S + 16} height={B * S + 16} rx={26} fill="#1d3a6e" />
      <rect x={0} y={0} width={B * S} height={B * S} rx={6} fill="#ffe7f6" />
      {SPACES.map((_, i) => <g key={i} className="mg-tile" data-i={i}><TileArt i={i} /></g>)}
    </g>
  )
})

/** Owner tints, houses and mortgages, drawn over the static art. */
function Overlay({ owner, houses, mortgaged, room, hot }: { owner: Record<string, string>; houses: Record<string, number>; mortgaged: number[]; room: Room; hot: number | null }) {
  return (
    <g className="mg-overlay">
      {SPACES.map((s, i) => {
        if (!ownable(i)) return null
        const r = tileRect(i)
        const own = owner[i]
        const h = houses[i] ?? 0
        const m = mortgaged.includes(i)
        // the outer strip of the tile shows who owns it
        const strip = 0.22
        const g = 0.1                       // clear of the board's frame
        const so = [
          { x: r.x + 0.06, y: r.y + r.h - strip - g, w: r.w - 0.12, h: strip }, { x: r.x + g, y: r.y + 0.06, w: strip, h: r.h - 0.12 },
          { x: r.x + 0.06, y: r.y + g, w: r.w - 0.12, h: strip }, { x: r.x + r.w - strip - g, y: r.y + 0.06, w: strip, h: r.h - 0.12 },
        ][r.side]
        const bandAt = (k: number, n: number) => {
          // positions of n buildings along the colour band (which faces the middle)
          const t = (k + 0.5) / n
          if (r.side === 0) return [r.x + r.w * t, r.y + 0.16]
          if (r.side === 1) return [r.x + r.w - 0.16, r.y + r.h * (1 - t)]
          if (r.side === 2) return [r.x + r.w * (1 - t), r.y + r.h - 0.16]
          return [r.x + 0.16, r.y + r.h * t]
        }
        return (
          <g key={i} className={`mg-own ${hot === i ? 'hot' : ''}`}>
            {hot === i && <rect className="mg-hot" x={r.x * S} y={r.y * S} width={r.w * S} height={r.h * S} fill="none" stroke="#fff" strokeWidth="5" />}
            {own && <rect className="mg-tint" x={r.x * S} y={r.y * S} width={r.w * S} height={r.h * S} fill={playerHex(room, own)} opacity="0.3" />}
            {own && <rect key={own} className="mg-strip" rx="3" x={so.x * S} y={so.y * S} width={so.w * S} height={so.h * S} fill={playerHex(room, own)} stroke="#1d3a6e" strokeWidth="1.5" />}
            {m && (
              <g className="mg-mort">
                <rect x={r.x * S + 2} y={r.y * S + 2} width={r.w * S - 4} height={r.h * S - 4} fill="url(#mg-hatch)" />
                <circle cx={(r.x + r.w / 2) * S} cy={(r.y + r.h / 2) * S} r={11} fill="#1d3a6e" />
                <text x={(r.x + r.w / 2) * S} y={(r.y + r.h / 2) * S} dy="0.36em" textAnchor="middle" className="mg-corner" fontSize="12" fill="#fff">M</text>
              </g>
            )}
            {s.kind === 'street' && h > 0 && h < 5 && Array.from({ length: h }, (_, k) => {
              const [x, y] = bandAt(k, 4)
              return <rect key={`${k}`} className="mg-house" x={x * S - 5} y={y * S - 5} width={10} height={10} rx={2} fill="#43d17a" stroke="#1d3a6e" strokeWidth="2" />
            })}
            {s.kind === 'street' && h === 5 && (() => {
              const [x, y] = bandAt(0, 1)
              const along = r.side % 2 === 0
              return <rect key="hotel" className="mg-house" x={x * S - (along ? 14 : 6)} y={y * S - (along ? 6 : 14)} width={along ? 28 : 12} height={along ? 12 : 28} rx={3} fill="#ff5d73" stroke="#1d3a6e" strokeWidth="2" />
            })()}
          </g>
        )
      })}
    </g>
  )
}

/* ---------- dice ---------- */

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}
function Die({ n, cls = '' }: { n: number; cls?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" className={`mg-die ${cls}`} aria-hidden>
      <rect x={-44} y={-44} width={88} height={88} rx={22} fill="#fff" stroke="#1d3a6e" strokeWidth="6" />
      {(PIPS[n] ?? []).map(([x, y], i) => <circle key={i} cx={x * 21} cy={y * 21} r={9} fill={n === 1 ? '#e64fe0' : '#1d3a6e'} />)}
    </svg>
  )
}

/* ---------- deed ---------- */

function Deed({ i, compact }: { i: number; compact?: boolean }) {
  const s = SPACES[i]
  return (
    <div className={`mg-deed ${compact ? 'compact' : ''} k-${s.kind} ${s.kind === 'street' && (s.group === 'brown' || s.group === 'navy') ? 'dark' : ''}`} style={{ ['--dc' as string]: colorOf(i) }}>
      <div className="mg-deed-top">
        <small>{s.kind === 'street' ? GROUP_NAME[s.group] : s.kind === 'station' ? 'Station' : 'Utility'}</small>
        <b className="display">{s.name}</b>
      </div>
      {!compact && <DeedRows s={s} i={i} />}
      {compact && 'price' in s && <span className="mg-deed-price display">{money(s.price)}</span>}
    </div>
  )
}

function DeedRows({ s, i }: { s: Space; i: number }) {
  const row = (a: ReactNode, b: ReactNode, k?: string) => <li key={k}><span>{a}</span><b>{b}</b></li>
  return (
    <ul className="mg-deed-rows">
      {s.kind === 'street' && <>
        {row('Rent', money(s.rent[0]))}
        {row('Whole set', money(s.rent[0] * 2))}
        {[1, 2, 3, 4].map((h) => row(<><i className="hs">{'⌂'.repeat(h)}</i><em> {h} house{h > 1 ? 's' : ''}</em></>, money(s.rent[h]), `h${h}`))}
        {row(<em className="mg-hotel-t">Hotel</em>, money(s.rent[5]))}
        {row('Each house', money(s.house), 'hc')}
      </>}
      {s.kind === 'station' && [1, 2, 3, 4].map((n) => row(`${n} line${n > 1 ? 's' : ''} owned`, money(25 * 2 ** (n - 1)), `s${n}`))}
      {s.kind === 'util' && <>{row('One utility', '4× dice')}{row('Both utilities', '10× dice')}</>}
      {row('Mortgage', money(mortgageValue(i)), 'm')}
    </ul>
  )
}

/* ---------- game ---------- */

type Callout = { text: string; sub?: string; color: string; key: number }
type Float = { pid: string; d: number; key: number }
type Tip = { k: string; key: number; tile?: number; title?: string }

export default function Mogul({ state: raw, me, room, players, spectator }: GameProps) {
  const state = raw as unknown as St
  const root = useRef<HTMLDivElement>(null)
  const { seats, cash, pos, owner, houses, mortgaged, phase, broke } = state
  const out = broke.includes(me) || spectator || !seats.includes(me)
  const myTurn = state.turn === me && !out && !state.over
  const canManage = state.manager === me && !state.trade && !out
  const others = seats.filter((p) => p !== me && !broke.includes(p))
  const name = (pid: string | null | undefined) => (!pid ? 'the bank' : pid === me ? 'You' : players.find((p) => p.id === pid)?.name ?? room.players.find((p) => p.id === pid)?.name ?? '…')
  const avatarOf = (pid: string) => room.players.find((p) => p.id === pid)?.avatar
  const hex = (pid: string) => playerHex(room, pid)

  const [deed, setDeed] = useState<number | null>(null)
  const [trading, setTrading] = useState<string | null>(null)        // composing a trade with this player
  const [rolling, setRolling] = useState(false)
  const [faces, setFaces] = useState<[number, number]>(state.dice ?? [5, 2])
  const [cardShow, setCardShow] = useState<St['card']>(null)
  const [log, setLog] = useState<{ t: string; key: number }[]>([])
  const [floats, setFloats] = useState<Float[]>([])
  const [callout, setCallout] = useState<Callout | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const [confirmBroke, setConfirmBroke] = useState(false)
  const calloutTimer = useRef<number | undefined>(undefined)
  const tipTimer = useRef<number | undefined>(undefined)
  const shout = (text: string, color: string, sub?: string, hold = 1500) => {
    setCallout({ text, color, sub, key: Date.now() + Math.random() })
    clearTimeout(calloutTimer.current)
    calloutTimer.current = window.setTimeout(() => setCallout(null), hold)
  }
  const showTip = (k: string, tile?: number, title?: string) => {
    if (!TIPS[k]) return
    setTip({ k, tile, title, key: Date.now() + Math.random() })
    clearTimeout(tipTimer.current)
    tipTimer.current = window.setTimeout(() => setTip(null), 5200)
  }
  const note = (t: string) => setLog((l) => [{ t, key: Date.now() + Math.random() }, ...l].slice(0, 3))
  const sp = (i: number) => SPACES[i]?.name ?? ''

  /* where each token stands; tokens sharing a tile fan out */
  const spots = useMemo(() => {
    const at = new Map<string, { pid: string; base: [number, number] }[]>()
    for (const pid of seats) {
      if (broke.includes(pid)) continue
      const t = pos[pid]
      // in jail proper sits behind the bars; just visiting stands on the edge of the corner
      const base: [number, number] = t === JAIL ? (state.jail[pid] != null ? [0.64 * C, B - C + 0.36 * C] : [0.2 * C, B - C + 0.55 * C]) : tileSpot(t)
      const key = base.join()
      at.set(key, [...(at.get(key) ?? []), { pid, base }])
    }
    const outp: Record<string, { x: number; y: number; s: number }> = {}
    for (const group of at.values()) {
      group.forEach(({ pid, base }, n) => {
        if (group.length < 2) { outp[pid] = { x: base[0], y: base[1], s: 1 }; return }
        const a = (n / group.length) * Math.PI * 2 - Math.PI / 2
        outp[pid] = { x: base[0] + Math.cos(a) * 0.22, y: base[1] + Math.sin(a) * 0.22, s: 0.74 }
      })
    }
    return outp
  }, [JSON.stringify(pos), JSON.stringify(state.jail), broke.length, seats]) // eslint-disable-line react-hooks/exhaustive-deps

  // board drops in, tiles ripple round from GO
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.mg-board', ...intro({ y: 140, rotate: -4, scale: 0.92, duration: 0.9, ease: 'back.out(1.4)', delay: 0.5 }))
      if (!lowPower) gsap.fromTo('.mg-tile', { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.018, delay: 0.8, clearProps: 'opacity' })
      gsap.fromTo('.mg-tok-in', ...intro({ scale: 0, transformOrigin: '50% 80%', duration: 0.5, ease: 'back.out(3)', stagger: 0.08, delay: 1.3 }))
      gsap.fromTo('.mg-seat', ...intro({ y: -30, opacity: 0, duration: 0.5, ease: 'back.out(2)', stagger: 0.06, delay: 0.4 }))
    }, root)
    return () => ctx.revert()
  }, [])

  // hop the moved token tile by tile (or fly it to jail)
  const seenMove = useRef<number | null>(state.last?.id ?? null)
  useLayoutEffect(() => {
    const last = state.last
    if (!last || last.id === seenMove.current) return
    seenMove.current = last.id
    const el = root.current?.querySelector<SVGGElement>(`.mg-tok[data-p="${last.pid}"] .mg-tok-in`)
    const end = spots[last.pid]
    if (!el || !end) return
    const tiles: number[] = []
    if (last.kind === 'jail') tiles.push(last.from, JAIL)
    else {
      const dir = last.steps < 0 ? -1 : 1
      for (let k = 0; k <= Math.abs(last.steps); k++) tiles.push((((last.from + dir * k) % 40) + 40) % 40)
    }
    const pts = tiles.map((t) => tileSpot(t))
    pts[pts.length - 1] = [end.x, end.y]
    const off = ([x, y]: [number, number]) => ({ x: (x - end.x) * S, y: (y - end.y) * S })
    const lift = el.querySelector('.mg-lift')
    gsap.killTweensOf([el, lift])
    const tl = gsap.timeline({ onComplete: () => { gsap.set(el, { x: 0, y: 0 }); gsap.set(lift, { clearProps: 'all' }) } })
    gsap.set(el, off(pts[0]))
    if (last.kind === 'jail') {
      tl.to(el, { x: 0, y: 0, duration: 0.9, ease: 'power1.inOut' })
        .to(lift, { keyframes: [{ y: -S * 2.2, rotate: 180, duration: 0.45, ease: 'power2.out' }, { y: 0, rotate: 360, duration: 0.45, ease: 'bounce.out' }] }, 0)
        .set(lift, { rotate: 0 })
    } else {
      const n = pts.length - 1
      const per = Math.min(lowPower ? 0.17 : 0.19, 2.3 / Math.max(1, n))
      for (let k = 1; k <= n; k++) {
        tl.to(el, { ...off(pts[k]), duration: per, ease: 'none' })
          .to(lift, { y: -S * (n > 14 ? 0.35 : 0.55), scaleY: 1.08, scaleX: 0.94, duration: per / 2, ease: 'power2.out', yoyo: true, repeat: 1 }, '<')
          .call(() => sfx.step(k))
      }
      tl.fromTo(lift, { scaleY: 0.72, scaleX: 1.22 }, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'elastic.out(1, 0.4)' })
    }
    return () => { tl.progress(1).kill() }
  }, [state.last?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // money floats over the seat pills whenever cash changes
  const prevCash = useRef(cash)
  useEffect(() => {
    const prev = prevCash.current
    prevCash.current = cash
    const fresh: Float[] = []
    for (const pid of seats) {
      const d = (cash[pid] ?? 0) - (prev[pid] ?? 0)
      if (d) fresh.push({ pid, d, key: Date.now() + Math.random() })
    }
    if (!fresh.length) return
    setFloats((f) => [...f, ...fresh])
    const t = window.setTimeout(() => setFloats((f) => f.filter((x) => !fresh.includes(x))), 1600)
    return () => clearTimeout(t)
  }, [JSON.stringify(cash)]) // eslint-disable-line react-hooks/exhaustive-deps

  // events → dice tumble, the card flip, callouts, sounds, the little log and rule tips
  useEffect(() => onGameEvents((evs, st) => {
    const g = st as unknown as St
    for (const e of evs) {
      const who = name(e.pid)
      switch (e.kind) {
        case 'roll': {
          setRolling(true)
          sfx.dice()
          let n = 0
          const spin = window.setInterval(() => {
            setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)])
            if (++n >= 7) {
              window.clearInterval(spin)
              setFaces(e.dice)
              setRolling(false)
              const total = e.dice[0] + e.dice[1]
              const dbl = e.dice[0] === e.dice[1]
              note(`${who} rolled ${total}${dbl ? ' · doubles' : ''}`)
              if (e.jail) {
                if (e.free) shout('Doubles!', '#43d17a', `${who} ${e.pid === me ? 'break' : 'breaks'} out of jail`, 1300)
                else if (e.tries < 3) note(`${who} stay${e.pid === me ? '' : 's'} in jail (${e.tries}/3)`)
              } else if (dbl && e.doubles < 3) {
                shout('Doubles!', hex(e.pid), e.pid === me ? 'roll again after this' : `${who} rolls again`, 1100)
                if (e.pid === me) showTip('doubles')
              }
            }
          }, 65)
          break
        }
        case 'move': {
          // once the token settles, explain the space it landed on (for anyone, like UNO's card rules)
          if (e.how === 'jail') break
          const i = e.to as number, s = SPACES[i]
          const own = g.owner[i]
          const k = s.kind === 'chance' || s.kind === 'chest' || s.kind === 'parking' || s.kind === 'gotojail' || s.kind === 'tax' || s.kind === 'go' ? s.kind
            : s.kind === 'jail' ? 'visit'
            : !own ? 'buy'
            : own === e.pid ? 'own'
            : g.mortgaged.includes(i) ? 'mortgage'
            : s.kind === 'station' || s.kind === 'util' ? s.kind : 'rent'
          const delay = Math.min(0.45 + 0.17 * Math.abs(e.steps), 2.8) * 1000
          window.setTimeout(() => showTip(k, i, `${who} · ${s.name}`), delay)
          break
        }
        case 'speeding':
          window.setTimeout(() => { sfx.bad(); shout('Three doubles!', '#ff5d73', `${who} ${e.pid === me ? 'are' : 'is'} speeding — off to jail`, 1700) }, 500)
          break
        case 'salary':
          window.setTimeout(() => { sfx.point(); note(`${who} passed GO · +$200`); if (e.pid === me) { shout('+$200', '#43d17a', 'passed GO', 1000); showTip('go') } }, 700)
          break
        case 'buy':
          sfx.point()
          note(`${who} bought ${sp(e.space)}`)
          if (e.pid === me && fullSetOf(g, me, e.space)) { window.setTimeout(() => { sfx.uno(); shout('Full set!', GROUP_HEX[(SPACES[e.space] as { group: Group }).group], 'rent doubles · you can build', 1800); showTip('set', e.space) }, 300) }
          break
        case 'auction':
          sfx.slam()
          note(`${sp(e.space)} goes to auction`)
          shout('Auction!', '#ffb424', sp(e.space), 1100)
          showTip('auction', e.space, `Auction · ${sp(e.space)}`)
          break
        case 'bid':
          sfx.tap()
          note(`${who} bid ${money(e.amount)}`)
          break
        case 'won':
          sfx.uno()
          note(`${who} won ${sp(e.space)} for ${money(e.amount)}`)
          shout('Sold!', hex(e.pid), `${sp(e.space)} to ${who} · ${money(e.amount)}`, 1500)
          if (e.pid === me && fullSetOf(g, me, e.space)) window.setTimeout(() => showTip('set', e.space), 1600)
          break
        case 'unsold':
          note(`Nobody bid · ${sp(e.space)} stays with the bank`)
          break
        case 'rent':
          window.setTimeout(() => {
            sfx.hit(0.7)
            note(`${who} paid ${name(e.to)} ${money(e.amount)} rent`)
            if (e.pid === me || e.to === me) shout(money(e.amount), e.to === me ? '#43d17a' : '#ff5d73', e.to === me ? `rent from ${who}` : `rent to ${name(e.to)}`, 1200)
          }, 150)
          break
        case 'mortgaged':
          note(`${sp(e.space)} is mortgaged · no rent`)
          break
        case 'tax':
          sfx.hit(0.3)
          note(`${who} paid ${money(e.amount)} ${sp(e.space).toLowerCase()}`)
          break
        case 'card':
          sfx.card()
          setCardShow({ id: e.id, pid: e.pid, deck: e.deck, text: e.text })
          window.setTimeout(() => setCardShow((c) => (c?.id === e.id ? null : c)), 2900)
          break
        case 'collect':
          sfx.point()
          note(`${who} collected ${money(e.amount)}`)
          break
        case 'pay':
          if (e.why === 'card' || e.why === 'repairs' || e.why === 'bail') note(`${who} paid ${e.to ? `${name(e.to)} ` : ''}${money(e.amount)}`)
          break
        case 'jailed':
          sfx.bad()
          note(`${who} went to jail`)
          window.setTimeout(() => { sfx.slam(); shout('Jail!', '#ff8a1f', e.pid === me ? 'pay, use a card or roll doubles' : `${who} ${e.pid === me ? 'are' : 'is'} locked up`, 1500) }, 700)
          window.setTimeout(() => showTip('jail', JAIL, `${who} · Jail`), 1500)
          break
        case 'free':
          sfx.open()
          note(`${who} ${e.how === 'bail' ? 'paid bail' : e.how === 'card' ? 'used a Get Out of Jail Free card' : e.how === 'fine' ? 'paid $50 after three misses' : 'rolled out of jail'}`)
          break
        case 'again':
          if (e.pid === me) sfx.pop()
          break
        case 'turn':
          if (e.pid === me) { sfx.pop(); if (g.jail[me] != null) showTip('jail') }
          break
        case 'debt':
          sfx.bad()
          note(`${who} ${e.pid === me ? 'owe' : 'owes'} ${money(e.amount)}`)
          if (e.pid === me) { shout('Short!', '#ff5d73', `raise ${money(e.amount - (g.cash[me] ?? 0))} or go bankrupt`, 1800); showTip('debt') }
          break
        case 'build':
          sfx.place()
          note(`${who} built ${e.houses === 5 ? 'a hotel' : 'a house'} on ${sp(e.space)}`)
          if (e.houses === 5) shout('Hotel!', '#ff5d73', `${sp(e.space)} · ${who}`, 1300)
          showTip('build', e.space, `${who} · ${sp(e.space)}`)
          break
        case 'sell':
          if (!e.quiet) sfx.close()
          note(`${who} sold a building on ${sp(e.space)}`)
          break
        case 'mortgage':
          sfx.close()
          note(`${who} mortgaged ${sp(e.space)}`)
          if (e.pid === me) showTip('mortgage', e.space)
          break
        case 'unmortgage':
          sfx.open()
          note(`${who} lifted the mortgage on ${sp(e.space)}`)
          break
        case 'offer_trade':
          sfx.open()
          note(`${who} offered ${name(e.to)} a trade`)
          if (e.to === me) sfx.uno()
          showTip('trade')
          break
        case 'trade':
          if (e.ok) { sfx.uno(); note(`${who} and ${name(e.to)} traded`); shout('Deal!', '#43d17a', `${who} ⇄ ${name(e.to)}`, 1300) }
          else note(e.cancelled ? `${who} took the offer back` : `${name(e.to)} ${e.timeout ? 'let the offer lapse' : 'said no'}`)
          if (e.pid === me && e.ok) window.setTimeout(() => { for (const s of e.get.spaces) if (fullSetOf(g, me, s)) { showTip('set', s); break } }, 400)
          break
        case 'bankrupt':
          sfx.lose()
          note(`${who} went bankrupt`)
          window.setTimeout(() => shout('Bankrupt!', '#1d3a6e', e.to ? `${name(e.to)} ${e.to === me ? 'take' : 'takes'} it all` : 'property back to the bank', 2200), 300)
          break
        case 'timeup':
          sfx.slam()
          shout('Time’s up!', '#ffb424', 'richest mogul wins', 2200)
          break
        case 'left':
          note(`${who} left the table`)
          break
      }
    }
  }), [me, players, room]) // eslint-disable-line react-hooks/exhaustive-deps

  // a little confetti for whoever wins
  useEffect(() => {
    if (state.over && raw.results?.winners.includes(me) && !lowPower) {
      const r = root.current?.querySelector('.mg-board')?.getBoundingClientRect()
      if (r) confetti(r.left + r.width / 2, r.top + r.height / 2, 40)
    }
  }, [state.over]) // eslint-disable-line react-hooks/exhaustive-deps

  // the game clock for time-limited games
  const [clock, setClock] = useState<number | null>(state.endsIn)
  useEffect(() => {
    if (state.endsIn == null) return
    const end = Date.now() + state.endsIn * 1000
    setClock(state.endsIn)
    const t = window.setInterval(() => setClock(Math.max(0, Math.round((end - Date.now()) / 1000))), 1000)
    return () => clearInterval(t)
  }, [state.endsIn != null && Math.floor(state.endsIn / 5)]) // eslint-disable-line react-hooks/exhaustive-deps

  // space rolls or ends the turn
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, button') || deed != null || trading) return
      if ((e.key === ' ' || e.key === 'Enter') && myTurn) {
        if (phase === 'roll') { e.preventDefault(); act({ type: 'roll' }) }
        else if (phase === 'end') { e.preventDefault(); act({ type: 'end' }) }
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  useEffect(() => { if (phase !== 'debt') setConfirmBroke(false) }, [phase])
  useEffect(() => { if (!canManage) setTrading(null) }, [canManage])

  const mine = Object.keys(owner).map(Number).filter((i) => owner[i] === me).sort((a, b) => a - b)
  const hot = phase === 'buy' ? state.offer : phase === 'auction' ? state.auction?.space ?? null : null

  /* ---------- the middle of the board: whatever we're waiting on ---------- */
  const center = (() => {
    if (state.over) return <p className="mg-say display">Game over</p>
    if (cardShow) return <CardFlip key={cardShow.id} card={cardShow} who={name(cardShow.pid)} />
    const tr = state.trade
    if (tr) {
      return (
        <div className="mg-panel">
          <p className="mg-say display">{tr.from === me ? `Waiting for ${name(tr.to)}…` : tr.to === me ? `${name(tr.from)} wants to trade` : `${name(tr.from)} ⇄ ${name(tr.to)}`}</p>
          <small className="mg-sub">{tr.to === me ? 'Have a look at the offer' : 'trading…'}</small>
          {tr.from === me && <button className="bubble-btn small" onClick={() => { sfx.click(); act({ type: 'cancel' }) }}>Take it back</button>}
        </div>
      )
    }
    if (phase === 'roll') {
      const jailed = state.jail[state.turn] != null
      if (!myTurn) return <Dice faces={faces} rolling={rolling} say={`${name(state.turn)}${jailed ? ' is in jail' : '’s roll'}`} />
      if (jailed) {
        return (
          <div className="mg-panel">
            <Dice faces={faces} rolling={rolling} say={`In jail · try ${state.jail[me] + 1}/3`} />
            <div className="mg-btns">
              <button className="bubble-btn small magenta" onClick={() => { sfx.click(); act({ type: 'roll' }) }}>Roll doubles</button>
              <button className="bubble-btn small" disabled={cash[me] < 50} onClick={() => { sfx.click(); act({ type: 'bail' }) }}>Pay $50</button>
              {state.jailCards[me] > 0 && <button className="bubble-btn small lime" onClick={() => { sfx.click(); act({ type: 'card' }) }}>Use card</button>}
            </div>
          </div>
        )
      }
      return (
        <button className="mg-roll" onClick={() => { if (!rolling) act({ type: 'roll' }) }} disabled={rolling} data-cursor="Roll!" aria-label="Roll the dice">
          <Dice faces={faces} rolling={rolling} live say={state.doubles ? 'Doubles · roll again!' : 'Your roll!'} />
          {!rolling && <span className="mg-roll-tag display">Roll</span>}
        </button>
      )
    }
    if (phase === 'buy' && state.offer != null) {
      const price = priceOf(state.offer)
      return (
        <div className="mg-panel">
          <Deed i={state.offer} compact />
          {myTurn ? (
            <div className="mg-btns">
              <button className="bubble-btn small magenta" disabled={cash[me] < price} onClick={() => { sfx.click(); act({ type: 'buy' }) }}>Buy {money(price)}</button>
              <button className="bubble-btn small" onClick={() => { sfx.click(); act({ type: 'pass' }) }}>Auction</button>
            </div>
          ) : <small className="mg-sub">{name(state.turn)} is deciding…</small>}
          {myTurn && cash[me] < price && <small className="mg-sub warn">Not enough cash — mortgage something or auction it</small>}
          <button className="mg-more" onClick={() => setDeed(state.offer)}>rents</button>
        </div>
      )
    }
    if (phase === 'auction' && state.auction) {
      const a = state.auction
      const top = a.bidder === me
      return (
        <div className="mg-panel">
          <Deed i={a.space} compact />
          <p className="mg-bid display">{a.bidder ? <>{money(a.bid)} <small>{name(a.bidder)}</small></> : <small>No bids yet</small>}</p>
          {!out && (
            <div className="mg-btns">
              {[10, 50, 100].map((inc) => (
                <button key={inc} className={`bubble-btn small ${inc === 10 ? 'magenta' : ''}`} disabled={top || a.bid + inc > cash[me]}
                  onClick={() => { sfx.click(); act({ type: 'bid', amount: a.bid + inc }) }}>+{inc}</button>
              ))}
            </div>
          )}
          {top && <small className="mg-sub">You’re the top bid</small>}
        </div>
      )
    }
    if (phase === 'end') {
      if (!myTurn) return <Dice faces={faces} rolling={rolling} say={`${name(state.turn)}’s turn`} />
      return (
        <div className="mg-panel">
          <Dice faces={faces} rolling={rolling} />
          <button className="bubble-btn magenta mg-end" onClick={() => { sfx.click(); act({ type: 'end' }) }}>End turn</button>
          <small className="mg-sub">or build, mortgage and trade first</small>
        </div>
      )
    }
    if (phase === 'debt' && state.debt) {
      const d = state.debt
      if (d.pid !== me) return <div className="mg-panel"><p className="mg-say display">{name(d.pid)} owes {money(d.amount)}</p><small className="mg-sub">raising the money…</small></div>
      const short = d.amount - cash[me]
      return (
        <div className="mg-panel debt">
          <p className="mg-say display">You owe {money(d.amount)}</p>
          <small className="mg-sub">{d.to ? `to ${name(d.to)}` : 'to the bank'} · {short > 0 ? `${money(short)} short` : 'you can pay'}</small>
          <div className="mg-btns">
            <button className="bubble-btn small magenta" disabled={short > 0} onClick={() => { sfx.click(); act({ type: 'pay' }) }}>Pay</button>
            {!confirmBroke
              ? <button className="bubble-btn small" onClick={() => { sfx.click(); setConfirmBroke(true) }}>Bankrupt</button>
              : <button className="bubble-btn small mg-danger" onClick={() => act({ type: 'bankrupt' })}>Sure? Fold</button>}
          </div>
          {short > 0 && <small className="mg-sub">{state.raisable >= d.amount ? 'Tap your property below to sell or mortgage' : 'Even selling everything won’t cover it'}</small>}
        </div>
      )
    }
    return <Dice faces={faces} rolling={rolling} say={phase === 'wait' ? (state.jail[state.turn] != null && state.last?.kind !== 'jail' ? 'In jail…' : ' ') : ' '} />
  })()

  return (
    <div ref={root} className={`mg ${myTurn ? 'my-turn' : ''}`} style={{ ['--tc' as string]: hex(state.turn) }}>
      {/* everyone's money, up top */}
      <div className="mg-seats">
        {seats.map((pid) => {
          const p = room.players.find((x) => x.id === pid)
          const gone = broke.includes(pid)
          return (
            <button key={pid} className={`mg-seat ${state.turn === pid && !state.over ? 'turn' : ''} ${gone ? 'gone' : ''} ${pid === me ? 'me' : ''}`}
              style={{ ['--sc' as string]: hex(pid) }} disabled={!canManage || pid === me || gone}
              onClick={() => { sfx.click(); setTrading(pid) }} aria-label={pid === me || gone ? name(pid) : `Trade with ${name(pid)}`}>
              <i><Avatar config={p?.avatar} size="100%" track="none" expression={gone ? 'sad' : state.turn === pid ? 'focus' : 'idle'} /></i>
              <span className="mg-seat-t">
                <b className="display">{name(pid)}</b>
                <em>{gone ? (state.left.includes(pid) ? 'left' : 'bankrupt') : money(cash[pid])}</em>
              </span>
              {state.jail[pid] != null && <span className="mg-badge jail" title="In jail">▥</span>}
              {state.jailCards[pid] > 0 && <span className="mg-badge card" title="Get Out of Jail Free">{state.jailCards[pid]}</span>}
              {floats.filter((f) => f.pid === pid).map((f) => (
                <span key={f.key} className={`mg-float ${f.d > 0 ? 'up' : 'down'}`}>{f.d > 0 ? '+' : '−'}{money(Math.abs(f.d))}</span>
              ))}
            </button>
          )
        })}
      </div>

      <div className="mg-wrap">
        <svg viewBox={`-10 -10 ${B * S + 20} ${B * S + 20}`} className="mg-board">
          <defs>
            <pattern id="mg-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="rgba(29,58,110,0.18)" /><line x1="0" x2="0" y2="8" stroke="rgba(29,58,110,0.45)" strokeWidth="3" />
            </pattern>
          </defs>
          <BoardArt />
          <Overlay owner={owner} houses={houses} mortgaged={mortgaged} room={room} hot={hot} />
          {/* tap targets for every tile */}
          {SPACES.map((_, i) => {
            const r = tileRect(i)
            return <rect key={i} className="mg-hit" x={r.x * S} y={r.y * S} width={r.w * S} height={r.h * S} fill="transparent"
              onClick={() => { if (ownable(i)) { sfx.click(); setDeed(i) } else showTip(({ jail: 'jail', gotojail: 'gotojail', tax: 'tax', parking: 'parking', go: 'go', chance: 'chance', chest: 'chest' } as Record<string, string>)[SPACES[i].kind] ?? '', i) }} />
          })}
          {/* tokens: whoever's turn it is on top */}
          {[...seats].filter((p) => !broke.includes(p) && spots[p]).sort((a, b) => (a === state.turn ? 1 : 0) - (b === state.turn ? 1 : 0)).map((pid) => {
            const s = spots[pid]
            const r = S * 0.34
            return (
              <g key={pid} data-p={pid} className={`mg-tok ${state.turn === pid ? 'turn' : ''}`} transform={`translate(${s.x * S} ${s.y * S}) scale(${s.s})`}>
                <g className="mg-tok-in">
                  <ellipse cy={r * 0.95} rx={r * 0.85} ry={r * 0.28} fill="#1d3a6e" opacity="0.3" />
                  <g className="mg-lift">
                    {state.turn === pid && !state.over && <circle className="mg-halo" r={r + 6} fill="none" stroke="#fff" strokeWidth="4" />}
                    <circle r={r} fill={hex(pid)} stroke="#1d3a6e" strokeWidth="3.5" />
                    <g transform={`translate(${-r * 0.92} ${-r * 0.98})`}>
                      <Avatar config={avatarOf(pid)} size={r * 1.84} track="none" expression={state.turn === pid ? 'focus' : 'idle'} />
                    </g>
                  </g>
                </g>
              </g>
            )
          })}
        </svg>

        <div className="mg-center">
          <span className="mg-logo display" aria-hidden>MOGUL</span>
          {clock != null && <span className={`mg-clock ${clock < 120 ? 'low' : ''}`}>{Math.floor(clock / 60)}:{String(clock % 60).padStart(2, '0')} left</span>}
          <div className="mg-stage">{center}</div>
          <TimerBar left={state.timeLeft} total={state.timeTotal ?? 20} k={`${state.seq}`} running={!cardShow && state.timeLeft != null && state.timeLeft > 1} />
          <ul className="mg-log" aria-live="polite">
            {log.map((l, i) => <li key={l.key} style={{ opacity: 1 - i * 0.3 }}>{l.t}</li>)}
          </ul>
        </div>
      </div>

      {/* what I own */}
      {!out && (
        <div className="mg-mine">
          <div className="mg-mine-head">
            <span className="mg-wallet display">{money(cash[me] ?? 0)}</span>
            <small>worth {money(state.worth[me] ?? 0)} · bank: {state.housesLeft} houses, {state.hotelsLeft} hotels</small>
            {canManage && others.length > 0 && (
              <button className="bubble-btn small lime mg-trade-btn" onClick={() => { sfx.click(); setTrading(others[0]) }}>Trade</button>
            )}
          </div>
          {mine.length ? (
            <div className="mg-chips">
              {mine.map((i) => {
                const h = houses[i] ?? 0
                return (
                  <button key={i} className={`mg-chip ${mortgaged.includes(i) ? 'mort' : ''}`} style={{ ['--dc' as string]: colorOf(i) }} onClick={() => { sfx.click(); setDeed(i) }}>
                    <b>{SPACES[i].name}</b>
                    <em>{mortgaged.includes(i) ? 'mortgaged' : h === 5 ? 'hotel' : h ? `${h} house${h > 1 ? 's' : ''}` : money(priceOf(i))}</em>
                  </button>
                )
              })}
            </div>
          ) : <p className="mg-empty">No property yet — land on a street to buy it.</p>}
        </div>
      )}

      {deed != null && <DeedSheet i={deed} state={state} me={me} room={room} canManage={canManage} name={name} onClose={() => setDeed(null)} />}
      {trading && canManage && <TradeSheet state={state} me={me} room={room} to={trading} setTo={setTrading} others={others} name={name} onClose={() => setTrading(null)} />}
      {state.trade && state.trade.to === me && <TradeIncoming state={state} name={name} />}

      {callout && createPortal(
        <div key={callout.key} className="mg-callout" style={{ ['--co' as string]: callout.color }}>
          <b className="display">{callout.text}</b>
          {callout.sub && <span>{callout.sub}</span>}
        </div>, document.body)}
      {tip && TIPS[tip.k] && createPortal(
        <button key={tip.key} className="mg-tip" onClick={() => { clearTimeout(tipTimer.current); setTip(null) }} aria-label="Dismiss rule">
          {tip.tile != null
            ? <span className="mg-tip-tile" style={{ ['--tc' as string]: colorOf(tip.tile) }}><i />{SPACES[tip.tile].name}</span>
            : <span className="mg-tip-i display">?</span>}
          <span>
            {tip.title && <small>{tip.title}</small>}
            <b className="display">{TIPS[tip.k].name}</b>{TIPS[tip.k].text}
          </span>
        </button>, document.body)}
    </div>
  )
}

function fullSetOf(g: St, pid: string, space: number): boolean {
  const s = SPACES[space]
  return s.kind === 'street' && GROUPS[s.group].every((i) => g.owner[i] === pid)
}

function Dice({ faces, rolling, say, live }: { faces: [number, number]; rolling: boolean; say?: string; live?: boolean }) {
  return (
    <div className={`mg-dice ${rolling ? 'rolling' : ''} ${live ? 'live' : ''}`}>
      <div className="mg-dice-row"><Die n={faces[0]} cls="a" /><Die n={faces[1]} cls="b" /></div>
      {say && <p className="mg-say display">{say}</p>}
    </div>
  )
}

function CardFlip({ card, who }: { card: NonNullable<St['card']>; who: string }) {
  const chance = card.deck === 'chance'
  return (
    <div className={`mg-card ${chance ? 'chance' : 'chest'}`}>
      <div className="mg-card-in">
        <div className="mg-card-back"><span className="display">{chance ? '?' : 'CHEST'}</span></div>
        <div className="mg-card-face">
          <small className="display">{chance ? 'Chance' : 'Chest'} · {who}</small>
          <p>{card.text}</p>
        </div>
      </div>
    </div>
  )
}

/* ---------- sheets ---------- */

function Sheet({ children, onClose, cls = '' }: { children: ReactNode; onClose: () => void; cls?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className={`mg-sheet ${cls}`} onClick={(e) => { if (e.target === e.currentTarget) { sfx.close(); onClose() } }}>
      <div className="mg-sheet-in">
        <button className="mg-x" onClick={() => { sfx.close(); onClose() }} aria-label="Close">×</button>
        {children}
      </div>
    </div>, document.body)
}

function DeedSheet({ i, state, me, room, canManage, name, onClose }: { i: number; state: St; me: string; room: Room; canManage: boolean; name: (p: string | null) => string; onClose: () => void }) {
  const s = SPACES[i]
  const own = state.owner[i]
  const h = state.houses[i] ?? 0
  const m = state.mortgaged.includes(i)
  const mineHere = own === me
  const cash = state.cash[me] ?? 0
  let buildWhy: string | null = null, sellWhy: string | null = null, mortWhy: string | null = null
  if (s.kind === 'street') {
    const g = GROUPS[s.group]
    const hs = g.map((x) => state.houses[x] ?? 0)
    buildWhy = !g.every((x) => state.owner[x] === me) ? 'Own the whole set to build'
      : g.some((x) => state.mortgaged.includes(x)) ? 'Lift the set’s mortgages first'
      : h >= 5 ? 'Already a hotel' : h > Math.min(...hs) ? 'Build evenly across the set'
      : h === 4 && state.hotelsLeft === 0 ? 'The bank is out of hotels' : h < 4 && state.housesLeft === 0 ? 'The bank is out of houses'
      : cash < s.house ? `Costs ${money(s.house)}` : null
    sellWhy = !h ? null : h < Math.max(...hs) ? 'Sell evenly across the set' : null
    mortWhy = hs.some(Boolean) ? 'Sell the set’s buildings first' : null
  }
  const rent = own && !m ? currentRent(state, i) : null
  return (
    <Sheet onClose={onClose} cls="deed">
      <Deed i={i} />
      <p className="mg-owner">
        {own ? <><i style={{ background: playerHex(room, own) }} />Owned by <b>{name(own)}</b>{m ? ' · mortgaged' : rent != null ? ` · rent now ${rent}` : ''}</> : 'For sale at the bank'}
      </p>
      {mineHere && s.kind === 'street' && h > 0 && <p className="mg-built">{h === 5 ? 'Hotel' : `${h} house${h > 1 ? 's' : ''}`}</p>}
      {mineHere && canManage && (
        <div className="mg-manage">
          {s.kind === 'street' && !m && (
            <>
              <button className="bubble-btn small lime" disabled={!!buildWhy} onClick={() => { sfx.click(); act({ type: 'build', space: i }) }}>
                Build {h === 4 ? 'hotel' : 'house'} <small>−{money(s.house)}</small>
              </button>
              {h > 0 && <button className="bubble-btn small" disabled={!!sellWhy} onClick={() => { sfx.click(); act({ type: 'sell', space: i }) }}>Sell {h === 5 ? 'hotel' : 'house'} <small>+{money(s.house / 2)}</small></button>}
            </>
          )}
          {!m && <button className="bubble-btn small" disabled={!!mortWhy} onClick={() => { sfx.click(); act({ type: 'mortgage', space: i }) }}>Mortgage <small>+{money(mortgageValue(i))}</small></button>}
          {m && <button className="bubble-btn small magenta" disabled={cash < liftCost(i)} onClick={() => { sfx.click(); act({ type: 'unmortgage', space: i }) }}>Lift mortgage <small>−{money(liftCost(i))}</small></button>}
          {(buildWhy || sellWhy || mortWhy) && !m && <small className="mg-why">{[s.kind === 'street' && buildWhy, sellWhy, h === 0 ? null : mortWhy].filter(Boolean).join(' · ')}</small>}
        </div>
      )}
      {mineHere && !canManage && <small className="mg-why">You can build, sell and mortgage on your turn.</small>}
    </Sheet>
  )
}

function currentRent(state: St, i: number): string {
  const s = SPACES[i]
  const own = state.owner[i]
  if (s.kind === 'street') {
    const h = state.houses[i] ?? 0
    return money(h ? s.rent[h] : s.rent[0] * (GROUPS[s.group].every((x) => state.owner[x] === own) ? 2 : 1))
  }
  if (s.kind === 'station') return money(25 * 2 ** (STATIONS.filter((x) => state.owner[x] === own).length - 1))
  return UTILS.every((x) => state.owner[x] === own) ? '10× dice' : '4× dice'
}

const tradeable = (state: St, pid: string) => Object.keys(state.owner).map(Number).filter((i) => {
  if (state.owner[i] !== pid) return false
  const s = SPACES[i]
  return s.kind !== 'street' || !GROUPS[s.group].some((x) => state.houses[x])
}).sort((a, b) => a - b)

function Stepper({ value, max, set }: { value: number; max: number; set: (n: number) => void }) {
  const bump = (d: number) => { sfx.tap(); set(Math.max(0, Math.min(max, value + d))) }
  return (
    <div className="mg-step">
      <button onClick={() => bump(-50)} disabled={value <= 0}>−50</button>
      <button onClick={() => bump(-10)} disabled={value <= 0}>−10</button>
      <input inputMode="numeric" value={value ? `$${value}` : '$0'} aria-label="Cash"
        onChange={(e) => set(Math.max(0, Math.min(max, Number(e.target.value.replace(/\D/g, '')) || 0)))} />
      <button onClick={() => bump(10)} disabled={value >= max}>+10</button>
      <button onClick={() => bump(50)} disabled={value >= max}>+50</button>
    </div>
  )
}

function PropPick({ list, picked, toggle, state }: { list: number[]; picked: Set<number>; toggle: (i: number) => void; state: St }) {
  if (!list.length) return <p className="mg-empty">Nothing tradeable</p>
  return (
    <div className="mg-chips pick">
      {list.map((i) => (
        <button key={i} className={`mg-chip ${picked.has(i) ? 'on' : ''} ${state.mortgaged.includes(i) ? 'mort' : ''}`} style={{ ['--dc' as string]: colorOf(i) }}
          onClick={() => { sfx.tap(); toggle(i) }} aria-pressed={picked.has(i)}>
          <b>{SPACES[i].name}</b><em>{state.mortgaged.includes(i) ? 'mortgaged' : money(priceOf(i))}</em>
        </button>
      ))}
    </div>
  )
}

function TradeSheet({ state, me, room, to, setTo, others, name, onClose }: { state: St; me: string; room: Room; to: string; setTo: (p: string) => void; others: string[]; name: (p: string) => string; onClose: () => void }) {
  const [give, setGive] = useState<Set<number>>(new Set())
  const [get, setGet] = useState<Set<number>>(new Set())
  const [giveCash, setGiveCash] = useState(0)
  const [getCash, setGetCash] = useState(0)
  const [giveCard, setGiveCard] = useState(false)
  const [getCard, setGetCard] = useState(false)
  useEffect(() => { setGet(new Set()); setGetCash(0); setGetCard(false) }, [to])
  const flip = (s: Set<number>, set: (s: Set<number>) => void) => (i: number) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); set(n) }
  const empty = !give.size && !get.size && !giveCash && !getCash && !giveCard && !getCard
  const send = () => {
    sfx.click()
    act({ type: 'offer', to, give: { cash: giveCash, spaces: [...give], cards: giveCard ? 1 : 0 }, get: { cash: getCash, spaces: [...get], cards: getCard ? 1 : 0 } })
    onClose()
  }
  return (
    <Sheet onClose={onClose} cls="trade">
      <h3 className="display mg-sheet-h">Trade</h3>
      <div className="mg-who">
        {others.map((p) => (
          <button key={p} className={`mg-who-b ${p === to ? 'on' : ''}`} style={{ ['--sc' as string]: playerHex(room, p) }} onClick={() => { sfx.tap(); setTo(p) }}>
            <i><Avatar config={room.players.find((x) => x.id === p)?.avatar} size="100%" track="none" /></i>{name(p)}
          </button>
        ))}
      </div>
      <div className="mg-sides">
        <section>
          <h4>You give</h4>
          <PropPick list={tradeable(state, me)} picked={give} toggle={flip(give, setGive)} state={state} />
          <Stepper value={giveCash} max={state.cash[me] ?? 0} set={setGiveCash} />
          {state.jailCards[me] > 0 && <label className="mg-card-t"><input type="checkbox" checked={giveCard} onChange={(e) => setGiveCard(e.target.checked)} /> Get Out of Jail Free card</label>}
        </section>
        <section>
          <h4>You get from {name(to)}</h4>
          <PropPick list={tradeable(state, to)} picked={get} toggle={flip(get, setGet)} state={state} />
          <Stepper value={getCash} max={state.cash[to] ?? 0} set={setGetCash} />
          {state.jailCards[to] > 0 && <label className="mg-card-t"><input type="checkbox" checked={getCard} onChange={(e) => setGetCard(e.target.checked)} /> Their Get Out of Jail Free card</label>}
        </section>
      </div>
      <button className="bubble-btn magenta mg-send" disabled={empty} onClick={send}>Send offer</button>
    </Sheet>
  )
}

function SideList({ side, state }: { side: Side; state: St }) {
  return (
    <ul className="mg-side">
      {side.spaces.map((i) => <li key={i} style={{ ['--dc' as string]: colorOf(i) }}><i />{SPACES[i].name}{state.mortgaged.includes(i) ? ' (mortgaged)' : ''}</li>)}
      {side.cash > 0 && <li className="cash">{money(side.cash)}</li>}
      {side.cards > 0 && <li className="cash">Get Out of Jail Free</li>}
      {!side.spaces.length && !side.cash && !side.cards && <li className="none">nothing</li>}
    </ul>
  )
}

function TradeIncoming({ state, name }: { state: St; name: (p: string) => string }) {
  const tr = state.trade!
  return createPortal(
    <div className="mg-sheet incoming">
      <div className="mg-sheet-in">
        <h3 className="display mg-sheet-h">{name(tr.from)} offers a trade</h3>
        <div className="mg-sides">
          <section><h4>You get</h4><SideList side={tr.give} state={state} /></section>
          <section><h4>You give</h4><SideList side={tr.get} state={state} /></section>
        </div>
        <TimerBar left={state.timeLeft} total={state.timeTotal ?? 30} k={`${tr.id}`} running={state.timeLeft != null} />
        <div className="mg-btns">
          <button className="bubble-btn magenta" onClick={() => { sfx.click(); act({ type: 'accept' }) }}>Deal</button>
          <button className="bubble-btn" onClick={() => { sfx.close(); act({ type: 'decline' }) }}>No thanks</button>
        </div>
      </div>
    </div>, document.body)
}
