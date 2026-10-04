import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Avatar from './Avatar'
import { PLAYER_HEX, serverNow, type PauseInfo, type Room } from '../lib/net'
import { lowPower } from '../lib/perf'
import { sfx } from '../lib/sound'
import './PauseOverlay.css'

/** Covers the board while the game waits for dropped players: who it's waiting
    on, how long their seat is held, then a 3-2-1 once everyone is back. */
export default function PauseOverlay({ pause, room, me }: { pause: PauseInfo; room: Room; me: string }) {
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
  const back = resumeIn != null && pause.waiting.length === 0
  const n = back ? Math.max(1, Math.ceil(resumeIn!)) : 0

  // a tick sound on each number of the resume countdown
  const lastN = useRef(0)
  useEffect(() => {
    if (back && n !== lastN.current) { lastN.current = n; sfx.tick() }
  }, [back, n])

  return (
    <div ref={ref} className={`po ${lowPower ? 'flat' : ''}`} role="alertdialog" aria-live="assertive">
      <div className="po-card">
        <span className="po-tag display">{back ? 'Everyone’s back' : 'Game paused'}</span>
        {back ? (
          <>
            <div key={n} className="po-count display">{n}</div>
            <p className="po-sub">Get ready — picking up exactly where you left off</p>
          </>
        ) : (
          <>
            <ul className="po-list">
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
                  </li>
                )
              })}
            </ul>
            <p className="po-sub">Everything is frozen until they’re back. If the timer runs out, they forfeit and the game carries on.</p>
          </>
        )}
      </div>
    </div>
  )
}
