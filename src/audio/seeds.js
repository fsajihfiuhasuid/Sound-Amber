import { analyseSamples, encodeWav } from './analysis'

const SAMPLE_RATE = 22050

function mulberry32(seed) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeBuffer(duration) {
  const length = Math.floor(duration * SAMPLE_RATE)
  return new Float32Array(length)
}

function softClip(samples) {
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = Math.tanh(samples[i])
  }
}

function normalise(samples, target = 0.82) {
  let peak = 0
  for (let i = 0; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i]))
  if (!peak) return
  const gain = target / peak
  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain
}

function fadeEdges(samples, fadeSeconds = 0.15) {
  const fade = Math.floor(fadeSeconds * SAMPLE_RATE)
  for (let i = 0; i < fade; i += 1) {
    const gain = i / fade
    samples[i] *= gain
    samples[samples.length - 1 - i] *= gain
  }
}

function addDroplets(samples, random, count, density = 1) {
  for (let d = 0; d < count; d += 1) {
    const start = Math.floor(random() * samples.length)
    const length = Math.floor((0.005 + random() * 0.05) * SAMPLE_RATE)
    const freq = 1400 + random() * 5200
    const amp = (0.015 + random() * 0.06) * density
    const decay = 55 + random() * 120
    for (let i = 0; i < length && start + i < samples.length; i += 1) {
      const t = i / SAMPLE_RATE
      samples[start + i] += Math.sin(2 * Math.PI * freq * t) * Math.exp(-decay * t) * amp
    }
  }
}

function makeRain() {
  const duration = 8.5
  const samples = makeBuffer(duration)
  const random = mulberry32(101)
  let brown = 0
  let lastWhite = 0
  for (let i = 0; i < samples.length; i += 1) {
    const t = i / SAMPLE_RATE
    const white = random() * 2 - 1
    brown = brown * 0.9965 + white * 0.018
    const high = white - lastWhite * 0.92
    lastWhite = white
    const body = brown * 2.6 + high * 0.16
    const gust = 0.72 + 0.28 * Math.sin(t * 0.55 + 1.2) + 0.12 * Math.sin(t * 1.9)
    samples[i] = body * gust
  }
  addDroplets(samples, random, 54, 0.9)
  // A distant, soft thunder roll.
  for (let i = 0; i < samples.length; i += 1) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-Math.max(0, t - 2.4) * 1.5) * (t > 2.4 ? 1 : 0)
    samples[i] += Math.sin(2 * Math.PI * 41 * t) * env * 0.08
  }
  softClip(samples)
  normalise(samples, 0.74)
  fadeEdges(samples, 0.3)
  return { samples, duration }
}

function makeBirds() {
  const duration = 7.6
  const samples = makeBuffer(duration)
  const random = mulberry32(202)
  let brown = 0
  for (let i = 0; i < samples.length; i += 1) {
    const t = i / SAMPLE_RATE
    const white = random() * 2 - 1
    brown = brown * 0.997 + white * 0.014
    samples[i] = brown * 1.7 + Math.sin(2 * Math.PI * 180 * t) * 0.002
  }
  const chirps = [
    [0.55, 2400, 3300, 0.16, 0.16],
    [0.82, 2600, 3450, 0.14, 0.12],
    [1.35, 1950, 2700, 0.22, 0.2],
    [1.62, 2100, 2900, 0.18, 0.14],
    [2.7, 3000, 3900, 0.12, 0.11],
    [3.05, 3100, 3800, 0.1, 0.08],
    [4.2, 2200, 2500, 0.26, 0.18],
    [4.55, 2450, 2900, 0.2, 0.13],
    [5.8, 2700, 3600, 0.15, 0.1],
    [6.15, 2850, 3700, 0.13, 0.08],
  ]
  chirps.forEach(([start, from, to, length, amp], index) => {
    const attack = 0.012
    const total = Math.floor(length * SAMPLE_RATE)
    for (let i = 0; i < total; i += 1) {
      const p = i / total
      const t = i / SAMPLE_RATE
      const env = Math.min(1, t / attack) * Math.pow(1 - p, 1.8)
      const freq = from + (to - from) * p + Math.sin(2 * Math.PI * 38 * t) * 90
      const value =
        Math.sin(2 * Math.PI * freq * t) * 0.8 +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.18
      const at = Math.floor(start * SAMPLE_RATE) + i
      if (at < samples.length) samples[at] += value * env * amp
      // A little air between the trees.
      const echo = at + Math.floor(0.19 * SAMPLE_RATE)
      if (echo < samples.length && index % 2 === 0) {
        samples[echo] += value * env * amp * 0.16
      }
    }
  })
  normalise(samples, 0.68)
  fadeEdges(samples, 0.25)
  return { samples, duration }
}

function makeSubway() {
  const duration = 9.2
  const samples = makeBuffer(duration)
  const random = mulberry32(303)
  let brown = 0
  for (let i = 0; i < samples.length; i += 1) {
    const t = i / SAMPLE_RATE
    const white = random() * 2 - 1
    brown = brown * 0.9985 + white * 0.02
    const approach = Math.min(1, t / 2.4) * (1 - Math.max(0, t - 7.4) / 1.8)
    const rumble = Math.sin(2 * Math.PI * 47 * t + Math.sin(t * 2.1)) * 0.14
    const rumble2 = Math.sin(2 * Math.PI * 94 * t) * 0.05
    samples[i] = brown * 3.4 * approach + (rumble + rumble2) * Math.max(0, approach)
    // Rail clacks.
    const clackPhase = (t % 0.72) / 0.72
    if (clackPhase < 0.035) {
      const env = 1 - clackPhase / 0.035
      samples[i] += (random() * 2 - 1) * env * 0.1 + Math.sin(2 * Math.PI * 130 * t) * env * 0.08
    }
  }
  // Brake squeal.
  const squealStart = 5.6
  for (let i = Math.floor(squealStart * SAMPLE_RATE); i < samples.length; i += 1) {
    const t = i / SAMPLE_RATE - squealStart
    const env = Math.min(1, t / 0.4) * Math.exp(-Math.max(0, t - 1.5) * 1.5)
    const freq = 2100 + Math.sin(2 * Math.PI * 3.2 * t) * 160 + t * 40
    samples[i] += Math.sin(2 * Math.PI * freq * t) * env * 0.045
  }
  // Door chime at the end.
  const chimeStart = 7.55
  const notes = [
    [659.25, 0],
    [554.37, 0.32],
  ]
  notes.forEach(([freq, delay]) => {
    const start = Math.floor((chimeStart + delay) * SAMPLE_RATE)
    for (let i = 0; i < SAMPLE_RATE * 0.7 && start + i < samples.length; i += 1) {
      const t = i / SAMPLE_RATE
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 4.2)
      samples[start + i] +=
        (Math.sin(2 * Math.PI * freq * t) * 0.9 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.1) *
        env *
        0.16
    }
  })
  softClip(samples)
  normalise(samples, 0.78)
  fadeEdges(samples, 0.4)
  return { samples, duration }
}

function makeFan() {
  const duration = 7.2
  const samples = makeBuffer(duration)
  const random = mulberry32(404)
  let airflow = 0
  for (let i = 0; i < samples.length; i += 1) {
    const t = i / SAMPLE_RATE
    const white = random() * 2 - 1
    airflow = airflow * 0.985 + white * 0.045
    const wobble = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.27 * t)
    const hum =
      Math.sin(2 * Math.PI * 98 * t) * 0.16 +
      Math.sin(2 * Math.PI * 196 * t) * 0.07 +
      Math.sin(2 * Math.PI * 294 * t) * 0.025
    samples[i] = (hum + airflow * 0.42) * wobble
    const tickPhase = (t + 0.18) % 0.86
    if (tickPhase < 0.018) {
      const env = 1 - tickPhase / 0.018
      samples[i] += (random() * 2 - 1) * env * 0.09
    }
  }
  normalise(samples, 0.62)
  fadeEdges(samples, 0.3)
  return { samples, duration }
}

function makeCrickets() {
  const duration = 8.8
  const samples = makeBuffer(duration)
  const random = mulberry32(505)
  let breeze = 0
  for (let i = 0; i < samples.length; i += 1) {
    const t = i / SAMPLE_RATE
    const white = random() * 2 - 1
    breeze = breeze * 0.998 + white * 0.008
    samples[i] = breeze * 1.3 + Math.sin(2 * Math.PI * 120 * t) * 0.003
  }
  const crickets = [
    { freq: 4380, period: 0.62, phase: 0.1, amp: 0.12 },
    { freq: 4670, period: 0.78, phase: 0.35, amp: 0.08 },
    { freq: 4120, period: 0.92, phase: 0.6, amp: 0.06 },
  ]
  crickets.forEach(({ freq, period, phase, amp }) => {
    for (let cycle = phase; cycle < duration; cycle += period) {
      for (let pulse = 0; pulse < 3; pulse += 1) {
        const start = Math.floor((cycle + pulse * 0.045) * SAMPLE_RATE)
        const length = Math.floor(0.026 * SAMPLE_RATE)
        for (let i = 0; i < length; i += 1) {
          const p = i / length
          const env = Math.sin(Math.PI * p) ** 2
          const t = i / SAMPLE_RATE
          const value = Math.sin(2 * Math.PI * freq * t) * env * amp
          if (start + i < samples.length) samples[start + i] += value
        }
      }
    }
  })
  normalise(samples, 0.55)
  fadeEdges(samples, 0.3)
  return { samples, duration }
}

const SEED_DEFINITIONS = [
  {
    id: 'seed-fan',
    serial: 1,
    title: '旧电扇的夏天',
    note: '外婆家的电扇，摇头时会咔哒一声。我在沙发上睡了一整个下午。',
    tags: ['家', '夏天'],
    hoursAgo: 24 * 14,
    make: makeFan,
  },
  {
    id: 'seed-subway',
    serial: 2,
    title: '末班地铁进站',
    note: '车门合上前的三秒，整节车厢只剩风。城市在那个瞬间安静了一下。',
    tags: ['城市', '夜晚'],
    hoursAgo: 24 * 9,
    make: makeSubway,
  },
  {
    id: 'seed-crickets',
    serial: 3,
    title: '槐树下的夏夜',
    note: '虫鸣密得像一张网，风一吹就散。小时候数过，永远数不清。',
    tags: ['夜晚', '风'],
    hoursAgo: 24 * 6,
    make: makeCrickets,
  },
  {
    id: 'seed-birds',
    serial: 4,
    title: '清晨六点的鸟',
    note: '楼下那棵香樟树，第一声鸟叫总比闹钟早。那天我决定再睡五分钟。',
    tags: ['清晨', '家'],
    hoursAgo: 24 * 2,
    make: makeBirds,
  },
  {
    id: 'seed-rain',
    serial: 5,
    title: '雨落在窗台',
    note: '午后突然落雨，窗台的铁皮被敲得很轻。我没有关窗。',
    tags: ['雨', '家'],
    hoursAgo: 3,
    make: makeRain,
  },
]

export function createSeedAmbers() {
  const now = Date.now()
  return SEED_DEFINITIONS.map((definition) => {
    const { samples, duration } = definition.make()
    const analysis = analyseSamples(samples, SAMPLE_RATE)
    const blob = encodeWav(samples, SAMPLE_RATE)
    return {
      id: definition.id,
      serial: definition.serial,
      title: definition.title,
      note: definition.note,
      tags: definition.tags,
      createdAt: now - definition.hoursAgo * 3600 * 1000,
      duration: analysis.duration || duration,
      peaks: analysis.peaks,
      features: analysis.features,
      audioBlob: blob,
      isSeed: true,
    }
  })
}
