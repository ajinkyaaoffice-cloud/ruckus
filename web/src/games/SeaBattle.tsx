import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { TimerBar, TurnBanner } from './shared'
import './SeaBattle.css'

const S = 100

/** Bounding box of a ship's cells, in board units. */
function shipBox(cells: number[], n: number) {
  const xs = cells.map((c) => c % n), ys = cells.map((c) => Math.floor(c / n))
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  return { x: x0 * S + 10, y: y0 * S + 10, w: (Math.max(...xs) - x0 + 1) * S - 20, h: (Math.max(...ys) - y0 + 1) * S - 20, vertical: ys[0] !== ys[ys.length - 1] }
}

function Ship({ cells, n, color, sunk }: { cells: number[]; n: number; color: string; sunk?: boolean }) {
  const b = shipBox(cells, n)
  const r = Math.min(b.w, b.h) / 2
  // a little row of portholes down the hull
  const holes = cells.length > 1 ? cells.slice(0, -1).map((_, i) => {
    const t = (i + 1) / cells.length
    return b.vertical ? [b.x + b.w / 2, b.y + b.h * t] : [b.x + b.w * t, b.y + b.h / 2]
  }) : []
  return (
    <g className={`sb-ship ${sunk ? 'sunk' : ''}`}>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={r} fill={color} />
      <rect x={b.x + 8} y={b.y + 8} width={b.w - 16} height={b.h - 16} rx={r - 8} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="5" />
      {holes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="#fff" opacity="0.8" />)}
    </g>
  )
}

function Mark({ cell, n, hit }: { cell: number; n: number; hit: boolean }) {
  const x = (cell % n) * S + S / 2, y = Math.floor(cell / n) * S + S / 2
  return hit ? (
    <g className="sb-mark" data-cell={cell}>
      <path d={`M${x} ${y - 34} L${x + 10} ${y - 12} L${x + 34} ${y - 14} L${x + 16} ${y + 4} L${x + 26} ${y + 30} L${x} ${y + 16} L${x - 26} ${y + 30} L${x - 16} ${y + 4} L${x - 34} ${y - 14} L${x - 10} ${y - 12}Z`} fill="#ff5d73" />
      <circle cx={x} cy={y} r="11" fill="#ffb424" />
    </g>
  ) : (
    <g className="sb-mark" data-cell={cell}>
      <circle cx={x} cy={y} r="22" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="5" />
      <circle cx={x} cy={y} r="8" fill="#fff" opacity="0.8" />
    </g>
  )
}

function Sea({ n, children, onCell, cursor, className }: { n: number; children: React.ReactNode; onCell?: (c: number) => void; cursor?: (c: number) => boolean; className?: string }) {
  const L = 'ABCDEFGHIJ'
  return (
    <svg viewBox={`-50 -50 ${n * S + 60} ${n * S + 60}`} className={`sb-sea ${className ?? ''}`}>
      <rect x="0" y="0" width={n * S} height={n * S} rx="24" className="sb-water" />
      <g className="sb-lines">
        {Array.from({ length: n - 1 }, (_, i) => (
          <path key={i} d={`M${(i + 1) * S} 0 V${n * S} M0 ${(i + 1) * S} H${n * S}`} />
        ))}
      </g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} className="sb-label">
          <text x={i * S + S / 2} y="-16" textAnchor="middle">{i + 1}</text>
          <text x="-26" y={i * S + S / 2 + 10} textAnchor="middle">{L[i]}</text>
        </g>
      ))}
      {children}
      {onCell && Array.from({ length: n * n }, (_, c) => (
        <rect key={c} x={(c % n) * S} y={Math.floor(c / n) * S} width={S} height={S} fill="transparent" className={cursor?.(c) ? 'sb-hit-target' : ''}
          onClick={() => onCell(c)} />
      ))}
    </svg>
  )
}

export default function SeaBattle({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const n: number = state.size
  const phase: string = state.phase
  const myShips: number[][] = state.myShips
  const incoming: [number, boolean][] = state.incoming
  const outgoing: [number, boolean][] = state.outgoing
  const foeSunk: number[][] = state.foeSunk
  const ready: string[] = state.ready
  const self: string = state.me, foe: string = state.foe
  const myTurn = phase === 'battle' && state.turn === me && !state.over && !spectator
  const [flash, setFlash] = useState<{ text: string; good: boolean; k: number } | null>(null)
  const fired = new Map(outgoing)
  const myColor = playerHex(room, self), foeColor = playerHex(room, foe)
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '…'

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.sb-board', ...intro({ y: 120, rotate: (i: number) => (i ? 4 : -4), duration: 0.8, ease: 'back.out(1.6)', delay: 0.8, stagger: 0.12 }))
    }, root)
    return () => ctx.revert()
  }, [])

  useLayoutEffect(() => {
    if (phase !== 'place') return
    gsap.fromTo(root.current!.querySelectorAll('.sb-mine .sb-ship'), { scale: 0.2, transformOrigin: '50% 50%', transformBox: 'fill-box' },
      { scale: 1, duration: 0.45, ease: 'back.out(2.4)', stagger: 0.05 })
  }, [JSON.stringify(myShips), phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) {
      if (e.kind === 'battle') { sfx.slam(); setFlash({ text: 'Battle stations!', good: true, k: Date.now() }) }
      if (e.kind === 'ready') sfx.pop()
      if (e.kind === 'shot') {
        const mine = e.by === me
        if (e.hit) { sfx.hit(0.9); if (!mine) sfx.bad() } else sfx.wall()
        if (e.sunk) { (mine ? sfx.win : sfx.lose)(); setFlash({ text: mine ? 'You sank a ship!' : 'They sank your ship!', good: mine, k: Date.now() }) }
        requestAnimationFrame(() => {
          const board = root.current?.querySelector(mine ? '.sb-theirs' : '.sb-mine')
          const m = board?.querySelector(`.sb-mark[data-cell="${e.cell}"]`)
          if (m) gsap.fromTo(m, { scale: 0, rotate: -90, transformOrigin: '50% 50%', transformBox: 'fill-box' }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(3)' })
          if (e.hit && board) gsap.fromTo(board, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.25)' })
        })
      }
    }
  }), [me])

  useLayoutEffect(() => {
    if (!flash) return
    const el = root.current!.querySelector('.sb-flash')
    gsap.timeline().fromTo(el, { scale: 0, rotate: -12, autoAlpha: 1 }, { scale: 1, rotate: -4, duration: 0.45, ease: 'back.out(3)' })
      .to(el, { autoAlpha: 0, y: -30, duration: 0.3 }, '+=0.9')
  }, [flash?.k]) // eslint-disable-line react-hooks/exhaustive-deps

  const fire = (c: number) => {
    if (!myTurn || fired.has(c)) return
    sfx.click()
    act({ type: 'fire', cell: c })
  }

  const iReady = ready.includes(me)
  const foeReady = ready.includes(foe)

  if (phase === 'place') {
    return (
      <div ref={root} className="sb">
        <div className="turn-banner mine">Place your fleet</div>
        <TimerBar left={state.timeLeft} total={40} k="place" running />
        <div className="sb-boards place">
          <div className="sb-board sb-mine">
            <Sea n={n}>{myShips.map((s, i) => <Ship key={i} cells={s} n={n} color={myColor} />)}</Sea>
          </div>
        </div>
        {!spectator && (
          <div className="sb-row">
            <button className="bubble-btn" disabled={iReady} onClick={() => { sfx.whoosh(); act({ type: 'shuffle' }) }}>Shuffle ships</button>
            <button className="bubble-btn magenta" disabled={iReady} onClick={() => { sfx.click(); act({ type: 'ready' }) }}>{iReady ? 'Locked in!' : 'Ready!'}</button>
          </div>
        )}
        <p className="sb-note">{foeReady ? `${name(foe)} is ready and waiting.` : `${name(foe)} is still hiding their ships…`}</p>
      </div>
    )
  }

  return (
    <div ref={root} className="sb">
      <TurnBanner state={state} me={me} players={players} spectator={spectator}
        text={state.over ? 'Game over' : myTurn ? 'Fire away!' : spectator ? `${name(state.turn)} is aiming…` : `${name(state.turn)} is aiming at you…`} />
      <div className="sb-boards">
        <div className={`sb-board sb-theirs ${myTurn ? 'live' : ''}`}>
          <h3 className="display">{spectator ? `${name(foe)}'s waters` : 'Their waters'} <small>{foeSunk.length}/{state.fleet.length} sunk</small></h3>
          <Sea n={n} onCell={spectator ? undefined : fire} cursor={(c) => myTurn && !fired.has(c)}>
            {foeSunk.map((s, i) => <Ship key={i} cells={s} n={n} color={foeColor} sunk />)}
            {outgoing.map(([c, hit]) => <Mark key={c} cell={c} n={n} hit={hit} />)}
          </Sea>
        </div>
        <div className="sb-board sb-mine small">
          <h3 className="display">{spectator ? `${name(self)}'s fleet` : 'Your fleet'} <small>{state.mySunk}/{state.fleet.length} lost</small></h3>
          <Sea n={n}>
            {myShips.map((s, i) => <Ship key={i} cells={s} n={n} color={myColor} sunk={s.every((c) => incoming.some(([x, h]) => x === c && h))} />)}
            {incoming.map(([c, hit]) => <Mark key={c} cell={c} n={n} hit={hit} />)}
          </Sea>
        </div>
      </div>
      {flash && <div key={flash.k} className={`sb-flash display ${flash.good ? 'good' : ''}`}>{flash.text}</div>}
    </div>
  )
}
