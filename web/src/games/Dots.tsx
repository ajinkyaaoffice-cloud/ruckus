import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import Glyph, { type GlyphName } from '../components/Glyph'
import { TurnBanner } from './shared'
import './Dots.css'

const S = 100, PAD = 30
const BOX_GLYPH: GlyphName[] = ['star', 'heart', 'bolt']

type Hover = { kind: 'h' | 'v'; r: number; c: number } | null

export default function Dots({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const rows: number = state.rows, cols: number = state.cols
  const h: (string | null)[][] = state.h
  const v: (string | null)[][] = state.v
  const boxes: (string | null)[][] = state.boxes
  const order: string[] = state.players
  const myTurn = state.turn === me && !state.over && !spectator
  const [hover, setHover] = useState<Hover>(null)
  const W = cols * S + PAD * 2, H = rows * S + PAD * 2

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.dots-dot', { scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(4)', stagger: { each: 0.02, from: 'center', grid: [rows + 1, cols + 1] }, delay: 0.9 })
    }, root)
    return () => ctx.revert()
  }, [rows, cols])

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) if (e.kind === 'line') {
      if (e.boxes.length) {
        sfx.point()
        setTimeout(() => {
          const els = e.boxes.map(([r, c]: number[]) => root.current?.querySelector(`.dots-box[data-k="${r}-${c}"]`)).filter(Boolean)
          gsap.fromTo(els, { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.4)', transformOrigin: '50% 50%' })
        }, 10)
      } else sfx.place()
    }
  }), [])

  const draw = (kind: 'h' | 'v', r: number, c: number) => {
    if (!myTurn) return
    if ((kind === 'h' ? h[r][c] : v[r][c]) !== null) return
    act({ type: 'line', kind, r, c })
    setHover(null)
  }

  const x = (c: number) => PAD + c * S, y = (r: number) => PAD + r * S
  const lines: ReactElement[] = []
  const hits: ReactElement[] = []
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
    const who = h[r][c]
    if (who) lines.push(<Line key={`h${r}-${c}`} d={`M${x(c)} ${y(r)} L${x(c + 1)} ${y(r)}`} color={playerHex(room, who)} />)
    else hits.push(<rect key={`hh${r}-${c}`} x={x(c) + 12} y={y(r) - 22} width={S - 24} height="44" className="dots-hit"
      onMouseEnter={() => setHover({ kind: 'h', r, c })} onMouseLeave={() => setHover(null)} onClick={() => draw('h', r, c)} />)
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    const who = v[r][c]
    if (who) lines.push(<Line key={`v${r}-${c}`} d={`M${x(c)} ${y(r)} L${x(c)} ${y(r + 1)}`} color={playerHex(room, who)} />)
    else hits.push(<rect key={`vh${r}-${c}`} x={x(c) - 22} y={y(r) + 12} width="44" height={S - 24} className="dots-hit"
      onMouseEnter={() => setHover({ kind: 'v', r, c })} onMouseLeave={() => setHover(null)} onClick={() => draw('v', r, c)} />)
  }

  return (
    <div ref={root} className="dots">
      <TurnBanner state={state} me={me} players={players} spectator={spectator} />
      <div className="dots-board" style={{ width: `min(90vw, 58svh, ${cols * 110}px)` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className={`dots-svg ${myTurn ? 'live' : ''}`}>
          {boxes.map((row, r) => row.map((who, c) => who && (
            <g key={`b${r}-${c}`} className="dots-box" data-k={`${r}-${c}`} style={{ transformOrigin: `${x(c) + S / 2}px ${y(r) + S / 2}px` }}>
              <rect x={x(c) + 8} y={y(r) + 8} width={S - 16} height={S - 16} rx="14" fill={playerHex(room, who)} />
              <g transform={`translate(${x(c) + S / 2 - 22} ${y(r) + S / 2 - 22})`}>
                <Glyph name={BOX_GLYPH[order.indexOf(who)] ?? 'star'} color="#fff" size={44} />
              </g>
            </g>
          )))}
          {hover && myTurn && (
            <path className="dots-ghost" stroke={playerHex(room, me)}
              d={hover.kind === 'h' ? `M${x(hover.c)} ${y(hover.r)} L${x(hover.c + 1)} ${y(hover.r)}` : `M${x(hover.c)} ${y(hover.r)} L${x(hover.c)} ${y(hover.r + 1)}`} />
          )}
          {lines}
          {Array.from({ length: (rows + 1) * (cols + 1) }, (_, i) => (
            <circle key={i} className="dots-dot" cx={x(i % (cols + 1))} cy={y(Math.floor(i / (cols + 1)))} r="11" />
          ))}
          {myTurn && hits}
        </svg>
      </div>
      <div className="dots-score">
        {order.map((pid, i) => (
          <span key={pid} className="display" style={{ background: playerHex(room, pid) }}>
            <Glyph name={BOX_GLYPH[i]} color="#fff" size={22} /> {state.score[pid]}
          </span>
        ))}
      </div>
    </div>
  )
}

function Line({ d, color }: { d: string; color: string }) {
  const ref = useRef<SVGPathElement>(null)
  useLayoutEffect(() => {
    const l = ref.current!.getTotalLength()
    gsap.fromTo(ref.current, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out' })
  }, [])
  return <path ref={ref} d={d} stroke={color} strokeWidth="14" strokeLinecap="round" fill="none" />
}
