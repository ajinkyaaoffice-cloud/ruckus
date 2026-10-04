import { create } from 'zustand'
import type Lenis from 'lenis'

/** Site-wide UI state: the full-screen menu. */
export const useUi = create<{ menu: boolean; setMenu: (open: boolean) => void }>((set) => ({
  menu: false,
  setMenu: (menu) => set({ menu }),
}))

/* The landing page registers its Lenis instance here so menus can scroll with it. */
let lenis: Lenis | null = null
export function setLenis(l: Lenis | null) {
  lenis = l
}
export function scrollToTarget(target: string | number) {
  if (lenis) lenis.scrollTo(target, { duration: 1.4 })
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' })
  else document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
}
export function lockScroll(lock: boolean) {
  if (lenis) (lock ? lenis.stop() : lenis.start())
  document.documentElement.style.overflow = lock ? 'hidden' : ''
}

/** Ask the physics cursor to throw confetti at a point. */
export function confetti(x: number, y: number, n = 24) {
  window.dispatchEvent(new CustomEvent('ruckus:confetti', { detail: { x, y, n } }))
}
