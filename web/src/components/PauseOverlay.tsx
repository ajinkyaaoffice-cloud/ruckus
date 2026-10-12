import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Avatar from './Avatar'
import { endBreak, endGame, playOn, PLAYER_HEX, resumeGame, serverNow, waitMore, type PauseInfo, type Room } from '../lib/net'
import { lowPower } from '../lib/perf'
import { sfx } from '../lib/sound'
import './PauseOverlay.css'

/** Covers the board while the game is frozen, either because the host paused
    it or while it waits for dropped players (who, and how long their seat is
    held), then a 3-2-1 once play is about to pick up again. */
export default function PauseOverlay({ pause, room, me }: { pause: PauseInfo; room: Room; me: string }) {
  const canStandIn = !!pause.standIn
  const ref = useRef<HTMLDivElement>(null)
  const [, tick] = useState(0)
  // server stamps are converted with this message's own `now`, so a wrong phone clock can't skew it
  const skew = useRef(0)
  useEffect(() => { skew.current = pause.now * 1000 - serverNow() }, [pause])

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])

  useLayoutEffect(() => {
    const el = ref.current!
    const tl = gsap.timeline()
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 })
      .fromTo(el.querySelector('.po-card'), { scale: 0.6, rotate: -8, autoAlpha: 0 }, { scale: 1, rotate: -2, autoAlpha: 1, duration: 0.5, ease: 'back.out(2.4)' }, 0.05)
    return () => { tl.kill() }
  }, [])

  const now = serverNow() + skew.current
  const resumeIn = pause.resumeAt != null ? Math.max(0, pause.resumeAt * 1000 - now) / 1000 : null
  const away = pause.away ?? []
  const back = resumeIn != null && pause.waiting.length === 0 && away.length === 0 && !pause.held
  const isHost = room.host === me
  const holder = pause.held === me ? 'You' : room.players.find((p) => p.id === pause.held)?.name ?? 'The host'
  const end = () => {
    if (!confirm('End this game for everyone? Nobody scores.')) return
    sfx.slam()
    endGame()
  }
  const n = back ? Math.max(1, Math.ceil(resumeIn!)) : 0

  // a tick sound on each number of the resume countdown
  const lastN = useRef(0)
  useEffect(() => {
    if (back && n !== lastN.current) { lastN.current = n; sfx.tick() }
  }, [back, n])

  return (
    <div ref={ref} className={`po ${lowPower ? 'flat' : ''}`} role="alertdialog" aria-live="assertive">
      <div className="po-card">
        <span className="po-tag display">{back ? 'Resuming' : 'Game paused'}</span>
        {back ? (
          <>
            <div key={n} className="po-count display">{n}</div>
            <p className="po-sub">Get ready — picking up exactly where you left off</p>
          </>
        ) : (
          <>
            {pause.held && (
              <p className="po-held"><b>{holder}</b> paused the game{pause.held === me ? '' : ' for everyone'}.</p>
            )}
            {(pause.waiting.length > 0 || away.length > 0) && <ul className="po-list">
              {pause.waiting.map((w) => {
                const idx = room.players.findIndex((p) => p.id === w.id)
                const p = room.players[idx]
                const left = Math.max(0, Math.ceil((w.until * 1000 - now) / 1000))
                return (
                  <li key={w.id} style={{ ['--pc' as string]: PLAYER_HEX[Math.max(0, idx) % PLAYER_HEX.length] }}>
                    <span className="po-face">{p && <Avatar config={p.avatar} size="100%" track="none" expression="sad" />}</span>
                    <span className="po-who">
                      <b>{w.id === me ? 'You' : p?.name ?? 'Someone'}</b>
                      <small>lost connection</small>
                    </span>
                    <span className="po-timer display" title="Seat held for">
                      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
                    </span>
                    {isHost && w.id !== me && (
                      <span className="po-host">
                        <button className="po-mini" onClick={() => { sfx.click(); waitMore(w.id) }} title="Hold their seat a minute longer">+1 min</button>
                        <button className="po-mini go" onClick={() => { sfx.click(); playOn(w.id) }}
                          title={canStandIn ? 'A stand-in plays for them until they’re back' : 'They forfeit and the game carries on'}>
                          Play on
                        </button>
                      </span>
                    )}
                  </li>
                )
              })}
              {away.map((id) => {
                const idx = room.players.findIndex((p) => p.id === id)
                const p = room.players[idx]
                return (
                  <li key={id} style={{ ['--pc' as string]: PLAYER_HEX[Math.max(0, idx) % PLAYER_HEX.length] }}>
                    <span className="po-face">{p && <Avatar config={p.avatar} size="100%" track="none" expression="idle" />}</span>
                    <span className="po-who">
                      <b>{id === me ? 'You' : p?.name ?? 'Someone'}</b>
                      <small>on a break</small>
                    </span>
                    {id === me && <button className="po-mini go" onClick={() => { sfx.click(); endBreak() }}>I’m back</button>}
                  </li>
                )
              })}
            </ul>}
            {pause.waiting.length > 0
              ? <p className="po-sub">
                  Everything is frozen until they’re back. If the timer runs out, they forfeit and the game carries on.
                  {isHost && ' You can give them longer, or play on without them.'}
                </p>
              : away.length > 0
              ? <p className="po-sub">This game can’t be played for them, so it waits until they’re back.</p>
              : <p className="po-sub">{isHost ? 'Nothing moves until you resume.' : 'Nothing moves until the host resumes. Hang tight!'}</p>}
            {isHost && pause.held && (
              <div className="po-actions">
                <button className="bubble-btn magenta" onClick={() => { sfx.click(); resumeGame() }} autoFocus>Resume</button>
                <button className="bubble-btn navy" onClick={end}>End game</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
