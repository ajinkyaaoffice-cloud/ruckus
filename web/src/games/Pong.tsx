import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import './Pong.css'

type Spark = { x: number; y: number; vx: number; vy: number; life: number; c: string }

export default function Pong({ state, me, room, spectator }: GameProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ state, at: performance.now() })
  const order: string[] = state.players
  const flip = order[1] === me // top player sees the table rotated
  const myIdx = order.indexOf(me)
  const dims = state.dims as { w: number; h: number; padW: number; padH: number; inset: number; r: number }

  useEffect(() => { latest.current = { state, at: performance.now() } }, [state])

  useEffect(() => {
    const canvas = cv.current!, g = canvas.getContext('2d')!
    const W = dims.w, H = dims.h
    let raf = 0, last = performance.now()
    let scale = 1, cw = 0, ch = 0
    const fit = () => {
      const r = wrap.current!.getBoundingClientRect()
      const dpr = Math.min(2, devicePixelRatio || 1)
      cw = r.width; ch = r.height
      canvas.width = cw * dpr; canvas.height = ch * dpr
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      scale = cw / W
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap.current!)

    const tx = (x: number) => (flip ? W - x : x) * scale
    const ty = (y: number) => (flip ? H - y : y) * scale
    const shown: Record<string, number> = {}
    const trail: { x: number; y: number }[] = []
    const sparks: Spark[] = []
    let shake = 0
    let localX = W / 2, myX = W / 2

    // input → world-x for my paddle (sent ~30 Hz)
    let lastSent = 0, sentX = -1
    const setTarget = (clientX: number) => {
      const r = canvas.getBoundingClientRect()
      let x = ((clientX - r.left) / r.width) * W
      if (flip) x = W - x
      localX = Math.min(Math.max(x, dims.padW / 2), W - dims.padW / 2)
    }
    const onMove = (e: PointerEvent) => setTarget(e.clientX)
    const keys = new Set<string>()
    const kd = (e: KeyboardEvent) => { if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) { keys.add(e.key); e.preventDefault() } }
    const ku = (e: KeyboardEvent) => keys.delete(e.key)
    if (!spectator && myIdx >= 0) {
      window.addEventListener('pointermove', onMove)
      window.addEventListener('keydown', kd)
      window.addEventListener('keyup', ku)
    }

    const off = onGameEvents((evs, st) => {
      for (const e of evs) {
        if (e.kind === 'hit') {
          sfx.hit(e.power)
          const b = st.ball
          for (let i = 0; i < 14; i++) {
            const a = Math.random() * Math.PI * 2, s = 0.3 + Math.random() * 0.9 * (0.5 + e.power)
            sparks.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: playerHex(room, e.by) })
          }
          shake = Math.max(shake, 4 * e.power)
        }
        if (e.kind === 'wall') sfx.wall()
        if (e.kind === 'serve') sfx.tick()
        if (e.kind === 'point') {
          e.by === me ? sfx.point() : sfx.bad()
          shake = 14
          const el = wrap.current!.querySelector(`.pg-score [data-p="${e.by}"]`)
          if (el) gsap.fromTo(el, { scale: 1.8, rotate: -12 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(3)' })
          gsap.fromTo(wrap.current!.querySelector('.pg-flash'), { opacity: 0.6 }, { opacity: 0, duration: 0.5 })
        }
      }
    })

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { state: st, at } = latest.current
      if (keys.size) {
        const dir = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0)
        localX = Math.min(Math.max(localX + dir * (flip ? -1 : 1) * 2.2 * dt, dims.padW / 2), W - dims.padW / 2)
      }
      if (!spectator && myIdx >= 0 && now - lastSent > 33 && Math.abs(localX - sentX) > 0.002) {
        act({ type: 'move', x: +localX.toFixed(4) })
        lastSent = now; sentX = localX
      }
      // my paddle: predicted with the server's speed cap; others: smoothed server value
      const step = 2.6 * dt
      myX += Math.max(-step, Math.min(step, localX - myX))

      const ball = st.ball
      const age = Math.min(0.06, (now - at) / 1000)
      const bx = ball.x + ball.vx * age, by = ball.y + ball.vy * age

      shake *= Math.pow(0.85, dt * 60)
      g.save()
      g.clearRect(0, 0, cw, ch)
      g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)

      // table
      g.fillStyle = '#1d3a6e'
      g.beginPath(); g.roundRect(0, 0, cw, ch, 26); g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4
      g.beginPath(); g.roundRect(8, 8, cw - 16, ch - 16, 20); g.stroke()
      g.setLineDash([14, 12]); g.lineWidth = 4
      g.beginPath(); g.moveTo(14, ch / 2); g.lineTo(cw - 14, ch / 2); g.stroke()
      g.setLineDash([])
      g.strokeStyle = 'rgba(255,255,255,0.2)'
      g.beginPath(); g.moveTo(cw / 2, 14); g.lineTo(cw / 2, ch - 14); g.stroke()

      // ball trail
      trail.push({ x: bx, y: by })
      if (trail.length > 10) trail.shift()
      trail.forEach((p, i) => {
        const k = i / trail.length
        g.fillStyle = `rgba(217,246,107,${k * 0.4})`
        g.beginPath(); g.arc(tx(p.x), ty(p.y), dims.r * scale * (0.4 + k * 0.6), 0, Math.PI * 2); g.fill()
      })

      // paddles
      order.forEach((pid, i) => {
        let x = st.paddles[pid] ?? W / 2
        if (pid === me && !spectator) x = myX
        else { shown[pid] = shown[pid] ?? x; shown[pid] += (x - shown[pid]) * Math.min(1, dt * 20); x = shown[pid] }
        const y = i === 0 ? H - dims.inset : dims.inset
        const px = tx(x), py = ty(y)
        const w = dims.padW * scale, h = Math.max(10, dims.padH * scale * 1.6)
        g.fillStyle = 'rgba(0,0,0,0.25)'
        g.beginPath(); g.roundRect(px - w / 2, py - h / 2 + 5, w, h, h / 2); g.fill()
        g.fillStyle = playerHex(room, pid)
        g.beginPath(); g.roundRect(px - w / 2, py - h / 2, w, h, h / 2); g.fill()
        g.fillStyle = 'rgba(255,255,255,0.45)'
        g.beginPath(); g.roundRect(px - w / 2 + 6, py - h / 2 + 3, w - 12, 3, 2); g.fill()
      })

      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life -= dt * 2.2
        if (s.life <= 0) { sparks.splice(i, 1); continue }
        s.x += s.vx * dt; s.y += s.vy * dt
        g.globalAlpha = s.life
        g.fillStyle = s.c
        g.beginPath(); g.arc(tx(s.x), ty(s.y), 4 * s.life + 1, 0, Math.PI * 2); g.fill()
      }
      g.globalAlpha = 1

      // ball
      const sp = Math.hypot(ball.vx, ball.vy)
      const ang = Math.atan2(flip ? -ball.vy : ball.vy, flip ? -ball.vx : ball.vx)
      const st2 = Math.min(0.35, sp * 0.12)
      g.save()
      g.translate(tx(bx), ty(by)); g.rotate(ang); g.scale(1 + st2, 1 - st2 * 0.5)
      g.fillStyle = '#d9f66b'
      g.beginPath(); g.arc(0, 0, dims.r * scale * 1.15, 0, Math.PI * 2); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.7)'
      g.beginPath(); g.arc(-dims.r * scale * 0.35, -dims.r * scale * 0.35, dims.r * scale * 0.35, 0, Math.PI * 2); g.fill()
      g.restore()

      g.restore()
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); off()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const bottom = flip ? order[1] : order[0]
  const top = flip ? order[0] : order[1]
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '…'
  const serveIn: number = state.serveIn

  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-to serif">first to {state.target}</span>
      </div>
      <div ref={wrap} className="pg-table" style={{ aspectRatio: `${dims.w} / ${dims.h}` }}>
        <canvas ref={cv} />
        <div className="pg-score">
          <span data-p={top} className="display t" style={{ color: playerHex(room, top) }}>{state.score[top]}</span>
          <span data-p={bottom} className="display b" style={{ color: playerHex(room, bottom) }}>{state.score[bottom]}</span>
        </div>
        <span className="pg-name t display">{name(top)}</span>
        <span className="pg-name b display">{spectator ? name(bottom) : 'You'}</span>
        {serveIn > 0.05 && !state.over && <div key={Math.ceil(serveIn)} className="pg-count display">{Math.ceil(serveIn)}</div>}
        <div className="pg-flash" />
      </div>
      {!spectator && <p className="pg-hint">Move your mouse / finger (or ← →) to steer your paddle</p>}
    </div>
  )
}
