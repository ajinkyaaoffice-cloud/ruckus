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
    blurb: 'Full rules: +4 challenges, UNO calls & catches, play on for every place. Classic, Modern, two-sided Flip, or No Mercy with stacking and a 25-card knockout.',
    options: [
      { key: 'modern', label: 'Deck', choices: [{ value: false, label: 'Classic 108' }, { value: true, label: 'Modern 112' }, { value: 'flip', label: 'Flip 112' }, { value: 'mercy', label: 'No Mercy 168' }] },
      { key: 'bluff', label: 'Wild draw bluff', choices: [{ value: 'any', label: 'Any playable card' }, { value: 'color', label: 'Colour only (official)' }] },
    ],
  },
  {
    id: 'ludo', name: 'Ludo', min: 2, max: 4, tag: 'Board', bg: '#43d17a', ink: '#1d3a6e',
    blurb: 'Roll a 6 to get out, race round the board, knock rivals home. Play on for every place.',
    options: [{ key: 'quick', label: 'Race', choices: [{ value: false, label: 'Classic · 4 home' }, { value: true, label: 'Quick · 2 home' }] }],
  },
  {
    id: 'mogul', name: 'Mogul', min: 2, max: 4, tag: 'Board', bg: '#7fd6a8', ink: '#1d3a6e',
    blurb: 'Buy streets, charge rent, build hotels and trade your way to a fortune. Full property-game rules, best with three.',
    options: [{ key: 'length', label: 'Game length', choices: [{ value: 0, label: 'Classic · last one standing' }, { value: 60, label: '60 min · richest wins' }, { value: 30, label: '30 min · richest wins' }] }],
  },
  { id: 'tictactoe', name: 'Tic Tac Toe', min: 2, max: 2, tag: 'Classic', bg: '#e64fe0', ink: '#ffffff',
    blurb: 'Brush-stroke Xs and Os. Three in a row, no mercy.' },
  { id: 'dots', name: 'Dots & Boxes', min: 2, max: 3, tag: 'Strategy', bg: '#d9f66b', ink: '#1d3a6e',
    blurb: 'Draw lines, close boxes, steal extra turns. Chain reactions welcome.' },
  { id: 'seabattle', name: 'Sea Battle', min: 2, max: 2, tag: 'Strategy', bg: '#3d8bff', ink: '#ffffff',
    blurb: 'Hide your fleet, hunt theirs. A hit lets you fire again.' },
  { id: 'quickdraw', name: 'Quick Draw', min: 2, max: 5, tag: 'Reflex', bg: '#ffc93c', ink: '#1d3a6e',
    blurb: 'Wait for DRAW… then tap first. Jump the gun and you foul out.' },
]

export const gameMeta = (id: string | undefined) => CATALOG.find((g) => g.id === id)
