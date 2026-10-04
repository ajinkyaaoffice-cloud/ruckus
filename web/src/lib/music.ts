import { serverNow, type MusicState } from './net'

/** The room's party playlist: YouTube video ids, all checked to allow embedding. */
export type Track = { id: string; title: string; artist: string; len: number }

export const PLAYLIST: Track[] = [
  { id: 'ekr2nIex040', title: 'APT.', artist: 'ROSÉ & Bruno Mars', len: 173 },
  { id: 'TUVcZfQe-Kw', title: 'Levitating', artist: 'Dua Lipa', len: 227 },
  { id: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', len: 271 },
  { id: 'oygrmJFKYZY', title: 'Don’t Start Now', artist: 'Dua Lipa', len: 183 },
  { id: 'UqyT8IEBkvY', title: '24K Magic', artist: 'Bruno Mars', len: 227 },
  { id: 'suAR1PYFNYA', title: 'Houdini', artist: 'Dua Lipa', len: 185 },
  { id: 'kPa7bsKwL-c', title: 'Die With A Smile', artist: 'Lady Gaga & Bruno Mars', len: 252 },
  { id: 'k2qgadSvNyU', title: 'New Rules', artist: 'Dua Lipa', len: 225 },
  { id: 'PMivT7MJ41M', title: 'That’s What I Like', artist: 'Bruno Mars', len: 210 },
  { id: 'OiC1rgCPmUQ', title: 'Dance The Night', artist: 'Dua Lipa', len: 177 },
  { id: 'DkeiKbqa02g', title: 'One Kiss', artist: 'Calvin Harris & Dua Lipa', len: 225 },
  { id: '9HDEHj2yzew', title: 'Physical', artist: 'Dua Lipa', len: 238 },
  { id: 'qod03PVTLqk', title: 'Cold Heart', artist: 'Elton John & Dua Lipa', len: 204 },
]

export const trackOf = (id: string | null | undefined) => PLAYLIST.find((t) => t.id === id)
export const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

function step(id: string | null | undefined, by: number) {
  const i = PLAYLIST.findIndex((t) => t.id === id)
  return PLAYLIST[(Math.max(0, i) + by + PLAYLIST.length) % PLAYLIST.length].id
}
export const nextAfter = (id: string | null | undefined) => (id ? step(id, 1) : PLAYLIST[0].id)
export const prevBefore = (id: string | null | undefined) => step(id, -1)

/** Where the shared song should be right now, in seconds. */
export function targetPos(m: MusicState): number {
  return m.playing ? m.pos + Math.max(0, serverNow() - m.at * 1000) / 1000 : m.pos
}

export const fmtTime = (s: number) => {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/* ---- YouTube IFrame API (loaded once, on demand) ---- */
export type YTPlayer = {
  loadVideoById(o: { videoId: string; startSeconds?: number }): void
  cueVideoById(o: { videoId: string; startSeconds?: number }): void
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(s: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setVolume(v: number): void
  mute(): void
  unMute(): void
  isMuted(): boolean
  destroy(): void
}
type YTNS = { Player: new (el: HTMLElement, o: Record<string, unknown>) => YTPlayer }
declare global { interface Window { YT?: YTNS; onYouTubeIframeAPIReady?: () => void } }

let loading: Promise<YTNS> | null = null
export function loadYouTube(): Promise<YTNS> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!) }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => { loading = null; reject(new Error('YouTube failed to load')) }
    document.head.appendChild(s)
  })
  return loading
}

/** YT.PlayerState */
export const YS = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const
