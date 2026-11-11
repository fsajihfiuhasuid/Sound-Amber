const PEAK_COUNT = 420
const FFT_SIZE = 2048
const MAX_FFT_FRAMES = 56

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wReal = Math.cos(ang)
    const wImag = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curReal = 1
      let curImag = 0
      for (let k = 0; k < len / 2; k += 1) {
        const aReal = re[i + k]
        const aImag = im[i + k]
        const bReal = re[i + k + len / 2] * curReal - im[i + k + len / 2] * curImag
        const bImag = re[i + k + len / 2] * curImag + im[i + k + len / 2] * curReal
        re[i + k] = aReal + bReal
        im[i + k] = aImag + bImag
        re[i + k + len / 2] = aReal - bReal
        im[i + k + len / 2] = aImag - bImag
        const nextReal = curReal * wReal - curImag * wImag
        curImag = curReal * wImag + curImag * wReal
        curReal = nextReal
      }
    }
  }
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export function analyseSamples(samples, sampleRate) {
  const length = samples.length
  if (!length) {
    return {
      peaks: new Array(PEAK_COUNT).fill(0.02),
      duration: 0,
      features: {
        centroid: 0.35,
        low: 0.33,
        mid: 0.33,
        high: 0.33,
        rms: 0.2,
        dynamics: 0.3,
        zcr: 0.2,
      },
    }
  }

  // Peak envelope: one maximum per bucket, gently compressed for display.
  const peaks = new Array(PEAK_COUNT)
  const bucket = length / PEAK_COUNT
  let maxPeak = 0
  for (let i = 0; i < PEAK_COUNT; i += 1) {
    const start = Math.floor(i * bucket)
    const end = Math.min(length, Math.floor((i + 1) * bucket))
    let peak = 0
    for (let j = start; j < end; j += 1) {
      const abs = Math.abs(samples[j])
      if (abs > peak) peak = abs
    }
    peaks[i] = peak
    if (peak > maxPeak) maxPeak = peak
  }
  const peakScale = maxPeak > 0 ? 1 / maxPeak : 0
  for (let i = 0; i < PEAK_COUNT; i += 1) {
    peaks[i] = Math.pow(peaks[i] * peakScale, 0.72)
  }

  // Frame loudness, used for the "dynamic range" reading.
  const frameSize = 1024
  const rmsValues = []
  let totalRms = 0
  let zeroCrossings = 0
  for (let i = 1; i < length; i += 1) {
    if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
      zeroCrossings += 1
    }
  }
  for (let start = 0; start + frameSize <= length; start += frameSize) {
    let sum = 0
    for (let i = start; i < start + frameSize; i += 1) sum += samples[i] * samples[i]
    const rms = Math.sqrt(sum / frameSize)
    rmsValues.push(rms)
    totalRms += rms
  }
  const meanRms = rmsValues.length ? totalRms / rmsValues.length : 0
  let variance = 0
  for (let i = 0; i < rmsValues.length; i += 1) {
    variance += (rmsValues[i] - meanRms) ** 2
  }
  variance = rmsValues.length ? variance / rmsValues.length : 0
  const stdRms = Math.sqrt(variance)
  const dynamics = clamp(meanRms > 0 ? stdRms / meanRms / 1.8 : 0)
  const zcr = clamp((zeroCrossings / length) * 12)

  // Average spectrum from a handful of Hann-windowed frames.
  const availableFrames = Math.max(1, Math.floor((length - FFT_SIZE) / (FFT_SIZE / 2)) + 1)
  const frameCount = Math.min(MAX_FFT_FRAMES, availableFrames)
  const spectrum = new Float64Array(FFT_SIZE / 2)
  const hop = Math.max(1, Math.floor((length - FFT_SIZE) / Math.max(1, frameCount - 1)))
  for (let f = 0; f < frameCount; f += 1) {
    const offset = Math.min(Math.max(0, length - FFT_SIZE), f * hop)
    const re = new Float64Array(FFT_SIZE)
    const im = new Float64Array(FFT_SIZE)
    for (let i = 0; i < FFT_SIZE; i += 1) {
      const sample = offset + i < length ? samples[offset + i] : 0
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))
      re[i] = sample * hann
    }
    fft(re, im)
    for (let i = 1; i < FFT_SIZE / 2; i += 1) {
      spectrum[i] += re[i] * re[i] + im[i] * im[i]
    }
  }

  let weighted = 0
  let magnitudeSum = 0
  let lowEnergy = 0
  let midEnergy = 0
  let highEnergy = 0
  for (let i = 1; i < spectrum.length; i += 1) {
    const freq = (i * sampleRate) / FFT_SIZE
    if (freq < 20 || freq > Math.min(12000, sampleRate / 2)) continue
    const power = spectrum[i]
    const magnitude = Math.sqrt(power)
    weighted += freq * magnitude
    magnitudeSum += magnitude
    if (freq < 250) lowEnergy += power
    else if (freq < 2000) midEnergy += power
    else highEnergy += power
  }
  const centroidHz = magnitudeSum > 0 ? weighted / magnitudeSum : 1000
  const centroid = clamp(centroidHz / (sampleRate / 2))
  const totalEnergy = lowEnergy + midEnergy + highEnergy || 1
  const low = clamp(lowEnergy / totalEnergy)
  const mid = clamp(midEnergy / totalEnergy)
  const high = clamp(highEnergy / totalEnergy)

  return {
    peaks,
    duration: length / sampleRate,
    features: {
      centroid: Number(centroid.toFixed(4)),
      low: Number(low.toFixed(4)),
      mid: Number(mid.toFixed(4)),
      high: Number(high.toFixed(4)),
      rms: Number(clamp(meanRms * 2.6).toFixed(4)),
      dynamics: Number(dynamics.toFixed(4)),
      zcr: Number(zcr.toFixed(4)),
    },
  }
}

export async function decodeAudio(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const ctx = new AudioCtx()
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    const channels = buffer.numberOfChannels
    const mixed = new Float32Array(buffer.length)
    for (let c = 0; c < channels; c += 1) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < buffer.length; i += 1) mixed[i] += data[i] / channels
    }
    return analyseSamples(mixed, buffer.sampleRate)
  } finally {
    ctx.close().catch(() => {})
  }
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  const view = new DataView(buffer)
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i += 1) view.setUint8(offset + i, string.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * bytesPerSample, true)
  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}
