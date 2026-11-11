import { useEffect, useRef, useState } from 'react'
import AmberCanvas from './AmberCanvas'
import { WaveformBars } from './Waveform'
import {
  ArrowIcon,
  ArrowLeftIcon,
  CloseIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  TrashIcon,
} from './Icons'
import { formatDuration, formatFullDate, formatSerial } from '../lib/format'

function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <div className="stat-label">
        <span>{label}</span>
        <em>{note}</em>
      </div>
      <div className="stat-track">
        <span style={{ width: `${Math.round(Math.min(1, Math.max(0.04, value)) * 100)}%` }} />
      </div>
    </div>
  )
}

export default function DetailOverlay({
  amber,
  index,
  total,
  onClose,
  onNavigate,
  onRename,
  onDelete,
}) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [renameMode, setRenameMode] = useState(false)
  const [draftTitle, setDraftTitle] = useState(amber.title)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const audioRef = useRef(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const urlRef = useRef('')

  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    setRenameMode(false)
    setDraftTitle(amber.title)
    setConfirmDelete(false)

    const audio = new Audio()
    const url = URL.createObjectURL(amber.audioBlob)
    urlRef.current = url
    audio.preload = 'metadata'
    audio.src = url
    audioRef.current = audio

    const handleTime = () => {
      if (!audio.duration) return
      setProgress(Math.min(1, audio.currentTime / audio.duration))
    }
    const handleEnded = () => {
      setPlaying(false)
      setProgress(1)
    }
    const handlePause = () => setPlaying(false)
    audio.addEventListener('timeupdate', handleTime)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audio.removeEventListener('timeupdate', handleTime)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      URL.revokeObjectURL(url)
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {})
        ctxRef.current = null
      }
      analyserRef.current = null
      audioRef.current = null
    }
  }, [amber.id, amber.title, amber.audioBlob])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key !== 'Escape') return
      if (renameMode) {
        setRenameMode(false)
        setDraftTitle(amber.title)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, renameMode, amber.title])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.82
      source.connect(analyser)
      analyser.connect(ctx.destination)
      ctxRef.current = ctx
      analyserRef.current = analyser
    }
    try {
      await ctxRef.current.resume()
      if (audio.ended || progress >= 1) {
        audio.currentTime = 0
        setProgress(0)
      }
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const seek = (fraction) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = fraction * audio.duration
    setProgress(fraction)
  }

  const submitRename = (event) => {
    event.preventDefault()
    const next = draftTitle.trim()
    if (!next) return
    onRename(amber.id, next)
    setRenameMode(false)
  }

  const features = amber.features || {}
  const stats = [
    {
      label: '亮度',
      value: features.centroid ?? 0.4,
      note: (features.centroid ?? 0.4) > 0.55 ? '清亮' : (features.centroid ?? 0.4) > 0.35 ? '柔和' : '低沉',
    },
    {
      label: '低频',
      value: features.low ?? 0.33,
      note: (features.low ?? 0.33) > 0.6 ? '厚重' : (features.low ?? 0.33) > 0.35 ? '温润' : '轻盈',
    },
    {
      label: '动态',
      value: features.dynamics ?? 0.3,
      note: (features.dynamics ?? 0.3) > 0.55 ? '起伏' : (features.dynamics ?? 0.3) > 0.28 ? '自然' : '平稳',
    },
  ]

  return (
    <div
      className="overlay detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`声音琥珀：${amber.title}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="detail-shell">
        <button className="overlay-close" type="button" onClick={onClose} aria-label="关闭">
          <CloseIcon />
        </button>

        <div className="detail-visual">
          <div className="detail-spot" aria-hidden="true" />
          <AmberCanvas
            amber={amber}
            className="detail-amber"
            animated
            playing={playing}
            analyserRef={analyserRef}
            interactive
            ariaLabel={`${amber.title}，可拖动旋转的琥珀`}
          />
          <div className="detail-visual-foot">
            <span className="rotate-hint">拖动旋转 · 双击归位</span>
            {playing && (
              <span className="resonating">
                <span className="resonating-dot" />
                声音正在流动
              </span>
            )}
          </div>
          <div className="detail-pager">
            <button
              type="button"
              onClick={() => onNavigate(-1)}
              disabled={total < 2}
              aria-label="上一颗琥珀"
            >
              <ArrowLeftIcon />
              上一颗
            </button>
            <span>
              {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => onNavigate(1)}
              disabled={total < 2}
              aria-label="下一颗琥珀"
            >
              下一颗
              <ArrowIcon />
            </button>
          </div>
        </div>

        <div className="detail-panel">
          <div className="detail-kicker">
            <span>No. {formatSerial(amber.serial)}</span>
            <span>{formatFullDate(amber.createdAt)}</span>
          </div>

          <div className="detail-title-row">
            {renameMode ? (
              <form className="rename-form" onSubmit={submitRename}>
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  maxLength={24}
                  autoFocus
                  aria-label="琥珀名称"
                  onBlur={submitRename}
                />
              </form>
            ) : (
              <h2>{amber.title}</h2>
            )}
            {!renameMode && (
              <button
                className="icon-btn"
                type="button"
                aria-label="重命名"
                onClick={() => {
                  setDraftTitle(amber.title)
                  setRenameMode(true)
                }}
              >
                <PencilIcon />
              </button>
            )}
          </div>

          <p className="detail-note">{amber.note || '没有留下文字，只有声音。'}</p>

          {amber.tags?.length > 0 && (
            <div className="detail-tags">
              {amber.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}

          <div className="detail-waveform">
            <WaveformBars
              peaks={amber.peaks}
              progress={progress}
              count={104}
              onSeek={seek}
            />
            <div className="wave-times">
              <span>{formatDuration(progress * (amber.duration || 0))}</span>
              <span>{formatDuration(amber.duration)}</span>
            </div>
          </div>

          <div className="detail-play">
            <button
              className="play-button"
              type="button"
              onClick={togglePlayback}
              aria-label={playing ? '暂停' : '播放'}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="play-copy">
              <span>{playing ? '正在回响' : '听一听，那一刻'}</span>
              <small>{playing ? '声音在琥珀里缓缓流动' : '建议戴上耳机'}</small>
            </div>
          </div>

          <div className="detail-stats">
            {stats.map((stat) => (
              <Stat key={stat.label} {...stat} />
            ))}
          </div>

          <div className="detail-footer">
            {confirmDelete ? (
              <div className="confirm-delete">
                <span>从墙上取下这颗琥珀？</span>
                <button type="button" className="danger-solid" onClick={() => onDelete(amber.id)}>
                  确认取下
                </button>
                <button type="button" className="text-muted" onClick={() => setConfirmDelete(false)}>
                  再想想
                </button>
              </div>
            ) : (
              <button
                className="delete-link"
                type="button"
                onClick={() => setConfirmDelete(true)}
              >
                <TrashIcon />
                从墙上取下
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
