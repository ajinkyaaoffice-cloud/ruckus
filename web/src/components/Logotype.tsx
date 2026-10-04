import { forwardRef } from 'react'

/**
 * "RUCKUS" built from flat geometric pieces (stems, half-discs, rings, wedges)
 * so the hero can assemble it piece by piece. Each <path class="lt-piece">
 * is animated independently.
 */
const LETTERS: { w: number; pieces: { d: string; accent?: string }[] }[] = [
  { w: 100, pieces: [ // R
    { d: 'M0 0 H30 V120 H0Z' },
    { d: 'M30 0 H56 A32 32 0 0 1 56 64 H30Z' },
    { d: 'M34 64 H66 L100 120 H66Z', accent: '#d9f66b' },
  ] },
  { w: 100, pieces: [ // U
    { d: 'M0 0 H30 V70 H0Z' },
    { d: 'M70 0 H100 V70 H70Z' },
    { d: 'M0 70 H30 A20 20 0 0 0 70 70 H100 A50 50 0 0 1 0 70Z' },
  ] },
  { w: 112, pieces: [ // C
    { d: 'M104 26 A60 60 0 1 0 104 94 L80 78 A30 30 0 1 1 80 42Z' },
    { d: 'M98 60 m-13 0 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0', accent: '#1d3a6e' },
  ] },
  { w: 104, pieces: [ // K
    { d: 'M0 0 H30 V120 H0Z' },
    { d: 'M30 50 L70 0 H104 L46 70Z' },
    { d: 'M46 54 L104 120 H66 L30 80Z', accent: '#a7ecff' },
  ] },
  { w: 100, pieces: [ // U
    { d: 'M0 0 H30 V70 H0Z' },
    { d: 'M70 0 H100 V70 H70Z' },
    { d: 'M0 70 H30 A20 20 0 0 0 70 70 H100 A50 50 0 0 1 0 70Z', accent: '#e64fe0' },
  ] },
  { w: 100, pieces: [ // S
    { d: 'M54 0 A30 30 0 0 0 54 60Z' },
    { d: 'M54 0 H100 V26 H54Z', accent: '#ffb424' },
    { d: 'M46 60 A30 30 0 0 1 46 120Z' },
    { d: 'M0 94 H46 V120 H0Z' },
  ] },
]

const GAP = 18
export const LOGO_W = LETTERS.reduce((s, l) => s + l.w, 0) + GAP * (LETTERS.length - 1)

const Logotype = forwardRef<SVGSVGElement, { className?: string; color?: string }>(function Logotype({ className, color = '#fff' }, ref) {
  let x = 0
  return (
    <svg ref={ref} className={className} viewBox={`-10 -10 ${LOGO_W + 20} 150`} aria-label="Ruckus">
      {LETTERS.map((l, i) => {
        const g = (
          <g key={i} className="lt-letter" transform={`translate(${x} 0)`}>
            {l.pieces.map((p, j) => (
              <path key={j} className="lt-piece" d={p.d} fill={p.accent ?? color} />
            ))}
          </g>
        )
        x += l.w + GAP
        return g
      })}
    </svg>
  )
})

export default Logotype
