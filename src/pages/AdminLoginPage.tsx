import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogoMark } from '../components/LogoMark'
import { useBankConfig } from '../contexts/BankConfigContext'
import {
  getAdminToken,
  setAdminToken,
  verifyAdminToken,
} from '../lib/adminApi'

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        d="M12 3l8 4v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AdminLoginPage() {
  const cfg = useBankConfig()
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (getAdminToken()) navigate('/admin', { replace: true })
  }, [navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const result = await verifyAdminToken(secret.trim())
      if (!result.ok) {
        setErr(
          result.message ??
            'Invalid secret, or the admin API is disabled. Set ADMIN_API_SECRET in server/.env and restart the server.',
        )
        return
      }
      setAdminToken(secret.trim())
      navigate('/admin', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bw-sand-100 text-bw-navy-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-12%,rgba(251,191,36,0.22),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cpath fill='%231c1917' d='M40 0l40 40-40 40L0 40z'/%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-1/4 h-[32rem] w-[32rem] rounded-full bg-bw-blue-500/20 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid min-h-dvh max-w-[1400px] lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between border-r border-bw-sand-200 bg-white/60 px-10 py-12 backdrop-blur-sm lg:flex xl:px-14">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-bw-muted transition hover:text-bw-navy-950"
            >
              <span aria-hidden className="text-bw-muted">
                ←
              </span>
              Public banking site
            </Link>
            <div className="mt-14">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-bw-blue-600">
                Operator console
              </p>
              <h1 className="mt-3 max-w-md font-display text-3xl font-semibold leading-tight tracking-tight text-bw-navy-950 xl:text-4xl">
                Secure access to institution configuration
              </h1>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-bw-muted">
                Manage white-label copy, approvals, product labels, and theme
                tokens from a single operator workspace.
              </p>
            </div>
          </div>
          <ul className="space-y-4 text-xs leading-relaxed text-bw-muted">
            <li className="flex gap-3">
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-bw-blue-600"
                aria-hidden
              />
              Authorized personnel only. Activity should follow your bank&apos;s
              access-control policy.
            </li>
            <li className="flex gap-3">
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-bw-blue-600"
                aria-hidden
              />
              Never commit{' '}
              <code className="rounded bg-bw-sand-200 px-1 font-mono text-bw-navy-900">
                server/.env
              </code>{' '}
              or share secrets in email or chat.
            </li>
          </ul>
        </div>

        <div className="flex flex-col justify-center px-4 py-12 sm:px-8 lg:px-10">
          <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-bw-muted transition hover:text-bw-navy-950"
            >
              <span aria-hidden>←</span> Public site
            </Link>
            <LogoMark
              className="h-9 w-9 opacity-90"
              variant="light"
              imageSrc={cfg.bankLogoSrc || undefined}
              alt=""
            />
          </div>

          <div className="mx-auto w-full max-w-md rounded-2xl border border-bw-sand-200 bg-white p-8 shadow-bw-card ring-1 ring-bw-sand-200/80 sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-bw-blue-600 to-bw-blue-500 shadow-lg shadow-amber-900/15">
              <ShieldIcon className="h-7 w-7 text-white" />
            </div>
            <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-bw-blue-600">
              Authenticate
            </p>
            <h2 className="mt-2 text-center font-display text-2xl font-semibold tracking-tight text-bw-navy-950">
              Operator sign-in
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-bw-muted">
              Paste the same value as{' '}
              <code className="rounded-md bg-bw-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-bw-navy-900">
                ADMIN_API_SECRET
              </code>{' '}
              from{' '}
              <code className="rounded-md bg-bw-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-bw-navy-900">
                server/.env
              </code>
              . The UI talks to the API through Vite on{' '}
              <code className="rounded-md bg-bw-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-bw-navy-900">
                /api
              </code>
              , forwarded to{' '}
              <code className="rounded-md bg-bw-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-bw-navy-900">
                NOTIFY_PORT
              </code>{' '}
              in that file. From the repo root run{' '}
              <code className="rounded-md bg-bw-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-bw-navy-900">
                npm run dev
              </code>{' '}
              (API + Vite) or{' '}
              <code className="rounded-md bg-bw-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-bw-navy-900">
                npm run dev:web
              </code>{' '}
              (starts the API if it is not already up, then Vite). For Vite only, use{' '}
              <code className="rounded-md bg-bw-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-bw-navy-900">
                npm run vite:only
              </code>{' '}
              and run{' '}
              <code className="rounded-md bg-bw-sand-100 px-1.5 py-0.5 font-mono text-[11px] text-bw-navy-900">
                npm run dev:api
              </code>{' '}
              in another terminal.
            </p>

            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <div>
                <label
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-bw-muted"
                  htmlFor="admin-secret"
                >
                  Admin secret
                </label>
                <input
                  id="admin-secret"
                  type="password"
                  autoComplete="current-password"
                  className="mt-2 w-full rounded-xl border border-bw-sand-200 bg-bw-sand-100 px-4 py-3.5 text-sm text-bw-navy-950 outline-none ring-bw-blue-500/0 transition placeholder:text-bw-muted focus:border-bw-blue-600/55 focus:bg-white focus:ring-2 focus:ring-bw-blue-600/15"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Paste your secret key"
                />
              </div>
              {err ? (
                <div
                  role="alert"
                  className="rounded-xl border border-bw-red-600/30 bg-red-50 px-4 py-3 text-sm text-bw-red-800"
                >
                  {err}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={busy || !secret.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-bw-blue-600 to-bw-navy-800 py-3.5 text-sm font-semibold tracking-wide text-white shadow-lg shadow-amber-900/20 transition hover:from-bw-navy-800 hover:to-bw-blue-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? 'Verifying…' : 'Unlock console'}
              </button>
            </form>
          </div>

          <p className="mx-auto mt-8 max-w-md text-center text-[11px] leading-relaxed text-bw-muted lg:hidden">
            Customer online banking uses the public site and signed-in app. This
            console is for configuration, approvals, and support workflows.
          </p>
        </div>
      </div>
    </div>
  )
}
