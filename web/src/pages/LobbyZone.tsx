import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { intro } from '../lib/ui'
import { lowPower } from '../lib/perf'
import { TopBar, BrushMarks, Split } from '../components/Chrome'
import Avatar from '../components/Avatar'
import Glyph from '../components/Glyph'
import QrScan from '../components/QrScan'
import { useTransition } from '../components/Transition'
import { checkRoom, createRoom, joinRoom, useNet } from '../lib/net'
import { sfx } from '../lib/sound'
import './LobbyZone.css'
import { toast } from '../lib/toast'

const ALPHA = /[A-HJ-NP-Z]/ // room codes skip I, O, Q

export default function LobbyZone() {
  const root = useRef<HTMLDivElement>(null)
  const { go } = useTransition()
  const profile = useNet((s) => s.profile)
  const [code, setCode] = useState(['', '', '', ''])
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(false)
  const [side, setSide] = useState<'host' | 'join' | null>(null)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.15 })
      tl.fromTo('.lz-half.host', ...intro({ xPercent: -110, rotate: -8, duration: 1, ease: 'expo.out' }))
        .fromTo('.lz-half.join', ...intro({ xPercent: 110, rotate: 8, duration: 1, ease: 'expo.out' }), 0.06)
        .fromTo('.lz-title .split-char', ...intro({ yPercent: 130, rotate: 25, duration: 0.7, ease: 'back.out(2.2)', stagger: 0.03 }), 0.35)
        .fromTo('.lz-me', { scale: 0, rotate: 200 }, { scale: 1, rotate: 0, duration: 1, ease: 'elastic.out(1, 0.5)' }, 0.5)
        .fromTo('.lz-box', { y: 80, scale: 0.3, rotate: () => gsap.utils.random(-40, 40) }, { y: 0, scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.06, clearProps: 'transform' }, 0.6)
        .fromTo('.lz-act', { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.08, clearProps: 'transform' }, 0.75)
        .fromTo('.lz-glyph', ...intro({ scale: 0, rotate: -180, duration: 0.8, ease: 'back.out(2)', stagger: 0.05 }), 0.5)
      if (!lowPower) gsap.to('.lz-glyph', { y: '+=16', rotate: '+=12', duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.3 })
    }, root)
    return () => ctx.revert()
  }, [])

  const full = code.join('')

  const host = async () => {
    if (busy) return
    setBusy(true)
    sfx.click()
    try {
      const c = await createRoom()
      await go(`/room/${c}/avatar`, { label: 'DRESS UP!', colors: ['#d9f66b', '#e64fe0', '#1d3a6e'] })
    } catch {
      setBusy(false)
    }
  }

  const join = async (c = full) => {
    if (busy || c.length !== 4) return
    setBusy(true)
    sfx.click()
    const info = await checkRoom(c)
    if (!info.exists || info.full) {
      toast.error(info.exists ? 'That room is full (5 max)' : `No room called ${c}`)
      gsap.fromTo('.lz-code', { x: -14 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.25)' })
      setBusy(false)
      return
    }
    try {
      await joinRoom(c)
      await go(`/room/${c}/avatar`, { label: 'DRESS UP!', colors: ['#a7ecff', '#e64fe0', '#1d3a6e'] })
    } catch {
      setBusy(false)
    }
  }

  const typeAt = (i: number, v: string) => {
    const ch = v.toUpperCase().slice(-1)
    if (ch && !ALPHA.test(ch)) return
    const next = [...code]
    next[i] = ch
    setCode(next)
    if (ch) {
      sfx.place()
      gsap.fromTo(inputs.current[i], { scale: 1.35, rotate: -10 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(3)' })
      if (i < 3) inputs.current[i + 1]?.focus()
      else if (next.every(Boolean)) void join(next.join(''))
    }
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const t = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
    if (t.length === 4) {
      e.preventDefault()
      setCode(t.split(''))
      void join(t)
    }
  }

  useEffect(() => {
    const m = location.search.match(/code=([A-Za-z]{4})/)
    if (m) setCode(m[1].toUpperCase().split(''))
  }, [])

  return (
    <div ref={root} className={`lz ${side ? `focus-${side}` : ''}`}>
      <TopBar />
      <section className="lz-half host" onMouseEnter={() => setSide('host')} onMouseLeave={() => setSide(null)}>
        <BrushMarks />
        <Glyph className="lz-glyph g-star" name="star" color="#d9f66b" size={90} style={{ left: '12%', top: '20%' }} />
        <Glyph className="lz-glyph g-squig" name="squiggle" color="#1d3a6e" size={120} strokeWidth={9} style={{ left: '8%', bottom: '18%' }} />
        <div className="lz-inner">
          <span className="sticker">New party</span>
          <h1 className="lz-title display"><Split text="Host" /></h1>
          <p>Open a fresh room and invite up to four friends with a code or QR.</p>
          <button className="bubble-btn big lz-act" onClick={host} disabled={busy} data-cursor="OPEN">
            <Glyph name="plus" color="#e64fe0" size={22} /> Open a room
          </button>
        </div>
      </section>

      <section className="lz-half join" onMouseEnter={() => setSide('join')} onMouseLeave={() => setSide(null)}>
        <BrushMarks color="#a7ecff" opacity={0.18} />
        <Glyph className="lz-glyph g-o" name="o" color="#e64fe0" size={80} style={{ right: '12%', top: '18%' }} />
        <Glyph className="lz-glyph g-tri" name="tri" color="#ffb424" size={70} style={{ right: '8%', bottom: '16%' }} />
        <div className="lz-inner">
          <span className="sticker">Got a code?</span>
          <h1 className="lz-title display"><Split text="Join" /></h1>
          <div className="lz-code" onPaste={onPaste}>
            {code.map((c, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el }}
                className="lz-box display"
                value={c}
                inputMode="text"
                autoCapitalize="characters"
                maxLength={2}
                aria-label={`Code letter ${i + 1}`}
                onChange={(e) => typeAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !code[i] && i > 0) inputs.current[i - 1]?.focus()
                  if (e.key === 'Enter') void join()
                }}
              />
            ))}
          </div>
          <div className="lz-row">
            <button className="bubble-btn magenta lz-act" onClick={() => join()} disabled={busy || full.length !== 4} data-cursor="JOIN">Jump in</button>
            <button className="bubble-btn lz-act" onClick={() => { sfx.click(); setScan(true) }} data-cursor="SCAN">
              <svg className="ico" viewBox="0 0 24 24"><path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4M7 12h10" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" /></svg>
              Scan QR
            </button>
          </div>
        </div>
      </section>

      <div className="lz-me">
        <Avatar config={profile.avatar} size="100%" track="mouse" depth={1.6} badge expression={side === 'host' ? 'happy' : side === 'join' ? 'focus' : 'idle'} />
        <span className="lz-me-name display">{profile.name || 'You!'}</span>
      </div>

      {scan && (
        <QrScan
          onClose={() => setScan(false)}
          onCode={(c) => {
            setScan(false)
            setCode(c.split(''))
            void join(c)
          }}
        />
      )}
    </div>
  )
}
