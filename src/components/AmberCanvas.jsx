import { useEffect, useRef, useState } from 'react'
import { drawAmber } from '../amber/renderAmber'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export default function AmberCanvas({
  amber,
  className = '',
  animated = false,
  playing = false,
  analyserRef = null,
  interactive = false,
  quality,
  ariaLabel,
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const paintRef = useRef(() => {})
  const stateRef = useRef({
    rotX: 0,
    rotY: 0,
    dragging: false,
    interacted: false,
    lastX: 0,
    lastY: 0,
    level: 0,
  })
  const [size, setSize] = useState(0)

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return undefined
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.width || 0
      if (next > 0) setSize(next)
    })
    observer.observe(node)
    const initial = node.getBoundingClientRect().width
    if (initial > 0) setSize(initial)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!amber || !size) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const data = new Uint8Array(64)
    let frame = 0
    let running = true
    let last = 0

    const paint = (now) => {
      const state = stateRef.current
      const t = now / 1000
      let rotX = state.rotX
      let rotY = state.rotY
      if (animated && !state.interacted && !state.dragging) {
        rotY = Math.sin(t * 0.23) * 0.22
        rotX = Math.cos(t * 0.19) * 0.1
      }
      let target = 0
      const analyser = analyserRef?.current
      if (playing && analyser) {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 1; i < 26; i += 1) sum += data[i]
        target = sum / (25 * 255)
        target = Math.pow(target, 1.4)
      }
      state.level += (target - state.level) * 0.18
      drawAmber(ctx, size, amber, {
        time: t,
        rotX,
        rotY,
        playing,
        level: state.level,
        quality: quality || (size > 260 ? 'high' : 'low'),
      })
    }
    paintRef.current = paint

    const tick = (now) => {
      if (!running) return
      if (now - last > 28) {
        paint(now)
        last = now
      }
      frame = requestAnimationFrame(tick)
    }

    paint(performance.now())
    if (animated || playing) frame = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(frame)
    }
  }, [amber, size, animated, playing, analyserRef, quality])

  const handlePointerDown = (event) => {
    if (!interactive) return
    const state = stateRef.current
    state.dragging = true
    state.interacted = true
    state.lastX = event.clientX
    state.lastY = event.clientY
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event) => {
    const state = stateRef.current
    if (!interactive || !state.dragging) return
    const dx = event.clientX - state.lastX
    const dy = event.clientY - state.lastY
    state.lastX = event.clientX
    state.lastY = event.clientY
    state.rotY = clamp(state.rotY + dx * 0.0075, -1, 1)
    state.rotX = clamp(state.rotX + dy * 0.006, -0.8, 0.8)
    paintRef.current(performance.now())
  }

  const handlePointerUp = () => {
    stateRef.current.dragging = false
  }

  const handleReset = () => {
    stateRef.current.rotX = 0
    stateRef.current.rotY = 0
    stateRef.current.interacted = false
    paintRef.current(performance.now())
  }

  const handleKeyDown = (event) => {
    if (!interactive) return
    const state = stateRef.current
    const step = 0.12
    if (event.key === 'ArrowLeft') state.rotY = clamp(state.rotY - step, -1, 1)
    else if (event.key === 'ArrowRight') state.rotY = clamp(state.rotY + step, -1, 1)
    else if (event.key === 'ArrowUp') state.rotX = clamp(state.rotX - step, -0.8, 0.8)
    else if (event.key === 'ArrowDown') state.rotX = clamp(state.rotX + step, -0.8, 0.8)
    else return
    event.preventDefault()
    state.interacted = true
    paintRef.current(performance.now())
  }

  return (
    <div
      ref={wrapRef}
      className={`amber-canvas ${interactive ? 'is-interactive' : ''} ${className}`}
      role={interactive ? 'application' : 'img'}
      aria-label={ariaLabel || '一颗由声音凝结成的琥珀'}
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={interactive ? handleReset : undefined}
      onKeyDown={handleKeyDown}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
