/** Tiny WebAudio synth so the whole site has sound without shipping audio files. */
let ctx: AudioContext | null = null
let muted = (() => {
  try {
    return localStorage.getItem('ruckus.muted') === '1'
  } catch {
    return false
  }
})()
const subs = new Set<(m: boolean) => void>()

function ac(): AudioContext | null {
  if (muted) return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, slide = 0, delay = 0) {
  const a = ac()
  if (!a) return
  const t = a.currentTime + delay
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(dur: number, vol = 0.08, hp = 800, delay = 0) {
  const a = ac()
  if (!a) return
  const t = a.currentTime + delay
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = hp
  const g = a.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(a.destination)
  src.start(t)
}

export const sfx = {
  click: () => tone(520, 0.08, 'triangle', 0.1, 260),
  hover: () => tone(880, 0.05, 'sine', 0.035),
  pop: () => tone(300, 0.12, 'sine', 0.16, 500),
  whoosh: () => noise(0.45, 0.07, 1200),
  slam: () => {
    tone(110, 0.25, 'square', 0.08, -60)
    noise(0.18, 0.1, 300)
  },
  place: () => {
    tone(420, 0.09, 'triangle', 0.13, -120)
    noise(0.06, 0.05, 2400)
  },
  card: () => noise(0.12, 0.09, 2600),
  bad: () => tone(180, 0.22, 'sawtooth', 0.06, -60),
  tick: () => tone(1200, 0.03, 'square', 0.03),
  hit: (p = 0.5) => tone(380 + p * 400, 0.07, 'square', 0.07),
  wall: () => tone(240, 0.05, 'triangle', 0.06),
  point: () => [660, 880].forEach((f, i) => tone(f, 0.12, 'triangle', 0.1, 0, i * 0.08)),
  pad: (i: number) => tone([262, 330, 392, 466, 523, 622][i % 6], 0.28, 'triangle', 0.14),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, 0, i * 0.11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.26, 'sine', 0.1, 0, i * 0.14)),
  uno: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.14, 'square', 0.06, 0, i * 0.06)),
}

export function isMuted() {
  return muted
}
export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem('ruckus.muted', m ? '1' : '0')
  } catch {
    /* ignore */
  }
  subs.forEach((s) => s(m))
}
export function onMuted(fn: (m: boolean) => void) {
  subs.add(fn)
  return () => subs.delete(fn)
}
