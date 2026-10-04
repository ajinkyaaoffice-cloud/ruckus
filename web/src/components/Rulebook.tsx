import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import GameArt from './GameArt'
import { Split } from './Chrome'
import { RULES } from './RuleScenes'
import type { GameMeta } from '../lib/catalog'
import { sfx } from '../lib/sound'
import './Rulebook.css'

/**
 * A little picture book of rules, dressed like the game it explains.
 * Page 0 is the cover; every page after has a looping demo and one short
 * paragraph. Turn pages with the arrows, the dots, a swipe or the keyboard.
 */
export default function Rulebook({ g, onClose }: { g: GameMeta; onClose: () => void }) {
  const book = RULES[g.id]
  const root = useRef<HTMLDivElement>(null)
  const leaf = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const turning = useRef(false)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const total = (book?.pages.length ?? 0) + 1

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.rb-dim', { opacity: 0 }, { opacity: 1, duration: 0.3 })
      gsap.fromTo('.rb', { y: 140, scale: 0.5, rotate: -14 }, { y: 0, scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(1.6)' })
    }, root)
    return () => ctx.revert()
  }, [])

  // each new page settles in: title letters hop, the copy slides up
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.rb-page h3 .split-char', { yPercent: 110 }, { yPercent: 0, duration: 0.45, ease: 'back.out(2.2)', stagger: 0.018, delay: 0.05 })
      gsap.fromTo('.rb-page .rb-copy', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', delay: 0.12 })
      gsap.fromTo('.rb-cover .rb-art', { scale: 0.3, rotate: -40 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1, 0.55)' })
    }, leaf)
    return () => ctx.revert()
  }, [page])

  const close = () => {
    sfx.click()
    gsap.to(root.current!.querySelector('.rb'), { y: 120, scale: 0.6, rotate: 10, opacity: 0, duration: 0.3, ease: 'power3.in', onComplete: onClose })
    gsap.to(root.current!.querySelector('.rb-dim'), { opacity: 0, duration: 0.3 })
  }

  // page turn: the leaf swings away on its spine, the next one swings in
  const turn = (to: number) => {
    if (to < 0 || to >= total || to === page || turning.current) return
    turning.current = true
    sfx.whoosh()
    const dir = to > page ? 1 : -1
    gsap.timeline({ onComplete: () => { turning.current = false } })
      .to(leaf.current, { rotateY: -82 * dir, duration: 0.2, ease: 'power2.in', transformOrigin: dir > 0 ? '0% 50%' : '100% 50%' })
      .add(() => setPage(to))
      .fromTo(leaf.current, { rotateY: 82 * dir, transformOrigin: dir > 0 ? '100% 50%' : '0% 50%' }, { rotateY: 0, duration: 0.42, ease: 'back.out(1.4)' })
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') turn(page + 1)
      else if (e.key === 'ArrowLeft') turn(page - 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  if (!book) return null
  const p = page > 0 ? book.pages[page - 1] : null
  const last = page === total - 1

  return createPortal(
    <div ref={root} className="rb-modal" role="dialog" aria-modal aria-label={`How to play ${g.name}`}>
      <div className="rb-dim" onClick={close} />
      <div className={`rb rb-${g.id}`} style={{ ['--gbg' as string]: g.bg, ['--gink' as string]: g.ink }}
        onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY } }}
        onPointerUp={(e) => {
          const s = swipe.current
          swipe.current = null
          if (!s) return
          const dx = e.clientX - s.x, dy = e.clientY - s.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) turn(page + (dx < 0 ? 1 : -1))
        }}>
        <div className="rb-deco" aria-hidden />
        <header className="rb-head">
          <span className="rb-tag display">How to play</span>
          <button className="rb-x" onClick={close} aria-label="Close rules">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M7 7 L17 17 M17 7 L7 17" /></svg>
          </button>
        </header>

        <div className="rb-spread">
          <div ref={leaf} className="rb-leaf">
            {p ? (
              <div className="rb-page" key={page}>
                <div className="rb-scene"><p.Scene /></div>
                <span className="rb-step display">{page}<small>/{total - 1}</small></span>
                <h3 className="display"><Split text={p.title} /></h3>
                <p className="rb-copy">{p.text}</p>
              </div>
            ) : (
              <div className="rb-page rb-cover" key="cover">
                <GameArt id={g.id} className="rb-art" />
                <h2 className="display"><Split text={g.name} /></h2>
                <p className="rb-goal rb-copy"><b>The goal:</b> {book.goal}</p>
                <p className="rb-meta rb-copy">
                  <span>{g.min === g.max ? g.min : `${g.min}–${g.max}`} players</span>
                  <span>{book.pages.length} quick pages</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="rb-foot">
          <button className="rb-nav" onClick={() => turn(page - 1)} disabled={page === 0} aria-label="Previous page">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M15 5 L8 12 L15 19" /></svg>
          </button>
          <div className="rb-pips">
            {Array.from({ length: total }, (_, i) => (
              <button key={i} className={i === page ? 'on' : ''} onClick={() => turn(i)} aria-label={i ? `Page ${i}` : 'Cover'} />
            ))}
          </div>
          {last ? (
            <button className="rb-go display" onClick={close}>Got it!</button>
          ) : (
            <button className="rb-nav next" onClick={() => turn(page + 1)} aria-label="Next page">
              <svg viewBox="0 0 24 24" aria-hidden><path d="M9 5 L16 12 L9 19" /></svg>
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
