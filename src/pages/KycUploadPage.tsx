import { useCallback, useEffect, useState } from 'react'
import { KycDocumentSlotsForm } from '../components/KycDocumentSlotsForm'
import { fetchCustomerKycMe, type CustomerKycSummary } from '../lib/kycCustomerApi'

async function fetchKycStatusResult(): Promise<
  | { ok: true; data: CustomerKycSummary | null }
  | { ok: false; error: string }
> {
  try {
    const data = await fetchCustomerKycMe()
    return { ok: true, data }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not load status.',
    }
  }
}

export function KycUploadPage() {
  const [status, setStatus] = useState<CustomerKycSummary | null | undefined>(
    undefined,
  )
  const [loadErr, setLoadErr] = useState('')
  const [doneId, setDoneId] = useState('')

  const applyKycResult = useCallback(
    (r: Awaited<ReturnType<typeof fetchKycStatusResult>>) => {
      if (r.ok) {
        setStatus(r.data)
        setLoadErr('')
      } else {
        setStatus(null)
        setLoadErr(r.error)
      }
    },
    [],
  )

  const refresh = useCallback(async () => {
    const r = await fetchKycStatusResult()
    applyKycResult(r)
  }, [applyKycResult])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await fetchKycStatusResult()
      if (!cancelled) applyKycResult(r)
    })()
    return () => {
      cancelled = true
    }
  }, [applyKycResult])

  const pendingBlock = status?.status === 'pending'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-bw-navy-900">
          Identity verification
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-bw-muted">
          Upload clear photos or scans of your documents. We keep them on file
          for compliance review. You will receive updates by email once a
          decision is recorded.
        </p>
      </div>

      {loadErr ? (
        <div
          role="alert"
          className="rounded-xl border border-bw-red-600/30 bg-red-50 px-5 py-4 text-sm text-bw-red-800"
        >
          {loadErr}
        </div>
      ) : null}

      {status === undefined && !loadErr ? (
        <p className="text-sm text-bw-muted">Loading your verification status…</p>
      ) : null}

      {status?.status === 'pending' ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/35 bg-amber-50 px-5 py-4 text-sm text-amber-950"
        >
          <p className="font-semibold">A package is already under review.</p>
          <p className="mt-1 text-amber-900/90">
            Submitted {new Date(status.createdAt).toLocaleString()}. You cannot
            upload again until this case is approved or rejected.
          </p>
        </div>
      ) : null}

      {status?.status === 'approved' ? (
        <div
          role="status"
          className="rounded-xl border border-bw-blue-500/30 bg-bw-sky-100/90 px-5 py-4 text-sm text-bw-navy-950"
        >
          Your latest verification is <strong>approved</strong>. You may submit
          a new package if we have asked for updated documents.
        </div>
      ) : null}

      {status?.status === 'rejected' ? (
        <div
          role="status"
          className="rounded-xl border border-bw-red-600/25 bg-red-50 px-5 py-4 text-sm text-bw-red-900"
        >
          <p className="font-semibold">Previous submission was not accepted.</p>
          {status.decisionNote ? (
            <p className="mt-1">{status.decisionNote}</p>
          ) : null}
          <p className="mt-2 text-bw-red-800/90">
            Upload a new package below when you are ready.
          </p>
        </div>
      ) : null}

      {doneId ? (
        <div
          role="status"
          className="rounded-xl border border-bw-blue-500/25 bg-bw-sky-100/90 px-5 py-4 text-sm text-bw-navy-900"
        >
          <p className="font-semibold">Submission received.</p>
          <p className="mt-1 font-mono text-xs text-bw-navy-800">Reference: {doneId}</p>
        </div>
      ) : null}

      <KycDocumentSlotsForm
        disabled={pendingBlock}
        onSuccess={async (id) => {
          setDoneId(id)
          await refresh()
        }}
      />
    </div>
  )
}
