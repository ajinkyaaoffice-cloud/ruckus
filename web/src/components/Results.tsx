import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { intro, ordinal } from '../lib/ui'
import { lowPower } from '../lib/perf'
import Avatar from './Avatar'
import Glyph, { ALL_GLYPHS } from './Glyph'
import GameArt from './GameArt'
import { Split } from './Chrome'
import type { HeroRects } from './WinnerReel'
import { backToLobby, PLAYER_HEX, rematch, type GameState, type Room } from '../lib/net'
import { gameMeta } from '../lib/catalog'
import './Results.css'

/**
 * After the winner reel: the podium in the game's own colours (the winners'
 * faces fly onto it straight from the reel), then a leaderboard of everyone who
 * played with the points they just earned ticking onto their session totals.
 */
export default function Results({ state, room, me, hero }: { state: GameState; room: Room; me: string; hero?: HeroRects }) {
  const root = useRef<HTMLDivElement>(null)
  const meta = gameMeta(state.game)
  const res = state.results!
  const awards: Record<string, { points: number; win: number }> = state.awards ?? {}
  const tie = res.ranking.length === 1
  const iWon = res.winners.includes(me)
  const canPick = room.host === me || !!room.settings?.anyonePicks
  const headline = tie ? "It's a draw!" : iWon ? 'You win!' : res.winners.length ? `${room.players.find((p) => p.id === res.winners[0])?.name ?? 'Someone'} wins!` : 'Game over'
  const steps = res.ranking.slice(0, 3)
  const order = steps.length === 3 ? [1, 0, 2] : steps.length === 2 ? [1, 0] : [0]
  const player = (pid: string) => room.players.find((x) => x.id === pid)
  const hex = (pid: string) => PLAYER_HEX[Math.max(0, room.players.findIndex((x) => x.id === pid)) % PLAYER_HEX.length]
  // everyone who played, in finishing order, sharing a place when tied
  const board = res.ranking.flatMap((group, place) => group.map((pid) => ({ pid, place })))

  useLayoutEffect(() => {
    const el = root.current!
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: hero ? 0 : 0.1 })
      if (hero) {
        // the reel's backdrop is the same colour, so this one is simply already there
        gsap.set('.res-back', { autoAlpha: 1 })
      } else {
        tl.fromTo('.res-back', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 0.7, ease: 'power3.inOut', clearProps: 'clipPath' })
      }
      const t0 = hero ? 0.05 : 0.45
      tl.fromTo('.res-art', { autoAlpha: 0, scale: 0.6, rotate: -30 }, { autoAlpha: 1, scale: 1, rotate: -12, duration: 1.1, ease: 'expo.out' }, t0)
        .fromTo('.res-inner > .sticker', ...intro({ autoAlpha: 0, scale: 0.4, rotate: -20, duration: 0.45, ease: 'back.out(3)' }), t0)
        .fromTo('.res-title .split-char', ...intro({ autoAlpha: 0, yPercent: 80, rotate: () => gsap.utils.random(-30, 30), duration: 0.55, ease: 'back.out(2.2)', stagger: 0.03 }), t0 + 0.05)
        .fromTo('.res-step', ...intro({ autoAlpha: 0, scaleY: 0, transformOrigin: '50% 100%', duration: 0.55, ease: 'back.out(1.6)', stagger: 0.1 }), t0 + 0.15)

      // winners: fly from where the reel left them; everyone else drops onto their step
      const faces = gsap.utils.toArray<HTMLElement>('.res-face')
      faces.forEach((f, i) => {
        const from = hero?.[f.dataset.pid!]
        if (from) {
          const r = f.getBoundingClientRect()
          tl.from(f, {
            x: from.left + from.width / 2 - (r.left + r.width / 2), y: from.top + from.height / 2 - (r.top + r.height / 2),
            scale: from.width / r.width, duration: 0.9, ease: 'expo.inOut',
          }, 0)
        } else {
          tl.fromTo(f, ...intro({ autoAlpha: 0, y: -140, scale: 0.6, duration: 0.6, ease: 'back.out(2)' }), t0 + 0.35 + i * 0.08)
        }
      })
      tl.fromTo('.res-name, .res-detail', ...intro({ autoAlpha: 0, y: 10, duration: 0.35, ease: 'power3.out', stagger: 0.04 }), t0 + 0.7)
        .fromTo('.res-sum', ...intro({ autoAlpha: 0, y: 16, duration: 0.4 }), t0 + 0.6)
        .fromTo('.res-lb', ...intro({ autoAlpha: 0, y: 60, rotate: 2, duration: 0.6, ease: 'back.out(1.6)' }), t0 + 0.85)
        .fromTo('.res-lb-row', ...intro({ autoAlpha: 0, x: -40, duration: 0.45, ease: 'back.out(2)', stagger: 0.07 }), t0 + 1.0)
        .fromTo('.res-actions > *', ...intro({ autoAlpha: 0, y: 24, duration: 0.45, ease: 'back.out(2)', stagger: 0.06 }), t0 + 1.2)

      // points pop in, then the session totals count up
      el.querySelectorAll<HTMLElement>('.res-lb-row').forEach((row, i) => {
        const pts = row.querySelector('.res-lb-plus')
        const total = row.querySelector<HTMLElement>('.res-lb-total b')
        const end = Number(total?.dataset.to ?? 0), add = Number(total?.dataset.add ?? 0)
        const at = t0 + 1.4 + i * 0.12
        if (pts) tl.fromTo(pts, { scale: 0, rotate: -30 }, { scale: 1, rotate: -6, duration: 0.45, ease: 'back.out(3)' }, at)
        if (total && add > 0) {
          const n = { v: end - add }
          total.textContent = String(n.v)
          tl.to(n, { v: end, duration: 0.6, ease: 'power2.out', onUpdate: () => { total.textContent = String(Math.round(n.v)) } }, at + 0.15)
        }
      })

      if (!hero) {
        const bits = gsap.utils.toArray<HTMLElement>('.res-confetti > *')
        gsap.set(bits, { scale: 0 })
        gsap.to(bits, {
          x: () => gsap.utils.random(-window.innerWidth / 2, window.innerWidth / 2),
          y: () => gsap.utils.random(-window.innerHeight / 2, window.innerHeight / 3),
          scale: () => gsap.utils.random(0.5, 1.3), rotate: () => gsap.utils.random(-540, 540),
          duration: 1.4, ease: 'expo.out', stagger: 0.01, delay: 0.9,
        })
        gsap.to(bits, { y: `+=${window.innerHeight}`, rotate: '+=180', autoAlpha: 0, duration: 2.6, ease: 'power1.in', delay: 2.4, stagger: 0.015 })
      }
    }, root)
    return () => ctx.revert()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={root} className="res" style={{ ['--gbg' as string]: meta?.bg ?? '#1d3a6e', ['--gink' as string]: meta?.ink ?? '#ffffff' }}>
      <div className="res-back">
        <div className="res-rays" aria-hidden />
        <GameArt id={state.game} className="res-art" />
      </div>
      {!hero && (
        <div className="res-confetti" aria-hidden>
          {Array.from({ length: lowPower ? 14 : 36 }, (_, i) => (
            <Glyph key={i} name={ALL_GLYPHS[i % ALL_GLYPHS.length]} size={28 + (i % 4) * 10}
              color={['#e64fe0', '#d9f66b', '#a7ecff', '#ffb424', '#fff'][i % 5]} />
          ))}
        </div>
      )}
      <div className="res-inner">
        <span className="sticker">{meta?.name}</span>
        <h1 className="res-title display"><Split text={headline} /></h1>
        <p className="res-sum">{res.summary}</p>

        <div className="res-podium">
          {order.map((place) => {
            const group = steps[place]
            if (!group) return null
            return (
              <div key={place} className={`res-col place-${place}`}>
                <div className="res-faces">
                  {group.map((pid) => (
                    <div key={pid} className="res-face" data-pid={pid}>
                      <div className="res-face-disc" style={{ background: hex(pid) }}>
                        <Avatar config={player(pid)?.avatar} size="100%" track={lowPower ? 'none' : 'mouse'} expression={place === 0 && !tie ? 'happy' : tie ? 'wink' : 'sad'} />
                      </div>
                      <span className="res-name" style={{ background: hex(pid) }}>{player(pid)?.name ?? 'Left'}</span>
                    </div>
                  ))}
                </div>
                <div className="res-step display"><span>{tie ? '=' : place + 1}</span></div>
              </div>
            )
          })}
        </div>

        <section className="res-lb" aria-label="Leaderboard">
          <header className="res-lb-head">
            <h2 className="display">Leaderboard</h2>
            <span>this game · room total</span>
          </header>
          {board.map(({ pid, place }) => {
            const p = player(pid)
            const add = awards[pid]?.points ?? 0
            return (
              <div key={pid} className={`res-lb-row ${pid === me ? 'me' : ''} ${place === 0 && !tie ? 'first' : ''}`} style={{ ['--pc' as string]: hex(pid) }}>
                <span className="res-lb-place display">{tie ? '=' : ordinal(place + 1)}</span>
                <span className="res-lb-face"><Avatar config={p?.avatar} size="100%" track="none" expression={place === 0 && !tie ? 'happy' : 'idle'} /></span>
                <span className="res-lb-who">
                  <b>{p?.name ?? 'Left'}{pid === me && <em> (you)</em>}</b>
                  {res.details[pid] && <small>{res.details[pid]}</small>}
                </span>
                <span className={`res-lb-plus display ${add ? '' : 'zero'}`}>+{add}</span>
                <span className="res-lb-total"><b className="display" data-to={p?.points ?? 0} data-add={add}>{p?.points ?? 0}</b><small>pts</small></span>
              </div>
            )
          })}
          <p className="res-lb-legend">win 3 · 2nd of 3+ gets 1 · draw 1</p>
        </section>

        <div className="res-actions">
          {canPick ? (
            <>
              <button className="bubble-btn big magenta" onClick={rematch} data-cursor="AGAIN">Rematch</button>
              <button className="bubble-btn big" onClick={backToLobby} data-cursor="LOBBY">Pick another</button>
            </>
          ) : (
            <div className="res-wait display">Waiting for the host<span>.</span><span>.</span><span>.</span></div>
          )}
        </div>
      </div>
    </div>
  )
}
