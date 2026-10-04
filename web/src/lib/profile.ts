import { normalizeAvatar, randomAvatar, type AvatarConfig } from './avatar'

/**
 * The player's identity & look persist in a cookie (so it survives cache
 * clears of localStorage-only setups and is readable on first paint) and are
 * mirrored to localStorage as a fallback for very long values.
 */
export type Profile = { pid: string; name: string; avatar: AvatarConfig; customized: boolean }

const COOKIE = 'ruckus_profile'
const LS = 'ruckus.profile'
const MAX_AGE = 60 * 60 * 24 * 365

function newId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function readCookie(): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

/* Each browser tab is its own player. The look (name, avatar) is shared
   through the cookie, but the id is claimed per tab: a tab keeps its id in
   sessionStorage across reloads, and a live tab heartbeats a lock so a second
   tab (or a duplicated one) notices and takes a fresh id instead of stealing
   the first tab's seat and socket. */
const TAB = 'ruckus.tabpid'
const LOCK = (pid: string) => `ruckus.live.${pid}`
const me = newId()
let basePid = ''

function lockedByOther(pid: string): boolean {
  try {
    const raw = localStorage.getItem(LOCK(pid))
    if (!raw) return false
    const { tab, t } = JSON.parse(raw)
    return tab !== me && Date.now() - t < 5000
  } catch {
    return false
  }
}

function claim(pid: string): string {
  let mine = pid
  try {
    mine = sessionStorage.getItem(TAB) || pid
    if (lockedByOther(mine)) mine = newId()
    sessionStorage.setItem(TAB, mine)
    const beat = () => localStorage.setItem(LOCK(mine), JSON.stringify({ tab: me, t: Date.now() }))
    beat()
    window.setInterval(beat, 2000)
    // released on reload/close so the same tab gets its id straight back
    window.addEventListener('pagehide', () => localStorage.removeItem(LOCK(mine)))
    window.addEventListener('pageshow', beat)
  } catch {
    /* storage blocked: fall back to the shared id */
  }
  return mine
}

export function loadProfile(): Profile {
  const p = loadShared()
  basePid = p.pid
  return { ...p, pid: claim(p.pid) }
}

function loadShared(): Profile {
  let raw: string | null = readCookie()
  try {
    raw = raw ?? localStorage.getItem(LS)
  } catch {
    /* storage blocked */
  }
  if (raw) {
    try {
      const p = JSON.parse(raw)
      if (typeof p.pid === 'string' && p.pid.length >= 8) {
        return {
          pid: p.pid,
          name: typeof p.name === 'string' ? p.name : '',
          avatar: normalizeAvatar(p.avatar),
          customized: !!p.customized,
        }
      }
    } catch {
      /* corrupt cookie; start fresh */
    }
  }
  const fresh: Profile = { pid: newId(), name: '', avatar: randomAvatar(), customized: false }
  saveProfile(fresh)
  return fresh
}

export function saveProfile(p: Profile): void {
  // the shared record keeps the browser's original id; tab ids stay per tab
  const raw = JSON.stringify({ ...p, pid: basePid || p.pid })
  document.cookie = `${COOKIE}=${encodeURIComponent(raw)}; max-age=${MAX_AGE}; path=/; samesite=lax`
  try {
    localStorage.setItem(LS, raw)
  } catch {
    /* storage blocked */
  }
}
