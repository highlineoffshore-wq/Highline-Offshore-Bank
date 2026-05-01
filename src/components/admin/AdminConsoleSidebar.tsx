import { Link, NavLink, useLocation } from 'react-router-dom'
import { useBankConfig } from '../../contexts/BankConfigContext'
import { LogoMark } from '../LogoMark'
import {
  ADMIN_SIDEBAR_PRIMARY_NAV,
  ADMIN_SIDEBAR_WIDTH_PX,
} from './adminSidebarNav'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'group flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition',
    isActive
      ? 'bg-bw-blue-600/12 font-semibold text-bw-navy-950 ring-1 ring-bw-blue-600/35'
      : 'text-bw-muted hover:bg-bw-sand-200/80 hover:text-bw-navy-950',
  ].join(' ')

const hashLinkClass =
  'group flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-bw-muted transition hover:bg-bw-sand-200/80 hover:text-bw-navy-950'

const iconClassPrimary = 'shrink-0 text-bw-blue-600'
const iconClassMuted =
  'shrink-0 text-bw-muted group-hover:text-bw-navy-900'

function navIconClass(tone: 'primary' | 'muted') {
  return tone === 'primary' ? iconClassPrimary : iconClassMuted
}

export function AdminSidebarBrand() {
  const cfg = useBankConfig()
  return (
    <div className="flex items-center gap-2.5 border-b border-bw-sand-200 bg-white px-4 py-3.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bw-sky-100 ring-1 ring-bw-sand-200">
        <LogoMark
          className="h-4 w-4 max-h-8 max-w-8"
          variant="light"
          imageSrc={cfg.bankLogoSrc || undefined}
          alt=""
        />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-bw-muted">
          Bank admin
        </p>
        <p className="truncate text-xs text-bw-muted">Operator workspace</p>
      </div>
    </div>
  )
}

export function AdminSidebarPrimaryNav() {
  const location = useLocation()
  return (
    <nav
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain bg-bw-sand-100 px-2 py-3 [&_a_svg]:!h-4 [&_a_svg]:!w-4 [&_a_svg]:shrink-0"
      aria-label="Admin"
    >
      {ADMIN_SIDEBAR_PRIMARY_NAV.map((item) => {
        const ic = navIconClass(item.iconTone)
        if (item.kind === 'route') {
          const { Icon, label, to, end } = item
          return (
            <NavLink key={item.id} to={to} end={end} className={navLinkClass}>
              <Icon className={ic} />
              <span className="min-w-0 flex-1 break-words">{label}</span>
            </NavLink>
          )
        }
        const { Icon, label, to } = item
        return (
          <Link
            key={item.id}
            to={to}
            className={hashLinkClass}
            onClick={() => {
              const u = new URL(to, window.location.origin)
              if (u.pathname !== location.pathname) return
              const id = u.hash.replace(/^#/, '')
              if (!id) return
              queueMicrotask(() => {
                document.getElementById(id)?.scrollIntoView({
                  behavior: 'smooth',
                })
              })
            }}
          >
            <Icon className={ic} />
            <span className="min-w-0 flex-1 break-words">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminSidebarAccountActions({
  onSignOut,
}: {
  onSignOut: () => void
}) {
  return (
    <div className="border-t border-bw-sand-200 bg-white p-4">
      <Link
        to="/"
        className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-bw-muted transition hover:bg-bw-sand-100 hover:text-bw-navy-950"
      >
        View public site
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-bw-muted transition hover:bg-bw-sand-100 hover:text-bw-navy-950"
      >
        Sign out
      </button>
    </div>
  )
}

export function AdminConsoleSidebar({ onSignOut }: { onSignOut: () => void }) {
  const sidebarPx = `${ADMIN_SIDEBAR_WIDTH_PX}px`
  return (
    <aside
      className="hidden min-h-0 shrink-0 flex-col border-r border-bw-sand-200 bg-white shadow-bw-soft lg:flex"
      style={{ width: sidebarPx }}
    >
      <AdminSidebarBrand />
      <AdminSidebarPrimaryNav />
      <AdminSidebarAccountActions onSignOut={onSignOut} />
    </aside>
  )
}
