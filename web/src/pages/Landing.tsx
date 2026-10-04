import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import Logotype from '../components/Logotype'
import Avatar from '../components/Avatar'
import Glyph from '../components/Glyph'
import GameArt from '../components/GameArt'
import { Split, SoundToggle } from '../components/Chrome'
import { useTransition } from '../components/Transition'
import { CATALOG } from '../lib/catalog'
import { randomAvatar, type AvatarConfig } from '../lib/avatar'
import { useNet } from '../lib/net'
import { sfx } from '../lib/sound'
import './Landing.css'

gsap.registerPlugin(ScrollTrigger)

type Leader = { id: string; name: string; avatar: Partial<AvatarConfig>; wins: number; games: number; points: number }

export default function Landing() {
  const root = useRef<HTMLDivElement>(null)
  const { go } = useTransition()
  const me = useNet((s) => s.profile)
  const [loaded, setLoaded] = useState(() => sessionStorage.getItem('ruckus.loaded') === '1')
  const [leaders, setLeaders] = useState<Leader[]>([])
  const crowd = useMemo(() => Array.from({ length: 15 }, () => randomAvatar()), [])
  const heroFaces = useMemo(() => [me.avatar, randomAvatar(), randomAvatar(), randomAvatar()], [me.avatar])

  useEffect(() => {
    fetch('/api/leaderboard').then((r) => r.json()).then((d) => Array.isArray(d) && setLeaders(d)).catch(() => {})
  }, [])

  const play = () => {
    sfx.click()
    go('/play', { label: 'LOBBY!' })
  }

  /* ---------------- loader: chunky % counter, then wipe ---------------- */
  useLayoutEffect(() => {
    if (loaded) return
    const ctx = gsap.context(() => {
      const num = { v: 0 }
      const out = root.current!.querySelector('.ld-num span')!
      const tl = gsap.timeline({
        onComplete: () => {
          sessionStorage.setItem('ruckus.loaded', '1')
          setLoaded(true)
        },
      })
      tl.from('.ld-stroke', { scaleX: 0, duration: 0.6, ease: 'expo.out', stagger: 0.12 })
        .to(num, {
          v: 100, duration: 1.8, ease: 'power2.inOut',
          onUpdate: () => { out.textContent = String(Math.round(num.v)) },
        }, 0)
        .to('.ld-num', { scale: 1.15, rotate: -6, duration: 0.25, ease: 'back.out(3)' })
        .to('.ld-num', { scale: 0, rotate: 20, duration: 0.35, ease: 'back.in(2)' })
        .to('.ld-panel', { yPercent: -101, duration: 0.8, ease: 'expo.inOut', stagger: 0.08 }, '-=0.15')
    }, root)
    return () => ctx.revert()
  }, [loaded])

  /* ---------------- smooth scroll + every scroll animation ---------------- */
  useLayoutEffect(() => {
    if (!loaded) return
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root)
      const rnd = gsap.utils.random

      /* hero: geometric logotype assembles from scattered pieces */
      const pieces = q('.lt-piece')
      gsap.from(pieces, {
        x: () => rnd(-500, 500), y: () => rnd(-400, 400), rotate: () => rnd(-270, 270), scale: () => rnd(0.2, 2.2),
        transformOrigin: '50% 50%', duration: 1.4, ease: 'expo.out', stagger: { each: 0.035, from: 'random' }, delay: 0.15,
      })
      gsap.from(q('.hero-sub .split-char'), { yPercent: 120, rotate: 12, duration: 0.8, ease: 'back.out(2)', stagger: 0.012, delay: 0.9 })
      gsap.from(q('.hero-face'), { scale: 0, rotate: () => rnd(-60, 60), duration: 1, ease: 'elastic.out(1, 0.55)', stagger: 0.12, delay: 1.1 })
      gsap.from(q('.hero-cta'), { y: 120, rotate: -20, duration: 0.9, ease: 'back.out(2)', delay: 1.3 })
      gsap.from(q('.hero-glyph'), { scale: 0, rotate: 180, duration: 0.9, ease: 'back.out(2)', stagger: 0.07, delay: 1.2 })

      // logotype pieces jiggle on hover
      q('.lt-letter').forEach((letter: Element) => {
        letter.addEventListener('mouseenter', () => {
          sfx.hover()
          gsap.fromTo(letter.querySelectorAll('.lt-piece'), { rotate: 0 }, {
            rotate: () => rnd(-14, 14), y: () => rnd(-14, 6), duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out',
            transformOrigin: '50% 50%', stagger: 0.04,
          })
        })
      })

      // hero parallax out
      gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
        .to('.hero-logo', { yPercent: -40, scale: 0.8, rotate: -4, ease: 'none' }, 0)
        .to('.hero-face.f0', { x: -220, y: -120, rotate: -40, ease: 'none' }, 0)
        .to('.hero-face.f1', { x: 240, y: -160, rotate: 30, ease: 'none' }, 0)
        .to('.hero-face.f2', { x: -260, y: 120, rotate: 20, ease: 'none' }, 0)
        .to('.hero-face.f3', { x: 260, y: 160, rotate: -30, ease: 'none' }, 0)
        .to('.hero-glyph', { y: (i) => (i % 2 ? -300 : 300), rotate: 180, ease: 'none' }, 0)

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
      offs.forEach((f) => f())
      ctx.revert()
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [loaded])

  const wallCols = [0, 1, 2, 3, 4].map((c) => crowd.filter((_, i) => i % 5 === c))

  return (
    <div ref={root} className="landing">
      {!loaded && (
        <div className="loader" aria-hidden>
          <div className="ld-panel p1" />
          <div className="ld-panel p2" />
          <div className="ld-panel p3">
            <div className="ld-stroke s1" />
            <div className="ld-stroke s2" />
            <div className="ld-stroke s3" />
            <div className="ld-num display"><span>0</span><sup>%</sup></div>
          </div>
        </div>
      )}

      <nav className="land-nav">
        <button className="wavy" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0 })} data-cursor="TOP">
          <svg viewBox="0 0 40 30" width="44" height="34"><path d="M2 6 q5 -5 9 0 t9 0 t9 0 t9 0 M2 15 q5 -5 9 0 t9 0 t9 0 t9 0 M2 24 q5 -5 9 0 t9 0 t9 0 t9 0" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" /></svg>
        </button>
        <div className="land-nav-r">
          <SoundToggle />
          <button className="bubble-btn magenta" onClick={play} data-cursor="GO!">
            <Glyph name="bolt" color="#fff" size={18} /> Play now
          </button>
        </div>
      </nav>

      {/* ------------------------------ HERO ------------------------------ */}
      <section className="hero">
        <div className="hero-glyphs" aria-hidden>
          <Glyph className="hero-glyph g1" name="x" color="#fff" size={110} />
          <Glyph className="hero-glyph g2" name="o" color="#fff" size={90} />
          <Glyph className="hero-glyph g3" name="star" color="#d9f66b" size={70} />
          <Glyph className="hero-glyph g4" name="squiggle" color="#1d3a6e" size={120} strokeWidth={9} />
          <Glyph className="hero-glyph g5" name="plus" color="#e64fe0" size={64} />
          <Glyph className="hero-glyph g6" name="moon" color="#ffb424" size={80} />
        </div>
        <div className="hero-logo">
          <Logotype className="logotype" />
        </div>
        <p className="hero-sub"><Split text="Tiny realtime party games for 2–3 friends" /></p>
        {heroFaces.map((a, i) => (
          <div key={i} className={`hero-face f${i}`}>
            <Avatar config={a} size="100%" track="mouse" depth={1.4} badge />
          </div>
        ))}
        <button className="bubble-btn big hero-cta" onClick={play} data-magnetic data-cursor="PLAY">
          <Glyph name="x" color="#e64fe0" size={22} /> Start a ruckus
        </button>
        <div className="scroll-hint display"><span>scroll</span><Glyph name="arc" size={26} color="#1d3a6e" strokeWidth={12} /></div>
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
            <text><textPath href="#ring">open a room ✦ grab two friends ✦ make some noise ✦ </textPath></text></svg>
        </button>
        <div className="foot-meta">
          <span>Ruckus · realtime mini-games</span>
          <span>Built with React, GSAP, FastAPI & Supabase</span>
        </div>
      </footer>
    </div>
  )
}
