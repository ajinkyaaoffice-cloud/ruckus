import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Avatar from './Avatar'
import Glyph from './Glyph'
import { Reaction, REACTIONS } from './Reactions'
import type { Expression } from '../lib/avatar'
import { emote, PLAYER_HEX, useNet, type RoomPlayer } from '../lib/net'
import { sfx } from '../lib/sound'
import './Players.css'


export function PlayerChip({ p, index, host, active, expression, compact, extra }: {
  p: RoomPlayer; index: number; host?: boolean; active?: boolean; expression?: Expression; compact?: boolean; extra?: React.ReactNode
}) {
  const me = useNet((s) => s.profile.pid) === p.id
  return (
    <div className={`pchip ${active ? 'active' : ''} ${compact ? 'compact' : ''} ${p.connected ? '' : 'away'}`} data-player={p.id}
      style={{ ['--pc' as string]: PLAYER_HEX[index % PLAYER_HEX.length] }}>
      <div className="pchip-face">
        <Avatar config={p.avatar} size="100%" track={compact ? 'idle' : 'mouse'} expression={expression ?? (active ? 'focus' : 'idle')} badge />
        {host && <span className="pchip-crown" title="Host"><Glyph name="star" color="#ffb424" size={26} /></span>}
      </div>
      <div className="pchip-meta">
        <span className="pchip-name">{p.name}{me && <em> (you)</em>}</span>
        {extra ?? (
          <span className="pchip-sub">
            {!p.connected ? 'reconnecting…' : p.status === 'ready' ? <><b className="display">{p.points}</b> pts · <b className="display">{p.wins}</b> wins</> : 'dressing up…'}
          </span>
        )}
      </div>
    </div>
  )
}

type Pop = { key: number; id: string; x: number; y: number; name: string; color: string }

/** In-house reaction stickers that burst out of whichever player sent them. */
export function EmoteLayer() {
  const emotes = useNet((s) => s.emotes)
  const room = useNet((s) => s.room)
  const seen = useRef(new Set<number>())
  const [pops, setPops] = useState<Pop[]>([])
  useEffect(() => {
    const fresh: Pop[] = []
    for (const e of emotes) {
      if (seen.current.has(e.key)) continue
      seen.current.add(e.key)
      const host = document.querySelector(`[data-player="${e.pid}"]`)
      const r = host?.getBoundingClientRect()
      const idx = room?.players.findIndex((p) => p.id === e.pid) ?? 0
      fresh.push({
        key: e.key, id: e.emoji,
        x: r ? r.left + r.width / 2 : window.innerWidth / 2,
        y: r ? r.top + r.height / 2 : window.innerHeight - 90,
        name: room?.players.find((p) => p.id === e.pid)?.name ?? '',
        color: PLAYER_HEX[Math.max(0, idx) % PLAYER_HEX.length],
      })
    }
    if (fresh.length) {
      sfx.pop()
      setPops((p) => [...p.slice(-10), ...fresh])
    }
  }, [emotes]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="emote-layer" aria-hidden>
      {pops.map((p) => <PopSticker key={p.key} pop={p} onDone={() => setPops((all) => all.filter((x) => x.key !== p.key))} />)}
    </div>
  )
}

function PopSticker({ pop, onDone }: { pop: Pop; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    const dx = gsap.utils.random(-70, 70)
    const tl = gsap.timeline({ onComplete: onDone })
    tl.fromTo(el, { scale: 0, rotate: -50, x: 0, y: 0 }, { scale: 1, rotate: gsap.utils.random(-12, 12), duration: 0.5, ease: 'back.out(3.5)' })
      .fromTo(el.querySelectorAll('.emote-ray'), { scale: 0, opacity: 1 }, { scale: 1.4, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.03 }, 0.05)
      .to(el, { y: -150 - Math.random() * 70, x: dx, duration: 1.6, ease: 'power1.out' }, 0.25)
      .to(el, { rotate: dx > 0 ? 14 : -14, duration: 0.4, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.4)
      .to(el, { scale: 0, rotate: '+=40', duration: 0.3, ease: 'back.in(2)' }, '-=0.3')
    return () => { tl.kill() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className="emote-pop" style={{ left: pop.x, top: pop.y, ['--pc' as string]: pop.color }}>
      {Array.from({ length: 8 }, (_, i) => <i key={i} className="emote-ray" style={{ rotate: `${i * 45}deg` }} />)}
      <Reaction id={pop.id} size={78} className="emote-art" />
      {pop.name && <span className="emote-who">{pop.name}</span>}
    </div>
  )
}

export function EmoteBar({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact)
  const fire = (id: string) => {
    emote(id)
    if (compact) setOpen(false)
  }
  return (
    <div className={`emote-bar ${compact ? 'compact' : ''} ${open ? 'open' : ''}`}>
      {compact && (
        <button className="emote-toggle" onClick={() => { sfx.click(); setOpen((o) => !o) }} aria-label="Reactions" data-cursor="REACT">
          {open ? <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" /></svg> : <Reaction id="lol" size={34} />}
        </button>
      )}
      <div className="emote-list">
        {REACTIONS.map((r, i) => (
          <button key={r.id} onClick={() => fire(r.id)} aria-label={r.label} data-cursor={r.label.toUpperCase()} style={{ transitionDelay: open ? `${i * 25}ms` : '0ms' }}>
            <Reaction id={r.id} size={36} />
          </button>
        ))}
      </div>
    </div>
  )
}
