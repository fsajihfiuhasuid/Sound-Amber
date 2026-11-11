import { PlusIcon } from './Icons'
import { formatSerial } from '../lib/format'

export default function Header({ count, onCapture }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="声音琥珀，回到顶部">
        <span className="brand-gem" aria-hidden="true" />
        <span className="brand-copy">
          <span className="brand-cn">声音琥珀</span>
          <span className="brand-en">SOUND AMBER</span>
        </span>
      </a>
      <nav className="site-nav" aria-label="主导航">
        <a href="#wall">
          琥珀墙
          <sup>{formatSerial(count)}</sup>
        </a>
      </nav>
      <button className="btn btn-line header-cta" type="button" onClick={onCapture}>
        <PlusIcon />
        收录声音
      </button>
    </header>
  )
}
