import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { TurnBanner } from './shared'
import './ConnectFour.css'

const COLS = 7, ROWS = 6, S = 100, TOP = 100

export default function ConnectFour({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const grid: (number | null)[][] = state.grid
  const order: string[] = state.order
  const win: [number, number][] = state.win ?? []
  const myTurn = state.turn === me && !state.over && !spectator
  const [hover, setHover] = useState<number | null>(null)
  const myIdx = order.indexOf(me)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.c4-frame', ...intro({ y: 300, rotate: 6, duration: 0.9, ease: 'back.out(1.6)', delay: 0.8 }))
      gsap.fromTo('.c4-leg', ...intro({ scaleY: 0, transformOrigin: '50% 0%', duration: 0.5, ease: 'back.out(3)', delay: 1.4, stagger: 0.1 }))
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) if (e.kind === 'drop') {
      // Board wobbles once the disc lands.
      const land = 0.18 + e.row * 0.07
      setTimeout(() => {
        sfx.place()
        gsap.fromTo(root.current!.querySelector('.c4-frame'), { rotate: (e.col - 3) * 0.5, y: 6 }, { rotate: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.35)' })
      }, land * 1000)
    }
  }), [])

  useLayoutEffect(() => {
    if (!win.length) return
    const cells = root.current!.querySelectorAll('.c4-disc.win')
    gsap.to(cells, { scale: 1.18, duration: 0.28, yoyo: true, repeat: 5, ease: 'sine.inOut', transformOrigin: '50% 50%', delay: 0.5, stagger: 0.06 })
    const p = root.current!.querySelector<SVGPathElement>('.c4-winline')
    if (p) {
      const l = p.getTotalLength()
      gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 0.6, ease: 'power3.inOut', delay: 0.6 })
    }
  }, [win.length])

  const drop = (c: number) => {
    if (!myTurn || grid[0][c] !== null) return
    act({ type: 'drop', col: c })
  }

  const isWin = (r: number, c: number) => win.some(([a, b]) => a === r && b === c)
  const sorted = [...win].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const cx = (c: number) => c * S + S / 2, cy = (r: number) => TOP + r * S + S / 2

  return (
    <div ref={root} className="c4">
      <TurnBanner state={state} me={me} players={players} spectator={spectator} />
      <div className="c4-wrap">
        <svg viewBox={`-20 0 ${COLS * S + 40} ${TOP + ROWS * S + 60}`} className="c4-svg" onMouseLeave={() => setHover(null)}>
          <defs>
            <mask id="c4-holes">
              <rect x="-20" y={TOP - 14} width={COLS * S + 40} height={ROWS * S + 28} rx="34" fill="#fff" />
              {Array.from({ length: ROWS * COLS }, (_, i) => (
                <circle key={i} cx={cx(i % COLS)} cy={cy(Math.floor(i / COLS))} r="38" fill="#000" />
              ))}
            </mask>
          </defs>

          {hover !== null && myTurn && grid[0][hover] === null && (
            <g className="c4-ghost" style={{ transform: `translateX(${cx(hover)}px)` }}>
              <circle cx="0" cy={TOP / 2 - 6} r="38" fill={playerHex(room, me)} opacity="0.9" />
              <path d={`M-12 ${TOP - 26} L0 ${TOP - 14} L12 ${TOP - 26}`} stroke="#1d3a6e" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}

          <g>
            {grid.map((row, r) => row.map((v, c) => v === null ? null : (
              <Disc key={`${r}-${c}`} x={cx(c)} y={cy(r)} color={playerHex(room, order[v])} win={isWin(r, c)} row={r} />
            )))}
          </g>

          <g className="c4-frame">
            <rect x="-20" y={TOP - 14} width={COLS * S + 40} height={ROWS * S + 28} rx="34" fill="#1d3a6e" mask="url(#c4-holes)" />
            <rect x="-20" y={TOP - 14} width={COLS * S + 40} height={ROWS * S + 28} rx="34" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="6" />
            {Array.from({ length: ROWS * COLS }, (_, i) => (
              <circle key={i} cx={cx(i % COLS)} cy={cy(Math.floor(i / COLS))} r="38" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="6" />
            ))}
            <rect className="c4-leg" x="10" y={TOP + ROWS * S + 10} width="40" height="44" rx="10" fill="#1d3a6e" />
            <rect className="c4-leg" x={COLS * S - 50} y={TOP + ROWS * S + 10} width="40" height="44" rx="10" fill="#1d3a6e" />
          </g>

          {sorted.length >= 2 && (
            <path className="c4-winline" d={`M${cx(sorted[0][1])} ${cy(sorted[0][0])} L${cx(sorted[sorted.length - 1][1])} ${cy(sorted[sorted.length - 1][0])}`}
              stroke="#fff" strokeWidth="16" strokeLinecap="round" fill="none" />
          )}

          {Array.from({ length: COLS }, (_, c) => (
            <rect key={c} x={c * S} y="0" width={S} height={TOP + ROWS * S} fill="transparent"
              style={{ cursor: myTurn && grid[0][c] === null ? 'pointer' : 'default' }}
              onMouseEnter={() => setHover(c)} onClick={() => drop(c)} />
          ))}
        </svg>
      </div>
      <div className="c4-legend">
        {order.map((pid, i) => (
          <span key={pid} className={`display ${i === myIdx ? 'me' : ''}`}>
            <i style={{ background: playerHex(room, pid) }} />{room.players.find((p) => p.id === pid)?.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function Disc({ x, y, color, win, row }: { x: number; y: number; color: string; win: boolean; row: number }) {
  const ref = useRef<SVGGElement>(null)
  useLayoutEffect(() => {
    gsap.fromTo(ref.current, { y: -(y - 40) }, { y: 0, duration: 0.25 + row * 0.07, ease: 'bounce.out' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <g ref={ref}>
      <g className={`c4-disc ${win ? 'win' : ''}`} style={{ transformOrigin: `${x}px ${y}px` }}>
        <circle cx={x} cy={y} r="40" fill={color} />
        <circle cx={x} cy={y} r="26" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="6" />
        <path d={`M${x - 22} ${y - 14} A26 26 0 0 1 ${x - 4} ${y - 26}`} stroke="#fff" strokeOpacity="0.6" strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>
    </g>
  )
}
