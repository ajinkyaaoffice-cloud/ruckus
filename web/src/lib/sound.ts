/**
 * Tiny WebAudio sound kit — no audio files.
 *
 * Everything is built from three soft voices: a marimba-ish pluck (sine +
 * quickly-decaying 4th harmonic), a bubbly pitch-glide "blip", and a filtered
 * air sweep. They all run through a gentle compressor and a short generated
 * reverb so the site sounds round and toy-like rather than beepy.
 */
let ctx: AudioContext | null = null
let bus: GainNode | null = null
let verb: GainNode | null = null
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
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 4
    const master = ctx.createGain()
    master.gain.value = 0.55
    comp.connect(master).connect(ctx.destination)
    bus = ctx.createGain()
    bus.connect(comp)
    // short airy room: decaying stereo noise impulse
    const len = Math.floor(ctx.sampleRate * 1.6)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
    }
    const conv = ctx.createConvolver()
    conv.buffer = ir
    verb = ctx.createGain()
    verb.gain.value = 0.22
    verb.connect(conv).connect(comp)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function out(a: AudioContext, node: AudioNode, wet = 1) {
  node.connect(bus!)
  if (wet > 0) {
    const s = a.createGain()
    s.gain.value = wet
    node.connect(s).connect(verb!)
  }
}

function env(a: AudioContext, t: number, vol: number, attack: number, decay: number): GainNode {
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  return g
}

/** Marimba-like pluck. */
function pluck(freq: number, { vol = 0.14, decay = 0.5, delay = 0, wet = 0.6 } = {}) {
  const a = ac()
  if (!a) return
  const t = a.currentTime + delay
  const g = env(a, t, vol, 0.004, decay)
  const o = a.createOscillator()
  o.frequency.value = freq
  o.connect(g)
  const g2 = env(a, t, vol * 0.35, 0.002, decay * 0.18)
  const o2 = a.createOscillator()
  o2.frequency.value = freq * 4
  o2.connect(g2)
  out(a, g, wet)
  out(a, g2, wet * 0.5)
  o.start(t); o2.start(t)
  o.stop(t + decay + 0.05); o2.stop(t + decay + 0.05)
}

/** Bubbly pitch glide. */
function blip(from: number, to: number, { vol = 0.12, dur = 0.12, delay = 0, type = 'sine' as OscillatorType, wet = 0.3 } = {}) {
  const a = ac()
  if (!a) return
  const t = a.currentTime + delay
  const o = a.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8)
  const g = env(a, t, vol, 0.006, dur)
  o.connect(g)
  out(a, g, wet)
  o.start(t)
  o.stop(t + dur + 0.05)
}

let noiseBuf: AudioBuffer | null = null
/** Band-passed air sweep (from → to Hz). */
function air(from: number, to: number, { vol = 0.1, dur = 0.5, delay = 0, q = 1.4, wet = 0.5 } = {}) {
  const a = ac()
  if (!a) return
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t = a.currentTime + delay
  const src = a.createBufferSource()
  src.buffer = noiseBuf
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.55)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g)
  out(a, g, wet)
  src.start(t, Math.random())
  src.stop(t + dur + 0.05)
}

/** Soft round thump. */
function thump(vol = 0.22, delay = 0) {
  blip(160, 48, { vol, dur: 0.22, delay, wet: 0.1 })
}

// C major pentatonic, a few octaves — everything "musical" picks from here.
const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5, 1568]
const pick = () => PENTA[5 + Math.floor(Math.random() * 7)]

let lastHover = 0

export const sfx = {
  hover: () => {
    const n = performance.now()
    if (n - lastHover < 70) return
    lastHover = n
    pluck(PENTA[10 + Math.floor(Math.random() * 4)], { vol: 0.025, decay: 0.12, wet: 0.3 })
  },
  click: () => { blip(520, 820, { vol: 0.09, dur: 0.08 }); pluck(1046.5, { vol: 0.05, decay: 0.2, delay: 0.02 }) },
  tap: () => blip(pick(), pick() * 1.5, { vol: 0.06, dur: 0.09, wet: 0.4 }),
  pop: () => blip(320, 980, { vol: 0.12, dur: 0.11 }),
  /** page transition: strokes paint in */
  whoosh: () => {
    air(260, 2400, { vol: 0.09, dur: 0.6 })
    ;[523.3, 659.3, 784].forEach((f, i) => pluck(f, { vol: 0.045, decay: 0.35, delay: 0.1 + i * 0.07 }))
  },
  /** page transition: label lands */
  slam: () => {
    thump(0.2)
    ;[392, 523.3, 659.3, 987.8].forEach((f) => pluck(f, { vol: 0.055, decay: 0.9, wet: 0.8 }))
  },
  /** page transition: strokes wipe away */
  unwhoosh: () => air(2600, 300, { vol: 0.07, dur: 0.55 }),
  place: () => { pluck(440, { vol: 0.13, decay: 0.3 }); thump(0.1) },
  card: () => { air(2200, 4200, { vol: 0.06, dur: 0.1, q: 0.8, wet: 0.1 }); pluck(1568, { vol: 0.02, decay: 0.08 }) },
  bad: () => { pluck(233, { vol: 0.12, decay: 0.3, wet: 0.2 }); pluck(220, { vol: 0.1, decay: 0.35, delay: 0.09, wet: 0.2 }) },
  tick: () => pluck(1760, { vol: 0.03, decay: 0.05, wet: 0 }),
  hit: (p = 0.5) => { pluck(440 + p * 440, { vol: 0.13, decay: 0.18, wet: 0.2 }); thump(0.08) },
  wall: () => pluck(293.7, { vol: 0.07, decay: 0.12, wet: 0.2 }),
  point: () => [659.3, 987.8].forEach((f, i) => pluck(f, { vol: 0.11, decay: 0.4, delay: i * 0.08 })),
  pad: (i: number) => pluck([261.6, 329.6, 392, 440, 523.3, 659.3][i % 6], { vol: 0.17, decay: 0.55 }),
  win: () => [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => pluck(f, { vol: 0.12, decay: 0.8, delay: i * 0.09, wet: 0.9 })),
  lose: () => [440, 392, 329.6, 261.6].forEach((f, i) => pluck(f, { vol: 0.09, decay: 0.6, delay: i * 0.13 })),
  uno: () => { [784, 1046.5, 1318.5].forEach((f, i) => pluck(f, { vol: 0.12, decay: 0.4, delay: i * 0.05 })); blip(400, 1400, { vol: 0.06, dur: 0.18 }) },
  open: () => { air(300, 1800, { vol: 0.06, dur: 0.35 }); [523.3, 784].forEach((f, i) => pluck(f, { vol: 0.06, decay: 0.3, delay: 0.05 + i * 0.06 })) },
  close: () => { air(1800, 300, { vol: 0.05, dur: 0.3 }); pluck(392, { vol: 0.05, decay: 0.25, delay: 0.05 }) },
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
  if (m && ctx) void ctx.suspend()
  subs.forEach((s) => s(m))
}
export function onMuted(fn: (m: boolean) => void) {
  subs.add(fn)
  return () => subs.delete(fn)
}
