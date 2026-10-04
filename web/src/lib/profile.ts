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

export function loadProfile(): Profile {
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
  const raw = JSON.stringify(p)
  document.cookie = `${COOKIE}=${encodeURIComponent(raw)}; max-age=${MAX_AGE}; path=/; samesite=lax`
  try {
    localStorage.setItem(LS, raw)
  } catch {
    /* storage blocked */
  }
}
