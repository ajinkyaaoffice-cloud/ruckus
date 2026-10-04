import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { lowPower, onFrame, watchVisible } from '../lib/perf'
import { normalizeAvatar, shade, type AvatarConfig, type Expression } from '../lib/avatar'
import './Avatar.css'

type Props = {
  config: Partial<AvatarConfig> | undefined
  size?: number | string
  expression?: Expression
  /** 'mouse' = eyes & layers follow the pointer, 'idle' = gentle sway */
  track?: 'mouse' | 'none' | 'idle'
  depth?: number
  badge?: boolean
  className?: string
  style?: CSSProperties
}

const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 3 }
window.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX
  pointer.y = e.clientY
}, { passive: true })

/*
 * Art direction: flat "toy" illustration. Every surface is a flat colour with
 * one cel-shadow crescent (the shape re-drawn, nudged, and clipped) plus a
 * small highlight. No outlines, no muddy gradients.
 */
const HEADS: Record<string, string> = {
  round: 'M100 44 C138 44 164 72 164 112 C164 154 136 180 100 180 C64 180 36 154 36 112 C36 72 62 44 100 44Z',
  bean: 'M100 42 C146 42 166 76 164 116 C162 156 138 180 100 180 C62 180 38 156 36 116 C34 76 54 42 100 42Z',
  square: 'M80 46 L120 46 C148 46 164 62 164 90 L164 140 C164 166 148 180 120 180 L80 180 C52 180 36 166 36 140 L36 90 C36 62 52 46 80 46Z',
  pear: 'M100 44 C134 44 150 70 154 100 C162 140 148 180 100 180 C52 180 38 140 46 100 C50 70 66 44 100 44Z',
  egg: 'M100 40 C140 40 160 86 160 122 C160 158 134 182 100 182 C66 182 40 158 40 122 C40 86 60 40 100 40Z',
}

const EYE_L = 78, EYE_R = 122, EYE_Y = 116
const INK = '#1b1f3f'
const LIP = '#6b2347'

function ring(cx: number, cy: number, r: number, from: number, to: number, n: number, size: number) {
  const out: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, size * (0.85 + ((i * 37) % 10) / 40)])
  }
  return out
}
const CURLS_BACK = ring(100, 108, 70, 150, 390, 15, 22)
const CURLS_FRONT = [46, 61, 76, 92, 108, 124, 139, 154].map((x, i) => [x, 72 + (i % 2) * 6 + Math.abs(100 - x) * 0.14, 15 + (i % 3)])
const AFRO = ring(100, 94, 82, 0, 345, 24, 26)

/** Flat shape with a cel-shadow crescent on the lower-right and a soft highlight. */
function Shaded({ d, fill, uid, id, dx = -7, dy = -6 }: { d: string; fill: string; uid: string; id: string; dx?: number; dy?: number }) {
  return (
    <g>
      <clipPath id={`${uid}-${id}`}><path d={d} /></clipPath>
      <path d={d} fill={shade(fill, -0.16)} />
      <g clipPath={`url(#${uid}-${id})`}>
        <path d={d} fill={fill} transform={`translate(${dx} ${dy})`} />
      </g>
    </g>
  )
}

export default function Avatar({ config, size = 160, expression = 'idle', track = 'idle', depth = 1, badge, className, style }: Props) {
  const c = normalizeAvatar(config)
  const uid = useId().replace(/:/g, '')
  const root = useRef<SVGSVGElement>(null)
  const back = useRef<SVGGElement>(null)
  const skull = useRef<SVGGElement>(null)
  const face = useRef<SVGGElement>(null)
  const feat = useRef<SVGGElement>(null)
  const front = useRef<SVGGElement>(null)
  const pupils = useRef<SVGGElement>(null)

  useEffect(() => {
    // phones: a static pose; the CSS bob on the outer element is enough life
    if (track === 'none' || lowPower) return
    let lx = 0, ly = 0
    let visible = false
    let rect: DOMRect | null = null
    let rectAt = 0
    const seed = Math.random() * 100
    const mode = track
    const stopVis = root.current ? watchVisible(root.current, (v) => { visible = v }) : () => {}
    const loop = (t: number) => {
      let tx: number, ty: number
      const el = root.current
      if (!el || !visible) return
      if (mode === 'mouse') {
        if (!rect || t - rectAt > 250) { rect = el.getBoundingClientRect(); rectAt = t }
        const r = rect
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        tx = Math.max(-1, Math.min(1, (pointer.x - cx) / (window.innerWidth * 0.4)))
        ty = Math.max(-1, Math.min(1, (pointer.y - cy) / (window.innerHeight * 0.4)))
      } else {
        tx = Math.sin(t / 1600 + seed) * 0.5
        ty = Math.cos(t / 2100 + seed) * 0.3
      }
      lx += (tx - lx) * 0.08
      ly += (ty - ly) * 0.08
      const d = depth
      // the head is one rigid piece (back hair, ears, face, fringe, hat) so hair can never
      // slide off it; only the body lags behind and the features lean forward for depth
      const head = `translate(${lx * 3 * d} ${ly * 2 * d})`
      back.current?.setAttribute('transform', `translate(${-lx * 3 * d} ${-ly * 1.5 * d})`)
      skull.current?.setAttribute('transform', head)
      face.current?.setAttribute('transform', head)
      front.current?.setAttribute('transform', head)
      feat.current?.setAttribute('transform', `translate(${lx * 5 * d} ${ly * 3.5 * d})`)
      pupils.current?.setAttribute('transform', `translate(${lx * 3.5} ${ly * 3})`)
    }
    const stop = onFrame(loop)
    return () => { stop(); stopVis() }
  }, [track, depth])

  const head = HEADS[c.face] ?? HEADS.round
  const skinS = shade(c.skin, -0.14)
  const hair = c.hairColor
  const hairBack = shade(hair, -0.22)
  const ex = expression
  const sq = ex === 'happy' ? 0.4 : ex === 'shock' ? 1.15 : ex === 'focus' ? 0.72 : 1
  const brows = ex === 'focus' ? 'angry' : ex === 'sad' ? 'worried' : ex === 'shock' ? 'raised' : c.brows
  const mouth = ex === 'happy' ? 'grin' : ex === 'sad' ? 'frown' : ex === 'shock' ? 'o' : ex === 'focus' ? 'smirk' : c.mouth
  const eyes = ex === 'happy' && c.eyes !== 'stars' ? 'sleepy' : c.eyes
  const fringe = HAIR_FRONT[c.hair]
  const hasFringe = !!fringe && c.hat !== 'cap' && c.hat !== 'beanie'

  return (
    <svg ref={root} viewBox="-16 -14 232 232" width={size} height={size} className={`avatar ${className ?? ''} ex-${ex} trk-${track}`} style={style} aria-hidden>
      <defs>
        <clipPath id={`${uid}-badge`}><circle cx="100" cy="102" r="116" /></clipPath>
        <clipPath id={`${uid}-head`}><path d={head} /></clipPath>
      </defs>

      {badge && <circle cx="100" cy="102" r="116" fill={c.bg} />}
      {badge && <circle cx="100" cy="102" r="116" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="6" />}

      <g className="av-body" clipPath={badge ? `url(#${uid}-badge)` : undefined}>
        {/* ---------- back layer: hair behind the head, ears, body ---------- */}
        <g ref={back}>
          <Outfit kind={c.top} color={c.topColor} skin={c.skin} uid={uid} />
        </g>
        <g ref={skull}>
          {c.hair === 'curly' && CURLS_BACK.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={hairBack} />)}
          {c.hair === 'afro' && (
            <g fill={hairBack}>
              <circle cx="100" cy="94" r="82" />
              {AFRO.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
            </g>
          )}
          {c.hair === 'long' && <path d="M30 110 C30 50 60 26 100 26 C140 26 170 50 170 110 L176 196 C150 210 50 210 24 196Z" fill={hairBack} />}
          {c.hair === 'bun' && (
            <g>
              <circle cx="100" cy="30" r="25" fill={hairBack} />
              <path d="M86 20 Q100 10 112 18" stroke="#fff" strokeOpacity="0.25" strokeWidth="5" fill="none" strokeLinecap="round" />
            </g>
          )}
          {c.hat === 'phones' && <path d="M28 112 C28 22 172 22 172 112" fill="none" stroke={shade(c.hatColor, -0.2)} strokeWidth="13" strokeLinecap="round" />}
          {/* ears */}
          {[38, 162].map((x) => (
            <g key={x}>
              <circle cx={x} cy="122" r="15" fill={skinS} />
              <circle cx={x + (x < 100 ? 2 : -2)} cy="122" r="7" fill={shade(c.skin, -0.26)} opacity="0.55" />
            </g>
          ))}
        </g>

        {/* ---------- head ---------- */}
        <g ref={face}>
          <Shaded d={head} fill={c.skin} uid={uid} id="hd" dx={-8} dy={-7} />
          <g clipPath={`url(#${uid}-head)`}>
            {/* hair casts a soft shadow on the forehead */}
            {hasFringe && <path d={fringe} fill={skinS} opacity="0.75" transform="translate(4 9)" />}
            <ellipse cx="70" cy="70" rx="22" ry="10" fill="#fff" opacity="0.28" transform="rotate(-24 70 70)" />
          </g>

          <g ref={feat}>
            <g fill="#ff7aa8" opacity={c.detail === 'blush' ? 0.55 : 0.28}>
              <ellipse cx="64" cy="140" rx="12" ry="7.5" />
              <ellipse cx="136" cy="140" rx="12" ry="7.5" />
            </g>
            <Details kind={c.detail} />
            <Beard kind={c.beard} color={hair} />
            <Mouth kind={mouth} />
            <g className="av-eyes" style={{ transform: `scaleY(${sq})` }}>
              <Eyes kind={eyes} pupilsRef={pupils} wink={ex === 'wink'} skin={c.skin} />
            </g>
            <Brows kind={brows} color={shade(hair, -0.3)} />
            <Nose kind={c.nose} skin={c.skin} />
            <Extra kind={c.extra} />
          </g>
        </g>

        {/* ---------- front layer ---------- */}
        <g ref={front}>
          {fringe && c.hat !== 'cap' && c.hat !== 'beanie' && (
            <g>
              {c.hair === 'curly' && CURLS_FRONT.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={hair} />)}
              <Shaded d={fringe} fill={hair} uid={uid} id="hf" dx={-5} dy={-6} />
              <path d={SHEEN[c.hair] ?? 'M70 52 Q86 42 104 44'} stroke="#fff" strokeOpacity="0.35" strokeWidth="6" fill="none" strokeLinecap="round" />
            </g>
          )}
          <Hat kind={c.hat} color={c.hatColor} uid={uid} />
        </g>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */

const HAIR_FRONT: Record<string, string> = {
  curly: 'M38 98 C36 54 66 32 100 32 C134 32 164 54 162 98 C148 82 128 76 100 76 C72 76 52 82 38 98Z',
  spiky: 'M34 98 L42 54 L58 68 L66 30 L84 56 L100 18 L116 56 L134 30 L142 68 L158 54 L166 98 C148 80 128 72 100 72 C72 72 52 80 34 98Z',
  bowl: 'M32 112 C28 48 64 28 100 28 C136 28 172 48 168 112 C162 100 158 92 152 88 L48 88 C42 92 38 100 32 112Z',
  long: 'M36 106 C36 52 66 32 100 32 C140 32 166 56 164 110 C148 74 108 64 74 80 C58 88 46 96 36 106Z',
  bun: 'M38 102 C38 56 66 40 100 40 C134 40 162 56 162 102 C148 80 128 70 100 70 C72 70 52 80 38 102Z',
  mohawk: 'M88 78 C82 46 90 14 100 4 C110 14 118 46 112 78 C106 72 94 72 88 78Z',
  afro: 'M42 98 C42 62 66 46 100 46 C134 46 158 62 158 98 C144 86 126 80 100 80 C74 80 56 86 42 98Z',
}
const SHEEN: Record<string, string> = {
  spiky: 'M66 44 L74 58 M100 30 L104 50',
  mohawk: 'M96 20 Q94 40 96 60',
  bowl: 'M60 52 Q80 38 106 38',
  long: 'M62 54 Q80 42 104 42',
}

function Eyes({ kind, pupilsRef, wink, skin }: { kind: string; pupilsRef: React.Ref<SVGGElement>; wink: boolean; skin: string }) {
  const closed = (x: number) => <path d={`M${x - 12} ${EYE_Y + 2} Q${x} ${EYE_Y - 9} ${x + 12} ${EYE_Y + 2}`} stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
  const both = (fn: (x: number, right: boolean) => ReactNode) => (
    <>{fn(EYE_L, false)}{wink ? closed(EYE_R) : fn(EYE_R, true)}</>
  )
  const glossy = (x: number, rx: number, ry: number) => (
    <g>
      <ellipse cx={x} cy={EYE_Y} rx={rx} ry={ry} fill={INK} />
      <ellipse cx={x} cy={EYE_Y + ry * 0.45} rx={rx * 0.7} ry={ry * 0.38} fill="#4b4fb8" opacity="0.8" />
      <circle cx={x - rx * 0.32} cy={EYE_Y - ry * 0.38} r={rx * 0.36} fill="#fff" />
      <circle cx={x + rx * 0.38} cy={EYE_Y + ry * 0.3} r={rx * 0.16} fill="#fff" />
    </g>
  )
  switch (kind) {
    case 'dots':
      return <g className="blink"><g ref={pupilsRef}>{both((x) => glossy(x, 6, 8))}</g></g>
    case 'round':
      return (
        <g className="blink">
          {both((x) => (
            <g>
              <ellipse cx={x} cy={EYE_Y} rx="14" ry="15" fill="#fff" />
              <path d={`M${x - 14} ${EYE_Y - 2} Q${x} ${EYE_Y - 18} ${x + 14} ${EYE_Y - 2} Q${x} ${EYE_Y - 12} ${x - 14} ${EYE_Y - 2}Z`} fill={shade(skin, -0.2)} opacity="0.35" />
            </g>
          ))}
          <g ref={pupilsRef}>{both((x) => glossy(x + 1, 8.5, 9.5))}</g>
        </g>
      )
    case 'sleepy': // happy closed crescents
      return (
        <g>
          {both((x) => <path d={`M${x - 12} ${EYE_Y + 3} Q${x} ${EYE_Y - 10} ${x + 12} ${EYE_Y + 3}`} stroke={INK} strokeWidth="5.5" fill="none" strokeLinecap="round" />)}
          <g ref={pupilsRef} />
        </g>
      )
    case 'stars':
      return (
        <g className="blink" ref={pupilsRef}>
          {both((x) => (
            <g>
              <Star cx={x} cy={EYE_Y} r={14} fill="#e64fe0" />
              <circle cx={x - 4} cy={EYE_Y - 4} r="3" fill="#fff" />
            </g>
          ))}
        </g>
      )
    case 'lashes':
      return (
        <g className="blink">
          <g ref={pupilsRef}>{both((x) => glossy(x, 10, 12.5))}</g>
          {both((x, right) => (
            <path d={right ? `M${x + 8} ${EYE_Y - 8} L${x + 15} ${EYE_Y - 14} M${x + 10} ${EYE_Y - 2} L${x + 18} ${EYE_Y - 4}` : `M${x - 8} ${EYE_Y - 8} L${x - 15} ${EYE_Y - 14} M${x - 10} ${EYE_Y - 2} L${x - 18} ${EYE_Y - 4}`}
              stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          ))}
        </g>
      )
    default: // 'goggle' → big glossy eyes
      return <g className="blink"><g ref={pupilsRef}>{both((x) => glossy(x, 11, 13.5))}</g></g>
  }
}

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.48 : r
    return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`
  }).join(' ')
  return <polygon points={pts} fill={fill} stroke={fill} strokeWidth="3" strokeLinejoin="round" />
}

function Brows({ kind, color }: { kind: string; color: string }) {
  const Y = 94
  const b = (x: number, rot: number, w = 22, h = 6.5) => (
    <path d={`M${x - w / 2} ${Y + 2} Q${x} ${Y - 5} ${x + w / 2} ${Y + 2}`} stroke={color} strokeWidth={h} strokeLinecap="round" fill="none" transform={`rotate(${rot} ${x} ${Y})`} />
  )
  switch (kind) {
    case 'none':
      return null
    case 'thin':
      return <g className="av-brows">{b(EYE_L, -3, 20, 3.5)}{b(EYE_R, 3, 20, 3.5)}</g>
    case 'angry':
      return <g className="av-brows" transform="translate(0 4)">{b(EYE_L + 2, 18)}{b(EYE_R - 2, -18)}</g>
    case 'worried':
      return <g className="av-brows">{b(EYE_L, -16)}{b(EYE_R, 16)}</g>
    case 'raised':
      return <g className="av-brows" transform="translate(0 -8)">{b(EYE_L, -6)}{b(EYE_R, 6)}</g>
    default:
      return <g className="av-brows">{b(EYE_L, -4, 24, 8)}{b(EYE_R, 4, 24, 8)}</g>
  }
}

function Nose({ kind, skin }: { kind: string; skin: string }) {
  const s = shade(skin, -0.2)
  switch (kind) {
    case 'long':
      return <path d="M100 118 Q108 134 104 140 Q98 142 94 138" stroke={s} strokeWidth="5" fill="none" strokeLinecap="round" />
    case 'tiny':
      return <g fill={s}><circle cx="95" cy="134" r="2.4" /><circle cx="105" cy="134" r="2.4" /></g>
    case 'pointy':
      return <path d="M100 120 L108 136 Q100 140 93 136Z" fill={s} />
    case 'snout':
      return (
        <g>
          <ellipse cx="100" cy="134" rx="15" ry="10" fill={shade(skin, -0.08)} />
          <ellipse cx="94" cy="135" rx="2.6" ry="3.4" fill={shade(skin, -0.35)} />
          <ellipse cx="106" cy="135" rx="2.6" ry="3.4" fill={shade(skin, -0.35)} />
        </g>
      )
    default:
      return (
        <g>
          <ellipse cx="100" cy="133" rx="9" ry="7" fill={s} opacity="0.7" />
          <ellipse cx="97" cy="130" rx="3.5" ry="2.4" fill="#fff" opacity="0.45" />
        </g>
      )
  }
}

function Mouth({ kind }: { kind: string }) {
  const line = (d: string) => <path className="av-mouth" d={d} stroke={LIP} strokeWidth="5" fill="none" strokeLinecap="round" />
  switch (kind) {
    case 'grin':
      return (
        <g className="av-mouth">
          <path d="M84 148 Q100 151 116 148 Q114 168 100 168 Q86 168 84 148Z" fill={LIP} />
          <path d="M87 149 Q100 152 113 149 L112 154 Q100 156 88 154Z" fill="#fff" />
          <ellipse cx="100" cy="163" rx="8" ry="4" fill="#ff7aa8" />
        </g>
      )
    case 'smirk':
      return line('M88 156 Q103 161 115 149')
    case 'tongue':
      return (
        <g className="av-mouth">
          <path d="M96 156 L96 164 Q102 172 108 164 L108 156Z" fill="#ff7aa8" />
          {line('M86 152 Q100 162 114 152')}
        </g>
      )
    case 'o':
      return <ellipse className="av-mouth" cx="100" cy="157" rx="7" ry="9" fill={LIP} />
    case 'flat':
      return line('M90 156 L110 156')
    case 'frown':
      return line('M88 162 Q100 150 112 162')
    default:
      return line('M86 150 Q100 164 114 150')
  }
}

function Beard({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
    case 'stubble':
      return (
        <g fill={shade(color, 0.1)} opacity="0.4">
          {Array.from({ length: 34 }, (_, i) => {
            const a = (Math.PI * (i % 17)) / 16
            const r = i < 17 ? 50 : 42
            return <circle key={i} cx={100 - Math.cos(a) * r} cy={136 + Math.sin(a) * (r - 6)} r="1.7" />
          })}
        </g>
      )
    case 'full':
      return <path d="M38 120 C40 170 70 190 100 190 C130 190 160 170 162 120 C150 140 138 146 126 146 C116 142 84 142 74 146 C62 146 50 140 38 120Z" fill={color} />
    case 'stache':
      return <path d="M100 143 C90 136 76 138 72 149 C82 145 92 147 100 149 C108 147 118 145 128 149 C124 138 110 136 100 143Z" fill={color} />
    case 'goatee':
      return <path d="M90 170 C90 186 110 186 110 170 C105 173 95 173 90 170Z" fill={color} />
    default:
      return null
  }
}

function Details({ kind }: { kind: string }) {
  switch (kind) {
    case 'freckles':
      return (
        <g fill="#a8623f" opacity="0.5">
          {[[60, 132], [68, 138], [56, 140], [140, 132], [132, 138], [144, 140]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2" />)}
        </g>
      )
    case 'mole':
      return <circle cx="126" cy="158" r="2.6" fill="#4a2a1c" />
    case 'bandaid':
      return (
        <g transform="rotate(-24 138 136)">
          <rect x="122" y="129" width="32" height="13" rx="6.5" fill="#ffe1c2" />
          <rect x="133" y="129" width="10" height="13" fill="#f6c9a0" />
        </g>
      )
    case 'sticker':
      return <Star cx={138} cy={146} r={8} fill="#d9f66b" />
    default:
      return null
  }
}

function Extra({ kind }: { kind: string }) {
  const gold = '#ffc93c'
  switch (kind) {
    case 'glasses':
      return (
        <g fill="none" stroke={INK} strokeWidth="4.5">
          <rect x="56" y="98" width="44" height="36" rx="16" fill="#fff" fillOpacity="0.18" />
          <rect x="100" y="98" width="44" height="36" rx="16" fill="#fff" fillOpacity="0.18" />
          <path d="M56 110 L40 106 M144 110 L160 106" />
        </g>
      )
    case 'shades':
      return (
        <g>
          <path d="M52 102 L96 102 L94 120 Q92 130 80 130 L66 130 Q54 130 52 118Z" fill={INK} />
          <path d="M104 102 L148 102 L148 118 Q146 130 134 130 L120 130 Q108 130 106 120Z" fill={INK} />
          <rect x="94" y="102" width="12" height="5" fill={INK} />
          <path d="M60 108 L74 108 M112 108 L126 108" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />
          <path d="M52 104 L38 100 M148 104 L162 100" stroke={INK} strokeWidth="4" />
        </g>
      )
    case 'earrings':
      return (
        <g fill={gold}>
          <circle cx="38" cy="144" r="6" /><circle cx="162" cy="144" r="6" />
          <circle cx="36" cy="142" r="2" fill="#fff" /><circle cx="160" cy="142" r="2" fill="#fff" />
        </g>
      )
    case 'nosering':
      return <circle cx="106" cy="139" r="4.5" fill="none" stroke={gold} strokeWidth="3" />
    case 'monocle':
      return (
        <g fill="none" stroke={gold} strokeWidth="4">
          <circle cx={EYE_R} cy={EYE_Y} r="19" fill="#fff" fillOpacity="0.15" />
          <path d="M139 125 Q152 156 138 178" strokeWidth="2" />
        </g>
      )
    default:
      return null
  }
}

function Hat({ kind, color, uid }: { kind: string; color: string; uid: string }) {
  const dark = shade(color, -0.25)
  switch (kind) {
    case 'cap':
      return (
        <g>
          <Shaded d="M36 92 C34 42 66 24 100 24 C134 24 166 42 164 92Z" fill={color} uid={uid} id="cap" />
          <path d="M98 84 C132 76 178 78 200 94 C178 102 132 100 98 94Z" fill={dark} />
          <circle cx="100" cy="26" r="6" fill={dark} />
        </g>
      )
    case 'beanie':
      return (
        <g>
          <Shaded d="M34 92 C34 40 66 18 100 18 C134 18 166 40 166 92Z" fill={color} uid={uid} id="bn" />
          <rect x="28" y="76" width="144" height="24" rx="12" fill={dark} />
          {[44, 60, 76, 92, 108, 124, 140, 156].map((x) => <rect key={x} x={x - 2} y="80" width="4" height="16" rx="2" fill={shade(color, -0.45)} opacity="0.45" />)}
          <circle cx="100" cy="16" r="13" fill={shade(color, 0.3)} />
        </g>
      )
    case 'crown':
      return (
        <g>
          <path d="M56 72 L50 26 L76 48 L100 14 L124 48 L150 26 L144 72Z" fill="#ffc93c" strokeLinejoin="round" stroke="#ffc93c" strokeWidth="4" />
          <path d="M100 14 L124 48 L150 26 L144 72 L100 72Z" fill="#f2a516" opacity="0.6" />
          <circle cx="100" cy="58" r="7" fill={color} />
          <circle cx="74" cy="62" r="5" fill={color} />
          <circle cx="126" cy="62" r="5" fill={color} />
        </g>
      )
    case 'party':
      return (
        <g transform="rotate(14 120 40)">
          <path d="M120 -16 L148 60 L92 60Z" fill={color} />
          <path d="M120 -16 L148 60 L120 60Z" fill={dark} opacity="0.45" />
          <path d="M106 22 L134 22 M100 40 L141 40" stroke="#fff" strokeWidth="5" opacity="0.8" />
          <circle cx="120" cy="-16" r="9" fill="#d9f66b" />
        </g>
      )
    case 'phones':
      return (
        <g>
          <rect x="16" y="98" width="26" height="44" rx="12" fill={color} />
          <rect x="158" y="98" width="26" height="44" rx="12" fill={color} />
          <rect x="24" y="106" width="8" height="28" rx="4" fill={dark} />
          <rect x="168" y="106" width="8" height="28" rx="4" fill={dark} />
        </g>
      )
    case 'halo':
      return (
        <g className="av-halo">
          <ellipse cx="100" cy="14" rx="46" ry="11" fill="none" stroke="#ffd84a" strokeWidth="7" />
        </g>
      )
    default:
      return null
  }
}

/** Neck + shoulders so every avatar reads as a little character bust. */
function Outfit({ kind, color, skin, uid }: { kind: string; color: string; skin: string; uid: string }) {
  const torso = 'M8 260 C10 218 40 196 78 190 Q100 204 122 190 C160 196 190 218 192 260Z'
  const dark = shade(color, -0.22)
  return (
    <g>
      <path d="M84 166 L84 198 Q100 208 116 198 L116 166Z" fill={shade(skin, -0.2)} />
      {kind === 'hoodie' && <path d="M58 196 Q100 230 142 196 Q132 178 100 180 Q68 178 58 196Z" fill={dark} />}
      <Shaded d={torso} fill={color} uid={uid} id="tor" dx={-10} dy={-4} />
      {kind === 'tee' && <path d="M80 191 Q100 210 120 191" stroke={dark} strokeWidth="6" fill="none" strokeLinecap="round" />}
      {kind === 'hoodie' && (
        <g stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.85">
          <path d="M90 204 L88 232" /><path d="M110 204 L112 232" />
        </g>
      )}
      {kind === 'collar' && (
        <g fill="#fff">
          <path d="M78 190 L100 206 L90 220 Z" /><path d="M122 190 L100 206 L110 220 Z" />
        </g>
      )}
      {kind === 'stripes' && (
        <g>
          <clipPath id={`${uid}-strp`}><path d={torso} /></clipPath>
          <g clipPath={`url(#${uid}-strp)`} fill="#fff" opacity="0.55">
            {[204, 222, 240].map((y) => <rect key={y} x="0" y={y} width="200" height="8" />)}
          </g>
          <path d="M80 191 Q100 208 120 191" stroke={dark} strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      )}
      {kind === 'jacket' && (
        <g>
          <path d="M80 191 L100 230 L120 191 Q100 206 80 191Z" fill="#fff" />
          <path d="M78 190 L100 236 L86 260 L60 200Z" fill={dark} />
          <path d="M122 190 L100 236 L114 260 L140 200Z" fill={dark} />
        </g>
      )}
    </g>
  )
}
