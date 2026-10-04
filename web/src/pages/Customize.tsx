import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import Avatar from '../components/Avatar'
import Glyph from '../components/Glyph'
import { BrushMarks, Split, TopBar } from '../components/Chrome'
import { useTransition } from '../components/Transition'
import { CATEGORIES, LOOK_LABELS, randomAvatar, type AvatarConfig, type Category } from '../lib/avatar'
import { pushProfile, useNet } from '../lib/net'
import { sfx } from '../lib/sound'
import './Customize.css'

const SPOTS: Record<string, [number, number]> = {
  look: [50, 0], hat: [24, 9], hair: [76, 9], eyes: [12, 27], extra: [88, 28], detail: [6, 50],
  nose: [94, 50], brows: [12, 72], face: [88, 72], beard: [24, 92], mouth: [76, 92], top: [50, 99],
}

export default function Customize() {
  const code = (useParams().code ?? '').toUpperCase()
  const root = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const { go } = useTransition()
  const profile = useNet((s) => s.profile)
  const setProfile = useNet((s) => s.setProfile)
  const room = useNet((s) => s.room)
  const [cat, setCat] = useState<Category | null>(null)
  const [name, setName] = useState(profile.name)
  const [expr, setExpr] = useState<'idle' | 'happy' | 'shock' | 'wink'>('idle')
  const a = profile.avatar
  const firstTitle = useRef(true)
  const exprTimer = useRef<number | undefined>(undefined)

  /* entrance */
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.2 })
      tl.fromTo('.cz-avatar', { scale: 0, rotate: -120 }, { scale: 1, rotate: 0, duration: 1.1, ease: 'elastic.out(1, 0.55)' })
        .fromTo('.cz-bubble', { scale: 0, rotate: () => gsap.utils.random(-50, 50) }, { scale: 1, rotate: 0, clearProps: 'transform', duration: 0.6, ease: 'back.out(2.6)', stagger: { each: 0.05, from: 'center' } }, 0.35)
        .fromTo('.cz-rand, .cz-go', { y: 140, rotate: (i: number) => (i ? 20 : -20) }, { y: 0, rotate: 0, clearProps: 'transform', duration: 0.8, ease: 'back.out(2)' }, 0.5)
        .fromTo('.cz-name', { scaleX: 0 }, { scaleX: 1, clearProps: 'transform', duration: 0.7, ease: 'expo.out' }, 0.6)
    }, root)
    return () => ctx.revert()
  }, [])

  /* the big title slams to the new category name */
  useLayoutEffect(() => {
    const el = title.current!
    const chars = el.querySelectorAll('.split-char')
    if (firstTitle.current) {
      firstTitle.current = false
      gsap.fromTo(chars, { yPercent: -160, rotate: () => gsap.utils.random(-40, 40), scale: 1.6 },
        { yPercent: 0, rotate: 0, scale: 1, duration: 0.7, ease: 'back.out(2)', stagger: 0.04, delay: 0.25 })
      return
    }
    sfx.slam()
    gsap.fromTo(chars, { yPercent: -140, rotate: () => gsap.utils.random(-30, 30), scale: 1.8 },
      { yPercent: 0, rotate: 0, scale: 1, duration: 0.55, ease: 'back.out(2.4)', stagger: 0.03 })
    gsap.fromTo(el, { skewX: -12 }, { skewX: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' })
  }, [cat])

  /* options rail slides in when a category is chosen */
  useLayoutEffect(() => {
    if (!cat) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.cz-opt', { scale: 0, y: 40, rotate: () => gsap.utils.random(-30, 30) }, { scale: 1, y: 0, rotate: 0, clearProps: 'transform', duration: 0.5, ease: 'back.out(2.4)', stagger: 0.04 })
      gsap.fromTo('.cz-swatch', { scale: 0 }, { scale: 1, clearProps: 'transform', duration: 0.45, ease: 'back.out(3)', stagger: 0.03, delay: 0.1 })
      gsap.fromTo('.cz-rail', ...intro({ clipPath: 'inset(0 50% 0 50% round 999px)', duration: 0.6, ease: 'expo.out' }))
    }, root)
    return () => ctx.revert()
  }, [cat])

  /* live-sync my look to the room (debounced) so friends watch me get dressed */
  useEffect(() => {
    const t = setTimeout(() => pushProfile(), 250)
    return () => clearTimeout(t)
  }, [a, profile.name])

  const set = (patch: Partial<AvatarConfig>) => {
    setProfile({ avatar: { ...a, ...patch } })
    sfx.pop()
    gsap.fromTo('.cz-avatar', { scaleX: 1.12, scaleY: 0.9 }, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' })
    setExpr('happy')
    window.clearTimeout(exprTimer.current)
    exprTimer.current = window.setTimeout(() => setExpr('idle'), 700)
  }

  const randomize = () => {
    sfx.whoosh()
    setExpr('shock')
    gsap.timeline()
      .to('.cz-avatar', { rotateY: 90, scale: 0.85, duration: 0.18, ease: 'power2.in' })
      .add(() => setProfile({ avatar: randomAvatar() }))
      .to('.cz-avatar', { rotateY: 0, scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
      .add(() => setExpr('wink'), '-=0.4')
      .add(() => setExpr('idle'), '+=0.6')
    gsap.fromTo('.cz-rand svg', { rotate: 0 }, { rotate: 360, duration: 0.6, ease: 'back.out(2)' })
  }

  const leaving = useRef(false)
  const finish = () => {
    if (leaving.current) return
    leaving.current = true
    const n = name.trim() || 'Player'
    setProfile({ name: n, customized: true })
    pushProfile(true)
    sfx.win()
    setExpr('happy')
    // the hop plays while the wipe starts; never wait on it, a killed tween would never resolve
    gsap.to('.cz-avatar', { y: -60, scale: 1.08, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 })
    const playing = useNet.getState().room?.phase === 'playing'
    if (playing) { leaving.current = false; return }
    window.setTimeout(() => go(`/room/${code}`, { label: 'LOBBY!', colors: ['#1d3a6e', '#e64fe0', '#d9f66b'] }), 180)
  }

  const others = room?.players.filter((p) => p.id !== profile.pid) ?? []

  return (
    <div ref={root} className="cz">
      <BrushMarks />
      <TopBar
        left={
          <button className="bubble-btn cz-rand" onClick={randomize} data-cursor="SHUFFLE">
            <svg className="ico" viewBox="0 0 24 24"><path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3" stroke="#e64fe0" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>Randomize</span>
          </button>
        }
        right={<span className="cz-code display"><small>Room</small>{code}</span>}
      />

      <h1 ref={title} className="cz-title display" key={`title-${cat?.key ?? 'avatar'}`}>
        <Split text={cat ? cat.label : 'Avatar'} />
      </h1>

      <div ref={stage} className="cz-stage">
        <div className="cz-avatar" onClick={() => { setExpr('wink'); sfx.pop(); setTimeout(() => setExpr('idle'), 600) }}>
          <Avatar config={a} size="100%" track="mouse" depth={1.8} expression={expr} />
        </div>
        <div className="cz-bubbles">
        {CATEGORIES.map((c) => {
          const [x, y] = SPOTS[c.key] ?? [50, 50]
          return (
            <button
              key={c.key}
              className={`cz-bubble display ${cat?.key === c.key ? 'on' : ''} ${x < 50 ? 'l' : 'r'}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={(e) => { sfx.click(); setCat(cat?.key === c.key ? null : c); e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) }}
              onMouseEnter={() => sfx.hover()}
            >
              {c.label}
            </button>
          )
        })}
        </div>
      </div>

      {cat && (
        <div className="cz-panel" key={cat.key}>
          <div className="cz-rail">
            <button className="cz-arrow" onClick={() => {
              const i = cat.options.indexOf(a[cat.key])
              set({ [cat.key]: cat.options[(i - 1 + cat.options.length) % cat.options.length] })
            }} aria-label="Previous">‹</button>
            <div className="cz-opts">
              {cat.options.map((o) => (
                <button key={o} className={`cz-opt ${a[cat.key] === o ? 'on' : ''}`} onClick={() => set({ [cat.key]: o })} data-cursor={o.toUpperCase()} title={o}>
                  {o === 'none' ? <Glyph name="x" color="#1d3a6e" size={34} strokeWidth={12} /> : <Avatar config={{ ...a, [cat.key]: o }} size="100%" track="none" />}
                  {cat.key === 'look' && <span className="cz-optlabel">{LOOK_LABELS[o]}</span>}
                </button>
              ))}
            </div>
            <button className="cz-arrow" onClick={() => {
              const i = cat.options.indexOf(a[cat.key])
              set({ [cat.key]: cat.options[(i + 1) % cat.options.length] })
            }} aria-label="Next">›</button>
          </div>
          {cat.colors && cat.colorKey && (
            <div className="cz-swatches">
              {cat.colors.map((col) => (
                <button key={col} className={`cz-swatch ${a[cat.colorKey!] === col ? 'on' : ''}`} style={{ background: col }}
                  onClick={() => set({ [cat.colorKey!]: col })} aria-label={col} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="cz-bottom">
        <label className="cz-name">
          <span className="display">Name</span>
          <input value={name} maxLength={16} placeholder="Type it…" onChange={(e) => { setName(e.target.value); setProfile({ name: e.target.value }) }}
            onKeyDown={(e) => e.key === 'Enter' && finish()} />
        </label>
        <button className="bubble-btn big cz-go" onClick={finish} data-cursor="READY">Let's go!</button>
      </div>

      {others.length > 0 && (
        <div className="cz-friends">
          {others.map((p) => (
            <div key={p.id} className="cz-friend" title={p.name}>
              <Avatar config={p.avatar} size={54} track="idle" badge />
              <span>{p.status === 'ready' ? '✓' : '…'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
