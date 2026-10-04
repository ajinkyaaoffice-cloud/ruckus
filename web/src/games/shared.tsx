import { useLayoutEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import type { GameState, RoomPlayer } from '../lib/net'

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
