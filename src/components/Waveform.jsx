function resample(peaks, count) {
  if (!peaks || !peaks.length) return new Array(count).fill(0.2)
  const result = new Array(count)
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor((i / count) * peaks.length)
    const end = Math.max(start + 1, Math.floor(((i + 1) / count) * peaks.length))
    let sum = 0
    for (let j = start; j < end && j < peaks.length; j += 1) sum += peaks[j]
    result[i] = sum / Math.max(1, end - start)
  }
  return result
}

export function WaveformBars({ peaks, progress = 0, count = 88, className = '', onSeek }) {
  const values = resample(peaks, count)
  const height = 44
  const width = count * 3
  const percent = Math.round(progress * 100)

  const handlePointer = (event) => {
    if (!onSeek) return
    const rect = event.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    onSeek(fraction)
  }

  return (
    <div
      className={`waveform ${onSeek ? 'is-seekable' : ''} ${className}`}
      role={onSeek ? 'slider' : undefined}
      tabIndex={onSeek ? 0 : undefined}
      aria-label={onSeek ? '播放进度' : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? percent : undefined}
      onPointerDown={handlePointer}
      onKeyDown={(event) => {
        if (!onSeek) return
        if (event.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.05))
        if (event.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.05))
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {values.map((value, index) => {
          const barHeight = Math.max(2.4, value * (height - 6))
          const played = index / count <= progress
          return (
            <line
              key={index}
              x1={index * 3 + 1.5}
              x2={index * 3 + 1.5}
              y1={(height - barHeight) / 2}
              y2={(height + barHeight) / 2}
              stroke={played ? 'var(--amber)' : 'rgba(243, 233, 215, 0.2)'}
              strokeWidth="1.45"
              strokeLinecap="round"
            />
          )
        })}
      </svg>
    </div>
  )
}

export function MiniWaveform({ peaks, className = '' }) {
  return (
    <div className={`mini-wave ${className}`} aria-hidden="true">
      {resample(peaks, 34).map((value, index) => (
        <span
          key={index}
          style={{ height: `${Math.max(8, value * 100)}%` }}
        />
      ))}
    </div>
  )
}
