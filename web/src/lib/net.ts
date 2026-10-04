import { create } from 'zustand'
import { loadProfile, saveProfile, type Profile } from './profile'
import type { AvatarConfig } from './avatar'

export type RoomPlayer = {
  id: string
  name: string
  avatar: Partial<AvatarConfig>
  status: 'customizing' | 'ready'
  connected: boolean
  points: number
  wins: number
  played: number
}

export type HistoryItem = { game: string; winners: string[]; tie: boolean; summary: string; at: number }

export type Room = {
  code: string
  host: string | null
  phase: 'lobby' | 'playing'
  players: RoomPlayer[]
  game: { id: string; participants: string[]; over: boolean; options: Record<string, unknown> } | null
  history: HistoryItem[]
}

export type GameResults = {
  ranking: string[][]
  winners: string[]
  summary: string
  details: Record<string, string>
}

export type GameEvent = { kind: string; id: number; [k: string]: any }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameState = { game: string; players: string[]; over: boolean; seq: number; results: GameResults | null; [k: string]: any }

type Emote = { pid: string; emoji: string; key: number }

type NetState = {
  status: 'idle' | 'connecting' | 'open' | 'closed'
  profile: Profile
  room: Room | null
  game: GameState | null
  error: { msg: string; key: number } | null
  emotes: Emote[]
  setProfile: (p: Partial<Profile>) => void
}

export const useNet = create<NetState>((set, get) => ({
  status: 'idle',
  profile: loadProfile(),
  room: null,
  game: null,
  error: null,
  emotes: [],
  setProfile: (patch) => {
    const profile = { ...get().profile, ...patch }
    saveProfile(profile)
    set({ profile })
  },
}))

type Listener = (events: GameEvent[], state: GameState) => void
const listeners = new Set<Listener>()
export function onGameEvents(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let ws: WebSocket | null = null
let retry = 0
let pingTimer: number | undefined
const queue: unknown[] = []
let joinedResolvers: ((code: string | null, err?: string) => void)[] = []

function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined
  if (env) return env
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

export function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  useNet.setState({ status: 'connecting' })
  const sock = new WebSocket(wsUrl())
  ws = sock
  sock.onopen = () => {
    retry = 0
    useNet.setState({ status: 'open' })
    const { profile } = useNet.getState()
    sock.send(JSON.stringify({ t: 'hello', pid: profile.pid, name: profile.name || 'Player', avatar: profile.avatar }))
    while (queue.length) sock.send(JSON.stringify(queue.shift()))
    clearInterval(pingTimer)
    pingTimer = window.setInterval(() => send({ t: 'ping' }), 20000)
  }
  sock.onmessage = (e) => {
    let msg: any
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    switch (msg.t) {
      case 'hello':
        if (!msg.room) useNet.setState({ room: null, game: null })
        break
      case 'joined':
        joinedResolvers.forEach((r) => r(msg.code))
        joinedResolvers = []
        break
      case 'room':
        useNet.setState((s) => ({ room: msg.room, game: msg.room.game ? s.game : null }))
        break
      case 'game': {
        useNet.setState({ game: msg.state })
        if (msg.events?.length) listeners.forEach((l) => l(msg.events, msg.state))
        break
      }
      case 'emote':
        useNet.setState((s) => ({ emotes: [...s.emotes.slice(-12), { pid: msg.pid, emoji: msg.emoji, key: Date.now() + Math.random() }] }))
        break
      case 'left':
        useNet.setState({ room: null, game: null })
        break
      case 'error':
        if (joinedResolvers.length) {
          joinedResolvers.forEach((r) => r(null, msg.msg))
          joinedResolvers = []
        }
        useNet.setState({ error: { msg: msg.msg, key: Date.now() } })
        break
    }
  }
  sock.onclose = () => {
    clearInterval(pingTimer)
    if (ws !== sock) return
    useNet.setState({ status: 'closed' })
    const delay = Math.min(8000, 400 * 2 ** retry++)
    window.setTimeout(connect, delay)
  }
}

export function send(msg: unknown): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  else {
    queue.push(msg)
    connect()
  }
}

function awaitJoin(msg: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    joinedResolvers.push((code, err) => (code ? resolve(code) : reject(new Error(err || 'Could not join'))))
    send(msg)
  })
}

export const createRoom = () => awaitJoin({ t: 'create' })
export const joinRoom = (code: string) => awaitJoin({ t: 'join', code: code.toUpperCase() })
export const leaveRoom = () => send({ t: 'leave' })
export const act = (action: Record<string, unknown>) => send({ t: 'act', action })
export const startGame = (game: string, options: Record<string, unknown> = {}) => send({ t: 'start', game, options })
export const backToLobby = () => send({ t: 'lobby' })
export const rematch = () => send({ t: 'rematch' })
export const emote = (emoji: string) => send({ t: 'emote', emoji })

export function pushProfile(ready?: boolean): void {
  const { profile } = useNet.getState()
  send({ t: 'profile', name: profile.name || 'Player', avatar: profile.avatar, ready })
}

export async function checkRoom(code: string): Promise<{ exists: boolean; full?: boolean }> {
  try {
    const r = await fetch(`/api/rooms/${encodeURIComponent(code.toUpperCase())}`)
    return await r.json()
  } catch {
    return { exists: false }
  }
}

/** Index of a player in the room, used to pick their signature colour. */
export function playerColor(room: Room | null, pid: string): string {
  const i = room ? room.players.findIndex((p) => p.id === pid) : 0
  return ['var(--p0)', 'var(--p1)', 'var(--p2)'][Math.max(0, i) % 3]
}
export const PLAYER_HEX = ['#e64fe0', '#45b8ff', '#ffb424']
export function playerHex(room: Room | null, pid: string): string {
  const i = room ? room.players.findIndex((p) => p.id === pid) : 0
  return PLAYER_HEX[Math.max(0, i) % 3]
}
