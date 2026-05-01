import { Link } from 'react-router-dom'
import type { AdminCustomerRow } from '../../lib/adminApi'

export function AdminCustomersPanel({ rows }: { rows: AdminCustomerRow[] }) {
  return (
    <section className="w-full min-w-0 rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-bw-sand-200 pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-bw-navy-950">
            Customer directory
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Enrolled customers (no credentials shown).
          </p>
        </div>
      </div>
      <div className="mt-4 w-full min-w-0 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-bw-sand-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Email</th>
              <th className="pb-2 pr-4 font-medium">Internet ID</th>
              <th className="pb-2 pr-4 font-medium">PIN</th>
              <th className="pb-2 pr-4 font-medium">Onboarding</th>
              <th className="pb-2 pr-4 font-medium">Access</th>
              <th className="pb-2 text-right font-medium">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bw-sand-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No customers yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="text-slate-300">
                  <td className="min-w-0 max-w-[10rem] break-words py-3 pr-4 font-medium text-bw-navy-950 sm:max-w-none">
                    {r.displayName}
                  </td>
                  <td className="min-w-0 max-w-[12rem] break-words py-3 pr-4 text-slate-400 sm:max-w-none">
                    {r.email}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                    {r.internetBankingId ?? '—'}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-400">
                    {r.hasTransactionPin ? 'Set' : '—'}
                  </td>
                  <td className="max-w-[10rem] py-3 pr-4 text-xs text-slate-400">
                    <span className="block text-slate-300">
                      {r.onboardingStatus ?? '—'}
                    </span>
                    {r.openAccountInterest?.length ? (
                      <span className="mt-1 block font-mono text-[10px] leading-snug text-slate-500">
                        {r.openAccountInterest.join(', ')}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {r.onlineBankingRestricted ? (
                      <span className="rounded-full bg-amber-600/25 px-2 py-0.5 font-semibold text-amber-100">
                        Restricted
                      </span>
                    ) : (
                      <span className="text-slate-500">Active</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      to={`/admin/users/${encodeURIComponent(r.id)}`}
                      className="text-xs font-semibold text-bw-blue-500 hover:text-bw-navy-950"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
