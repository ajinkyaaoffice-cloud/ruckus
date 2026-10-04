import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import Glyph, { type GlyphName } from './Glyph'
import { useTransition } from './Transition'
import { joinUrl } from './Invite'
import { pushProfile, useNet } from '../lib/net'
import { randomAvatar } from '../lib/avatar'
import { confetti, scrollToTarget, useUi } from '../lib/ui'
import { isMuted, setMuted, sfx } from '../lib/sound'
import './ContextMenu.css'

type Entry = { label: string; glyph: GlyphName; color: string; run: () => void; hint?: string } | 'sep'

/**
 * Right-click menu in the Ruckus style. Hold Shift (or right-click inside a
 * text field) to get the browser's own menu instead.
 */
export default function ContextMenu() {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const { go } = useTransition()
  const navigate = useNavigate()
  const loc = useLocation()
  const room = useNet((s) => s.room)

  useEffect(() => {
    const open = (e: MouseEvent) => {
      const t = e.target as Element
      if (e.shiftKey || t.closest('input, textarea, [contenteditable=true]')) return
      e.preventDefault()
      sfx.pop()
      setCopied(false)
      setAt({ x: e.clientX, y: e.clientY })
    }
    const close = () => setAt(null)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('contextmenu', open)
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) close() }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('blur', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('contextmenu', open)
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('wheel', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', key)
    }
  }, [])

  useEffect(() => setAt(null), [loc.pathname])

  useLayoutEffect(() => {
    if (!at || !box.current) return
    const el = box.current
    // keep it on screen, open toward the roomier side
    const w = el.offsetWidth, h = el.offsetHeight
    const left = at.x + w > innerWidth - 8 ? at.x - w : at.x
    const top = at.y + h > innerHeight - 8 ? Math.max(8, at.y - h) : at.y
    gsap.set(el, { left, top, transformOrigin: `${at.x - left}px ${at.y - top}px` })
    gsap.fromTo(el, { scale: 0.2, rotate: -12 }, { scale: 1, rotate: -2, duration: 0.5, ease: 'back.out(2.2)' })
    gsap.from(el.querySelectorAll('.cm-row'), { x: -24, opacity: 0, duration: 0.3, stagger: 0.03, ease: 'power3.out', delay: 0.05 })
  }, [at])

  if (!at) return null

  const done = (fn: () => void) => () => { sfx.click(); setAt(null); fn() }
  const entries: Entry[] = [
    { label: 'Back', glyph: 'arc', color: '#45b8ff', hint: '←', run: done(() => navigate(-1)) },
    { label: 'Home', glyph: 'heart', color: '#ff9a62', run: done(() => (loc.pathname === '/' ? scrollToTarget(0) : go('/', { label: 'HOME', reverse: true }))) },
    { label: 'Open menu', glyph: 'squiggle', color: '#e64fe0', run: done(() => useUi.getState().setMenu(true)) },
    'sep',
  ]
  if (room) {
    entries.push({
      label: copied ? 'Copied!' : `Copy invite · ${room.code}`, glyph: 'o', color: '#a7ecff',
      run: () => {
        sfx.click()
        joinUrl(room.code).then((u) => navigator.clipboard?.writeText(u)).then(() => { setCopied(true); setTimeout(() => setAt(null), 600) }).catch(() => setAt(null))
      },
    })
  }
  entries.push(
    {
      label: 'Shuffle my look', glyph: 'star', color: '#ffb424', run: done(() => {
        useNet.getState().setProfile({ avatar: randomAvatar() })
        if (useNet.getState().room) pushProfile()
      }),
    },
    { label: 'Confetti!', glyph: 'burst', color: '#d9f66b', run: done(() => confetti(at.x, at.y, 36)) },
    { label: isMuted() ? 'Sound on' : 'Mute sounds', glyph: 'bolt', color: '#a596ff', run: done(() => setMuted(!isMuted())) },
    'sep',
    { label: 'Reload', glyph: 'plus', color: '#f6b8f7', run: done(() => location.reload()) },
  )

  return (
    <div ref={box} className="cm" role="menu" onContextMenu={(e) => e.preventDefault()}>
      {entries.map((e, i) => e === 'sep' ? <div key={i} className="cm-sep" /> : (
        <button key={i} role="menuitem" className="cm-row" onClick={e.run} onMouseEnter={() => sfx.hover()}>
          <span className="cm-ico" style={{ background: e.color }}><Glyph name={e.glyph} color="#1d3a6e" size={16} strokeWidth={18} /></span>
          <span className="cm-label">{e.label}</span>
          {e.hint && <span className="cm-hint">{e.hint}</span>}
        </button>
      ))}
      <div className="cm-foot serif">shift + right-click for the usual menu</div>
    </div>
  )
}
