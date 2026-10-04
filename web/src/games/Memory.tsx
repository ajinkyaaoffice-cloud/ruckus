import { useEffect, useLayoutEffect, useRef, type ReactElement } from 'react'
import gsap from 'gsap'
import type { GameProps } from '../pages/GameScreen'
import { act, onGameEvents, playerHex } from '../lib/net'
import { sfx } from '../lib/sound'
import { TurnBanner } from './shared'
import './Memory.css'

/** Hand-drawn icon set for the 18 server-side glyph names. Each is a 100x100 drawing. */
const ICONS: Record<string, { bg: string; el: ReactElement }> = {
  star: { bg: '#ffb424', el: <path d="M50 12 L61 38 L89 40 L67 58 L74 86 L50 71 L26 86 L33 58 L11 40 L39 38Z" fill="#fff" stroke="#fff" strokeWidth="6" strokeLinejoin="round" /> },
  moon: { bg: '#1d3a6e', el: <path d="M62 14 A38 38 0 1 0 86 66 A30 30 0 1 1 62 14Z" fill="#ffd84a" /> },
  bolt: { bg: '#a596ff', el: <path d="M58 8 L22 56 L46 56 L38 92 L78 40 L54 40Z" fill="#d9f66b" strokeLinejoin="round" stroke="#d9f66b" strokeWidth="4" /> },
  heart: { bg: '#ff9a62', el: <path d="M50 84 C20 64 10 46 14 32 C18 18 38 14 50 30 C62 14 82 18 86 32 C90 46 80 64 50 84Z" fill="#e64fe0" /> },
  drop: { bg: '#a7ecff', el: <path d="M50 10 C64 32 78 48 78 64 A28 28 0 0 1 22 64 C22 48 36 32 50 10Z" fill="#45b8ff" /> },
  leaf: { bg: '#d9f66b', el: <g><path d="M20 80 C20 40 46 18 84 16 C84 54 60 80 20 80Z" fill="#3fb36a" /><path d="M24 76 L66 36" stroke="#d9f66b" strokeWidth="5" strokeLinecap="round" /></g> },
  sun: { bg: '#ff9a62', el: <g><circle cx="50" cy="50" r="20" fill="#ffd84a" />{Array.from({ length: 8 }, (_, i) => <rect key={i} x="47" y="8" width="6" height="16" rx="3" fill="#ffd84a" transform={`rotate(${i * 45} 50 50)`} />)}</g> },
  ghost: { bg: '#a596ff', el: <g><path d="M24 86 L24 44 A26 26 0 0 1 76 44 L76 86 L67 78 L58 86 L50 78 L42 86 L33 78Z" fill="#fff" /><circle cx="40" cy="46" r="5" fill="#1d3a6e" /><circle cx="60" cy="46" r="5" fill="#1d3a6e" /></g> },
  crown: { bg: '#e64fe0', el: <g><path d="M16 72 L12 28 L34 46 L50 18 L66 46 L88 28 L84 72Z" fill="#ffd84a" strokeLinejoin="round" stroke="#ffd84a" strokeWidth="4" /><rect x="16" y="74" width="68" height="10" rx="4" fill="#ffd84a" /></g> },
  flower: { bg: '#f6b8f7', el: <g>{Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx="50" cy="28" rx="11" ry="18" fill="#fff" transform={`rotate(${i * 60} 50 50)`} />)}<circle cx="50" cy="50" r="12" fill="#ffb424" /></g> },
  cherry: { bg: '#d9f66b', el: <g><path d="M34 62 Q44 30 70 16 M66 62 Q64 36 70 16" stroke="#3fb36a" strokeWidth="5" fill="none" strokeLinecap="round" /><circle cx="32" cy="68" r="15" fill="#ff4d6d" /><circle cx="66" cy="68" r="15" fill="#ff4d6d" /><circle cx="27" cy="63" r="4" fill="#fff" opacity=".6" /></g> },
  rocket: { bg: '#1d3a6e', el: <g transform="rotate(35 50 50)"><path d="M50 8 C66 22 68 48 64 72 L36 72 C32 48 34 22 50 8Z" fill="#fff" /><circle cx="50" cy="38" r="8" fill="#45b8ff" /><path d="M36 58 L24 78 L36 72Z M64 58 L76 78 L64 72Z" fill="#e64fe0" /><path d="M42 74 Q50 96 58 74Z" fill="#ffb424" /></g> },
  fish: { bg: '#45b8ff', el: <g><path d="M14 50 C30 26 62 26 74 50 C62 74 30 74 14 50Z" fill="#ff9a62" /><path d="M72 50 L90 34 L90 66Z" fill="#ff9a62" /><circle cx="32" cy="46" r="4" fill="#1d3a6e" /></g> },
  planet: { bg: '#a596ff', el: <g><circle cx="50" cy="50" r="22" fill="#ffb424" /><ellipse cx="50" cy="50" rx="40" ry="10" fill="none" stroke="#fff" strokeWidth="5" transform="rotate(-20 50 50)" /></g> },
  diamond: { bg: '#a7ecff', el: <g><path d="M28 20 L72 20 L88 40 L50 86 L12 40Z" fill="#fff" /><path d="M12 40 L88 40 M28 20 L40 40 L50 86 L60 40 L72 20" stroke="#45b8ff" strokeWidth="3" fill="none" strokeLinejoin="round" /></g> },
  note: { bg: '#ffb424', el: <g><path d="M40 72 L40 22 L76 14 L76 62" stroke="#1d3a6e" strokeWidth="7" fill="none" strokeLinejoin="round" /><ellipse cx="32" cy="72" rx="11" ry="9" fill="#1d3a6e" /><ellipse cx="68" cy="64" rx="11" ry="9" fill="#1d3a6e" /></g> },
  cloud: { bg: '#45b8ff', el: <path d="M28 74 A16 16 0 0 1 26 42 A22 22 0 0 1 68 34 A18 18 0 0 1 76 74Z" fill="#fff" /> },
  eye: { bg: '#e64fe0', el: <g><path d="M10 50 Q50 12 90 50 Q50 88 10 50Z" fill="#fff" /><circle cx="50" cy="50" r="15" fill="#1d3a6e" /><circle cx="55" cy="45" r="5" fill="#fff" /></g> },
}

export default function Memory({ state, me, room, players, spectator }: GameProps) {
  const root = useRef<HTMLDivElement>(null)
  const faces: (string | null)[] = state.faces
  const owner: (string | null)[] = state.owner
  const flipped: number[] = state.flipped
  const cols: number = state.cols
  const myTurn = state.turn === me && !state.over && !spectator && !state.locked

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.mem-card', {
        y: -600, rotate: () => gsap.utils.random(-90, 90), scale: 0.4, duration: 0.8, ease: 'back.out(1.3)',
        stagger: { each: 0.025, from: 'random' }, delay: 0.9,
      })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => onGameEvents((evs) => {
    const card = (i: number) => root.current?.querySelector(`.mem-card[data-i="${i}"]`)
    for (const e of evs) {
      if (e.kind === 'flip') sfx.card()
      if (e.kind === 'match') {
        setTimeout(() => sfx.point(), 150)
        gsap.fromTo(e.cards.map(card), { scale: 1 }, { scale: 1.18, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', delay: 0.15 })
      }
      if (e.kind === 'miss') {
        sfx.bad()
        gsap.fromTo(e.cards.map(card), { x: 0 }, { x: 8, duration: 0.06, yoyo: true, repeat: 5, ease: 'none', clearProps: 'x' })
      }
    }
  }), [])

  const flip = (i: number) => {
    if (!myTurn || faces[i] !== null) return
    act({ type: 'flip', card: i })
  }

  return (
    <div ref={root} className="mem">
      <TurnBanner state={state} me={me} players={players} spectator={spectator} />
      <div className="mem-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, width: `min(94vw, ${cols * 104}px, calc((100svh - 300px) * ${cols / Math.ceil(faces.length / cols)} * 0.8))` }}>
        {faces.map((f, i) => {
          const up = f !== null
          const own = owner[i]
          const ic = f ? ICONS[f] : null
          return (
            <button key={i} data-i={i} className={`mem-card ${up ? 'up' : ''} ${own ? 'owned' : ''} ${flipped.includes(i) ? 'live' : ''} ${myTurn && !up ? 'can' : ''}`}
              onClick={() => flip(i)} style={own ? { ['--own' as string]: playerHex(room, own) } : undefined} aria-label={up ? f! : 'hidden card'}>
              <span className="mem-inner">
                <span className="mem-back">
                  <svg viewBox="0 0 100 100"><path d="M30 30 L70 70 M70 30 L30 70" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity=".55" /></svg>
                </span>
                <span className="mem-front" style={{ background: ic?.bg }}>
                  {ic && <svg viewBox="0 0 100 100">{ic.el}</svg>}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="mem-score">
        {state.players.map((pid: string) => (
          <span key={pid} className="display" style={{ background: playerHex(room, pid) }}>
            {room.players.find((p) => p.id === pid)?.name} · {state.score[pid]}
          </span>
        ))}
      </div>
    </div>
  )
}
