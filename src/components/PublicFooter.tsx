import { Link } from 'react-router-dom'
import { useBankConfig } from '../contexts/BankConfigContext'

const linkClass =
  'text-bw-muted transition-colors hover:text-bw-navy-900 hover:underline decoration-bw-blue-500/40 underline-offset-2'

export function PublicFooter() {
  const cfg = useBankConfig()
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-bw-sand-200 bg-gradient-to-b from-bw-sand-100 to-bw-sand-200/80 text-bw-muted">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-bw-navy-900">
            Everyday money
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link className={linkClass} to="/personal">
                Household banking hub
              </Link>
            </li>
            <li>
              <Link className={linkClass} to="/personal">
                Checking &amp; savings stacks
              </Link>
            </li>
            <li>
              <Link className={linkClass} to="/personal">
                CDs &amp; money markets
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-bw-navy-900">
            Borrow smarter
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link className={linkClass} to="/personal">
                Cards &amp; lines
              </Link>
            </li>
            <li>
              <Link className={linkClass} to="/personal">
                Home lending desk
              </Link>
            </li>
            <li>
              <Link className={linkClass} to="/personal">
                Installment loans
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-bw-navy-900">
            Grow &amp; plan
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link className={linkClass} to="/wealth">
                Advisory bench
              </Link>
            </li>
            <li>
              <Link className={linkClass} to="/wealth">
                Retirement runway
              </Link>
            </li>
            <li>
              <Link className={linkClass} to="/wealth">
                Education funding lab
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-bw-navy-900">
            Stay safe
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a className={linkClass} href="#">
                Privacy &amp; data care
              </a>
            </li>
            <li>
              <a className={linkClass} href="#">
                Fraud intelligence
              </a>
            </li>
            <li>
              <a className={linkClass} href="#">
                Channel hygiene tips
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-bw-sand-200/90 bg-white/70">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed text-bw-muted sm:px-6">
          <p className="max-w-4xl">
            {cfg.bankName} {cfg.legalDemoFooter}
          </p>
          <p className="mt-3 font-medium text-bw-navy-900/80">
            © {year} {cfg.bankName}. {cfg.legalCopyright}
          </p>
          <p className="mt-4">
            <Link
              to="/admin/login"
              className="font-semibold text-bw-navy-900/70 transition hover:text-bw-navy-900 hover:underline"
            >
              Operator console
            </Link>{' '}
            <span className="text-bw-muted">(credentials required)</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
