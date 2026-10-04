import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import './OddOne.css'

type Item = { shape: string; h: number; s: number; l: number; rot: number; scale: number; flip: boolean; pts: number; wob: number }

const KIND_TEXT: Record<string, string> = {
  hue: 'a slightly different shade', rotate: 'turned a little', mirror: 'a mirror image', size: 'a different size', shape: 'one extra point',
}

function starPts(n: number, r1 = 40, r2 = 18) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI / n) * i - Math.PI / 2
    const r = i % 2 ? r2 : r1
    return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`
  }).join(' ')
}

function Shape({ it }: { it: Item }) {
  const fill = `hsl(${it.h} ${it.s}% ${it.l}%)`
  const t = `rotate(${it.rot} 50 50) translate(50 50) scale(${it.scale * (it.flip ? -1 : 1)} ${it.scale}) translate(-50 -50)`
  let body
  switch (it.shape) {
    case 'arrow': body = <polygon points="14,40 54,40 54,20 88,50 54,80 54,60 14,60" />; break
    case 'ell': body = <polygon points="22,14 44,14 44,64 82,64 82,86 22,86" />; break
    case 'flag': body = <g><rect x="22" y="12" width="10" height="76" rx="4" /><polygon points="32,14 84,30 32,48" /></g>; break
    case 'half': body = <g><path d="M50 14 A36 36 0 0 1 50 86Z" /><circle cx="30" cy="30" r="10" /></g>; break
    case 'bolt': body = <polygon points="58,8 22,56 46,56 38,92 80,40 54,40" />; break
    case 'star': body = <polygon points={starPts(it.pts)} strokeLinejoin="round" />; break
    case 'blob': body = <path d="M50 12 C72 12 88 28 86 50 C84 72 70 88 50 88 C30 88 14 72 14 50 C14 28 28 12 50 12Z" />; break
    case 'ring': body = <path fillRule="evenodd" d="M50 12 A38 38 0 1 1 49.9 12Z M50 30 A20 20 0 1 0 50.1 30Z" />; break
    case 'gem': body = <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" />; break
    default: body = <g>{Array.from({ length: 5 }, (_, i) => <ellipse key={i} cx="50" cy="28" rx="13" ry="20" transform={`rotate(${i * 72} 50 50)`} />)}<circle cx="50" cy="50" r="12" /></g>
  }
  return (
    <svg viewBox="0 0 100 100" className="oo-shape" style={{ animationDelay: `${it.wob}s` }}>
      <g transform={t} fill={fill}>{body}</g>
    </svg>
  )
}

export default function OddOne({ state, me, room, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const items: Item[] = state.items
  const locked: string[] = state.locked
  const phase: string = state.phase
  const iAmLocked = locked.includes(me)
  const [bad, setBad] = useState<number | null>(null)

  // round title slam
  useLayoutEffect(() => {
    if (phase !== 'ready' && phase !== 'intro') return
    gsap.fromTo(root.current!.querySelector('.oo-call'), { scale: 0, rotate: -20 }, { scale: 1, rotate: -4, duration: 0.5, ease: 'back.out(3)' })
  }, [phase, state.round])

  // grid pops in each round
  useLayoutEffect(() => {
    if (phase !== 'play') return
    gsap.fromTo(root.current!.querySelectorAll('.oo-cell'), ...intro({ scale: 0, rotate: 90, duration: 0.45, ease: 'back.out(2)', stagger: { each: 0.012, from: 'center', grid: [state.size, state.size] } }))
    const bar = root.current!.querySelector('.oo-timer i')
    if (bar && state.timeLeft) gsap.fromTo(bar, { scaleX: state.timeLeft / 15 }, { scaleX: 0, duration: state.timeLeft, ease: 'none' })
  }, [phase, state.round]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (phase !== 'reveal' || state.answer == null) return
    const cells = root.current!.querySelectorAll('.oo-cell')
    gsap.to(Array.from(cells).filter((_, i) => i !== state.answer), { scale: 0.7, opacity: 0.25, duration: 0.35, stagger: 0.004 })
    gsap.fromTo(cells[state.answer], { scale: 1 }, { scale: 1.35, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
  }, [phase, state.answer])

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) {
      if (e.kind === 'wrong' && e.pid === me) {
        sfx.bad(); setBad(e.index)
        gsap.fromTo(root.current!.querySelector('.oo-grid'), { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.2)' })
      }
      if (e.kind === 'reveal') e.by === me ? sfx.win() : e.by ? sfx.point() : sfx.lose()
      if (e.kind === 'ready') { sfx.slam(); setBad(null) }
      if (e.kind === 'go') sfx.pop()
    }
  }), [me])

  const pick = (i: number) => {
    if (phase !== 'play' || iAmLocked || spectator) return
    sfx.click()
    act({ type: 'pick', index: i })
  }

  const finder = state.foundBy ? room.players.find((p) => p.id === state.foundBy) : null

  return (
    <div ref={root} className="oo">
      <div className="oo-head">
        <span className="oo-round display">Round {Math.max(1, state.round)}<small>/{state.rounds}</small></span>
        <div className="oo-scores">
          {state.players.map((pid: string) => (
            <span key={pid} className={`display ${locked.includes(pid) ? 'locked' : ''}`} style={{ background: playerHex(room, pid) }}>
              {room.players.find((p) => p.id === pid)?.name} {state.score[pid]}
            </span>
          ))}
        </div>
      </div>

      {(phase === 'ready' || phase === 'intro') && (
        <div className="oo-call display">{phase === 'intro' ? 'Spot the odd one!' : `Round ${state.round}`}</div>
      )}

      {(phase === 'play' || phase === 'reveal') && (
        <>
          <div className="oo-timer"><i style={{ opacity: phase === 'play' ? 1 : 0 }} /></div>
          <div className={`oo-grid ${iAmLocked && phase === 'play' ? 'locked' : ''}`} style={{ gridTemplateColumns: `repeat(${state.size}, 1fr)` }}>
            {items.map((it, i) => (
              <button key={`${state.round}-${i}`} className={`oo-cell ${bad === i ? 'bad' : ''} ${state.answer === i ? 'answer' : ''}`} onClick={() => pick(i)}>
                <Shape it={it} />
              </button>
            ))}
            {iAmLocked && phase === 'play' && <div className="oo-lock display">Locked out!<small>wait for the reveal</small></div>}
          </div>
          {phase === 'reveal' && (
            <div className="oo-reveal">
              <b className="display" style={{ color: finder ? playerHex(room, finder.id) : 'var(--navy)' }}>
                {finder ? (finder.id === me ? 'You got it!' : `${finder.name} got it!`) : 'Nobody found it!'}
              </b>
              <span className="serif">It was {KIND_TEXT[state.kind] ?? 'different'}.</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
