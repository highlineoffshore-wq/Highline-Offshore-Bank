import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import { fetchAdminOverview, getAdminToken, type AdminOverview } from '../lib/adminApi'
import { OperatorDashboardPanels } from '../components/admin/OperatorDashboardPanels'

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-24 rounded-xl bg-white" />
      <div className="h-72 rounded-xl bg-white" />
      <div className="h-56 rounded-xl bg-white" />
    </div>
  )
}

export function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [overviewUpdatedAt, setOverviewUpdatedAt] = useState<string | null>(
    null,
  )
  const [loadErr, setLoadErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getAdminToken()) return
    ;(async () => {
      try {
        const ov = await fetchAdminOverview()
        setOverview(ov)
        setOverviewUpdatedAt(new Date().toISOString())
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Load failed.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!getAdminToken()) return
    const refreshOverview = () => {
      void fetchAdminOverview()
        .then((ov) => {
          setOverview(ov)
          setOverviewUpdatedAt(new Date().toISOString())
        })
        .catch(() => {
          /* keep last good snapshot */
        })
    }
    const id = window.setInterval(refreshOverview, 12_000)
    function onFocus() {
      refreshOverview()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <AdminConsoleShell
      title="Dashboard"
      breadcrumb="Bank admin"
      subtitle="Ledger snapshot and queues. Use the sidebar for user management, settings, and other tools."
    >
      {loading ? (
        <LoadingSkeleton />
      ) : loadErr ? (
        <div className="max-w-xl rounded-2xl border border-red-500/25 bg-red-950/30 p-6">
          <h2 className="font-display text-lg font-semibold text-red-100">
            Could not load overview
          </h2>
          <p className="mt-2 text-sm text-red-200/80">{loadErr}</p>
          <button
            type="button"
            onClick={() => {
              setLoadErr('')
              setLoading(true)
              ;(async () => {
                try {
                  const ov = await fetchAdminOverview()
                  setOverview(ov)
                  setOverviewUpdatedAt(new Date().toISOString())
                } catch (e) {
                  setLoadErr(e instanceof Error ? e.message : 'Load failed.')
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
        <div className="pb-4">
          <OperatorDashboardPanels
            overview={overview}
            overviewUpdatedAt={overviewUpdatedAt}
          />
        </div>
      )}
    </AdminConsoleShell>
  )
}
