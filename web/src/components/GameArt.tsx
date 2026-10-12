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
    case 'seabattle':
      return (
        <svg {...common}>
          <rect x="30" y="34" width="140" height="140" rx="20" fill={N} opacity="0.25" />
          <path d="M30 80 H170 M30 126 H170 M76 34 V174 M122 34 V174" stroke={W} strokeOpacity="0.4" strokeWidth="4" />
          <g className="art-float-a"><rect x="40" y="90" width="114" height="28" rx="14" fill={W} />
            <circle cx="70" cy="104" r="5" fill={N} /><circle cx="97" cy="104" r="5" fill={N} /><circle cx="124" cy="104" r="5" fill={N} /></g>
          <path className="art-wiggle" d="M140 40 l6 14 l15 -2 l-9 12 l9 12 l-15 -2 l-6 14 l-6 -14 l-15 2 l9 -12 l-9 -12 l15 2z" fill={A} />
          <circle cx="56" cy="150" r="10" fill="none" stroke={W} strokeWidth="5" />
        </svg>
      )
    case 'quickdraw':
      return (
        <svg {...common}>
          <circle cx="100" cy="90" r="50" fill={W} opacity="0.7" />
          <path d="M20 150 Q100 136 180 150 L180 180 L20 180Z" fill={O} />
          <g fill="#2fbf8f"><rect x="44" y="104" width="14" height="52" rx="7" /><rect x="30" y="118" width="10" height="20" rx="5" /><rect x="62" y="112" width="10" height="20" rx="5" /></g>
          <g className="art-spin" style={{ transformOrigin: '146px 140px' }}><circle cx="146" cy="140" r="16" fill="none" stroke={N} strokeWidth="4" /><path d="M134 132 Q146 148 158 130" stroke={N} strokeWidth="3" fill="none" /></g>
          <text className="art-wiggle" x="100" y="102" textAnchor="middle" fontFamily="Luckiest Guy" fontSize="34" fill={M}>DRAW!</text>
        </svg>
      )
    case 'ludo':
      return (
        <svg {...common}>
          <rect x="30" y="30" width="140" height="140" rx="18" fill={W} />
          <rect x="30" y="30" width="56" height="56" rx="14" fill={M} />
          <rect x="114" y="30" width="56" height="56" rx="14" fill={L} />
          <rect x="114" y="114" width="56" height="56" rx="14" fill={A} />
          <rect x="30" y="114" width="56" height="56" rx="14" fill={C} />
          <path d="M86 86 H114 L100 100Z" fill={L} /><path d="M114 86 V114 L100 100Z" fill={A} />
          <path d="M86 114 H114 L100 100Z" fill={C} /><path d="M86 86 V114 L100 100Z" fill={M} />
          <path d="M44 100 H86 M114 100 H156 M100 44 V86 M100 114 V156" stroke={N} strokeWidth="5" strokeDasharray="2 12" strokeLinecap="round" />
          <g className="art-float-a"><circle cx="58" cy="52" r="9" fill={N} /><path d="M48 70 Q50 58 58 58 Q66 58 68 70Z" fill={N} /></g>
          <g className="art-wiggle"><rect x="128" y="128" width="30" height="30" rx="8" fill={W} stroke={N} strokeWidth="4" />
            <circle cx="137" cy="137" r="3.5" fill={N} /><circle cx="149" cy="149" r="3.5" fill={N} /><circle cx="143" cy="143" r="3.5" fill={N} /></g>
        </svg>
      )
    case 'mogul':
      return (
        <svg {...common}>
          <rect x="34" y="34" width="132" height="132" rx="14" fill={W} />
          <rect x="34" y="34" width="132" height="132" rx="14" fill="none" stroke={N} strokeWidth="5" />
          <path d="M34 62 H166 M34 138 H166 M62 34 V166 M138 34 V166" stroke={N} strokeWidth="4" />
          <rect x="62" y="34" width="76" height="10" fill={M} /><rect x="156" y="62" width="10" height="76" fill={A} />
          <rect x="62" y="156" width="76" height="10" fill={C} /><rect x="34" y="62" width="10" height="76" fill={L} />
          <g className="art-float-a"><path d="M78 118 V92 L100 74 L122 92 V118 Z" fill={O} stroke={N} strokeWidth="5" strokeLinejoin="round" />
            <rect x="93" y="100" width="14" height="18" rx="2" fill={N} /></g>
          <g className="art-wiggle"><circle cx="150" cy="150" r="18" fill={A} stroke={N} strokeWidth="4" />
            <text x="150" y="158" textAnchor="middle" fontFamily="Luckiest Guy" fontSize="22" fill={N}>$</text></g>
          <text x="50" y="56" textAnchor="middle" fontFamily="Luckiest Guy" fontSize="15" fill={M}>GO</text>
        </svg>
      )
    default:
      return <svg {...common}><circle cx="100" cy="100" r="60" fill={M} /></svg>
  }
}
