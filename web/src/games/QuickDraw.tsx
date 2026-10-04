import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { ScoreChips } from './shared'
import './QuickDraw.css'

const FAKES: Record<string, string> = { tumbleweed: 'tumbleweed', bird: 'bird', dust: 'dust' }

export default function QuickDraw({ state, me, room, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const drawSeen = useRef(0)
  const sent = useRef(false)
  const [fake, setFake] = useState<{ what: string; k: number } | null>(null)
  const [myMs, setMyMs] = useState<number | null>(null)
  const phase: string = state.phase
  const fouled: string[] = state.fouled
  const tapped: string[] = state.tapped
  const iFouled = fouled.includes(me)
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '…'

  useEffect(() => onGameEvents((evs) => {
    for (const e of evs) {
      if (e.kind === 'wait') { sent.current = false; setMyMs(null); setFake(null); sfx.whoosh() }
      if (e.kind === 'draw') {
        // the clock starts when *this* screen shows the signal, so lag doesn't cost you
        requestAnimationFrame(() => { drawSeen.current = performance.now() })
        drawSeen.current = performance.now()
        sfx.slam()
      }
      if (e.kind === 'fake') { setFake({ what: e.what, k: Date.now() }); sfx.tick() }
      if (e.kind === 'foul') e.pid === me ? sfx.bad() : sfx.tick()
      if (e.kind === 'result') e.winner === me ? sfx.win() : e.winner ? sfx.point() : sfx.lose()
    }
  }), [me])

  const tap = () => {
    if (spectator || sent.current || iFouled) return
    if (phase === 'wait') {
      sent.current = true
      act({ type: 'tap' })
      return
    }
    if (phase !== 'draw') return
    sent.current = true
    const ms = Math.round(performance.now() - drawSeen.current)
    setMyMs(ms)
    sfx.hit(1)
    act({ type: 'tap', ms })
  }

  useEffect(() => {
    if (spectator) return
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) tap() } }
    window.addEventListener('keydown', kd)
    return () => window.removeEventListener('keydown', kd)
  })

  useLayoutEffect(() => {
    if (!fake) return
    const el = root.current!.querySelector('.qd-fake')
    const w = root.current!.querySelector('.qd-arena')!.clientWidth
    const tl = gsap.timeline()
    if (fake.what === 'bird') tl.fromTo(el, { x: w + 60, y: 0 }, { x: -120, y: -40, duration: 1.4, ease: 'none' })
    else if (fake.what === 'dust') tl.fromTo(el, { x: w * 0.3, scale: 0.2, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 1, ease: 'power2.out' })
    else tl.fromTo(el, { x: -120, rotate: 0 }, { x: w + 60, rotate: 720, duration: 1.8, ease: 'none' })
    return () => { tl.kill() }
  }, [fake?.k]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (phase !== 'draw') return
    gsap.fromTo(root.current!.querySelector('.qd-call'), { scale: 3, rotate: -14 }, { scale: 1, rotate: -4, duration: 0.25, ease: 'back.out(2.5)' })
  }, [phase, state.round])

  const taps: Record<string, number> = state.taps
  const winner: string | null = state.winner
  const mood = phase === 'draw' ? 'draw' : phase === 'wait' ? 'wait' : 'calm'
  const call = phase === 'intro' ? 'Hands off… wait for DRAW!' : phase === 'wait' ? (iFouled ? 'Too early!' : 'Wait for it…') : phase === 'draw' ? (iFouled ? 'Too early!' : 'DRAW!') : ''

  return (
    <div ref={root} className="qd">
      <div className="qd-head">
        <span className="qd-round display">Round {Math.max(1, state.round)}<small>/{state.rounds}</small></span>
        <ScoreChips room={room} players={state.players} score={state.score} dim={fouled} me={me} />
      </div>
      <button className={`qd-arena ${mood} ${iFouled ? 'fouled' : ''}`} onPointerDown={(e) => { e.preventDefault(); tap() }} disabled={spectator} aria-label="Tap to draw">
        <svg className="qd-scene" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" aria-hidden>
          <circle className="qd-sun" cx="300" cy="80" r="40" />
          <path className="qd-mesa" d="M0 150 L40 150 L52 110 L120 110 L132 150 L260 150 L270 124 L330 124 L340 150 L400 150 L400 200 L0 200Z" />
          <path className="qd-ground" d="M0 162 Q100 154 200 162 T400 162 L400 200 L0 200Z" />
          <g className="qd-cactus"><rect x="60" y="120" width="14" height="50" rx="7" /><rect x="46" y="132" width="10" height="20" rx="5" /><rect x="78" y="128" width="10" height="18" rx="5" /></g>
        </svg>
        {fake && FAKES[fake.what] && (
          <div key={fake.k} className={`qd-fake ${fake.what}`} aria-hidden>
            {fake.what === 'bird' ? (
              <svg viewBox="0 0 60 30"><path d="M2 18 Q16 2 30 18 Q44 2 58 18" stroke="#1d3a6e" strokeWidth="5" fill="none" strokeLinecap="round" /></svg>
            ) : fake.what === 'dust' ? (
              <svg viewBox="0 0 60 60"><g fill="#c9a26b"><circle cx="20" cy="36" r="14" /><circle cx="38" cy="30" r="16" /><circle cx="30" cy="44" r="12" /></g></svg>
            ) : (
              <svg viewBox="0 0 60 60"><g stroke="#8a6b3d" strokeWidth="4" fill="none"><circle cx="30" cy="30" r="24" /><path d="M10 22 Q30 40 50 20 M14 42 Q30 18 48 42 M30 6 Q22 30 30 54" /></g></svg>
            )}
          </div>
        )}
        <div className="qd-call display">{call}</div>
        {phase === 'draw' && myMs != null && <div className="qd-mine display">{myMs} ms</div>}
        {phase === 'draw' && !iFouled && myMs == null && !spectator && <div className="qd-sub">TAP!</div>}
        {phase === 'wait' && !iFouled && !spectator && <div className="qd-sub">Tapping now fouls you out</div>}
      </button>
      <div className="qd-result">
        {phase === 'result' ? (
          <>
            <b className="display" style={{ color: winner ? playerHex(room, winner) : 'var(--navy)' }}>
              {winner ? (winner === me ? 'You were fastest!' : `${name(winner)} was fastest!`) : 'Nobody drew clean!'}
            </b>
            <div className="qd-times">
              {Object.entries(taps).sort((a, b) => a[1] - b[1]).map(([pid, ms]) => (
                <span key={pid} className="display" style={{ background: playerHex(room, pid) }}>{name(pid)} {ms}ms</span>
              ))}
              {fouled.map((pid) => <span key={pid} className="display foul">{name(pid)} foul</span>)}
            </div>
          </>
        ) : (
          <span className="qd-waiting">{tapped.length ? `${tapped.map(name).join(', ')} drew` : ' '}</span>
        )}
      </div>
    </div>
  )
}
