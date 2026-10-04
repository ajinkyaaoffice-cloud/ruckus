import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { lowPower } from '../lib/perf'
import './Cycles.css'

type Rider = { x: number; y: number; d: number; alive: boolean; corners: [number, number][]; slot: number }
const STEP = 1 / 11
const DXY = [[0, -1], [1, 0], [0, 1], [-1, 0]]
const KEYS: Record<string, number> = { ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3 }

export default function Cycles({ state, me, room, spectator }: GameProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ state, at: performance.now() })
  const playing = !spectator && !!state.riders?.[me]
  const [banner, setBanner] = useState<{ text: string; color: string; k: number } | null>(null)
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '…'

  useEffect(() => { latest.current = { state, at: performance.now() } }, [state])

  const steer = (d: number) => {
    if (!playing) return
    const r: Rider | undefined = latest.current.state.riders[me]
    if (!r?.alive) return
    act({ type: 'turn', dir: d })
  }

  // keyboard + swipe controls
  useEffect(() => {
    if (!playing) return
    const kd = (e: KeyboardEvent) => {
      const d = KEYS[e.key]
      if (d === undefined || e.repeat) return
      e.preventDefault()
      steer(d)
    }
    let sx = 0, sy = 0, live = false
    const el = wrap.current!
    const down = (e: PointerEvent) => { sx = e.clientX; sy = e.clientY; live = true }
    const move = (e: PointerEvent) => {
      if (!live) return
      const dx = e.clientX - sx, dy = e.clientY - sy
      if (Math.hypot(dx, dy) < 24) return
      steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0))
      sx = e.clientX; sy = e.clientY   // keep swiping without lifting the finger
    }
    const up = () => { live = false }
    window.addEventListener('keydown', kd)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('keydown', kd)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps

  // render loop
  useEffect(() => {
    const canvas = cv.current!, g = canvas.getContext('2d')!
    const W: number = state.w, H: number = state.h
    let raf = 0, cs = 1
    const fit = () => {
      const r = wrap.current!.getBoundingClientRect()
      const dpr = Math.min(lowPower ? 1.5 : 2, devicePixelRatio || 1)
      canvas.width = r.width * dpr; canvas.height = r.height * dpr
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      cs = r.width / W
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap.current!)
    const sparks: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = []
    const off = onGameEvents((evs, st) => {
      for (const e of evs) {
        if (e.kind === 'crash') {
          sfx.hit(1)
          const c = playerHex(room, e.pid)
          for (let i = 0; i < 24; i++) {
            const a = Math.random() * Math.PI * 2, s = 0.05 + Math.random() * 0.25
            sparks.push({ x: e.x + 0.5, y: e.y + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c })
          }
          if (e.pid === me) sfx.lose()
        }
        if (e.kind === 'round') sfx.slam()
        if (e.kind === 'go') { sfx.pop(); setBanner({ text: 'GO!', color: '#d9f66b', k: Date.now() }) }
        if (e.kind === 'roundover') {
          const w = e.winner as string | null
          if (w === me) sfx.win(); else sfx.point()
          setBanner({ text: w ? (w === me ? 'You win the round!' : `${name(w)} takes it!`) : 'Total wipeout!', color: w ? playerHex(room, w) : '#fff', k: Date.now() })
        }
      }
      void st
    })

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      const { state: s, at } = latest.current
      const riders: Record<string, Rider> = s.riders
      const cw = W * cs, ch = H * cs
      g.clearRect(0, 0, cw, ch)
      // floor grid
      g.strokeStyle = 'rgba(167, 236, 255, 0.08)'
      g.lineWidth = 1
      g.beginPath()
      for (let i = 4; i < W; i += 4) { g.moveTo(i * cs, 0); g.lineTo(i * cs, ch); g.moveTo(0, i * cs); g.lineTo(cw, i * cs) }
      g.stroke()
      // how far the heads have travelled since the last update (smooths 11 steps/s)
      const k = s.phase === 'run' ? Math.min(1, (t - at) / 1000 / STEP) : 0
      for (const [pid, r] of Object.entries(riders)) {
        const color = playerHex(room, pid)
        const hx = r.x + (r.alive ? DXY[r.d][0] * k : 0), hy = r.y + (r.alive ? DXY[r.d][1] * k : 0)
        const pts = [...r.corners, [hx, hy]]
        g.lineCap = 'round'; g.lineJoin = 'round'
        g.globalAlpha = r.alive ? 1 : 0.4
        if (!lowPower && r.alive) {
          g.strokeStyle = color; g.globalAlpha = 0.25; g.lineWidth = cs * 1.8
          g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, (x + 0.5) * cs, (y + 0.5) * cs)); g.stroke()
          g.globalAlpha = 1
        }
        g.strokeStyle = color; g.lineWidth = cs * 0.7
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, (x + 0.5) * cs, (y + 0.5) * cs)); g.stroke()
        if (r.alive) {
          g.fillStyle = '#fff'
          g.beginPath(); g.arc((hx + 0.5) * cs, (hy + 0.5) * cs, cs * 0.75, 0, Math.PI * 2); g.fill()
          g.fillStyle = color
          g.beginPath(); g.arc((hx + 0.5) * cs, (hy + 0.5) * cs, cs * 0.45, 0, Math.PI * 2); g.fill()
          if (pid === me && s.phase !== 'run') {
            // point out which rider is you before the start
            g.strokeStyle = '#fff'; g.lineWidth = 2
            g.beginPath(); g.arc((hx + 0.5) * cs, (hy + 0.5) * cs, cs * (2 + Math.sin(t / 150) * 0.5), 0, Math.PI * 2); g.stroke()
          }
        }
        g.globalAlpha = 1
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        p.x += p.vx; p.y += p.vy; p.life -= 0.03
        if (p.life <= 0) { sparks.splice(i, 1); continue }
        g.globalAlpha = p.life; g.fillStyle = p.c
        g.fillRect(p.x * cs - 2, p.y * cs - 2, 4, 4)
      }
      g.globalAlpha = 1
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); off() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!banner) return
    const el = wrap.current!.parentElement!.querySelector('.cy-banner')
    gsap.timeline().fromTo(el, { scale: 0, rotate: -10, autoAlpha: 1 }, { scale: 1, rotate: -3, duration: 0.4, ease: 'back.out(3)' })
      .to(el, { autoAlpha: 0, scale: 1.4, duration: 0.3 }, banner.text === 'GO!' ? '+=0.2' : '+=1.4')
  }, [banner?.k]) // eslint-disable-line react-hooks/exhaustive-deps

  const riders: Record<string, Rider> = state.riders
  const order = Object.keys(state.wins)
  const count = useCountdown(state.phase === 'count' ? state.countdown : null, state.round)
  const meAlive = riders[me]?.alive

  return (
    <div className="cy">
      <div className="cy-head">
        <span className="cy-round display">Round {state.round}</span>
        <div className="cy-wins">
          {order.map((pid) => (
            <span key={pid} className={`display ${riders[pid] && !riders[pid].alive ? 'out' : ''}`} style={{ ['--c' as string]: playerHex(room, pid) }}>
              {name(pid)}
              <span className="cy-pips">{Array.from({ length: state.winsNeeded }, (_, i) => <i key={i} className={i < state.wins[pid] ? 'on' : ''} />)}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="cy-stage">
        <div ref={wrap} className="cy-wrap" style={{ aspectRatio: `${state.w} / ${state.h}` }}>
          <canvas ref={cv} />
        </div>
        {count != null && <div key={count} className="cy-count display">{count}</div>}
        {banner && <div key={banner.k} className="cy-banner display" style={{ color: banner.color }}>{banner.text}</div>}
        {playing && !meAlive && state.phase === 'run' && <div className="cy-out display">Crashed! Watch the rest…</div>}
      </div>
      {playing && (
        <div className="cy-pad" aria-label="Steer">
          {[0, 3, 1, 2].map((d) => (
            <button key={d} className={`cy-btn d${d}`} onPointerDown={(e) => { e.preventDefault(); steer(d) }} aria-label={['Up', 'Right', 'Down', 'Left'][d]}>
              <svg viewBox="0 0 24 24"><path d="M6 15 L12 8 L18 15" stroke="currentColor" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ))}
        </div>
      )}
      {playing && <p className="cy-tip">Arrow keys, WASD or swipe the arena to steer</p>}
    </div>
  )
}

/** Seconds left, counted down locally (the server only sends the remaining time when something changes). */
function useCountdown(left: number | null | undefined, k: unknown) {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    if (left == null) { setN(null); return }
    const end = performance.now() + left * 1000
    const tick = () => setN(Math.max(1, Math.ceil((end - performance.now()) / 1000)))
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [left == null, k]) // eslint-disable-line react-hooks/exhaustive-deps
  return n
}
