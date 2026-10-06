import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import QrScanner from 'qr-scanner'
import Glyph from './Glyph'
import { sfx } from '../lib/sound'
import './Qr.css'

/** Pull a room code out of anything a QR might hold: a /join/CODE link, ?code=CODE, or the bare code. */
export function extractCode(text: string): string | null {
  const m = text.match(/\/join\/([A-Za-z]{4})\b/) || text.match(/[?&]code=([A-Za-z]{4})\b/) || text.trim().match(/^([A-Za-z]{4})$/)
  return m ? m[1].toUpperCase() : null
}

/**
 * Camera sheet. Opens like a shutter; when a room code is read the frame locks
 * on, the code pops up big, and the sheet hands over to the page wipe (the
 * parent starts the wipe from onCode and unmounts this once it covers).
 */
export default function QrScan({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [found, setFound] = useState<string | null>(null)
  const closing = useRef(false)
  const cb = useRef(onCode)
  cb.current = onCode

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' })
      gsap.fromTo('.qr-sheet', ...intro({ yPercent: 60, scale: 0.86, rotate: -6, duration: 0.7, ease: 'expo.out' }))
      gsap.fromTo('.qr-view', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 0.75, ease: 'expo.inOut', delay: 0.15 })
      gsap.fromTo('.qr-corner', ...intro({ scale: 0, duration: 0.5, ease: 'back.out(3)', stagger: 0.06, delay: 0.45 }))
      gsap.fromTo('.qr-sheet h3, .qr-hint', ...intro({ y: 16, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06, delay: 0.2 }))
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    let done = false
    const scanner = new QrScanner(video.current!, (res) => {
      if (done) return
      const code = extractCode(res.data)
      if (code) {
        done = true
        scanner.stop()
        setFound(code)
      }
    }, { highlightScanRegion: false, highlightCodeOutline: false, preferredCamera: 'environment' })
    scanner.start().catch(() => setErr('Camera unavailable. Allow camera access, or type the code instead.'))
    return () => { scanner.stop(); scanner.destroy() }
  }, [])

  // lock-on: frame snaps in, flash, code letters pop, then the wipe takes over
  useLayoutEffect(() => {
    if (!found) return
    sfx.win()
    navigator.vibrate?.(40)
    const ctx = gsap.context(() => {
      gsap.timeline()
        .to('.qr-line', { opacity: 0, duration: 0.15 }, 0)
        .to('.qr-corner.tl', { left: '24%', top: '24%', duration: 0.32, ease: 'back.out(2)' }, 0)
        .to('.qr-corner.tr', { right: '24%', top: '24%', duration: 0.32, ease: 'back.out(2)' }, 0)
        .to('.qr-corner.bl', { left: '24%', bottom: '24%', duration: 0.32, ease: 'back.out(2)' }, 0)
        .to('.qr-corner.br', { right: '24%', bottom: '24%', duration: 0.32, ease: 'back.out(2)' }, 0)
        .fromTo('.qr-flash', { opacity: 0.9 }, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 0.2)
        .to('.qr-view video', { scale: 1.15, filter: 'blur(4px) saturate(0.6)', duration: 0.6, ease: 'power2.out' }, 0.2)
        .fromTo('.qr-found', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.25)
        .fromTo('.qr-found b', ...intro({ y: 30, scale: 0.4, rotate: -20, duration: 0.42, ease: 'back.out(3)', stagger: 0.05 }), 0.28)
        .fromTo('.qr-found small', ...intro({ y: 10, opacity: 0, duration: 0.3, ease: 'power2.out' }), 0.45)
        .to('.qr-sheet', { scale: 1.04, duration: 0.5, ease: 'power2.out' }, 0.62)
    }, root)
    // hand over outside the context: reverting it on unmount must not kill the page wipe
    const t = setTimeout(() => cb.current(found), 620)
    return () => { clearTimeout(t); ctx.revert() }
  }, [found])

  const close = () => {
    if (closing.current || found) return
    closing.current = true
    gsap.timeline({ onComplete: onClose })
      .to(root.current!.querySelector('.qr-sheet'), { yPercent: 70, scale: 0.9, rotate: 5, opacity: 0, duration: 0.38, ease: 'power3.in' }, 0)
      .to(root.current, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 0.1)
  }

  return (
    <div ref={root} className="qr-modal" onClick={close}>
      <div className={`qr-sheet ${found ? 'found' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="display">{found ? 'Got it!' : 'Scan a room QR'}</h3>
        <div className="qr-view">
          <video ref={video} muted playsInline />
          {['tl', 'tr', 'bl', 'br'].map((c) => <span key={c} className={`qr-corner ${c}`} />)}
          <span className="qr-line" />
          <span className="qr-flash" />
          {found && (
            <div className="qr-found">
              <div>{found.split('').map((ch, i) => <b key={i} className="display">{ch}</b>)}</div>
              <small>Heading in…</small>
            </div>
          )}
          {err && !found && <div className="qr-err"><Glyph name="x" color="#e64fe0" size={40} />{err}</div>}
        </div>
        <p className="qr-hint">Point at the QR on the host's screen</p>
        <button className="bubble-btn navy" onClick={close} disabled={!!found}>Never mind</button>
      </div>
    </div>
  )
}
