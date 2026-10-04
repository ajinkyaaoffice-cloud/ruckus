import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import Avatar from '../components/Avatar'
import './Echo.css'

const COLORS = ['#e64fe0', '#45b8ff', '#ffb424', '#d9f66b', '#a596ff', '#ff9a62']

function sector(i: number, n: number, r1: number, r2: number, gap = 3.2) {
  const a0 = ((i / n) * 360 + gap - 90) * (Math.PI / 180)
  const a1 = (((i + 1) / n) * 360 - gap - 90) * (Math.PI / 180)
  const p = (r: number, a: number) => `${100 + Math.cos(a) * r} ${100 + Math.sin(a) * r}`
  return `M${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r2, a1)} A${r2} ${r2} 0 0 0 ${p(r2, a0)}Z`
}

export default function Echo({ state, me, room, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const [lit, setLit] = useState<number | null>(null)
  const phase: string = state.phase
  const alive: string[] = state.alive
  const done: string[] = state.done
  const meAlive = alive.includes(me) && !spectator
  const myProgress: number = state.progress?.[me] ?? 0
  const canTap = phase === 'input' && meAlive && !done.includes(me)

  const flash = (pad: number, ms = 260) => {
    setLit(pad)
    sfx.pad(pad)
    const el = root.current?.querySelector(`.ec-pad[data-p="${pad}"]`)
    if (el) gsap.fromTo(el, { scale: 1.06 }, { scale: 1, duration: ms / 1000 + 0.15, ease: 'power2.out', transformOrigin: '100px 100px' })
    window.setTimeout(() => setLit((l) => (l === pad ? null : l)), ms)
  }

  // play the sequence back while watching
  useEffect(() => {
    if (phase !== 'watch' || !state.sequence) return
    const seq: number[] = state.sequence
    const step: number = state.stepMs
    const timers = seq.map((p, i) => window.setTimeout(() => flash(p, step * 0.7), 350 + i * step))
    return () => timers.forEach(clearTimeout)
  }, [phase, state.round]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const bar = root.current?.querySelector('.ec-timer i')
    if (!bar) return
    if (phase === 'input' && state.timeLeft) gsap.fromTo(bar, { scaleX: 1 }, { scaleX: 0, duration: state.timeLeft, ease: 'none' })
    else gsap.set(bar, { scaleX: 0 })
  }, [phase, state.round]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    gsap.fromTo(root.current!.querySelector('.ec-status'), { scale: 0.3, rotate: -10 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(3)' })
  }, [phase, state.round, meAlive])

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) {
      if (e.kind === 'tap' && e.pid !== me) {
        const chip = root.current?.querySelector(`[data-player="${e.pid}"] .ec-dots`)
        if (chip) gsap.fromTo(chip, { y: -4 }, { y: 0, duration: 0.3, ease: 'bounce.out' })
      }
      if (e.kind === 'out') {
        if (e.pid === me) sfx.lose(); else sfx.bad()
        const chip = root.current?.querySelector(`[data-player="${e.pid}"]`)
        if (chip) gsap.fromTo(chip, { rotate: -12, scale: 1.2 }, { rotate: 0, scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.3)' })
      }
      if (e.kind === 'wrong' && e.pid === me) gsap.fromTo(root.current!.querySelector('.ec-board'), { x: -14 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.2)' })
      if (e.kind === 'cleared') sfx.point()
      if (e.kind === 'input') sfx.pop()
    }
  }), [me])

  const tap = (pad: number) => {
    if (!canTap) return
    flash(pad, 220)
    act({ type: 'pad', pad })
  }

  const status = !meAlive && !spectator ? 'Out!' :
    phase === 'watch' ? 'Watch…' :
    phase === 'input' ? (done.includes(me) ? 'Nailed it' : 'Your echo!') :
    phase === 'between' ? 'Next round' : 'Get ready'

  return (
    <div ref={root} className="ec">
      <div className="ec-players">
        {state.players.map((pid: string) => {
          const p = room.players.find((x) => x.id === pid)
          const out = !alive.includes(pid)
          const prog = state.progress?.[pid] ?? 0
          return (
            <div key={pid} data-player={pid} className={`ec-chip ${out ? 'out' : ''} ${done.includes(pid) ? 'done' : ''}`} style={{ ['--pc' as string]: playerHex(room, pid) }}>
              <Avatar config={p?.avatar} size={44} badge track="none" expression={out ? 'sad' : done.includes(pid) ? 'happy' : 'focus'} />
              <div>
                <b>{p?.name}</b>
                <span className="ec-dots">
                  {Array.from({ length: state.length }, (_, i) => <i key={i} className={i < prog ? 'on' : ''} />)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="ec-timer"><i /></div>

      <div className={`ec-board ${canTap ? 'live' : ''}`}>
        <svg viewBox="0 0 200 200">
          {COLORS.map((col, i) => (
            <path key={i} data-p={i} className={`ec-pad ${lit === i ? 'lit' : ''}`} d={sector(i, 6, 96, 46)} fill={col}
              style={{ ['--glow' as string]: col }} onPointerDown={() => tap(i)} />
          ))}
          <circle cx="100" cy="100" r="40" fill="#1d3a6e" />
        </svg>
        <div className="ec-center">
          <span className="ec-round display">{Math.max(1, state.round)}</span>
          <span className="ec-status display">{status}</span>
          {phase === 'input' && meAlive && <span className="ec-prog">{myProgress}/{state.length}</span>}
        </div>
      </div>
    </div>
  )
}
