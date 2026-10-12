/**
 * Crews: a friend group's permanent room. The link /c/NAME always lands in the
 * same room (the server opens it for whoever arrives first), so a group can pin
 * it in their chat or on their home screen and skip codes and QR scans.
 * This browser also remembers its crew and the last game it started.
 */
const CREW = 'ruckus.crew'
const LAST = 'ruckus.lastGame'

/** One-off rooms have four-letter codes; crews are longer. */
export const isCrew = (code: string) => code.length > 4
export const crewSlug = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, v: string | null): void {
  try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, v) } catch { /* storage blocked */ }
}

export const savedCrew = () => read(CREW)
export const saveCrew = (code: string | null) => write(CREW, code)

export type LastGame = { id: string; options: Record<string, unknown> }
export function lastGame(): LastGame | null {
  try {
    const g = JSON.parse(read(LAST) ?? 'null')
    return g && typeof g.id === 'string' ? { id: g.id, options: g.options ?? {} } : null
  } catch {
    return null
  }
}
export const saveLastGame = (g: LastGame) => write(LAST, JSON.stringify(g))
