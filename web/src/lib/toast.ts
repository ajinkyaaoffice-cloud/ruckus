import { create } from 'zustand'

export type ToastKind = 'error' | 'info' | 'success' | 'warn'
export type Toast = {
  id: string
  kind: ToastKind
  msg: string
  /** milliseconds before it leaves on its own; 0 = stays until dismissed or replaced */
  ttl: number
  /** bumped when the same message fires again, so its timer restarts */
  rev: number
}

const TTL: Record<ToastKind, number> = { error: 4200, warn: 5000, info: 3200, success: 2600 }
const MAX = 3

type Store = { items: Toast[]; push: (t: Toast) => void; dismiss: (id: string) => void }

export const useToasts = create<Store>((set) => ({
  items: [],
  push: (t) => set((s) => {
    const i = s.items.findIndex((x) => x.id === t.id)
    if (i >= 0) {
      const items = s.items.slice()
      items[i] = { ...t, rev: s.items[i].rev + 1 }
      return { items }
    }
    // the oldest timed toast makes room when the stack is full
    let items = [...s.items, t]
    while (items.length > MAX) {
      const drop = items.findIndex((x) => x.ttl > 0)
      items = items.filter((_, k) => k !== (drop < 0 ? 0 : drop))
    }
    return { items }
  }),
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}))

type Opts = { id?: string; ttl?: number }

function show(kind: ToastKind, msg: string, o: Opts = {}) {
  // identical messages collapse into one toast instead of stacking
  const id = o.id ?? `${kind}:${msg}`
  useToasts.getState().push({ id, kind, msg, ttl: o.ttl ?? TTL[kind], rev: 0 })
  return id
}

export const toast = {
  error: (msg: string, o?: Opts) => show('error', msg, o),
  warn: (msg: string, o?: Opts) => show('warn', msg, o),
  info: (msg: string, o?: Opts) => show('info', msg, o),
  success: (msg: string, o?: Opts) => show('success', msg, o),
  dismiss: (id: string) => useToasts.getState().dismiss(id),
}
