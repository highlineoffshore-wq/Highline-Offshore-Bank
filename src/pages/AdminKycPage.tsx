import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import {
  fetchAdminKycDocumentBlob,
  fetchAdminKycSubmissions,
  getAdminToken,
  patchAdminKycSubmission,
} from '../lib/adminApi'
import type {
  KycDocument,
  KycDocumentKind,
  KycRiskLevel,
  KycStatus,
  KycSubmission,
} from '../types/kyc'

const RISK_OPTIONS: KycRiskLevel[] = ['low', 'standard', 'elevated', 'high']

const STATUS_FILTERS: Array<{ id: '' | KycStatus; label: string }> = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

function docKindLabel(kind: KycDocumentKind): string {
  switch (kind) {
    case 'id_front':
      return 'ID — front'
    case 'id_back':
      return 'ID — back'
    case 'proof_of_address':
      return 'Proof of address'
    default:
      return 'Other'
  }
}

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

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function expirySummary(isoDate: string | null): {
  label: string
  tone: 'ok' | 'warn' | 'bad' | 'none'
} {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return { label: 'Not set', tone: 'none' }
  }
  const end = new Date(`${isoDate}T23:59:59.999Z`)
  const now = new Date()
  const ms = end.getTime() - now.getTime()
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
  if (ms < 0) return { label: 'Expired', tone: 'bad' }
  if (days <= 30) return { label: `Expires in ${days}d`, tone: 'warn' }
  return { label: `Expires ${isoDate}`, tone: 'ok' }
}

function statusPill(status: KycStatus) {
  const base =
    'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide'
  if (status === 'pending')
    return `${base} bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30`
  if (status === 'approved')
    return `${base} bg-bw-blue-500/15 text-bw-sky-100 ring-1 ring-bw-blue-500/30`
  return `${base} bg-red-500/15 text-red-200 ring-1 ring-red-500/30`
}

function riskPill(risk: KycRiskLevel) {
  const base =
    'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide'
  if (risk === 'low') return `${base} bg-slate-500/20 text-slate-200`
  if (risk === 'standard') return `${base} bg-bw-blue-600/15 text-bw-blue-500`
  if (risk === 'elevated') return `${base} bg-orange-500/15 text-orange-200`
  return `${base} bg-red-600/20 text-red-200`
}

export function AdminKycPage() {
  const [filter, setFilter] = useState<'' | KycStatus>('')
  const [items, setItems] = useState<KycSubmission[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [docModal, setDocModal] = useState<KycDocument | null>(null)
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null)
  const [docPreviewLoading, setDocPreviewLoading] = useState(false)
  const [docPreviewErr, setDocPreviewErr] = useState('')
  const [decisionNote, setDecisionNote] = useState('')
  const [localErr, setLocalErr] = useState('')

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) ?? null,
    [items, selectedId],
  )

  const load = useCallback(async () => {
    if (!getAdminToken()) return
    setLoadErr('')
    try {
      const list = await fetchAdminKycSubmissions({
        status: filter || undefined,
        limit: 200,
      })
      setItems(list)
      setSelectedId((prev) => {
        if (!prev) return list[0]?.id ?? null
        return list.some((x) => x.id === prev) ? prev : (list[0]?.id ?? null)
      })
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load KYC queue.')
      setItems([])
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!docModal) {
      setDocPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u)
        return null
      })
      setDocPreviewLoading(false)
      setDocPreviewErr('')
      return
    }
    if (!selectedId) return
    if (!docModal.storagePath) {
      setDocPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u)
        return null
      })
      setDocPreviewLoading(false)
      setDocPreviewErr('')
      return
    }
    let cancelled = false
    setDocPreviewLoading(true)
    setDocPreviewErr('')
    setDocPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u)
      return null
    })
    void fetchAdminKycDocumentBlob(selectedId, docModal.id)
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setDocPreviewUrl(url)
      })
      .catch((err) => {
        if (!cancelled) {
          setDocPreviewErr(
            err instanceof Error ? err.message : 'Could not load file.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setDocPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [docModal, selectedId])

  async function saveReviewFields(e: FormEvent) {
    e.preventDefault()
    if (!selected || selected.status !== 'pending') return
    setBusy(true)
    setLocalErr('')
    try {
      const form = e.target as HTMLFormElement
      const fd = new FormData(form)
      const riskLevel = String(fd.get('riskLevel') || '') as KycRiskLevel
      const expRaw = String(fd.get('documentExpiresAt') || '').trim()
      const documentExpiresAt = expRaw === '' ? null : expRaw
      const complianceNotes = String(fd.get('complianceNotes') || '')
      const next = await patchAdminKycSubmission(selected.id, {
        riskLevel,
        documentExpiresAt,
        complianceNotes,
      })
      setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)))
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function decide(which: 'approve' | 'reject') {
    if (!selected) return
    if (which === 'reject' && !decisionNote.trim()) {
      setLocalErr('Add a decision note before rejecting.')
      return
    }
    setBusy(true)
    setLocalErr('')
    try {
      const next = await patchAdminKycSubmission(selected.id, {
        decision: which,
        decisionNote: decisionNote.trim() || undefined,
      })
      setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)))
      setDecisionNote('')
      await load()
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <AdminConsoleShell
      title="KYC verification"
      breadcrumb="Compliance"
      subtitle="Review uploaded identity documents, set risk and ID expiry, leave notes for the team, and approve or reject each submission."
      headerAside={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-lg border border-bw-sand-200 bg-white px-4 py-2 text-sm font-semibold text-bw-navy-950 transition hover:border-bw-blue-600/35 hover:bg-bw-sand-200 disabled:opacity-50"
          >
            Refresh
          </button>
          <Link
            to="/admin/users"
            className="rounded-lg border border-bw-sand-200 bg-white px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-bw-blue-600/35 hover:text-bw-navy-950"
          >
            User directory
          </Link>
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

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {STATUS_FILTERS.map(({ id, label }) => (
          <button
            key={id || 'all'}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={[
              'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition',
              filter === id
                ? 'bg-bw-blue-600 text-white shadow-sm'
                : 'border border-bw-sand-200 bg-bw-sand-100 text-slate-400 hover:border-bw-blue-600/40 hover:text-slate-200',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <div className="min-w-0 overflow-hidden rounded-xl border border-bw-sand-200 bg-white lg:col-span-2">
          <div className="border-b border-bw-sand-200 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Queue ({items.length})
            </p>
          </div>
          <ul className="max-h-[min(70vh,520px)] divide-y divide-bw-sand-200 overflow-y-auto overscroll-contain">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No submissions for this filter.
              </li>
            ) : (
              items.map((row) => {
                const ex = expirySummary(row.documentExpiresAt)
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(row.id)
                        setLocalErr('')
                        setDecisionNote('')
                      }}
                      className={[
                        'flex w-full flex-col gap-1 px-4 py-3 text-left transition',
                        selectedId === row.id
                          ? 'bg-bw-blue-600/12 ring-1 ring-inset ring-bw-blue-600/35'
                          : 'hover:bg-white/[0.03]',
                      ].join(' ')}
                    >
                      <span className="truncate text-sm font-semibold text-bw-navy-950">
                        {row.customerDisplayName}
                      </span>
                      <span className="truncate text-xs text-slate-500">
                        {row.customerEmail}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={statusPill(row.status)}>{row.status}</span>
                        <span className={riskPill(row.riskLevel)}>{row.riskLevel}</span>
                        <span
                          className={[
                            'text-[10px] font-semibold uppercase tracking-wide',
                            ex.tone === 'bad'
                              ? 'text-red-300'
                              : ex.tone === 'warn'
                                ? 'text-amber-200'
                                : ex.tone === 'ok'
                                  ? 'text-slate-400'
                                  : 'text-slate-500',
                          ].join(' ')}
                        >
                          {ex.label}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-3">
          {!selected ? (
            <div className="rounded-xl border border-bw-sand-200 bg-white p-8 text-center text-sm text-slate-500">
              Select a submission from the queue.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-bw-sand-200 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Customer
                    </p>
                    <p className="mt-1 font-display text-lg font-semibold text-bw-navy-950">
                      {selected.customerDisplayName}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      {selected.customerEmail}
                    </p>
                    <p className="mt-2 font-mono text-xs text-slate-500">
                      {selected.id}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={statusPill(selected.status)}>
                      {selected.status}
                    </span>
                    <Link
                      to={`/admin/users/${encodeURIComponent(selected.userId)}`}
                      className="text-xs font-semibold text-bw-blue-500 hover:underline"
                    >
                      Open customer profile
                    </Link>
                  </div>
                </div>
                <dl className="mt-5 grid gap-3 border-t border-bw-sand-200 pt-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Submitted
                    </dt>
                    <dd className="mt-1 text-slate-200">{formatWhen(selected.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Decided
                    </dt>
                    <dd className="mt-1 text-slate-200">
                      {selected.decidedAt ? formatWhen(selected.decidedAt) : '—'}
                    </dd>
                  </div>
                  {selected.decisionNote ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Decision note
                      </dt>
                      <dd className="mt-1 text-slate-300">{selected.decisionNote}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="rounded-xl border border-bw-sand-200 bg-white p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-bw-navy-950">Uploaded documents</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Customer uploads are stored on this demo server under{' '}
                  <span className="font-mono text-slate-400">server/data/kyc-uploads/</span>.
                  Seed queue rows have metadata only (no file bytes).
                </p>
                <ul className="mt-4 space-y-2">
                  {selected.documents.length === 0 ? (
                    <li className="text-sm text-slate-500">No documents attached.</li>
                  ) : (
                    selected.documents.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bw-sand-200 bg-white/80 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-100">
                            {d.fileName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {docKindLabel(d.kind)} · {d.contentType} ·{' '}
                            {formatBytes(d.bytesApprox)} · {formatWhen(d.uploadedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDocModal(d)
                            setDocPreviewErr('')
                          }}
                          className="shrink-0 rounded-md border border-bw-sand-200 bg-white px-3 py-1.5 text-xs font-semibold text-bw-blue-500 transition hover:border-bw-blue-600/40"
                        >
                          View
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <form
                key={`review-${selected.id}-${selected.riskLevel}-${selected.documentExpiresAt ?? ''}-${selected.complianceNotes.length}-${selected.status}`}
                onSubmit={saveReviewFields}
                className="space-y-5 rounded-xl border border-bw-sand-200 bg-white p-5 sm:p-6"
              >
                <h3 className="text-sm font-semibold text-bw-navy-950">
                  Risk, expiry &amp; compliance notes
                </h3>
                {selected.status !== 'pending' ? (
                  <p className="text-sm text-slate-500">
                    This submission is closed. Fields are read-only.
                  </p>
                ) : null}
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block sm:col-span-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Risk level
                    </span>
                    <select
                      name="riskLevel"
                      defaultValue={selected.riskLevel}
                      disabled={selected.status !== 'pending' || busy}
                      className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none focus:border-bw-blue-600/55 focus:ring-2 focus:ring-bw-blue-600/20 disabled:opacity-50"
                    >
                      {RISK_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Primary ID document expiry
                    </span>
                    <input
                      type="date"
                      name="documentExpiresAt"
                      defaultValue={selected.documentExpiresAt ?? ''}
                      disabled={selected.status !== 'pending' || busy}
                      className="mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none focus:border-bw-blue-600/55 focus:ring-2 focus:ring-bw-blue-600/20 disabled:opacity-50"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notes for compliance team
                    </span>
                    <textarea
                      name="complianceNotes"
                      rows={4}
                      defaultValue={selected.complianceNotes}
                      disabled={selected.status !== 'pending' || busy}
                      placeholder="Internal narrative: PEP hits, address verification, escalations…"
                      className="mt-1.5 w-full resize-y rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-bw-blue-600/55 focus:ring-2 focus:ring-bw-blue-600/20 disabled:opacity-50"
                    />
                  </label>
                </div>
                {selected.status === 'pending' ? (
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-bw-navy-950 ring-1 ring-[#2a2f3a] transition hover:ring-bw-blue-600/40 disabled:opacity-50"
                  >
                    Save review fields
                  </button>
                ) : null}
              </form>

              {selected.status === 'pending' ? (
                <div className="rounded-xl border border-bw-sand-200 bg-white p-5 sm:p-6">
                  <h3 className="text-sm font-semibold text-bw-navy-950">Decision</h3>
                  <label className="mt-3 block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Decision note (required to reject)
                    </span>
                    <textarea
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      rows={3}
                      disabled={busy}
                      placeholder="Summarize what the customer was told or why the case was declined."
                      className="mt-1.5 w-full resize-y rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3 py-2.5 text-sm text-bw-navy-950 outline-none placeholder:text-slate-600 focus:border-bw-blue-600/55 focus:ring-2 focus:ring-bw-blue-600/20 disabled:opacity-50"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide('approve')}
                      className="rounded-lg bg-bw-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-bw-blue-500 disabled:opacity-50"
                    >
                      Approve KYC
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide('reject')}
                      className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-600 disabled:opacity-50"
                    >
                      Reject KYC
                    </button>
                  </div>
                </div>
              ) : null}

              {localErr ? (
                <p className="text-sm text-red-400" role="alert">
                  {localErr}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {docModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="kyc-doc-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-bw-sand-200 bg-white p-6 shadow-2xl">
            <h2 id="kyc-doc-title" className="font-display text-lg font-semibold text-bw-navy-950">
              Document preview
            </h2>
            <p className="mt-2 text-sm text-slate-400">{docModal.fileName}</p>
            <dl className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Kind</dt>
                <dd>{docKindLabel(docModal.kind)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">MIME</dt>
                <dd className="truncate">{docModal.contentType}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Size (approx.)</dt>
                <dd>{formatBytes(docModal.bytesApprox)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Uploaded</dt>
                <dd>{formatWhen(docModal.uploadedAt)}</dd>
              </div>
            </dl>
            {docModal.storagePath ? (
              <div className="mt-4 min-h-[200px] rounded-lg border border-bw-sand-200 bg-black/30">
                {docPreviewLoading ? (
                  <p className="p-6 text-center text-sm text-slate-400">
                    Loading file…
                  </p>
                ) : docPreviewErr ? (
                  <p className="p-6 text-center text-sm text-red-300" role="alert">
                    {docPreviewErr}
                  </p>
                ) : docPreviewUrl ? (
                  docModal.contentType.startsWith('image/') ? (
                    <img
                      src={docPreviewUrl}
                      alt=""
                      className="mx-auto max-h-[55vh] w-auto max-w-full object-contain"
                    />
                  ) : docModal.contentType === 'application/pdf' ? (
                    <iframe
                      title="Document preview"
                      src={docPreviewUrl}
                      className="h-[min(55vh,520px)] w-full rounded-b-lg bg-white"
                    />
                  ) : (
                    <p className="p-6 text-center text-sm text-slate-400">
                      Preview not available for this type. Use download from a
                      secure workstation in production.
                    </p>
                  )
                ) : null}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100/95">
                No file bytes on record for this row (demo seed data). Customer
                uploads include an inline preview here.
              </p>
            )}
            <button
              type="button"
              className="mt-6 w-full rounded-lg bg-bw-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800"
              onClick={() => {
                setDocModal(null)
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </AdminConsoleShell>
  )
}
