import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import QrScanner from 'qr-scanner'
import Glyph from './Glyph'
import { sfx } from '../lib/sound'
import './Qr.css'

/** Pull a room code out of anything a QR might hold: a /join/CODE link, ?code=CODE, or the bare code. */
export function extractCode(text: string): string | null {
  const m = text.match(/\/join\/([A-Za-z]{4})\b/) || text.match(/[?&]code=([A-Za-z]{4})\b/) || text.trim().match(/^([A-Za-z]{4})$/)
  return m ? m[1].toUpperCase() : null
}

export default function QrScan({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const cb = useRef(onCode)
  cb.current = onCode

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.qr-sheet', { yPercent: 120, rotate: -10, duration: 0.8, ease: 'expo.out' })
      gsap.from('.qr-corner', { scale: 0, duration: 0.5, ease: 'back.out(3)', stagger: 0.06, delay: 0.3 })
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
        sfx.win()
        cb.current(code)
      }
    }, { highlightScanRegion: false, highlightCodeOutline: false, preferredCamera: 'environment' })
    scanner.start().catch(() => setErr('Camera unavailable. Allow camera access, or type the code instead.'))
    return () => { scanner.stop(); scanner.destroy() }
  }, [])

  return (
    <div ref={root} className="qr-modal" onClick={onClose}>
      <div className="qr-sheet" onClick={(e) => e.stopPropagation()}>
        <h3 className="display">Scan a room QR</h3>
        <div className="qr-view">
          <video ref={video} muted playsInline />
          {['tl', 'tr', 'bl', 'br'].map((c) => <span key={c} className={`qr-corner ${c}`} />)}
          <span className="qr-line" />
          {err && <div className="qr-err"><Glyph name="x" color="#e64fe0" size={40} />{err}</div>}
        </div>
        <button className="bubble-btn navy" onClick={onClose}>Never mind</button>
      </div>
    </div>
  )
}
