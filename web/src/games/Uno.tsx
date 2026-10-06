import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import Avatar from '../components/Avatar'
import { TurnBanner } from './shared'
import { ordinal } from '../lib/ui'
import './Uno.css'

type Color = 'red' | 'yellow' | 'green' | 'blue' | 'pink' | 'teal' | 'purple' | 'orange' | 'wild'
type Kind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4' | 'swap' | 'custom'
  | 'draw1' | 'flip' | 'wild2' | 'draw5' | 'skipall' | 'wildcolor'   // UNO Flip
export type Card = { id: number; color: Color; kind: Kind; value: number | null }

const COLORS = ['red', 'yellow', 'green', 'blue'] as const
const DARK = ['pink', 'teal', 'purple', 'orange'] as const
export const HEX: Record<string, string> = {
  red: '#ff5d73', yellow: '#ffc93c', green: '#43d17a', blue: '#3d8bff', wild: '#1b1f3f',
  pink: '#ff5fb8', teal: '#14b8a6', purple: '#8b5cf6', orange: '#ff8a1f',
}
const WILDS: Kind[] = ['wild', 'wild4', 'swap', 'custom', 'wild2', 'wildcolor']
const KIND_NAME: Record<Kind, string> = {
  number: '', skip: 'Skip', reverse: 'Reverse', draw2: 'Draw Two', wild: 'Wild', wild4: 'Wild Draw Four', swap: 'Swap Hands', custom: 'Everyone +2',
  draw1: 'Draw One', flip: 'Flip', wild2: 'Wild Draw Two', draw5: 'Draw Five', skipall: 'Skip Everyone', wildcolor: 'Wild Draw Colour',
}
/** The wilds a player may challenge, and what each one costs. */
const CHALLENGE: Partial<Record<Kind, { short: string; take: (named: string) => string; bluff: (named: string) => string; wrong: (named: string) => string }>> = {
  wild4: { short: '+4', take: () => 'Take the 4', bluff: () => 'they draw 4 and you play', wrong: () => 'you draw 6 and lose your go' },
  wild2: { short: 'Wild +2', take: () => 'Take the 2', bluff: () => 'they draw 2 and you play', wrong: () => 'you draw 4 and lose your go' },
  wildcolor: {
    short: 'Wild Draw Colour', take: (n) => `Draw till ${n}`,
    bluff: (n) => `they draw until they hit ${n} and you play`, wrong: (n) => `you draw until you hit ${n}, plus 2 more, and lose your go`,
  },
}

/** Which side of an UNO Flip deck is face up; plain Wilds borrow it to pick their palette. */
const Side = createContext<'light' | 'dark'>('light')
const isDark = (card: Card, side: 'light' | 'dark') =>
  (DARK as readonly string[]).includes(card.color) || card.kind === 'wildcolor' || card.kind === 'draw5' || card.kind === 'skipall' ||
  (card.color === 'wild' && card.kind === 'wild' && side === 'dark')

/** One line on what a power card does, shown when it lands (and when you tap the pile). */
function ruleOf(card: Card, nPlayers: number, color?: string): { name: string; text: string } | null {
  const c = color ? ` The colour is now ${color}.` : ''
  switch (card.kind) {
    case 'skip': return { name: 'Skip', text: nPlayers === 2 ? 'The other player misses a go, so the same player goes again.' : 'The next player misses their go.' }
    case 'reverse': return { name: 'Reverse', text: nPlayers === 2 ? 'With two players Reverse works like Skip: the same player goes again.' : 'Play now runs the other way round the table.' }
    case 'draw2': return { name: 'Draw Two', text: 'The next player takes 2 cards and misses their go. No stacking another +2 on it.' }
    case 'draw1': return { name: 'Draw One', text: 'The next player takes 1 card and misses their go.' }
    case 'draw5': return { name: 'Draw Five', text: 'The next player takes 5 cards and misses their go.' }
    case 'skipall': return { name: 'Skip Everyone', text: 'Everyone else is skipped, so the same player goes again.' }
    case 'flip': return { name: 'Flip', text: 'Every card on the table turns over: hands, deck and pile. Play carries on with the other side, and the old bottom card of the pile is the new top.' }
    case 'wild': return { name: 'Wild', text: `Goes on anything; whoever plays it picks the colour.${c}` }
    case 'wild4': return { name: 'Wild Draw Four', text: `The next player takes 4 and misses their go, unless they challenge. It's only legal when you hold no other card you could play.${c}` }
    case 'wild2': return { name: 'Wild Draw Two', text: `The next player takes 2 and misses their go, unless they challenge. It's only legal with no card of the colour in play.${c}` }
    case 'wildcolor': return { name: 'Wild Draw Colour', text: `The next player draws until they get a card of the named colour, and misses their go. It can be challenged like +4.${c}` }
    case 'swap': return { name: 'Swap Hands', text: `Whoever plays it swaps their whole hand with another player.${c}` }
    case 'custom': return { name: 'Everyone +2', text: `Every other player takes 2 cards.${c}` }
    default: return null
  }
}

/* ---------- card art ---------- */

function Glyph({ card, dark }: { card: Card; dark: boolean }): ReactElement {
  switch (card.kind) {
    case 'number':
      return (
        <g>
          <text x="0" y="0" dy="0.36em" textAnchor="middle" className="uc-num" style={{ fontSize: 44 }}>{card.value}</text>
          {(card.value === 6 || card.value === 9) && <rect x="-10" y="19" width="20" height="5" rx="2.5" fill="currentColor" stroke="#1b1f3f" strokeWidth="2" />}
        </g>
      )
    case 'skip':
      return <g fill="none" stroke="currentColor" strokeWidth="7"><circle r="17" /><path d="M-12 12 12 -12" /></g>
    case 'reverse': {
      const arrow = 'M-15 9 L1 -7 L-4 -12 L13 -15 L10 2 L5 -3 L-11 13 Z'
      return (
        <g fill="currentColor" stroke="#1b1f3f" strokeWidth="2" strokeLinejoin="round">
          <path d={arrow} transform="translate(-3 -3)" />
          <path d={arrow} transform="translate(3 3) rotate(180)" />
        </g>
      )
    }
    case 'draw2':
    case 'draw1':
    case 'draw5':
      return <text dy="0.36em" textAnchor="middle" className="uc-num" style={{ fontSize: 34 }}>{{ draw2: '+2', draw1: '+1', draw5: '+5' }[card.kind]}</text>
    case 'skipall':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="5">
          <circle r="12" cx="-7" cy="-7" /><path d="M-15 1 1 -15" />
          <circle r="12" cx="7" cy="7" /><path d="M-1 15 15 -1" />
        </g>
      )
    case 'flip':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-15 -4 A15 15 0 0 1 11 -11" /><path d="M5 -17 L12 -11 L4 -5" />
          <path d="M15 4 A15 15 0 0 1 -11 11" /><path d="M-5 17 L-12 11 L-4 5" />
        </g>
      )
    case 'wild4':
    case 'wild':
    case 'custom':
    case 'swap':
    case 'wild2':
    case 'wildcolor': {
      const label = { wild4: '+4', custom: '+2·all', swap: '⇄', wild2: '+2', wildcolor: '+?', wild: '' }[card.kind]
      const w = dark ? [HEX.pink, HEX.teal, HEX.orange, HEX.purple] : [HEX.red, HEX.green, HEX.yellow, HEX.blue]
      return (
        <g>
          <g transform="rotate(-25) scale(0.85 1.15)">
            <path d="M0 0 L0 -20 A20 20 0 0 1 20 0Z" fill={w[0]} />
            <path d="M0 0 L20 0 A20 20 0 0 1 0 20Z" fill={w[1]} />
            <path d="M0 0 L0 20 A20 20 0 0 1 -20 0Z" fill={w[2]} />
            <path d="M0 0 L-20 0 A20 20 0 0 1 0 -20Z" fill={w[3]} />
          </g>
          {label && <text dy="0.36em" textAnchor="middle" className="uc-num uc-wl" style={{ fontSize: label.length > 2 ? 15 : 24 }}>{label}</text>}
        </g>
      )
    }
  }
}

function corner(card: Card): string {
  if (card.kind === 'number') return String(card.value)
  return { skip: '⊘', reverse: '⇅', draw2: '+2', wild: 'W', wild4: '+4', swap: '⇄', custom: '★',
    draw1: '+1', draw5: '+5', flip: '↻', skipall: '⊘', wild2: '+2', wildcolor: '+?' }[card.kind] ?? ''
}

/** `dark` forces a side (for the far faces of Flip cards); otherwise the card works it out. */
export function UnoCard({ card, chosen, className = '', style, onClick, dataId, dark: forceDark }: {
  card: Card; chosen?: string; className?: string; style?: CSSProperties; onClick?: () => void; dataId?: number; dark?: boolean
}) {
  const side = useContext(Side)
  const dark = forceDark ?? isDark(card, side)
  const bg = HEX[card.color]
  // dark side: black frame and oval, so the glyph glows in the card's colour
  const ink = dark && card.color === 'wild' ? '#fff' : bg
  return (
    <div className={`uc ${dark ? 'uc-dark' : ''} ${className}`} data-id={dataId ?? card.id} style={{ ...style, ['--cc' as string]: bg, ['--chosen' as string]: chosen ? HEX[chosen] : 'transparent' }} onClick={onClick}>
      <svg viewBox="-40 -60 80 120" className="uc-svg">
        <rect x="-40" y="-60" width="80" height="120" rx="10" fill={dark ? '#1b1f3f' : '#fff'} />
        <rect x="-35" y="-55" width="70" height="110" rx="7" fill={bg} />
        <ellipse rx="27" ry="44" transform="rotate(28)" fill={dark ? '#1b1f3f' : '#fff'} />
        <g color={ink} style={{ color: ink }} fill={ink}>
          <Glyph card={card} dark={dark} />
        </g>
        <text x="-27" y="-38" className="uc-corner">{corner(card)}</text>
        <text x="27" y="44" className="uc-corner" transform="rotate(180 27 38)">{corner(card)}</text>
      </svg>
    </div>
  )
}

export function UnoBack({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`uc back ${className}`} style={style}>
      <svg viewBox="-40 -60 80 120" className="uc-svg">
        <rect x="-40" y="-60" width="80" height="120" rx="10" fill="#fff" />
        <rect x="-35" y="-55" width="70" height="110" rx="7" fill="#1b1f3f" />
        <ellipse rx="27" ry="44" transform="rotate(28)" fill="#ff5d73" />
        <text dy="0.36em" textAnchor="middle" transform="rotate(-18)" className="uc-logo">UNO</text>
      </svg>
    </div>
  )
}

/* ---------- game ---------- */

type Pending = { card: Card; color?: string; needTarget: boolean; needColor: boolean }
type Callout = { text: string; sub?: string; color: string; key: number; big?: boolean }
type Reveal = { of: string; cards: Card[]; bad: number[]; color: string; guilty: boolean; id: number; kind?: Kind }
type Tip = { card: Card; color?: string; key: number }

export default function Uno({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const hand: Card[] = state.hand ?? []
  // everyone dealt in keeps their seat; finishers just stop taking turns
  const order: string[] = state.seats ?? state.players
  const places: Record<string, number> = state.places ?? {}
  const gone: string[] = state.left ?? []
  const top: Card = state.top
  const myTurn = state.turn === me && !spectator && !state.over
  const playable = new Set<number>(state.playable ?? [])
  const phase: string = state.phase
  const counts: Record<string, number> = state.counts
  const vulnerable: string[] = state.vulnerable ?? []
  const saidUno: string[] = state.saidUno ?? []
  const others = (() => {
    const i = order.indexOf(me)
    if (i < 0) return order
    return [...order.slice(i + 1), ...order.slice(0, i)]
  })()
  const name = (pid: string) => (pid === me ? 'You' : players.find((p) => p.id === pid)?.name ?? '…')
  const side: 'light' | 'dark' = state.side === 'dark' ? 'dark' : 'light'
  const palette: string[] = state.palette ?? [...COLORS]
  const backs: Record<string, Card[]> | null = state.backs ?? null

  const [pending, setPending] = useState<Pending | null>(null)
  const [callout, setCallout] = useState<Callout | null>(null)
  // what the last power card does, so nobody has to know the rules by heart
  const [tip, setTip] = useState<Tip | null>(null)
  const tipTimer = useRef<number | undefined>(undefined)
  const showTip = (card: Card, color?: string, hold = 4200) => {
    if (!ruleOf(card, 3)) return
    setTip({ card, color, key: Date.now() + Math.random() })
    clearTimeout(tipTimer.current)
    tipTimer.current = window.setTimeout(() => setTip(null), hold)
  }
  const [pile, setPile] = useState<{ card: Card; rot: number; x: number; y: number; color: string }[]>(() => [{ card: top, rot: -4, x: 0, y: 0, color: state.color }])

  // FLIP bookkeeping
  const lastPlayRect = useRef<DOMRect | null>(null)
  const playFrom = useRef<string | null>(null)
  const swapFrom = useRef<string | null>(null)
  const knownHand = useRef<Set<number>>(new Set(hand.map((c) => c.id)))
  const calloutTimer = useRef<number | undefined>(undefined)

  const shout = (text: string, color = '#1d3a6e', sub?: string, hold = 1500) => {
    setCallout({ text, color, sub, key: Date.now() + Math.random(), big: hold > 1500 })
    clearTimeout(calloutTimer.current)
    calloutTimer.current = window.setTimeout(() => setCallout(null), hold)
  }

  // after a +4 challenge the challenger gets a peek at the accused hand
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const revealSeen = useRef<number | null>(state.reveal?.id ?? null)
  useEffect(() => {
    const r: Reveal | null = state.reveal
    if (!r || r.id === revealSeen.current) return
    revealSeen.current = r.id
    setReveal(r)
    const t = window.setTimeout(() => setReveal(null), 5200)
    return () => window.clearTimeout(t)
  }, [state.reveal?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rectOf = (sel: string) => root.current?.querySelector(sel)?.getBoundingClientRect() ?? null

  const flyBacks = (pid: string, n: number) => {
    const from = rectOf('.uno-draw')
    const to = pid === me ? rectOf('.uno-hand') : rectOf(`.uno-opp[data-pid="${pid}"] .uno-opp-fan`)
    const layer = root.current?.querySelector('.uno-fly')
    if (!from || !to || !layer || pid === me) return
    const lr = layer.getBoundingClientRect()
    for (let i = 0; i < Math.min(n, 8); i++) {
      const el = document.createElement('div')
      el.className = 'uno-flyback'
      layer.appendChild(el)
      gsap.fromTo(el,
        { x: from.left - lr.left + from.width / 2, y: from.top - lr.top + from.height / 2, rotate: 0, scale: 1 },
        {
          x: to.left - lr.left + to.width / 2 + (i - n / 2) * 6, y: to.top - lr.top + to.height / 2, rotate: gsap.utils.random(-30, 30), scale: 0.55,
          duration: 0.5, delay: i * 0.08, ease: 'power3.inOut', onStart: () => sfx.card(), onComplete: () => el.remove(),
        })
    }
  }

  // events → sounds, callouts, flying cards
  useEffect(() => onGameEvents((evs, st) => {
    for (const e of evs) {
      switch (e.kind) {
        case 'play': {
          const c: Card = e.card
          setPile((p) => [...p.slice(-5), { card: c, rot: gsap.utils.random(-22, 22), x: gsap.utils.random(-10, 10), y: gsap.utils.random(-8, 8), color: e.color }])
          if (e.pid !== me) playFrom.current = e.pid
          sfx.card()
          if (c.kind === 'skip') shout('Skip!', HEX[c.color], `${name(nextOf(st, e.pid, 1))} sits out`)
          else if (c.kind === 'skipall') shout('Skip all!', HEX[c.color], `${name(e.pid)} ${e.pid === me ? 'go' : 'goes'} again`)
          else if (c.kind === 'reverse') shout(st.players.length === 2 ? 'Skip!' : 'Reverse!', HEX[c.color], st.players.length === 2 ? 'reverse = skip with 2' : 'direction flipped')
          else if (c.kind === 'wild') shout('Wild!', HEX[e.color], `colour is ${e.color}`)
          else if (c.kind === 'wild4') shout('+4?!', HEX[e.color], `colour is ${e.color}`)
          else if (c.kind === 'wild2') shout('+2?!', HEX[e.color], `colour is ${e.color}`)
          else if (c.kind === 'wildcolor') shout('Draw colour!', HEX[e.color], `draw till ${e.color}`)
          else if (c.kind === 'draw2' || c.kind === 'draw1' || c.kind === 'draw5') sfx.slam()
          if (c.kind !== 'number' && c.kind !== 'flip') showTip(c, c.color === 'wild' ? e.color : undefined)
          break
        }
        case 'flip': {
          sfx.whoosh()
          shout('Flip!', e.side === 'dark' ? HEX.purple : HEX.yellow, `${e.pid ? name(e.pid) : 'The first card'} turned the table to the ${e.side} side`, 2000)
          setPile([{ card: e.top, rot: -4, x: 0, y: 0, color: st.color }])
          flipping.current = true
          if (e.pid) showTip({ id: -1, color: e.side === 'dark' ? 'purple' : 'yellow', kind: 'flip', value: null }, undefined)
          break
        }
        case 'forced_draw':
          shout(`+${e.count}`, '#ff5d73', `${name(e.pid)} ${e.pid === me ? 'draw' : 'draws'} ${e.count}${e.card?.kind === 'wildcolor' ? ` till ${st.color}` : ''}`)
          if (e.pid === me) sfx.bad(); else sfx.slam()
          flyBacks(e.pid, e.count)
          break
        case 'draw':
          flyBacks(e.pid, e.count)
          if (e.pid === me) sfx.card()
          break
        case 'pass':
          if (e.pid !== me) shout('Pass', '#1d3a6e', `${name(e.pid)} keeps the card`)
          break
        case 'uno':
          sfx.uno()
          shout('UNO!', '#ff5d73', `${name(e.pid)} ${e.pid === me ? 'call' : 'calls'} it`)
          gsap.fromTo(root.current!.querySelector(`[data-pid="${e.pid}"]`), { scale: 1.25, rotate: -6 }, { scale: 1, rotate: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)' })
          break
        case 'caught':
          shout('Caught!', '#ff5d73', `${name(e.pid)} forgot UNO · +2`)
          if (e.pid === me) sfx.lose(); else sfx.point()
          flyBacks(e.pid, 2)
          break
        case 'swap':
          sfx.whoosh()
          shout('Swap!', '#a596ff', `${name(e.pid)} ⇄ ${name(e.target)}`)
          if (e.pid === me) swapFrom.current = e.target
          else if (e.target === me) swapFrom.current = e.pid
          break
        case 'custom':
          shout('+2 all!', '#a596ff', `${name(e.pid)} spares nobody`)
          for (const p of st.players as string[]) if (p !== e.pid) flyBacks(p, 2)
          if (e.pid !== me) sfx.bad()
          break
        case 'challenge':
          shout(e.guilty ? 'Guilty!' : 'Innocent!', e.guilty ? '#43d17a' : '#ff5d73',
            e.guilty ? `${name(e.offender)} bluffed · +${e.count ?? 4}` : `${name(e.offender)} was clean · ${name(e.pid)} ${e.pid === me ? 'draw' : 'draws'} ${e.count ?? 6}`, 2200)
          flyBacks(e.guilty ? e.offender : e.pid, e.count ?? (e.guilty ? 4 : 6))
          if ((e.guilty && e.pid === me) || (!e.guilty && e.offender === me)) sfx.point(); else sfx.bad()
          break
        case 'color':
          shout(e.color, HEX[e.color], 'is the colour')
          setPile((p) => p.map((x, i) => (i === p.length - 1 ? { ...x, color: e.color } : x)))
          break
        case 'reshuffle':
          shout('Reshuffle', '#1d3a6e', 'discards become the draw pile')
          sfx.whoosh()
          break
        case 'left':
          shout('Left', '#1d3a6e', `${name(e.pid)} quit the table`)
          break
        case 'out':
          if (e.pid === me) { sfx.win(); shout(`${ordinal(e.place)}!`, '#ffb424', `You're out · +${e.points} pts · watch the rest`, 3000) }
          else { sfx.uno(); shout(`${name(e.pid)} is out!`, '#ffb424', `${ordinal(e.place)} place · the rest play on`, 2600) }
          gsap.fromTo(root.current!.querySelector(`.uno-opp[data-pid="${e.pid}"]`), { scale: 1.4, rotate: -10 }, { scale: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' })
          break
      }
    }
  }), [me, players]) // eslint-disable-line react-hooks/exhaustive-deps

  // new top card flies in (from my hand, an opponent, or the start)
  useLayoutEffect(() => {
    const el = root.current?.querySelector<HTMLElement>('.uno-pile .uc:last-child')
    if (!el) return
    const to = el.getBoundingClientRect()
    let from: DOMRect | null = null
    if (lastPlayRect.current) { from = lastPlayRect.current; lastPlayRect.current = null }
    else if (playFrom.current) { from = rectOf(`.uno-opp[data-pid="${playFrom.current}"] .uno-opp-fan`); playFrom.current = null }
    const last = pile[pile.length - 1]
    if (from) {
      gsap.fromTo(el, { x: from.left + from.width / 2 - (to.left + to.width / 2), y: from.top + from.height / 2 - (to.top + to.height / 2), rotate: 0, scale: 1.1 },
        { x: last.x, y: last.y, rotate: last.rot, scale: 1, duration: 0.5, ease: 'power3.out', onComplete: thud })
    } else {
      gsap.fromTo(el, { scale: 1.6, rotate: last.rot - 40 }, { scale: 1, rotate: last.rot, x: last.x, y: last.y, duration: 0.5, ease: 'back.out(2)' })
    }
  }, [pile.length, pile[pile.length - 1]?.card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // a Flip: the felt rolls over and every card turns to its new face
  const flipping = useRef(false)
  useLayoutEffect(() => {
    if (!flipping.current) return
    flipping.current = false
    const el = root.current
    if (!el) return
    gsap.fromTo(el.querySelector('.uno-table'), { rotateX: 75, scale: 0.92 }, { rotateX: 0, scale: 1, duration: 0.8, ease: 'back.out(1.6)', transformPerspective: 900 })
    gsap.fromTo(el.querySelectorAll('.uno-hand .uc, .uno-opp-fan .uc, .uno-pile .uc, .uno-draw .uc'), { rotateY: -180 },
      { rotateY: 0, duration: 0.6, ease: 'power3.out', stagger: { each: 0.025, from: 'center' }, clearProps: 'rotateY,transform' })
  }, [side])

  const thud = () => {
    const t = root.current?.querySelector('.uno-table')
    if (t) gsap.fromTo(t, { scale: 1.015 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' })
  }

  // cards entering my hand fly from the draw pile (or the swap partner)
  useLayoutEffect(() => {
    const ids = new Set(hand.map((c) => c.id))
    const fresh = hand.filter((c) => !knownHand.current.has(c.id))
    knownHand.current = ids
    if (!fresh.length) return
    const src = swapFrom.current ? rectOf(`.uno-opp[data-pid="${swapFrom.current}"] .uno-opp-fan`) : rectOf('.uno-draw')
    swapFrom.current = null
    if (!src) return
    fresh.forEach((c, i) => {
      const el = root.current?.querySelector<HTMLElement>(`.uno-hand .uc[data-id="${c.id}"]`)
      if (!el) return
      const r = el.getBoundingClientRect()
      gsap.fromTo(el, { x: src.left - r.left, y: src.top - r.top, rotateY: 180, rotate: -20 },
        { x: 0, y: 0, rotateY: 0, rotate: 0, duration: 0.55, delay: Math.min(i, 10) * 0.06, ease: 'power3.out', clearProps: 'transform' })
    })
  }, [hand.map((c) => c.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // a Reverse: the arrows punch up so nobody misses the new direction
  const firstDir = useRef(true)
  useLayoutEffect(() => {
    if (firstDir.current) { firstDir.current = false; return }
    const el = root.current
    if (!el) return
    gsap.fromTo(el.querySelector('.uno-arrows'), { opacity: 0.2 }, { opacity: 1, duration: 0.6, ease: 'power2.out' })
    gsap.fromTo(el.querySelector('.uno-dir'), { scale: 1.6, rotate: state.direction === 1 ? -180 : 180 }, { scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(2.4)' })
  }, [state.direction]) // eslint-disable-line react-hooks/exhaustive-deps

  // whole-table colour wash when the active colour changes
  useLayoutEffect(() => {
    const ring = root.current?.querySelector('.uno-ring')
    if (ring) gsap.fromTo(ring, { scale: 0.8, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)' })
  }, [state.color])

  useEffect(() => {
    if (!myTurn) setPending(null)
  }, [myTurn])

  // a bit of a nudge when it's my move
  useEffect(() => {
    if (myTurn && phase !== 'challenge') sfx.pop()
  }, [myTurn, phase])

  const catchOut = (pid: string) => { sfx.slam(); act({ type: 'catch', target: pid }) }
  const catchable = spectator || state.over ? [] : vulnerable.filter((p) => p !== me)
  // the big catch prompt pulses in with a buzz whenever someone new forgets
  const catchKey = catchable.join(',')
  useEffect(() => { if (catchKey) sfx.hit(0.5) }, [catchKey])

  const send = (card: Card, color?: string, target?: string) => {
    const el = root.current?.querySelector(`.uno-hand .uc[data-id="${card.id}"]`)
    lastPlayRect.current = el?.getBoundingClientRect() ?? null
    act({ type: 'play', card: card.id, ...(color ? { color } : {}), ...(target ? { target } : {}) })
    setPending(null)
  }

  const clickCard = (card: Card) => {
    if (!myTurn) return
    if (!playable.has(card.id)) {
      sfx.bad()
      const el = root.current?.querySelector(`.uno-hand .uc[data-id="${card.id}"]`)
      if (el) gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.2)' })
      return
    }
    const wild = WILDS.includes(card.kind)
    const needTarget = card.kind === 'swap' && hand.length > 1 && others.length > 1
    if (!wild) return send(card)
    sfx.open()
    setPending({ card, needColor: true, needTarget })
  }

  const pickColor = (color: string) => {
    sfx.click()
    if (phase === 'start_color') {
      if (top.kind === 'swap' && others.length > 1) return setPending({ card: top, color, needColor: false, needTarget: true })
      act({ type: 'start_color', color, ...(top.kind === 'swap' ? { target: others[0] } : {}) })
      return setPending(null)
    }
    if (!pending) return
    if (pending.needTarget) return setPending({ ...pending, color, needColor: false })
    const target = pending.card.kind === 'swap' && hand.length > 1 ? others[0] : undefined
    send(pending.card, color, target)
  }

  const pickTarget = (pid: string) => {
    sfx.click()
    if (phase === 'start_color') {
      act({ type: 'start_color', color: pending?.color, target: pid })
      return setPending(null)
    }
    if (pending?.color) send(pending.card, pending.color, pid)
  }

  const canDraw = myTurn && phase === 'play'
  const canPass = myTurn && phase === 'drawn'
  const canUno = !spectator && !state.over && hand.length === 1 && !saidUno.includes(me)
  const challengeMe = phase === 'challenge' && state.challenge?.victim === me && !spectator && !reveal
  const ch = CHALLENGE[(state.challenge?.kind ?? 'wild4') as Kind]
  const named: string = state.challenge?.named ?? ''
  const startColorMe = phase === 'start_color' && myTurn
  const showColor = (pending?.needColor ?? false) || (startColorMe && !pending)
  const showTarget = !!pending && !pending.needColor && pending.needTarget

  const fan = hand.length
  const spread = Math.min(7, 70 / Math.max(fan, 1))
  const dirSpin = state.direction === 1 ? 'cw' : 'ccw'
  const banner = state.over ? 'Round over' :
    phase === 'challenge' ? (challengeMe ? `${ch?.short ?? '+4'}: challenge it?` : `${name(state.challenge?.victim)} is deciding…`) :
    phase === 'start_color' ? (myTurn ? (state.flipPick ? 'Name the colour' : 'Pick the starting colour') : `${name(state.turn)} picks a colour`) :
    myTurn ? (phase === 'drawn' ? 'Play it or pass' : 'Your turn!') : `${name(state.turn)}'s turn`

  const meP = room.players.find((x) => x.id === me)
  const topLabel = top ? (top.kind === 'number' ? `${top.color} ${top.value}` : `${KIND_NAME[top.kind]}${top.color === 'wild' ? '' : ` · ${top.color}`}`) : ''

  return (
    <Side.Provider value={side}>
    <div ref={root} className={`uno ${myTurn ? 'my-turn' : ''} seats-${others.length} ${side === 'dark' ? 'uno-dark' : ''}`} style={{ ['--active' as string]: HEX[state.color] ?? '#1d3a6e' }}>
      {/* opponents sit around the far edge of the table, on an arc */}
      <div className="uno-opps">
        {others.map((pid, i) => {
          const p = room.players.find((x) => x.id === pid)
          const n = counts[pid] ?? 0
          const turn = state.turn === pid && !state.over
          const place = places[pid]
          const quit = gone.includes(pid)
          const mid = (others.length - 1) / 2
          const off = mid ? (i - mid) / mid : 0
          return (
            <div key={pid} data-pid={pid} data-player={pid} className={`uno-opp ${turn ? 'turn' : ''} ${place ? 'uno-opp-out' : ''} ${quit ? 'uno-opp-quit' : ''}`}
              style={{ ['--pc' as string]: playerHex(room, pid), ['--lift' as string]: `${(1 - off * off) * -1}`, ['--tilt' as string]: `${off * 8}deg` }}>
              <div className="uno-opp-fan">
                {Array.from({ length: Math.min(n, 7) }, (_, k) => k).map((k, _, all) => {
                  const st = { transform: `rotate(${(k - (all.length - 1) / 2) * 9}deg)` }
                  const far = backs?.[pid]?.[k]
                  return far ? <UnoCard key={k} card={far} dataId={-1} dark={side === 'light'} style={st} /> : <UnoBack key={k} style={st} />
                })}
                {place && <span className="uno-opp-place display">{ordinal(place)}</span>}
              </div>
              <div className="uno-opp-av">
                <Avatar config={p?.avatar} size={others.length >= 3 ? 46 : 58} track="none" expression={place || n <= 1 ? 'happy' : turn ? 'focus' : 'idle'} />
                {!place && !quit && <span className="uno-opp-n">{n}</span>}
              </div>
              <b className="uno-opp-name">{p?.name ?? '…'}</b>
              {saidUno.includes(pid) && n === 1 && <em className="uno-said">UNO!</em>}
              {state.over && state.hands?.[pid] && (
                <div className="uno-reveal">
                  {(state.hands[pid] as Card[]).map((c) => <UnoCard key={c.id} card={c} className="tiny" />)}
                </div>
              )}
              {vulnerable.includes(pid) && !spectator && (
                <button className="uno-catch display" data-cursor="Catch!" onClick={() => catchOut(pid)}>Catch! <small>forgot UNO</small></button>
              )}
            </div>
          )
        })}
      </div>

      {/* the felt: direction ring, piles, banner and the live colour */}
      <div className="uno-table">
        <svg className={`uno-ring ${dirSpin}`} viewBox="-220 -110 440 220" preserveAspectRatio="none">
          <rect x="-206" y="-96" width="412" height="192" rx="96" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="18 14" strokeLinecap="round" />
          {/* big chevrons ride round the rim the way play is going; key on direction so they restart on a Reverse */}
          <g key={state.direction} className="uno-arrows">
            {Array.from({ length: 4 }, (_, i) => (
              <g key={i}>
                <path d="M-6 -8 L4 0 L-6 8" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* the path itself runs the way of play, so rotate="auto" points the chevrons forward */}
                <animateMotion dur="16s" begin={`${-i * 4}s`} repeatCount="indefinite" rotate="auto"
                  path={state.direction === 1
                    ? 'M0 -96 H110 A96 96 0 0 1 110 96 H-110 A96 96 0 0 1 -110 -96 Z'
                    : 'M0 -96 H-110 A96 96 0 0 0 -110 96 H110 A96 96 0 0 0 110 -96 Z'} />
              </g>
            ))}
          </g>
        </svg>
        <TurnBanner state={state} me={me} players={players} spectator={spectator} text={banner} />
        <div className="uno-center">
          <button className={`uno-draw ${canDraw ? 'live' : ''}`} data-cursor={canDraw ? 'Draw' : undefined} disabled={!canDraw}
            onClick={() => { sfx.card(); act({ type: 'draw' }) }}>
            {[3, 2, 1, 0].map((i) => (i === 0 && state.pileBack
              ? <UnoCard key={i} card={state.pileBack} dataId={-1} dark={side === 'light'} />
              : <UnoBack key={i} style={{ transform: `translate(${i * 2}px, ${i * -2}px)` }} />))}
            <span className="uno-draw-n">{state.drawCount}</span>
            {canDraw && <span className="uno-draw-hint display">Draw</span>}
          </button>
          <div className="uno-pile" onClick={() => { const t = pile[pile.length - 1]; if (t) showTip(t.card, t.card.color === 'wild' ? state.color : undefined) }}>
            {pile.map((p, i) => (
              <UnoCard key={`${p.card.id}-${i}`} card={p.card} chosen={p.card.color === 'wild' ? p.color : undefined}
                className={p.card.color === 'wild' && p.color ? 'chosen' : ''}
                style={{ transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`, zIndex: i }} />
            ))}
          </div>
        </div>
        {top && (
          <div className="uno-colorchip" title="current colour">
            <i style={{ background: HEX[state.color] ?? '#ccc' }} />
            <span>{topLabel}</span>
            <em className={`uno-dir ${dirSpin}`} title="direction of play">
              <svg viewBox="0 0 24 24" aria-hidden><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" /></svg>
              {state.direction === 1 ? 'clockwise' : 'anticlockwise'}
            </em>
            {state.flip && <em className={`uno-side ${side}`}>{side} side</em>}
          </div>
        )}
      </div>

      {/* my seat: who I am, the big UNO button, pass */}
      {!spectator && (
        <div className={`uno-me ${myTurn ? 'turn' : ''}`} data-player={me} style={{ ['--pc' as string]: playerHex(room, me) }}>
          <div className="uno-me-plate">
            <Avatar config={meP?.avatar} size={44} track="none" expression={hand.length <= 1 ? 'happy' : myTurn ? 'focus' : 'idle'} />
            <div>
              <b>{meP?.name ?? 'You'}</b>
              <span>{hand.length} card{hand.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          {canPass && <button className="uno-btn uno-pass display" onClick={() => { sfx.click(); act({ type: 'pass' }) }}>Pass</button>}
          <button className={`uno-call display ${canUno ? 'hot' : ''}`} disabled={!canUno} data-cursor="UNO!"
            onClick={() => act({ type: 'uno' })}><span>UNO!</span></button>
        </div>
      )}

      {!spectator && (
        <div className="uno-hand" style={{ ['--n' as string]: fan }}>
          {hand.map((c, i) => {
            const mid = (fan - 1) / 2
            const ok = myTurn && playable.has(c.id)
            const drawn = state.drawnId === c.id
            return (
              <div key={c.id} className="uno-slot" style={{ ['--r' as string]: `${(i - mid) * spread * 0.6}deg`, ['--y' as string]: `${Math.abs(i - mid) ** 1.6 * 1.4}px`, zIndex: i }}>
                <UnoCard card={c} className={`${ok ? 'ok' : myTurn ? 'no' : ''} ${drawn ? 'drawn' : ''}`} onClick={() => clickCard(c)} />
              </div>
            )
          })}
        </div>
      )}

      {(showColor || showTarget || challengeMe) && (
        <div className="uno-modal" onClick={(e) => { if (e.target === e.currentTarget && pending) { sfx.close(); setPending(null) } }}>
          {showColor && (
            <div className="uno-picker">
              <h3 className="display">{startColorMe ? (state.flipPick ? 'Flip turned up a Wild' : 'Starting colour') : 'Pick a colour'}</h3>
              <div className="uno-wheel">
                {palette.map((c, i) => (
                  <button key={c} className={`uno-wedge w${i}`} style={{ background: HEX[c] }} data-cursor={c} onClick={() => pickColor(c)}>
                    <span>{c}</span>
                  </button>
                ))}
                {pending && <UnoCard card={pending.card} className="uno-wheel-card" />}
              </div>
              {pending && <button className="uno-cancel" onClick={() => { sfx.close(); setPending(null) }}>cancel</button>}
            </div>
          )}
          {showTarget && (
            <div className="uno-picker">
              <h3 className="display">Swap hands with…</h3>
              <div className="uno-targets">
                {others.map((pid) => {
                  const p = room.players.find((x) => x.id === pid)
                  return (
                    <button key={pid} className="uno-target" style={{ ['--pc' as string]: playerHex(room, pid) }} onClick={() => pickTarget(pid)}>
                      <Avatar config={p?.avatar} size={84} badge track="none" expression="shock" />
                      <b className="display">{p?.name}</b>
                      <span>{counts[pid]} cards</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {challengeMe && ch && (
            <div className="uno-picker">
              <h3 className="display">{name(state.challenge.from)} hit you with {ch.short}</h3>
              <p>
                The colour was <b className="uno-swatch" style={{ ['--sw' as string]: HEX[state.challenge.color] ?? '#1d3a6e' }}>{state.challenge.color}</b>.{' '}
                {state.challenge.rule === 'color'
                  ? <>Think they were holding a <b>{state.challenge.color}</b> card?</>
                  : <>Think they had <b>any other card they could play</b> (same colour, number or symbol)?</>}
              </p>
              {state.challenge.kind === 'wildcolor' && (
                <p>Take it and you draw until you get a <b className="uno-swatch" style={{ ['--sw' as string]: HEX[named] ?? '#1d3a6e' }}>{named}</b> card.</p>
              )}
              <p className="uno-stakes">Challenge: if they bluffed, {ch.bluff(named)}. If not, {ch.wrong(named)}, and you'll see their hand as proof.</p>
              <div className="uno-choice">
                <button className="uno-btn display" onClick={() => { sfx.click(); act({ type: 'accept' }) }}>{ch.take(named)}</button>
                <button className="uno-btn hot display" onClick={() => { sfx.slam(); act({ type: 'challenge' }) }}>Challenge!</button>
              </div>
            </div>
          )}
        </div>
      )}

      {catchable.length > 0 && (
        <div className="uno-catchbar">
          {catchable.map((pid) => (
            <button key={pid} className="uno-catch-big display" data-cursor="Catch!" onClick={() => catchOut(pid)}
              style={{ ['--pc' as string]: playerHex(room, pid) }}>
              <Avatar config={room.players.find((x) => x.id === pid)?.avatar} size={44} track="none" expression="shock" />
              <span>Catch {name(pid)}!<small>forgot to call UNO · +2 for them</small></span>
            </button>
          ))}
        </div>
      )}

      {reveal && (
        <div className="uno-modal" onClick={() => setReveal(null)}>
          <div className={`uno-picker uno-revealed ${reveal.guilty ? 'guilty' : 'clean'}`}>
            <h3 className="display">{reveal.guilty ? 'Caught bluffing!' : 'No bluff'}</h3>
            <p>{name(reveal.of)}{reveal.of === me ? ' were' : '’s'} hand when the {CHALLENGE[reveal.kind ?? 'wild4']?.short ?? '+4'} landed on <b className="uno-swatch" style={{ ['--sw' as string]: HEX[reveal.color] ?? '#1d3a6e' }}>{reveal.color}</b>:</p>
            <div className="uno-revealed-cards">
              {reveal.cards.map((c) => <UnoCard key={c.id} card={c} className={reveal.bad.includes(c.id) ? 'uno-bad' : 'uno-meh'} />)}
              {!reveal.cards.length && <em>no cards</em>}
            </div>
            <span className="uno-stakes">{reveal.guilty ? `${reveal.bad.length} card${reveal.bad.length === 1 ? '' : 's'} could have been played instead` : 'nothing else in that hand could have been played'} · tap to close</span>
          </div>
        </div>
      )}

      {callout && (
        <div key={callout.key} className={`uno-callout ${callout.big ? 'big' : ''}`} style={{ ['--co' as string]: callout.color }}>
          <b className="display">{callout.text}</b>
          {callout.sub && <span>{callout.sub}</span>}
        </div>
      )}

      {tip && (() => {
        const r = ruleOf(tip.card, state.players.length, tip.color)
        return r && (
          <button key={tip.key} className="uno-tip" onClick={() => { clearTimeout(tipTimer.current); setTip(null) }} aria-label="Dismiss card rule">
            <UnoCard card={tip.card} chosen={tip.color} className={tip.color ? 'chosen' : ''} dataId={-1} />
            <span><b className="display">{r.name}</b>{r.text}</span>
          </button>
        )
      })()}

      <div className="uno-fly" />
    </div>
    </Side.Provider>
  )
}

function nextOf(st: any, pid: string, k: number): string {
  const i = st.players.indexOf(pid)
  const n = st.players.length
  return st.players[(((i + st.direction * k) % n) + n) % n]
}
