import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import QRCode from 'qrcode'
import { sfx } from '../lib/sound'
import { api } from '../lib/net'
import './Qr.css'

/** Phones can't reach "localhost", so swap in the machine's LAN IP when we're served locally. */
export async function joinUrl(code: string): Promise<string> {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  let origin = location.origin
  try {
    const r = await fetch(api('/api/net')).then((x) => x.json())
    if (r.public) origin = String(r.public).replace(/\/$/, '')
    else if (local && r.lan) origin = `${location.protocol}//${r.lan}${location.port ? ':' + location.port : ''}`
  } catch {
    /* fall back to current origin */
  }
  return `${origin}/join/${code}`
}

export function InviteCard({ code }: { code: string }) {
  const [svg, setSvg] = useState('')
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true
    joinUrl(code).then(async (u) => {
      const s = await QRCode.toString(u, { type: 'svg', margin: 0, color: { dark: '#1d3a6e', light: '#ffffff' }, errorCorrectionLevel: 'M' })
      if (alive) { setUrl(u); setSvg(s) }
    })
    return () => { alive = false }
  }, [code])
  return (
    <div className="qr-card">
      <div style={{ width: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="qr-url">{url}</div>
    </div>
  )
}

export default function InviteModal({ code, onClose }: { code: string; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.qr-sheet', ...intro({ scale: 0.3, rotate: 25, y: 200, duration: 0.8, ease: 'back.out(1.6)' }))
      gsap.fromTo('.inv-letter', ...intro({ yPercent: -200, rotate: () => gsap.utils.random(-50, 50), duration: 0.6, ease: 'back.out(2.5)', stagger: 0.07, delay: 0.25 }))
    }, root)
    return () => ctx.revert()
  }, [])
  const copy = async () => {
    const u = await joinUrl(code)
    try {
      await navigator.clipboard.writeText(u)
      setCopied(true)
      sfx.pop()
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <div ref={root} className="qr-modal" onClick={onClose}>
      <div className="qr-sheet" onClick={(e) => e.stopPropagation()}>
        <h3 className="display">Invite friends</h3>
        <div className="inv-code display">{code.split('').map((c, i) => <span key={i} className="inv-letter">{c}</span>)}</div>
        <InviteCard code={code} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="bubble-btn magenta" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
          <button className="bubble-btn navy" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
