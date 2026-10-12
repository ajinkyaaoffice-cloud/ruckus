/** Mogul's board: mirrors server/app/games/mogul.py (prices, rents and groups must match). */

export type Space =
  | { kind: 'street'; name: string; group: Group; price: number; rent: number[]; house: number }
  | { kind: 'station' | 'util'; name: string; price: number }
  | { kind: 'go' | 'chest' | 'chance' | 'jail' | 'parking' | 'gotojail'; name: string }
  | { kind: 'tax'; name: string; amount: number }

export type Group = 'brown' | 'sky' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'navy'

export const GROUP_HEX: Record<Group, string> = {
  brown: '#a0643c', sky: '#8fd8ff', pink: '#ff5fb8', orange: '#ff8a1f',
  red: '#ff5d73', yellow: '#ffc93c', green: '#43d17a', navy: '#3d5bd9',
}
export const GROUP_NAME: Record<Group, string> = {
  brown: 'Brown', sky: 'Sky blue', pink: 'Pink', orange: 'Orange', red: 'Red', yellow: 'Yellow', green: 'Green', navy: 'Navy',
}

const st = (name: string, group: Group, price: number, rent: number[], house: number): Space => ({ kind: 'street', name, group, price, rent, house })
const rail = (name: string): Space => ({ kind: 'station', name, price: 200 })
const util = (name: string): Space => ({ kind: 'util', name, price: 150 })

export const SPACES: Space[] = [
  { kind: 'go', name: 'GO' },
  st('Gum Alley', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { kind: 'chest', name: 'Chest' },
  st('Pocket Lane', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { kind: 'tax', name: 'Income Tax', amount: 200 },
  rail('North Line'),
  st('Kite Row', 'sky', 100, [6, 30, 90, 270, 400, 550], 50),
  { kind: 'chance', name: 'Chance' },
  st('Fizz Street', 'sky', 100, [6, 30, 90, 270, 400, 550], 50),
  st('Bubble Avenue', 'sky', 120, [8, 40, 100, 300, 450, 600], 50),
  { kind: 'jail', name: 'Jail' },
  st('Disco Drive', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  util('Power Plant'),
  st('Glitter Way', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  st('Neon Strip', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  rail('East Line'),
  st('Taco Terrace', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { kind: 'chest', name: 'Chest' },
  st('Pretzel Pier', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  st('Jam Street', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { kind: 'parking', name: 'Free Parking' },
  st('Ruby Road', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { kind: 'chance', name: 'Chance' },
  st('Chili Court', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  st('Rocket Row', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  rail('South Line'),
  st('Banana Boulevard', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  st('Sunny Square', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  util('Water Works'),
  st('Lemon Lane', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { kind: 'gotojail', name: 'Go To Jail' },
  st('Mint Mews', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  st('Cactus Close', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { kind: 'chest', name: 'Chest' },
  st('Fern Gardens', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  rail('West Line'),
  { kind: 'chance', name: 'Chance' },
  st('Velvet Heights', 'navy', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { kind: 'tax', name: 'Luxury Tax', amount: 100 },
  st('Royal Rooftops', 'navy', 400, [50, 200, 600, 1400, 1700, 2000], 200),
]

export const GROUPS: Record<Group, number[]> = SPACES.reduce((acc, s, i) => {
  if (s.kind === 'street') (acc[s.group] ??= []).push(i)
  return acc
}, {} as Record<Group, number[]>)
export const STATIONS = [5, 15, 25, 35]
export const UTILS = [12, 28]
export const JAIL = 10

export const priceOf = (i: number) => ('price' in SPACES[i] ? (SPACES[i] as { price: number }).price : 0)
export const mortgageValue = (i: number) => Math.floor(priceOf(i) / 2)
export const liftCost = (i: number) => { const m = mortgageValue(i); return m + Math.ceil(m / 10) }
export const ownable = (i: number) => 'price' in SPACES[i]
export const colorOf = (i: number) => { const s = SPACES[i]; return s.kind === 'street' ? GROUP_HEX[s.group] : s.kind === 'station' ? '#1d3a6e' : s.kind === 'util' ? '#9aa6c4' : '#fff' }

/* ---------- geometry: 9 tiles a side between 1.6-wide corners; GO bottom-right, play runs clockwise ---------- */

export const C = 1.6
export const W = 1
export const B = C * 2 + W * 9            // 12.2 units across

export type Rect = { x: number; y: number; w: number; h: number; side: 0 | 1 | 2 | 3; corner: boolean }

/** side 0 = bottom row, 1 = left column, 2 = top row, 3 = right column; the colour band faces the middle. */
export function tileRect(i: number): Rect {
  const s = Math.floor(i / 10) as 0 | 1 | 2 | 3
  const k = i % 10
  if (k === 0) {
    const pos = [[B - C, B - C], [0, B - C], [0, 0], [B - C, 0]][s]
    return { x: pos[0], y: pos[1], w: C, h: C, side: s, corner: true }
  }
  if (s === 0) return { x: B - C - k * W, y: B - C, w: W, h: C, side: s, corner: false }
  if (s === 1) return { x: 0, y: B - C - k * W, w: C, h: W, side: s, corner: false }
  if (s === 2) return { x: C + (k - 1) * W, y: 0, w: W, h: C, side: s, corner: false }
  return { x: B - C, y: C + (k - 1) * W, w: C, h: W, side: s, corner: false }
}

/** Where a token stands on tile i (the outer part of the tile, clear of the colour band). */
export function tileSpot(i: number): [number, number] {
  const r = tileRect(i)
  if (r.corner) return [r.x + r.w / 2, r.y + r.h / 2]
  const off = 0.08
  if (r.side === 0) return [r.x + r.w / 2, r.y + r.h * (0.6 + off)]
  if (r.side === 1) return [r.x + r.w * (0.4 - off), r.y + r.h / 2]
  if (r.side === 2) return [r.x + r.w / 2, r.y + r.h * (0.4 - off)]
  return [r.x + r.w * (0.6 + off), r.y + r.h / 2]
}

export type Cash = Record<string, number>
