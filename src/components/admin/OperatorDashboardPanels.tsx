import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/money'
import type { AdminOverview } from '../../lib/adminApi'

const card =
  'rounded-xl border border-bw-sand-200 bg-white p-5 shadow-sm transition hover:border-bw-blue-600/25'

function fmtWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function StatCard({
  label,
  value,
  sub,
  iconWrapClass,
  children,
}: {
  label: string
  value: string
  sub?: string
  iconWrapClass: string
  children: React.ReactNode
}) {
  return (
    <div className={card}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-bw-navy-950">
            {value}
          </p>
          {sub ? (
            <p className="mt-1 text-xs leading-snug text-slate-500">{sub}</p>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function IconUsers({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.48-4.198M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z"
      />
    </svg>
  )
}

function IconChat({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337L5.05 21l1.395-3.72C5.512 15.042 5 13.574 5 12c0-4.694 4.03-8.25 9-8.25s9 3.556 9 8.25z"
      />
    </svg>
  )
}

function IconClock({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function IconDown({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 8.25h19.5M2.25 8.25l1.409 9.932a2.25 2.25 0 002.227 1.932h12.228a2.25 2.25 0 002.227-1.932L21.75 8.25M12 3v12.75m0 0l-3.75-3.75M12 15.75l3.75-3.75"
      />
    </svg>
  )
}

function IconUp({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75h19.5M2.25 15.75l1.409-9.932a2.25 2.25 0 012.227-1.932h12.228a2.25 2.25 0 012.227 1.932L21.75 15.75M12 21V8.25m0 0L8.25 12M12 8.25l3.75 3.75"
      />
    </svg>
  )
}

function pillPending() {
  return 'rounded-md bg-[#ef4444]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f87171]'
}

function normalizeOverview(o: AdminOverview | null): AdminOverview {
  if (!o) {
    return {
      customerCount: 0,
      approvalsPending: 0,
      approvalsApproved: 0,
      approvalsRejected: 0,
      approvalsTotal: 0,
      totalBalanceCents: 0,
      adminDepositsCents: 0,
      adminWithdrawalsCents: 0,
      adminNetOperatorCents: 0,
      verifiedUsersCount: 0,
      newSignups7d: 0,
      suspendedCount: 0,
      pendingKycCount: 0,
      openSupportTicketsCount: 0,
      topCustomersByBalance: [],
      pendingApprovalsPreview: [],
      recentApprovedApprovals: [],
      recentActivity: [],
    }
  }
  return {
    ...o,
    totalBalanceCents: o.totalBalanceCents ?? 0,
    adminDepositsCents: o.adminDepositsCents ?? 0,
    adminWithdrawalsCents: o.adminWithdrawalsCents ?? 0,
    adminNetOperatorCents: o.adminNetOperatorCents ?? 0,
    verifiedUsersCount: o.verifiedUsersCount ?? 0,
    newSignups7d: o.newSignups7d ?? 0,
    suspendedCount: o.suspendedCount ?? 0,
    pendingKycCount: o.pendingKycCount ?? 0,
    openSupportTicketsCount: o.openSupportTicketsCount ?? 0,
    topCustomersByBalance: o.topCustomersByBalance ?? [],
    pendingApprovalsPreview: o.pendingApprovalsPreview ?? [],
    recentApprovedApprovals: o.recentApprovedApprovals ?? [],
    recentActivity: o.recentActivity ?? [],
  }
}

export function OperatorDashboardPanels({
  overview,
  overviewUpdatedAt,
}: {
  overview: AdminOverview | null
  overviewUpdatedAt?: string | null
}) {
  const v = normalizeOverview(overview)

  return (
    <div id="admin-dashboard-home" className="scroll-mt-28 space-y-6">
      {overviewUpdatedAt ? (
        <p className="text-[11px] text-slate-500">
          Ledger and balances last synced{' '}
          <span className="font-medium text-slate-400">
            {fmtWhen(overviewUpdatedAt)}
          </span>{' '}
          (auto-refresh every 12s and when you return to this tab).
        </p>
      ) : null}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          label="Total users"
          value={v.customerCount.toLocaleString()}
          sub="Registered online banking profiles"
          iconWrapClass="bg-bw-blue-600/15 text-bw-blue-500"
        >
          <IconUsers />
        </StatCard>
        <StatCard
          label="Pending KYC"
          value={v.pendingKycCount.toLocaleString()}
          sub="Identity & document queue — use KYC verification in the sidebar"
          iconWrapClass="bg-amber-500/15 text-amber-300"
        >
          <IconClock />
        </StatCard>
        <Link to="/admin/support" className="min-w-0">
          <StatCard
            label="Open support tickets"
            value={v.openSupportTicketsCount.toLocaleString()}
            sub="Open + pending (not resolved) — Service → Support tickets"
            iconWrapClass="bg-violet-500/15 text-violet-200"
          >
            <IconChat />
          </StatCard>
        </Link>
        <StatCard
          label="Operator deposits (audit)"
          value={formatCurrency(v.adminDepositsCents)}
          sub="Sum of branch/operator credits in recent audit log"
          iconWrapClass="bg-[#10b981]/15 text-[#34d399]"
        >
          <IconDown />
        </StatCard>
        <StatCard
          label="Operator withdrawals (audit)"
          value={formatCurrency(v.adminWithdrawalsCents)}
          sub="Sum of operator debits in recent audit log"
          iconWrapClass="bg-[#ef4444]/15 text-[#f87171]"
        >
          <IconUp />
        </StatCard>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
        <div className={`${card} min-w-0 lg:col-span-1`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Total balance
          </p>
          <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-bw-navy-950">
            {formatCurrency(v.totalBalanceCents)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Aggregate of all customer deposit account balances on file.
          </p>
        </div>
        <div className={`${card} min-w-0 lg:col-span-1`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Operator net (audit)
          </p>
          <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-bw-navy-950">
            {formatCurrency(v.adminNetOperatorCents)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Deposits minus withdrawals recorded for operator adjustments.
          </p>
        </div>
        <div className={`${card} min-w-0 lg:col-span-1`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Approvals pending
          </p>
          <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-bw-navy-950">
            {v.approvalsPending.toLocaleString()}
          </p>
          <Link
            to="/admin/transactions"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-bw-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-bw-navy-800"
          >
            Review queue
          </Link>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bw-sand-200 pb-4">
              <h2 className="text-sm font-semibold text-bw-navy-950">
                Recent approved activity
              </h2>
              <Link
                to="/admin/transactions"
                className="text-xs font-semibold text-bw-blue-500 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 w-full min-w-0 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-bw-sand-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4 font-medium">When</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 font-medium">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bw-sand-200">
                  {v.recentApprovedApprovals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-6 text-center text-sm text-slate-500"
                      >
                        No approved items yet.
                      </td>
                    </tr>
                  ) : (
                    v.recentApprovedApprovals.map((row) => (
                      <tr key={row.id} className="text-slate-300">
                        <td className="py-3 pr-4 align-top text-xs text-slate-500">
                          {fmtWhen(row.when)}
                        </td>
                        <td className="min-w-0 py-3 pr-4 align-top font-mono text-xs text-slate-400">
                          {row.type}
                        </td>
                        <td className="min-w-0 py-3 align-top break-words text-slate-200">
                          {row.title}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={card}>
            <h2 className="border-b border-bw-sand-200 pb-4 text-sm font-semibold text-bw-navy-950">
              Admin notifications
            </h2>
            <ul className="mt-4 space-y-3">
              {v.recentActivity.length === 0 ? (
                <li className="text-sm text-slate-500">No audit events yet.</li>
              ) : (
                v.recentActivity.map((e, i) => (
                  <li
                    key={`${e.ts}-${i}`}
                    className="rounded-lg border border-bw-sand-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-300"
                  >
                    <span className="text-xs text-slate-500">{fmtWhen(e.ts)}</span>
                    <span className="mt-1 block font-medium text-slate-200">
                      {e.action}
                    </span>
                    {e.target ? (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {e.target}
                      </span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div className={card}>
            <h2 className="border-b border-bw-sand-200 pb-4 text-sm font-semibold text-bw-navy-950">
              User statistics
            </h2>
            <div className="mt-4 grid min-w-0 grid-cols-2 gap-3">
              {(
                [
                  ['Active users', v.customerCount.toLocaleString()],
                  ['Verified (PIN set)', v.verifiedUsersCount.toLocaleString()],
                  ['New (7d)', v.newSignups7d.toLocaleString()],
                  ['Suspended', v.suspendedCount.toLocaleString()],
                ] as const
              ).map(([k, val]) => (
                <div
                  key={k}
                  className="min-w-0 rounded-lg border border-bw-sand-200 bg-white/80 px-3 py-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {k}
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums text-bw-navy-950">
                    {val}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bw-sand-200 pb-4">
              <h2 className="text-sm font-semibold text-bw-navy-950">
                Pending requests
              </h2>
              <Link
                to="/admin/transactions"
                className="rounded-lg bg-bw-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-bw-navy-800"
              >
                Manage
              </Link>
            </div>
            <div className="mt-4 w-full min-w-0 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-bw-sand-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3 font-medium">Request</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bw-sand-200">
                  {v.pendingApprovalsPreview.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="py-6 text-center text-sm text-slate-500"
                      >
                        Queue is clear.
                      </td>
                    </tr>
                  ) : (
                    v.pendingApprovalsPreview.map((row) => (
                      <tr key={row.id}>
                        <td className="min-w-0 max-w-[min(100%,240px)] py-3 pr-3 align-top sm:max-w-none">
                          <p className="break-words text-slate-200">{row.title}</p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {row.type}
                          </p>
                        </td>
                        <td className="py-3 align-top">
                          <span className={pillPending()}>Pending</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bw-sand-200 pb-4">
              <h2 className="text-sm font-semibold text-bw-navy-950">
                Ledger balances
              </h2>
              <span className="text-[10px] text-slate-500">Top by balance</span>
            </div>
            <div className="mt-4 w-full min-w-0 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-bw-sand-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3 font-medium">User</th>
                    <th className="pb-2 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bw-sand-200">
                  {v.topCustomersByBalance.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="py-6 text-center text-sm text-slate-500"
                      >
                        No customers yet.
                      </td>
                    </tr>
                  ) : (
                    v.topCustomersByBalance.map((row) => (
                      <tr key={row.id}>
                        <td className="py-3 pr-3 align-top">
                          <Link
                            to={`/admin/users/${encodeURIComponent(row.id)}`}
                            className="font-medium text-bw-blue-500 hover:underline"
                          >
                            {row.displayName}
                          </Link>
                          <p className="truncate text-xs text-slate-500">
                            {row.email}
                          </p>
                          {row.internetBankingId ? (
                            <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                              IB {row.internetBankingId}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-3 text-right font-semibold tabular-nums text-bw-navy-950">
                          {formatCurrency(row.totalBalanceCents)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
              Balances are summed from each customer&apos;s deposit accounts on
              file (same source as customer profile). Click a name for full
              detail.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
