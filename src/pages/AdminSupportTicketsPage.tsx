import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import { SUPPORT_STAFF_OPTIONS } from '../data/supportStaff'
import {
  fetchAdminCustomer,
  fetchAdminSupportTicket,
  fetchAdminSupportTickets,
  getAdminToken,
  patchAdminSupportTicket,
  postAdminSupportTicketMessage,
} from '../lib/adminApi'
import type { AdminCustomerDetail } from '../lib/adminApi'
import type { SupportTicket, SupportTicketStatus } from '../types/supportTicket'

const STATUS_FILTERS: Array<{ id: '' | SupportTicketStatus; label: string }> = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
]

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

function statusPill(status: SupportTicketStatus) {
  const base =
    'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide'
  if (status === 'open')
    return `${base} bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30`
  if (status === 'pending')
    return `${base} bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30`
  return `${base} bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/25`
}

export function AdminSupportTicketsPage() {
  const [statusFilter, setStatusFilter] = useState<'' | SupportTicketStatus>('')
  const [assignFilter, setAssignFilter] = useState<string>('')
  const [items, setItems] = useState<SupportTicket[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SupportTicket | null>(null)
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState('')
  const [reply, setReply] = useState('')
  const [staffLabel, setStaffLabel] = useState<string>(SUPPORT_STAFF_OPTIONS[0])
  const [linkedDraft, setLinkedDraft] = useState<Record<string, boolean>>({})

  const selected = items.find((x) => x.id === selectedId) ?? null

  const load = useCallback(async () => {
    if (!getAdminToken()) return
    setLoadErr('')
    try {
      const list = await fetchAdminSupportTickets({
        status: statusFilter || undefined,
        assignedTo: assignFilter || undefined,
        limit: 200,
      })
      setItems(list)
      setSelectedId((prev) => {
        if (!prev) return list[0]?.id ?? null
        return list.some((x) => x.id === prev) ? prev : (list[0]?.id ?? null)
      })
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load inbox.')
      setItems([])
    }
  }, [statusFilter, assignFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setCustomer(null)
      setLinkedDraft({})
      return
    }
    let cancelled = false
    void fetchAdminSupportTicket(selectedId)
      .then((t) => {
        if (cancelled) return
        setDetail(t)
        const ld: Record<string, boolean> = {}
        for (const id of t.linkedAccountIds) ld[id] = true
        setLinkedDraft(ld)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  useEffect(() => {
    if (!detail?.userId) {
      setCustomer(null)
      return
    }
    let cancelled = false
    void fetchAdminCustomer(detail.userId)
      .then((c) => {
        if (!cancelled) setCustomer(c)
      })
      .catch(() => {
        if (!cancelled) setCustomer(null)
      })
    return () => {
      cancelled = true
    }
  }, [detail?.userId])

  async function patchTicket(partial: {
    status?: SupportTicketStatus
    assignedTo?: string | null
    linkedAccountIds?: string[]
  }) {
    if (!selectedId) return
    setBusy(true)
    setLocalErr('')
    try {
      const next = await patchAdminSupportTicket(selectedId, partial)
      setDetail(next)
      setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)))
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  async function saveLinkedAccounts() {
    if (!detail || !customer) return
    const allowed = new Set(customer.accounts.map((a) => a.id))
    const linkedAccountIds = Object.entries(linkedDraft)
      .filter(([id, on]) => on && allowed.has(id))
      .map(([id]) => id)
    await patchTicket({ linkedAccountIds })
  }

  async function onReply(e: FormEvent) {
    e.preventDefault()
    if (!selectedId || !reply.trim()) return
    setBusy(true)
    setLocalErr('')
    try {
      const next = await postAdminSupportTicketMessage(selectedId, {
        body: reply.trim(),
        staffLabel,
      })
      setDetail(next)
      setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)))
      setReply('')
      await load()
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : 'Reply failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <AdminConsoleShell
      title="Support tickets"
      breadcrumb="Service"
      subtitle="Inbox, assignment, status, and threaded replies. Tickets are linked to customers and optional deposit accounts."
      headerAside={
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-lg border border-bw-sand-200 bg-white px-4 py-2 text-sm font-semibold text-bw-navy-950 transition hover:border-bw-blue-600/35 hover:bg-bw-sand-200 disabled:opacity-50"
        >
          Refresh
        </button>
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

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {STATUS_FILTERS.map(({ id, label }) => (
          <button
            key={id || 'all'}
            type="button"
            role="tab"
            aria-selected={statusFilter === id}
            onClick={() => setStatusFilter(id)}
            className={[
              'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition',
              statusFilter === id
                ? 'bg-bw-blue-600 text-white shadow-sm'
                : 'border border-bw-sand-200 bg-bw-sand-100 text-slate-400 hover:border-bw-blue-600/40 hover:text-slate-200',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assignee
          </span>
          <select
            value={assignFilter}
            onChange={(e) => setAssignFilter(e.target.value)}
            className="rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2 text-sm text-bw-navy-950 outline-none focus:border-bw-blue-600/55"
          >
            <option value="">All</option>
            <option value="__unassigned__">Unassigned</option>
            {SUPPORT_STAFF_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <div className="min-w-0 overflow-hidden rounded-xl border border-bw-sand-200 bg-white lg:col-span-2">
          <div className="border-b border-bw-sand-200 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Inbox ({items.length})
            </p>
          </div>
          <ul className="max-h-[min(72vh,560px)] divide-y divide-bw-sand-200 overflow-y-auto overscroll-contain">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No tickets for this filter.
              </li>
            ) : (
              items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(row.id)
                      setLocalErr('')
                    }}
                    className={[
                      'flex w-full flex-col gap-1 px-4 py-3 text-left transition',
                      selectedId === row.id
                        ? 'bg-bw-blue-600/12 ring-1 ring-inset ring-bw-blue-600/35'
                        : 'hover:bg-white/[0.03]',
                    ].join(' ')}
                  >
                    <span className="truncate text-sm font-semibold text-bw-navy-950">
                      {row.subject}
                    </span>
                    <span className="truncate text-xs text-slate-500">
                      {row.customerDisplayName} · {row.customerEmail}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={statusPill(row.status)}>{row.status}</span>
                      {row.assignedTo ? (
                        <span className="text-[10px] text-slate-500">
                          {row.assignedTo}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">Unassigned</span>
                      )}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-3">
          {!selected || !detail ? (
            <div className="rounded-xl border border-bw-sand-200 bg-white p-8 text-center text-sm text-slate-500">
              Select a ticket from the inbox.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-bw-sand-200 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Ticket
                    </p>
                    <h2 className="mt-1 font-display text-xl font-semibold text-bw-navy-950">
                      {detail.subject}
                    </h2>
                    <p className="mt-1 font-mono text-xs text-slate-500">{detail.id}</p>
                  </div>
                  <span className={statusPill(detail.status)}>{detail.status}</span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Customer
                    </dt>
                    <dd className="mt-1 text-slate-200">{detail.customerDisplayName}</dd>
                    <dd className="text-slate-500">{detail.customerEmail}</dd>
                    <dd className="mt-2">
                      <Link
                        to={`/admin/users/${encodeURIComponent(detail.userId)}`}
                        className="text-xs font-semibold text-bw-blue-500 hover:underline"
                      >
                        Open customer profile
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Updated
                    </dt>
                    <dd className="mt-1 text-slate-200">{formatWhen(detail.updatedAt)}</dd>
                    <dt className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Created
                    </dt>
                    <dd className="mt-1 text-slate-200">{formatWhen(detail.createdAt)}</dd>
                  </div>
                </dl>

                <div className="mt-6 grid gap-4 border-t border-bw-sand-200 pt-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </span>
                    <select
                      value={detail.status}
                      disabled={busy}
                      onChange={(e) =>
                        void patchTicket({
                          status: e.target.value as SupportTicketStatus,
                        })
                      }
                      className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none focus:border-bw-blue-600/55"
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assign to
                    </span>
                    <select
                      value={detail.assignedTo ?? ''}
                      disabled={busy}
                      onChange={(e) => {
                        const v = e.target.value
                        void patchTicket({
                          assignedTo: v === '' ? null : v,
                        })
                      }}
                      className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none focus:border-bw-blue-600/55"
                    >
                      <option value="">Unassigned</option>
                      {SUPPORT_STAFF_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {customer && customer.accounts.length > 0 ? (
                  <div className="mt-6 border-t border-bw-sand-200 pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Linked accounts
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Adjust which accounts this ticket references (customer must own
                      them).
                    </p>
                    <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-sm">
                      {customer.accounts.map((a) => (
                        <li key={a.id}>
                          <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                            <input
                              type="checkbox"
                              checked={!!linkedDraft[a.id]}
                              disabled={busy}
                              onChange={() =>
                                setLinkedDraft((d) => ({ ...d, [a.id]: !d[a.id] }))
                              }
                              className="rounded border-bw-sand-200 bg-bw-sand-100"
                            />
                            <span>
                              {a.name}{' '}
                              <span className="text-slate-500">· {a.mask}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveLinkedAccounts()}
                      className="mt-3 rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-bw-blue-600/35"
                    >
                      Save linked accounts
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-bw-sand-200 bg-white p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-bw-navy-950">Conversation</h3>
                <div className="mt-4 max-h-[min(48vh,400px)] space-y-3 overflow-y-auto rounded-lg border border-bw-sand-200 bg-bw-sand-100/90 p-4">
                  {detail.messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.authorType === 'staff'
                          ? 'ml-4 rounded-lg border border-bw-sand-200 bg-white px-3 py-2.5 text-sm text-slate-200 sm:ml-10'
                          : 'mr-4 rounded-lg bg-bw-blue-600/12 px-3 py-2.5 text-sm text-slate-100 sm:mr-10'
                      }
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {m.authorLabel} · {formatWhen(m.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-200">{m.body}</p>
                    </div>
                  ))}
                </div>

                <form className="mt-4 space-y-3" onSubmit={(ev) => void onReply(ev)}>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reply as
                    </span>
                    <select
                      value={staffLabel}
                      onChange={(e) => setStaffLabel(e.target.value)}
                      disabled={busy}
                      className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none focus:border-bw-blue-600/55 sm:max-w-xs"
                    >
                      {SUPPORT_STAFF_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    disabled={busy}
                    rows={4}
                    placeholder="Staff reply to customer…"
                    className="w-full resize-y rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-bw-blue-600/55"
                  />
                  <button
                    type="submit"
                    disabled={busy || !reply.trim()}
                    className="rounded-lg bg-bw-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800 disabled:opacity-50"
                  >
                    Send reply
                  </button>
                </form>
              </div>

              {localErr ? (
                <p className="text-sm text-red-400" role="alert">
                  {localErr}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </AdminConsoleShell>
  )
}
