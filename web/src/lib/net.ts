import { create } from 'zustand'
import { loadProfile, saveProfile, type Profile } from './profile'
import type { AvatarConfig } from './avatar'
import { toast } from './toast'

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


/** Present on game state while a game is frozen waiting for dropped players. Times are server unix seconds. */
export type PauseInfo = { held: string | null; waiting: { id: string; until: number }[]; resumeAt: number | null; now: number }

/** Host-only room controls. */
export type RoomSettings = {
  locked: boolean
  maxPlayers: number
  anyonePicks: boolean
  pauseOnDrop: boolean
  grace: number
  emotes: boolean
  reel: boolean
}

export type Room = {
  code: string
  host: string | null
  phase: 'lobby' | 'playing'
  players: RoomPlayer[]
  game: { id: string; participants: string[]; over: boolean; options: Record<string, unknown> } | null
  history: HistoryItem[]
  settings: RoomSettings
  banned: { id: string; name: string }[]
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
  emotes: Emote[]
  setProfile: (p: Partial<Profile>) => void
}

export const useNet = create<NetState>((set, get) => ({
  status: 'idle',
  profile: loadProfile(),
  room: null,
  game: null,
  emotes: [],
  setProfile: (patch) => {
    const profile = { ...get().profile, ...patch }
    saveProfile(profile)
    set({ profile })
  },
}))

type Listener = (events: GameEvent[], state: GameState) => void
const listeners = new Set<Listener>()
const reelSkips = new Set<() => void>()
/** The host skipped the winner reel for everyone. */
export function onReelSkip(fn: () => void): () => void {
  reelSkips.add(fn)
  return () => reelSkips.delete(fn)
}
export function onGameEvents(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let ws: WebSocket | null = null
let retry = 0
let pingTimer: number | undefined
let lastHeard = 0
const queue: unknown[] = []
let joinedResolvers: ((code: string | null, err?: string) => void)[] = []

/** Game server origin. Empty when the server also serves this site; set VITE_SERVER_URL when the site is hosted elsewhere (e.g. Vercel). */
export const SERVER = ((import.meta.env.VITE_SERVER_URL as string | undefined) ?? '').replace(/\/$/, '')
export const api = (path: string) => `${SERVER}${path}`

/* Server clock: offset (ms) between the server's clock and ours, taken from the
   fastest ping round trip seen, so countdowns agree on every device. */
let clockOffset = 0
let bestRtt = Infinity
let pingSentAt = 0
export const serverNow = () => Date.now() + clockOffset
function roughClock(serverSec: unknown) {
  if (bestRtt === Infinity && typeof serverSec === 'number') clockOffset = serverSec * 1000 - Date.now()
}

function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined
  if (env) return env
  if (SERVER) return `${SERVER.replace(/^http/, 'ws')}/ws`
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
    pingSentAt = 0
    useNet.setState({ status: 'open' })
    const { profile } = useNet.getState()
    sock.send(JSON.stringify({ t: 'hello', pid: profile.pid, name: profile.name || 'Player', avatar: profile.avatar }))
    while (queue.length) sock.send(JSON.stringify(queue.shift()))
    lastHeard = Date.now()
    clearInterval(pingTimer)
    // a phone that slept can leave a socket that looks open but is dead:
    // ping often, and if the server has gone quiet, start over
    pingTimer = window.setInterval(() => {
      // background tabs still ping (throttled) so the server keeps their seat
      if (!document.hidden && Date.now() - lastHeard > 9000) return reconnect()
      ping()
    }, 3000)
    ping()
  }
  sock.onmessage = (e) => {
    lastHeard = Date.now()
    let msg: any
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    switch (msg.t) {
      case 'pong': {
        const rtt = Date.now() - pingSentAt
        if (pingSentAt && typeof msg.at === 'number' && rtt >= 0 && rtt < 5000) {
          // the server stamped the reply roughly halfway through the round trip
          if (rtt <= bestRtt * 1.25 || bestRtt === Infinity) {
            bestRtt = Math.min(bestRtt, rtt)
            clockOffset = msg.at * 1000 + rtt / 2 - Date.now()
          }
        }
        pingSentAt = 0
        break
      }
      case 'hello':
        if (!msg.room) useNet.setState({ room: null, game: null })
        break
      case 'joined':
        joinedResolvers.forEach((r) => r(msg.code))
        joinedResolvers = []
        break
      case 'room':
        roughClock(msg.room?.now)
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
      case 'skip_reel':
        reelSkips.forEach((f) => f())
        break
      case 'ended':
        toast.info(`${msg.by} ended the game`, { id: 'ended' })
        break
      case 'kicked':
        useNet.setState({ room: null, game: null })
        toast.error('The host removed you from the room')
        break
      case 'error':
        if (joinedResolvers.length) {
          joinedResolvers.forEach((r) => r(null, msg.msg))
          joinedResolvers = []
        }
        toast.error(msg.msg)
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

function ping() {
  if (!pingSentAt) pingSentAt = Date.now()
  send({ t: 'ping' })
}

/** Drop the current socket (even a silently dead one) and dial again now. */
export function reconnect(): void {
  const old = ws
  ws = null
  if (old) {
    old.onclose = null
    old.onmessage = null
    try { old.close() } catch { /* already gone */ }
  }
  clearInterval(pingTimer)
  retry = 0
  connect()
}

/* Coming back to the tab, waking the phone or getting signal back: check the
   line answers within a moment, otherwise reconnect straight away instead of
   waiting for the old socket to time out. */
function wake() {
  if (document.hidden || !ws) return
  if (ws.readyState !== WebSocket.OPEN) return reconnect()
  const asked = Date.now()
  ping()
  window.setTimeout(() => { if (lastHeard < asked) reconnect() }, 2500)
}
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('online', wake)
  window.addEventListener('pageshow', (e) => { if (e.persisted) reconnect() })
}

export function send(msg: unknown): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  else {
    if ((msg as { t?: string })?.t !== 'ping') queue.push(msg)
    connect()
  }
}

function awaitJoin(msg: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const done = (code: string | null, err?: string) => {
      clearTimeout(timer)
      joinedResolvers = joinedResolvers.filter((r) => r !== done)
      if (code) resolve(code)
      else reject(new Error(err || 'Could not join'))
    }
    // the clock only runs once the line is up: a sleeping server can take most of a minute
    // to wake, and the wake-up toast already tells people what's happening
    let timer = 0
    const arm = () => {
      timer = window.setTimeout(() => {
        if (useNet.getState().status !== 'open') return arm()
        done(null, 'The server took too long — try again')
        toast.error('The server took too long — try again')
      }, 8000)
    }
    arm()
    joinedResolvers.push(done)
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
export const configureRoom = (settings: Partial<RoomSettings>) => send({ t: 'settings', settings })
export const kickPlayer = (pid: string) => send({ t: 'kick', pid })
export const makeHost = (pid: string) => send({ t: 'host', pid })
export const pauseGame = () => send({ t: 'hold' })
export const resumeGame = () => send({ t: 'unhold' })
export const endGame = () => send({ t: 'end' })
export const skipReel = () => send({ t: 'skip_reel' })
export const resetScores = () => send({ t: 'reset_scores' })
export const unbanAll = () => send({ t: 'unban' })

export function pushProfile(ready?: boolean): void {
  const { profile } = useNet.getState()
  send({ t: 'profile', name: profile.name || 'Player', avatar: profile.avatar, ready })
}

export async function checkRoom(code: string): Promise<{ exists: boolean; full?: boolean; locked?: boolean }> {
  try {
    const r = await fetch(api(`/api/rooms/${encodeURIComponent(code.toUpperCase())}`))
    return await r.json()
  } catch {
    return { exists: false }
  }
}

/** Index of a player in the room, used to pick their signature colour. */
export function playerColor(room: Room | null, pid: string): string {
  const i = room ? room.players.findIndex((p) => p.id === pid) : 0
  return ['var(--p0)', 'var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'][Math.max(0, i) % 5]
}
export const PLAYER_HEX = ['#e64fe0', '#45b8ff', '#ffb424', '#8a6cff', '#2fbf8f']
export const MAX_PLAYERS = 5
export function playerHex(room: Room | null, pid: string): string {
  const i = room ? room.players.findIndex((p) => p.id === pid) : 0
  return PLAYER_HEX[Math.max(0, i) % PLAYER_HEX.length]
}
