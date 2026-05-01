import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccounts } from '../contexts/AccountsContext'
import { useApprovals } from '../contexts/ApprovalsContext'
import { useAuth } from '../contexts/AuthContext'
import { useBankConfig } from '../contexts/BankConfigContext'
import { fetchCustomerKycMe } from '../lib/kycCustomerApi'
import { formatActivityListDate } from '../lib/activityWhenLabel'
import { formatCurrency } from '../lib/money'
import { AccountsOverviewSection } from '../components/AccountsOverviewSection'
import { CustomerPendingApprovals } from '../components/CustomerPendingApprovals'

export function DashboardPage() {
  const { displayName } = useAuth()
  const cfg = useBankConfig()
  const { accounts, activity, loading, error } = useAccounts()
  const { items: approvalItems } = useApprovals()
  const [kycPending, setKycPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await fetchCustomerKycMe()
        if (!cancelled && s?.status === 'pending') setKycPending(true)
      } catch {
        if (!cancelled) setKycPending(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-8">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-bw-red-600/30 bg-red-50 px-5 py-4 text-sm text-bw-red-800"
        >
          {error}
        </div>
      ) : null}

      {loading && accounts.length === 0 ? (
        <p className="text-sm text-bw-muted">Loading your accounts…</p>
      ) : null}

      {kycPending ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/35 bg-amber-50 px-5 py-4 text-sm text-amber-950"
        >
          <p className="font-semibold">Identity verification in progress</p>
          <p className="mt-1 text-amber-900/90">
            Your documents are with the compliance team. You can keep using
            online banking; we will email you if anything else is needed.{' '}
            <Link
              to="/app/kyc"
              className="font-semibold text-amber-950 underline decoration-amber-700/40 underline-offset-2 hover:text-amber-900"
            >
              View status or upload more
            </Link>
            .
          </p>
        </div>
      ) : null}

      <CustomerPendingApprovals items={approvalItems} />
      <div>
        <h1 className="font-display text-3xl font-semibold text-bw-navy-900">
          Good to see you, {displayName}
        </h1>
        <p className="mt-1 text-bw-muted">
          Here is a snapshot of your {cfg.bankNameShort} relationship. Balances
          and activity reflect your enrolled account on this service.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AccountsOverviewSection depositAccounts={accounts} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-bw-sand-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Quick actions
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  to="/app/support"
                  className="flex items-center justify-between rounded-md px-2 py-2 font-medium text-bw-navy-900 hover:bg-bw-sand-100"
                >
                  Help &amp; support
                  <span aria-hidden>→</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/app/pay?tab=bills"
                  className="flex items-center justify-between rounded-md px-2 py-2 font-medium text-bw-navy-900 hover:bg-bw-sand-100"
                >
                  Pay a bill
                  <span aria-hidden>→</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/app/pay?tab=send"
                  className="flex items-center justify-between rounded-md px-2 py-2 font-medium text-bw-navy-900 hover:bg-bw-sand-100"
                >
                  Send money to someone
                  <span aria-hidden>→</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/app/pay?tab=wire"
                  className="flex items-center justify-between rounded-md px-2 py-2 font-medium text-bw-navy-900 hover:bg-bw-sand-100"
                >
                  Wire transfer
                  <span aria-hidden>→</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/app/pay?tab=deposit"
                  className="flex items-center justify-between rounded-md px-2 py-2 font-medium text-bw-navy-900 hover:bg-bw-sand-100"
                >
                  Mobile deposit
                  <span aria-hidden>→</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/app/invest"
                  className="flex items-center justify-between rounded-md px-2 py-2 font-medium text-bw-navy-900 hover:bg-bw-sand-100"
                >
                  Plan &amp; invest
                  <span aria-hidden>→</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/app/debit-card"
                  className="flex items-center justify-between rounded-md px-2 py-2 font-medium text-bw-navy-900 hover:bg-bw-sand-100"
                >
                  Manage debit card
                  <span aria-hidden>→</span>
                </Link>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-bw-blue-500/25 bg-bw-sky-100/60 p-5">
            <p className="text-sm font-semibold text-bw-navy-900">
              Security tip
            </p>
            <p className="mt-2 text-sm text-bw-muted">
              Turn on alerts for large purchases and new device sign-ins so you
              can act quickly if something looks off.
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-bw-blue-600 hover:underline"
            >
              Manage alerts
            </button>
          </div>
        </aside>
      </div>

      <section className="rounded-xl border border-bw-sand-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bw-sand-200 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-bw-navy-900">
            Recent activity
          </h2>
          <button
            type="button"
            className="text-sm font-semibold text-bw-blue-600 hover:underline"
          >
            Download statement
          </button>
        </div>
        <ul className="divide-y divide-bw-sand-200">
          {activity.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"
            >
              <div>
                <p className="font-medium text-bw-navy-900">{row.description}</p>
                <p className="text-xs text-bw-muted">
                  {formatActivityListDate(row)}
                </p>
              </div>
              <span
                className={`font-semibold tabular-nums ${
                  row.amountCents === 0
                    ? 'text-bw-muted'
                    : row.amountCents < 0
                      ? 'text-bw-red-700'
                      : 'text-bw-blue-600'
                }`}
              >
                {row.amountCents === 0
                  ? '—'
                  : `${row.amountCents < 0 ? '' : '+'}${formatCurrency(row.amountCents)}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
