export type AvatarConfig = {
  face: string
  skin: string
  hair: string
  hairColor: string
  brows: string
  eyes: string
  nose: string
  mouth: string
  beard: string
  hat: string
  hatColor: string
  extra: string
  detail: string
  bg: string
  top: string
  topColor: string
}

export type Expression = 'idle' | 'happy' | 'sad' | 'focus' | 'shock' | 'wink'

export const SKINS = ['#ffe4d3', '#ffd3b4', '#f6bf98', '#e4a57c', '#c98a62', '#a76a46', '#7c4a30', '#bfe9ff', '#d7f5a6', '#e7d6ff']
export const HAIR_COLORS = ['#1e2346', '#2b1a12', '#6b3b1f', '#c8853c', '#f4d36b', '#f2f2f2', '#e64fe0', '#45b8ff', '#ff7a4d', '#7d6bff']
export const HAT_COLORS = ['#e64fe0', '#1d3a6e', '#45b8ff', '#d9f66b', '#ff9a62', '#ffb424', '#ffffff', '#a596ff']
export const TOP_COLORS = ['#e64fe0', '#45b8ff', '#ffb424', '#1d3a6e', '#d9f66b', '#ff9a62', '#a596ff', '#ffffff']
export const BG_COLORS = ['#a7ecff', '#d9f66b', '#ffb424', '#ff9a62', '#a596ff', '#ffffff', '#e64fe0', '#1d3a6e']

export type Category = {
  key: keyof AvatarConfig
  label: string
  options: string[]
  colorKey?: keyof AvatarConfig
  colors?: string[]
}

export const CATEGORIES: Category[] = [
  { key: 'hat', label: 'Hats', options: ['none', 'cap', 'beanie', 'crown', 'party', 'phones', 'halo'], colorKey: 'hatColor', colors: HAT_COLORS },
  { key: 'hair', label: 'Hair', options: ['curly', 'spiky', 'bowl', 'long', 'bun', 'mohawk', 'afro', 'none'], colorKey: 'hairColor', colors: HAIR_COLORS },
  { key: 'eyes', label: 'Eyes', options: ['goggle', 'dots', 'round', 'sleepy', 'stars', 'lashes'] },
  { key: 'brows', label: 'Brows', options: ['thick', 'thin', 'angry', 'worried', 'none'] },
  { key: 'extra', label: 'Jewellery', options: ['none', 'glasses', 'shades', 'earrings', 'nosering', 'monocle'] },
  { key: 'nose', label: 'Nose', options: ['button', 'long', 'tiny', 'pointy', 'snout'] },
  { key: 'mouth', label: 'Mouth', options: ['smile', 'grin', 'smirk', 'tongue', 'o', 'flat'] },
  { key: 'face', label: 'Face', options: ['round', 'bean', 'square', 'pear', 'egg'], colorKey: 'skin', colors: SKINS },
  { key: 'beard', label: 'Beard', options: ['none', 'stubble', 'full', 'stache', 'goatee'] },
  { key: 'top', label: 'Outfit', options: ['tee', 'hoodie', 'collar', 'stripes', 'jacket'], colorKey: 'topColor', colors: TOP_COLORS },
  { key: 'detail', label: 'Details', options: ['none', 'freckles', 'blush', 'mole', 'bandaid', 'sticker'], colorKey: 'bg', colors: BG_COLORS },
]

export const DEFAULT_AVATAR: AvatarConfig = {
  face: 'round', skin: SKINS[1], hair: 'curly', hairColor: HAIR_COLORS[0], brows: 'thick', eyes: 'goggle',
  nose: 'button', mouth: 'smile', beard: 'none', hat: 'none', hatColor: HAT_COLORS[0], extra: 'none',
  detail: 'blush', bg: BG_COLORS[0], top: 'hoodie', topColor: TOP_COLORS[0],
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export function randomAvatar(): AvatarConfig {
  const weighted = (opts: string[], noneBias = 0.45) =>
    opts.includes('none') && Math.random() < noneBias ? 'none' : pick(opts.filter((o) => o !== 'none'))
  return {
    face: pick(CATEGORIES.find((c) => c.key === 'face')!.options),
    skin: pick(SKINS.slice(0, 7).concat(Math.random() < 0.15 ? SKINS.slice(7) : [])),
    hair: weighted(CATEGORIES.find((c) => c.key === 'hair')!.options, 0.08),
    hairColor: pick(HAIR_COLORS),
    brows: weighted(CATEGORIES.find((c) => c.key === 'brows')!.options, 0.1),
    eyes: pick(CATEGORIES.find((c) => c.key === 'eyes')!.options),
    nose: pick(CATEGORIES.find((c) => c.key === 'nose')!.options),
    mouth: pick(CATEGORIES.find((c) => c.key === 'mouth')!.options),
    beard: weighted(CATEGORIES.find((c) => c.key === 'beard')!.options, 0.7),
    hat: weighted(CATEGORIES.find((c) => c.key === 'hat')!.options, 0.55),
    hatColor: pick(HAT_COLORS),
    extra: weighted(CATEGORIES.find((c) => c.key === 'extra')!.options, 0.6),
    detail: weighted(CATEGORIES.find((c) => c.key === 'detail')!.options, 0.4),
    bg: pick(BG_COLORS),
    top: pick(CATEGORIES.find((c) => c.key === 'top')!.options),
    topColor: pick(TOP_COLORS),
  }
}

export function normalizeAvatar(a: unknown): AvatarConfig {
  const out = { ...DEFAULT_AVATAR }
  if (a && typeof a === 'object') {
    for (const k of Object.keys(DEFAULT_AVATAR) as (keyof AvatarConfig)[]) {
      const v = (a as Record<string, unknown>)[k]
      if (typeof v === 'string') out[k] = v
    }
  }
  return out
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(String(hex ?? '#888888').replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const t = amt < 0 ? 0 : 255
  const p = Math.abs(amt)
  r = Math.round((t - r) * p + r)
  g = Math.round((t - g) * p + g)
  b = Math.round((t - b) * p + b)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}
