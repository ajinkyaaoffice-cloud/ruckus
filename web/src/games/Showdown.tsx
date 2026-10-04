import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { ScoreChips, TimerBar } from './shared'
import './Showdown.css'

const HANDS = ['rock', 'paper', 'scissors'] as const
const LABEL: Record<string, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' }

/** Flat, chunky hand signs. */
export function Hand({ kind, color = '#1d3a6e' }: { kind: string; color?: string }) {
  if (kind === 'rock') return (
    <svg viewBox="0 0 100 100" className="sd-hand">
      <path d="M22 50 C18 30 34 20 50 22 C70 18 86 30 82 52 C86 72 70 84 50 82 C30 84 16 70 22 50Z" fill={color} />
      <g stroke="#fff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M36 40 Q42 36 46 42" /><path d="M50 38 Q56 34 60 40" /><path d="M64 42 Q70 40 72 48" />
      </g>
    </svg>
  )
  if (kind === 'paper') return (
    <svg viewBox="0 0 100 100" className="sd-hand">
      <rect x="22" y="14" width="56" height="72" rx="8" fill={color} transform="rotate(-6 50 50)" />
      <path d="M64 14 L78 28 L64 28Z" fill="#fff" opacity="0.5" transform="rotate(-6 50 50)" />
      <g stroke="#fff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" transform="rotate(-6 50 50)">
        <path d="M32 40 H66" /><path d="M32 54 H66" /><path d="M32 68 H54" />
      </g>
    </svg>
  )
  return (
    <svg viewBox="0 0 100 100" className="sd-hand">
      <g fill={color}>
        <path d="M44 56 L84 14 L90 20 L52 62Z" />
        <path d="M44 44 L84 86 L90 80 L52 38Z" />
      </g>
      <g fill="none" stroke={color} strokeWidth="9">
        <circle cx="28" cy="34" r="13" /><circle cx="28" cy="66" r="13" />
      </g>
      <circle cx="49" cy="50" r="5" fill="#fff" />
    </svg>
  )
}

export default function Showdown({ state, me, room, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const phase: string = state.phase
  const locked: string[] = state.locked
  const mine: string | null = state.mine
  const picks: Record<string, string> = state.picks
  const gain: Record<string, number> = state.gain
  const auto: string[] = state.auto
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '…'

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) {
      if (e.kind === 'pick') sfx.whoosh()
      if (e.kind === 'locked' && e.pid !== me) sfx.tick()
      if (e.kind === 'reveal') {
        sfx.slam()
        const g = (e.gain as Record<string, number>)[me]
        if (g != null) setTimeout(() => (g > 0 ? sfx.point() : sfx.bad()), 500)
      }
    }
  }), [me])

  useLayoutEffect(() => {
    if (phase !== 'reveal') return
    const cards = root.current!.querySelectorAll('.sd-card')
    gsap.fromTo(cards, { rotateY: 180, y: -30 }, { rotateY: 0, y: 0, duration: 0.6, ease: 'back.out(1.8)', stagger: 0.08 })
    gsap.fromTo(root.current!.querySelectorAll('.sd-gain'), { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(3)', delay: 0.5, stagger: 0.08 })
  }, [phase, state.round])

  useLayoutEffect(() => {
    if (phase !== 'pick') return
    gsap.fromTo(root.current!.querySelectorAll('.sd-pick'), { y: 80, scale: 0.6 }, { y: 0, scale: 1, duration: 0.5, ease: 'back.out(2.2)', stagger: 0.06, clearProps: 'transform' })
  }, [phase, state.round])

  const pick = (h: string) => {
    if (spectator || phase !== 'pick') return
    sfx.click()
    act({ type: 'throw', hand: h })
    const el = root.current!.querySelector(`.sd-pick.${h}`)
    if (el) gsap.fromTo(el, { scale: 1.2, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
  }

  return (
    <div ref={root} className="sd">
      <div className="sd-head">
        <span className="sd-round display">Round {Math.max(1, state.round)}<small>/{state.rounds}</small></span>
        <ScoreChips room={room} players={state.players} score={state.score} me={me} />
      </div>

      {phase === 'intro' && <div className="sd-call display">Rock · Paper · Scissors!</div>}

      {phase === 'pick' && (
        <>
          <TimerBar left={state.timeLeft} total={6} k={state.round} running />
          <div className="sd-call small display">{spectator ? 'Players are choosing…' : mine ? `${LABEL[mine]}! Change your mind?` : 'Pick your throw!'}</div>
          {!spectator && (
            <div className="sd-picks">
              {HANDS.map((h) => (
                <button key={h} className={`sd-pick ${h} ${mine === h ? 'on' : ''}`} onClick={() => pick(h)} data-cursor={LABEL[h].toUpperCase()}>
                  <Hand kind={h} color={mine === h ? '#e64fe0' : '#1d3a6e'} />
                  <span className="display">{LABEL[h]}</span>
                </button>
              ))}
            </div>
          )}
          <div className="sd-locked">
            {state.players.map((pid: string) => (
              <span key={pid} className={locked.includes(pid) ? 'in' : ''} style={{ ['--c' as string]: playerHex(room, pid) }}>
                {name(pid)} {locked.includes(pid) ? '✓' : '…'}
              </span>
            ))}
          </div>
        </>
      )}

      {phase === 'reveal' && (
        <div className="sd-reveal">
          {state.players.map((pid: string) => (
            <div key={pid} className={`sd-card ${pid === me ? 'me' : ''}`} style={{ ['--c' as string]: playerHex(room, pid) }}>
              <Hand kind={picks[pid]} color={playerHex(room, pid)} />
              <b className="display">{name(pid)}</b>
              <small>{LABEL[picks[pid]]}{auto.includes(pid) ? ' (random)' : ''}</small>
              <span className={`sd-gain display ${gain[pid] ? 'up' : ''}`}>+{gain[pid] ?? 0}</span>
            </div>
          ))}
        </div>
      )}
      <p className="sd-tip">Every throw is checked against every other: one point for each player you beat.</p>
    </div>
  )
}
