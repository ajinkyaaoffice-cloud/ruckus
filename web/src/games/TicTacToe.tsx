import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { TurnBanner, useDrawOn } from './shared'
import './TicTacToe.css'

const CENTER = (i: number) => [((i % 3) + 0.5) * 100, (Math.floor(i / 3) + 0.5) * 100]

export default function TicTacToe({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const board: (number | null)[] = state.board
  const order: string[] = state.players
  const myTurn = state.turn === me && !state.over && !spectator
  const [hover, setHover] = useState<number | null>(null)
  const myMark = order.indexOf(me)

  useDrawOn(root, '.ttt-grid path', { duration: 0.7, stagger: 0.12, delay: 0.9 })

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) if (e.kind === 'place') {
      sfx.place()
      gsap.fromTo(root.current!.querySelector('.ttt-board'), { rotate: e.mark ? 1.2 : -1.2 }, { rotate: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' })
    }
  }), [])

  useLayoutEffect(() => {
    if (!state.line) return
    const p = root.current!.querySelector<SVGPathElement>('.ttt-win')
    if (!p) return
    const l = p.getTotalLength()
    gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 0.6, ease: 'power3.inOut', delay: 0.35 })
    gsap.to(root.current!.querySelectorAll('.ttt-cell.win'), { scale: 1.15, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut', delay: 0.5, transformOrigin: '50% 50%' })
  }, [state.line])

  const place = (i: number) => {
    if (!myTurn || board[i] !== null) return
    act({ type: 'place', cell: i })
  }

  const line: number[] | null = state.line
  const [a, , c] = line ?? []
  const [x1, y1] = line ? CENTER(a) : [0, 0]
  const [x2, y2] = line ? CENTER(c) : [0, 0]
  const ext = 0.32
  const lx1 = x1 - (x2 - x1) * ext, ly1 = y1 - (y2 - y1) * ext, lx2 = x2 + (x2 - x1) * ext, ly2 = y2 + (y2 - y1) * ext

  return (
    <div ref={root} className="ttt">
      <TurnBanner state={state} me={me} players={players} spectator={spectator} />
      <div className="ttt-board">
        <svg viewBox="0 0 300 300" className="ttt-svg">
          <defs>
            <filter id="ttt-rough"><feTurbulence type="fractalNoise" baseFrequency="0.04 0.4" numOctaves="2" seed="4" /><feDisplacementMap in="SourceGraphic" scale="6" /></filter>
          </defs>
          <g className="ttt-grid" filter="url(#ttt-rough)" stroke="#fff" strokeWidth="9" strokeLinecap="round" fill="none">
            <path d="M102 8 C98 100 104 200 98 292" />
            <path d="M200 6 C204 110 196 200 202 294" />
            <path d="M8 98 C100 104 200 96 292 102" />
            <path d="M6 202 C110 196 200 206 294 198" />
          </g>
          {board.map((v, i) => {
            const [cx, cy] = CENTER(i)
            const win = line?.includes(i)
            return (
              <g key={i} className={`ttt-cell ${win ? 'win' : ''}`} onClick={() => place(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                style={{ cursor: myTurn && v === null ? 'pointer' : 'default' }}>
                <rect x={cx - 50} y={cy - 50} width="100" height="100" fill="transparent" />
                {v !== null && <Mark kind={v} cx={cx} cy={cy} color={playerHex(room, order[v])} />}
                {v === null && myTurn && hover === i && <Mark kind={myMark} cx={cx} cy={cy} color={playerHex(room, me)} ghost />}
              </g>
            )
          })}
          {line && <path className="ttt-win" d={`M${lx1} ${ly1} L${lx2} ${ly2}`} stroke="#1d3a6e" strokeWidth="16" strokeLinecap="round" filter="url(#ttt-rough)" />}
        </svg>
      </div>
      <div className="ttt-legend">
        {order.map((pid, i) => (
          <span key={pid} style={{ color: playerHex(room, pid) }} className="display">
            {'XO'[i]} · {room.players.find((p) => p.id === pid)?.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function Mark({ kind, cx, cy, color, ghost }: { kind: number; cx: number; cy: number; color: string; ghost?: boolean }) {
  const ref = useRef<SVGGElement>(null)
  useLayoutEffect(() => {
    if (ghost) return
    const paths = ref.current!.querySelectorAll('path')
    paths.forEach((p, i) => {
      const l = p.getTotalLength()
      gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 0.32, delay: i * 0.18, ease: 'power2.out' })
    })
    gsap.from(ref.current, { scale: 1.4, rotate: kind ? 60 : -20, duration: 0.6, ease: 'back.out(2)', transformOrigin: `${cx}px ${cy}px` })
  }, [ghost, kind, cx, cy])
  const r = 30
  return (
    <g ref={ref} opacity={ghost ? 0.3 : 1} filter="url(#ttt-rough)" stroke={color} strokeWidth="15" strokeLinecap="round" fill="none" pointerEvents="none">
      {kind === 0 ? (
        <>
          <path d={`M${cx - r} ${cy - r} L${cx + r} ${cy + r}`} />
          <path d={`M${cx + r} ${cy - r} L${cx - r} ${cy + r}`} />
        </>
      ) : (
        <path d={`M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.1} ${cy - r}`} />
      )}
    </g>
  )
}
