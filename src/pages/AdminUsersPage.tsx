import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import { AdminCustomersPanel } from '../components/admin/AdminCustomersPanel'
import {
  fetchAdminCustomers,
  getAdminToken,
  type AdminCustomerRow,
} from '../lib/adminApi'

export function AdminUsersPage() {
  const [rows, setRows] = useState<AdminCustomerRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getAdminToken()) return
    ;(async () => {
      try {
        setRows(await fetchAdminCustomers())
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Load failed.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <AdminConsoleShell
      title="User management"
      breadcrumb="Bank admin"
      subtitle="Browse enrolled customers from the live store. Banking IDs and PIN status are shown; secrets are never returned."
    >
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-14 rounded-xl bg-white" />
          <div className="h-72 rounded-xl bg-white" />
        </div>
      ) : loadErr ? (
        <div className="max-w-xl rounded-2xl border border-red-500/25 bg-red-950/30 p-6">
          <h2 className="font-display text-lg font-semibold text-red-100">
            Could not load customers
          </h2>
          <p className="mt-2 text-sm text-red-200/80">{loadErr}</p>
          <button
            type="button"
            onClick={() => {
              setLoadErr('')
              setLoading(true)
              ;(async () => {
                try {
                  setRows(await fetchAdminCustomers())
                } catch (e) {
                  setLoadErr(
                    e instanceof Error ? e.message : 'Load failed.',
                  )
                } finally {
                  setLoading(false)
                }
              })()
            }}
            className="mt-5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-red-900 transition hover:bg-red-50"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <AdminCustomersPanel rows={rows} />
          <p className="text-xs text-slate-500">
            <Link
              to="/admin"
              className="font-semibold text-bw-blue-500 hover:text-bw-navy-950"
            >
              ← Back to dashboard
            </Link>
            <span className="mx-2 text-slate-600">·</span>
            Bank configuration and KPIs stay on the main dashboard.
          </p>
        </div>
      )}
    </AdminConsoleShell>
  )
}
