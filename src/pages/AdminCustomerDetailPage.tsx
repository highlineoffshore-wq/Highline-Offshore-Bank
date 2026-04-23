import { type FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import { setCustomerTokensFromAdminImpersonation } from '../lib/authApi'
import {
  fetchAdminCustomer,
  getAdminToken,
  patchAdminCustomer,
  patchAdminCustomerAccess,
  postAdminCustomerDeposit,
  postAdminCustomerImpersonate,
  postAdminCustomerWithdrawal,
  type AdminCustomerDetail,
} from '../lib/adminApi'
import { formatCurrency, parseDollarsToCents } from '../lib/money'
import type { ApprovalItem } from '../types/approvals'

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

function approvalStatusClass(s: ApprovalItem['status']) {
  if (s === 'pending') return 'text-amber-200'
  if (s === 'approved') return 'text-emerald-200'
  return 'text-red-200'
}

function normEmailLocal(s: string): string {
  return s.trim().toLowerCase()
}

/** Optional admin "when it occurred" from `datetime-local` → ISO for the API. */
function resolveOperatorLedgerBookedAt(raw: string): {
  bookedAt?: string
  error?: string
} {
  const t = raw.trim()
  if (!t) return {}
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) {
    return { error: 'Invalid date and time.' }
  }
  if (d.getTime() < Date.UTC(2000, 0, 1)) {
    return { error: 'Must be on or after 2000-01-01.' }
  }
  if (d.getTime() > Date.now()) {
    return { error: 'Cannot use a future date or time.' }
  }
  return { bookedAt: d.toISOString() }
}

const inpProfile =
  'mt-1 w-full rounded-lg border border-[#2a2f3a] bg-[#151820] px-3 py-2 text-sm text-slate-100 outline-none ring-[#3b82f6]/40 placeholder:text-slate-600 focus:border-[#3b82f6]/55 focus:ring-2'

export function AdminCustomerDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const id = userId?.trim() ?? ''
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [loading, setLoading] = useState(true)

  const [ledgerAccountId, setLedgerAccountId] = useState('')
  const [ledgerAmount, setLedgerAmount] = useState('')
  const [ledgerBookedAtLocal, setLedgerBookedAtLocal] = useState('')
  const [ledgerMemo, setLedgerMemo] = useState('')
  const [ledgerBusy, setLedgerBusy] = useState(false)
  const [ledgerErr, setLedgerErr] = useState('')
  const [ledgerOk, setLedgerOk] = useState('')

  const [accessRestricted, setAccessRestricted] = useState(false)
  const [accessReason, setAccessReason] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const [accessErr, setAccessErr] = useState('')
  const [accessOk, setAccessOk] = useState('')

  const [editDisplayName, setEditDisplayName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editEmailOtp, setEditEmailOtp] = useState(false)
  const [profilePwNew, setProfilePwNew] = useState('')
  const [profilePwConfirm, setProfilePwConfirm] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileErr, setProfileErr] = useState('')
  const [profileOk, setProfileOk] = useState('')
  const [impersonateBusy, setImpersonateBusy] = useState(false)
  const [impersonateErr, setImpersonateErr] = useState('')

  useEffect(() => {
    if (!getAdminToken() || !id) return
    ;(async () => {
      try {
        setDetail(await fetchAdminCustomer(id))
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Load failed.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  useEffect(() => {
    if (!detail) return
    setAccessRestricted(Boolean(detail.onlineBankingRestricted))
    setAccessReason(detail.onlineBankingRestrictionReason ?? '')
    setAccessErr('')
  }, [detail])

  useEffect(() => {
    if (!detail?.accounts?.length) return
    setLedgerAccountId((prev) => {
      if (prev && detail.accounts.some((a) => a.id === prev)) return prev
      return detail.accounts[0].id
    })
  }, [detail])

  useEffect(() => {
    if (!detail) return
    setEditDisplayName(detail.displayName)
    setEditEmail(detail.email)
    setEditEmailOtp(detail.emailOtpEnabled)
  }, [detail])

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  if (!id) {
    return <Navigate to="/admin/users" replace />
  }

  return (
    <AdminConsoleShell
      title={detail?.displayName ?? 'Customer'}
      breadcrumb="User management"
      subtitle={
        detail ? (
          <>
            <span className="font-mono text-xs text-slate-500">{detail.id}</span>
            {detail.internetBankingId ? (
              <>
                <span className="mx-2 text-slate-600">·</span>
                <span>Internet ID {detail.internetBankingId}</span>
              </>
            ) : null}
          </>
        ) : (
          'Loading customer record…'
        )
      }
      headerAside={
        <Link
          to="/admin/users"
          className="rounded-lg border border-[#2a2f3a] bg-[#1c1f26] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-[#3b82f6]/40 hover:text-white"
        >
          ← All users
        </Link>
      }
    >
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-xl bg-[#1c1f26]" />
          <div className="h-48 rounded-xl bg-[#1c1f26]" />
        </div>
      ) : loadErr ? (
        <div className="max-w-xl rounded-2xl border border-red-500/25 bg-red-950/30 p-6">
          <h2 className="font-display text-lg font-semibold text-red-100">
            Could not load customer
          </h2>
          <p className="mt-2 text-sm text-red-200/80">{loadErr}</p>
          <Link
            to="/admin/users"
            className="mt-5 inline-block rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-red-900 transition hover:bg-red-50"
          >
            Back to directory
          </Link>
        </div>
      ) : detail ? (
        <div className="space-y-6">
          <section className="rounded-xl border border-sky-500/35 bg-sky-950/30 p-6">
            <h2 className="font-display text-lg font-semibold text-sky-100">
              Sign in as customer
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-sky-100/85">
              Issues a real customer session for this browser (same tokens as
              password sign-in). Use only for authorized support or testing. To
              return here, sign out from Online Banking and open the operator
              console again.
            </p>
            {impersonateErr ? (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm text-red-100"
              >
                {impersonateErr}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={
                  impersonateBusy || Boolean(detail.onlineBankingRestricted)
                }
                onClick={() => {
                  if (
                    !window.confirm(
                      'Open Online Banking as this customer in this browser?',
                    )
                  ) {
                    return
                  }
                  setImpersonateErr('')
                  void (async () => {
                    setImpersonateBusy(true)
                    try {
                      const session = await postAdminCustomerImpersonate(id)
                      setCustomerTokensFromAdminImpersonation(
                        session.accessToken,
                        session.refreshToken,
                      )
                      window.location.assign('/app')
                    } catch (e) {
                      setImpersonateErr(
                        e instanceof Error ? e.message : 'Could not continue.',
                      )
                      setImpersonateBusy(false)
                    }
                  })()
                }}
                className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {impersonateBusy ? 'Opening…' : 'Sign in as this customer'}
              </button>
              {detail.onlineBankingRestricted ? (
                <span className="text-xs text-amber-200/95">
                  Lift the online banking restriction below before impersonating.
                </span>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-[#2a2f3a] bg-[#1c1f26] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              Profile &amp; sign-in
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Updates are written to the customer record on the application
              server. Changing email affects sign-in; resetting password ends all
              active sessions for this customer.
            </p>
            {profileErr ? (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm text-red-100"
              >
                {profileErr}
              </p>
            ) : null}
            {profileOk ? (
              <p
                role="status"
                className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100"
              >
                {profileOk}
              </p>
            ) : null}
            <form
              className="mt-6 max-w-xl space-y-4"
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                setProfileErr('')
                setProfileOk('')
                if (profilePwNew.trim()) {
                  if (profilePwNew.length < 8) {
                    setProfileErr('New password must be at least 8 characters.')
                    return
                  }
                  if (profilePwNew !== profilePwConfirm) {
                    setProfileErr('Password confirmation does not match.')
                    return
                  }
                }
                const unchanged =
                  editDisplayName.trim() === detail.displayName &&
                  normEmailLocal(editEmail) === normEmailLocal(detail.email) &&
                  editEmailOtp === detail.emailOtpEnabled &&
                  !profilePwNew.trim()
                if (unchanged) {
                  setProfileErr('Change a field or set a new password before saving.')
                  return
                }
                void (async () => {
                  setProfileBusy(true)
                  try {
                    await patchAdminCustomer(id, {
                      displayName: editDisplayName.trim() || detail.displayName,
                      email: editEmail.trim(),
                      emailOtpEnabled: editEmailOtp,
                      ...(profilePwNew.trim()
                        ? { newPassword: profilePwNew.trim() }
                        : {}),
                    })
                    setProfilePwNew('')
                    setProfilePwConfirm('')
                    setProfileOk('Customer profile saved.')
                    setDetail(await fetchAdminCustomer(id))
                    window.setTimeout(() => setProfileOk(''), 5000)
                  } catch (err) {
                    setProfileErr(
                      err instanceof Error ? err.message : 'Save failed.',
                    )
                  } finally {
                    setProfileBusy(false)
                  }
                })()
              }}
            >
              <div>
                <label
                  htmlFor="admin-cust-display"
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  Display name
                </label>
                <input
                  id="admin-cust-display"
                  className={inpProfile}
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="admin-cust-email"
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  Email
                </label>
                <input
                  id="admin-cust-email"
                  type="email"
                  className={inpProfile}
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <label className="flex cursor-pointer gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-500 bg-[#151820] text-[#3b82f6] focus:ring-[#3b82f6]/50"
                  checked={editEmailOtp}
                  onChange={(e) => setEditEmailOtp(e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-white">
                    Email sign-in verification (OTP)
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    When on, the customer gets a code by email after password at
                    sign-in (requires SMTP).
                  </span>
                </span>
              </label>
              <div className="rounded-lg border border-[#2a2f3a] bg-[#151820]/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Optional — reset password
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Leave blank to keep the current password. If set, the customer
                  is signed out everywhere and must use the new password.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="admin-cust-pw-new"
                      className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      New password
                    </label>
                    <input
                      id="admin-cust-pw-new"
                      type="password"
                      autoComplete="new-password"
                      className={inpProfile}
                      value={profilePwNew}
                      onChange={(e) => setProfilePwNew(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="admin-cust-pw-confirm"
                      className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Confirm
                    </label>
                    <input
                      id="admin-cust-pw-confirm"
                      type="password"
                      autoComplete="new-password"
                      className={inpProfile}
                      value={profilePwConfirm}
                      onChange={(e) => setProfilePwConfirm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={profileBusy}
                className="rounded-lg bg-[#3b82f6] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {profileBusy ? 'Saving…' : 'Save profile'}
              </button>
            </form>
            <dl className="mt-8 grid gap-3 border-t border-[#2a2f3a] pt-6 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Created
                </dt>
                <dd className="mt-0.5 text-slate-200">
                  {formatWhen(detail.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Transaction PIN
                </dt>
                <dd className="mt-0.5 text-slate-200">
                  {detail.hasTransactionPin ? 'Set' : 'Not set'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-amber-600/30 bg-amber-950/25 p-6">
            <h2 className="font-display text-lg font-semibold text-amber-50">
              Fraud &amp; security — online banking access
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-100/75">
              When restricted, the customer cannot sign in to online banking or
              use any signed-in session. Active sessions are ended immediately.
              They are shown your optional message on the sign-in screen and must
              contact support (by email) before access can be restored. Lift the
              hold only after your review is complete.
            </p>
            {accessErr ? (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm leading-relaxed text-red-100"
              >
                {accessErr}
              </p>
            ) : null}
            {accessOk ? (
              <p
                role="status"
                className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100"
              >
                {accessOk}
              </p>
            ) : null}

            <div className="mt-6 rounded-lg border border-amber-700/35 bg-[#151820]/90 p-4">
              <label className="flex cursor-pointer gap-3 text-sm text-amber-50">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400/50 bg-[#1c1f26] text-amber-500 focus:ring-amber-400"
                  checked={accessRestricted}
                  onChange={(e) => setAccessRestricted(e.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-amber-50">
                    Restrict online banking
                  </span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-amber-100/75">
                    Use for suspected fraud, account takeover, or unauthorized
                    access while you investigate.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-5">
              <label
                htmlFor="access-reason"
                className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80"
              >
                Message to customer (optional)
              </label>
              <textarea
                id="access-reason"
                rows={3}
                disabled={!accessRestricted}
                value={accessReason}
                onChange={(e) => setAccessReason(e.target.value)}
                placeholder="e.g. We froze online sign-in pending a security review. Email support@… for help."
                className="mt-1.5 w-full max-w-xl rounded-lg border border-amber-700/40 bg-[#1c1f26] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              />
            </div>
            <button
              type="button"
              disabled={accessBusy}
              onClick={() => {
                void (async () => {
                  setAccessBusy(true)
                  setAccessErr('')
                  setAccessOk('')
                  try {
                    await patchAdminCustomerAccess(id, {
                      restricted: accessRestricted,
                      reason: accessReason,
                    })
                    setAccessOk('Access settings saved.')
                    setDetail(await fetchAdminCustomer(id))
                  } catch (e) {
                    setAccessErr(
                      e instanceof Error ? e.message : 'Save failed.',
                    )
                  } finally {
                    setAccessBusy(false)
                  }
                })()
              }}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {accessBusy ? 'Saving…' : 'Save access settings'}
            </button>
          </section>

          <section className="rounded-xl border border-[#2a2f3a] bg-[#1c1f26] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              Enrollment & onboarding
            </h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Pipeline status
                </dt>
                <dd className="mt-0.5 text-slate-200">
                  {detail.onboardingStatus ?? '—'}
                  {detail.onboardingUpdatedAt ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      Updated {formatWhen(detail.onboardingUpdatedAt)}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Product interests (signup)
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-300">
                  {detail.openAccountInterest?.length
                    ? detail.openAccountInterest.join(', ')
                    : '—'}
                </dd>
              </div>
              {detail.businessLegalName ? (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Business (declared)
                  </dt>
                  <dd className="mt-0.5 text-slate-200">
                    {detail.businessLegalName}
                    {detail.businessTradeName ? (
                      <span className="mt-1 block text-xs text-slate-400">
                        DBA: {detail.businessTradeName}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border border-[#2a2f3a] bg-[#1c1f26] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              Balances & products
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Total across accounts:{' '}
              <span className="font-semibold text-white tabular-nums">
                {formatCurrency(detail.totalBalanceCents)}
              </span>
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase text-slate-500">
                  Activity lines
                </dt>
                <dd className="mt-0.5 font-mono text-slate-200">
                  {detail.activityCount}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-slate-500">
                  Scheduled bills
                </dt>
                <dd className="mt-0.5 font-mono text-slate-200">
                  {detail.scheduledBillCount}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-slate-500">
                  Pending approvals
                </dt>
                <dd className="mt-0.5 font-mono text-slate-200">
                  {detail.pendingApprovals}
                </dd>
              </div>
              {detail.loanApplicationCount != null ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-500">
                    Loan apps
                  </dt>
                  <dd className="mt-0.5 font-mono text-slate-200">
                    {detail.loanApplicationCount}
                  </dd>
                </div>
              ) : null}
              {detail.fixedDepositCount != null ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-500">
                    Fixed deposits
                  </dt>
                  <dd className="mt-0.5 font-mono text-slate-200">
                    {detail.fixedDepositCount}
                  </dd>
                </div>
              ) : null}
              {detail.dpsPlanCount != null ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-500">
                    DPS plans
                  </dt>
                  <dd className="mt-0.5 font-mono text-slate-200">
                    {detail.dpsPlanCount}
                  </dd>
                </div>
              ) : null}
              {detail.fxHoldingCount != null ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-500">
                    FX holdings
                  </dt>
                  <dd className="mt-0.5 font-mono text-slate-200">
                    {detail.fxHoldingCount}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border border-[#2a2f3a] bg-[#1c1f26] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              Accounts
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2a2f3a] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Mask</th>
                    <th className="pb-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2f3a]">
                  {detail.accounts.map((a) => (
                    <tr key={a.id} className="text-slate-300">
                      <td className="py-2.5 pr-4 font-medium text-white">
                        {a.name}
                      </td>
                      <td className="py-2.5 pr-4">{a.type}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{a.mask}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-200">
                        {formatCurrency(a.balanceCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-[#2a2f3a] bg-[#1c1f26] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              Operator ledger
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Credit or debit deposit accounts. Posts to the customer&apos;s balance
              and activity (dashboard refreshes within a few seconds). Optionally set
              when the entry <span className="text-slate-400">occurred</span> using
              the date and time below (your device timezone); it is stored as an
              instant and shown in activity with full date and time (UTC). Operator
              credits and debits also appear under{' '}
              <Link
                to="/admin/transactions?view=history"
                className="font-semibold text-[#93c5fd] hover:underline"
              >
                Transactions
              </Link>{' '}
              → History or All (not the Live queue). Audit: admin.customer.deposit /
              admin.customer.withdrawal.
            </p>
            {ledgerErr ? (
              <p
                className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200"
                role="alert"
              >
                {ledgerErr}
              </p>
            ) : null}
            {ledgerOk ? (
              <p
                className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100"
                role="status"
              >
                {ledgerOk}
              </p>
            ) : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  htmlFor="adm-ledger-acct"
                >
                  Account
                </label>
                <select
                  id="adm-ledger-acct"
                  className="mt-1 w-full rounded-lg border border-[#2a2f3a] bg-[#111318] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#3b82f6]/50"
                  value={ledgerAccountId}
                  disabled={ledgerBusy || !detail.accounts.length}
                  onChange={(e) => setLedgerAccountId(e.target.value)}
                >
                  {detail.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type}) · {a.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  htmlFor="adm-ledger-amt"
                >
                  Amount (USD)
                </label>
                <input
                  id="adm-ledger-amt"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 250 or 99.50"
                  disabled={ledgerBusy}
                  className="mt-1 w-full rounded-lg border border-[#2a2f3a] bg-[#111318] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#3b82f6]/50"
                  value={ledgerAmount}
                  onChange={(e) => {
                    setLedgerErr('')
                    setLedgerOk('')
                    setLedgerAmount(e.target.value)
                  }}
                />
              </div>
            </div>
            <div className="mt-4">
              <label
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                htmlFor="adm-ledger-booked"
              >
                When it occurred (optional)
              </label>
              <input
                id="adm-ledger-booked"
                type="datetime-local"
                min="2000-01-01T00:00"
                max={(() => {
                  const d = new Date()
                  const pad = (n: number) => String(n).padStart(2, '0')
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
                })()}
                step={1}
                disabled={ledgerBusy}
                className="mt-1 w-full max-w-md rounded-lg border border-[#2a2f3a] bg-[#111318] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#3b82f6]/50"
                value={ledgerBookedAtLocal}
                onChange={(e) => {
                  setLedgerErr('')
                  setLedgerOk('')
                  setLedgerBookedAtLocal(e.target.value)
                }}
              />
              <p className="mt-1 text-[11px] text-slate-600">
                Leave blank to post as now. Must not be in the future. Activity shows
                date, year, and time in UTC.
              </p>
            </div>
            <div className="mt-4">
              <label
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                htmlFor="adm-ledger-memo"
              >
                Memo (optional)
              </label>
              <input
                id="adm-ledger-memo"
                type="text"
                maxLength={240}
                disabled={ledgerBusy}
                placeholder="Shown on customer activity"
                className="mt-1 w-full rounded-lg border border-[#2a2f3a] bg-[#111318] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#3b82f6]/50"
                value={ledgerMemo}
                onChange={(e) => {
                  setLedgerErr('')
                  setLedgerOk('')
                  setLedgerMemo(e.target.value)
                }}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={ledgerBusy}
                onClick={() => {
                  void (async () => {
                    setLedgerErr('')
                    setLedgerOk('')
                    const cents = parseDollarsToCents(ledgerAmount)
                    if (cents == null || cents <= 0) {
                      setLedgerErr('Enter a positive dollar amount.')
                      return
                    }
                    if (!ledgerAccountId) {
                      setLedgerErr('Select an account.')
                      return
                    }
                    const ledgerTs = resolveOperatorLedgerBookedAt(ledgerBookedAtLocal)
                    if (ledgerTs.error) {
                      setLedgerErr(ledgerTs.error)
                      return
                    }
                    setLedgerBusy(true)
                    try {
                      const actId = await postAdminCustomerDeposit(id, {
                        accountId: ledgerAccountId,
                        amountCents: cents,
                        memo: ledgerMemo || undefined,
                        ...(ledgerTs.bookedAt
                          ? { bookedAt: ledgerTs.bookedAt }
                          : {}),
                      })
                      setLedgerOk(
                        actId
                          ? `Deposit posted (activity ${actId}). Balances updated; customer dashboard picks this up on refresh. In Transactions, open History or All — not Live.`
                          : 'Deposit posted. Balances updated; customer dashboard picks this up on refresh. In Transactions, open History or All — not Live.',
                      )
                      setLedgerAmount('')
                      setLedgerBookedAtLocal('')
                      setLedgerMemo('')
                      setDetail(await fetchAdminCustomer(id))
                    } catch (e) {
                      setLedgerErr(
                        e instanceof Error ? e.message : 'Deposit failed.',
                      )
                    } finally {
                      setLedgerBusy(false)
                    }
                  })()
                }}
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {ledgerBusy ? 'Posting…' : 'Post deposit (credit)'}
              </button>
              <button
                type="button"
                disabled={ledgerBusy}
                onClick={() => {
                  void (async () => {
                    setLedgerErr('')
                    setLedgerOk('')
                    const cents = parseDollarsToCents(ledgerAmount)
                    if (cents == null || cents <= 0) {
                      setLedgerErr('Enter a positive dollar amount.')
                      return
                    }
                    if (!ledgerAccountId) {
                      setLedgerErr('Select an account.')
                      return
                    }
                    const ledgerTs = resolveOperatorLedgerBookedAt(ledgerBookedAtLocal)
                    if (ledgerTs.error) {
                      setLedgerErr(ledgerTs.error)
                      return
                    }
                    setLedgerBusy(true)
                    try {
                      const actId = await postAdminCustomerWithdrawal(id, {
                        accountId: ledgerAccountId,
                        amountCents: cents,
                        memo: ledgerMemo || undefined,
                        ...(ledgerTs.bookedAt
                          ? { bookedAt: ledgerTs.bookedAt }
                          : {}),
                      })
                      setLedgerOk(
                        actId
                          ? `Withdrawal posted (activity ${actId}). Balances updated; customer dashboard picks this up on refresh. In Transactions, open History or All — not Live.`
                          : 'Withdrawal posted. Balances updated; customer dashboard picks this up on refresh. In Transactions, open History or All — not Live.',
                      )
                      setLedgerAmount('')
                      setLedgerBookedAtLocal('')
                      setLedgerMemo('')
                      setDetail(await fetchAdminCustomer(id))
                    } catch (e) {
                      setLedgerErr(
                        e instanceof Error ? e.message : 'Withdrawal failed.',
                      )
                    } finally {
                      setLedgerBusy(false)
                    }
                  })()
                }}
                className="rounded-lg bg-orange-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {ledgerBusy ? 'Posting…' : 'Post withdrawal (debit)'}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-[#2a2f3a] bg-[#1c1f26] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              Recent approvals
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Last {detail.recentApprovals.length} items for this customer.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2a2f3a] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4">When</th>
                    <th className="pb-2 pr-4">Title</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2f3a]">
                  {detail.recentApprovals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-slate-500"
                      >
                        No approval history yet.
                      </td>
                    </tr>
                  ) : (
                    detail.recentApprovals.map((row) => (
                      <tr key={row.id} className="text-slate-300">
                        <td className="py-2.5 pr-4 text-xs text-slate-400">
                          {formatWhen(row.createdAt)}
                        </td>
                        <td className="max-w-[14rem] truncate py-2.5 pr-4 text-white">
                          {row.title}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-400">
                          {row.type}
                        </td>
                        <td
                          className={`py-2.5 text-xs font-semibold uppercase ${approvalStatusClass(row.status)}`}
                        >
                          {row.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-slate-500">
            <Link
              to="/admin/transactions"
              className="font-semibold text-[#93c5fd] hover:text-white"
            >
              Open full transactions console
            </Link>
            <span className="mx-2 text-slate-600">·</span>
            <Link
              to="/admin/users"
              className="font-semibold text-[#93c5fd] hover:text-white"
            >
              Back to directory
            </Link>
          </p>
        </div>
      ) : null}
    </AdminConsoleShell>
  )
}
