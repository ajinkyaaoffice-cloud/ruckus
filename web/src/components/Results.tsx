import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import { lowPower } from '../lib/perf'
import Avatar from './Avatar'
import Glyph, { ALL_GLYPHS } from './Glyph'
import { Split } from './Chrome'
import { backToLobby, PLAYER_HEX, rematch, type GameState, type Room } from '../lib/net'
import { gameMeta } from '../lib/catalog'
import './Results.css'

/** Podium overlay: winners hop on the top step, glyph confetti explodes, host decides what's next. */
export default function Results({ state, room, me }: { state: GameState; room: Room; me: string }) {
  const root = useRef<HTMLDivElement>(null)
  const res = state.results!
  const tie = res.ranking.length === 1
  const iWon = res.winners.includes(me)
  const isHost = room.host === me || !!room.settings?.anyonePicks
  const headline = tie ? "It's a draw!" : iWon ? 'You win!' : res.winners.length ? `${room.players.find((p) => p.id === res.winners[0])?.name ?? 'Someone'} wins!` : 'Game over'
  const steps = res.ranking.slice(0, 3)
  const order = steps.length === 3 ? [1, 0, 2] : steps.length === 2 ? [1, 0] : [0]

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // everything starts hidden (autoAlpha) so nothing flashes over the board before the backdrop lands
      const tl = gsap.timeline({ delay: 0.1 })
      tl.fromTo('.rs-back', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 0.7, ease: 'power3.inOut', clearProps: 'clipPath' })
        .fromTo('.rs-inner > .sticker', ...intro({ autoAlpha: 0, scale: 0.4, rotate: -20, duration: 0.45, ease: 'back.out(3)' }), 0.45)
        .fromTo('.rs-title .split-char', ...intro({ autoAlpha: 0, yPercent: 80, rotate: () => gsap.utils.random(-30, 30), duration: 0.55, ease: 'back.out(2.2)', stagger: 0.03 }), 0.5)
        .fromTo('.rs-step', ...intro({ autoAlpha: 0, scaleY: 0, transformOrigin: '50% 100%', duration: 0.5, ease: 'back.out(1.6)', stagger: 0.1 }), 0.75)
        .fromTo('.rs-face', ...intro({ autoAlpha: 0, y: -120, scale: 0.6, duration: 0.6, ease: 'back.out(2)', stagger: 0.1 }), 0.95)
        .fromTo('.rs-sum, .rs-detail, .rs-actions > *', ...intro({ autoAlpha: 0, y: 24, duration: 0.45, ease: 'power3.out', stagger: 0.06 }), 1.25)
      const bits = gsap.utils.toArray<HTMLElement>('.rs-confetti > *')
      gsap.set(bits, { scale: 0 })
      gsap.to(bits, {
        x: () => gsap.utils.random(-window.innerWidth / 2, window.innerWidth / 2),
        y: () => gsap.utils.random(-window.innerHeight / 2, window.innerHeight / 3),
        scale: () => gsap.utils.random(0.5, 1.3), rotate: () => gsap.utils.random(-540, 540),
        duration: 1.4, ease: 'expo.out', stagger: 0.01, delay: 0.9,
      })
      gsap.to(bits, { y: `+=${window.innerHeight}`, rotate: '+=180', autoAlpha: 0, duration: 2.6, ease: 'power1.in', delay: 2.4, stagger: 0.015 })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} className="rs">
      <div className="rs-back" />
      <div className="rs-confetti" aria-hidden>
        {Array.from({ length: lowPower ? 14 : 36 }, (_, i) => (
          <Glyph key={i} name={ALL_GLYPHS[i % ALL_GLYPHS.length]} size={28 + (i % 4) * 10}
            color={['#e64fe0', '#d9f66b', '#a7ecff', '#ffb424', '#fff'][i % 5]} />
        ))}
      </div>
      <div className="rs-inner">
        <span className="sticker">{gameMeta(state.game)?.name}</span>
        <h1 className="rs-title display"><Split text={headline} /></h1>
        <p className="rs-sum">{res.summary}</p>
        <div className="rs-podium">
          {order.map((place) => {
            const group = steps[place]
            if (!group) return null
            return (
              <div key={place} className={`rs-col place-${place}`}>
                <div className="rs-faces">
                  {group.map((pid) => {
                    const p = room.players.find((x) => x.id === pid)
                    const idx = room.players.findIndex((x) => x.id === pid)
                    return (
                      <div key={pid} className="rs-face">
                        <Avatar config={p?.avatar} size="100%" track={lowPower ? "none" : "mouse"} badge expression={place === 0 && !tie ? 'happy' : tie ? 'wink' : 'sad'} />
                        <span className="rs-name" style={{ background: PLAYER_HEX[Math.max(0, idx) % PLAYER_HEX.length] }}>{p?.name ?? 'Left'}</span>
                        {res.details[pid] && <span className="rs-detail">{res.details[pid]}</span>}
                      </div>
                    )
                  })}
                </div>
                <div className="rs-step display">{tie ? '=' : place + 1}</div>
              </div>
            )
          })}
        </div>
        <div className="rs-actions">
          {isHost ? (
            <>
              <button className="bubble-btn big magenta" onClick={rematch} data-cursor="AGAIN">Rematch</button>
              <button className="bubble-btn big" onClick={backToLobby} data-cursor="LOBBY">Pick another</button>
            </>
          ) : (
            <div className="rs-wait display">Waiting for the host<span>.</span><span>.</span><span>.</span></div>
          )}
        </div>
      </div>
    </div>
  )
}
