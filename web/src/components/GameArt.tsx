import './GameArt.css'

/** Flat geometric illustrations for each game (shapes, stripes, squiggles — Ahadi style, Ruckus palette). */
export default function GameArt({ id, className }: { id: string; className?: string }) {
  const N = '#1d3a6e', M = '#e64fe0', W = '#ffffff', L = '#d9f66b', C = '#a7ecff', O = '#ff9a62', A = '#ffb424', V = '#a596ff'
  const common = { viewBox: '0 0 200 200', className, 'aria-hidden': true } as const
  switch (id) {
    case 'uno':
      return (
        <svg {...common}>
          <g className="art-float-a"><rect x="38" y="44" width="72" height="104" rx="12" fill={M} transform="rotate(-16 74 96)" />
            <ellipse cx="74" cy="96" rx="26" ry="40" fill={W} transform="rotate(14 74 96)" /></g>
          <g className="art-float-b"><rect x="90" y="40" width="72" height="104" rx="12" fill={N} transform="rotate(12 126 92)" />
            <ellipse cx="126" cy="92" rx="26" ry="40" fill={L} transform="rotate(40 126 92)" />
            <text x="126" y="104" textAnchor="middle" fontFamily="Luckiest Guy" fontSize="38" fill={N} transform="rotate(12 126 92)">+4</text></g>
          <circle cx="160" cy="160" r="14" fill={A} />
          <path d="M20 170 q10 -16 20 0 t20 0 t20 0" stroke={N} strokeWidth="6" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'pong':
      return (
        <svg {...common}>
          <rect x="30" y="30" width="140" height="140" rx="24" fill={N} />
          <path d="M30 100 H170" stroke={W} strokeWidth="4" strokeDasharray="8 10" />
          <rect className="art-slide-a" x="60" y="146" width="56" height="12" rx="6" fill={M} />
          <rect className="art-slide-b" x="90" y="42" width="56" height="12" rx="6" fill={L} />
          <circle className="art-bounce" cx="104" cy="98" r="11" fill={W} />
          <path d="M150 20 l12 22 l-24 0z" fill={O} />
        </svg>
      )
    case 'tictactoe':
      return (
        <svg {...common}>
          <g stroke={W} strokeWidth="8" strokeLinecap="round" opacity="0.9">
            <path d="M80 30 V170 M124 30 V170 M34 76 H170 M34 122 H170" />
          </g>
          <path className="art-draw" d="M46 40 L68 62 M68 40 L46 62" stroke={N} strokeWidth="11" strokeLinecap="round" />
          <circle className="art-draw" cx="102" cy="100" r="13" stroke={L} strokeWidth="10" fill="none" />
          <path className="art-draw" d="M136 132 L158 154 M158 132 L136 154" stroke={N} strokeWidth="11" strokeLinecap="round" />
          <circle cx="146" cy="56" r="13" stroke={L} strokeWidth="10" fill="none" />
        </svg>
      )
    case 'connect4':
      return (
        <svg {...common}>
          <rect x="28" y="54" width="144" height="120" rx="18" fill={C} />
          {Array.from({ length: 12 }, (_, i) => {
            const x = 52 + (i % 4) * 32, y = 80 + Math.floor(i / 4) * 34
            const f = [N, N, M, N, N, L, M, N, L, M, L, M][i]
            return <circle key={i} cx={x} cy={y} r="12" fill={f} />
          })}
          <circle className="art-drop" cx="116" cy="26" r="12" fill={M} />
        </svg>
      )
    case 'dots':
      return (
        <svg {...common}>
          {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={46 + (i % 4) * 36} cy={46 + Math.floor(i / 4) * 36} r="6" fill={N} />)}
          <rect x="46" y="46" width="36" height="36" fill={M} />
          <rect x="82" y="82" width="36" height="36" fill={V} />
          <path d="M46 46 H118 M46 82 H82 M82 46 V118 M118 82 V118 M82 118 H118" stroke={N} strokeWidth="6" strokeLinecap="round" />
          <path className="art-draw" d="M118 118 H154" stroke={M} strokeWidth="6" strokeLinecap="round" />
          <path d="M150 30 l6 12 l12 2 l-9 9 l2 13 l-11 -6 l-11 6 l2 -13 l-9 -9 l12 -2z" fill={A} />
        </svg>
      )
    case 'memory':
      return (
        <svg {...common}>
          <rect x="34" y="40" width="58" height="76" rx="12" fill={W} transform="rotate(-10 63 78)" />
          <circle cx="63" cy="78" r="16" fill={M} transform="rotate(-10 63 78)" />
          <g className="art-flip"><rect x="104" y="40" width="58" height="76" rx="12" fill={N} transform="rotate(8 133 78)" />
            <path d="M118 62 l30 30 M148 62 l-30 30" stroke={V} strokeWidth="6" transform="rotate(8 133 78)" /></g>
          <rect x="70" y="112" width="58" height="76" rx="12" fill={W} transform="rotate(4 99 150)" />
          <circle cx="99" cy="150" r="16" fill={M} />
        </svg>
      )
    case 'oddone':
      return (
        <svg {...common}>
          {Array.from({ length: 9 }, (_, i) => {
            const x = 52 + (i % 3) * 48, y = 52 + Math.floor(i / 3) * 48
            const odd = i === 5
            return <path key={i} className={odd ? 'art-wiggle' : undefined} d={`M${x} ${y - 16} L${x + 16} ${y + 14} L${x - 16} ${y + 14}Z`}
              fill={odd ? M : N} transform={odd ? `rotate(24 ${x} ${y})` : undefined} />
          })}
          <circle cx="148" cy="100" r="28" fill="none" stroke={W} strokeWidth="6" strokeDasharray="6 8" className="art-spin" />
        </svg>
      )
    case 'echo':
      return (
        <svg {...common}>
          {[M, C, L, A, V, O].map((f, i) => (
            <rect key={i} className={`art-pad art-pad-${i}`} x={40 + (i % 3) * 42} y={58 + Math.floor(i / 3) * 46} width="36" height="40" rx="10" fill={f} />
          ))}
          <path d="M60 36 q20 -20 40 0 q20 20 40 0" stroke={N} strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M40 170 h120" stroke={N} strokeWidth="6" strokeLinecap="round" strokeDasharray="2 14" />
        </svg>
      )
    default:
      return <svg {...common}><circle cx="100" cy="100" r="60" fill={M} /></svg>
  }
}
