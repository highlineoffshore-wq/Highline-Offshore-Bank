import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import type { BankConfig } from '../types/bankConfig'
import {
  fetchAdminBankConfig,
  fetchAdminWithdrawalsQueue,
  getAdminToken,
  patchAdminApproval,
  saveAdminBankConfig,
  type AdminTransactionRow,
} from '../lib/adminApi'

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

function centsFieldToDollars(cents: number) {
  return (cents / 100).toFixed(2)
}

export function AdminWithdrawalsPage() {
  const [config, setConfig] = useState<BankConfig | null>(null)
  const [queue, setQueue] = useState<AdminTransactionRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [flagNotes, setFlagNotes] = useState<Record<string, string>>({})

  const loadQueue = useCallback(async () => {
    if (!getAdminToken()) return
    setLoadErr('')
    try {
      setQueue(await fetchAdminWithdrawalsQueue())
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load queue.')
    }
  }, [])

  const loadConfig = useCallback(async () => {
    if (!getAdminToken()) return
    try {
      setConfig(await fetchAdminBankConfig())
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load policy.')
    }
  }, [])

  useEffect(() => {
    void loadConfig()
    void loadQueue()
  }, [loadConfig, loadQueue])

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  async function onSavePolicy(e: FormEvent) {
    e.preventDefault()
    if (!config) return
    setSaveErr('')
    setSaveOk(false)
    try {
      const next = await saveAdminBankConfig(config)
      setConfig(next)
      setSaveOk(true)
      window.setTimeout(() => setSaveOk(false), 4000)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed.')
    }
  }

  async function decide(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      const note = (noteDrafts[id] ?? '').trim() || undefined
      const { withdrawalApprovalStage } = await patchAdminApproval(id, {
        status,
        note,
      })
      if (withdrawalApprovalStage === 'awaiting_second_operator') {
        window.alert(
          'First operator approval recorded. A second operator must approve before funds move.',
        )
      }
      setNoteDrafts((p) => {
        const n = { ...p }
        delete n[id]
        return n
      })
      await loadQueue()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Update failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleSuspicious(row: AdminTransactionRow, next: boolean) {
    setBusyId(row.id)
    try {
      await patchAdminApproval(row.id, {
        suspicious: next,
        suspiciousNote: next
          ? (flagNotes[row.id] ?? '').trim() || undefined
          : undefined,
      })
      if (!next) {
        setFlagNotes((p) => {
          const n = { ...p }
          delete n[row.id]
          return n
        })
      }
      await loadQueue()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Flag update failed.')
    } finally {
      setBusyId(null)
    }
  }

  const wd = config?.withdrawals

  return (
    <AdminConsoleShell
      title="Withdrawals"
      breadcrumb="Risk & operations"
      subtitle="High-risk outbound and scheduled withdrawal queue. Configure institution limits and optional two-step release; flag suspicious items before approval."
      headerAside={
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/transactions"
            className="rounded-lg border border-bw-sand-200 bg-white px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-bw-blue-600/35 hover:text-bw-navy-950"
          >
            All transactions
          </Link>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="rounded-lg border border-bw-sand-200 bg-white px-4 py-2 text-sm font-semibold text-bw-navy-950 transition hover:border-bw-blue-600/35 hover:bg-bw-sand-200"
          >
            Refresh queue
          </button>
        </div>
      }
    >
      {loadErr ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-400/25 bg-red-950/35 px-4 py-3 text-sm text-red-100"
        >
          {loadErr}
        </div>
      ) : null}

      {config && wd ? (
        <form
          onSubmit={onSavePolicy}
          className="mb-10 rounded-xl border border-bw-sand-200 bg-white p-6"
        >
          <h2 className="font-display text-lg font-semibold text-bw-navy-950">
            Institution withdrawal controls
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Saved with bank configuration. Single-request cap is enforced when
            customers submit withdrawal-class approvals.
          </p>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-bw-sand-200 bg-white/80 p-4">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-bw-sand-200 bg-white text-bw-blue-600"
                checked={wd.multiStepEnabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    withdrawals: {
                      ...wd,
                      multiStepEnabled: e.target.checked,
                    },
                  })
                }
              />
              <span>
                <span className="block text-sm font-semibold text-bw-navy-950">
                  Multi-level approval (two operators)
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                  When enabled, withdrawal requests at or above the threshold
                  require one approval to register intent and a second approval
                  to execute the ledger movement.
                </span>
              </span>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Second-step threshold (USD)
              </span>
              <input
                type="text"
                inputMode="decimal"
                className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none focus:border-bw-blue-600/50"
                value={centsFieldToDollars(wd.secondStepThresholdCents)}
                onChange={(e) => {
                  const n = Number.parseFloat(e.target.value)
                  setConfig({
                    ...config,
                    withdrawals: {
                      ...wd,
                      secondStepThresholdCents: Number.isFinite(n)
                        ? Math.max(0, Math.round(n * 100))
                        : wd.secondStepThresholdCents,
                    },
                  })
                }}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Max single withdrawal (USD, empty = no cap)
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="No limit"
                className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-bw-blue-600/50"
                value={
                  wd.maxSingleWithdrawalCents != null
                    ? centsFieldToDollars(wd.maxSingleWithdrawalCents)
                    : ''
                }
                onChange={(e) => {
                  const t = e.target.value.trim()
                  if (!t) {
                    setConfig({
                      ...config,
                      withdrawals: { ...wd, maxSingleWithdrawalCents: null },
                    })
                    return
                  }
                  const n = Number.parseFloat(t)
                  setConfig({
                    ...config,
                    withdrawals: {
                      ...wd,
                      maxSingleWithdrawalCents: Number.isFinite(n)
                        ? Math.max(0, Math.round(n * 100))
                        : null,
                    },
                  })
                }}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Daily limit per customer (USD, empty = not enforced yet)
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Policy placeholder"
                className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-bw-blue-600/50"
                value={
                  wd.maxDailyWithdrawalPerCustomerCents != null
                    ? centsFieldToDollars(wd.maxDailyWithdrawalPerCustomerCents)
                    : ''
                }
                onChange={(e) => {
                  const t = e.target.value.trim()
                  if (!t) {
                    setConfig({
                      ...config,
                      withdrawals: {
                        ...wd,
                        maxDailyWithdrawalPerCustomerCents: null,
                      },
                    })
                    return
                  }
                  const n = Number.parseFloat(t)
                  setConfig({
                    ...config,
                    withdrawals: {
                      ...wd,
                      maxDailyWithdrawalPerCustomerCents: Number.isFinite(n)
                        ? Math.max(0, Math.round(n * 100))
                        : null,
                    },
                  })
                }}
              />
              <p className="mt-1 text-[11px] text-slate-600">
                Stored for operator runbooks; engine enforcement can be wired
                to ledger totals in a follow-up.
              </p>
            </label>
          </div>
          {saveErr ? (
            <p className="mt-4 text-sm text-red-300">{saveErr}</p>
          ) : null}
          {saveOk ? (
            <p className="mt-4 text-sm font-medium text-bw-navy-800">Policy saved.</p>
          ) : null}
          <button
            type="submit"
            className="mt-6 rounded-lg bg-bw-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800"
          >
            Save withdrawal policy
          </button>
        </form>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-bw-navy-950">
          Withdrawal request queue
        </h2>
        <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-100">
          {queue.length} pending
        </span>
      </div>

      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-bw-sand-200 bg-white shadow-bw-card">
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b border-bw-sand-200 bg-white/90 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-4 py-3.5">Risk</th>
                <th className="px-4 py-3.5">Co-appr.</th>
                <th className="px-4 py-3.5">Amount</th>
                <th className="px-4 py-3.5">When</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Summary</th>
                <th className="min-w-[18rem] px-4 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bw-sand-200">
              {queue.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-14 text-center text-slate-500"
                  >
                    No pending withdrawal-class requests.
                  </td>
                </tr>
              ) : (
                queue.map((row) => (
                  <tr
                    key={row.id}
                    className="align-top text-slate-200 hover:bg-bw-sand-100/40"
                  >
                    <td className="px-4 py-4">
                      {row.suspicious ? (
                        <span className="inline-flex rounded-md bg-red-950/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-200 ring-1 ring-red-500/35">
                          Suspicious
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                      {row.suspiciousNote ? (
                        <p className="mt-1 max-w-[10rem] text-[11px] text-slate-500">
                          {row.suspiciousNote}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-300">
                      {row.withdrawalCoApprovals > 0 ? (
                        <span>
                          {row.withdrawalCoApprovals}
                          <span className="text-slate-600"> / 2</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
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
                    <td className="px-4 py-4 font-mono text-[11px] text-slate-500">
                      {row.type}
                    </td>
                    <td className="max-w-xs px-4 py-4 text-slate-300">
                      {row.title}
                    </td>
                    <td className="px-4 py-4">
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
                          className="w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2 text-xs text-bw-navy-950 outline-none placeholder:text-bw-navy-950/25 focus:border-bw-blue-600/50"
                        />
                        {!row.suspicious ? (
                          <>
                            <input
                              type="text"
                              placeholder="Suspicious reason (optional)"
                              value={flagNotes[row.id] ?? ''}
                              onChange={(e) =>
                                setFlagNotes((p) => ({
                                  ...p,
                                  [row.id]: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2 text-xs text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-amber-500/40"
                            />
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void toggleSuspicious(row, true)}
                              className="w-fit rounded-lg border border-amber-500/40 bg-amber-950/35 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-100 hover:bg-amber-900/30 disabled:opacity-50"
                            >
                              Flag suspicious
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void toggleSuspicious(row, false)}
                            className="w-fit rounded-lg border border-bw-sand-200 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-bw-sand-200 disabled:opacity-50"
                          >
                            Clear flag
                          </button>
                        )}
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
                        <p className="font-mono text-[10px] text-slate-600">
                          {row.id}
                        </p>
                      </div>
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
