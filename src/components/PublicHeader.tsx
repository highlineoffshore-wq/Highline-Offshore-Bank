import { NavLink } from 'react-router-dom'
import { useBankConfig } from '../contexts/BankConfigContext'
import { LogoMark } from './LogoMark'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-full px-3.5 py-2 text-sm font-semibold tracking-tight transition-all duration-200',
    isActive
      ? 'bg-bw-sky-100 text-bw-navy-900 shadow-sm ring-1 ring-bw-sand-200'
      : 'text-bw-navy-900/90 hover:bg-bw-sand-100 hover:text-bw-navy-950',
  ].join(' ')

export function PublicHeader() {
  const cfg = useBankConfig()
  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-bw-sand-200 bg-gradient-to-r from-bw-sand-100 to-white text-bw-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 text-xs font-medium">
          <span className="hidden sm:inline">
            {cfg.supportPhone ? `Questions? ${cfg.supportPhone}` : null}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 sm:justify-start">
            <a
              className="transition hover:text-bw-navy-950"
              href="#"
              aria-label="Branch and ATM locator"
            >
              Locations
            </a>
            <a className="transition hover:text-bw-navy-950" href="#">
              Support
            </a>
            <a className="transition hover:text-bw-navy-950" href="#">
              Español
            </a>
          </div>
        </div>
      </div>
      <div className="border-b border-bw-sand-200 bg-white shadow-bw-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:py-4">
          <NavLink
            to="/"
            className="group flex items-center gap-3.5 text-left text-bw-navy-950 no-underline"
          >
            <span className="rounded-xl bg-bw-sky-100 p-1 ring-1 ring-bw-sand-200 transition group-hover:bg-bw-sand-100">
              <LogoMark
                className="h-10 w-10 shrink-0"
                variant="light"
                imageSrc={cfg.bankLogoSrc || undefined}
                alt=""
              />
            </span>
            <div>
              <span className="font-display text-xl font-semibold tracking-tight sm:text-[1.35rem]">
                {cfg.bankName}
              </span>
              <p className="mt-0.5 text-xs font-medium leading-snug text-bw-muted">
                {cfg.taglineHeader}
              </p>
            </div>
          </NavLink>
          <nav className="flex flex-wrap items-center gap-1.5 sm:justify-end sm:gap-2">
            <NavLink to="/personal" className={navClass}>
              Personal
            </NavLink>
            <NavLink to="/small-business" className={navClass}>
              Small business
            </NavLink>
            <NavLink to="/wealth" className={navClass}>
              Wealth
            </NavLink>
            <NavLink
              to="/sign-in"
              className="ml-0.5 inline-flex items-center justify-center rounded-full bg-bw-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-900/15 ring-1 ring-bw-sand-200 transition hover:bg-bw-navy-800 hover:shadow-lg sm:ml-1"
            >
              Sign in
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  )
}
