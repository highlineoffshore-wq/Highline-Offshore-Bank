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
    <div className="relative min-h-dvh overflow-hidden bg-[#121417] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-12%,rgba(30,110,180,0.14),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.022]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cpath fill='%23fff' d='M40 0l40 40-40 40L0 40z'/%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-1/4 h-[32rem] w-[32rem] rounded-full bg-bw-blue-600/12 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid min-h-dvh max-w-[1400px] lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between border-r border-white/[0.06] px-10 py-12 lg:flex xl:px-14">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-white"
            >
              <span aria-hidden className="text-slate-600">
                ←
              </span>
              Public banking site
            </Link>
            <div className="mt-14">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-bw-red-500/90">
                Operator console
              </p>
              <h1 className="mt-3 max-w-md font-display text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
                Secure access to institution configuration
              </h1>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-500">
                Manage white-label copy, approvals, product labels, and theme
                tokens from a single operator workspace.
              </p>
            </div>
          </div>
          <ul className="space-y-4 text-xs leading-relaxed text-slate-600">
            <li className="flex gap-3">
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-bw-blue-500/80"
                aria-hidden
              />
              Authorized personnel only. Activity should follow your bank&apos;s
              access-control policy.
            </li>
            <li className="flex gap-3">
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-bw-blue-500/80"
                aria-hidden
              />
              Never commit{' '}
              <code className="rounded bg-black/40 px-1 font-mono text-slate-500">
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
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-white"
            >
              <span aria-hidden>←</span> Public site
            </Link>
            <LogoMark
              className="h-9 w-9 opacity-90"
              variant="dark"
              imageSrc={cfg.bankLogoSrc || undefined}
              alt=""
            />
          </div>

          <div className="mx-auto w-full max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.65)] backdrop-blur-xl ring-1 ring-white/[0.04] sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-bw-red-700 to-bw-red-600 shadow-lg shadow-bw-red-950/35">
              <ShieldIcon className="h-7 w-7 text-white" />
            </div>
            <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-bw-red-500/90">
              Authenticate
            </p>
            <h2 className="mt-2 text-center font-display text-2xl font-semibold tracking-tight">
              Operator sign-in
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-slate-500">
              Paste the same value as{' '}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                ADMIN_API_SECRET
              </code>{' '}
              from{' '}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                server/.env
              </code>
              . The UI talks to the API through Vite on{' '}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                /api
              </code>
              , forwarded to{' '}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                NOTIFY_PORT
              </code>{' '}
              in that file. From the repo root run{' '}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                npm run dev
              </code>{' '}
              (API + Vite) or{' '}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                npm run dev:web
              </code>{' '}
              (starts the API if it is not already up, then Vite). For Vite only, use{' '}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                npm run vite:only
              </code>{' '}
              and run{' '}
              <code className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                npm run dev:api
              </code>{' '}
              in another terminal.
            </p>

            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <div>
                <label
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                  htmlFor="admin-secret"
                >
                  Admin secret
                </label>
                <input
                  id="admin-secret"
                  type="password"
                  autoComplete="current-password"
                  className="mt-2 w-full rounded-xl border border-white/[0.1] bg-black/40 px-4 py-3.5 text-sm text-white outline-none ring-bw-blue-500/0 transition placeholder:text-slate-600 focus:border-bw-blue-500/55 focus:ring-2 focus:ring-bw-blue-500/15"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Paste your secret key"
                />
              </div>
              {err ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100"
                >
                  {err}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={busy || !secret.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-bw-red-700 to-bw-red-600 py-3.5 text-sm font-semibold tracking-wide text-white shadow-lg shadow-bw-red-950/30 transition hover:from-bw-red-600 hover:to-bw-red-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? 'Verifying…' : 'Unlock console'}
              </button>
            </form>
          </div>

          <p className="mx-auto mt-8 max-w-md text-center text-[11px] leading-relaxed text-slate-600 lg:hidden">
            Customer online banking uses the public site and signed-in app. This
            console is for configuration, approvals, and support workflows.
          </p>
        </div>
      </div>
    </div>
  )
}
