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
    id: 'uno', name: 'UNO', min: 2, max: 5, tag: 'Cards', bg: '#ff9a62', ink: '#1d3a6e',
    blurb: 'Full rules: +4 challenges, UNO calls & catches, play on for every place. Classic, Modern or the two-sided Flip deck.',
    options: [
      { key: 'modern', label: 'Deck', choices: [{ value: false, label: 'Classic 108' }, { value: true, label: 'Modern 112' }, { value: 'flip', label: 'Flip 112' }] },
      { key: 'bluff', label: 'Wild draw bluff', choices: [{ value: 'any', label: 'Any playable card' }, { value: 'color', label: 'Colour only (official)' }] },
    ],
  },
  {
    id: 'ludo', name: 'Ludo', min: 2, max: 4, tag: 'Board', bg: '#43d17a', ink: '#1d3a6e',
    blurb: 'Roll a 6 to get out, race round the board, knock rivals home. Play on for every place.',
    options: [{ key: 'quick', label: 'Race', choices: [{ value: false, label: 'Classic · 4 home' }, { value: true, label: 'Quick · 2 home' }] }],
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
  { id: 'seabattle', name: 'Sea Battle', min: 2, max: 2, tag: 'Strategy', bg: '#3d8bff', ink: '#ffffff',
    blurb: 'Hide your fleet, hunt theirs. A hit lets you fire again.' },
  { id: 'checkers', name: 'Checkers', min: 2, max: 2, tag: 'Classic', bg: '#ff5d73', ink: '#ffffff',
    blurb: 'Forced jumps, chain captures, crowned kings. The real rules.' },
  { id: 'reversi', name: 'Reversi', min: 2, max: 2, tag: 'Strategy', bg: '#2fbf8f', ink: '#ffffff',
    blurb: 'Trap their discs between yours and flip them to your colour.' },
  { id: 'cycles', name: 'Light Cycles', min: 2, max: 5, tag: 'Realtime', bg: '#132a52', ink: '#d9f66b',
    blurb: 'Neon bikes leave walls behind them. Last rider moving wins the round.' },
  { id: 'quickdraw', name: 'Quick Draw', min: 2, max: 5, tag: 'Reflex', bg: '#ffc93c', ink: '#1d3a6e',
    blurb: 'Wait for DRAW… then tap first. Jump the gun and you foul out.' },
  { id: 'showdown', name: 'Showdown', min: 2, max: 5, tag: 'Party', bg: '#ff9ad5', ink: '#1d3a6e',
    blurb: 'Rock, paper, scissors for the whole room. Beat as many as you can.' },
  { id: 'quickmaths', name: 'Quick Maths', min: 2, max: 5, tag: 'Brain race', bg: '#7ee0c3', ink: '#1d3a6e',
    blurb: 'A sum and four answers. First right tap scores; a wrong one locks you out.' },
]

export const gameMeta = (id: string | undefined) => CATALOG.find((g) => g.id === id)
