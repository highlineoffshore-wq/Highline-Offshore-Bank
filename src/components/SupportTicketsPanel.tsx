import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useAccounts } from '../contexts/AccountsContext'
import {
  createSupportTicket,
  fetchSupportTicket,
  fetchSupportTickets,
  postSupportTicketMessage,
} from '../lib/supportTicketsApi'
import type { SupportTicket, SupportTicketListRow } from '../types/supportTicket'

function statusLabel(s: SupportTicketListRow['status']) {
  if (s === 'open') return 'Open'
  if (s === 'pending') return 'Pending'
  return 'Resolved'
}

function statusClass(s: SupportTicketListRow['status']) {
  if (s === 'open')
    return 'bg-bw-sky-100 text-bw-navy-900 ring-1 ring-bw-sand-200/80'
  if (s === 'pending')
    return 'bg-amber-100 text-amber-950 ring-1 ring-amber-200/80'
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80'
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

export function SupportTicketsPanel() {
  const { accounts } = useAccounts()
  const [rows, setRows] = useState<SupportTicketListRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SupportTicket | null>(null)
  const [detailErr, setDetailErr] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [subject, setSubject] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [linked, setLinked] = useState<Record<string, boolean>>({})
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoadErr('')
    try {
      const list = await fetchSupportTickets()
      setRows(list)
      setSelectedId((prev) => {
        if (!prev) return list[0]?.id ?? null
        return list.some((x) => x.id === prev) ? prev : (list[0]?.id ?? null)
      })
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load tickets.')
      setRows([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailErr('')
    void fetchSupportTicket(selectedId)
      .then((t) => {
        if (!cancelled) setDetail(t)
      })
      .catch((e) => {
        if (!cancelled)
          setDetailErr(e instanceof Error ? e.message : 'Load failed.')
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages.length, selectedId])

  async function onReply(e: FormEvent) {
    e.preventDefault()
    if (!selectedId || !reply.trim()) return
    setBusy(true)
    setFormErr('')
    try {
      const next = await postSupportTicketMessage(selectedId, reply.trim())
      setDetail(next)
      setReply('')
      await load()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Send failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setFormErr('')
    if (!subject.trim() || !firstMessage.trim()) {
      setFormErr('Subject and message are required.')
      return
    }
    const linkedAccountIds = Object.entries(linked)
      .filter(([, v]) => v)
      .map(([k]) => k)
    setBusy(true)
    try {
      const item = await createSupportTicket({
        subject: subject.trim(),
        body: firstMessage.trim(),
        linkedAccountIds,
      })
      setSubject('')
      setFirstMessage('')
      setLinked({})
      setSelectedId(item.id)
      setDetail(item)
      await load()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Could not create ticket.')
    } finally {
      setBusy(false)
    }
  }

  function toggleLink(id: string) {
    setLinked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-5">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <div className="rounded-xl border border-bw-sand-200 bg-bw-sand-100/40 p-4">
          <h3 className="font-display text-sm font-semibold text-bw-navy-900">
            New ticket
          </h3>
          <p className="mt-1 text-xs text-bw-muted">
            Opens a thread our team can answer. Link one or more accounts if the
            question is about specific balances or transfers.
          </p>
          <form className="mt-4 space-y-3" onSubmit={(ev) => void onCreate(ev)}>
            <input
              className="w-full rounded-md border border-bw-sand-200 px-3 py-2 text-sm outline-none ring-bw-blue-500/30 focus:border-bw-blue-500 focus:ring-2"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
            <textarea
              className="min-h-[100px] w-full rounded-md border border-bw-sand-200 px-3 py-2 text-sm outline-none ring-bw-blue-500/30 focus:border-bw-blue-500 focus:ring-2"
              placeholder="Describe what you need…"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
            />
            {accounts.length > 0 ? (
              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
                  Link accounts (optional)
                </legend>
                <ul className="mt-2 max-h-36 space-y-2 overflow-y-auto text-sm">
                  {accounts.map((a) => (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!linked[a.id]}
                          onChange={() => toggleLink(a.id)}
                          className="rounded border-bw-sand-300"
                        />
                        <span className="text-bw-navy-900">
                          {a.name}{' '}
                          <span className="text-bw-muted">· {a.mask}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-bw-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800 disabled:opacity-50"
            >
              Submit ticket
            </button>
          </form>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-bw-navy-900">
              Your tickets
            </h3>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-semibold text-bw-blue-700 hover:underline"
            >
              Refresh
            </button>
          </div>
          {loadErr ? (
            <p className="text-sm text-bw-red-700" role="alert">
              {loadErr}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-bw-muted">No tickets yet.</p>
          ) : (
            <ul className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto pr-1">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={[
                      'w-full rounded-lg border px-3 py-2.5 text-left text-sm transition',
                      selectedId === r.id
                        ? 'border-bw-blue-500 bg-bw-sky-100/60 ring-1 ring-bw-blue-500/25'
                        : 'border-bw-sand-200 bg-white hover:border-bw-sand-300',
                    ].join(' ')}
                  >
                    <span className="font-medium text-bw-navy-900">{r.subject}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          statusClass(r.status),
                        ].join(' ')}
                      >
                        {statusLabel(r.status)}
                      </span>
                      <span className="text-xs text-bw-muted">
                        {formatWhen(r.updatedAt)}
                      </span>
                    </span>
                    {r.lastPreview ? (
                      <p className="mt-1 line-clamp-2 text-xs text-bw-muted">
                        {r.lastPreview}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="min-w-0 lg:col-span-3">
        {!selectedId ? (
          <p className="text-sm text-bw-muted">Select a ticket or create one.</p>
        ) : detailErr ? (
          <p className="text-sm text-bw-red-700" role="alert">
            {detailErr}
          </p>
        ) : !detail ? (
          <p className="text-sm text-bw-muted">Loading conversation…</p>
        ) : (
          <div className="flex min-h-[min(60vh,520px)] flex-col rounded-xl border border-bw-sand-200 bg-white shadow-sm">
            <div className="border-b border-bw-sand-200 px-4 py-3 sm:px-5">
              <h3 className="font-display text-lg font-semibold text-bw-navy-900">
                {detail.subject}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-bw-muted">
                <span
                  className={[
                    'rounded-md px-2 py-0.5 font-bold uppercase tracking-wide',
                    statusClass(detail.status),
                  ].join(' ')}
                >
                  {statusLabel(detail.status)}
                </span>
                {detail.assignedTo ? (
                  <span>Assigned: {detail.assignedTo}</span>
                ) : (
                  <span>Unassigned</span>
                )}
                {detail.linkedAccountIds.length > 0 ? (
                  <span className="font-mono text-[11px] text-bw-navy-800">
                    Linked accounts: {detail.linkedAccountIds.join(', ')}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-bw-sand-100/50 p-4 sm:p-5">
              {detail.messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.authorType === 'customer'
                      ? 'ml-4 rounded-lg bg-bw-sky-100 px-3 py-2.5 text-sm text-bw-navy-900 sm:ml-12'
                      : 'mr-4 rounded-lg border border-bw-sand-200 bg-white px-3 py-2.5 text-sm text-bw-navy-900 shadow-sm sm:mr-12'
                  }
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-bw-muted">
                    {m.authorLabel} · {formatWhen(m.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form
              className="border-t border-bw-sand-200 p-4 sm:p-5"
              onSubmit={(ev) => void onReply(ev)}
            >
              {detail.status === 'resolved' ? (
                <p className="mb-2 text-xs text-bw-muted">
                  This ticket is resolved. Sending a message will reopen it for the
                  team.
                </p>
              ) : null}
              <textarea
                className="min-h-[88px] w-full rounded-md border border-bw-sand-200 px-3 py-2 text-sm outline-none ring-bw-blue-500/30 focus:border-bw-blue-500 focus:ring-2"
                placeholder="Write a reply…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                disabled={busy}
              />
              {formErr ? (
                <p className="mt-2 text-sm text-bw-red-700" role="alert">
                  {formErr}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy || !reply.trim()}
                className="mt-3 rounded-md bg-bw-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bw-red-600 disabled:opacity-50"
              >
                Send reply
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
