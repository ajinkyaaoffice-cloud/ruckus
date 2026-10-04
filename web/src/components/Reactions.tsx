import type { ReactElement } from 'react'

/** In-house reaction stickers: flat shapes, navy ink outline, brand palette. */
export const REACTIONS = [
  { id: 'fire', label: 'On fire' },
  { id: 'lol', label: 'LOL' },
  { id: 'shock', label: 'No way' },
  { id: 'clap', label: 'Nice one' },
  { id: 'rage', label: 'Grr' },
  { id: 'ko', label: 'KO' },
  { id: 'party', label: 'Party' },
  { id: 'boom', label: 'Mind blown' },
] as const
export type ReactionId = (typeof REACTIONS)[number]['id']

const INK = '#1d3a6e'
const S = { stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

const Eye = ({ x, y, r = 6 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={INK} />
    <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.38} fill="#fff" />
  </g>
)
const Shine = ({ d }: { d: string }) => <path d={d} fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" opacity="0.75" />

const ART: Record<ReactionId, ReactElement> = {
  fire: (
    <g>
      <path className="rx-flame" d="M50 6 C62 22 80 30 80 58 C80 78 66 92 50 92 C34 92 20 78 20 58 C20 44 28 36 34 28 C36 40 42 44 46 44 C44 30 44 18 50 6Z" fill="#ff9a62" {...S} />
      <path d="M50 44 C58 54 66 60 66 72 C66 82 59 88 50 88 C41 88 34 82 34 72 C34 64 40 60 43 56 C45 62 48 63 50 63 C49 56 48 50 50 44Z" fill="#ffd84a" />
      <Eye x={42} y={70} r={4.5} />
      <Eye x={58} y={70} r={4.5} />
      <path d="M45 79 Q50 83 55 79" fill="none" {...S} strokeWidth={4} />
      <Shine d="M30 54 Q30 46 35 40" />
    </g>
  ),
  lol: (
    <g>
      <circle cx="50" cy="52" r="38" fill="#d9f66b" {...S} />
      <path d="M30 42 L40 47 L30 52" fill="none" {...S} />
      <path d="M70 42 L60 47 L70 52" fill="none" {...S} />
      <path d="M30 60 Q50 88 70 60 Z" fill={INK} {...S} />
      <path d="M40 72 Q50 66 60 72 Q56 80 50 80 Q44 80 40 72Z" fill="#ff5d73" />
      <path className="rx-tear l" d="M18 48 Q10 58 16 64 Q24 62 20 50Z" fill="#45b8ff" {...S} strokeWidth={3.5} />
      <path className="rx-tear r" d="M82 48 Q90 58 84 64 Q76 62 80 50Z" fill="#45b8ff" {...S} strokeWidth={3.5} />
      <Shine d="M28 30 Q34 22 44 19" />
    </g>
  ),
  shock: (
    <g>
      <path d="M50 12 C74 12 88 28 88 52 C88 76 72 90 50 90 C28 90 12 76 12 52 C12 28 26 12 50 12Z" fill="#a7ecff" {...S} />
      <circle cx="36" cy="44" r="11" fill="#fff" {...S} strokeWidth={4} />
      <circle cx="64" cy="44" r="11" fill="#fff" {...S} strokeWidth={4} />
      <circle className="rx-pupil" cx="36" cy="45" r="4" fill={INK} />
      <circle className="rx-pupil" cx="64" cy="45" r="4" fill={INK} />
      <ellipse cx="50" cy="70" rx="8" ry="11" fill={INK} />
      <path d="M26 26 L22 18 M36 20 L35 11" {...S} strokeWidth={4} />
      <path className="rx-sweat" d="M80 22 Q88 32 82 38 Q74 36 78 24Z" fill="#45b8ff" {...S} strokeWidth={3.5} />
    </g>
  ),
  clap: (
    <g>
      <g className="rx-hand l">
        <path d="M22 78 C14 66 16 48 24 36 C28 30 34 32 34 38 L36 26 C38 20 45 21 45 27 L46 22 C48 16 55 18 54 24 L54 52 C54 70 44 82 34 84 Z" fill="#ffb424" {...S} />
      </g>
      <g className="rx-hand r">
        <path d="M78 78 C86 66 84 48 76 36 C72 30 66 32 66 38 L64 26 C62 20 55 21 55 27 L54 22 C52 16 45 18 46 24 L46 52 C46 70 56 82 66 84 Z" fill="#e64fe0" {...S} />
      </g>
      <path className="rx-spark" d="M50 6 L50 14 M30 10 L34 17 M70 10 L66 17" {...S} strokeWidth={4.5} />
    </g>
  ),
  rage: (
    <g>
      <path d="M50 14 C74 14 88 30 88 54 C88 76 72 90 50 90 C28 90 12 76 12 54 C12 30 26 14 50 14Z" fill="#ff5d73" {...S} />
      <path d="M26 40 L44 48 M74 40 L56 48" {...S} strokeWidth={6} />
      <Eye x={37} y={56} r={5} />
      <Eye x={63} y={56} r={5} />
      <path d="M36 76 Q50 66 64 76" fill="none" {...S} />
      <g className="rx-steam">
        <path d="M8 22 Q2 14 10 8 Q18 4 20 12 Q26 8 28 16" fill="#fff" {...S} strokeWidth={3.5} />
        <path d="M92 22 Q98 14 90 8 Q82 4 80 12 Q74 8 72 16" fill="#fff" {...S} strokeWidth={3.5} />
      </g>
    </g>
  ),
  ko: (
    <g>
      <path className="rx-ghost" d="M20 88 L20 46 C20 26 34 12 50 12 C66 12 80 26 80 46 L80 88 L70 80 L60 88 L50 80 L40 88 L30 80 Z" fill="#a596ff" {...S} />
      <path d="M32 40 L42 50 M42 40 L32 50 M58 40 L68 50 M68 40 L58 50" {...S} />
      <path d="M40 66 Q45 62 50 66 Q55 70 60 66" fill="none" {...S} strokeWidth={4} />
      <path d="M52 66 Q54 76 58 74 Q60 70 58 67" fill="#ff5d73" {...S} strokeWidth={3} />
      <Shine d="M30 32 Q34 24 42 20" />
      <circle className="rx-orbit" cx="50" cy="6" r="3.5" fill="#ffd84a" {...S} strokeWidth={2.5} />
    </g>
  ),
  party: (
    <g>
      <path d="M14 90 L36 36 L66 66 Z" fill="#45b8ff" {...S} />
      <path d="M24 66 L44 82 M30 50 L56 72" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <g className="rx-confetti">
        <rect x="58" y="14" width="10" height="10" rx="2" fill="#ffd84a" {...S} strokeWidth={3} transform="rotate(20 63 19)" />
        <circle cx="82" cy="36" r="6" fill="#e64fe0" {...S} strokeWidth={3} />
        <path d="M44 14 Q48 6 54 10" fill="none" stroke="#d9f66b" strokeWidth="5" strokeLinecap="round" />
        <path d="M76 56 Q86 54 88 62" fill="none" stroke="#ff9a62" strokeWidth="5" strokeLinecap="round" />
        <path d="M84 14 L88 22 L80 20 Z" fill="#a596ff" {...S} strokeWidth={3} />
      </g>
    </g>
  ),
  boom: (
    <g>
      <path className="rx-burst" d="M50 4 L58 24 L78 12 L72 34 L94 36 L76 50 L92 66 L70 66 L74 88 L56 74 L50 94 L42 74 L24 88 L28 66 L6 66 L22 50 L4 36 L28 34 L20 12 L42 24 Z" fill="#ffd84a" {...S} />
      <circle cx="50" cy="52" r="22" fill="#e64fe0" {...S} />
      <path className="rx-spin" d="M38 48 m-5 0 a5 5 0 1 0 10 0 a3 3 0 1 0 -6 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path className="rx-spin" d="M62 48 m-5 0 a5 5 0 1 0 10 0 a3 3 0 1 0 -6 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="50" cy="62" rx="5" ry="4" fill={INK} />
    </g>
  ),
}

export function Reaction({ id, size = 40, className = '' }: { id: string; size?: number; className?: string }) {
  const art = ART[id as ReactionId]
  if (!art) return null
  return (
    <svg className={`rx rx-${id} ${className}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      {art}
    </svg>
  )
}
