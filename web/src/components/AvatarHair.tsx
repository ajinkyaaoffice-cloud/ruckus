import { shade } from '../lib/avatar'

/*
 * Hair is cut from the head itself: the fringe is the head outline grown a
 * few units and clipped to a per-style hairline, so it hugs every face shape
 * exactly (no wings sticking out past a narrow head, no gaps on a wide one).
 * Volume that leaves the silhouette (buns, spikes, curls, long lengths) is
 * placed from the head's measured top and width and sits behind the head.
 */

export type Head = { d: string; top: number; half: number; ear: number }

export const HEADS: Record<string, Head> = {
  round: { d: 'M100 44 C138 44 164 72 164 112 C164 154 136 180 100 180 C64 180 36 154 36 112 C36 72 62 44 100 44Z', top: 44, half: 64, ear: 38 },
  bean: { d: 'M100 42 C146 42 166 76 164 116 C162 156 138 180 100 180 C62 180 38 156 36 116 C34 76 54 42 100 42Z', top: 42, half: 64, ear: 37 },
  square: { d: 'M80 46 L120 46 C148 46 164 62 164 90 L164 140 C164 166 148 180 120 180 L80 180 C52 180 36 166 36 140 L36 90 C36 62 52 46 80 46Z', top: 46, half: 64, ear: 38 },
  pear: { d: 'M100 44 C134 44 150 70 154 100 C162 140 148 180 100 180 C52 180 38 140 46 100 C50 70 66 44 100 44Z', top: 44, half: 56, ear: 45 },
  egg: { d: 'M100 40 C140 40 160 86 160 122 C160 158 134 182 100 182 C66 182 40 158 40 122 C40 86 60 40 100 40Z', top: 40, half: 60, ear: 41 },
}

export const HAIR_STYLES = ['part', 'curly', 'spiky', 'buzz', 'bowl', 'mohawk', 'afro', 'long', 'wavy', 'bob', 'ponytail', 'bun', 'pigtails', 'none'] as const
/** Styles whose length covers the ears. */
export const COVERS_EARS = new Set(['long', 'wavy', 'bob'])

const CY = 112
const grow = (k: number) => `translate(100 ${CY}) scale(${k}) translate(-100 ${-CY})`

/** Hairline masks: the cap shows only above/outside these lines. */
const HAIRLINE: Record<string, string> = {
  buzz: 'M-20 -20 H220 V96 C176 74 140 64 100 64 C60 64 24 74 -20 96Z',
  part: 'M-20 -20 H220 V104 C180 92 166 80 140 76 C120 72 104 80 84 82 C64 84 50 78 40 90 L-20 110Z',
  curly: 'M-20 -20 H220 V104 L164 96 C150 82 136 78 122 84 C112 74 92 74 82 84 C68 76 52 82 38 96 L-20 104Z',
  spiky: 'M-20 -20 H220 V100 L162 92 L150 80 L138 88 L124 74 L110 86 L98 72 L86 86 L72 74 L62 88 L50 80 L38 92 L-20 100Z',
  bowl: 'M-20 -20 H220 V124 L164 124 C160 104 154 94 142 92 L58 92 C46 94 40 104 36 124 L-20 124Z',
  mohawk: 'M86 -40 H114 V82 C108 78 92 78 86 82Z',
  afro: 'M-20 -20 H220 V100 C170 84 140 76 100 76 C60 76 30 84 -20 100Z',
  long: 'M-20 -20 H220 V176 L166 154 C158 122 152 94 130 78 C118 70 108 70 100 74 C92 70 82 70 70 78 C48 94 42 122 34 154 L-20 176Z',
  wavy: 'M-20 -20 H220 V176 L166 154 C160 120 154 92 132 80 C116 70 92 66 74 76 C52 90 44 120 34 154 L-20 176Z',
  bob: 'M-20 -20 H220 V164 L166 148 C160 118 152 96 134 86 C116 76 92 70 68 80 C50 90 42 118 34 148 L-20 164Z',
  ponytail: 'M-20 -20 H220 V98 C176 80 140 70 100 70 C60 70 24 80 -20 98Z',
  bun: 'M-20 -20 H220 V98 C176 80 140 72 100 72 C60 72 24 80 -20 98Z',
  pigtails: 'M-20 -20 H220 V112 C172 92 140 76 104 74 L100 80 L96 74 C60 76 28 92 -20 112Z',
}

/** Point on the top arc of a head (deg: 180 = left, 270 = top, 360 = right). */
function arc(h: Head, deg: number, out = 3): [number, number] {
  const a = (deg * Math.PI) / 180
  return [100 + Math.cos(a) * (h.half + out), CY + Math.sin(a) * (CY - h.top + out)]
}

type P = { style: string; head: Head; color: string; uid: string; hatted: boolean }

/** Everything behind the head: lengths, buns, puffs, spikes, curls, afro. */
export function HairBack({ style, head: h, color, hatted }: P) {
  const back = shade(color, -0.2)
  const l = 100 - h.half, r = 100 + h.half
  switch (style) {
    case 'long':
      return <path d={`M${l - 8} 112 C${l - 10} ${h.top - 8} ${r + 10} ${h.top - 8} ${r + 8} 112 L${r + 12} 200 C${r - 16} 212 ${l + 16} 212 ${l - 12} 200Z`} fill={back} />
    case 'wavy': {
      const waves = [l - 12, l + 14, 100 - 12, 100 + 12, r - 14, r + 12]
      return (
        <g fill={back}>
          <path d={`M${l - 8} 112 C${l - 10} ${h.top - 8} ${r + 10} ${h.top - 8} ${r + 8} 112 L${r + 14} 188 L${l - 14} 188Z`} />
          {waves.map((x, i) => <circle key={i} cx={x} cy={188 + (i % 2) * 6} r="15" />)}
          <circle cx={l - 12} cy="150" r="14" /><circle cx={r + 12} cy="150" r="14" />
        </g>
      )
    }
    case 'bob':
      return <path d={`M${l - 10} 112 C${l - 12} ${h.top - 8} ${r + 12} ${h.top - 8} ${r + 10} 112 L${r + 14} 160 Q${r + 14} 172 ${r} 170 L${l} 170 Q${l - 14} 172 ${l - 14} 160Z`} fill={back} />
    case 'ponytail': {
      const [x, y] = arc(h, 318, 0)
      return (
        <g>
          <path d={`M${x - 10} ${y - 6} C${x + 30} ${y - 22} ${x + 40} ${y + 40} ${x + 26} ${y + 96} C${x + 18} ${y + 70} ${x + 6} ${y + 30} ${x - 14} ${y + 14}Z`} fill={back} />
          <circle cx={x + 2} cy={y + 2} r="7" fill={shade(color, -0.45)} />
        </g>
      )
    }
    case 'bun': {
      if (hatted) return null
      const [, y] = arc(h, 270, 0)
      return (
        <g>
          <circle cx="100" cy={y - 12} r="22" fill={back} />
          <path d={`M88 ${y - 22} Q100 ${y - 32} 110 ${y - 24}`} stroke="#fff" strokeOpacity="0.25" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      )
    }
    case 'pigtails':
      return (
        <g>
          {[[l - 10, -1], [r + 10, 1]].map(([x, s]) => (
            <g key={s}>
              <ellipse cx={x + s * 6} cy="128" rx="18" ry="26" fill={back} transform={`rotate(${s * -14} ${x} 128)`} />
              <circle cx={x - s * 2} cy="102" r="6" fill={shade(color, -0.45)} />
            </g>
          ))}
        </g>
      )
    case 'afro':
      return (
        <g fill={back}>
          <ellipse cx="100" cy={h.top + 44} rx={h.half + 26} ry={h.half + 18} />
          {Array.from({ length: 16 }, (_, i) => {
            const [x, y] = arc(h, 160 + i * 14.5, 26)
            return <circle key={i} cx={x} cy={y - 8} r="17" />
          })}
        </g>
      )
    case 'curly':
      if (hatted) return null
      return (
        <g fill={back}>
          {Array.from({ length: 11 }, (_, i) => {
            const [x, y] = arc(h, 190 + i * 16, 4)
            return <circle key={i} cx={x} cy={y} r={13 + (i % 3) * 1.5} />
          })}
        </g>
      )
    case 'spiky':
      if (hatted) return null
      return (
        <g fill={back}>
          {[200, 222, 246, 270, 294, 318, 340].map((deg, i) => {
            const [x, y] = arc(h, deg, 0)
            const [tx, ty] = arc(h, deg + (i % 2 ? 4 : -4), 22 + (i % 2) * 6)
            const a = ((deg + 90) * Math.PI) / 180
            return <path key={deg} d={`M${x - Math.cos(a) * 11} ${y - Math.sin(a) * 11} L${tx} ${ty} L${x + Math.cos(a) * 11} ${y + Math.sin(a) * 11}Z`} strokeLinejoin="round" stroke={back} strokeWidth="4" />
          })}
        </g>
      )
    case 'mohawk':
      if (hatted) return null
      return <path d={`M88 ${h.top + 10} C84 ${h.top - 20} 92 ${h.top - 40} 100 ${h.top - 48} C108 ${h.top - 40} 116 ${h.top - 20} 112 ${h.top + 10}Z`} fill={color} />
    default:
      return null
  }
}

/** The fringe/cap on top of the face, plus the soft shadow it casts on the forehead. */
export function HairFront({ style, head: h, color, uid }: P) {
  const mask = HAIRLINE[style]
  if (!mask) return null
  const dark = shade(color, -0.18)
  const buzz = style === 'buzz' || style === 'mohawk'
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-hm`}><path d={mask} /></clipPath>
        <clipPath id={`${uid}-hg`}><path d={h.d} transform={grow(1.07)} /></clipPath>
      </defs>
      {style === 'mohawk' && (
        // shaved sides
        <g clipPath={`url(#${uid}-hg)`}><path d={HAIRLINE.buzz} fill={color} opacity="0.28" /></g>
      )}
      <g clipPath={`url(#${uid}-hm)`} opacity={buzz && style === 'buzz' ? 0.85 : 1}>
        <path d={h.d} transform={grow(1.07)} fill={dark} />
        <g clipPath={`url(#${uid}-hg)`}>
          <path d={h.d} transform={`translate(-5 -5) ${grow(1.07)}`} fill={color} />
        </g>
      </g>
      {/* a little texture so styles read at chip size */}
      {style === 'curly' && [52, 70, 88, 106, 124, 142].map((x, i) => (
        <circle key={x} cx={x + 3} cy={78 + (i % 2) * 3 + Math.abs(100 - x) * 0.08} r="8" fill={color} />
      ))}
      {style === 'buzz' && <path d="M66 62 Q100 52 134 62" stroke="#fff" strokeOpacity="0.18" strokeWidth="5" fill="none" strokeLinecap="round" />}
      {(style === 'part' || style === 'wavy' || style === 'bob') && <path d="M66 68 Q90 54 120 58" stroke="#fff" strokeOpacity="0.32" strokeWidth="6" fill="none" strokeLinecap="round" />}
      {(style === 'long' || style === 'pigtails') && <path d="M100 52 L100 72" stroke={shade(color, -0.35)} strokeWidth="3" strokeLinecap="round" />}
      {(style === 'ponytail' || style === 'bun' || style === 'afro') && <path d="M70 62 Q100 50 130 62" stroke="#fff" strokeOpacity="0.28" strokeWidth="6" fill="none" strokeLinecap="round" />}
      {style === 'spiky' && <path d="M72 70 L80 60 M104 64 L108 54" stroke="#fff" strokeOpacity="0.3" strokeWidth="5" strokeLinecap="round" />}
    </g>
  )
}

/** Shadow the fringe casts on the forehead (drawn inside the head clip). */
export function HairShadow({ style, skin }: { style: string; skin: string }) {
  const mask = HAIRLINE[style]
  if (!mask || style === 'mohawk') return null
  return <path d={mask} fill={shade(skin, -0.16)} opacity="0.7" transform="translate(3 7)" />
}
