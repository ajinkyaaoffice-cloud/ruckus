import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { normalizeAvatar, shade, type AvatarConfig, type Expression } from '../lib/avatar'
import './Avatar.css'

type Props = {
  config: Partial<AvatarConfig> | undefined
  size?: number | string
  expression?: Expression
  /** 'mouse' = eyes & layers follow the pointer, number = idle sway strength */
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

const HEADS: Record<string, string> = {
  round: 'M100 42 C138 42 166 70 166 112 C166 156 138 184 100 184 C62 184 34 156 34 112 C34 70 62 42 100 42Z',
  bean: 'M100 40 C150 40 168 78 166 118 C164 160 140 184 100 184 C60 184 36 160 34 118 C32 78 50 40 100 40Z',
  square: 'M78 44 L122 44 C150 44 166 60 166 88 L166 142 C166 170 150 184 122 184 L78 184 C50 184 34 170 34 142 L34 88 C34 60 50 44 78 44Z',
  pear: 'M100 42 C138 42 152 70 156 100 C164 140 150 184 100 184 C50 184 36 140 44 100 C48 70 62 42 100 42Z',
  egg: 'M100 38 C142 38 162 86 162 124 C162 162 136 186 100 186 C64 186 38 162 38 124 C38 86 58 38 100 38Z',
}

function ring(cx: number, cy: number, r: number, from: number, to: number, n: number, size: number) {
  const out: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, size * (0.85 + ((i * 37) % 10) / 40)])
  }
  return out
}

const CURLS_BACK = ring(100, 108, 72, 150, 390, 15, 22)
const CURLS_FRONT = [44, 60, 76, 92, 108, 124, 140, 156].map((x, i) => [x, 74 + (i % 2) * 6 - Math.abs(100 - x) * -0.12, 15 + (i % 3)])
const AFRO = ring(100, 92, 84, 0, 345, 24, 26)

export default function Avatar({ config, size = 160, expression = 'idle', track = 'idle', depth = 1, badge, className, style }: Props) {
  const c = normalizeAvatar(config)
  const uid = useId().replace(/:/g, '')
  const root = useRef<SVGSVGElement>(null)
  const back = useRef<SVGGElement>(null)
  const face = useRef<SVGGElement>(null)
  const feat = useRef<SVGGElement>(null)
  const front = useRef<SVGGElement>(null)
  const pupils = useRef<SVGGElement>(null)

  useEffect(() => {
    if (track === 'none') return
    let raf = 0
    let lx = 0, ly = 0
    const seed = Math.random() * 100
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      let tx: number, ty: number
      const el = root.current
      if (!el) return
      if (track === 'mouse') {
        const r = el.getBoundingClientRect()
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
      back.current?.setAttribute('transform', `translate(${-lx * 5 * d} ${-ly * 3 * d})`)
      face.current?.setAttribute('transform', `translate(${lx * 2 * d} ${ly * 2 * d})`)
      feat.current?.setAttribute('transform', `translate(${lx * 9 * d} ${ly * 6 * d})`)
      front.current?.setAttribute('transform', `translate(${lx * 5 * d} ${ly * 3 * d})`)
      pupils.current?.setAttribute('transform', `translate(${lx * 4} ${ly * 3.5})`)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [track, depth])

  const g = (n: string) => `url(#${uid}-${n})`
  const skinD = shade(c.skin, -0.18)
  const hairD = shade(c.hairColor, -0.35)
  const hatD = shade(c.hatColor, -0.3)
  const ex = expression
  const sq = ex === 'happy' ? 0.35 : ex === 'shock' ? 1.15 : ex === 'focus' ? 0.75 : 1

  const brows = ex === 'focus' ? 'angry' : ex === 'sad' ? 'worried' : ex === 'shock' ? 'raised' : c.brows
  const mouth = ex === 'happy' ? 'grin' : ex === 'sad' ? 'frown' : ex === 'shock' ? 'o' : ex === 'focus' ? 'smirk' : c.mouth

  return (
    <svg
      ref={root}
      viewBox="-10 -14 220 220"
      width={size}
      height={size}
      className={`avatar ${className ?? ''} ex-${ex}`}
      style={style}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${uid}-skin`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor={shade(c.skin, 0.35)} />
          <stop offset="0.55" stopColor={c.skin} />
          <stop offset="1" stopColor={skinD} />
        </radialGradient>
        <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={shade(c.hairColor, 0.25)} />
          <stop offset="1" stopColor={hairD} />
        </linearGradient>
        <linearGradient id={`${uid}-hat`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={shade(c.hatColor, 0.3)} />
          <stop offset="1" stopColor={hatD} />
        </linearGradient>
        <radialGradient id={`${uid}-nose`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor={shade(c.skin, 0.4)} />
          <stop offset="1" stopColor={shade(c.skin, -0.12)} />
        </radialGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1a1" />
          <stop offset="1" stopColor="#f2a516" />
        </linearGradient>
        <clipPath id={`${uid}-head`}>
          <path d={HEADS[c.face] ?? HEADS.round} />
        </clipPath>
      </defs>

      {badge && <circle cx="100" cy="100" r="104" fill={c.bg} />}

      <g className="av-body">
        {/* ---------- back layer ---------- */}
        <g ref={back}>
          {c.hair === 'curly' && CURLS_BACK.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={g('hair')} />)}
          {c.hair === 'afro' && (
            <g>
              <circle cx="100" cy="92" r="84" fill={g('hair')} />
              {AFRO.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={g('hair')} />)}
            </g>
          )}
          {c.hair === 'long' && <path d="M28 110 C28 50 60 24 100 24 C140 24 172 50 172 110 L178 196 C150 206 50 206 22 196Z" fill={g('hair')} />}
          {c.hair === 'bun' && <circle cx="100" cy="28" r="24" fill={g('hair')} />}
          {c.hat === 'phones' && <path d="M26 112 C26 20 174 20 174 112" fill="none" stroke={g('hat')} strokeWidth="13" strokeLinecap="round" />}
          {/* ears */}
          <circle cx="36" cy="120" r="15" fill={g('skin')} />
          <circle cx="164" cy="120" r="15" fill={g('skin')} />
          <circle cx="38" cy="121" r="6" fill={skinD} opacity="0.5" />
          <circle cx="162" cy="121" r="6" fill={skinD} opacity="0.5" />
        </g>

        {/* ---------- head ---------- */}
        <g ref={face}>
          <path d={HEADS[c.face] ?? HEADS.round} fill={g('skin')} />
          <g clipPath={`url(#${uid}-head)`}>
            <ellipse cx="128" cy="170" rx="70" ry="40" fill={skinD} opacity="0.18" />
            {c.hair === 'none' && <ellipse cx="80" cy="64" rx="20" ry="9" fill="#fff" opacity="0.35" transform="rotate(-20 80 64)" />}
          </g>

          {/* features move further than the head for a 3D turn */}
          <g ref={feat}>
            <Details kind={c.detail} />
            <Beard kind={c.beard} fill={g('hair')} color={c.hairColor} />
            <Mouth kind={mouth} />
            <g className="av-eyes" style={{ transform: `scaleY(${sq})` }}>
              <Eyes kind={c.eyes} pupilsRef={pupils} wink={ex === 'wink'} skin={c.skin} />
            </g>
            <Brows kind={brows} color={hairD} />
            <Nose kind={c.nose} fill={g('nose')} dark={skinD} />
            <Extra kind={c.extra} gold={g('gold')} />
          </g>
        </g>

        {/* ---------- front layer ---------- */}
        <g ref={front}>
          <HairFront kind={c.hair} fill={g('hair')} />
          <Hat kind={c.hat} fill={g('hat')} color={c.hatColor} dark={hatD} gold={g('gold')} />
        </g>
      </g>
    </svg>
  )
}

function Eyes({ kind, pupilsRef, wink, skin }: { kind: string; pupilsRef: React.Ref<SVGGElement>; wink: boolean; skin: string }) {
  const navy = '#16213f'
  const R = (node: React.ReactNode) => (wink ? <path d="M110 108 Q124 98 138 108" stroke={navy} strokeWidth="5" fill="none" strokeLinecap="round" /> : node)
  switch (kind) {
    case 'dots':
      return (
        <g className="blink">
          <g ref={pupilsRef}>
            <ellipse cx="76" cy="106" rx="7" ry="9" fill={navy} />
            {R(<ellipse cx="124" cy="106" rx="7" ry="9" fill={navy} />)}
            <circle cx="78" cy="102" r="2.4" fill="#fff" />
            {!wink && <circle cx="126" cy="102" r="2.4" fill="#fff" />}
          </g>
        </g>
      )
    case 'round':
    case 'lashes':
      return (
        <g className="blink">
          <circle cx="76" cy="106" r="15" fill="#fff" />
          {R(<circle cx="124" cy="106" r="15" fill="#fff" />)}
          {kind === 'lashes' && (
            <g stroke={navy} strokeWidth="3" strokeLinecap="round">
              <path d="M62 96 L56 90 M68 92 L65 85 M76 90 L76 83" />
              {!wink && <path d="M138 96 L144 90 M132 92 L135 85 M124 90 L124 83" />}
            </g>
          )}
          <g ref={pupilsRef}>
            <circle cx="77" cy="107" r="7" fill={navy} />
            {!wink && <circle cx="125" cy="107" r="7" fill={navy} />}
            <circle cx="79.5" cy="104" r="2.4" fill="#fff" />
            {!wink && <circle cx="127.5" cy="104" r="2.4" fill="#fff" />}
          </g>
        </g>
      )
    case 'sleepy':
      return (
        <g className="blink">
          <circle cx="76" cy="108" r="13" fill="#fff" />
          {R(<circle cx="124" cy="108" r="13" fill="#fff" />)}
          <g ref={pupilsRef}>
            <circle cx="77" cy="112" r="6" fill={navy} />
            {!wink && <circle cx="125" cy="112" r="6" fill={navy} />}
          </g>
          <path d="M62 108 A14 14 0 0 1 90 108Z" fill={shade(skin, -0.08)} />
          {!wink && <path d="M110 108 A14 14 0 0 1 138 108Z" fill={shade(skin, -0.08)} />}
          <path d="M62 108 L90 108" stroke={navy} strokeWidth="3" strokeLinecap="round" />
          {!wink && <path d="M110 108 L138 108" stroke={navy} strokeWidth="3" strokeLinecap="round" />}
        </g>
      )
    case 'stars':
      return (
        <g className="blink" ref={pupilsRef}>
          <Star cx={76} cy={106} r={13} fill="#e64fe0" />
          {R(<Star cx={124} cy={106} r={13} fill="#e64fe0" />)}
        </g>
      )
    default: // goggle — chunky white plates with square pupils
      return (
        <g className="blink">
          <rect x="56" y="90" width="40" height="34" rx="11" fill="#fff" />
          {R(<rect x="104" y="90" width="40" height="34" rx="11" fill="#fff" />)}
          <g ref={pupilsRef}>
            <rect x="70" y="100" width="12" height="12" rx="3" fill={navy} />
            {!wink && <rect x="118" y="100" width="12" height="12" rx="3" fill={navy} />}
          </g>
        </g>
      )
  }
}

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`
  }).join(' ')
  return <polygon points={pts} fill={fill} strokeLinejoin="round" />
}

function Brows({ kind, color }: { kind: string; color: string }) {
  const b = (x: number, rot: number, w = 28, h = 9) => (
    <rect x={x - w / 2} y={82 - h / 2} width={w} height={h} rx={h / 2} fill={color} transform={`rotate(${rot} ${x} 82)`} />
  )
  switch (kind) {
    case 'none':
      return null
    case 'thin':
      return <g className="av-brows">{b(76, -4, 24, 4)}{b(124, 4, 24, 4)}</g>
    case 'angry':
      return <g className="av-brows">{b(78, 16)}{b(122, -16)}</g>
    case 'worried':
      return <g className="av-brows">{b(76, -14)}{b(124, 14)}</g>
    case 'raised':
      return <g className="av-brows" transform="translate(0 -8)">{b(76, -6)}{b(124, 6)}</g>
    default:
      return <g className="av-brows">{b(76, -3)}{b(124, 3)}</g>
  }
}

function Nose({ kind, fill, dark }: { kind: string; fill: string; dark: string }) {
  switch (kind) {
    case 'long':
      return <ellipse cx="100" cy="126" rx="10" ry="18" fill={fill} />
    case 'tiny':
      return <ellipse cx="100" cy="130" rx="5" ry="4" fill={dark} opacity="0.7" />
    case 'pointy':
      return <path d="M100 112 L110 136 Q100 140 92 134Z" fill={fill} />
    case 'snout':
      return (
        <g>
          <ellipse cx="100" cy="130" rx="16" ry="11" fill={fill} />
          <ellipse cx="94" cy="131" rx="2.6" ry="3.6" fill={dark} />
          <ellipse cx="106" cy="131" rx="2.6" ry="3.6" fill={dark} />
        </g>
      )
    default:
      return (
        <g>
          <ellipse cx="100" cy="128" rx="12" ry="13" fill={fill} />
          <ellipse cx="96" cy="123" rx="4" ry="3" fill="#fff" opacity="0.5" />
        </g>
      )
  }
}

function Mouth({ kind }: { kind: string }) {
  const rose = '#d43f9a'
  const navy = '#16213f'
  const line = (d: string) => <path d={d} stroke={rose} strokeWidth="5.5" fill="none" strokeLinecap="round" />
  switch (kind) {
    case 'grin':
      return (
        <g className="av-mouth">
          <path d="M80 146 Q100 150 120 146 Q118 172 100 172 Q82 172 80 146Z" fill={navy} />
          <path d="M84 147 Q100 151 116 147 L115 153 Q100 156 85 153Z" fill="#fff" />
          <ellipse cx="100" cy="166" rx="9" ry="4.5" fill="#ff6fa8" />
        </g>
      )
    case 'smirk':
      return line('M86 154 Q102 160 116 146')
    case 'tongue':
      return (
        <g className="av-mouth">
          <ellipse cx="104" cy="158" rx="7" ry="9" fill="#ff6fa8" />
          {line('M84 150 Q100 162 116 150')}
        </g>
      )
    case 'o':
      return <ellipse cx="100" cy="155" rx="8" ry="10" fill={navy} />
    case 'flat':
      return line('M88 154 L112 154')
    case 'frown':
      return line('M86 160 Q100 146 114 160')
    default:
      return line('M84 148 Q100 164 116 148')
  }
}

function Beard({ kind, fill, color }: { kind: string; fill: string; color: string }) {
  switch (kind) {
    case 'stubble':
      return (
        <g fill={shade(color, 0.1)} opacity="0.45">
          {Array.from({ length: 34 }, (_, i) => {
            const a = (Math.PI * (i % 17)) / 16
            const r = i < 17 ? 52 : 44
            return <circle key={i} cx={100 - Math.cos(a) * r} cy={134 + Math.sin(a) * (r - 6)} r="1.8" />
          })}
        </g>
      )
    case 'full':
      return <path d="M36 118 C38 172 70 194 100 194 C130 194 162 172 164 118 C152 140 140 146 128 146 C118 140 82 140 72 146 C60 146 48 140 36 118Z" fill={fill} />
    case 'stache':
      return <path d="M100 141 C90 134 74 136 70 148 C80 144 90 146 100 148 C110 146 120 144 130 148 C126 136 110 134 100 141Z" fill={fill} />
    case 'goatee':
      return <path d="M88 168 C88 186 112 186 112 168 C106 172 94 172 88 168Z" fill={fill} />
    default:
      return null
  }
}

function Details({ kind }: { kind: string }) {
  switch (kind) {
    case 'freckles':
      return (
        <g fill="#b06a46" opacity="0.55">
          {[[62, 128], [70, 134], [58, 136], [138, 128], [130, 134], [142, 136]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" />)}
        </g>
      )
    case 'blush':
      return (
        <g fill="#ff6fa8" opacity="0.38">
          <ellipse cx="64" cy="136" rx="13" ry="8" />
          <ellipse cx="136" cy="136" rx="13" ry="8" />
        </g>
      )
    case 'mole':
      return <circle cx="128" cy="154" r="2.8" fill="#4a2a1c" />
    case 'bandaid':
      return (
        <g transform="rotate(-24 136 136)">
          <rect x="120" y="129" width="32" height="13" rx="6" fill="#ffd6b0" stroke="#e8b48a" strokeWidth="1.5" />
          <rect x="131" y="129" width="10" height="13" fill="#f2c39b" />
        </g>
      )
    case 'sticker':
      return <Star cx={136} cy={140} r={9} fill="#d9f66b" />
    default:
      return null
  }
}

function Extra({ kind, gold }: { kind: string; gold: string }) {
  const navy = '#16213f'
  switch (kind) {
    case 'glasses':
      return (
        <g fill="none" stroke={navy} strokeWidth="4.5">
          <circle cx="76" cy="107" r="20" />
          <circle cx="124" cy="107" r="20" />
          <path d="M96 104 Q100 99 104 104" />
          <path d="M56 104 L38 100 M144 104 L162 100" />
        </g>
      )
    case 'shades':
      return (
        <g>
          <path d="M52 94 L96 94 L94 114 Q92 124 80 124 L66 124 Q54 124 52 112Z" fill={navy} />
          <path d="M104 94 L148 94 L148 112 Q146 124 134 124 L120 124 Q108 124 106 114Z" fill={navy} />
          <rect x="94" y="94" width="12" height="5" fill={navy} />
          <path d="M60 100 L72 100 M112 100 L124 100" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          <path d="M52 96 L36 92 M148 96 L164 92" stroke={navy} strokeWidth="4" />
        </g>
      )
    case 'earrings':
      return (
        <g fill={gold}>
          <circle cx="36" cy="142" r="6" />
          <circle cx="164" cy="142" r="6" />
        </g>
      )
    case 'nosering':
      return <circle cx="106" cy="140" r="5" fill="none" stroke={gold} strokeWidth="3" />
    case 'monocle':
      return (
        <g fill="none" stroke={gold} strokeWidth="4">
          <circle cx="124" cy="107" r="19" />
          <path d="M141 116 Q154 150 140 176" strokeWidth="2" />
        </g>
      )
    default:
      return null
  }
}

function HairFront({ kind, fill }: { kind: string; fill: string }) {
  switch (kind) {
    case 'curly':
      return (
        <g>
          <path d="M36 98 C34 52 66 30 100 30 C134 30 166 52 164 98 C150 82 130 74 100 74 C70 74 50 82 36 98Z" fill={fill} />
          {CURLS_FRONT.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={fill} />)}
        </g>
      )
    case 'spiky':
      return <path d="M32 96 L40 52 L56 66 L64 28 L82 54 L100 16 L118 54 L136 28 L144 66 L160 52 L168 96 C150 78 130 70 100 70 C70 70 50 78 32 96Z" fill={fill} />
    case 'bowl':
      return <path d="M30 110 C26 46 64 26 100 26 C136 26 174 46 170 110 C164 98 160 90 156 86 L44 86 C40 90 36 98 30 110Z" fill={fill} />
    case 'long':
      return <path d="M34 104 C34 50 66 30 100 30 C140 30 168 54 166 108 C150 72 108 62 72 78 C56 86 44 94 34 104Z" fill={fill} />
    case 'bun':
      return <path d="M36 100 C36 54 66 38 100 38 C134 38 164 54 164 100 C150 78 128 68 100 68 C72 68 50 78 36 100Z" fill={fill} />
    case 'mohawk':
      return <path d="M86 76 C80 44 88 12 100 2 C112 12 120 44 114 76 C106 70 94 70 86 76Z" fill={fill} />
    case 'afro':
      return <path d="M40 96 C40 60 66 44 100 44 C134 44 160 60 160 96 C146 84 126 78 100 78 C74 78 54 84 40 96Z" fill={fill} />
    default:
      return null
  }
}

function Hat({ kind, fill, color, dark, gold }: { kind: string; fill: string; color: string; dark: string; gold: string }) {
  switch (kind) {
    case 'cap':
      return (
        <g>
          <path d="M36 88 C34 40 66 22 100 22 C134 22 166 40 164 88Z" fill={fill} />
          <path d="M96 82 C130 74 176 76 198 92 C176 100 130 98 96 92Z" fill={dark} />
          <circle cx="100" cy="24" r="6" fill={dark} />
          <path d="M100 26 L100 86" stroke={dark} strokeWidth="2" opacity="0.4" />
        </g>
      )
    case 'beanie':
      return (
        <g>
          <path d="M34 90 C34 38 66 16 100 16 C134 16 166 38 166 90Z" fill={fill} />
          <rect x="28" y="74" width="144" height="24" rx="12" fill={dark} />
          {[44, 60, 76, 92, 108, 124, 140, 156].map((x) => <rect key={x} x={x - 2} y="78" width="4" height="16" rx="2" fill={shade(color, -0.45)} opacity="0.5" />)}
          <circle cx="100" cy="14" r="13" fill={shade(color, 0.35)} />
        </g>
      )
    case 'crown':
      return (
        <g>
          <path d="M54 70 L48 22 L74 46 L100 12 L126 46 L152 22 L146 70Z" fill={gold} stroke="#d68a10" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="100" cy="54" r="7" fill={color} />
          <circle cx="72" cy="58" r="5" fill={color} />
          <circle cx="128" cy="58" r="5" fill={color} />
        </g>
      )
    case 'party':
      return (
        <g transform="rotate(14 120 40)">
          <path d="M120 -18 L148 58 L92 58Z" fill={fill} />
          <path d="M106 20 L134 20 M100 38 L141 38" stroke="#fff" strokeWidth="5" opacity="0.8" />
          <circle cx="120" cy="-18" r="9" fill="#d9f66b" />
        </g>
      )
    case 'phones':
      return (
        <g>
          <rect x="14" y="96" width="26" height="44" rx="12" fill={fill} />
          <rect x="160" y="96" width="26" height="44" rx="12" fill={fill} />
          <rect x="22" y="104" width="8" height="28" rx="4" fill={dark} />
          <rect x="170" y="104" width="8" height="28" rx="4" fill={dark} />
        </g>
      )
    case 'halo':
      return (
        <g className="av-halo">
          <ellipse cx="100" cy="10" rx="46" ry="11" fill="none" stroke="#ffd84a" strokeWidth="7" />
        </g>
      )
    default:
      return null
  }
}
