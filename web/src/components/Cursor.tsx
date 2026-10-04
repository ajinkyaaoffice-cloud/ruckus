import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import './Cursor.css'

/** Blob cursor that swells over anything interactive and can show a label via data-cursor="…". */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    document.body.classList.add('has-cursor')
    const d = dot.current!, r = ring.current!
    const xd = gsap.quickTo(d, 'x', { duration: 0.08 }), yd = gsap.quickTo(d, 'y', { duration: 0.08 })
    const xr = gsap.quickTo(r, 'x', { duration: 0.45, ease: 'power3' }), yr = gsap.quickTo(r, 'y', { duration: 0.45, ease: 'power3' })
    let hot: Element | null = null
    const move = (e: PointerEvent) => {
      xd(e.clientX); yd(e.clientY); xr(e.clientX); yr(e.clientY)
      const t = (e.target as Element)?.closest?.('a, button, [data-cursor], input, label, [role=button]')
      if (t !== hot) {
        hot = t
        const lab = t?.getAttribute('data-cursor') ?? ''
        text.current!.textContent = lab
        gsap.to(r, { scale: t ? (lab ? 2.6 : 1.7) : 1, backgroundColor: lab ? '#1d3a6e' : 'rgba(230,79,224,0)', duration: 0.4, ease: 'back.out(2)' })
        gsap.to(d, { scale: t ? 0 : 1, duration: 0.2 })
      }
    }
    const down = () => gsap.to(r, { scale: '-=0.3', duration: 0.12, yoyo: true, repeat: 1 })
    const leave = () => gsap.to([d, r], { opacity: 0, duration: 0.2 })
    const enter = () => gsap.to([d, r], { opacity: 1, duration: 0.2 })
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    document.addEventListener('mouseleave', leave)
    document.addEventListener('mouseenter', enter)
    return () => {
      document.body.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      document.removeEventListener('mouseleave', leave)
      document.removeEventListener('mouseenter', enter)
    }
  }, [])

  return (
    <>
      <div ref={ring} className="cur-ring"><span ref={text} className="display" /></div>
      <div ref={dot} className="cur-dot" />
    </>
  )
}
