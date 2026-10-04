import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { ScoreChips, TimerBar } from './shared'
import './QuickMaths.css'

export default function QuickMaths({ state, me, room, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const phase: string = state.phase
  const options: number[] = state.options
  const locked: string[] = state.locked
  const iLocked = locked.includes(me)
  const [mineWrong, setMineWrong] = useState<number | null>(null)
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '…'

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) {
      if (e.kind === 'question') { setMineWrong(null); sfx.pop() }
      if (e.kind === 'wrong') {
        if (e.pid === me) {
          sfx.bad(); setMineWrong(e.index)
          gsap.fromTo(root.current!.querySelector('.qm-opts'), { x: -12 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.2)' })
        } else sfx.tick()
      }
      if (e.kind === 'reveal') e.by === me ? sfx.win() : e.by ? sfx.point() : sfx.lose()
    }
  }), [me])

  useLayoutEffect(() => {
    if (phase !== 'play') return
    gsap.fromTo(root.current!.querySelector('.qm-sum'), { scale: 0.3, rotate: -12 }, { scale: 1, rotate: -2, duration: 0.5, ease: 'back.out(2.6)' })
    gsap.fromTo(root.current!.querySelectorAll('.qm-opt'), { y: 60, scale: 0.6 }, { y: 0, scale: 1, duration: 0.45, ease: 'back.out(2.2)', stagger: 0.05, delay: 0.1, clearProps: 'transform' })
  }, [phase, state.q])

  useLayoutEffect(() => {
    if (phase !== 'reveal' || state.answer == null) return
    const el = root.current!.querySelectorAll('.qm-opt')[state.answer]
    if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.1, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' })
  }, [phase, state.answer])

  const answer = (i: number) => {
    if (spectator || phase !== 'play' || iLocked) return
    sfx.click()
    act({ type: 'answer', index: i })
  }

  useEffect(() => {
    if (spectator) return
    const kd = (e: KeyboardEvent) => { const i = ['1', '2', '3', '4'].indexOf(e.key); if (i >= 0) answer(i) }
    window.addEventListener('keydown', kd)
    return () => window.removeEventListener('keydown', kd)
  })

  const solver: string | null = state.solvedBy
  const show = phase === 'play' || phase === 'reveal'

  return (
    <div ref={root} className="qm">
      <div className="qm-head">
        <span className="qm-round display">Sum {Math.max(1, state.q)}<small>/{state.questions}</small></span>
        <ScoreChips room={room} players={state.players} score={state.score} dim={phase === 'play' ? locked : []} me={me} />
      </div>
      {!show && <div className="qm-call display">Brains ready?</div>}
      {show && (
        <>
          <TimerBar left={state.timeLeft} total={12} k={state.q} running={phase === 'play'} />
          <div className="qm-sum display">{state.text} = <span>?</span></div>
          <div className={`qm-opts ${iLocked && phase === 'play' ? 'locked' : ''}`}>
            {options.map((v, i) => (
              <button key={`${state.q}-${i}`} onClick={() => answer(i)}
                className={`qm-opt display ${phase === 'reveal' && state.answer === i ? 'right' : ''} ${mineWrong === i ? 'wrong' : ''}`}>
                <small>{i + 1}</small>{v}
              </button>
            ))}
          </div>
          <div className="qm-status">
            {phase === 'reveal' ? (
              <b className="display" style={{ color: solver ? playerHex(room, solver) : 'var(--navy)' }}>
                {solver ? (solver === me ? 'You got it!' : `${name(solver)} got it!`) : 'Nobody got it!'}
              </b>
            ) : iLocked ? <span>Locked out — wait for the next sum</span> : <span>First right answer scores. A wrong one locks you out!</span>}
          </div>
        </>
      )}
    </div>
  )
}
