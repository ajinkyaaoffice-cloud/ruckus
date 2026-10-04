import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { TurnBanner } from './shared'
import './Checkers.css'

const N = 8, S = 100
type Piece = { o: number; k: boolean } | null

export default function Checkers({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const board: Piece[] = state.board
  const order: string[] = state.order
  const moves: Record<string, number[]> = state.moves
  const last: number[] = state.last
  const myTurn = state.turn === me && !state.over && !spectator
  const flip = order[1] === me          // everyone sees their own pieces at the bottom
  const [sel, setSel] = useState<number | null>(null)
  const chain: number | null = state.chain

  // during a multi-jump the jumping piece stays picked up
  const active = myTurn ? (chain ?? sel) : null
  const targets = active != null ? moves[String(active)] ?? [] : []

  const pos = (cell: number) => {
    const v = flip ? N * N - 1 - cell : cell
    return { x: (v % N) * S, y: Math.floor(v / N) * S }
  }

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.ck-board', ...intro({ y: 200, rotate: 5, duration: 0.9, ease: 'back.out(1.5)', delay: 0.7 }))
      gsap.fromTo('.ck-piece', ...intro({ scale: 0, transformOrigin: '50% 50%', duration: 0.4, ease: 'back.out(3)', stagger: 0.02, delay: 1.1 }))
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => { if (!myTurn) setSel(null) }, [myTurn])

  // slide the piece that just moved, from where it came from
  useLayoutEffect(() => {
    if (last.length !== 2) return
    const [a, b] = last
    const el = root.current!.querySelector(`.ck-piece[data-cell="${b}"]`)
    const pa = pos(a), pb = pos(b)
    if (el) gsap.fromTo(el, { x: pa.x - pb.x, y: pa.y - pb.y }, { x: 0, y: 0, duration: 0.35, ease: 'power3.out' })
  }, [last.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) if (e.kind === 'move') {
      setTimeout(() => {
        if (e.captured != null) sfx.hit(0.8); else sfx.place()
        if (e.crowned) {
          sfx.uno()
          const el = root.current?.querySelector(`.ck-piece[data-cell="${e.to}"] .ck-crown`)
          if (el) gsap.fromTo(el, { scale: 0, rotate: -40, transformOrigin: '50% 50%', transformBox: 'fill-box' }, { scale: 1, rotate: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' })
        }
        if (e.captured != null) {
          const p = pos(e.captured)
          const poof = root.current?.querySelector<SVGCircleElement>('.ck-poof')
          if (poof) {
            poof.setAttribute('cx', String(p.x + S / 2)); poof.setAttribute('cy', String(p.y + S / 2))
            gsap.fromTo(poof, { attr: { r: 10 }, opacity: 1 }, { attr: { r: 60 }, opacity: 0, duration: 0.45, ease: 'power2.out' })
          }
        }
      }, 300)
    }
  }), [flip]) // eslint-disable-line react-hooks/exhaustive-deps

  const click = (cell: number) => {
    if (!myTurn) return
    if (active != null && targets.includes(cell)) {
      act({ type: 'move', from: active, to: cell })
      setSel(null)
      return
    }
    if (chain != null) return
    if (moves[String(cell)]) { sfx.tap(); setSel(cell) }
    else if (board[cell] && order[board[cell]!.o] === me) { sfx.bad(); gsap.fromTo(root.current!.querySelector('.ck-hint'), { scale: 1.2 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }) }
  }

  const movable = myTurn && chain == null ? Object.keys(moves).map(Number) : []
  const mustJump = myTurn && Object.entries(moves).some(([f, ts]) => ts.some((t) => Math.abs(t - Number(f)) > 9))
  const counts = order.map((_, i) => board.filter((p) => p?.o === i).length)

  return (
    <div ref={root} className="ck">
      <TurnBanner state={state} me={me} players={players} spectator={spectator}
        text={state.over ? 'Game over' : myTurn ? (chain != null ? 'Keep jumping!' : 'Your move!') : undefined} />
      <div className="ck-wrap">
        <svg viewBox={`-14 -14 ${N * S + 28} ${N * S + 28}`} className="ck-board">
          <rect x="-14" y="-14" width={N * S + 28} height={N * S + 28} rx="30" fill="#1d3a6e" />
          {Array.from({ length: N * N }, (_, cell) => {
            const { x, y } = pos(cell)
            const dark = (Math.floor(cell / N) + (cell % N)) % 2 === 1
            const isTarget = targets.includes(cell)
            const isLast = last.includes(cell)
            return (
              <g key={cell} onClick={() => click(cell)} className={dark && (isTarget || movable.includes(cell)) ? 'ck-click' : ''}>
                <rect x={x} y={y} width={S} height={S} fill={dark ? (isLast ? '#e94a66' : '#ff5d73') : '#ffe3ea'} />
                {isTarget && <circle className="ck-target" cx={x + S / 2} cy={y + S / 2} r="16" fill="#fff" />}
              </g>
            )
          })}
          {board.map((p, cell) => {
            if (!p) return null
            const { x, y } = pos(cell)
            const c = playerHex(room, order[p.o])
            const lifted = active === cell
            const can = movable.includes(cell) && !lifted
            return (
              <g key={cell} data-cell={cell} className={`ck-piece ${lifted ? 'lifted' : ''} ${can ? 'can' : ''}`} onClick={() => click(cell)}>
                <circle cx={x + S / 2} cy={y + S / 2 + 6} r="38" fill="#000" opacity="0.25" />
                <circle cx={x + S / 2} cy={y + S / 2} r="38" fill={c} />
                <circle cx={x + S / 2} cy={y + S / 2} r="26" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="5" />
                {p.k && (
                  <path className="ck-crown" d={`M${x + 30} ${y + 62} L${x + 26} ${y + 36} L${x + 40} ${y + 48} L${x + 50} ${y + 30} L${x + 60} ${y + 48} L${x + 74} ${y + 36} L${x + 70} ${y + 62}Z`}
                    fill="#ffb424" stroke="#1d3a6e" strokeWidth="4" strokeLinejoin="round" />
                )}
              </g>
            )
          })}
          <circle className="ck-poof" r="0" fill="none" stroke="#fff" strokeWidth="8" opacity="0" />
        </svg>
      </div>
      <div className="ck-legend">
        {order.map((pid, i) => (
          <span key={pid} className={`display ${pid === me ? 'me' : ''}`}>
            <i style={{ background: playerHex(room, pid) }} />{room.players.find((p) => p.id === pid)?.name} · {counts[i]}
          </span>
        ))}
      </div>
      <p className="ck-hint">{mustJump ? 'A jump is on the board — you have to take it!' : state.quiet >= 30 ? `${40 - state.quiet} quiet moves until a draw` : ' '}</p>
    </div>
  )
}
