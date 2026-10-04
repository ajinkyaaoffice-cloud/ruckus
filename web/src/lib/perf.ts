/**
 * Performance switches. Phones get native scrolling, no custom cursor, fewer
 * filters and a single shared 30 fps loop for ambient animation (avatars
 * swaying, the mascot wobbling) instead of one rAF per element.
 */
const mq = (q: string) => typeof window !== 'undefined' && window.matchMedia?.(q).matches
export const isTouch = !!mq('(pointer: coarse)') || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !mq('(pointer: fine)'))
export const reducedMotion = !!mq('(prefers-reduced-motion: reduce)')
export const lowPower = isTouch || reducedMotion

if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('low-power', lowPower)
  document.documentElement.classList.toggle('touch', isTouch)
}

type Fn = (t: number) => void
const subs = new Set<Fn>()
let raf = 0
let last = 0
const minGap = lowPower ? 1000 / 30 - 2 : 0

function tick(t: number) {
  raf = subs.size ? requestAnimationFrame(tick) : 0
  if (t - last < minGap) return
  last = t
  subs.forEach((fn) => fn(t))
}

/** Subscribe to the shared ambient-animation loop. Returns an unsubscribe. */
export function onFrame(fn: Fn): () => void {
  subs.add(fn)
  if (!raf) raf = requestAnimationFrame(tick)
  return () => { subs.delete(fn) }
}

/** Track whether an element is on screen (cheap; drives pausing offscreen loops). */
export function watchVisible(el: Element, cb: (v: boolean) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') { cb(true); return () => {} }
  const io = new IntersectionObserver((es) => cb(es[es.length - 1].isIntersecting), { rootMargin: '80px' })
  io.observe(el)
  return () => io.disconnect()
}
