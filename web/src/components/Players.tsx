import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Avatar from './Avatar'
import Glyph from './Glyph'
import type { Expression } from '../lib/avatar'
import { emote, PLAYER_HEX, useNet, type RoomPlayer } from '../lib/net'
import { sfx } from '../lib/sound'
import './Players.css'

export const EMOJIS = ['🔥', '😂', '😱', '👏', '😤', '💀', '🎉', '🤯']

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

/** Floating emoji reactions that rise out of whichever player sent them. */
export function EmoteLayer() {
  const emotes = useNet((s) => s.emotes)
  const seen = useRef(new Set<number>())
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    for (const e of emotes) {
      if (seen.current.has(e.key)) continue
      seen.current.add(e.key)
      const host = document.querySelector(`[data-player="${e.pid}"]`)
      const r = host?.getBoundingClientRect()
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2
      const y = r ? r.top + 20 : window.innerHeight - 80
      const el = document.createElement('div')
      el.className = 'emote-pop'
      el.textContent = e.emoji
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      layer.current?.appendChild(el)
      sfx.pop()
      gsap.timeline({ onComplete: () => el.remove() })
        .fromTo(el, { scale: 0, rotate: -40 }, { scale: 1.6, rotate: 10, duration: 0.4, ease: 'back.out(3)' })
        .to(el, { y: -160 - Math.random() * 80, x: gsap.utils.random(-60, 60), rotate: gsap.utils.random(-30, 30), duration: 1.4, ease: 'power1.out' }, 0.1)
        .to(el, { scale: 0, duration: 0.3, ease: 'back.in(2)' }, '-=0.3')
    }
  }, [emotes])
  return <div ref={layer} className="emote-layer" aria-hidden />
}

export function EmoteBar({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact)
  const fire = (e: string) => {
    emote(e)
    if (compact) setOpen(false)
  }
  return (
    <div className={`emote-bar ${compact ? 'compact' : ''} ${open ? 'open' : ''}`}>
      {compact && (
        <button className="emote-toggle" onClick={() => { sfx.click(); setOpen((o) => !o) }} aria-label="Reactions" data-cursor="REACT">
          {open ? '✕' : '😄'}
        </button>
      )}
      <div className="emote-list">
        {EMOJIS.map((e, i) => (
          <button key={e} onClick={() => fire(e)} aria-label={`React ${e}`} style={{ transitionDelay: open ? `${i * 25}ms` : '0ms' }}>{e}</button>
        ))}
      </div>
    </div>
  )
}
