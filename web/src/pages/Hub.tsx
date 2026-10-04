import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { BrushMarks, Logo, Split, TopBar } from '../components/Chrome'
import GameArt from '../components/GameArt'
import Glyph from '../components/Glyph'
import Avatar from '../components/Avatar'
import InviteModal, { InviteCard } from '../components/Invite'
import { EmoteBar, EmoteLayer, PlayerChip } from '../components/Players'
import { useTransition } from '../components/Transition'
import { CATALOG, gameMeta, type GameMeta } from '../lib/catalog'
import { leaveRoom, startGame, useNet } from '../lib/net'
import { sfx } from '../lib/sound'
import './Hub.css'

export default function Hub() {
  const root = useRef<HTMLDivElement>(null)
  const room = useNet((s) => s.room)!
  const pid = useNet((s) => s.profile.pid)
  const { go } = useTransition()
  const [invite, setInvite] = useState(false)
  const [picked, setPicked] = useState<GameMeta | null>(null)
  const isHost = room.host === pid
  const ready = room.players.filter((p) => p.status === 'ready' && p.connected)
  const ranked = [...room.players].sort((a, b) => b.points - a.points || b.wins - a.wins)
  const leader = ranked[0] && ranked[0].points > 0 ? ranked[0].id : null

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.2 })
      tl.from('.hub-title .split-char', { yPercent: 140, rotate: () => gsap.utils.random(-30, 30), duration: 0.7, ease: 'back.out(2.2)', stagger: 0.025 })
        .from('.hub-players > *', { y: -140, rotate: (i) => (i % 2 ? 20 : -20), duration: 0.8, ease: 'back.out(1.8)', stagger: 0.1 }, 0.1)
        .from('.hub-card', { y: 200, rotate: () => gsap.utils.random(-25, 25), scale: 0.5, duration: 0.8, ease: 'back.out(1.6)', stagger: { each: 0.05, from: 'start' } }, 0.25)
        .from('.hub-side > *', { x: 300, rotate: 10, duration: 0.8, ease: 'expo.out', stagger: 0.1 }, 0.4)
        .from('.hub-dock > *', { y: 120, duration: 0.7, ease: 'back.out(2)', stagger: 0.08 }, 0.6)
    }, root)
    return () => ctx.revert()
  }, [])

  // tilt cards toward the pointer
  const tilt = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    gsap.to(el, { rotateY: x * 16, rotateX: -y * 16, duration: 0.4, ease: 'power2.out' })
  }
  const untilt = (e: React.PointerEvent<HTMLElement>) => gsap.to(e.currentTarget, { rotateY: 0, rotateX: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' })

  const choose = (g: GameMeta) => {
    if (!isHost) {
      sfx.bad()
      useNet.setState({ error: { msg: 'Only the host picks — nudge them with an emote!', key: Date.now() } })
      return
    }
    if (ready.length < g.min) {
      sfx.bad()
      useNet.setState({ error: { msg: `${g.name} needs ${g.min} ready players`, key: Date.now() } })
      return
    }
    sfx.click()
    setPicked(g)
  }

  const leave = () => {
    leaveRoom()
    go('/play', { label: 'BYE!', reverse: true })
  }

  const empty = Math.max(0, 3 - room.players.length)

  return (
    <div ref={root} className="hub">
      <BrushMarks />
      <EmoteLayer />
      <TopBar
        left={<Logo small onClick={leave} />}
        right={
          <>
            <button className="bubble-btn small hub-code" onClick={() => { sfx.click(); setInvite(true) }} data-cursor="INVITE">
              <span className="display">{room.code}</span>
              <svg className="ico" viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 15h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
            </button>
            <button className="bubble-btn small navy" onClick={leave} data-cursor="LEAVE">Leave</button>
          </>
        }
      />

      <div className="hub-main">
        <section className="hub-players">
          {room.players.map((p, i) => (
            <PlayerChip key={p.id} p={p} index={i} host={room.host === p.id}
              expression={leader === p.id ? 'happy' : undefined} />
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <button key={`e${i}`} className="hub-empty" onClick={() => setInvite(true)} data-cursor="INVITE">
              <Glyph name="plus" color="#1d3a6e" size={28} />
              <span>Invite a friend</span>
            </button>
          ))}
        </section>

        <div className="hub-head">
          <h1 className="hub-title display" key={isHost ? 'h' : 'g'}>
            <Split text={isHost ? 'Pick a game' : 'Host is picking'} />
          </h1>
          <p className="hub-hint">
            {ready.length} ready · {isHost ? 'tap a card to set it up' : 'react while you wait'}
            {room.players.some((p) => p.status !== 'ready') && ' · someone is still dressing up'}
          </p>
        </div>

        <section className="hub-grid">
          {CATALOG.map((g) => {
            const locked = ready.length < g.min
            const sitOut = ready.length > g.max
            return (
              <button key={g.id} className={`hub-card ${locked ? 'locked' : ''}`} style={{ background: g.bg, color: g.ink }}
                onPointerMove={tilt} onPointerLeave={untilt} onClick={() => choose(g)} onMouseEnter={() => sfx.hover()}
                data-cursor={isHost && !locked ? 'PLAY' : undefined}>
                <div className="hc-top">
                  <span className="hc-tag">{g.tag}</span>
                  <span className="hc-p display">{g.min === g.max ? g.min : `${g.min}-${g.max}`}P</span>
                </div>
                <GameArt id={g.id} className="hc-art" />
                <h3 className="display">{g.name}</h3>
                {locked && <span className="hc-flag">Needs {g.min} ready</span>}
                {!locked && sitOut && <span className="hc-flag soft">{ready.length - g.max} sits out</span>}
              </button>
            )
          })}
        </section>
      </div>

      <aside className="hub-side">
        <div className="hub-panel score">
          <h4 className="display">Scoreboard</h4>
          {ranked.map((p, i) => (
            <div key={p.id} className="sb-row">
              <span className="sb-rank display">{i + 1}</span>
              <Avatar config={p.avatar} size={34} track="none" badge />
              <span className="sb-name">{p.name}</span>
              <span className="sb-pts display">{p.points}</span>
            </div>
          ))}
          <p className="sb-legend">win 3 · 2nd of 3 gets 1 · draw 1</p>
        </div>
        <div className="hub-panel history">
          <h4 className="display">Played</h4>
          {room.history.length === 0 && <p className="sb-legend">Nothing yet. Make history.</p>}
          {[...room.history].reverse().slice(0, 6).map((h, i) => {
            const winners = room.players.filter((p) => h.winners.includes(p.id))
            return (
              <div key={i} className="hist-row">
                <span className="hist-game">{gameMeta(h.game)?.name ?? h.game}</span>
                <span className="hist-win">
                  {h.tie ? 'Draw' : winners.length ? winners.map((w) => <Avatar key={w.id} config={w.avatar} size={26} track="none" badge />) : '—'}
                </span>
              </div>
            )
          })}
        </div>
        {room.players.length < 3 && (
          <div className="hub-panel qr">
            <h4 className="display">Scan to join</h4>
            <InviteCard code={room.code} />
          </div>
        )}
      </aside>

      <div className="hub-dock">
        <EmoteBar />
        <button className="bubble-btn" onClick={() => go(`/room/${room.code}/avatar`, { label: 'DRESS UP!' })} data-cursor="EDIT">
          <Glyph name="heart" color="#e64fe0" size={18} /> Edit look
        </button>
      </div>

      {invite && <InviteModal code={room.code} onClose={() => setInvite(false)} />}
      {picked && <StartSheet g={picked} readyCount={ready.length} onClose={() => setPicked(null)} />}
    </div>
  )
}

function StartSheet({ g, readyCount, onClose }: { g: GameMeta; readyCount: number; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [opts, setOpts] = useState<Record<string, unknown>>(() =>
    Object.fromEntries((g.options ?? []).map((o) => [o.key, o.choices[g.id === 'pong' ? 1 : 0].value])))
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.ss-sheet', { scale: 0.4, rotate: -20, y: 160, duration: 0.7, ease: 'back.out(1.7)' })
      gsap.from('.ss-art', { scale: 0, rotate: 90, duration: 0.8, ease: 'elastic.out(1, 0.5)', delay: 0.15 })
      gsap.from('.ss-sheet h2 .split-char', { yPercent: 120, stagger: 0.03, duration: 0.5, ease: 'back.out(2)', delay: 0.2 })
    }, root)
    return () => ctx.revert()
  }, [])
  const start = () => {
    sfx.slam()
    startGame(g.id, opts)
    onClose()
  }
  return (
    <div ref={root} className="ss-modal" onClick={onClose}>
      <div className="ss-sheet" style={{ background: g.bg, color: g.ink }} onClick={(e) => e.stopPropagation()}>
        <GameArt id={g.id} className="ss-art" />
        <h2 className="display"><Split text={g.name} /></h2>
        <p>{g.blurb}</p>
        {readyCount > g.max && <p className="ss-note">{readyCount - g.max} player sits this one out and spectates — they get priority next game.</p>}
        {(g.options ?? []).map((o) => (
          <div key={o.key} className="ss-opt">
            <span className="display">{o.label}</span>
            <div className="ss-choices">
              {o.choices.map((c) => (
                <button key={String(c.value)} className={`ss-choice ${opts[o.key] === c.value ? 'on' : ''}`} onClick={() => { sfx.click(); setOpts({ ...opts, [o.key]: c.value }) }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="ss-actions">
          <button className="bubble-btn" onClick={onClose}>Back</button>
          <button className="bubble-btn big magenta" onClick={start} data-cursor="START">Start!</button>
        </div>
      </div>
    </div>
  )
}
