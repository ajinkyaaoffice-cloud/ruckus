import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { isTouch, watchVisible } from '../lib/perf'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import Avatar from '../components/Avatar'
import Mascot from '../components/Mascot'
import { MenuButton } from '../components/Menu'
import { setLenis } from '../lib/ui'
import Glyph from '../components/Glyph'
import GameArt from '../components/GameArt'
import { Split, SoundToggle } from '../components/Chrome'
import { useTransition } from '../components/Transition'
import { CATALOG } from '../lib/catalog'
import { randomAvatar, type AvatarConfig } from '../lib/avatar'
import { api, useNet } from '../lib/net'
import { sfx } from '../lib/sound'
import './Landing.css'

gsap.registerPlugin(ScrollTrigger)

// The loader plays once, and only when the very first page of the visit is
// home. Opening a room link and later wandering home skips it.
let bootDone = window.location.pathname !== '/'

type Leader = { id: string; name: string; avatar: Partial<AvatarConfig>; wins: number; games: number; points: number }

export default function Landing() {
  const root = useRef<HTMLDivElement>(null)
  const { go } = useTransition()
  const me = useNet((s) => s.profile)
  const [booting, setBooting] = useState(!bootDone)
  const bootRef = useRef(!bootDone)
  const [leaders, setLeaders] = useState<Leader[]>([])
  const crowd = useMemo(() => Array.from({ length: 15 }, () => randomAvatar()), [])
  const heroFaces = useMemo(() => [me.avatar, randomAvatar(), randomAvatar(), randomAvatar()], [me.avatar])

  useEffect(() => {
    fetch(api('/api/leaderboard')).then((r) => r.json()).then((d) => Array.isArray(d) && setLeaders(d)).catch(() => {})
  }, [])

  // pause the looping sticker/avatar animations in sections that are off screen
  useEffect(() => {
    const stops = [...document.querySelectorAll('.landing section')].map((s) =>
      watchVisible(s, (v) => s.classList.toggle('is-off', !v)))
    return () => stops.forEach((f) => f())
  }, [])

  const play = () => {
    sfx.click()
    go('/play', { label: 'LOBBY!' })
  }

  /* ---------------- smooth scroll + every scroll animation ---------------- */
  useLayoutEffect(() => {
    // read from a ref so StrictMode's second effect run still plays the loader
    const boot = bootRef.current
    bootDone = true
    const lenis = isTouch ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 1 })
    lenis?.on('scroll', ScrollTrigger.update)
    setLenis(lenis)
    const raf = (t: number) => lenis?.raf(t * 1000)
    if (lenis) gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    let heroMove: ((e: PointerEvent) => void) | null = null
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root)
      const rnd = gsap.utils.random

      /* hero: kinetic headline + orbiting game tokens.
         Each motion layer owns its own element so entrance, scroll-scrub,
         pointer parallax and hover never fight over the same transform. */
      const hero = gsap.timeline({ delay: boot ? 0 : 0.1, paused: boot })
      hero
        .from(q('.hb-in'), { scale: 0, rotate: -120, duration: 1.4, ease: 'expo.out' }, 0)
        .from(q('.ht-row .split-char'), { yPercent: 115, rotate: (i: number) => (i % 2 ? 14 : -14), duration: 0.9, ease: 'back.out(1.8)', stagger: 0.035 }, 0.15)
        .from(q('.ht-face-in'), { scale: 0, rotate: -200, duration: 1.2, ease: 'elastic.out(1, 0.55)' }, 0.35)
        .from(q('.ht-tag'), { scale: 0, rotate: 60, y: -80, duration: 0.7, ease: 'back.out(3)' }, 0.8)
        .from(q('.ht-crowd > *'), { x: -60, scale: 0, duration: 0.6, ease: 'back.out(2.4)', stagger: 0.08 }, 0.9)
        .add(boot
          // first visit: the tokens are already orbiting the counter, they just fly home
          ? gsap.to(q('.tk-in'), { x: 0, y: 0, scale: 1, rotate: 0, duration: 1.2, ease: 'expo.out', stagger: 0.04 })
          : gsap.from(q('.tk-in'), {
            x: (_i: number, el: HTMLElement) => { const r = el.getBoundingClientRect(); return window.innerWidth / 2 - (r.left + r.width / 2) },
            y: (_i: number, el: HTMLElement) => { const r = el.getBoundingClientRect(); return window.innerHeight / 2 - (r.top + r.height / 2) },
            scale: 0, rotate: () => rnd(-360, 360), duration: 1.3, ease: 'expo.out', stagger: 0.06,
          }), boot ? 0 : 0.5)
        .from(q('.hero-sub .split-char'), { yPercent: 120, duration: 0.6, ease: 'back.out(2)', stagger: 0.008 }, 1)
        .from(q('.hero-badge'), { scale: 0, rotate: -180, duration: 1, ease: 'back.out(2)' }, 1.05)
        .from(q('.hero-band'), { xPercent: -110, duration: 1, ease: 'expo.out' }, 1.1)

      /* loader: the hero's own tokens orbit a % counter in the middle of the
         screen, then the counter pops and they fly out to their places as the
         headline builds, so loading and the hero are one continuous move */
      if (boot) {
        document.documentElement.classList.add('booting', 'boot-hold')
        const toks = q('.tk-in') as HTMLElement[]
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2
        const R = Math.min(window.innerWidth, window.innerHeight) * 0.26
        const home = toks.map((el) => { const r = el.getBoundingClientRect(); return [cx - (r.left + r.width / 2), cy - (r.top + r.height / 2)] })
        const spin = { a: -Math.PI / 2 }
        const place = () => toks.forEach((el, i) => {
          const a = spin.a + (i / toks.length) * Math.PI * 2
          gsap.set(el, { x: home[i][0] + Math.cos(a) * R, y: home[i][1] + Math.sin(a) * R })
        })
        place()
        gsap.set(toks, { scale: 0, rotate: 0 })
        gsap.set('.land-nav', { autoAlpha: 0, y: -40 })
        const num = { v: 0 }
        const out = q('.ld-num span')[0] as HTMLElement
        gsap.timeline({ onComplete: () => { document.documentElement.classList.remove('booting'); setBooting(false) } })
          .to(toks, { scale: 0.62, duration: 0.6, ease: 'back.out(2.4)', stagger: 0.05 }, 0)
          .fromTo('.ld-num', { scale: 0, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.4)' }, 0)
          .to(spin, { a: Math.PI * 1.5, duration: 2, ease: 'power1.inOut', onUpdate: place }, 0)
          .to(num, { v: 100, duration: 1.7, ease: 'power2.inOut', onUpdate: () => { out.textContent = String(Math.round(num.v)) } }, 0.1)
          .to('.ld-num', { scale: 1.2, rotate: -8, duration: 0.2, ease: 'back.out(3)' }, 1.85)
          .to('.ld-num', { scale: 0, rotate: 30, duration: 0.3, ease: 'back.in(2)' })
          .add(() => { document.documentElement.classList.remove('boot-hold'); hero.play() }, '-=0.2')
          .to('.land-nav', { autoAlpha: 1, y: 0, duration: 0.6, ease: 'back.out(2)' }, '+=0.5')
      }

      // pointer parallax for the tokens and burst (depth from data attribute)
      const tos = (q('.hero-token') as HTMLElement[]).map((t) => {
        const par = t.querySelector('.tk-par')!
        return { d: Number(t.dataset.depth ?? 1), x: gsap.quickTo(par, 'x', { duration: 0.9, ease: 'power3.out' }), y: gsap.quickTo(par, 'y', { duration: 0.9, ease: 'power3.out' }) }
      })
      const bx = gsap.quickTo('.hb-par', 'x', { duration: 1.4, ease: 'power3.out' })
      const by = gsap.quickTo('.hb-par', 'y', { duration: 1.4, ease: 'power3.out' })
      heroMove = (e: PointerEvent) => {
        const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5
        tos.forEach((t) => { t.x(nx * 70 * t.d); t.y(ny * 50 * t.d) })
        bx(nx * -40); by(ny * -30)
      }
      window.addEventListener('pointermove', heroMove)

      // tokens wobble when hovered
      ;(q('.tk-hov') as HTMLElement[]).forEach((t) => t.addEventListener('mouseenter', () => {
        sfx.hover()
        gsap.fromTo(t, { rotate: 0, scale: 1 }, { rotate: rnd(-30, 30), scale: 1.15, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out', overwrite: true })
      }))

      // scroll: rows slide apart, mascot zooms, tokens scatter upward
      gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } })
        .fromTo('.ht-row.r1', { xPercent: 0 }, { xPercent: -28, ease: 'none' }, 0)
        .fromTo('.ht-row.r2', { xPercent: 0 }, { xPercent: 22, ease: 'none' }, 0)
        .fromTo('.ht-row.r3', { xPercent: 0 }, { xPercent: -14, ease: 'none' }, 0)
        .fromTo('.ht-face', { scale: 1, rotate: 0 }, { scale: 1.5, rotate: 25, ease: 'none' }, 0)
        .fromTo('.hero-token', { y: 0, rotate: 0 }, { y: (i: number) => -200 - (i % 3) * 160, rotate: (i: number) => (i % 2 ? 120 : -120), ease: 'none' }, 0)
        .fromTo('.hero-burst', { scale: 1, rotate: 0 }, { scale: 1.6, rotate: 90, ease: 'none' }, 0)
        .fromTo('.hero-band-move', { xPercent: 0 }, { xPercent: -12, ease: 'none' }, 0)

      /* generic: headings rise letter by letter, stickers slap on */
      q('[data-split]').forEach((el: Element) => {
        gsap.from(el.querySelectorAll('.split-char'), {
          yPercent: 110, rotate: 10, duration: 0.9, ease: 'expo.out', stagger: 0.018,
          scrollTrigger: { trigger: el, start: 'top 85%' },
        })
      })
      q('.sticker').forEach((el: Element) => {
        gsap.from(el, { scale: 0, rotate: -50, duration: 0.7, ease: 'back.out(3)', scrollTrigger: { trigger: el, start: 'top 88%' } })
      })
      q('[data-rise]').forEach((el: Element) => {
        gsap.from(el, { clipPath: 'inset(0 0 100% 0)', y: 40, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } })
      })

      /* mission card grows into place like a window opening */
      gsap.fromTo('.mission-card', { scale: 0.82, borderRadius: 120, rotate: -2 }, {
        scale: 1, borderRadius: 48, rotate: 0, ease: 'none',
        scrollTrigger: { trigger: '.mission', start: 'top bottom', end: 'top 15%', scrub: true },
      })
      gsap.fromTo('.mission-squiggle path', { strokeDashoffset: 600 }, {
        strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.mission-card', start: 'top 70%', end: 'top 20%', scrub: true },
      })
      gsap.fromTo('.mission-peek', { x: 200, rotate: 50 }, {
        x: 0, rotate: -12, ease: 'back.out(1.5)', duration: 1.1, scrollTrigger: { trigger: '.mission-card', start: 'top 55%' },
      })

      /* scalloped edge wobbles as it enters */
      gsap.fromTo('.how-edge', { scaleY: 0.2 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.how', start: 'top bottom', end: 'top 60%', scrub: true } })

      /* how it works: pinned stack of cards */
      const cards = q('.how-card')
      const stack = gsap.timeline({
        scrollTrigger: { trigger: '.how-pin', start: 'top top', end: () => `+=${window.innerHeight * 2.2}`, pin: true, scrub: 0.6 },
      })
      cards.forEach((card: Element, i: number) => {
        if (i === 0) return
        stack.fromTo(card, { yPercent: 130, rotate: i % 2 ? 14 : -14 }, { yPercent: 0, rotate: i % 2 ? 3 : -3, ease: 'power2.out' }, i - 1)
        stack.to(cards[i - 1], { scale: 0.9, yPercent: -6, rotate: i % 2 ? -6 : 6, ease: 'power1.inOut' }, i - 1)
      })

      /* games: horizontal pinned gallery */
      const track = q('.games-track')[0] as HTMLElement
      const dist = () => track.scrollWidth - window.innerWidth + 64
      const hz = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '.games-pin', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true },
      })
      q('.game-card').forEach((card: Element, i: number) => {
        gsap.from(card, {
          y: i % 2 ? 160 : -160, rotate: i % 2 ? 18 : -18, scale: 0.7, ease: 'back.out(1.6)', duration: 1,
          scrollTrigger: { trigger: card, containerAnimation: hz, start: 'left 105%', toggleActions: 'play none none reverse' },
        })
      })

      /* marquee: speed & skew follow scroll velocity */
      const rows = q('.mq-row')
      const loops = rows.map((row: Element, i: number) =>
        gsap.to(row, { xPercent: i % 2 ? 0 : -50, duration: 26, ease: 'none', repeat: -1, ...(i % 2 ? { startAt: { xPercent: -50 } } : {}) }))
      ScrollTrigger.create({
        trigger: '.marquee', start: 'top bottom', end: 'bottom top',
        onUpdate: (self) => {
          const v = self.getVelocity() / 300
          loops.forEach((l: gsap.core.Tween) => gsap.to(l, { timeScale: 1 + Math.abs(v), duration: 0.3, overwrite: true }))
          gsap.to(rows, { skewX: gsap.utils.clamp(-14, 14, -v * 2), duration: 0.4, overwrite: 'auto' })
        },
      })

      /* avatar wall: columns drift at different speeds */
      q('.wall-col').forEach((col: Element, i: number) => {
        gsap.fromTo(col, { yPercent: i % 2 ? -18 : 12 }, {
          yPercent: i % 2 ? 12 : -22, ease: 'none',
          scrollTrigger: { trigger: '.wall', start: 'top bottom', end: 'bottom top', scrub: true },
        })
      })
      gsap.from('.wall-cta', { scale: 0, rotate: -30, duration: 1, ease: 'elastic.out(1, 0.5)', scrollTrigger: { trigger: '.wall', start: 'top 50%' } })

      /* leaderboard rows slide like cards being dealt */
      gsap.from('.lb-row', {
        x: (i) => (i % 2 ? 400 : -400), rotate: (i) => (i % 2 ? 12 : -12), duration: 0.9, ease: 'back.out(1.4)', stagger: 0.08,
        scrollTrigger: { trigger: '.lb', start: 'top 70%' },
      })

      /* footer: zigzag teeth bite up, big CTA slams in */
      gsap.from('.foot-cta', { scale: 0.2, rotate: 25, ease: 'back.out(2)', duration: 1, scrollTrigger: { trigger: '.foot', start: 'top 70%' } })
      gsap.from('.foot-title .split-char', {
        yPercent: 120, rotate: (i) => (i % 2 ? 20 : -20), stagger: 0.03, duration: 0.8, ease: 'back.out(2)',
        scrollTrigger: { trigger: '.foot', start: 'top 75%' },
      })
    }, root)

    /* magnetic buttons */
    const mags = Array.from(root.current!.querySelectorAll<HTMLElement>('[data-magnetic]'))
    const offs = mags.map((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect()
        xTo((e.clientX - (r.left + r.width / 2)) * 0.35)
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35)
      }
      const leave = () => { xTo(0); yTo(0) }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerleave', leave)
      return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave) }
    })

    const refresh = setTimeout(() => ScrollTrigger.refresh(), 400)
    return () => {
      clearTimeout(refresh)
      if (heroMove) window.removeEventListener('pointermove', heroMove)
      offs.forEach((f) => f())
      ctx.revert()
      gsap.ticker.remove(raf)
      setLenis(null)
      lenis?.destroy()
      document.documentElement.classList.remove('booting', 'boot-hold')
    }
  }, [])

  const wallCols = [0, 1, 2, 3, 4].map((c) => crowd.filter((_, i) => i % 5 === c))

  return (
    <div ref={root} className="landing">
      {booting && <div className="ld-num display" aria-hidden><span>0</span><sup>%</sup></div>}

      <nav className="land-nav">
        <MenuButton />
        <div className="land-nav-r">
          <SoundToggle />
          <button className="bubble-btn magenta" onClick={play} data-cursor="GO!">
            <Glyph name="bolt" color="#fff" size={18} /> Play now
          </button>
        </div>
      </nav>

      {/* ------------------------------ HERO ------------------------------ */}
      <section className="hero">
        <div className="hero-burst" aria-hidden>
          <div className="hb-in"><div className="hb-par">
            <svg viewBox="-100 -100 200 200">
              {Array.from({ length: 18 }, (_, i) => <path key={i} d="M0 0 L-11 -160 L11 -160Z" transform={`rotate(${i * 20})`} />)}
            </svg>
          </div></div>
        </div>

        <div className="hero-tokens" aria-hidden>
          {TOKENS.map((t) => (
            <div key={t.k} className={`hero-token t-${t.k}`} data-depth={t.d}>
              <div className="tk-in"><div className="tk-par"><div className="tk-hov"><div className="tk"><Token kind={t.k} /></div></div></div></div>
            </div>
          ))}
        </div>

        <h1 className="hero-title display" aria-label="Play loud with tiny crowds">
          <span className="ht-row r1">
            <span className="ht-line"><Split text="Play" /></span>
            <span className="ht-tag sticker">2–5 players</span>
          </span>
          <span className="ht-row r2">
            <span className="ht-face"><span className="ht-face-in">
              <span className="ht-ring" />
              <Mascot className="ht-mascot" />
            </span></span>
            <span className="ht-line loud"><Split text="loud" /></span>
          </span>
          <span className="ht-row r3">
            <span className="ht-line serif"><Split text="with tiny crowds" /></span>
            <span className="ht-crowd">
              {heroFaces.slice(1).map((a, i) => <span key={i}><Avatar config={a} size="100%" track="mouse" badge /></span>)}
            </span>
          </span>
        </h1>

        <div className="hero-foot">
          <p className="hero-sub"><Split text={`${CATALOG.length} realtime mini games. One room code. Zero sign-ups.`} /></p>
          <button className="hero-badge" onClick={play} data-magnetic data-cursor="PLAY" aria-label="Start a ruckus">
            <svg viewBox="0 0 200 200" className="hb-ring" aria-hidden>
              <defs><path id="hb-circle" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" /></defs>
              <text><textPath href="#hb-circle" textLength="462">START A RUCKUS ✦ START A RUCKUS ✦</textPath></text>
            </svg>
            <span className="hb-core display">Go!</span>
          </button>
        </div>

        <div className="hero-band" aria-hidden>
          <div className="hero-band-move"><div className="hero-band-track display">
            {[...CATALOG, ...CATALOG, ...CATALOG].map((g, i) => (
              <span key={i}>{g.name}<Glyph name={(['star', 'x', 'o', 'bolt'] as const)[i % 4]} color={['#d9f66b', '#f6b8f7', '#a7ecff', '#ffb424'][i % 4]} size={34} /></span>
            ))}
          </div></div>
        </div>
      </section>

      {/* ----------------------------- MISSION ---------------------------- */}
      <section className="mission">
        <div className="mission-card">
          <span className="sticker">The deal</span>
          <h2 className="mission-title" data-split>
            <Split text="Tiny games," /><br />
            <span className="hl">loud</span> <Split text="friends." />
          </h2>
          <svg className="mission-squiggle" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden>
            <path d="M5 25 C80 0 120 40 200 20 S320 0 400 22 S520 40 595 15" fill="none" stroke="#e64fe0" strokeWidth="6" strokeLinecap="round" strokeDasharray="600" />
          </svg>
          <div className="mission-cols">
            <p className="lead" data-rise>Open a room, flash the code (or a QR) and your friends are in — no sign-ups, no installs.</p>
            <p data-rise>Every move is checked by our Python game server and broadcast to everyone in the room at once, so the ball, the cards and the trash talk all land at the same moment. Your face, your name and your style stay saved on this device for next time.</p>
          </div>
          <div className="mission-peek"><Avatar config={me.avatar} size="100%" track="mouse" expression="wink" /></div>
        </div>
      </section>

      {/* --------------------------- HOW IT WORKS ------------------------- */}
      <section className="how">
        <svg className="how-edge" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden>
          <path d={'M0 80 ' + Array.from({ length: 12 }, (_, i) => `Q ${i * 100 + 50} -20 ${(i + 1) * 100} 80`).join(' ') + ' Z'} fill="#a596ff" />
        </svg>
        <div className="how-pin">
          <div className="how-head">
            <span className="sticker">How it works</span>
            <h2 className="display how-title" data-split><Split text="Three steps" /><br /><Split text="to chaos" /></h2>
          </div>
          <div className="how-stack">
            <article className="how-card c1">
              <div className="how-num display">01</div>
              <h3 className="display">Open a room</h3>
              <p>Get a four-letter code and a QR. Friends type it or scan it from their phone.</p>
              <div className="how-code display">{['R', 'U', 'K', 'S'].map((c, i) => <span key={i}>{c}</span>)}</div>
            </article>
            <article className="how-card c2">
              <div className="how-num display">02</div>
              <h3 className="display">Make a face</h3>
              <p>Hats, hair, eyes, jewellery and more. It remembers you next time.</p>
              <div className="how-face"><Avatar config={crowd[3]} size="100%" track="mouse" badge /></div>
            </article>
            <article className="how-card c3">
              <div className="how-num display">03</div>
              <h3 className="display">Pick & play</h3>
              <p>The host picks a game, everyone gets swept in together. Scores stack up between rounds.</p>
              <div className="how-glyphs">
                <Glyph name="x" color="#e64fe0" size={64} /><Glyph name="o" color="#1d3a6e" size={64} /><Glyph name="star" color="#ffb424" size={64} />
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ------------------------------ GAMES ----------------------------- */}
      <section className="games">
        <svg className="zigzag" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden>
          <path d={'M0 40 ' + Array.from({ length: 30 }, (_, i) => `L ${i * 40 + 20} 0 L ${(i + 1) * 40} 40`).join(' ') + ' Z'} fill="#1d3a6e" />
        </svg>
        <div className="games-pin">
          <div className="games-head">
            <span className="sticker">The lineup</span>
            <h2 className="display" data-split><Split text="Eight ways to" /><br /><Split text="ruin a friendship" /></h2>
          </div>
          <div className="games-track">
            {CATALOG.map((g, i) => (
              <article key={g.id} className="game-card" style={{ background: g.bg, color: g.ink, rotate: `${i % 2 ? 2 : -2}deg` }} data-cursor={g.name.toUpperCase()}>
                <div className="gc-top">
                  <span className="gc-tag">{g.tag}</span>
                  <span className="gc-players display">{g.min === g.max ? g.min : `${g.min}–${g.max}`}<small>P</small></span>
                </div>
                <GameArt id={g.id} className="gc-art" />
                <h3 className="display">{g.name}</h3>
                <p>{g.blurb}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- MARQUEE ---------------------------- */}
      <section className="marquee" aria-hidden>
        {[0, 1].map((r) => (
          <div key={r} className={`mq-row r${r}`}>
            {[0, 1].map((k) => (
              <span key={k} className="display">
                {CATALOG.map((g) => <span key={g.id}>{g.name} <Glyph name={r ? 'star' : 'x'} size={46} color={r ? '#e64fe0' : '#1d3a6e'} /> </span>)}
              </span>
            ))}
          </div>
        ))}
      </section>

      {/* ------------------------------ FACES ----------------------------- */}
      <section className="wall">
        <div className="wall-cols">
          {wallCols.map((col, ci) => (
            <div key={ci} className="wall-col">
              {col.map((a, i) => (
                <div key={i} className="wall-face" style={{ background: a.bg }}>
                  <Avatar config={a} size="100%" track="mouse" expression={(['idle', 'happy', 'focus', 'wink'] as const)[(ci + i) % 4]} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="wall-cta">
          <span className="sticker">Who are you?</span>
          <h2 className="display">Make<br />a face</h2>
          <button className="bubble-btn magenta" onClick={play} data-cursor="DRESS UP">Create yours</button>
        </div>
      </section>

      {/* ------------------------------ HALL ------------------------------ */}
      <section className="lb">
        <span className="sticker">Hall of fame</span>
        <h2 className="display" data-split><Split text="Legends" /></h2>
        <div className="lb-list">
          {leaders.length === 0 && (
            <div className="lb-row empty"><Glyph name="star" color="#ffb424" size={44} /><span>No legends yet. The first throne is wide open.</span></div>
          )}
          {leaders.map((l, i) => (
            <div key={l.id} className={`lb-row r${i}`}>
              <span className="lb-rank display">{i + 1}</span>
              <div className="lb-face"><Avatar config={l.avatar} size="100%" track="none" badge /></div>
              <span className="lb-name">{l.name}</span>
              <span className="lb-stat"><b className="display">{l.wins}</b> wins</span>
              <span className="lb-stat"><b className="display">{l.points}</b> pts</span>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------ FOOTER ---------------------------- */}
      <footer className="foot">
        <svg className="zigzag" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden>
          <path d={'M0 40 ' + Array.from({ length: 30 }, (_, i) => `L ${i * 40 + 20} 0 L ${(i + 1) * 40} 40`).join(' ') + ' Z'} fill="#1d3a6e" />
        </svg>
        <h2 className="foot-title display"><Split text="Let's play" /></h2>
        <button className="foot-cta display" onClick={play} data-magnetic data-cursor="LET'S GO">
          <span>Go!</span>
          <svg viewBox="0 0 200 200" className="foot-ring"><defs><path id="ring" d="M100 100 m-80 0 a80 80 0 1 1 160 0 a80 80 0 1 1 -160 0" /></defs>
            <text><textPath href="#ring">open a room ✦ grab your friends ✦ make some noise ✦ </textPath></text></svg>
        </button>
        <div className="foot-meta">
          <span>Ruckus · realtime mini-games</span>
          <span>Built with React, GSAP, FastAPI & Supabase</span>
        </div>
      </footer>
    </div>
  )
}

/* ---------------- hero tokens: tiny props from every game ---------------- */
type TokenKind = 'uno' | 'x' | 'o' | 'disc' | 'paddle' | 'memory' | 'dots' | 'pad'
const TOKENS: { k: TokenKind; d: number }[] = [
  { k: 'uno', d: 1.4 }, { k: 'x', d: 0.7 }, { k: 'disc', d: 1.1 }, { k: 'paddle', d: 1.6 },
  { k: 'memory', d: 0.9 }, { k: 'o', d: 0.5 }, { k: 'dots', d: 1.2 }, { k: 'pad', d: 0.8 },
]

function Token({ kind }: { kind: TokenKind }) {
  switch (kind) {
    case 'uno':
      return (
        <svg viewBox="0 0 100 150"><rect x="4" y="4" width="92" height="142" rx="14" fill="#fff" /><rect x="12" y="12" width="76" height="126" rx="10" fill="#ff5d73" />
          <ellipse cx="50" cy="75" rx="30" ry="50" transform="rotate(28 50 75)" fill="#fff" />
          <text x="50" y="92" textAnchor="middle" fontFamily="Luckiest Guy" fontSize="46" fill="#ff5d73">+4</text></svg>
      )
    case 'x':
      return <Glyph name="x" color="#fff" size={120} strokeWidth={18} />
    case 'o':
      return <Glyph name="o" color="#a7ecff" size={100} strokeWidth={18} />
    case 'disc':
      return (
        <svg viewBox="0 0 100 100"><circle cx="50" cy="54" r="44" fill="#c98500" /><circle cx="50" cy="48" r="44" fill="#ffb424" />
          <circle cx="50" cy="48" r="28" fill="none" stroke="#000" strokeOpacity=".14" strokeWidth="7" /></svg>
      )
    case 'paddle':
      return (
        <svg viewBox="0 0 120 150"><rect x="50" y="88" width="20" height="56" rx="8" fill="#1d3a6e" /><circle cx="60" cy="58" r="52" fill="#e64fe0" />
          <circle cx="60" cy="58" r="40" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="6" /><circle cx="104" cy="20" r="12" fill="#fff" /></svg>
      )
    case 'memory':
      return (
        <svg viewBox="0 0 100 120"><rect x="4" y="4" width="92" height="112" rx="14" fill="#a596ff" />
          <rect x="14" y="14" width="72" height="92" rx="8" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="8 7" />
          <path d="M50 34 l6 13 14 2 -10 10 2 14 -12 -7 -12 7 2 -14 -10 -10 14 -2z" fill="#d9f66b" /></svg>
      )
    case 'dots':
      return (
        <svg viewBox="0 0 110 110"><rect x="16" y="16" width="38" height="38" rx="6" fill="#45b8ff" />
          <path d="M15 15 H55 V55 M55 15 H95" stroke="#1d3a6e" strokeWidth="7" strokeLinecap="round" fill="none" />
          {[15, 55, 95].flatMap((y) => [15, 55, 95].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="8" fill="#fff" />))}</svg>
      )
    case 'pad':
      return (
        <svg viewBox="0 0 110 110"><path d="M55 8 A47 47 0 0 1 102 55 L70 55 A15 15 0 0 0 55 40Z" fill="#d9f66b" />
          <path d="M102 55 A47 47 0 0 1 55 102 L55 70 A15 15 0 0 0 70 55Z" fill="#ff9a62" />
          <path d="M55 102 A47 47 0 0 1 8 55 L40 55 A15 15 0 0 0 55 70Z" fill="#45b8ff" />
          <path d="M8 55 A47 47 0 0 1 55 8 L55 40 A15 15 0 0 0 40 55Z" fill="#e64fe0" /></svg>
      )
  }
}
