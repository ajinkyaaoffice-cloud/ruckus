export type GameMeta = {
  id: string
  name: string
  min: number
  max: number
  tag: string
  blurb: string
  bg: string
  ink: string
  options?: { key: string; label: string; choices: { value: string | number | boolean; label: string }[] }[]
}

export const CATALOG: GameMeta[] = [
  {
    id: 'uno', name: 'UNO', min: 2, max: 3, tag: 'Cards', bg: '#ff9a62', ink: '#1d3a6e',
    blurb: 'Full official rules: +4 challenges, UNO calls & catches, start-card twists, real scoring.',
    options: [{ key: 'modern', label: 'Deck', choices: [{ value: false, label: 'Classic 108' }, { value: true, label: 'Modern 112' }] }],
  },
  { id: 'pong', name: 'Ping Pong', min: 2, max: 2, tag: 'Realtime', bg: '#a7ecff', ink: '#1d3a6e',
    blurb: 'Sixty-frame server-synced rallies. Angle shots off the paddle edge, flick for spin.',
    options: [{ key: 'target', label: 'Play to', choices: [{ value: 5, label: '5' }, { value: 7, label: '7' }, { value: 11, label: '11' }] }],
  },
  { id: 'tictactoe', name: 'Tic Tac Toe', min: 2, max: 2, tag: 'Classic', bg: '#e64fe0', ink: '#ffffff',
    blurb: 'Brush-stroke Xs and Os. Three in a row, no mercy.' },
  { id: 'connect4', name: 'Connect Four', min: 2, max: 2, tag: 'Strategy', bg: '#1d3a6e', ink: '#ffffff',
    blurb: 'Drop discs, stack traps, line up four before they do.' },
  { id: 'dots', name: 'Dots & Boxes', min: 2, max: 3, tag: 'Strategy', bg: '#d9f66b', ink: '#1d3a6e',
    blurb: 'Draw lines, close boxes, steal extra turns. Chain reactions welcome.' },
  { id: 'memory', name: 'Memory Match', min: 2, max: 3, tag: 'Memory', bg: '#a596ff', ink: '#ffffff',
    blurb: 'Flip pairs of glyph cards. Find a match and you go again.' },
  { id: 'oddone', name: 'Odd One Out', min: 2, max: 3, tag: 'IQ race', bg: '#ffb424', ink: '#1d3a6e',
    blurb: 'Spot the glyph that is a little bit wrong — before your friends do.' },
  { id: 'echo', name: 'Echo', min: 2, max: 3, tag: 'Memory', bg: '#fad6fb', ink: '#1d3a6e',
    blurb: 'Watch the pads glow, then echo the pattern back. It grows every round.' },
]

export const gameMeta = (id: string | undefined) => CATALOG.find((g) => g.id === id)
