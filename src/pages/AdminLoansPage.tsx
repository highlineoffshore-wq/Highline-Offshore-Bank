import { Link, Navigate } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import { getAdminToken } from '../lib/adminApi'

export function AdminLoansPage() {
  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <AdminConsoleShell
      title="Loans"
      breadcrumb="Products"
      subtitle="Retail loan applications and servicing — this screen is a shell until a loan module is connected."
    >
      <div className="max-w-2xl space-y-4 rounded-xl border border-bw-sand-200 bg-white p-6">
        <p className="text-sm leading-relaxed text-slate-300">
          Customer-submitted <strong className="text-bw-navy-950">loan_application</strong>{' '}
          requests still flow through the standard approval queue today. Approve
          or reject them there; balances and product records update when the
          server applies the decision.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/transactions"
            className="rounded-lg bg-bw-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800"
          >
            Open approval queue
          </Link>
          <Link
            to="/admin"
            className="rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-bw-blue-600/35"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </AdminConsoleShell>
  )
}
