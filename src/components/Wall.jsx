import AmberCanvas from './AmberCanvas'
import { PlusIcon, PlayIcon } from './Icons'
import { MiniWaveform } from './Waveform'
import { formatDuration, formatSerial, formatShortDate } from '../lib/format'

function AmberCard({ amber, index, onOpen }) {
  return (
    <article className="amber-card" style={{ '--stagger': `${index * 45}ms` }}>
      <button
        className="amber-card-visual"
        type="button"
        onClick={() => onOpen(amber.id)}
        aria-label={`打开声音琥珀：${amber.title}`}
      >
        <AmberCanvas amber={amber} ariaLabel={`${amber.title}的琥珀`} />
        <span className="card-listen">
          <PlayIcon />
          聆听
        </span>
      </button>
      <div className="card-label">
        <div className="card-topline">
          <span>No. {formatSerial(amber.serial)}</span>
          <span>{formatDuration(amber.duration)}</span>
        </div>
        <h3>{amber.title}</h3>
        <MiniWaveform peaks={amber.peaks} />
        <div className="card-meta">
          <span>{formatShortDate(amber.createdAt)}</span>
          <span className="card-tags">{amber.tags?.slice(0, 2).join(' · ')}</span>
        </div>
      </div>
    </article>
  )
}

export default function Wall({
  ambers,
  total,
  tags,
  filter,
  onFilter,
  onOpen,
  onCapture,
}) {
  return (
    <section className="wall" id="wall">
      <div className="wall-head">
        <div className="wall-title">
          <h2>声音琥珀墙</h2>
          <p>
            {total > 0 ? `已经收藏 ${String(total).padStart(2, '0')} 个声音瞬间` : '还没有声音被留下'}
            <span className="dot-sep" />
            点开任意一颗，重新听见那一刻
          </p>
        </div>
        <div className="filter-bar" role="group" aria-label="按标签筛选">
          <button
            className={`filter-chip ${filter === '全部' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onFilter('全部')}
          >
            全部
            <span>{String(total).padStart(2, '0')}</span>
          </button>
          {tags.map((tag) => (
            <button
              key={tag.name}
              className={`filter-chip ${filter === tag.name ? 'is-active' : ''}`}
              type="button"
              onClick={() => onFilter(tag.name)}
            >
              {tag.name}
              <span>{String(tag.count).padStart(2, '0')}</span>
            </button>
          ))}
        </div>
      </div>

      {ambers.length === 0 ? (
        <div className="wall-empty">
          <span className="empty-ring" aria-hidden="true" />
          <p>{filter === '全部' ? '墙上还没有琥珀。' : `还没有「${filter}」的琥珀。`}</p>
          <button className="btn btn-solid" type="button" onClick={onCapture}>
            <PlusIcon />
            收录一段声音
          </button>
        </div>
      ) : (
        <div className="wall-grid">
          {ambers.map((amber, index) => (
            <AmberCard key={amber.id} amber={amber} index={index} onOpen={onOpen} />
          ))}
          <button className="add-tile" type="button" onClick={onCapture}>
            <span className="add-ring">
              <PlusIcon />
            </span>
            <span className="add-title">收录新琥珀</span>
            <span className="add-sub">录一段，或上传已有的声音</span>
          </button>
        </div>
      )}
    </section>
  )
}
