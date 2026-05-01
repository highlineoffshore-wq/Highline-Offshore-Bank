import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import {
  fetchAdminTransactions,
  getAdminToken,
  patchAdminApproval,
  postAdminReverseApproval,
  type AdminTransactionRow,
} from '../lib/adminApi'
import type { ApprovalStatus } from '../types/approvals'
import {
  engineKindLabel,
  REVERSIBLE_APPROVAL_TYPES,
  type EngineKind,
} from '../lib/adminTransactionTaxonomy'

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatMoney(cents: number | null) {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function statusPill(status: ApprovalStatus) {
  const base =
    'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide'
  if (status === 'pending')
    return `${base} bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30`
  if (status === 'approved')
    return `${base} bg-bw-blue-500/15 text-bw-sky-100 ring-1 ring-bw-blue-500/25`
  return `${base} bg-red-500/15 text-red-200 ring-1 ring-red-400/25`
}

function kindPill(kind: EngineKind) {
  const base =
    'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide'
  if (kind === 'deposit')
    return `${base} bg-bw-blue-500/15 text-bw-blue-700 ring-1 ring-bw-blue-500/25`
  if (kind === 'withdrawal') return `${base} bg-orange-500/15 text-orange-100`
  if (kind === 'transfer')
    return `${base} bg-stone-500/15 text-stone-800 ring-1 ring-stone-400/25`
  return `${base} bg-slate-600/30 text-slate-300`
}

const tabBtn = (active: boolean) =>
  [
    'rounded-lg px-4 py-2.5 text-sm font-semibold transition',
    active
      ? 'bg-bw-blue-600 text-white shadow-md shadow-amber-900/15'
      : 'border border-bw-sand-200 bg-white text-slate-300 hover:border-bw-blue-600/30 hover:bg-bw-sand-200',
  ].join(' ')

const chip = (active: boolean) =>
  [
    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
    active
      ? 'bg-bw-blue-600/25 text-white ring-1 ring-bw-blue-600/40'
      : 'bg-white text-slate-400 hover:bg-bw-sand-200 hover:text-bw-navy-950',
  ].join(' ')

function IconSearch({ className = 'h-4 w-4' }: { className?: string }) {
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
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  )
}

type ViewTab = 'live' | 'history' | 'all'

function viewTabFromQuery(raw: string | null): ViewTab | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  if (v === 'live' || v === 'history' || v === 'all') return v
  return null
}

function dollarsToCents(s: string) {
  const t = s.trim()
  if (!t) return NaN
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * 100)
}

export function AdminTransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const viewFromUrl = viewTabFromQuery(searchParams.get('view'))
  const [view, setView] = useState<ViewTab>(viewFromUrl ?? 'live')
  const [engineKind, setEngineKind] = useState<EngineKind | 'all'>('all')
  const [userId, setUserId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<AdminTransactionRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!getAdminToken()) return
    setLoadErr('')
    try {
      const minC = dollarsToCents(amountMin)
      const maxC = dollarsToCents(amountMax)
      const list = await fetchAdminTransactions({
        status: view === 'live' ? 'live' : view === 'history' ? 'history' : 'all',
        engineKind: engineKind === 'all' ? undefined : engineKind,
        userId: userId.trim() || undefined,
        from: dateFrom.trim() || undefined,
        to: dateTo.trim() || undefined,
        minAmount: !Number.isNaN(minC) ? minC : undefined,
        maxAmount: !Number.isNaN(maxC) ? maxC : undefined,
        limit: 1000,
      })
      setRows(list)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load.')
    }
  }, [view, engineKind, userId, dateFrom, dateTo, amountMin, amountMax])

  const viewQuery = searchParams.get('view')
  useEffect(() => {
    const next = viewTabFromQuery(viewQuery)
    if (next) setView(next)
  }, [viewQuery])

  useEffect(() => {
    void load()
  }, [load])

  function setViewTab(next: ViewTab) {
    setView(next)
    if (next === 'live') {
      setEngineKind('all')
      setDateFrom('')
      setDateTo('')
      setAmountMin('')
      setAmountMax('')
    }
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'live') p.delete('view')
        else p.set('view', next)
        return p
      },
      { replace: true },
    )
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const blob = [
        row.title,
        row.submitterId,
        row.type,
        row.userId ?? '',
        row.id,
        row.status,
        engineKindLabel(row.engineKind),
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, query])

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  async function decide(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      const note = (noteDrafts[id] ?? '').trim() || undefined
      await patchAdminApproval(id, { status, note })
      setNoteDrafts((p) => {
        const n = { ...p }
        delete n[id]
        return n
      })
      await load()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Update failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function reverse(id: string) {
    if (
      !window.confirm(
        'Reverse this applied transaction? Customer balances will be adjusted and a reversal line will appear in their activity.',
      )
    ) {
      return
    }
    setBusyId(id)
    try {
      await postAdminReverseApproval(id)
      await load()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Reverse failed.')
    } finally {
      setBusyId(null)
    }
  }

  const canReverse = (row: AdminTransactionRow) =>
    row.status === 'approved' &&
    row.appliedAt &&
    !row.reversedAt &&
    REVERSIBLE_APPROVAL_TYPES.has(row.type)

  return (
    <AdminConsoleShell
      title="Transactions"
      breadcrumb="Operations"
      subtitle="Live queue shows pending items only. History includes pending (in-flight) plus approved and rejected, so you can review the full timeline and act on open requests. Filters cover date, customer, amount, and engine class. Operator ledger lines from customer profiles still merge into History and All. Reverse remains available for supported posted types."
      headerAside={
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-bw-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-300">
            {filteredRows.length}
            {query.trim() ? ' match search' : ' in view'}
            {query.trim() && rows.length !== filteredRows.length
              ? ` · ${rows.length} loaded`
              : null}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-bw-sand-200 bg-white px-4 py-2 text-sm font-semibold text-bw-navy-950 transition hover:border-bw-blue-600/35 hover:bg-bw-sand-200"
          >
            Refresh
          </button>
        </div>
      }
    >
      <div className="mb-6 space-y-5">
        <div className="flex min-w-0 flex-wrap gap-2">
          {(
            [
              ['live', 'Live queue'],
              ['history', 'History'],
              ['all', 'All'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewTab(id)}
              className={tabBtn(view === id)}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'live' ? (
          <p className="rounded-lg border border-bw-sand-200 bg-bw-sand-100/90 px-3 py-2 text-xs text-bw-navy-900">
            <strong>Live queue</strong> lists every pending item. Date, amount, and
            engine filters below apply to <strong>History</strong> and{' '}
            <strong>All</strong> only (switching here clears those filters so wires
            and large amounts are not hidden by mistake).
          </p>
        ) : null}

        <div className="rounded-xl border border-bw-sand-200 bg-white/90 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Engine type
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Wire transfers use the <strong className="text-slate-400">Withdrawal</strong> class
            (outbound funds). They also appear if you choose{' '}
            <strong className="text-slate-400">Transfers</strong>. Between your own
            accounts stay under <strong className="text-slate-400">Transfers</strong>{' '}
            only.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ['all', 'All types'],
                ['deposit', 'Deposits'],
                ['withdrawal', 'Withdrawals'],
                ['transfer', 'Transfers'],
                ['other', 'Other'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setEngineKind(id === 'all' ? 'all' : id)}
                className={chip(engineKind === id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <label className="block min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Customer / user id
            </span>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Email fragment or user id…"
              className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2 text-sm text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-bw-blue-600/50"
            />
          </label>
          <label className="block min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              From date
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2 text-sm text-bw-navy-950 outline-none focus:border-bw-blue-600/50"
            />
          </label>
          <label className="block min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              To date
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2 text-sm text-bw-navy-950 outline-none focus:border-bw-blue-600/50"
            />
          </label>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <label className="block min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Min USD
              </span>
              <input
                inputMode="decimal"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="0.00"
                className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2 text-sm text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-bw-blue-600/50"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Max USD
              </span>
              <input
                inputMode="decimal"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="9999"
                className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2 text-sm text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-bw-blue-600/50"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-bw-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              setUserId('')
              setDateFrom('')
              setDateTo('')
              setAmountMin('')
              setAmountMax('')
              setEngineKind('all')
              setQuery('')
            }}
            className="rounded-lg border border-bw-sand-200 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white"
          >
            Clear filters
          </button>
        </div>

        <div className="relative w-full min-w-0 max-w-xl">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            aria-hidden
          >
            <IconSearch />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, type, id, customer…"
            className="w-full rounded-lg border border-bw-sand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-bw-blue-600/50 focus:ring-2 focus:ring-bw-blue-600/20"
            autoComplete="off"
          />
        </div>
      </div>

      {loadErr ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-400/25 bg-red-950/35 px-4 py-3 text-sm text-red-100"
        >
          {loadErr}
        </div>
      ) : null}

      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-bw-sand-200 bg-white shadow-bw-card">
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="min-w-[72rem] text-left text-sm">
            <thead>
              <tr className="border-b border-bw-sand-200 bg-white/90 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Class</th>
                <th className="px-4 py-3.5">Amount</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">User id</th>
                <th className="px-4 py-3.5">Summary</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="min-w-[16rem] px-4 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bw-sand-200">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-16 text-center text-slate-500"
                  >
                    No transactions in this view.
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-16 text-center text-slate-500"
                  >
                    <p>No rows match your search.</p>
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="mt-3 text-sm font-semibold text-bw-blue-500 hover:underline"
                    >
                      Clear search
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="align-top text-slate-200 transition hover:bg-bw-sand-100/90"
                  >
                    <td className="px-4 py-4">
                      <span className={statusPill(row.status)}>{row.status}</span>
                      {row.reversedAt ? (
                        <p className="mt-1 text-[11px] font-semibold text-amber-200/90">
                          Reversed {formatWhen(row.reversedAt)}
                        </p>
                      ) : null}
                      {row.appliedAt ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          Applied {formatWhen(row.appliedAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <span className={kindPill(row.engineKind)}>
                        {engineKindLabel(row.engineKind)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm tabular-nums text-bw-navy-950">
                      {formatMoney(row.amountCents)}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-400">
                      {formatWhen(row.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-bw-navy-950">
                      {row.submitterId}
                    </td>
                    <td className="px-4 py-4 font-mono text-[10px] text-slate-500">
                      {row.userId ?? '—'}
                    </td>
                    <td className="max-w-xs px-4 py-4 text-slate-300">
                      {row.title}
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px] text-slate-500">
                      {row.type}
                    </td>
                    <td className="px-4 py-4">
                      {row.status === 'pending' ? (
                        <div className="flex max-w-md flex-col gap-2">
                          <textarea
                            rows={2}
                            placeholder="Optional note with decision"
                            value={noteDrafts[row.id] ?? ''}
                            onChange={(e) =>
                              setNoteDrafts((p) => ({
                                ...p,
                                [row.id]: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2 text-xs text-bw-navy-950 outline-none placeholder:text-bw-navy-950/25 focus:border-bw-blue-600/50 focus:ring-2 focus:ring-bw-blue-600/15"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void decide(row.id, 'approved')}
                              className="rounded-lg bg-bw-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-bw-blue-500 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void decide(row.id, 'rejected')}
                              className="rounded-lg border border-red-400/35 bg-red-950/45 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-100 hover:bg-red-900/40 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex max-w-md flex-col gap-2 text-xs text-slate-500">
                          {row.decidedAt ? (
                            <p>Decided {formatWhen(row.decidedAt)}</p>
                          ) : null}
                          {row.decisionNote ? (
                            <p className="text-slate-400">{row.decisionNote}</p>
                          ) : null}
                          {canReverse(row) ? (
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void reverse(row.id)}
                              className="mt-1 w-fit rounded-lg border border-amber-400/40 bg-amber-950/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-100 hover:bg-amber-900/35 disabled:opacity-50"
                            >
                              Reverse transaction
                            </button>
                          ) : null}
                          <p className="font-mono text-[10px] text-slate-600">
                            {row.id}
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminConsoleShell>
  )
}
