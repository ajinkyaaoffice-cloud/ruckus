import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { TurnBanner } from './shared'
import './Reversi.css'

const N = 8, S = 100

export default function Reversi({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const board: (number | null)[] = state.board
  const order: string[] = state.order
  const moves: number[] = state.moves
  const count: number[] = state.count
  const myTurn = state.turn === me && !state.over && !spectator
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '…'

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.rv-board', ...intro({ scale: 0.6, rotate: -6, duration: 0.9, ease: 'back.out(1.6)', delay: 0.7 }))
      gsap.fromTo('.rv-disc', ...intro({ scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(3)', stagger: 0.08, delay: 1.2 }))
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) {
      if (e.kind === 'place') {
        sfx.place()
        requestAnimationFrame(() => {
          const q = (c: number) => root.current?.querySelector(`.rv-disc[data-cell="${c}"]`)
          const placed = q(e.cell)
          if (placed) gsap.fromTo(placed, { scale: 1.6, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.5)' })
          // flips ripple outward from the new disc
          ;(e.flipped as number[]).forEach((c) => {
            const d = Math.max(Math.abs((c % N) - (e.cell % N)), Math.abs(Math.floor(c / N) - Math.floor(e.cell / N)))
            const el = q(c)
            if (el) gsap.fromTo(el, { scaleX: -1, transformOrigin: '50% 50%' }, { scaleX: 1, duration: 0.4, ease: 'power2.out', delay: 0.06 * d, onStart: () => sfx.card() })
          })
        })
      }
      if (e.kind === 'skip') sfx.bad()
    }
  }), [])

  const place = (c: number) => {
    if (!myTurn || !moves.includes(c)) return
    act({ type: 'place', cell: c })
  }

  return (
    <div ref={root} className="rv">
      <TurnBanner state={state} me={me} players={players} spectator={spectator} />
      <div className="rv-score">
        {order.map((pid, i) => (
          <span key={pid} className={`display ${state.turn === pid && !state.over ? 'on' : ''}`} style={{ background: playerHex(room, pid) }}>
            {name(pid)} <b>{count[i]}</b>
          </span>
        ))}
      </div>
      <div className="rv-wrap">
        <svg viewBox={`-16 -16 ${N * S + 32} ${N * S + 32}`} className="rv-board">
          <rect x="-16" y="-16" width={N * S + 32} height={N * S + 32} rx="32" fill="#1d3a6e" />
          <rect x="0" y="0" width={N * S} height={N * S} rx="14" fill="#2fbf8f" />
          {Array.from({ length: N - 1 }, (_, i) => (
            <path key={i} d={`M${(i + 1) * S} 0 V${N * S} M0 ${(i + 1) * S} H${N * S}`} stroke="#1d3a6e" strokeOpacity="0.35" strokeWidth="4" />
          ))}
          {[[2, 2], [6, 2], [2, 6], [6, 6]].map(([x, y]) => <circle key={`${x}${y}`} cx={x * S} cy={y * S} r="8" fill="#1d3a6e" opacity="0.5" />)}
          {myTurn && moves.map((c) => (
            <circle key={`m${c}`} className="rv-hint" cx={(c % N) * S + S / 2} cy={Math.floor(c / N) * S + S / 2} r="14" fill={playerHex(room, me)} />
          ))}
          {board.map((v, c) => v == null ? null : (
            <g key={c} data-cell={c} className="rv-disc" style={{ transformOrigin: `${(c % N) * S + S / 2}px ${Math.floor(c / N) * S + S / 2}px` }}>
              <circle cx={(c % N) * S + S / 2} cy={Math.floor(c / N) * S + S / 2 + 5} r="38" fill="#000" opacity="0.22" />
              <circle cx={(c % N) * S + S / 2} cy={Math.floor(c / N) * S + S / 2} r="38" fill={playerHex(room, order[v])} />
              <path d={`M${(c % N) * S + 28} ${Math.floor(c / N) * S + 40} A24 24 0 0 1 ${(c % N) * S + 46} ${Math.floor(c / N) * S + 26}`}
                stroke="#fff" strokeOpacity="0.55" strokeWidth="6" fill="none" strokeLinecap="round" />
              {state.last === c && <circle cx={(c % N) * S + S / 2} cy={Math.floor(c / N) * S + S / 2} r="8" fill="#fff" />}
            </g>
          ))}
          {Array.from({ length: N * N }, (_, c) => (
            <rect key={`t${c}`} x={(c % N) * S} y={Math.floor(c / N) * S} width={S} height={S} fill="transparent"
              style={{ cursor: myTurn && moves.includes(c) ? 'pointer' : 'default' }} onClick={() => place(c)} />
          ))}
        </svg>
      </div>
      <p className="rv-note">{state.skipped ? `${name(state.skipped)} had no move — skipped!` : myTurn ? 'Trap their discs between yours to flip them.' : ' '}</p>
    </div>
  )
}
