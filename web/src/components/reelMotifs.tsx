import type { ReactNode } from 'react'

/**
 * The pieces each game throws around in its winner reel. Every piece is drawn
 * in a -50..50 box; `choreo` picks how they move before the winner is revealed.
 */
export type Choreo = 'fan' | 'rain' | 'grid' | 'orbit' | 'burst' | 'rally'
export type Motif = { choreo: Choreo; count: number; piece: (i: number) => ReactNode; cols?: number; flip?: boolean }

const N = '#1d3a6e'
const UNO = ['#ff5d73', '#ffb424', '#2fbf8f', '#3d8bff']
const LUDO = ['#ff5d73', '#2fbf8f', '#ffb424', '#3d8bff']
const POP = ['#e64fe0', '#d9f66b', '#a7ecff', '#ffb424', '#ffffff']
const st = { stroke: N, strokeWidth: 5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

const pips: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}
const die = (n: number) => (
  <>
    <rect x={-36} y={-36} width={72} height={72} rx={18} fill="#fff" {...st} />
    {pips[n].map(([x, y], k) => <circle key={k} cx={x * 17} cy={y * 17} r={7} fill={n === 1 ? '#ff5d73' : N} />)}
  </>
)
const pawn = (c: string) => (
  <>
    <path d="M-22 34 Q-18 6 -7 2 L7 2 Q18 6 22 34 Z" fill={c} {...st} />
    <circle cy={-14} r={15} fill={c} {...st} />
    <circle cx={-5} cy={-18} r={4} fill="#fff" opacity={0.85} />
  </>
)
const star = (c: string, r = 40) => {
  const pts = Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r
    return `${Math.cos(a) * rr},${Math.sin(a) * rr}`
  }).join(' ')
  return <polygon points={pts} fill={c} {...st} />
}

export const MOTIFS: Record<string, Motif> = {
  uno: {
    choreo: 'fan', count: 7,
    piece: (i) => {
      const c = UNO[i % 4], label = ['7', '+4', '2', '⟲', '9', '+2', '5'][i % 7]
      return (
        <>
          <rect x={-30} y={-44} width={60} height={88} rx={11} fill={c} {...st} />
          <ellipse rx={20} ry={32} fill="#fff" transform="rotate(28)" />
          <text y={11} textAnchor="middle" fontFamily="Luckiest Guy" fontSize={label.length > 1 ? 26 : 32} fill={c} stroke={N} strokeWidth={1.5}>{label}</text>
        </>
      )
    },
  },
  ludo: {
    choreo: 'rain', count: 14,
    piece: (i) => (i % 3 === 0 ? die(1 + ((i * 5) % 6)) : pawn(LUDO[i % 4])),
  },
  seabattle: {
    choreo: 'rain', count: 12,
    piece: (i) => (i % 3 === 0
      ? <><path d="M-44 0 L44 0 L32 22 L-32 22 Z" fill="#c9d3e6" {...st} /><rect x={-14} y={-18} width={26} height={18} rx={4} fill="#fff" {...st} /></>
      : <><circle r={20} fill={i % 2 ? '#ff5d73' : '#fff'} {...st} /><circle r={34} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="8 8" /></>),
  },
  tictactoe: {
    choreo: 'grid', count: 9, cols: 3,
    // X takes the 0-4-8 diagonal; the reel strikes through it
    piece: (i) => ([0, 4, 8, 5].includes(i)
      ? <path d="M-28 -28 L28 28 M28 -28 L-28 28" stroke="#fff" strokeWidth={16} strokeLinecap="round" />
      : <circle r={28} fill="none" stroke={i % 2 ? '#d9f66b' : '#1d3a6e'} strokeWidth={14} />),
  },
  dots: {
    choreo: 'grid', count: 16, cols: 4,
    piece: (i) => (
      <>
        <rect x={-36} y={-36} width={72} height={72} rx={8} fill={[0, 5, 10, 15, 3, 12].includes(i) ? ['#e64fe0', '#3d8bff'][i % 2] : 'transparent'} />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y], k) => <circle key={k} cx={x * 40} cy={y * 40} r={8} fill={N} />)}
      </>
    ),
  },
  quickdraw: {
    choreo: 'burst', count: 12,
    piece: (i) => (i % 2
      ? <path d="M8 -44 L-22 6 L0 6 L-10 44 L24 -8 L2 -8 Z" fill="#ffb424" {...st} />
      : star(['#fff', '#e64fe0', '#d9f66b'][i % 3])),
  },
}

export const DEFAULT_MOTIF: Motif = { choreo: 'burst', count: 12, piece: (i) => star(POP[i % 5]) }
