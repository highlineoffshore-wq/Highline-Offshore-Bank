import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import {
  fetchAdminApprovals,
  fetchAdminCustomers,
  getAdminToken,
  type AdminCustomerRow,
} from '../lib/adminApi'
import type { ApprovalItem } from '../types/approvals'

function blobMatch(q: string, parts: (string | null | undefined)[]) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

export function AdminSearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([])
  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getAdminToken()) return
    let cancelled = false
    ;(async () => {
      setErr('')
      setLoading(true)
      try {
        const [c, a] = await Promise.all([
          fetchAdminCustomers(),
          fetchAdminApprovals({ limit: 400 }),
        ])
        if (!cancelled) {
          setCustomers(c)
          setApprovals(a)
        }
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : 'Could not load directory.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const customerRows = useMemo(() => {
    const list = customers.filter((c) =>
      blobMatch(q, [
        c.displayName,
        c.email,
        c.id,
        c.internetBankingId ?? '',
      ]),
    )
    return q.trim() ? list : list.slice(0, 25)
  }, [customers, q])

  const approvalRows = useMemo(() => {
    const list = approvals.filter((a) =>
      blobMatch(q, [
        a.title,
        a.type,
        a.id,
        a.userId,
        a.submitterId,
        a.status,
      ]),
    )
    return q.trim() ? list : list.slice(0, 25)
  }, [approvals, q])

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <AdminConsoleShell
      title="Search"
      breadcrumb="Directory"
      subtitle={
        q.trim()
          ? `Results for “${q.trim()}” across customers and approval history.`
          : 'Search customers and requests by name, email, id, or approval type. Showing recent rows until you enter a term.'
      }
    >
      {err ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-100"
        >
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading directory…</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-xl border border-bw-sand-200 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-bw-sand-200 pb-4">
              <h2 className="text-sm font-semibold text-bw-navy-950">Customers</h2>
              <span className="text-xs text-slate-500">
                {customerRows.length} shown
              </span>
            </div>
            <ul className="mt-4 divide-y divide-bw-sand-200">
              {customerRows.length === 0 ? (
                <li className="py-6 text-center text-sm text-slate-500">
                  No matches.
                </li>
              ) : (
                customerRows.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-bw-navy-950">{c.displayName}</p>
                      <Link
                        to={`/admin/users/${encodeURIComponent(c.id)}`}
                        className="text-xs font-semibold text-bw-blue-500 hover:underline"
                      >
                        Profile →
                      </Link>
                    </div>
                    <p className="text-xs text-slate-400">{c.email}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">
                      {c.id}
                      {c.internetBankingId
                        ? ` · IB ${c.internetBankingId}`
                        : ''}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <Link
              to="/admin/users"
              className="mt-4 inline-block text-xs font-semibold text-bw-blue-500 hover:underline"
            >
              Open full user table →
            </Link>
          </section>

          <section className="rounded-xl border border-bw-sand-200 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-bw-sand-200 pb-4">
              <h2 className="text-sm font-semibold text-bw-navy-950">Approvals</h2>
              <span className="text-xs text-slate-500">
                {approvalRows.length} shown
              </span>
            </div>
            <ul className="mt-4 divide-y divide-bw-sand-200">
              {approvalRows.length === 0 ? (
                <li className="py-6 text-center text-sm text-slate-500">
                  No matches.
                </li>
              ) : (
                approvalRows.map((a) => (
                  <li key={a.id} className="py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {a.status} · {a.type}
                    </p>
                    <p className="mt-1 text-sm text-slate-200">{a.title}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">
                      {a.id}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <Link
              to="/admin/transactions"
              className="mt-4 inline-block text-xs font-semibold text-bw-blue-500 hover:underline"
            >
              Open approval queue →
            </Link>
          </section>
        </div>
      )}
    </AdminConsoleShell>
  )
}
