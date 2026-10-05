import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import gsap from 'gsap'
import Glyph, { type GlyphName } from './Glyph'
import Mascot from './Mascot'
import { SoundToggle } from './Chrome'
import { useTransition } from './Transition'
import { endGame, leaveRoom, pauseGame, resumeGame, useNet } from '../lib/net'
import { lockScroll, scrollToTarget, useUi, intro } from '../lib/ui'
import { sfx } from '../lib/sound'
import './Menu.css'

/** Wavy-lines button that morphs into an X while the menu is open. */
export function MenuButton({ className = '' }: { className?: string }) {
  const open = useUi((s) => s.menu)
  const setMenu = useUi((s) => s.setMenu)
  return (
    <button className={`menu-btn ${open ? 'open' : ''} ${className}`} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
      onClick={() => setMenu(!open)} data-cursor={open ? 'CLOSE' : 'MENU'}>
      <svg viewBox="0 0 40 30" width="44" height="34" aria-hidden>
        <path className="mb-l l1" d="M2 6 q5 -5 9 0 t9 0 t9 0 t9 0" />
        <path className="mb-l l2" d="M2 15 q5 -5 9 0 t9 0 t9 0 t9 0" />
        <path className="mb-l l3" d="M2 24 q5 -5 9 0 t9 0 t9 0 t9 0" />
      </svg>
    </button>
  )
}

type Item = { label: string; glyph: GlyphName; color: string; run: () => void; sub?: string }

/** Full-screen menu: two colour circles burst out of the button, giant links slam in. */
export default function Menu() {
  const open = useUi((s) => s.menu)
  const setMenu = useUi((s) => s.setMenu)
  const [shown, setShown] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const { go } = useTransition()
  const loc = useLocation()
  const room = useNet((s) => s.room)
  const game = useNet((s) => s.game)
  const me = useNet((s) => s.profile.pid)
  const onLanding = loc.pathname === '/'

  useEffect(() => {
    if (open) { setShown(true); sfx.open(); lockScroll(true) }
    else if (shown) {
      sfx.close()
      tl.current?.timeScale(1.6).reverse().eventCallback('onReverseComplete', () => setShown(false))
      lockScroll(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!shown) return
    const ctx = gsap.context(() => {
      tl.current = gsap.timeline()
        .fromTo('.mn-c1', { clipPath: 'circle(0% at 40px 40px)' }, { clipPath: 'circle(150% at 40px 40px)', duration: 0.7, ease: 'power3.inOut' })
        .fromTo('.mn-c2', { clipPath: 'circle(0% at 40px 40px)' }, { clipPath: 'circle(150% at 40px 40px)', duration: 0.7, ease: 'power3.inOut' }, 0.12)
        .fromTo('.mn-item', ...intro({ yPercent: 140, rotate: (i: number) => (i % 2 ? 8 : -8), duration: 0.6, ease: 'back.out(1.8)', stagger: 0.06 }), 0.38)
        .fromTo('.mn-glyph', ...intro({ scale: 0, rotate: -180, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.04 }), 0.45)
        .fromTo('.mn-mascot', ...intro({ yPercent: 110, rotate: 20, duration: 0.8, ease: 'back.out(1.6)' }), 0.5)
        .fromTo('.mn-foot > *', ...intro({ y: 40, opacity: 0, duration: 0.4, stagger: 0.06 }), 0.6)
    }, root)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', esc)
    return () => { ctx.revert(); window.removeEventListener('keydown', esc) }
  }, [shown]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMenu(false) }, [loc.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const nav = (to: string, label: string, reverse = false) => () => {
    setMenu(false)
    if (loc.pathname === to) return
    setTimeout(() => go(to, { label, reverse }), 250)
  }
  const section = (sel: string | number) => () => {
    setMenu(false)
    setTimeout(() => scrollToTarget(sel), 350)
  }

  const items: Item[] = [
    { label: 'Home', glyph: 'heart', color: '#ff9a62', run: onLanding ? section(0) : nav('/', 'HOME', true) },
    { label: 'Play', glyph: 'bolt', color: '#d9f66b', run: nav('/play', 'LOBBY!'), sub: 'host or join' },
  ]
  if (onLanding) {
    items.push({ label: 'Games', glyph: 'star', color: '#ffb424', run: section('.games'), sub: 'all eight' })
    items.push({ label: 'Legends', glyph: 'burst', color: '#a7ecff', run: section('.lb'), sub: 'leaderboard' })
  }
  // host-only controls for the game in progress
  if (room && room.host === me && room.phase === 'playing' && game && !game.over) {
    const held = !!game.pause?.held
    items.push(held
      ? { label: 'Resume', glyph: 'bolt', color: '#d9f66b', run: () => { setMenu(false); resumeGame() }, sub: 'unpause for everyone' }
      : { label: 'Pause', glyph: 'squiggle', color: '#a7ecff', run: () => { setMenu(false); pauseGame() }, sub: 'freeze it for everyone' })
    items.push({ label: 'End game', glyph: 'burst', color: '#ff5d73', sub: 'back to the lobby · nobody scores', run: () => {
      if (!confirm('End this game for everyone? Nobody scores.')) return
      setMenu(false)
      endGame()
    } })
  }
  if (room) {
    items.push({ label: `Room ${room.code}`, glyph: 'o', color: '#a7ecff', run: nav(`/room/${room.code}`, 'HUB'), sub: 'back to the hub' })
    items.push({ label: 'My look', glyph: 'x', color: '#f6b8f7', run: nav(`/room/${room.code}/avatar`, 'DRESS UP!'), sub: 'customise' })
    items.push({ label: 'Leave', glyph: 'moon', color: '#ff9a62', run: () => { leaveRoom(); nav('/play', 'BYE!', true)() }, sub: 'exit the room' })
  }

  const hover = (e: React.MouseEvent<HTMLElement>) => {
    sfx.hover()
    gsap.fromTo(e.currentTarget.querySelectorAll('.split-c'), { yPercent: 0 }, { yPercent: -100, duration: 0.35, ease: 'power3.inOut', stagger: 0.018 })
  }

  if (!shown) return null
  return (
    <div ref={root} className="mn" role="dialog" aria-label="Menu">
      <div className="mn-close"><MenuButton /></div>
      <div className="mn-c1" />
      <div className="mn-c2">
        <div className="mn-glyphs" aria-hidden>
          {(['x', 'o', 'star', 'squiggle', 'plus', 'tri'] as GlyphName[]).map((g, i) => (
            <span key={i} className={`mn-glyph g${i}`}><Glyph name={g} color={['#e64fe0', '#a7ecff', '#ffb424', '#d9f66b', '#f6b8f7', '#a596ff'][i]} size={i % 2 ? 60 : 90} /></span>
          ))}
        </div>
        <nav className="mn-list">
          {items.map((it, i) => (
            <button key={it.label} className="mn-item" onClick={() => { sfx.click(); it.run() }} onMouseEnter={hover} data-cursor="GO">
              <span className="mn-num display">0{i + 1}</span>
              <span className="mn-word display" aria-label={it.label}>
                {Array.from(it.label).map((ch, j) => (
                  <span key={j} className="mn-ch"><span className="split-c" data-c={ch === ' ' ? ' ' : ch}>{ch === ' ' ? ' ' : ch}</span></span>
                ))}
              </span>
              <span className="mn-ico"><Glyph name={it.glyph} color={it.color} size={42} /></span>
              {it.sub && <span className="mn-sub serif">{it.sub}</span>}
            </button>
          ))}
        </nav>
        <div className="mn-mascot"><Mascot /></div>
        <div className="mn-foot">
          <SoundToggle />
          <span className="serif">Tiny games for loud friends</span>
          {room && <span className="mn-code display">Room · {room.code}</span>}
        </div>
      </div>
    </div>
  )
}
