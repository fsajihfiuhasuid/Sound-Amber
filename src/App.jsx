import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import Wall from './components/Wall'
import DetailOverlay from './components/DetailOverlay'
import CaptureModal from './components/CaptureModal'
import { createSeedAmbers } from './audio/seeds'
import { loadAmbers, patchAmber, removeAmber, saveAmber } from './audio/storage'
import { randomId, TAGS } from './lib/format'

const SEEDED_KEY = 'sound-amber-seeded-v1'

export default function App() {
  const [ambers, setAmbers] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [filter, setFilter] = useState('全部')
  const [toast, setToast] = useState('')
  const [storageWarning, setStorageWarning] = useState(false)
  const toastTimer = useRef(0)

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      let list = []
      try {
        list = await loadAmbers()
        if (!cancelled && list.length === 0 && !localStorage.getItem(SEEDED_KEY)) {
          const seeds = createSeedAmbers()
          await Promise.all(seeds.map((seed) => saveAmber(seed)))
          localStorage.setItem(SEEDED_KEY, '1')
          list = seeds
        }
      } catch (err) {
        setStorageWarning(true)
        try {
          localStorage.setItem(SEEDED_KEY, '1')
        } catch {
          // Ignore private-mode storage restrictions.
        }
        list = createSeedAmbers()
      }
      if (!cancelled) {
        setAmbers(list.sort((a, b) => a.serial - b.serial))
      }
    }
    boot()
    return () => {
      cancelled = true
      window.clearTimeout(toastTimer.current)
    }
  }, [])

  const showToast = (message) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3200)
  }

  const sorted = useMemo(
    () => (ambers ? [...ambers].sort((a, b) => a.serial - b.serial) : []),
    [ambers],
  )
  const hero = sorted.length ? sorted[sorted.length - 1] : null
  const wallOrder = useMemo(() => [...sorted].reverse(), [sorted])

  const tagList = useMemo(() => {
    const counts = new Map()
    sorted.forEach((amber) => {
      ;(amber.tags || []).forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      })
    })
    const ordered = [...TAGS, ...counts.keys()].filter(
      (tag, index, array) => array.indexOf(tag) === index,
    )
    return ordered
      .filter((tag) => counts.has(tag))
      .map((tag) => ({ name: tag, count: counts.get(tag) }))
  }, [sorted])

  useEffect(() => {
    if (filter !== '全部' && !tagList.some((tag) => tag.name === filter)) {
      setFilter('全部')
    }
  }, [filter, tagList])

  const visibleAmbers = useMemo(
    () =>
      filter === '全部'
        ? wallOrder
        : wallOrder.filter((amber) => amber.tags?.includes(filter)),
    [wallOrder, filter],
  )

  const activeAmber = activeId ? ambers?.find((amber) => amber.id === activeId) : null
  const activeIndex = activeAmber
    ? wallOrder.findIndex((amber) => amber.id === activeAmber.id)
    : -1

  const openAmber = (id) => {
    if (id) setActiveId(id)
  }

  const navigateAmber = (direction) => {
    if (!wallOrder.length) return
    const current = activeIndex < 0 ? 0 : activeIndex
    const next = (current + direction + wallOrder.length) % wallOrder.length
    setActiveId(wallOrder[next].id)
  }

  const handleRename = async (id, title) => {
    setAmbers((prev) => prev.map((amber) => (amber.id === id ? { ...amber, title } : amber)))
    try {
      await patchAmber(id, { title })
    } catch {
      showToast('名字没能存进本地，请再试一次')
    }
  }

  const handleDelete = async (id) => {
    try {
      await removeAmber(id)
      setAmbers((prev) => prev.filter((amber) => amber.id !== id))
      setActiveId(null)
      showToast('已从墙上取下这颗琥珀')
    } catch {
      showToast('没能取下，请再试一次')
    }
  }

  const handleCreate = async (draft) => {
    const serial = Math.max(0, ...(ambers || []).map((amber) => amber.serial || 0)) + 1
    const amber = {
      id: randomId(),
      serial,
      title: draft.title,
      note: draft.note,
      tags: draft.tags,
      createdAt: Date.now(),
      duration: draft.analysis.duration,
      peaks: draft.analysis.peaks,
      features: draft.analysis.features,
      audioBlob: draft.blob,
    }
    await saveAmber(amber)
    setAmbers((prev) => [...(prev || []), amber])
    setCaptureOpen(false)
    setActiveId(amber.id)
    showToast('已封入琥珀墙')
  }

  if (!ambers) {
    return (
      <main className="boot">
        <span className="boot-orb" aria-hidden="true" />
        <p>正在打开收藏室</p>
        <span className="boot-en">SOUND AMBER</span>
      </main>
    )
  }

  return (
    <div className="app">
      <div className="page-grain" aria-hidden="true" />
      <Header count={ambers.length} onCapture={() => setCaptureOpen(true)} />
      <main>
        <Hero
          amber={hero}
          total={ambers.length}
          onCapture={() => setCaptureOpen(true)}
          onListen={openAmber}
        />
        <Wall
          ambers={visibleAmbers}
          total={ambers.length}
          tags={tagList}
          filter={filter}
          onFilter={setFilter}
          onOpen={openAmber}
          onCapture={() => setCaptureOpen(true)}
        />
      </main>
      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-gem" aria-hidden="true" />
          声音琥珀 · SOUND AMBER
        </div>
        <p>每一个声音瞬间，都值得被留下。</p>
        <span className="footer-local">本地存储 · 不上传云端</span>
      </footer>

      {storageWarning && (
        <div className="storage-warning">
          浏览器存储暂不可用，这次收藏只会保留到刷新前。
        </div>
      )}

      {activeAmber && (
        <DetailOverlay
          amber={activeAmber}
          index={activeIndex}
          total={wallOrder.length}
          onClose={() => setActiveId(null)}
          onNavigate={navigateAmber}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      )}

      {captureOpen && (
        <CaptureModal
          onClose={() => setCaptureOpen(false)}
          onSave={handleCreate}
        />
      )}

      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">
        <span className="toast-dot" />
        {toast}
      </div>
    </div>
  )
}
