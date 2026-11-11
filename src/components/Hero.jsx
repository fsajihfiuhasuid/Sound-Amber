import AmberCanvas from './AmberCanvas'
import { ArrowIcon, MicIcon } from './Icons'
import { MiniWaveform } from './Waveform'
import { formatDuration, formatSerial, formatShortDate } from '../lib/format'

export default function Hero({ amber, total, onCapture, onListen }) {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <h1>
          把一刻，
          <br />
          <em>封进琥珀。</em>
        </h1>
        <p className="hero-lede">
          鸟鸣、雨声、地铁的轰鸣，
          <br />
          朋友没说完的那句笑。
          <br />
          录下来，声音会凝成一颗独一无二的琥珀。
        </p>
        <div className="hero-actions">
          <button className="btn btn-solid" type="button" onClick={onCapture}>
            <MicIcon />
            收录一段声音
          </button>
          <button
            className="btn btn-text"
            type="button"
            onClick={onListen}
            disabled={!amber}
          >
            听一颗琥珀
            <ArrowIcon />
          </button>
        </div>
        <p className="hero-privacy">
          <span className="status-dot" aria-hidden="true" />
          所有声音只留在你的浏览器里
        </p>
      </div>

      <div className="hero-stage">
        <div className="hero-spot" aria-hidden="true" />
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-tick" />
        </div>
        {amber ? (
          <>
            <button
              className="hero-specimen"
              type="button"
              onClick={() => onListen(amber.id)}
              aria-label={`打开 ${amber.title}，${formatDuration(amber.duration)}`}
            >
              <AmberCanvas
                amber={amber}
                animated
                ariaLabel={`${amber.title}的声音琥珀`}
              />
              <span className="hero-hover-hint">聆听这一刻</span>
            </button>
            <div className="hero-plate">
              <div className="hero-plate-head">
                <span className="plate-no">No. {formatSerial(amber.serial)} · 最新封存</span>
                <span className="plate-date">{formatShortDate(amber.createdAt)}</span>
              </div>
              <div className="hero-plate-body">
                <div>
                  <h2>{amber.title}</h2>
                  <p>
                    {formatDuration(amber.duration)}
                    <span className="dot-sep" />
                    {amber.tags?.[0] || '生活切片'}
                  </p>
                </div>
                <MiniWaveform peaks={amber.peaks} className="hero-mini-wave" />
              </div>
            </div>
          </>
        ) : (
          <div className="hero-empty">
            <span className="empty-amber" aria-hidden="true" />
            <p>墙上还空着。第一颗琥珀，从一个声音开始。</p>
            <button className="btn btn-solid" type="button" onClick={onCapture}>
              <MicIcon />
              收录第一段声音
            </button>
          </div>
        )}
        {total > 0 && (
          <span className="hero-wall-count">
            <span>{String(total).padStart(2, '0')}</span> 颗声音，正在墙上呼吸
          </span>
        )}
      </div>
    </section>
  )
}
