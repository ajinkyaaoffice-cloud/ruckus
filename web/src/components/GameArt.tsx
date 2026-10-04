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
    case 'checkers':
      return (
        <svg {...common}>
          {Array.from({ length: 16 }, (_, i) => (i + Math.floor(i / 4)) % 2 ? <rect key={i} x={36 + (i % 4) * 32} y={36 + Math.floor(i / 4) * 32} width="32" height="32" fill={N} opacity="0.85" /> : null)}
          <rect x="36" y="36" width="128" height="128" rx="6" fill="none" stroke={N} strokeWidth="6" />
          <g className="art-bounce"><circle cx="84" cy="116" r="14" fill={W} /><circle cx="84" cy="116" r="8" fill="none" stroke={N} strokeOpacity="0.3" strokeWidth="3" /></g>
          <circle cx="116" cy="84" r="14" fill={L} />
          <path d="M104 72 l4 -10 l8 7 l8 -7 l4 10z" fill={A} stroke={N} strokeWidth="3" strokeLinejoin="round" />
        </svg>
      )
    case 'reversi':
      return (
        <svg {...common}>
          <rect x="34" y="34" width="132" height="132" rx="18" fill={N} opacity="0.2" />
          <circle cx="78" cy="78" r="24" fill={W} /><circle cx="122" cy="122" r="24" fill={W} />
          <circle cx="122" cy="78" r="24" fill={N} />
          <g className="art-flip"><circle cx="78" cy="122" r="24" fill={L} /></g>
          <path d="M150 34 a14 14 0 1 1 -4 10" stroke={W} strokeWidth="6" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'cycles':
      return (
        <svg {...common}>
          <path d="M30 60 H170 M30 100 H170 M30 140 H170 M60 30 V170 M100 30 V170 M140 30 V170" stroke={C} strokeOpacity="0.15" strokeWidth="3" />
          <path className="art-draw" d="M36 150 H92 V70 H150" stroke={M} strokeWidth="10" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <path className="art-draw" d="M164 46 H120 V120 H60" stroke={L} strokeWidth="10" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="150" cy="70" r="9" fill={W} /><circle cx="60" cy="120" r="9" fill={W} />
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
    case 'showdown':
      return (
        <svg {...common}>
          <g className="art-float-a"><path d="M30 80 C26 60 42 50 58 52 C78 48 92 60 88 82 C92 102 76 112 58 110 C38 112 24 100 30 80Z" fill={N} /></g>
          <g className="art-float-b"><rect x="110" y="40" width="54" height="68" rx="8" fill={W} transform="rotate(8 137 74)" /></g>
          <g className="art-wiggle" fill={M}><path d="M96 150 L150 120 L154 128 L102 158Z" /><path d="M96 138 L150 168 L154 160 L102 130Z" />
            <circle cx="76" cy="132" r="10" fill="none" stroke={M} strokeWidth="7" /><circle cx="76" cy="158" r="10" fill="none" stroke={M} strokeWidth="7" /></g>
        </svg>
      )
    case 'quickmaths':
      return (
        <svg {...common}>
          <rect x="36" y="40" width="128" height="56" rx="14" fill={W} />
          <text x="100" y="80" textAnchor="middle" fontFamily="Luckiest Guy" fontSize="32" fill={N}>7×8=?</text>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} className={i === 2 ? 'art-bounce' : undefined} x={40 + (i % 2) * 64} y={108 + Math.floor(i / 2) * 36} width="56" height="28" rx="10" fill={i === 2 ? M : N} />
          ))}
          <text x="68" y="165" textAnchor="middle" fontFamily="Luckiest Guy" fontSize="20" fill={W} className="art-bounce">56</text>
        </svg>
      )
    default:
      return <svg {...common}><circle cx="100" cy="100" r="60" fill={M} /></svg>
  }
}
