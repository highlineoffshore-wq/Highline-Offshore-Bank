import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import {
  fetchAdminCards,
  getAdminToken,
  patchAdminCard,
  postAdminCardTransaction,
  postAdminIssueCard,
  type AdminCardRow,
} from '../lib/adminApi'
import type { DebitCardTransaction } from '../types/banking'

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatWhen(iso: string) {
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

export function AdminCardsPage() {
  const [rows, setRows] = useState<AdminCardRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [limitSingle, setLimitSingle] = useState('')
  const [limitDaily, setLimitDaily] = useState('')
  const [demoMerchant, setDemoMerchant] = useState('Merchant purchase')
  const [demoAmount, setDemoAmount] = useState('-12.34')
  const [demoStatus, setDemoStatus] = useState<'posted' | 'declined' | 'pending'>(
    'posted',
  )

  const load = useCallback(async () => {
    if (!getAdminToken()) return
    setLoadErr('')
    try {
      setRows(await fetchAdminCards())
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(
    () => rows.find((r) => r.userId === selectedId) ?? null,
    [rows, selectedId],
  )

  useEffect(() => {
    if (!selected) {
      setLimitSingle('')
      setLimitDaily('')
      return
    }
    const d = selected.debitCard
    setLimitSingle(
      d.singleTransactionLimitCents != null
        ? String(d.singleTransactionLimitCents / 100)
        : '',
    )
    setLimitDaily(
      d.dailySpendLimitCents != null
        ? String(d.dailySpendLimitCents / 100)
        : '',
    )
  }, [selected])

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  async function run(userId: string, fn: () => Promise<void>) {
    setBusyId(userId)
    try {
      await fn()
      await load()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Request failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function issue(userId: string, cardType: 'virtual' | 'physical') {
    await run(userId, async () => {
      await postAdminIssueCard(userId, { cardType })
    })
  }

  async function toggleFreeze(userId: string, next: boolean) {
    await run(userId, async () => {
      await patchAdminCard(userId, { adminFrozen: next })
    })
  }

  async function setStolen(userId: string, stolen: boolean) {
    if (stolen && !window.confirm('Block this card as stolen? The customer cannot use it until you clear the block.')) {
      return
    }
    await run(userId, async () => {
      await patchAdminCard(userId, { stolenBlocked: stolen })
    })
  }

  async function saveLimits(userId: string) {
    const s = limitSingle.trim()
    const d = limitDaily.trim()
    const singleParsed = s === '' ? NaN : Number.parseFloat(s)
    const dailyParsed = d === '' ? NaN : Number.parseFloat(d)
    if (s !== '' && !Number.isFinite(singleParsed)) {
      setLoadErr('Single-transaction limit must be a valid dollar amount.')
      return
    }
    if (d !== '' && !Number.isFinite(dailyParsed)) {
      setLoadErr('Daily limit must be a valid dollar amount.')
      return
    }
    const singleCents =
      s === '' ? null : Math.max(1, Math.round(singleParsed * 100))
    const dailyCents =
      d === '' ? null : Math.max(1, Math.round(dailyParsed * 100))
    await run(userId, async () => {
      await patchAdminCard(userId, {
        singleTransactionLimitCents: singleCents,
        dailySpendLimitCents: dailyCents,
      })
    })
  }

  async function appendDemoTxn(userId: string) {
    const amt = Number.parseFloat(demoAmount)
    if (!Number.isFinite(amt)) {
      setLoadErr('Enter a numeric amount (negative for purchases).')
      return
    }
    await run(userId, async () => {
      await postAdminCardTransaction(userId, {
        merchant: demoMerchant.trim() || 'Purchase',
        amountCents: Math.round(amt * 100),
        status: demoStatus,
      })
    })
  }

  return (
    <AdminConsoleShell
      title="Cards"
      breadcrumb="Issuance & control"
      subtitle="Issue virtual or physical debit credentials, freeze cards at the bank, set spend caps, record demo authorizations for tracking, and block stolen PANs. Customer self-service still flows through approvals where applicable."
      headerAside={
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/transactions"
            className="rounded-lg border border-bw-sand-200 bg-white px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-bw-blue-600/35 hover:text-bw-navy-950"
          >
            Approval queue
          </Link>
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
      {loadErr ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-400/25 bg-red-950/35 px-4 py-3 text-sm text-red-100"
        >
          {loadErr}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1fr_minmax(20rem,26rem)]">
        <div className="w-full min-w-0 overflow-hidden rounded-xl border border-bw-sand-200 bg-white shadow-bw-card">
          <div className="border-b border-bw-sand-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-bw-navy-950">Customers</h2>
            <p className="text-xs text-slate-500">
              Select a row to open issuance and controls.
            </p>
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-bw-sand-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Card</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-bw-sand-200">
                {rows.map((r) => {
                  const d = r.debitCard
                  const state = d.stolenBlocked
                    ? 'Stolen'
                    : d.adminFrozen
                      ? 'Frozen'
                      : d.locked
                        ? 'Locked'
                        : 'Active'
                  return (
                    <tr
                      key={r.userId}
                      className={
                        selectedId === r.userId
                          ? 'bg-bw-blue-600/10'
                          : 'hover:bg-bw-sand-100/90'
                      }
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-bw-navy-950">{r.displayName}</p>
                        <p className="text-xs text-slate-500">{r.email}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-300">
                        ····{d.last4}{' '}
                        <span className="text-slate-600">
                          ({d.cardType === 'virtual' ? 'V' : 'P'})
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">{state}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.userId)}
                          className="rounded-md border border-bw-sand-200 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-bw-blue-600/40 hover:text-bw-navy-950"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {selected ? (
            <>
              <div className="rounded-xl border border-bw-sand-200 bg-white p-5">
                <h3 className="font-display text-base font-semibold text-bw-navy-950">
                  {selected.displayName}
                </h3>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {selected.userId}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === selected.userId}
                    onClick={() => void issue(selected.userId, 'virtual')}
                    className="rounded-lg bg-bw-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-bw-blue-500 disabled:opacity-50"
                  >
                    Issue virtual
                  </button>
                  <button
                    type="button"
                    disabled={busyId === selected.userId}
                    onClick={() => void issue(selected.userId, 'physical')}
                    className="rounded-lg bg-bw-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-bw-navy-800 disabled:opacity-50"
                  >
                    Issue physical
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Issuing rolls a new last-four and expiry; prior authorizations
                  remain in the activity list.
                </p>
              </div>

              <div className="rounded-xl border border-bw-sand-200 bg-white p-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Freeze &amp; fraud
                </h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === selected.userId}
                    onClick={() =>
                      void toggleFreeze(
                        selected.userId,
                        !selected.debitCard.adminFrozen,
                      )
                    }
                    className="rounded-lg border border-bw-sand-200 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white disabled:opacity-50"
                  >
                    {selected.debitCard.adminFrozen
                      ? 'Unfreeze (bank)'
                      : 'Freeze (bank)'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === selected.userId || selected.debitCard.stolenBlocked}
                    onClick={() => void setStolen(selected.userId, true)}
                    className="rounded-lg bg-red-900/50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-100 ring-1 ring-red-500/30 hover:bg-red-900/70 disabled:opacity-40"
                  >
                    Block stolen
                  </button>
                  {selected.debitCard.stolenBlocked ? (
                    <button
                      type="button"
                      disabled={busyId === selected.userId}
                      onClick={() => void setStolen(selected.userId, false)}
                      className="rounded-lg border border-bw-blue-500/40 px-3 py-2 text-xs font-semibold text-bw-sky-100 hover:bg-bw-navy-900/40 disabled:opacity-50"
                    >
                      Clear stolen block
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-bw-sand-200 bg-white p-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Spend limits (USD)
                </h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="text-slate-500">Single transaction max</span>
                    <input
                      value={limitSingle}
                      onChange={(e) => setLimitSingle(e.target.value)}
                      placeholder="Empty = none"
                      className="mt-1 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-2 py-2 text-sm text-bw-navy-950"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="text-slate-500">Daily spend max</span>
                    <input
                      value={limitDaily}
                      onChange={(e) => setLimitDaily(e.target.value)}
                      placeholder="Empty = none"
                      className="mt-1 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-2 py-2 text-sm text-bw-navy-950"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busyId === selected.userId}
                  onClick={() => void saveLimits(selected.userId)}
                  className="mt-3 rounded-lg bg-bw-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-bw-navy-800 disabled:opacity-50"
                >
                  Save limits
                </button>
              </div>

              <div className="rounded-xl border border-bw-sand-200 bg-white p-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Track authorizations (demo)
                </h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    value={demoMerchant}
                    onChange={(e) => setDemoMerchant(e.target.value)}
                    className="rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-2 py-2 text-sm text-bw-navy-950"
                    placeholder="Merchant"
                  />
                  <input
                    value={demoAmount}
                    onChange={(e) => setDemoAmount(e.target.value)}
                    className="rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-2 py-2 text-sm text-bw-navy-950"
                    placeholder="-00.00"
                  />
                  <select
                    value={demoStatus}
                    onChange={(e) =>
                      setDemoStatus(e.target.value as typeof demoStatus)
                    }
                    className="rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-2 py-2 text-sm text-bw-navy-950 sm:col-span-2"
                  >
                    <option value="posted">Posted</option>
                    <option value="pending">Pending</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={busyId === selected.userId}
                  onClick={() => void appendDemoTxn(selected.userId)}
                  className="mt-3 rounded-lg border border-bw-sand-200 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white disabled:opacity-50"
                >
                  Append row
                </button>
              </div>

              <div className="rounded-xl border border-bw-sand-200 bg-white p-5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Card transactions
                </h4>
                <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto text-xs">
                  {(selected.debitCard.transactions ?? []).length === 0 ? (
                    <li className="text-slate-500">No rows yet.</li>
                  ) : (
                    (selected.debitCard.transactions ?? []).map(
                      (tx: DebitCardTransaction) => (
                        <li
                          key={tx.id}
                          className="flex justify-between gap-2 rounded-md border border-bw-sand-200/80 bg-white/90 px-2 py-2"
                        >
                          <div>
                            <p className="font-medium text-slate-200">
                              {tx.merchant}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {formatWhen(tx.postedAt)} · {tx.status}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 font-mono font-semibold ${
                              tx.amountCents < 0
                                ? 'text-red-300'
                                : 'text-slate-200'
                            }`}
                          >
                            {formatMoney(tx.amountCents)}
                          </span>
                        </li>
                      ),
                    )
                  )}
                </ul>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-bw-sand-200 bg-white/50 p-8 text-center text-sm text-slate-500">
              Choose a customer on the left to issue or control their card.
            </div>
          )}
        </div>
      </div>
    </AdminConsoleShell>
  )
}
