import { useEffect, useRef } from 'react'
import { sfx } from '../lib/sound'
import './Cursor.css'

/**
 * Physics cursor. A bouncy ball hangs off the pointer on a spring: it lags,
 * overshoots, and squashes/stretches along its velocity. Clicking slams it
 * (impact squash + shockwave) and spits out confetti glyphs that fall with
 * gravity and bounce off the bottom of the window. Over anything interactive
 * the ball inflates into a ring that can carry a label (data-cursor="…"),
 * and over text fields it becomes a caret.
 */
type Particle = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; c: string; shape: number; life: number; max: number }
type Wave = { x: number; y: number; t: number; c: string }

const COLORS = ['#e64fe0', '#45b8ff', '#ffb424', '#d9f66b', '#a596ff', '#ff9a62', '#1d3a6e']
const HOT = 'a, button, [data-cursor], label, [role=button], select, summary'
const TEXT = 'input:not([type=range]):not([type=checkbox]), textarea, [contenteditable=true]'

export default function Cursor() {
  const ball = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    document.body.classList.add('has-cursor')
    const cv = canvas.current!, g = cv.getContext('2d')!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let tx = innerWidth / 2, ty = innerHeight / 2
    let x = tx, y = ty, vx = 0, vy = 0
    let size = 1, sizeT = 1, impact = 0, visible = 0, visibleT = 1
    let mode: 'idle' | 'hot' | 'text' = 'idle'
    let hotLabel = ''
    const trail: { x: number; y: number }[] = []
    const parts: Particle[] = []
    const waves: Wave[] = []
    let last = performance.now()
    let raf = 0

    const setMode = (el: Element | null) => {
      const text = el?.closest?.(TEXT)
      const hot = !text && el?.closest?.(HOT)
      const lab = hot ? (hot.getAttribute('data-cursor') ?? '') : ''
      const m = text ? 'text' : hot ? 'hot' : 'idle'
      if (m === mode && lab === hotLabel) return
      mode = m; hotLabel = lab
      sizeT = m === 'hot' ? (lab ? 2.9 : 1.9) : m === 'text' ? 0.6 : 1
      ball.current!.dataset.mode = m
      ball.current!.dataset.lab = lab ? '1' : '0'
      label.current!.textContent = lab
      label.current!.dataset.on = lab ? '1' : '0'
    }

    const move = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY
      visibleT = 1
      setMode(e.target as Element)
    }
    const burst = (bx: number, by: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4
        const sp = 4 + Math.random() * 7
        parts.push({
          x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5,
          s: 5 + Math.random() * 6, c: COLORS[(Math.random() * COLORS.length) | 0], shape: (Math.random() * 4) | 0, life: 0, max: 1.1 + Math.random() * 0.8,
        })
      }
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      impact = 1
      sfx.tap()
      waves.push({ x: tx, y: ty, t: 0, c: COLORS[(Math.random() * COLORS.length) | 0] })
      burst(tx, ty, mode === 'hot' ? 14 : 9)
    }
    const onConfetti = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number; n: number }>).detail
      waves.push({ x: d.x, y: d.y, t: 0, c: '#e64fe0' })
      burst(d.x, d.y, d.n)
    }
    window.addEventListener('ruckus:confetti', onConfetti)
    const leave = () => { visibleT = 0 }
    const over = (e: MouseEvent) => setMode(e.target as Element)

    const drawShape = (p: Particle, alpha: number) => {
      g.save()
      g.globalAlpha = alpha
      g.translate(p.x, p.y)
      g.rotate(p.r)
      g.fillStyle = p.c; g.strokeStyle = p.c
      g.lineWidth = 3; g.lineCap = 'round'
      const s = p.s
      if (p.shape === 0) { g.beginPath(); g.arc(0, 0, s * 0.6, 0, Math.PI * 2); g.fill() }
      else if (p.shape === 1) { g.beginPath(); g.moveTo(-s * 0.6, -s * 0.6); g.lineTo(s * 0.6, s * 0.6); g.moveTo(s * 0.6, -s * 0.6); g.lineTo(-s * 0.6, s * 0.6); g.stroke() }
      else if (p.shape === 2) { g.beginPath(); g.moveTo(0, -s * 0.7); g.lineTo(s * 0.65, s * 0.5); g.lineTo(-s * 0.65, s * 0.5); g.closePath(); g.fill() }
      else { g.beginPath(); g.arc(0, 0, s * 0.55, 0, Math.PI * 2); g.stroke() }
      g.restore()
    }

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const f = dt * 60
      // spring toward the pointer (slightly under-damped → overshoot)
      vx += (tx - x) * 0.19 * f; vy += (ty - y) * 0.19 * f
      vx *= Math.pow(0.6, f); vy *= Math.pow(0.6, f)
      x += vx * f; y += vy * f
      size += (sizeT - size) * Math.min(1, 0.2 * f)
      impact *= Math.pow(0.86, f)
      visible += (visibleT - visible) * Math.min(1, 0.2 * f)

      const speed = Math.hypot(vx, vy)
      const stretch = mode === 'idle' ? Math.min(speed / 45, 0.55) : Math.min(speed / 120, 0.2)
      const ang = Math.atan2(vy, vx)
      const sq = impact * 0.45
      ball.current!.style.transform =
        `translate3d(${x}px, ${y}px, 0) rotate(${ang}rad) scale(${size * (1 + stretch + sq * 0.5)}, ${size * (1 - stretch * 0.55 - sq)})`
      ball.current!.style.opacity = String(visible)
      label.current!.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${1 - impact * 0.3})`
      dot.current!.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
      dot.current!.style.opacity = String(mode === 'text' ? 0 : visible)

      // canvas: trail, shockwaves, confetti
      g.clearRect(0, 0, innerWidth, innerHeight)
      trail.push({ x, y })
      if (trail.length > 12) trail.shift()
      if (mode === 'idle' && speed > 4) {
        for (let i = 1; i < trail.length; i++) {
          const k = i / trail.length
          g.strokeStyle = `rgba(230, 79, 224, ${k * 0.35})`
          g.lineWidth = k * 14
          g.lineCap = 'round'
          g.beginPath(); g.moveTo(trail[i - 1].x, trail[i - 1].y); g.lineTo(trail[i].x, trail[i].y); g.stroke()
        }
      }
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i]
        w.t += dt * 2.6
        if (w.t >= 1) { waves.splice(i, 1); continue }
        const e = 1 - Math.pow(1 - w.t, 3)
        g.strokeStyle = w.c
        g.globalAlpha = 1 - w.t
        g.lineWidth = 6 * (1 - w.t) + 1
        g.beginPath(); g.arc(w.x, w.y, 8 + e * 46, 0, Math.PI * 2); g.stroke()
        g.globalAlpha = 1
      }
      const floor = innerHeight - 4
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.life += dt
        if (p.life > p.max) { parts.splice(i, 1); continue }
        p.vy += 0.42 * f
        p.vx *= Math.pow(0.99, f)
        p.x += p.vx * f; p.y += p.vy * f; p.r += p.vr * f
        if (p.y > floor) { p.y = floor; p.vy *= -0.55; p.vx *= 0.8; p.vr *= 0.7 }
        if (p.x < 0 || p.x > innerWidth) { p.vx *= -0.7; p.x = Math.max(0, Math.min(innerWidth, p.x)) }
        const a = p.life > p.max - 0.3 ? (p.max - p.life) / 0.3 : 1
        drawShape(p, a)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    document.addEventListener('mouseover', over)
    document.documentElement.addEventListener('mouseleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('ruckus:confetti', onConfetti)
      document.body.classList.remove('has-cursor')
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      document.removeEventListener('mouseover', over)
      document.documentElement.removeEventListener('mouseleave', leave)
    }
  }, [])

  return (
    <div className="cur" aria-hidden>
      <canvas ref={canvas} className="cur-canvas" />
      <div ref={ball} className="cur-ball" data-mode="idle"><i /></div>
      <div ref={label} className="cur-label display" data-on="0" />
      <div ref={dot} className="cur-dot" />
    </div>
  )
}
