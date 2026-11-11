const styleCache = new Map()

export function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function getAmberStyle(amber) {
  const cacheKey = amber.id || 'preview'
  if (styleCache.has(cacheKey)) return styleCache.get(cacheKey)
  const features = amber.features || {}
  const random = mulberry32(hashString(cacheKey))
  const brightness = features.centroid ?? 0.35
  const low = features.low ?? 0.33
  const high = features.high ?? 0.33

  const hue = clamp(
    30 +
      Math.sqrt(clamp(brightness, 0, 1)) * 30 +
      (features.zcr ?? 0.3) * 5 -
      low * 6 -
      (features.dynamics ?? 0.2) * 6 -
      (features.rms ?? 0.4) * 6,
    24,
    47,
  )
  const sat = 82 + (high ?? 0) * 8

  const shape = []
  const points = 112
  const phaseA = random() * Math.PI * 2
  const phaseB = random() * Math.PI * 2
  const phaseC = random() * Math.PI * 2
  const stretch = 0.94 + random() * 0.1
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2
    const wobble =
      0.052 * Math.sin(2 * angle + phaseA) +
      0.026 * Math.sin(3 * angle + phaseB) +
      0.013 * Math.sin(5 * angle + phaseC) +
      0.007 * Math.sin(7 * angle + phaseA * 1.7)
    let x = Math.cos(angle) * (0.755 + wobble)
    let y = Math.sin(angle) * (0.885 + wobble * 0.7) * stretch
    if (y > 0.45) y -= (y - 0.45) * 0.18
    x += 0.022 * Math.sin(angle * 2 + phaseB)
    shape.push({ x, y, angle })
  }

  const veinLayers = []
  for (let layer = 0; layer < 4; layer += 1) {
    const pointsCount = 22
    const pts = []
    const layerPhase = phaseA + layer * 1.15
    const amplitude = 0.18 + layer * 0.035
    for (let i = 0; i < pointsCount; i += 1) {
      const t = i / (pointsCount - 1)
      const x = -0.57 + t * 1.15
      const wave = Math.sin(t * 5.2 + layerPhase) * 0.08
      const peakIndex = Math.floor(t * ((amber.peaks?.length || 1) - 1))
      const peak = (amber.peaks?.[peakIndex] || 0.3) - 0.32
      const y =
        -0.16 +
        layer * 0.115 +
        Math.sin(t * 3.1 + layerPhase * 0.7) * amplitude * 0.35 +
        wave +
        peak * (0.2 + layer * 0.05)
      pts.push([x, y])
    }
    veinLayers.push({ pts, phase: layerPhase, width: 0.1 - layer * 0.015 })
  }

  const inclusions = []
  for (let i = 0; i < 36; i += 1) {
    let x
    let y
    do {
      x = (random() * 2 - 1) * 0.56
      y = (random() * 2 - 1) * 0.64
    } while ((x / 0.62) ** 2 + (y / 0.76) ** 2 > 1)
    inclusions.push({
      x,
      y,
      z: random() * 1.7 - 0.85,
      radius: 0.004 + random() ** 2 * 0.018,
      alpha: 0.22 + random() * 0.55,
      warm: random() > 0.32,
      sprig: i % 11 === 0,
      angle: random() * Math.PI * 2,
      branches: 2 + Math.floor(random() * 3),
    })
  }

  const specks = []
  for (let i = 0; i < 54; i += 1) {
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random()) * 0.78
    specks.push({
      x: Math.cos(angle) * radius * 0.7,
      y: Math.sin(angle) * radius * 0.82,
      r: 0.002 + random() * 0.005,
      alpha: 0.15 + random() * 0.45,
    })
  }

  const style = {
    hue,
    sat,
    shape,
    veinLayers,
    inclusions,
    specks,
    coreX: (random() * 2 - 1) * 0.08,
    coreY: -0.02 + random() * 0.1,
    seed: random() * 1000,
  }
  styleCache.set(cacheKey, style)
  return style
}

function amberColor(hue, sat, light, alpha = 1) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

function buildShape(ctx, style, cx, cy, scale) {
  const { shape } = style
  ctx.beginPath()
  for (let i = 0; i < shape.length; i += 1) {
    const point = shape[i]
    const x = cx + point.x * scale
    const y = cy + point.y * scale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function traceOpen(ctx, pts, cx, cy, scale, offsetX = 0, offsetY = 0) {
  ctx.beginPath()
  ctx.moveTo(cx + pts[0][0] * scale + offsetX, cy + pts[0][1] * scale + offsetY)
  for (let i = 1; i < pts.length - 1; i += 1) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2
    const yc = (pts[i][1] + pts[i + 1][1]) / 2
    ctx.quadraticCurveTo(
      cx + pts[i][0] * scale + offsetX,
      cy + pts[i][1] * scale + offsetY,
      cx + xc * scale + offsetX,
      cy + yc * scale + offsetY,
    )
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(cx + last[0] * scale + offsetX, cy + last[1] * scale + offsetY)
}

function pointOnCurve(pts, t) {
  const scaled = clamp(t, 0, 0.9999) * (pts.length - 1)
  const index = Math.floor(scaled)
  const mix = scaled - index
  const a = pts[index]
  const b = pts[Math.min(pts.length - 1, index + 1)]
  return [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix]
}

function drawInclusion(ctx, item, cx, cy, size, rotX, rotY, hue, sat, time, level) {
  const cosY = Math.cos(rotY * 0.8)
  const sinY = Math.sin(rotY * 0.8)
  const cosX = Math.cos(rotX * 0.55)
  const sinX = Math.sin(rotX * 0.55)
  let x = item.x * cosY + item.z * sinY
  let z = -item.x * sinY + item.z * cosY
  const y = item.y * cosX - z * sinX
  z = item.y * sinX + z * cosX
  const depth = (z + 1) / 2
  const px = cx + x * size * 0.5
  const py = cy + y * size * 0.55
  const scale = 0.72 + depth * 0.55

  if (item.sprig) {
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(item.angle + rotY * 0.12)
    ctx.globalAlpha = (0.18 + depth * 0.45) * (0.7 + level * 0.2)
    ctx.strokeStyle = `hsla(${hue - 18}, 62%, 18%, 0.9)`
    ctx.lineWidth = Math.max(0.7, size * 0.0018)
    const arm = size * (0.018 + item.radius * 1.8)
    ctx.beginPath()
    ctx.moveTo(0, arm * 0.4)
    ctx.lineTo(0, -arm * 0.7)
    for (let b = 0; b < item.branches; b += 1) {
      const side = b % 2 === 0 ? 1 : -1
      const at = -arm * (0.15 + b * 0.18)
      ctx.moveTo(0, at)
      ctx.quadraticCurveTo(side * arm * 0.5, at - arm * 0.15, side * arm * 0.8, at - arm * 0.45)
    }
    ctx.stroke()
    ctx.restore()
    return
  }

  const radius = item.radius * size * scale
  ctx.save()
  ctx.globalAlpha = item.alpha * (0.5 + depth * 0.55) * (0.85 + level * 0.2)
  if (item.warm) {
    const gradient = ctx.createRadialGradient(px - radius * 0.3, py - radius * 0.35, 0, px, py, radius)
    gradient.addColorStop(0, amberColor(hue + 18, 100, 92, 0.9))
    gradient.addColorStop(0.5, amberColor(hue + 4, 95, 68, 0.5))
    gradient.addColorStop(1, amberColor(hue - 8, 80, 32, 0.08))
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = amberColor(hue - 20, 55, 18, 0.65)
    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = amberColor(hue + 10, 90, 74, 0.35)
    ctx.lineWidth = Math.max(0.5, size * 0.0012)
    ctx.stroke()
  }
  // A tiny drifting glint inside the largest bubbles.
  if (radius > size * 0.008 && level > 0.02) {
    const drift = Math.sin(time * 0.9 + item.angle) * radius * 0.25
    ctx.fillStyle = amberColor(hue + 22, 100, 96, 0.35 * level)
    ctx.beginPath()
    ctx.arc(px - radius * 0.25 + drift, py - radius * 0.3, radius * 0.28, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawAmber(ctx, size, amber, options = {}) {
  const style = getAmberStyle(amber)
  const {
    time = 0,
    rotX = 0,
    rotY = 0,
    level = 0,
    playing = false,
    quality = 'high',
  } = options
  const { hue, sat } = style
  const cx = size / 2
  const cy = size / 2
  const scale = size * 0.5
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.7)
  const innerLight = (playing ? 0.55 + level * 0.8 : 0.24) + pulse * 0.06
  const tiltX = rotY * size * 0.035
  const tiltY = rotX * size * 0.028

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rotY * 0.035)
  ctx.translate(-cx, -cy)

  // Ambient halo.
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const glowRadius = size * (0.55 + level * 0.1)
  const halo = ctx.createRadialGradient(cx, cy, size * 0.06, cx, cy, glowRadius)
  halo.addColorStop(0, amberColor(hue + 12, 100, 66, 0.1 + level * 0.24))
  halo.addColorStop(0.55, amberColor(hue + 4, 100, 52, 0.06 + level * 0.13))
  halo.addColorStop(1, amberColor(hue, 100, 45, 0))
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)
  ctx.restore()

  // Body.
  ctx.save()
  buildShape(ctx, style, cx, cy, scale)
  const bodyGradient = ctx.createRadialGradient(
    cx - size * 0.13 + tiltX,
    cy - size * 0.16 + tiltY,
    size * 0.02,
    cx,
    cy,
    size * 0.58,
  )
  bodyGradient.addColorStop(0, amberColor(hue + 7, 100, 83, 0.98))
  bodyGradient.addColorStop(0.3, amberColor(hue + 1, 96, 65, 0.96))
  bodyGradient.addColorStop(0.66, amberColor(hue - 7, 91, 45, 0.97))
  bodyGradient.addColorStop(1, amberColor(hue - 15, 82, 22, 0.99))
  ctx.fillStyle = bodyGradient
  ctx.fill()

  ctx.save()
  buildShape(ctx, style, cx, cy, scale)
  ctx.clip()

  // A deep pool at the base keeps the stone from feeling flat.
  const depthPool = ctx.createRadialGradient(
    cx + size * 0.16,
    cy + size * 0.28,
    size * 0.01,
    cx + size * 0.1,
    cy + size * 0.2,
    size * 0.5,
  )
  depthPool.addColorStop(0, amberColor(hue - 22, 72, 15, 0.55))
  depthPool.addColorStop(0.65, amberColor(hue - 16, 80, 26, 0.18))
  depthPool.addColorStop(1, amberColor(hue - 10, 80, 34, 0))
  ctx.fillStyle = depthPool
  ctx.fillRect(0, 0, size, size)

  // Warm core light that breathes while the sound plays.
  const core = ctx.createRadialGradient(
    cx + style.coreX * size + tiltX * 0.4,
    cy + style.coreY * size + tiltY * 0.4,
    0,
    cx + style.coreX * size,
    cy + style.coreY * size,
    size * (0.32 + level * 0.08),
  )
  core.addColorStop(0, amberColor(hue + 20, 100, 92, innerLight * 0.7))
  core.addColorStop(0.35, amberColor(hue + 10, 100, 74, innerLight * 0.34))
  core.addColorStop(1, amberColor(hue, 100, 55, 0))
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = core
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'

  // Flowing internal veins, drawn from the waveform.
  style.veinLayers.forEach((layer, index) => {
    ctx.save()
    traceOpen(ctx, layer.pts, cx, cy, scale, tiltX * (0.5 + index * 0.1), tiltY * 0.6)
    const veinGradient = ctx.createLinearGradient(cx - size * 0.4, cy, cx + size * 0.4, cy)
    veinGradient.addColorStop(0, amberColor(hue + 14, 100, 85, 0.03))
    veinGradient.addColorStop(0.35, amberColor(hue + 14, 100, 85, 0.24 + index * 0.035))
    veinGradient.addColorStop(0.7, amberColor(hue + 6, 100, 70, 0.2))
    veinGradient.addColorStop(1, amberColor(hue - 4, 90, 48, 0.02))
    ctx.strokeStyle = veinGradient
    ctx.lineWidth = size * layer.width * (0.55 + index * 0.13)
    ctx.lineCap = 'round'
    if (quality === 'high' && index === 0) {
      ctx.shadowColor = amberColor(hue + 16, 100, 72, 0.55)
      ctx.shadowBlur = size * 0.045
    }
    ctx.stroke()
    ctx.restore()
  })

  // The pulsing stream of light that moves along the main vein.
  if (playing) {
    const main = style.veinLayers[0]
    const travel = (time * 0.14) % 1
    const [tx, ty] = pointOnCurve(main.pts, travel)
    const px = cx + tx * scale + tiltX * 0.6
    const py = cy + ty * scale + tiltY * 0.6
    const stream = ctx.createRadialGradient(px, py, 0, px, py, size * (0.06 + level * 0.05))
    stream.addColorStop(0, amberColor(hue + 24, 100, 98, 0.55 + level * 0.4))
    stream.addColorStop(0.35, amberColor(hue + 16, 100, 84, 0.25 + level * 0.25))
    stream.addColorStop(1, amberColor(hue + 10, 100, 70, 0))
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = stream
    ctx.beginPath()
    ctx.arc(px, py, size * (0.06 + level * 0.05), 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  // Suspended inclusions.
  style.inclusions.forEach((item) => {
    drawInclusion(ctx, item, cx, cy, size, rotX, rotY, hue, sat, time, level)
  })

  // Mineral dust.
  style.specks.forEach((speck) => {
    ctx.globalAlpha = speck.alpha
    ctx.fillStyle = amberColor(hue + 18, 100, 88, 1)
    ctx.beginPath()
    ctx.arc(cx + speck.x * scale, cy + speck.y * scale, speck.r * size, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.globalAlpha = 1

  // A soft inner top-left sheen.
  const sheen = ctx.createRadialGradient(
    cx - size * 0.24 + tiltX,
    cy - size * 0.28 + tiltY,
    0,
    cx - size * 0.18,
    cy - size * 0.22,
    size * 0.36,
  )
  sheen.addColorStop(0, 'rgba(255, 248, 226, 0.3)')
  sheen.addColorStop(0.45, 'rgba(255, 236, 195, 0.08)')
  sheen.addColorStop(1, 'rgba(255, 220, 160, 0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, size, size)

  ctx.restore()
  ctx.restore()

  // Rim.
  ctx.save()
  buildShape(ctx, style, cx, cy, scale)
  const rim = ctx.createLinearGradient(cx - size * 0.4, cy - size * 0.45, cx + size * 0.35, cy + size * 0.4)
  rim.addColorStop(0, amberColor(hue + 22, 100, 88, 0.9))
  rim.addColorStop(0.4, amberColor(hue + 6, 95, 58, 0.7))
  rim.addColorStop(0.72, amberColor(hue - 12, 80, 30, 0.9))
  rim.addColorStop(1, amberColor(hue - 20, 75, 18, 0.95))
  ctx.strokeStyle = rim
  ctx.lineWidth = size * 0.006
  ctx.stroke()
  ctx.restore()

  // Specular highlights.
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  ctx.beginPath()
  const start = Math.PI * 0.94
  const end = Math.PI * 1.42
  for (let i = 0; i <= 16; i += 1) {
    const angle = start + (end - start) * (i / 16)
    const point =
      style.shape[Math.round((angle / (Math.PI * 2)) * style.shape.length) % style.shape.length]
    const x = cx + point.x * scale * 1.002
    const y = cy + point.y * scale * 1.002
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = 'rgba(255, 248, 226, 0.55)'
  ctx.lineWidth = size * 0.009
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(255, 226, 170, 0.7)'
  ctx.shadowBlur = size * 0.022
  ctx.stroke()

  // Moving glint that hints at the object turning.
  const glintX = cx - size * 0.24 - rotY * size * 0.07
  const glintY = cy - size * 0.3 + rotX * size * 0.04
  const glint = ctx.createRadialGradient(glintX, glintY, 0, glintX, glintY, size * 0.075)
  glint.addColorStop(0, 'rgba(255, 252, 240, 0.65)')
  glint.addColorStop(0.4, 'rgba(255, 236, 198, 0.18)')
  glint.addColorStop(1, 'rgba(255, 220, 160, 0)')
  ctx.fillStyle = glint
  ctx.beginPath()
  ctx.ellipse(glintX, glintY, size * 0.07, size * 0.035, -0.65, 0, Math.PI * 2)
  ctx.fill()

  // Bottom caustic.
  ctx.beginPath()
  for (let i = 0; i <= 14; i += 1) {
    const angle = Math.PI * 0.28 + (Math.PI * 0.44 * i) / 14
    const point =
      style.shape[Math.round((angle / (Math.PI * 2)) * style.shape.length) % style.shape.length]
    const x = cx + point.x * scale * 0.99
    const y = cy + point.y * scale * 0.99
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = amberColor(hue + 16, 100, 76, 0.32 + level * 0.2)
  ctx.lineWidth = size * 0.011
  ctx.shadowColor = amberColor(hue + 14, 100, 66, 0.5)
  ctx.shadowBlur = size * 0.025
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}
