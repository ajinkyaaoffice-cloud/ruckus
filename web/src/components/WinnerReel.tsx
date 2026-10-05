import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import Avatar from './Avatar'
import Glyph, { ALL_GLYPHS } from './Glyph'
import { DEFAULT_MOTIF, MOTIFS, type Motif } from './reelMotifs'
import { onReelSkip, PLAYER_HEX, skipReel, type GameState, type Room } from '../lib/net'
import { gameMeta } from '../lib/catalog'
import { lowPower } from '../lib/perf'
import { sfx } from '../lib/sound'
import './WinnerReel.css'

export type HeroRects = Record<string, DOMRect>

type Props = {
  state: GameState
  room: Room
  me: string
  /** the reveal is over: show the results underneath, flying faces in from these rects */
  onHandoff: (rects: HeroRects) => void
  /** the reel has faded away and can unmount */
  onDone: () => void
}

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The end-of-game motion graphic: the game's colours wipe in, its pieces put on
 * a short show (cards fan, dice rain, X's slam into a grid…), everything is
 * sucked into the middle, and the winner bursts out on a field of rays. Then it
 * hands the winner's face over to the podium underneath. Tap to speed it up.
 */
export default function WinnerReel({ state, room, me, onHandoff, onDone }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const meta = gameMeta(state.game)
  const motif: Motif = MOTIFS[state.game] ?? DEFAULT_MOTIF
  const res = state.results!
  const tie = res.ranking.length === 1 && res.ranking[0].length > 1
  const heroes = (res.winners.length ? res.winners : tie ? res.ranking[0] : []).slice(0, 5)
  const iWon = res.winners.includes(me)
  const player = (pid: string) => room.players.find((p) => p.id === pid)
  const hex = (pid: string) => PLAYER_HEX[Math.max(0, room.players.findIndex((p) => p.id === pid)) % PLAYER_HEX.length]
  const title = tie ? 'Draw!' : !heroes.length ? 'Game over' : iWon && heroes.length === 1 ? 'You' : heroes.map((h) => player(h)?.name ?? 'Someone').join(' & ')
  const tag = tie || !heroes.length ? null : iWon && heroes.length === 1 ? 'WIN!' : heroes.length > 1 ? 'WIN!' : 'WINS!'
  const count = reduced ? 0 : lowPower ? Math.min(motif.count, motif.choreo === 'grid' ? motif.count : 8) : motif.count
  const name = meta?.name ?? 'Ruckus'

  useLayoutEffect(() => {
    const el = root.current!
    const ctx = gsap.context(() => {
      const W = window.innerWidth, H = window.innerHeight, R = Math.min(W, H)
      const bits = gsap.utils.toArray<HTMLElement>('.wr-bit')
      const bitPx = bits[0]?.offsetWidth ?? 60
      const tl = gsap.timeline()
      tlRef.current = tl
      const quick = lowPower ? 0.75 : 1

      // 1. two stripes sweep across and the game's colour floods in behind them
      tl.call(() => sfx.whoosh(), undefined, 0)
        .fromTo('.wr-stripe.s1', { xPercent: -130 }, { xPercent: 130, duration: 0.75, ease: 'power3.inOut' }, 0)
        .fromTo('.wr-stripe.s2', { xPercent: -130 }, { xPercent: 130, duration: 0.75, ease: 'power3.inOut' }, 0.09)
        .fromTo('.wr-bg', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 0.7, ease: 'power3.inOut' }, 0.22)
        .fromTo('.wr-marquee', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.55)
        .fromTo('.wr-tag', { scale: 0, rotate: -25 }, { scale: 1, rotate: -4, duration: 0.5, ease: 'back.out(3)' }, 0.6)
        .addLabel('act', 0.7)

      // 2. the game's own little show
      let act = 0
      if (!reduced && bits.length) act = CHOREOS[motif.choreo](tl, bits, { W, H, R, bitPx, motif, field: el.querySelector('.wr-field')!, strike: el.querySelector('.wr-strike') }) * quick
      tl.addLabel('collapse', `act+=${act}`)

      // 3. everything gets sucked into the middle while the tension rises
      tl.call(() => sfx.riser(0.8), undefined, `collapse-=0.35`)
      if (bits.length) {
        tl.to(bits, { x: 0, y: 0, scale: 0, rotate: '+=200', duration: 0.5, ease: 'back.in(1.8)', stagger: { each: 0.012, from: 'random' } }, 'collapse')
          .to('.wr-strike', { autoAlpha: 0, duration: 0.2 }, 'collapse')
          .to('.wr-field', { rotate: 0, duration: 0.5, ease: 'power2.in' }, 'collapse')
      }
      tl.addLabel('boom', 'collapse+=0.52')

      // 4. flash, shockwave, the winner bursts out on spinning rays
      const chars = gsap.utils.toArray<HTMLElement>('.wr-name .wr-ch')
      tl.call(() => { sfx.boom(); if (iWon) window.setTimeout(() => sfx.win(), 250) }, undefined, 'boom')
        .fromTo('.wr-flash', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06, ease: 'none' }, 'boom')
        .to('.wr-flash', { autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, 'boom+=0.06')
        .fromTo('.wr-ring', { scale: 0, autoAlpha: 1 }, { scale: 5, autoAlpha: 0, duration: 0.9, ease: 'expo.out' }, 'boom')
        .fromTo('.wr-rays', { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.9, ease: 'expo.out' }, 'boom')
        .fromTo('.wr-hero', { scale: 0, rotate: (i: number) => (i % 2 ? 40 : -40) }, { scale: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.55)', stagger: 0.08 }, 'boom+=0.02')
        .fromTo('.wr-crown', { y: -120, scale: 0, rotate: -90 }, { y: 0, scale: 1, rotate: -12, duration: 0.7, ease: 'back.out(3)', stagger: 0.08 }, 'boom+=0.3')
        .fromTo(chars, { yPercent: 120, scale: 2.4, rotate: () => gsap.utils.random(-40, 40), autoAlpha: 0 },
          { yPercent: 0, scale: 1, rotate: 0, autoAlpha: 1, duration: 0.55, ease: 'back.out(2.4)', stagger: 0.035 }, 'boom+=0.35')
        .fromTo('.wr-wins', { scale: 0, rotate: 30 }, { scale: 1, rotate: -6, duration: 0.6, ease: 'back.out(3.5)', onStart: () => sfx.slam() }, `boom+=${0.5 + chars.length * 0.035}`)
        .fromTo('.wr-sum', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4 }, '<+0.2')

      const confetti = gsap.utils.toArray<HTMLElement>('.wr-confetti > *')
      gsap.set(confetti, { scale: 0 })
      tl.to(confetti, {
        x: () => gsap.utils.random(-W * 0.55, W * 0.55), y: () => gsap.utils.random(-H * 0.55, H * 0.3),
        scale: () => gsap.utils.random(0.5, 1.3), rotate: () => gsap.utils.random(-540, 540),
        duration: 1.3, ease: 'expo.out', stagger: 0.006,
      }, 'boom+=0.05')
        .to(confetti, { y: `+=${H}`, rotate: '+=200', duration: 2.4, ease: 'power1.in', stagger: 0.01 }, 'boom+=1.2')

      // 5. hold the moment, then hand the faces to the podium and dissolve
      tl.addLabel('handoff', `boom+=${(lowPower ? 1.9 : 2.3) + chars.length * 0.03}`)
        .call(() => {
          const rects: HeroRects = {}
          el.querySelectorAll<HTMLElement>('.wr-hero').forEach((h) => { rects[h.dataset.pid!] = h.getBoundingClientRect() })
          tl.timeScale(1)
          onHandoff(rects)
        }, undefined, 'handoff')
        .to('.wr-hero', { autoAlpha: 0, duration: 0.01 }, 'handoff+=0.06')
        .to(['.wr-name', '.wr-wins', '.wr-sum', '.wr-crown', '.wr-tag'], { autoAlpha: 0, scale: 0.85, duration: 0.3, ease: 'power2.in' }, 'handoff')
        .to(['.wr-bg', '.wr-rays'], { autoAlpha: 0, duration: 0.45, ease: 'power1.inOut' }, 'handoff+=0.1')
        .call(onDone)
    }, root)
    return () => ctx.revert()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // a tap rushes to the reveal (or past it), never skips the handoff
  const rush = () => { const tl = tlRef.current; if (tl && tl.timeScale() < 3) tl.timeScale(3.5) }

  // the host skipped it for everyone: jump to just before the handoff
  useEffect(() => onReelSkip(() => {
    const tl = tlRef.current
    if (!tl || tl.time() >= tl.labels.handoff) return
    tl.timeScale(1).seek(tl.labels.handoff - 0.01)
  }), [])
  const isHost = room.host === me

  const heroSize = `min(${heroes.length > 1 ? 26 : 36}vmin, ${Math.floor(78 / Math.max(1, heroes.length))}vw, 300px)`
  return (
    <div ref={root} className="wr" onClick={rush} role="presentation"
      style={{ ['--gbg' as string]: meta?.bg ?? '#e64fe0', ['--gink' as string]: meta?.ink ?? '#1d3a6e', ['--hero' as string]: heroSize }}>
      <div className="wr-bg">
        <div className="wr-marquee" aria-hidden>
          {[0, 1].map((row) => (
            <div key={row} className={`wr-mq-row r${row}`}><span>{`${name} ★ `.repeat(8)}</span><span>{`${name} ★ `.repeat(8)}</span></div>
          ))}
        </div>
      </div>
      <div className="wr-rays" aria-hidden />
      <div className="wr-stripe s1" aria-hidden />
      <div className="wr-stripe s2" aria-hidden />
      <span className="wr-tag sticker">{name} · final</span>

      <div className="wr-field" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="wr-bit"><svg viewBox="-50 -50 100 100">{motif.piece(i)}</svg></div>
        ))}
        {state.game === 'tictactoe' && <div className="wr-strike" />}
      </div>

      <div className="wr-ring" aria-hidden />
      <div className="wr-stage">
        <div className="wr-heroes">
          {heroes.map((pid) => (
            <div key={pid} className="wr-hero" data-pid={pid} style={{ ['--pc' as string]: hex(pid) }}>
              <span className="wr-crown" aria-hidden><Glyph name="star" color="#ffb424" size="100%" /></span>
              <div className="wr-face"><Avatar config={player(pid)?.avatar} size="100%" track="none" expression={tie ? 'wink' : 'happy'} /></div>
            </div>
          ))}
        </div>
        <h1 className="wr-name display" aria-label={`${title} ${tag ?? ''}`}>
          {Array.from(title).map((ch, i) => <span key={i} className="wr-ch">{ch === ' ' ? ' ' : ch}</span>)}
        </h1>
        {tag && <span className="wr-wins display">{tag}</span>}
        <p className="wr-sum">{res.summary}</p>
      </div>

      <div className="wr-confetti" aria-hidden>
        {Array.from({ length: lowPower ? 14 : 40 }, (_, i) => (
          <Glyph key={i} name={ALL_GLYPHS[i % ALL_GLYPHS.length]} size={26 + (i % 4) * 10} color={['#e64fe0', '#d9f66b', '#a7ecff', '#ffb424', '#fff'][i % 5]} />
        ))}
      </div>
      <div className="wr-flash" aria-hidden />
      <span className="wr-hint">tap to speed up</span>
      {isHost && (
        <button className="wr-skip bubble-btn small navy" onClick={(e) => { e.stopPropagation(); skipReel() }} data-cursor="SKIP">
          Skip for everyone
          <svg className="ico" viewBox="0 0 24 24" aria-hidden><path d="M5 5l8 7-8 7zM14 5l8 7-8 7z" fill="currentColor" /></svg>
        </button>
      )}
    </div>
  )
}

/* ---------- choreographies: each adds its show at the 'act' label and returns how long it runs ---------- */

type Ctx = { W: number; H: number; R: number; bitPx: number; motif: Motif; field: HTMLElement; strike: HTMLElement | null }
const rnd = gsap.utils.random

const CHOREOS: Record<Motif['choreo'], (tl: gsap.core.Timeline, bits: HTMLElement[], c: Ctx) => number> = {
  // cards fly up from below into a fan, ripple like a riffle, (flip), then go
  fan(tl, bits, { W, H, R, motif }) {
    const n = bits.length, r = Math.min(R * 0.42, 340)
    bits.forEach((b, i) => {
      const a = n > 1 ? -55 + (110 * i) / (n - 1) : 0
      const rad = (a * Math.PI) / 180
      tl.fromTo(b, { x: rnd(-W / 2, W / 2), y: H * 0.8, rotate: rnd(-220, 220), scale: 0.5 },
        { x: Math.sin(rad) * r, y: -Math.cos(rad) * r + r * 0.7, rotate: a, scale: 1, duration: 0.7, ease: 'back.out(1.6)', onStart: () => sfx.card() }, `act+=${i * 0.06}`)
    })
    tl.to(bits, { y: '-=34', duration: 0.16, yoyo: true, repeat: 1, ease: 'sine.inOut', stagger: 0.05 }, 'act+=1.0')
    if (motif.flip) tl.to(bits, { scaleX: -1, duration: 0.3, ease: 'power2.inOut', stagger: 0.05 }, 'act+=1.05')
    return 1.75
  },

  // pieces fall from the sky and bounce on an invisible floor (or stack up in columns)
  rain(tl, bits, { W, H, R, bitPx }) {
    const n = bits.length, floor = R * 0.3
    const cols = Math.min(7, Math.max(4, Math.round(W / (bitPx * 1.3))))
    const stack = n > cols
    bits.forEach((b, i) => {
      const col = stack ? i % cols : i
      const row = stack ? Math.floor(i / cols) : 0
      const x = stack ? (col - (cols - 1) / 2) * bitPx * 1.1 : (-0.42 + (0.84 * i) / Math.max(1, n - 1)) * W * 0.9 + rnd(-12, 12)
      tl.fromTo(b, { x, y: -H * 0.65 - rnd(0, H * 0.25), rotate: rnd(-120, 120), scale: rnd(0.8, 1.05) },
        { y: floor - row * bitPx * 1.02, rotate: stack ? 0 : rnd(-20, 20), duration: 0.85, ease: 'bounce.out',
          onComplete: () => { if (i % 3 === 0) sfx.step(i) } }, `act+=${stack ? row * 0.32 + col * 0.04 : rnd(0, 0.55)}`)
    })
    return 1.75
  },

  // pieces slam into a board one by one, then a winning line (or a wave of flips)
  grid(tl, bits, { R, bitPx, motif, strike }) {
    const cols = motif.cols ?? 3, rows = Math.ceil(bits.length / cols)
    const cell = Math.min(bitPx * 1.12, (R * 0.7) / cols)
    const order = gsap.utils.shuffle(bits.map((_, i) => i))
    bits.forEach((b, i) => {
      const x = (i % cols - (cols - 1) / 2) * cell, y = (Math.floor(i / cols) - (rows - 1) / 2) * cell
      tl.fromTo(b, { x, y, scale: 3.2, autoAlpha: 0, rotate: rnd(-50, 50) },
        { scale: cell / bitPx, autoAlpha: 1, rotate: 0, duration: 0.45, ease: 'expo.out', onStart: () => { if (order.indexOf(i) % 2 === 0) sfx.tap() } }, `act+=${order.indexOf(i) * (0.9 / bits.length)}`)
    })
    if (strike) {
      gsap.set(strike, { width: cell * 3.6, rotate: 45 })
      tl.fromTo(strike, { scaleX: 0, autoAlpha: 1 }, { scaleX: 1, duration: 0.35, ease: 'power3.out', onStart: () => sfx.slam() }, 'act+=1.05')
    }
    if (motif.flip) tl.to(bits, { scaleX: -(cell / bitPx), duration: 0.3, ease: 'power2.inOut', stagger: { each: 0.04, from: 'center' } }, 'act+=1.0')
    return 1.7
  },

  // pieces spring out into a ring that spins faster and faster
  orbit(tl, bits, { R, field }) {
    const n = bits.length, r = R * 0.33
    bits.forEach((b, i) => {
      const a = (i / n) * Math.PI * 2
      tl.fromTo(b, { x: 0, y: 0, scale: 0 }, { x: Math.cos(a) * r, y: Math.sin(a) * r, rotate: (a * 180) / Math.PI + 90, scale: 1, duration: 0.6, ease: 'back.out(1.6)' }, `act+=${i * 0.04}`)
      tl.to(b, { scale: 1.35, duration: 0.11, yoyo: true, repeat: 1, ease: 'power2.out', onStart: () => sfx.pad(i) }, `act+=${0.75 + i * 0.09}`)
    })
    tl.fromTo(field, { rotate: 0 }, { rotate: 400, duration: 1.8, ease: 'power2.in' }, 'act')
    return 1.75
  },

  // an explosion from the centre, then everything drifts in mid-air (the odd one throbs)
  burst(tl, bits, { W, H, R }) {
    bits.forEach((b, i) => {
      const a = rnd(0, Math.PI * 2), d = rnd(0.28, 0.52)
      tl.fromTo(b, { x: 0, y: 0, scale: 0, rotate: 0 },
        { x: Math.cos(a) * W * d, y: Math.sin(a) * H * d * 0.8, scale: rnd(0.7, 1.2), rotate: rnd(-300, 300), duration: 0.9, ease: 'expo.out' }, `act+=${i * 0.02}`)
    })
    tl.call(() => sfx.hit(0.8), undefined, 'act')
      .to(bits, { y: `-=${R * 0.05}`, rotate: '+=40', duration: 0.8, ease: 'sine.inOut' }, 'act+=0.9')
      .to(bits[0], { scale: 1.7, duration: 0.18, yoyo: true, repeat: 3, ease: 'power2.out' }, 'act+=0.85')
    return 1.65
  },

  // a rally that gets faster every hit, then the ball smashes into the middle
  rally(tl, bits, { W, R }) {
    const [ball, p1, p2] = bits
    const px = Math.min(W * 0.38, 440)
    tl.fromTo(p1, { x: -W, y: 0 }, { x: -px, duration: 0.5, ease: 'expo.out' }, 'act')
      .fromTo(p2, { x: W, y: 0 }, { x: px, duration: 0.5, ease: 'expo.out' }, 'act')
      .fromTo(ball, { x: 0, y: 0, scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, 'act+=0.2')
    let t = 0.45, side = 1
    for (const d of [0.34, 0.27, 0.21, 0.17, 0.14]) {
      const y = rnd(-R * 0.26, R * 0.26)
      const paddle = side > 0 ? p2 : p1
      tl.to(ball, { x: side * (px - 26), y, duration: d, ease: 'none' }, `act+=${t}`)
        .to(paddle, { y, duration: d * 0.9, ease: 'power2.out' }, `act+=${t}`)
        .call(() => sfx.hit(0.3 + Math.random() * 0.5), undefined, `act+=${t + d}`)
      t += d
      side = -side
    }
    tl.to(ball, { x: 0, y: 0, scale: 2.6, duration: 0.25, ease: 'power3.in' }, `act+=${t}`)
    return t + 0.2
  },
}
