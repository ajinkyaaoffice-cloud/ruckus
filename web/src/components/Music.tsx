import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { create } from 'zustand'
import { musicOp, useNet } from '../lib/net'
import { fmtTime, loadYouTube, nextAfter, PLAYLIST, prevBefore, targetPos, thumb, trackOf, YS, type YTPlayer } from '../lib/music'
import { isMuted, onMuted, sfx } from '../lib/sound'
import './Music.css'

const DRIFT = 0.75        // seconds out of step before we correct
const SETTLE = 3000       // ms to leave the player alone after a seek/load
const BLOCKED_AFTER = 2500
const DUCK = 0.45         // music volume while a game is on

/** Shared between the player (mounted for the whole room) and the button (lives in the lobby dock). */
const useMusicUI = create<{ open: boolean; blocked: boolean; anchor: HTMLElement | null }>(() => ({ open: false, blocked: false, anchor: null }))
const setOpen = (o: boolean | ((o: boolean) => boolean)) =>
  useMusicUI.setState((s) => ({ open: typeof o === 'function' ? o(s.open) : o }))
const setBlocked = (blocked: boolean) => useMusicUI.setState({ blocked })

/** The spinning-record button that opens the music panel. */
export function MusicButton() {
  const ref = useRef<HTMLButtonElement>(null)
  const m = useNet((s) => s.room?.music)
  const { open, blocked } = useMusicUI()
  useEffect(() => {
    useMusicUI.setState({ anchor: ref.current })
    return () => useMusicUI.setState({ anchor: null, open: false })
  }, [])
  if (!m) return null
  const t = trackOf(m.track)
  return (
    <button ref={ref} className={`mu-mini ${m.playing ? 'mu-on' : ''} ${blocked ? 'mu-blocked' : ''}`} onClick={() => { sfx.click(); setOpen((o) => !o) }}
      aria-label="Music" aria-expanded={open} data-cursor="MUSIC">
      <span className="mu-disc">{t && <img src={thumb(t.id)} alt="" />}</span>
      {blocked ? <span className="mu-hint display">Tap for music</span> : m.playing && <Eq />}
    </button>
  )
}

/**
 * The room's shared music. One hidden YouTube player per device follows the
 * server's {track, pos, at, playing}: everyone computes the same position from
 * the synced server clock and nudges their player back whenever it drifts.
 * Any player can pick, skip, seek, pause or change the volume for the room.
 */
export default function Music() {
  const music = useNet((s) => s.room?.music)
  const isHost = useNet((s) => !!s.room && s.room.host === s.profile.pid)
  const { pathname } = useLocation()
  const inGame = pathname.endsWith('/play')

  const holder = useRef<HTMLDivElement>(null)
  const slot = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const { open, blocked, anchor } = useMusicUI()
  const [muted, setMutedState] = useState(isMuted())
  const [dur, setDur] = useState(0)
  const [, tick] = useState(0)

  // everything the sync loop needs, without re-creating it every render
  const st = useRef({ loaded: null as string | null, settle: 0, wantSince: 0, ended: null as string | null, vol: -1, mute: null as boolean | null, retryAt: 0 })
  const ctx = useRef({ inGame, muted })
  ctx.current = { inGame, muted }

  useEffect(() => { const off = onMuted(setMutedState); return () => { off() } }, [])

  // create the player once per room visit
  useEffect(() => {
    let dead = false
    const mount = document.createElement('div')
    holder.current!.appendChild(mount)
    loadYouTube().then((YT) => {
      if (dead) return
      player.current = new YT.Player(mount, {
        width: 320, height: 180,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0, iv_load_policy: 3, modestbranding: 1, origin: location.origin },
        events: {
          onReady: () => !dead && setReady(true),
          onStateChange: (e: { data: number }) => {
            if (dead) return
            const s = st.current
            if (e.data === YS.PLAYING) {
              setBlocked(false)
              s.wantSince = 0
              s.settle = 0                       // check the position straight away
              setDur(player.current?.getDuration() || 0)
              sync()
            } else if (e.data === YS.ENDED) {
              songOver()
            } else if (e.data === YS.CUED) {
              setDur(player.current?.getDuration() || 0)
            }
          },
          onError: (e: { data: number }) => {
            if (dead) return
            // 100/101/150: removed or not embeddable, so skip it; anything else is a hiccup, so load it again
            if (e.data === 100 || e.data === 101 || e.data === 150) songOver()
            else { st.current.loaded = null; st.current.retryAt = performance.now() + 1500 }
          },
        },
      })
    }).catch(() => {})
    return () => {
      dead = true
      try { player.current?.destroy() } catch { /* already gone */ }
      player.current = null
      mount.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** The song finished here: ask for the next one (the server only honours the first ask). */
  const songOver = useCallback(() => {
    const m = useNet.getState().room?.music
    if (!m?.track || st.current.ended === m.track) return
    st.current.ended = m.track
    musicOp('next', { from: m.track, track: nextAfter(m.track) })
  }, [])

  const applyVolume = () => {
    const p = player.current!, m = useNet.getState().room?.music
    if (!m) return
    const s = st.current
    const mute = ctx.current.muted
    if (mute !== s.mute) { if (mute) p.mute(); else p.unMute(); s.mute = mute }
    const v = Math.round(m.vol * (ctx.current.inGame ? DUCK : 1))
    if (v !== s.vol) { p.setVolume(v); s.vol = v }
  }

  /** Bring this device's player in line with the room. */
  const sync = useCallback(() => {
    const p = player.current
    const m = useNet.getState().room?.music
    if (!p || !m || typeof p.getPlayerState !== 'function') return
    const s = st.current, now = performance.now()
    applyVolume()
    if (!m.track) {
      if (s.loaded) { p.stopVideo(); s.loaded = null }
      return
    }
    const target = targetPos(m)
    if (s.loaded !== m.track) {
      if (now < s.retryAt) return
      s.loaded = m.track
      s.ended = null
      s.settle = now + SETTLE
      setDur(0)
      if (m.playing) { p.loadVideoById({ videoId: m.track, startSeconds: target }); s.wantSince = now }
      else p.cueVideoById({ videoId: m.track, startSeconds: m.pos })
      return
    }
    const state = p.getPlayerState()
    if (!m.playing) {
      s.wantSince = 0
      if (state === YS.PLAYING || state === YS.BUFFERING) p.pauseVideo()
      if (Math.abs(p.getCurrentTime() - m.pos) > 1) p.seekTo(m.pos, true)
      return
    }
    const d = p.getDuration()
    if (d > 0 && target > d + 1.5) { songOver(); return }    // everyone else already moved past the end
    if (state === YS.ENDED) return
    if (state !== YS.PLAYING && state !== YS.BUFFERING) {
      if (!s.wantSince) s.wantSince = now
      if (now - s.wantSince > BLOCKED_AFTER) setBlocked(true)  // the browser won't start sound without a tap
      if (now > s.settle) { p.seekTo(target, true); p.playVideo(); s.settle = now + 1200 }
      return
    }
    if (state === YS.BUFFERING || now < s.settle) return
    if (Math.abs(p.getCurrentTime() - target) > DRIFT) {
      p.seekTo(target + 0.2, true)                            // a hair ahead to cover the seek itself
      s.settle = now + SETTLE
    }
  }, [songOver]) // eslint-disable-line react-hooks/exhaustive-deps

  // follow room changes immediately, and keep checking for drift
  useEffect(() => { if (ready) sync() }, [ready, music, sync])
  useEffect(() => { if (ready) applyVolume() }, [ready, inGame, muted]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(sync, 1000)
    return () => clearInterval(id)
  }, [ready, sync])

  // a phone coming back from the background re-syncs right away
  useEffect(() => {
    const vis = () => { if (!document.hidden) { st.current.settle = 0; sync() } }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [sync])

  // when autoplay was refused, the next tap anywhere starts the music
  useEffect(() => {
    if (!blocked) return
    const unlock = () => {
      const p = player.current, m = useNet.getState().room?.music
      if (!p || !m?.playing) return
      if (!ctx.current.muted) p.unMute()
      p.seekTo(targetPos(m), true)
      p.playVideo()
    }
    window.addEventListener('pointerdown', unlock, true)
    return () => window.removeEventListener('pointerdown', unlock, true)
  }, [blocked])

  // a fresh room starts the party playlist (the host's device kicks it off once)
  const kicked = useRef(false)
  useEffect(() => {
    if (!isHost || kicked.current || !music || music.track) return
    kicked.current = true
    musicOp('select', { track: PLAYLIST[0].id })
  }, [isHost, music])

  // progress ticker while the panel is visible
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [open])

  // when the browser insists on a tap inside the player itself, show it in the panel's art slot
  const showFrame = blocked && open
  useLayoutEffect(() => {
    const h = holder.current!
    if (!showFrame) { h.removeAttribute('style'); return }
    const place = () => {
      const r = slot.current!.getBoundingClientRect()
      Object.assign(h.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, opacity: '1', pointerEvents: 'auto' })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [showFrame])

  useLayoutEffect(() => {
    if (!open || !panel.current) return
    const tw = gsap.fromTo(panel.current, { y: 30, scale: 0.92, autoAlpha: 0, transformOrigin: '0% 100%' }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.35, ease: 'back.out(1.8)' })
    return () => { tw.kill() }
  }, [open])

  // sit the panel just above the button, kept inside the screen
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null)
  useLayoutEffect(() => {
    if (!open || !anchor) return
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const w = panel.current?.offsetWidth ?? 360
      setAt({ left: Math.max(8, Math.min(r.left, innerWidth - w - 8)), bottom: innerHeight - r.top + 12 })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, anchor])

  // close on Escape / outside tap
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !(t as Element).closest?.('.mu-mini') && !holder.current?.contains(t)) setOpen(false)
    }
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', down)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', down) }
  }, [open])

  const m = music
  const t = trackOf(m?.track)
  const length = dur || t?.len || 0
  const pos = m ? Math.min(targetPos(m), length || Infinity) : 0

  return (
    <>
      <div ref={holder} className="mu-frame" aria-hidden={!showFrame} />
      {open && anchor && m && (
            <div ref={panel} className="mu-panel" role="dialog" aria-label="Music player" style={at ? { left: at.left, bottom: at.bottom } : { visibility: 'hidden' }}>
              <div className="mu-now">
                <div ref={slot} className="mu-art">
                  {t ? <img src={thumb(t.id)} alt="" /> : <span className="display">♪</span>}
                  {showFrame && <span className="mu-tapvideo display">Tap the video to start the music</span>}
                </div>
                <div className="mu-meta">
                  <small>{m.playing ? 'Now playing' : m.track ? 'Paused' : 'Nothing on'}</small>
                  <b className="display">{t?.title ?? 'Pick a song'}</b>
                  <span>{t?.artist}</span>
                  {m.by && <em>set by {m.by}</em>}
                </div>
              </div>

              <Seek pos={pos} length={length} disabled={!m.track} />

              <div className="mu-ctrls">
                <button className="mu-btn" onClick={() => { sfx.click(); musicOp('select', { track: prevBefore(m.track) }) }} aria-label="Previous song">
                  <svg viewBox="0 0 24 24"><path d="M7 5v14M19 5L9 12l10 7z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                </button>
                <button className="mu-btn big" aria-label={m.playing ? 'Pause' : 'Play'}
                  onClick={() => { sfx.click(); if (!m.track) musicOp('select', { track: PLAYLIST[0].id }); else musicOp(m.playing ? 'pause' : 'play') }}>
                  {m.playing
                    ? <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" /></svg>
                    : <svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>}
                </button>
                <button className="mu-btn" onClick={() => { sfx.click(); musicOp('select', { track: nextAfter(m.track) }) }} aria-label="Next song">
                  <svg viewBox="0 0 24 24"><path d="M17 5v14M5 5l10 7-10 7z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                </button>
              </div>

              <Volume vol={m.vol} muted={muted} />

              <ul className="mu-list">
                {PLAYLIST.map((s) => (
                  <li key={s.id}>
                    <button className={s.id === m.track ? 'mu-cur' : ''} onClick={() => { sfx.click(); musicOp('select', { track: s.id }) }}>
                      <img src={thumb(s.id)} alt="" loading="lazy" />
                      <span><b>{s.title}</b><small>{s.artist}</small></span>
                      {s.id === m.track && m.playing ? <Eq /> : <i>{fmtTime(s.len)}</i>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
      )}
    </>
  )
}

function Eq() {
  return <span className="mu-eq" aria-hidden><i /><i /><i /></span>
}

/** Scrubber: shows the shared position, sends a seek when released. */
function Seek({ pos, length, disabled }: { pos: number; length: number; disabled: boolean }) {
  const [drag, setDrag] = useState<number | null>(null)
  const v = drag ?? pos
  const commit = () => {
    if (drag == null) return
    musicOp('seek', { pos: drag })
    window.setTimeout(() => setDrag(null), 250)     // hold the thumb until the room echoes back
  }
  return (
    <div className="mu-seek">
      <input type="range" min={0} max={Math.max(1, Math.round(length))} step={1} value={Math.round(v)} disabled={disabled || !length}
        style={{ ['--p' as string]: `${length ? (v / length) * 100 : 0}%` }}
        onChange={(e) => setDrag(+e.target.value)} onPointerUp={commit} onKeyUp={commit} onTouchEnd={commit} aria-label="Seek" />
      <div className="mu-times"><span>{fmtTime(v)}</span><span>{length ? fmtTime(length) : '–:––'}</span></div>
    </div>
  )
}

/** Room volume (everyone hears the change). Sends while dragging, throttled. */
function Volume({ vol, muted }: { vol: number; muted: boolean }) {
  const [drag, setDrag] = useState<number | null>(null)
  const last = useRef(0)
  const timer = useRef(0)
  const v = drag ?? vol
  const send = (x: number, now = false) => {
    clearTimeout(timer.current)
    const go = () => { last.current = performance.now(); musicOp('vol', { vol: x }) }
    if (now || performance.now() - last.current > 150) go()
    else timer.current = window.setTimeout(go, 150)
  }
  const done = () => { if (drag != null) { send(drag, true); window.setTimeout(() => setDrag(null), 300) } }
  return (
    <div className="mu-vol">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted || v === 0 ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          : <path d="M16 8c2 2 2 6 0 8" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      </svg>
      <input type="range" min={0} max={100} value={v} style={{ ['--p' as string]: `${v}%` }} aria-label="Room volume"
        onChange={(e) => { const x = +e.target.value; setDrag(x); send(x) }} onPointerUp={done} onKeyUp={done} onTouchEnd={done} />
      <span className="mu-volnum">{muted ? 'muted' : v}</span>
    </div>
  )
}
