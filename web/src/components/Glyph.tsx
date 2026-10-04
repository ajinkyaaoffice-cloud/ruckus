import type { CSSProperties } from 'react'

export type GlyphName = 'x' | 'o' | 'star' | 'squiggle' | 'tri' | 'plus' | 'bolt' | 'heart' | 'moon' | 'burst' | 'drop' | 'arc'

export const GLYPH_PATHS: Record<GlyphName, { d: string; stroke?: boolean }> = {
  x: { d: 'M22 22 L78 78 M78 22 L22 78', stroke: true },
  o: { d: 'M50 18 A32 32 0 1 1 49.9 18', stroke: true },
  star: { d: 'M50 6 L61 37 L94 38 L68 58 L77 90 L50 71 L23 90 L32 58 L6 38 L39 37Z' },
  squiggle: { d: 'M8 60 C20 30 32 30 40 50 C48 70 60 70 68 50 C76 30 88 30 94 46', stroke: true },
  tri: { d: 'M50 10 L92 86 L8 86Z' },
  plus: { d: 'M50 14 L50 86 M14 50 L86 50', stroke: true },
  bolt: { d: 'M58 4 L20 56 L46 56 L38 96 L80 40 L54 40Z' },
  heart: { d: 'M50 88 C10 60 6 34 22 22 C36 12 48 22 50 32 C52 22 64 12 78 22 C94 34 90 60 50 88Z' },
  moon: { d: 'M66 10 A40 40 0 1 0 90 66 A32 32 0 1 1 66 10Z' },
  burst: {
    d: Array.from({ length: 12 }, (_, i) => {
      const a = (Math.PI / 6) * i
      return `M50 50 L${50 + Math.cos(a) * 44} ${50 + Math.sin(a) * 44}`
    }).join(' '),
    stroke: true,
  },
  drop: { d: 'M50 6 C70 40 84 54 84 68 A34 34 0 0 1 16 68 C16 54 30 40 50 6Z' },
  arc: { d: 'M10 70 A40 40 0 0 1 90 70', stroke: true },
}

type Props = { name: GlyphName; color?: string; size?: number | string; strokeWidth?: number; className?: string; style?: CSSProperties }

export default function Glyph({ name, color = 'currentColor', size = 48, strokeWidth = 14, className, style }: Props) {
  const g = GLYPH_PATHS[name]
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden>
      {g.stroke ? (
        <path d={g.d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={g.d} fill={color} stroke={color} strokeWidth={4} strokeLinejoin="round" />
      )}
    </svg>
  )
}

export const ALL_GLYPHS = Object.keys(GLYPH_PATHS) as GlyphName[]
