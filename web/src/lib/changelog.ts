/**
 * What's new, newest first. The update splash lists every entry a player
 * hasn't seen yet (or just the latest). Add one entry per deploy that changes
 * something players would notice; keep each line short and plain.
 */
export type Release = { id: string; title: string; items: string[] }

export const CHANGELOG: Release[] = [
  {
    id: '2026-10-12-mogul',
    title: 'New game: Mogul',
    items: [
      'Mogul, the property game: buy streets, charge rent, build houses and hotels, trade, and bankrupt your friends. 2 to 4 players, best with three',
      'All the classic rules: doubles, jail, 32 Chance and Chest cards, auctions, mortgages, even building and a bank that runs out of houses',
      'Pick classic last-one-standing, or a 30 or 60 minute game where the richest player wins',
      'Rule tips pop up the first time something matters, and the rulebook has a page for every rule',
      'We cleared out ten older games to make room: Quick Maths, Showdown, Light Cycles, Reversi, Checkers, Echo, Odd One Out, Memory Match, Connect Four and Ping Pong',
    ],
  },
  {
    id: '2026-10-12-crews',
    title: 'Crews: one link, straight in',
    items: [
      'Start a crew from the Play page: your group gets one permanent link, like /c/THEGANG',
      'Pin it in the group chat or add it to your home screen. Tap it and you’re in the lobby, ready',
      'Already made your look? Joining any room now skips the dressing room. Edit it any time from the hub',
      'The Play page remembers your crew: one tap to jump back in',
      'Hosts get a one-tap button to start the last game again, same settings',
      'If the host drops in the lobby, whoever’s there can pick the game',
      'Share your room link straight from your phone’s share sheet',
    ],
  },
  {
    id: '2026-10-12-breaks',
    title: 'Take a break',
    items: [
      'Take a break from the menu: a stand-in plays your turns in UNO and Ludo, so nobody has to wait',
      'Host can give a dropped player another minute, or play on without them, right from the pause screen',
      'Closed the tab by mistake? Open the site again and you’re dropped straight back into your room',
      'Change your look mid-game, and Let’s go takes you back to the table',
      'Leave moved into the menu, with a warning before you forfeit',
      'UNO on phones: bigger cards, a sorted hand, and big hands fold into two rows you can scroll',
      'The card rule tip sits at the bottom so it never hides anyone’s cards',
      'Going out in UNO is now a big moment everyone sees',
      'Reactions are capped at five every ten seconds',
    ],
  },
  {
    id: '2026-10-06-scan',
    title: 'Quicker joining',
    items: [
      'Scanning a room QR takes you straight to dress-up, no extra taps',
      'Smoother scanner: it opens like a shutter and locks on when it finds a code',
      'UNO: you now get a two-second head start to call UNO! before anyone can catch you',
      'The UNO! button only lights up on your last card',
    ],
  },
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
