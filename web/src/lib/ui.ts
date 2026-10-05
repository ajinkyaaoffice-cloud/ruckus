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

const NEUTRAL: Record<string, number | string> = {
  x: 0, y: 0, xPercent: 0, yPercent: 0, rotate: 0, rotation: 0, rotateX: 0, rotateY: 0, skewX: 0, skewY: 0,
  scale: 1, scaleX: 1, scaleY: 1, opacity: 1, autoAlpha: 1,
}
const TWEEN_KEYS = new Set(['duration', 'ease', 'stagger', 'delay', 'scrollTrigger', 'transformOrigin', 'onComplete', 'onStart', 'repeat', 'yoyo'])

/**
 * Split `from()`-style vars into explicit fromTo() pairs. Plain from() tweens
 * read their end state from the DOM, which is wrong when a CSS transition (or
 * an interrupted earlier intro) has the element mid-flight — leaving things
 * frozen at scale 0. Ending on neutral values avoids that.
 */
export function intro(vars: Record<string, any>): [Record<string, any>, Record<string, any>] {
  const from: Record<string, any> = {}
  const to: Record<string, any> = {}
  let transforms = false
  for (const [k, v] of Object.entries(vars)) {
    if (TWEEN_KEYS.has(k)) {
      if (k === 'transformOrigin') from[k] = v
      else to[k] = v
    } else if (k in NEUTRAL) {
      from[k] = v
      to[k] = NEUTRAL[k]
      if (k !== 'opacity' && k !== 'autoAlpha') transforms = true
    } else if (k === 'clipPath') {
      from[k] = v
      to[k] = 'inset(0% 0% 0% 0%)'
    } else {
      from[k] = v
    }
  }
  if (transforms && !vars.scrollTrigger) to.clearProps = 'transform,translate,rotate,scale'
  return [from, to]
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd". */
export function ordinal(n: number): string {
  const t = n % 100
  const suf = t >= 11 && t <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suf}`
}
