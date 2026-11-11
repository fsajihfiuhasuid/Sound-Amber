import { useEffect, useRef, useState } from 'react'
import AmberCanvas from './AmberCanvas'
import { CloseIcon, MicIcon, UploadIcon } from './Icons'
import { decodeAudio, formatDuration } from '../audio/analysis'
import { TAGS } from '../lib/format'

function suggestTitle() {
  const hour = new Date().getHours()
  let part = '夜晚'
  if (hour < 5) part = '凌晨'
  else if (hour < 9) part = '清晨'
  else if (hour < 12) part = '上午'
  else if (hour < 14) part = '午后'
  else if (hour < 18) part = '下午'
  else if (hour < 22) part = '傍晚'
  return `${part}的声音`
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

export default function CaptureModal({ onClose, onSave }) {
  const [step, setStep] = useState('choose')
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [captured, setCaptured] = useState(null)
  const [preview, setPreview] = useState(null)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const liveCanvasRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const captureCtxRef = useRef(null)
  const captureAnalyserRef = useRef(null)
  const rafRef = useRef(0)
  const startTimeRef = useRef(0)
  const stoppedRef = useRef(false)
  const mountedRef = useRef(true)
  const suggested = suggestTitle()

  const cleanupRecording = () => {
    cancelAnimationFrame(rafRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null
      recorderRef.current.stop()
    }
    recorderRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (captureCtxRef.current) {
      captureCtxRef.current.close().catch(() => {})
      captureCtxRef.current = null
    }
    captureAnalyserRef.current = null
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cleanupRecording()
    }
  }, [])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && step !== 'recording' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [step, saving, onClose])

  const drawLiveWave = () => {
    const canvas = liveCanvasRef.current
    const analyser = captureAnalyserRef.current
    if (!canvas || !analyser) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)
    const bars = 76
    const step = Math.max(1, Math.floor(data.length / bars))
    const barWidth = width / bars
    for (let i = 0; i < bars; i += 1) {
      let peak = 0
      for (let j = 0; j < step; j += 1) {
        peak = Math.max(peak, Math.abs(data[i * step + j] - 128) / 128)
      }
      const barHeight = Math.max(2, peak * height * 0.92)
      ctx.fillStyle = `rgba(240, 161, 59, ${0.35 + peak * 0.6})`
      ctx.beginPath()
      ctx.roundRect(
        i * barWidth + barWidth * 0.22,
        (height - barHeight) / 2,
        Math.max(1.4, barWidth * 0.42),
        barHeight,
        2,
      )
      ctx.fill()
    }
  }

  const startRecording = async () => {
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('unsupported')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      stoppedRef.current = false
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        cleanupRecording()
        if (!mountedRef.current) return
        await handleBlob(blob)
      }
      recorder.start(200)

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      captureCtxRef.current = ctx
      captureAnalyserRef.current = analyser

      setStep('recording')
      setElapsed(0)
      startTimeRef.current = performance.now()
      let lastUi = 0

      const loop = (now) => {
        if (!mountedRef.current) return
        drawLiveWave()
        const seconds = (now - startTimeRef.current) / 1000
        if (now - lastUi > 100) {
          setElapsed(seconds)
          lastUi = now
        }
        if (seconds >= 60) {
          stopRecording()
          return
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      cleanupRecording()
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setError('没有拿到麦克风权限。允许后重试，或直接上传一段音频。')
      } else if (err?.name === 'NotFoundError') {
        setError('没有找到麦克风。可以试试上传一段已有的声音。')
      } else {
        setError('暂时无法录音，可以上传一段音频试试。')
      }
    }
  }

  const stopRecording = () => {
    if (stoppedRef.current) return
    stoppedRef.current = true
    cancelAnimationFrame(rafRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    } else {
      cleanupRecording()
    }
  }

  const handleBlob = async (blob) => {
    if (!blob || blob.size < 800) {
      setStep('choose')
      setError('这段声音太短了，至少留下半秒钟。')
      return
    }
    setStep('analyzing')
    setError('')
    try {
      const analysis = await decodeAudio(blob)
      if (!analysis || analysis.duration < 0.35) {
        setStep('choose')
        setError('这段声音太短了，再录长一点点。')
        return
      }
      if (!mountedRef.current) return
      setCaptured({ blob, analysis })
      setPreview({
        id: `preview-${Date.now()}`,
        peaks: analysis.peaks,
        features: analysis.features,
        duration: analysis.duration,
      })
      setStep('review')
    } catch (err) {
      setStep('choose')
      setError('这段声音没能被读出来。试试 WAV、MP3 或 M4A 格式。')
    }
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 40 * 1024 * 1024) {
      setError('文件有点大，请选择 40MB 以内的音频。')
      return
    }
    const looksAudio = file.type.startsWith('audio') || /\.(wav|mp3|m4a|aac|ogg|webm|flac)$/i.test(file.name)
    if (!looksAudio) {
      setError('这似乎不是音频文件，换一个试试。')
      return
    }
    await handleBlob(file)
  }

  const resetCapture = () => {
    setCaptured(null)
    setPreview(null)
    setTitle('')
    setNote('')
    setTags([])
    setError('')
    setStep('choose')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!captured || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave({
        title: title.trim() || suggested,
        note: note.trim(),
        tags,
        blob: captured.blob,
        analysis: captured.analysis,
      })
    } catch (err) {
      setError('没能封存，再试一次。')
      setSaving(false)
    }
  }

  return (
    <div
      className="overlay capture-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="收录一段声音"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && step !== 'recording' && !saving) onClose()
      }}
    >
      <div className={`capture-shell step-${step}`}>
        <button
          className="overlay-close"
          type="button"
          onClick={() => {
            cleanupRecording()
            onClose()
          }}
          aria-label="关闭"
          disabled={saving}
        >
          <CloseIcon />
        </button>

        <div className="capture-heading">
          <span className="capture-kicker">CAPTURE A MOMENT</span>
          <h2>
            {step === 'review' ? '它正在凝结' : step === 'recording' ? '正在收录' : '收录一段声音'}
          </h2>
          <p>
            {step === 'review'
              ? '确认它的名字与颜色，然后把这一刻封存。'
              : step === 'recording'
                ? '不要着急，让环境的声音先落进来。'
                : '一段鸟鸣、一阵雨，或一句轻声的话。'}
          </p>
        </div>

        {step === 'choose' && (
          <>
            <div className="capture-choose">
              <button className="capture-option" type="button" onClick={startRecording}>
                <span className="option-icon">
                  <MicIcon />
                </span>
                <span className="option-title">录下现在</span>
                <span className="option-sub">最长 60 秒 · 需要麦克风</span>
              </button>
              <button
                className="capture-option"
                type="button"
                onClick={() => fileRef.current?.click()}
              >
                <span className="option-icon">
                  <UploadIcon />
                </span>
                <span className="option-title">上传音频</span>
                <span className="option-sub">WAV / MP3 / M4A · 40MB 以内</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                hidden
                onChange={handleFile}
              />
            </div>
            <div className="capture-tip">
              <span className="tip-mark">i</span>
              <span>5–15 秒的声音，能让琥珀的纹路更清晰。所有分析都在这台设备上完成，不会上传。</span>
            </div>
            {error && <p className="capture-error">{error}</p>}
          </>
        )}

        {step === 'recording' && (
          <div className="recording-panel">
            <div className="recording-topline">
              <span className="live-label">
                <span className="live-dot" />
                REC
              </span>
              <span className="recording-time">{formatDuration(elapsed)} <em>/ 01:00</em></span>
            </div>
            <canvas ref={liveCanvasRef} className="live-wave" />
            <div className="recording-actions">
              <button className="stop-button" type="button" onClick={stopRecording} aria-label="停止录音">
                <span />
              </button>
              <p>轻一点，把瞬间留下来</p>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="analyzing">
            <span className="analyzing-orb" aria-hidden="true" />
            <p>正在听见它的形状…</p>
            <small>分析波形与频率</small>
          </div>
        )}

        {step === 'review' && preview && (
          <div className="capture-review">
            <div className="review-art">
              <AmberCanvas amber={preview} animated ariaLabel="新琥珀的预览" />
              <span className="review-duration">{formatDuration(captured?.analysis?.duration)}</span>
              <span className="review-label">预览 · 尚未凝结</span>
            </div>
            <form className="review-form" onSubmit={submit}>
              <label className="field">
                <span>给它一个名字</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={suggested}
                  maxLength={24}
                />
              </label>
              <label className="field">
                <span>
                  留下一点文字 <em>选填</em>
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="那一刻，你在哪里？和谁在一起？"
                  maxLength={120}
                  rows={3}
                />
              </label>
              <div className="field">
                <span>
                  这一刻，像什么？ <em>最多选 4 个</em>
                </span>
                <div className="tag-picker">
                  {TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={tags.includes(tag) ? 'is-active' : ''}
                      onClick={() =>
                        setTags((prev) =>
                          prev.includes(tag)
                            ? prev.filter((item) => item !== tag)
                            : [...prev, tag].slice(0, 4),
                        )
                      }
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="capture-error">{error}</p>}
              <div className="review-actions">
                <button className="btn btn-ghost" type="button" onClick={resetCapture} disabled={saving}>
                  重来
                </button>
                <button className="btn btn-solid" type="submit" disabled={saving}>
                  {saving ? '正在凝结…' : '封入琥珀'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
