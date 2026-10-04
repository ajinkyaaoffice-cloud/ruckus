import { useLayoutEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { playerHex, type GameState, type Room, type RoomPlayer } from '../lib/net'

/** Animate stroke-dashoffset on matching paths once, when the board mounts. */
export function useDrawOn(root: RefObject<HTMLElement | null>, selector: string, opts: { duration?: number; stagger?: number; delay?: number } = {}) {
  useLayoutEffect(() => {
    const paths = root.current?.querySelectorAll<SVGPathElement>(selector)
    if (!paths) return
    const tweens = Array.from(paths).map((p, i) => {
      const l = p.getTotalLength()
      return gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, {
        strokeDashoffset: 0, duration: opts.duration ?? 0.6, ease: 'power3.out', delay: (opts.delay ?? 0) + i * (opts.stagger ?? 0.1),
      })
    })
    return () => tweens.forEach((t) => t.kill())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

/** "Your turn" / "Waiting for Sam" header that bounces whenever the turn changes. */
export function TurnBanner({ state, me, players, spectator, text }: { state: GameState; me: string; players: RoomPlayer[]; spectator: boolean; text?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const mine = state.turn === me && !spectator
  const name = players.find((p) => p.id === state.turn)?.name ?? '…'
  const label = text ?? (state.over ? 'Game over' : mine ? 'Your turn!' : `${name}'s turn`)
  useLayoutEffect(() => {
    gsap.fromTo(ref.current, { scale: 0.4, rotate: mine ? -8 : 8 }, { scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(3)' })
  }, [label, mine])
  return <div ref={ref} className={`turn-banner ${mine ? 'mine' : ''}`}>{label}</div>
}

/** Row of player pills showing a score, dimmed when that player is sitting this one out. */
export function ScoreChips({ room, players, score, dim = [], me, suffix = '' }: { room: Room; players: string[]; score: Record<string, number>; dim?: string[]; me: string; suffix?: string }) {
  return (
    <div className="score-chips">
      {players.map((pid) => (
        <span key={pid} className={`display ${dim.includes(pid) ? 'dim' : ''} ${pid === me ? 'me' : ''}`} style={{ background: playerHex(room, pid) }}>
          {room.players.find((p) => p.id === pid)?.name ?? '…'} <b>{score[pid] ?? 0}{suffix}</b>
        </span>
      ))}
    </div>
  )
}

/** Countdown bar that drains from the server's remaining time; restarts whenever `k` changes. */
export function TimerBar({ left, total, k, running }: { left: number | null | undefined; total: number; k: unknown; running: boolean }) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    gsap.killTweensOf(el)
    if (!running || left == null) return
    const tw = gsap.fromTo(el, { scaleX: Math.min(1, left / total) }, { scaleX: 0, duration: left, ease: 'none' })
    return () => { tw.kill() }
  }, [k, running]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="timer-bar"><i ref={ref} style={{ opacity: running ? 1 : 0 }} /></div>
}
