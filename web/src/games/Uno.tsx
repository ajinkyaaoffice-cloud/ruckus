import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import Avatar from '../components/Avatar'
import { TurnBanner } from './shared'
import './Uno.css'

type Color = 'red' | 'yellow' | 'green' | 'blue' | 'wild'
type Kind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4' | 'swap' | 'custom'
export type Card = { id: number; color: Color; kind: Kind; value: number | null }

const COLORS = ['red', 'yellow', 'green', 'blue'] as const
export const HEX: Record<string, string> = { red: '#ff5d73', yellow: '#ffc93c', green: '#43d17a', blue: '#3d8bff', wild: '#1b1f3f' }
const WILDS: Kind[] = ['wild', 'wild4', 'swap', 'custom']
const KIND_NAME: Record<Kind, string> = { number: '', skip: 'Skip', reverse: 'Reverse', draw2: 'Draw Two', wild: 'Wild', wild4: 'Wild Draw Four', swap: 'Swap Hands', custom: 'Everyone +2' }

/* ---------- card art ---------- */

function Glyph({ card }: { card: Card }): ReactElement {
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
      return <text dy="0.36em" textAnchor="middle" className="uc-num" style={{ fontSize: 34 }}>+2</text>
    case 'wild4':
    case 'wild':
    case 'custom':
    case 'swap': {
      const label = card.kind === 'wild4' ? '+4' : card.kind === 'custom' ? '+2·all' : card.kind === 'swap' ? '⇄' : ''
      return (
        <g>
          <g transform="rotate(-25) scale(0.85 1.15)">
            <path d="M0 0 L0 -20 A20 20 0 0 1 20 0Z" fill={HEX.red} />
            <path d="M0 0 L20 0 A20 20 0 0 1 0 20Z" fill={HEX.green} />
            <path d="M0 0 L0 20 A20 20 0 0 1 -20 0Z" fill={HEX.yellow} />
            <path d="M0 0 L-20 0 A20 20 0 0 1 0 -20Z" fill={HEX.blue} />
          </g>
          {label && <text dy="0.36em" textAnchor="middle" className="uc-num uc-wl" style={{ fontSize: label.length > 2 ? 15 : 24 }}>{label}</text>}
        </g>
      )
    }
  }
}

function corner(card: Card): string {
  if (card.kind === 'number') return String(card.value)
  return { skip: '⊘', reverse: '⇅', draw2: '+2', wild: 'W', wild4: '+4', swap: '⇄', custom: '★' }[card.kind] ?? ''
}

export function UnoCard({ card, chosen, className = '', style, onClick, dataId }: {
  card: Card; chosen?: string; className?: string; style?: CSSProperties; onClick?: () => void; dataId?: number
}) {
  const bg = HEX[card.color]
  return (
    <div className={`uc ${className}`} data-id={dataId ?? card.id} style={{ ...style, ['--cc' as string]: bg, ['--chosen' as string]: chosen ? HEX[chosen] : 'transparent' }} onClick={onClick}>
      <svg viewBox="-40 -60 80 120" className="uc-svg">
        <rect x="-40" y="-60" width="80" height="120" rx="10" fill="#fff" />
        <rect x="-35" y="-55" width="70" height="110" rx="7" fill={bg} />
        <ellipse rx="27" ry="44" transform="rotate(28)" fill="#fff" />
        <g color={bg} style={{ color: bg }} fill={bg}>
          <Glyph card={card} />
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
type Callout = { text: string; sub?: string; color: string; key: number }

export default function Uno({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const hand: Card[] = state.hand ?? []
  const order: string[] = state.players
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

  const [pending, setPending] = useState<Pending | null>(null)
  const [callout, setCallout] = useState<Callout | null>(null)
  const [pile, setPile] = useState<{ card: Card; rot: number; x: number; y: number; color: string }[]>(() => [{ card: top, rot: -4, x: 0, y: 0, color: state.color }])

  // FLIP bookkeeping
  const lastPlayRect = useRef<DOMRect | null>(null)
  const playFrom = useRef<string | null>(null)
  const swapFrom = useRef<string | null>(null)
  const knownHand = useRef<Set<number>>(new Set(hand.map((c) => c.id)))
  const calloutTimer = useRef<number | undefined>(undefined)

  const shout = (text: string, color = '#1d3a6e', sub?: string) => {
    setCallout({ text, color, sub, key: Date.now() + Math.random() })
    clearTimeout(calloutTimer.current)
    calloutTimer.current = window.setTimeout(() => setCallout(null), 1500)
  }

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
          else if (c.kind === 'reverse') shout(st.players.length === 2 ? 'Skip!' : 'Reverse!', HEX[c.color], st.players.length === 2 ? 'reverse = skip with 2' : 'direction flipped')
          else if (c.kind === 'wild') shout('Wild!', HEX[e.color], `colour is ${e.color}`)
          else if (c.kind === 'wild4') shout('+4?!', HEX[e.color], `colour is ${e.color}`)
          else if (c.kind === 'draw2') sfx.slam()
          break
        }
        case 'forced_draw':
          shout(`+${e.count}`, '#ff5d73', `${name(e.pid)} ${e.pid === me ? 'draw' : 'draws'} ${e.count}`)
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
            e.guilty ? `${name(e.offender)} bluffed · +4` : `${name(e.pid)} ${e.pid === me ? 'draw' : 'draws'} 6`)
          flyBacks(e.guilty ? e.offender : e.pid, e.guilty ? 4 : 6)
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
  const canUno = !spectator && !state.over && hand.length > 0 && hand.length <= 2 && !saidUno.includes(me)
  const challengeMe = phase === 'challenge' && state.challenge?.victim === me && !spectator
  const startColorMe = phase === 'start_color' && myTurn
  const showColor = (pending?.needColor ?? false) || (startColorMe && !pending)
  const showTarget = !!pending && !pending.needColor && pending.needTarget

  const fan = hand.length
  const spread = Math.min(7, 70 / Math.max(fan, 1))
  const dirSpin = state.direction === 1 ? 'cw' : 'ccw'
  const banner = state.over ? 'Round over' :
    phase === 'challenge' ? (challengeMe ? 'Wild +4 — challenge it?' : `${name(state.challenge?.victim)} is deciding…`) :
    phase === 'start_color' ? (myTurn ? 'Pick the starting colour' : `${name(state.turn)} picks a colour`) :
    myTurn ? (phase === 'drawn' ? 'Play it or pass' : 'Your turn!') : `${name(state.turn)}'s turn`

  return (
    <div ref={root} className={`uno ${myTurn ? 'my-turn' : ''}`} style={{ ['--active' as string]: HEX[state.color] ?? '#1d3a6e' }}>
      <TurnBanner state={state} me={me} players={players} spectator={spectator} text={banner} />

      <div className={`uno-opps ${others.length >= 3 ? 'many' : ''}`}>
        {others.map((pid) => {
          const p = room.players.find((x) => x.id === pid)
          const n = counts[pid] ?? 0
          const turn = state.turn === pid && !state.over
          return (
            <div key={pid} data-pid={pid} className={`uno-opp ${turn ? 'turn' : ''}`} style={{ ['--pc' as string]: playerHex(room, pid) }}>
              <div className="uno-opp-who">
                <Avatar config={p?.avatar} size={others.length >= 3 ? 40 : 56} badge track="none" expression={n <= 1 ? 'happy' : turn ? 'focus' : 'idle'} />
                <div>
                  <b>{p?.name ?? '…'}</b>
                  <span>{n} card{n === 1 ? '' : 's'}</span>
                </div>
                {saidUno.includes(pid) && n <= 2 && <em className="uno-said">UNO!</em>}
              </div>
              <div className="uno-opp-fan">
                {Array.from({ length: Math.min(n, others.length >= 3 ? 9 : 14) }, (_, i) => i).map((i, _, all) => (
                  <UnoBack key={i} style={{ transform: `rotate(${(i - (all.length - 1) / 2) * 4}deg)`, marginLeft: i ? (others.length >= 3 ? -22 : -28) : 0 }} />
                ))}
              </div>
              {state.over && state.hands?.[pid] && (
                <div className="uno-reveal">
                  {(state.hands[pid] as Card[]).map((c) => <UnoCard key={c.id} card={c} className="tiny" />)}
                </div>
              )}
              {vulnerable.includes(pid) && !spectator && (
                <button className="uno-catch display" data-cursor="Catch!" onClick={() => { sfx.click(); act({ type: 'catch', target: pid }) }}>Catch! <small>forgot UNO</small></button>
              )}
            </div>
          )
        })}
      </div>

      <div className="uno-table">
        <svg className={`uno-ring ${dirSpin}`} viewBox="-220 -110 440 220" preserveAspectRatio="none">
          <ellipse rx="208" ry="98" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="20 14" strokeLinecap="round" />
          <path transform={`translate(208 0) ${state.direction === 1 ? '' : 'scale(1 -1)'}`} d="M-11 -4 L0 10 L11 -4 Z" fill="currentColor" />
          <path transform={`translate(-208 0) ${state.direction === 1 ? 'scale(1 -1)' : ''}`} d="M-11 -4 L0 10 L11 -4 Z" fill="currentColor" />
        </svg>
        <button className={`uno-draw ${canDraw ? 'live' : ''}`} data-cursor={canDraw ? 'Draw' : undefined} disabled={!canDraw}
          onClick={() => { sfx.card(); act({ type: 'draw' }) }}>
          {[3, 2, 1, 0].map((i) => <UnoBack key={i} style={{ transform: `translate(${i * 2}px, ${i * -2}px)` }} />)}
          <span className="uno-draw-n">{state.drawCount}</span>
          {canDraw && <span className="uno-draw-hint display">Draw</span>}
        </button>
        <div className="uno-pile">
          {pile.map((p, i) => (
            <UnoCard key={`${p.card.id}-${i}`} card={p.card} chosen={p.card.color === 'wild' ? p.color : undefined}
              className={p.card.color === 'wild' && p.color ? 'chosen' : ''}
              style={{ transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`, zIndex: i }} />
          ))}
        </div>
        <div className="uno-colorchip" title="current colour">
          <i style={{ background: HEX[state.color] ?? '#ccc' }} />
          <span>{state.color || '—'}</span>
        </div>
      </div>

      {!spectator && (
        <div className="uno-actions">
          <button className={`uno-btn uno-call display ${canUno ? 'hot' : ''}`} disabled={!canUno} data-cursor="UNO!"
            onClick={() => act({ type: 'uno' })}>UNO!</button>
          {canPass && <button className="uno-btn display" onClick={() => { sfx.click(); act({ type: 'pass' }) }}>Keep it · pass</button>}
          {top && <span className="uno-top-name">on top: <b style={{ background: HEX[state.color] ?? '#1d3a6e' }}>{top.kind === 'number' ? `${top.color} ${top.value}` : `${KIND_NAME[top.kind]}${top.color === 'wild' ? '' : ` (${top.color})`}`}</b></span>}
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
              <h3 className="display">{startColorMe ? 'Starting colour' : 'Pick a colour'}</h3>
              <div className="uno-wheel">
                {COLORS.map((c, i) => (
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
          {challengeMe && (
            <div className="uno-picker">
              <h3 className="display">{name(state.challenge.from)} hit you with +4</h3>
              <p>Think they had a <b style={{ color: HEX[pile[pile.length - 2]?.color ?? 'red'] }}>matching colour</b>? Challenge: if they bluffed, they draw 4 and you go. If not, you draw 6.</p>
              <div className="uno-choice">
                <button className="uno-btn display" onClick={() => { sfx.click(); act({ type: 'accept' }) }}>Take the 4</button>
                <button className="uno-btn hot display" onClick={() => { sfx.slam(); act({ type: 'challenge' }) }}>Challenge!</button>
              </div>
            </div>
          )}
        </div>
      )}

      {callout && (
        <div key={callout.key} className="uno-callout" style={{ ['--co' as string]: callout.color }}>
          <b className="display">{callout.text}</b>
          {callout.sub && <span>{callout.sub}</span>}
        </div>
      )}

      <div className="uno-fly" />
    </div>
  )
}

function nextOf(st: any, pid: string, k: number): string {
  const i = st.players.indexOf(pid)
  const n = st.players.length
  return st.players[(((i + st.direction * k) % n) + n) % n]
}
