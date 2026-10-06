/**
 * What's new, newest first. The update splash lists every entry a player
 * hasn't seen yet (or just the latest). Add one entry per deploy that changes
 * something players would notice; keep each line short and plain.
 */
export type Release = { id: string; title: string; items: string[] }

export const CHANGELOG: Release[] = [
  {
    id: '2026-10-06-flip',
    title: 'UNO Flip',
    items: [
      'New UNO deck: Flip. Every card has a light side and a dark side, and a Flip card turns the whole table over',
      'Dark side brings Draw Five, Skip Everyone and the brutal Wild Draw Colour',
      'Every power card now shows what it does when it lands. Tap the pile to read it again',
      'Clearer arrows round the table for the direction of play',
      'A caught +4 bluffer’s hand stays private',
      'Rulebook pages fixed on phones, with four new pages for Flip',
    ],
  },
  {
    id: '2026-10-05-reel',
    title: 'Winner reel',
    items: [
      'A motion-graphic reveal for every game’s winner, then a podium and a leaderboard in the game’s colours',
      'Hosts can skip the reel for everyone, or switch it off in room settings',
    ],
  },
  {
    id: '2026-10-04-host',
    title: 'Host controls',
    items: [
      'Room settings for the host: lock the room, room size, kick, hand over host, reset scores and more',
      'Hosts can pause or end a game from the menu',
      'Ludo tokens hop square by square',
    ],
  },
]

const KEY = 'ruckus-news'

/** Releases this player hasn't seen, newest first (at least the latest one). */
export function unseenReleases(max = 3): Release[] {
  let seen: string | null = null
  try { seen = localStorage.getItem(KEY) } catch { /* private mode */ }
  const i = seen ? CHANGELOG.findIndex((r) => r.id === seen) : -1
  const fresh = i < 0 ? CHANGELOG.slice(0, max) : CHANGELOG.slice(0, i)
  return (fresh.length ? fresh : CHANGELOG.slice(0, 1)).slice(0, max)
}

export function markReleasesSeen() {
  try { localStorage.setItem(KEY, CHANGELOG[0].id) } catch { /* private mode */ }
}
