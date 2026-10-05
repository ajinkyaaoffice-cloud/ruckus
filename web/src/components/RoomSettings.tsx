import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import { configureRoom, kickPlayer, makeHost, MAX_PLAYERS, resetScores, unbanAll, useNet, type RoomSettings as Settings } from '../lib/net'
import { sfx } from '../lib/sound'
import Avatar from './Avatar'
import './RoomSettings.css'

const GRACE = [
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
]

/** The host's control panel for the room: who gets in, how games run, and the people in it. */
export default function RoomSettings({ onClose }: { onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const room = useNet((s) => s.room)!
  const me = useNet((s) => s.profile.pid)
  const s = room.settings
  // destructive buttons need a second tap; this holds which one is armed
  const [armed, setArmed] = useState<string | null>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.rset-sheet', ...intro({ scale: 0.5, rotate: -8, y: 120, duration: 0.6, ease: 'back.out(1.7)' }))
      gsap.fromTo('.rset-group', ...intro({ y: 30, duration: 0.45, ease: 'back.out(2)', stagger: 0.05, delay: 0.15 }))
    }, root)
    return () => ctx.revert()
  }, [])

  const set = (patch: Partial<Settings>) => {
    sfx.click()
    configureRoom(patch)
  }
  const confirm = (key: string, fn: () => void) => {
    if (armed === key) {
      sfx.slam()
      setArmed(null)
      fn()
    } else {
      sfx.click()
      setArmed(key)
    }
  }

  const others = room.players.filter((p) => p.id !== me)

  return (
    <div ref={root} className="ss-modal" onClick={onClose}>
      <div className="rset-sheet" role="dialog" aria-modal="true" aria-label="Room settings" onClick={(e) => { e.stopPropagation(); if (armed) setArmed(null) }}>
        <header className="rset-head">
          <h2 className="display">Room settings</h2>
          <span className="rset-badge">Host only</span>
          <button className="rset-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div className="rset-body">
          <section className="rset-group">
            <h3 className="display">Who can join</h3>
            <Toggle label="Lock the room" hint="New people can’t join. Anyone already in can still reconnect." on={s.locked} onChange={(v) => set({ locked: v })} />
            <Row label="Room size" hint={`${room.players.length} in now`}>
              <div className="rset-stepper">
                <button onClick={() => set({ maxPlayers: s.maxPlayers - 1 })} disabled={s.maxPlayers <= 2} aria-label="Fewer seats">−</button>
                <span className="display">{s.maxPlayers}</span>
                <button onClick={() => set({ maxPlayers: s.maxPlayers + 1 })} disabled={s.maxPlayers >= MAX_PLAYERS} aria-label="More seats">+</button>
              </div>
            </Row>
            {room.banned.length > 0 && (
              <Row label="Kicked players" hint={room.banned.map((b) => b.name).join(', ')}>
                <button className="rset-btn" onClick={() => { sfx.click(); unbanAll() }}>Let them back</button>
              </Row>
            )}
          </section>

          <section className="rset-group">
            <h3 className="display">Games</h3>
            <Toggle label="Anyone can pick games" hint="Off: only you start games and rematches." on={s.anyonePicks} onChange={(v) => set({ anyonePicks: v })} />
            <Toggle label="Pause when someone drops" hint="Off: the game carries on and their turns time out." on={s.pauseOnDrop} onChange={(v) => set({ pauseOnDrop: v })} />
            <Row label="Wait for reconnects" hint="How long a dropped player keeps their seat.">
              <div className="ss-choices rset-choices">
                {GRACE.map((g) => (
                  <button key={g.value} className={`ss-choice ${s.grace === g.value ? 'on' : ''}`} onClick={() => set({ grace: g.value })}>{g.label}</button>
                ))}
              </div>
            </Row>
            <Toggle label="Winner celebration" hint="The animated reveal before the podium. Off: straight to results." on={s.reel ?? true} onChange={(v) => set({ reel: v })} />
            <Toggle label="Emotes" hint="Reactions and emote showers for everyone." on={s.emotes} onChange={(v) => set({ emotes: v })} />
          </section>

          <section className="rset-group">
            <h3 className="display">Players</h3>
            {others.length === 0 && <p className="rset-hint">Nobody else here yet.</p>}
            {others.map((p) => (
              <div key={p.id} className="rset-player">
                <Avatar config={p.avatar} size={40} track="none" badge />
                <span className="rset-pname">
                  <b>{p.name}</b>
                  <small>{p.connected ? (p.status === 'ready' ? 'Ready' : 'Dressing up') : 'Reconnecting…'}</small>
                </span>
                <button className="rset-btn" onClick={(e) => { e.stopPropagation(); confirm(`host:${p.id}`, () => makeHost(p.id)) }}>
                  {armed === `host:${p.id}` ? 'Sure?' : 'Make host'}
                </button>
                <button className="rset-btn danger" onClick={(e) => { e.stopPropagation(); confirm(`kick:${p.id}`, () => kickPlayer(p.id)) }}>
                  {armed === `kick:${p.id}` ? 'Kick!' : 'Kick'}
                </button>
              </div>
            ))}
          </section>

          <section className="rset-group">
            <h3 className="display">Scoreboard</h3>
            <Row label="Reset scores" hint="Clears points, wins and the played list for everyone.">
              <button className="rset-btn danger" onClick={(e) => { e.stopPropagation(); confirm('reset', resetScores) }}>
                {armed === 'reset' ? 'Really reset?' : 'Reset'}
              </button>
            </Row>
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rset-row">
      <span className="rset-label">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </div>
  )
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label} hint={hint}>
      <button role="switch" aria-checked={on} aria-label={label} className={`rset-switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
        <i />
      </button>
    </Row>
  )
}
