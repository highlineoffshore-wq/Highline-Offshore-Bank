import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useAccounts,
  type ScheduledBillPayment,
} from '../contexts/AccountsContext'
import { useApprovals } from '../contexts/ApprovalsContext'
import { useAuth } from '../contexts/AuthContext'
import { useBankConfig } from '../contexts/BankConfigContext'
import { cancelScheduledBillPayment } from '../lib/bankingApi'
import { formatCurrency, parseDollarsToCents } from '../lib/money'
import type { ApprovalType } from '../types/approvals'
import { CustomerPendingApprovals } from '../components/CustomerPendingApprovals'
import type { BankDepositsAndFees } from '../types/bankConfig'
import { apiResendWireTransferOtp, apiStartWireTransferOtp } from '../lib/authApi'

const PAYEE_PRESETS = [
  'City Utilities',
  'Metro Insurance',
  'Student loan servicer',
  'Auto finance',
]

type TabId = 'transfer' | 'bills' | 'send' | 'wire' | 'deposit'

function tabFromParam(v: string | null): TabId {
  if (v === 'bills' || v === 'send' || v === 'wire' || v === 'deposit')
    return v
  return 'transfer'
}

function digitsOnly6(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6)
}

function transactionPinMessage(
  pinRequired: boolean,
  rawPin: string,
): string | null {
  if (!pinRequired) return null
  return digitsOnly6(rawPin).length === 6
    ? null
    : 'Enter your 6-digit transaction PIN to authorize this request.'
}

type DepositRailId = 'mobile' | 'card' | 'crypto'

function incomingFeeCentsForRail(
  df: BankDepositsAndFees | undefined,
  rail: DepositRailId,
  grossCents: number,
): number {
  if (df?.transactionFeesMode !== 'auto') return 0
  let raw = 0
  if (rail === 'mobile') raw = Number(df.incomingBankTransferFeeCents) || 0
  else if (rail === 'card') raw = Number(df.cardFundingFeeCents) || 0
  else raw = Number(df.cryptoDepositFeeCents) || 0
  const n = Math.max(0, Math.round(raw))
  return Math.min(n, Math.max(0, grossCents - 1))
}

function depositRailFromParam(
  v: string | null,
  df: BankDepositsAndFees | undefined,
): DepositRailId {
  const m = df?.depositMethods
  const mobileOn = m?.bankTransfer !== false
  const cardOn = m?.cardFunding === true
  const cryptoOn = m?.crypto === true
  if (v === 'mobile' && mobileOn) return 'mobile'
  if (v === 'card' && cardOn) return 'card'
  if (v === 'crypto' && cryptoOn) return 'crypto'
  if (mobileOn) return 'mobile'
  if (cardOn) return 'card'
  return 'crypto'
}

function approvalPinFields(
  pinRequired: boolean,
  rawPin: string,
): { transactionPin?: string } {
  if (!pinRequired) return {}
  return { transactionPin: digitsOnly6(rawPin) }
}

type PendingWireSubmit = {
  payload: unknown
  title: string
  cents: number
  submittedScope: 'domestic' | 'international'
}

export function PayTransferPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = tabFromParam(searchParams.get('tab'))

  const {
    accounts,
    scheduledBillPayments,
    applyBankingSnapshot,
    refresh,
    onlineBankingRestricted,
  } = useAccounts()
  const { submitForApproval, items: approvalItems } = useApprovals()
  const { user } = useAuth()
  const bankCfg = useBankConfig()
  const depositsCfg = bankCfg.depositsAndFees
  const showDepositTab = useMemo(() => {
    const m = depositsCfg?.depositMethods
    return (
      m?.bankTransfer !== false ||
      m?.cardFunding === true ||
      m?.crypto === true
    )
  }, [depositsCfg])

  const depositRail = useMemo(
    () => depositRailFromParam(searchParams.get('depositRail'), depositsCfg),
    [searchParams, depositsCfg],
  )

  const setTab = (next: TabId) => {
    const p = new URLSearchParams(searchParams)
    if (next === 'transfer') {
      p.delete('tab')
      p.delete('depositRail')
    } else {
      p.set('tab', next)
      if (next === 'deposit') {
        p.set(
          'depositRail',
          depositRailFromParam(p.get('depositRail'), depositsCfg),
        )
      }
    }
    setSearchParams(p, { replace: true })
  }

  const setDepositRail = (rail: DepositRailId) => {
    const p = new URLSearchParams(searchParams)
    p.set('tab', 'deposit')
    p.set('depositRail', rail)
    setSearchParams(p, { replace: true })
  }

  useEffect(() => {
    if (tab === 'deposit' && !showDepositTab) {
      const p = new URLSearchParams(searchParams)
      p.delete('tab')
      p.delete('depositRail')
      setSearchParams(p, { replace: true })
    }
  }, [tab, showDepositTab, searchParams, setSearchParams])

  useEffect(() => {
    if (tab !== 'deposit' || !showDepositTab) return
    const fromUrl = searchParams.get('depositRail')
    const canonical = depositRailFromParam(fromUrl, depositsCfg)
    if (fromUrl !== canonical) {
      const p = new URLSearchParams(searchParams)
      p.set('depositRail', canonical)
      setSearchParams(p, { replace: true })
    }
  }, [tab, showDepositTab, depositsCfg, searchParams, setSearchParams])
  const pinRequired = Boolean(user?.hasTransactionPin)
  const [transactionPin, setTransactionPin] = useState('')

  useEffect(() => {
    if (!pinRequired) {
      queueMicrotask(() => setTransactionPin(''))
    }
  }, [pinRequired])

  const [banner, setBanner] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        id: a.id,
        label: `${a.name} ···${a.mask} (${formatCurrency(a.balanceCents)})`,
      })),
    [accounts],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-bw-navy-900">
            Pay &amp; transfer
          </h1>
          <p className="mt-1 text-bw-muted">
            Transfers between your own deposit accounts post immediately. Wires,
            bills, card changes, and person-to-person payments are submitted for
            back-office approval first. Incoming deposits (mobile check, card
            funding, or crypto on-ramp—when offered) follow your institution&apos;s
            policy for immediate credit versus operator review. Once items are
            applied, balances and activity update in your online banking profile.
          </p>
        </div>
        <Link
          to="/app"
          className="text-sm font-semibold text-bw-blue-600 hover:underline"
        >
          ← Back to accounts
        </Link>
      </div>

      <CustomerPendingApprovals items={approvalItems} />

      {banner && (
        <div
          role="status"
          className={
            banner.type === 'success'
              ? 'rounded-lg border border-bw-blue-500/20 bg-bw-sky-100 px-4 py-3 text-sm text-bw-navy-900'
              : 'rounded-lg border border-bw-red-600/30 bg-red-50 px-4 py-3 text-sm text-bw-red-800'
          }
        >
          {banner.message}
        </div>
      )}

      <fieldset
        disabled={onlineBankingRestricted}
        className="min-w-0 space-y-8 border-0 p-0 disabled:opacity-[0.55]"
      >
      <div
        className="flex flex-wrap gap-1 rounded-lg border border-bw-sand-200 bg-white p-1 shadow-sm"
        role="tablist"
        aria-label="Payment type"
      >
        {(
          [
            ['transfer', 'Between accounts'],
            ['wire', 'Wire transfer'],
            ...(showDepositTab ? ([['deposit', 'Deposits']] as const) : []),
            ['bills', 'Pay a bill'],
            ['send', 'Send to someone'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={[
              'rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:px-4',
              tab === id
                ? 'bg-bw-navy-900 text-white shadow-sm'
                : 'text-bw-muted hover:bg-bw-sand-100 hover:text-bw-navy-900',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {pinRequired ? (
        <div className="rounded-lg border border-bw-sand-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <label
            className="block text-sm font-medium text-bw-navy-900"
            htmlFor="pay-tx-pin"
          >
            Transaction PIN
          </label>
          <input
            id="pay-tx-pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            value={transactionPin}
            onChange={(e) =>
              setTransactionPin(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="6 digits"
            className="mt-1 w-full max-w-xs rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm tracking-widest outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
          />
          <p className="mt-2 text-xs text-bw-muted">
            Required for payment and transfer requests on this page. Set or
            change your PIN under Settings → Security.
          </p>
        </div>
      ) : null}

      {tab === 'transfer' && (
        <BetweenAccountsForm
          accountOptions={accountOptions}
          accounts={accounts}
          pinRequired={pinRequired}
          transactionPin={transactionPin}
          onError={(msg) => setBanner({ type: 'error', message: msg })}
          submitForApproval={submitForApproval}
          onTransferComplete={() => void refresh()}
        />
      )}
      {tab === 'bills' && (
        <BillPayForm
          accountOptions={accountOptions}
          accounts={accounts}
          scheduledBillPayments={scheduledBillPayments}
          applyBankingSnapshot={applyBankingSnapshot}
          pinRequired={pinRequired}
          transactionPin={transactionPin}
          onSuccess={(msg) => setBanner({ type: 'success', message: msg })}
          onError={(msg) => setBanner({ type: 'error', message: msg })}
          submitForApproval={submitForApproval}
        />
      )}
      {tab === 'send' && (
        <SendMoneyForm
          accountOptions={accountOptions}
          accounts={accounts}
          pinRequired={pinRequired}
          transactionPin={transactionPin}
          onSuccess={(msg) => setBanner({ type: 'success', message: msg })}
          onError={(msg) => setBanner({ type: 'error', message: msg })}
          submitForApproval={submitForApproval}
        />
      )}
      {tab === 'wire' && (
        <WireTransferForm
          accountOptions={accountOptions}
          pinRequired={pinRequired}
          transactionPin={transactionPin}
          onSuccess={(msg) => setBanner({ type: 'success', message: msg })}
          onError={(msg) => setBanner({ type: 'error', message: msg })}
          submitForApproval={submitForApproval}
        />
      )}
      {tab === 'deposit' && showDepositTab ? (
        <div className="space-y-6">
          <DepositRailTabs
            depositRail={depositRail}
            depositsCfg={depositsCfg}
            onSelectRail={setDepositRail}
          />
          {depositRail === 'mobile' &&
          depositsCfg?.depositMethods?.bankTransfer !== false ? (
            <MobileDepositForm
              accountOptions={accountOptions}
              accounts={accounts}
              pinRequired={pinRequired}
              transactionPin={transactionPin}
              onSuccess={(msg) => setBanner({ type: 'success', message: msg })}
              onError={(msg) => setBanner({ type: 'error', message: msg })}
              submitForApproval={submitForApproval}
              onRefreshAccounts={() => void refresh()}
            />
          ) : null}
          {depositRail === 'card' &&
          depositsCfg?.depositMethods?.cardFunding === true ? (
            <RailsIncomingDepositForm
              mode="card"
              accountOptions={accountOptions}
              accounts={accounts}
              pinRequired={pinRequired}
              transactionPin={transactionPin}
              onSuccess={(msg) => setBanner({ type: 'success', message: msg })}
              onError={(msg) => setBanner({ type: 'error', message: msg })}
              submitForApproval={submitForApproval}
              onRefreshAccounts={() => void refresh()}
            />
          ) : null}
          {depositRail === 'crypto' &&
          depositsCfg?.depositMethods?.crypto === true ? (
            <RailsIncomingDepositForm
              mode="crypto"
              accountOptions={accountOptions}
              accounts={accounts}
              pinRequired={pinRequired}
              transactionPin={transactionPin}
              onSuccess={(msg) => setBanner({ type: 'success', message: msg })}
              onError={(msg) => setBanner({ type: 'error', message: msg })}
              submitForApproval={submitForApproval}
              onRefreshAccounts={() => void refresh()}
            />
          ) : null}
        </div>
      ) : null}
      </fieldset>
    </div>
  )
}

type Opt = { id: string; label: string }

type TransferStep = 'enter' | 'review' | 'processing' | 'success'

function transferDelayMs(): number {
  return 1_600 + Math.floor(Math.random() * 1_400)
}

function BetweenAccountsForm({
  accountOptions,
  accounts,
  pinRequired,
  transactionPin,
  submitForApproval,
  onError,
  onTransferComplete,
}: {
  accountOptions: Opt[]
  accounts: { id: string; name: string; mask: string }[]
  pinRequired: boolean
  transactionPin: string
  submitForApproval: ReturnType<typeof useApprovals>['submitForApproval']
  onError: (msg: string) => void
  onTransferComplete?: () => void
}) {
  const bankCfg = useBankConfig()
  const [step, setStep] = useState<TransferStep>('enter')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [enterError, setEnterError] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [pendingCents, setPendingCents] = useState<number | null>(null)
  const [pendingFromId, setPendingFromId] = useState('')
  const [pendingToId, setPendingToId] = useState('')
  const [pendingMemo, setPendingMemo] = useState('')
  const [receiptRef, setReceiptRef] = useState('')
  const [receiptWhen, setReceiptWhen] = useState('')
  const [postedImmediately, setPostedImmediately] = useState(false)

  const cancelledRef = useRef(false)
  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const resolvedFrom =
    fromId && accountOptions.some((o) => o.id === fromId)
      ? fromId
      : (accountOptions[0]?.id ?? '')
  const resolvedTo =
    toId &&
    accountOptions.some((o) => o.id === toId) &&
    toId !== resolvedFrom
      ? toId
      : (accountOptions.find((o) => o.id !== resolvedFrom)?.id ?? '')

  const fromAccount = accounts.find((a) => a.id === pendingFromId)
  const toAccount = accounts.find((a) => a.id === pendingToId)

  function resetFlow() {
    setStep('enter')
    setAmount('')
    setMemo('')
    setEnterError(null)
    setReviewError(null)
    setPendingCents(null)
    setPendingFromId('')
    setPendingToId('')
    setPendingMemo('')
    setReceiptRef('')
    setReceiptWhen('')
    setPostedImmediately(false)
  }

  function handleEnterSubmit(e: FormEvent) {
    e.preventDefault()
    setEnterError(null)
    const cents = parseDollarsToCents(amount)
    if (cents === null) {
      setEnterError(
        'Enter a valid dollar amount (e.g. 50, $50, or 50.00).',
      )
      return
    }
    if (!resolvedFrom || !resolvedTo) {
      setEnterError('Select both accounts.')
      return
    }
    if (resolvedFrom === resolvedTo) {
      setEnterError('Choose two different accounts.')
      return
    }
    setPendingCents(cents)
    setPendingFromId(resolvedFrom)
    setPendingToId(resolvedTo)
    setPendingMemo(memo.trim())
    setStep('review')
  }

  async function handleConfirmTransfer() {
    if (pendingCents === null || !pendingFromId || !pendingToId) return
    const pinErr = transactionPinMessage(pinRequired, transactionPin)
    if (pinErr) {
      setReviewError(pinErr)
      onError(pinErr)
      return
    }
    setReviewError(null)
    setStep('processing')
    const delay = transferDelayMs()
    await new Promise((r) => setTimeout(r, delay))
    if (cancelledRef.current) return

    const fromAccountNow = accounts.find((a) => a.id === pendingFromId)
    const toAccountNow = accounts.find((a) => a.id === pendingToId)
    const res = await submitForApproval({
      type: 'internal_transfer',
      title: `Transfer ${formatCurrency(pendingCents)} · ${fromAccountNow?.name ?? pendingFromId} → ${toAccountNow?.name ?? pendingToId}`,
      payload: {
        fromId: pendingFromId,
        toId: pendingToId,
        amountCents: pendingCents,
        ...(pendingMemo.trim() ? { memo: pendingMemo.trim() } : {}),
      },
      ...approvalPinFields(pinRequired, transactionPin),
    })

    if (cancelledRef.current) return

    if (!res.ok) {
      setStep('review')
      setReviewError(res.error)
      onError(res.error)
      return
    }

    const immediate = Boolean(res.bankingAutoApplied)
    setPostedImmediately(immediate)
    if (immediate) onTransferComplete?.()

    setReceiptRef(res.item.id)
    setReceiptWhen(
      new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date()),
    )
    setStep('success')
    setAmount('')
    setMemo('')
  }

  const stepOrder: TransferStep[] = [
    'enter',
    'review',
    'processing',
    'success',
  ]
  const stepIndex = stepOrder.indexOf(step)
  const crumbClass = (i: number) => {
    if (i < stepIndex)
      return 'font-medium text-bw-blue-700'
    if (i === stepIndex)
      return 'font-semibold text-bw-navy-900'
    return 'text-bw-muted'
  }

  return (
    <section className="rounded-xl border border-bw-sand-200 bg-white shadow-sm sm:p-8">
      <div className="border-b border-bw-sand-200 bg-bw-sand-100/50 px-6 py-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
          <span className={crumbClass(0)}>1. Details</span>
          <span className="text-bw-sand-200" aria-hidden>
            /
          </span>
          <span className={crumbClass(1)}>2. Review</span>
          <span className="text-bw-sand-200" aria-hidden>
            /
          </span>
          <span className={crumbClass(2)}>3. Processing</span>
          <span className="text-bw-sand-200" aria-hidden>
            /
          </span>
          <span className={crumbClass(3)}>4. Confirmation</span>
        </div>
        <h2 className="mt-3 font-display text-xl font-semibold text-bw-navy-900">
          Transfer between accounts
        </h2>
        <p className="mt-1 text-sm text-bw-muted">
          Move funds between your {bankCfg.bankNameShort} deposit accounts. Same
          flow you would see after signing in at a major bank.
        </p>
      </div>

      <div className="p-6 sm:p-8">
        {step === 'enter' && (
          <>
            {enterError && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-bw-red-600/30 bg-red-50 px-4 py-3 text-sm text-bw-red-800"
              >
                {enterError}
              </div>
            )}
            <form
              className="grid gap-5 sm:max-w-lg"
              onSubmit={handleEnterSubmit}
            >
              <div>
                <label
                  className="text-sm font-medium text-bw-navy-900"
                  htmlFor="xf-from"
                >
                  From
                </label>
                <select
                  id="xf-from"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={resolvedFrom}
                  onChange={(e) => setFromId(e.target.value)}
                >
                  {accountOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-sm font-medium text-bw-navy-900"
                  htmlFor="xf-to"
                >
                  To
                </label>
                <select
                  id="xf-to"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={resolvedTo}
                  onChange={(e) => setToId(e.target.value)}
                >
                  {accountOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-sm font-medium text-bw-navy-900"
                  htmlFor="xf-amt"
                >
                  Amount
                </label>
                <input
                  id="xf-amt"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label
                  className="text-sm font-medium text-bw-navy-900"
                  htmlFor="xf-memo"
                >
                  Memo{' '}
                  <span className="font-normal text-bw-muted">(optional)</span>
                </label>
                <input
                  id="xf-memo"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="e.g. Emergency fund"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-bw-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-bw-red-600"
              >
                Continue to review
              </button>
            </form>
          </>
        )}

        {step === 'review' &&
          pendingCents !== null &&
          fromAccount &&
          toAccount && (
            <div className="mx-auto max-w-lg">
              {reviewError && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-bw-red-600/30 bg-red-50 px-4 py-3 text-sm text-bw-red-800"
                >
                  {reviewError}
                </div>
              )}
              <p className="text-sm font-medium text-bw-navy-900">
                Please confirm this transfer
              </p>
              <dl className="mt-4 space-y-3 rounded-lg border border-bw-sand-200 bg-bw-sand-100/40 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-bw-muted">From</dt>
                  <dd className="text-right font-medium text-bw-navy-900">
                    {fromAccount.name} ···{fromAccount.mask}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-bw-muted">To</dt>
                  <dd className="text-right font-medium text-bw-navy-900">
                    {toAccount.name} ···{toAccount.mask}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-bw-sand-200 pt-3">
                  <dt className="text-bw-muted">Amount</dt>
                  <dd className="text-right font-display text-lg font-semibold tabular-nums text-bw-navy-900">
                    {formatCurrency(pendingCents)}
                  </dd>
                </div>
                {pendingMemo ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-bw-muted">Memo</dt>
                    <dd className="text-right font-medium text-bw-navy-900">
                      {pendingMemo}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-bw-muted">
                By selecting Confirm, you authorize {bankCfg.bankName} to move
                this amount between your deposit accounts. The transfer posts
                immediately; balances and activity update as soon as it completes.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-md bg-bw-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-bw-red-600"
                  onClick={() => void handleConfirmTransfer()}
                >
                  Confirm transfer
                </button>
                <button
                  type="button"
                  className="rounded-md border border-bw-sand-200 px-4 py-3 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
                  onClick={() => {
                    setStep('enter')
                    setReviewError(null)
                  }}
                >
                  Back to edit
                </button>
              </div>
            </div>
          )}

        {step === 'processing' && (
          <div
            className="mx-auto flex max-w-md flex-col items-center py-10 text-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="h-12 w-12 animate-spin rounded-full border-2 border-bw-sand-200 border-t-bw-navy-900"
              aria-hidden
            />
            <p className="mt-6 font-display text-lg font-semibold text-bw-navy-900">
              Posting your transfer
            </p>
            <p className="mt-2 text-sm text-bw-muted">
              Almost done—please keep this page open for a moment.
            </p>
          </div>
        )}

        {step === 'success' &&
          pendingCents !== null &&
          fromAccount &&
          toAccount && (
            <div className="mx-auto max-w-lg text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bw-sky-100 text-bw-blue-600"
                aria-hidden
              >
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="mt-6 font-display text-2xl font-semibold text-bw-navy-900">
                {postedImmediately ? 'Transfer complete' : 'Request submitted'}
              </p>
              <p className="mt-2 text-sm text-bw-muted">
                {postedImmediately ? (
                  <>
                    {formatCurrency(pendingCents)} from {fromAccount.name} to{' '}
                    {toAccount.name} has been posted. Balances and activity in
                    Accounts already reflect this transfer.
                  </>
                ) : (
                  <>
                    {formatCurrency(pendingCents)} from {fromAccount.name} to{' '}
                    {toAccount.name} is pending operator approval. Balances and
                    activity update after the transfer is approved (or stay
                    unchanged if it is rejected).
                  </>
                )}
              </p>
              <div className="mt-8 rounded-lg border border-bw-sand-200 bg-bw-sand-100/50 px-4 py-4 text-left text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
                  Request reference
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-bw-navy-900">
                  {receiptRef}
                </p>
                <p className="mt-3 text-xs text-bw-muted">
                  Completed {receiptWhen}
                </p>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className="rounded-md bg-bw-navy-900 px-4 py-3 text-sm font-semibold text-white hover:bg-bw-navy-800"
                  onClick={resetFlow}
                >
                  Make another transfer
                </button>
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center rounded-md border border-bw-sand-200 px-4 py-3 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
                >
                  View accounts
                </Link>
              </div>
            </div>
          )}
      </div>
    </section>
  )
}

function localCalendarISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDeliverByLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function BillPayForm({
  accountOptions,
  accounts,
  scheduledBillPayments,
  applyBankingSnapshot,
  pinRequired,
  transactionPin,
  submitForApproval,
  onSuccess,
  onError,
}: {
  accountOptions: Opt[]
  accounts: { id: string; name: string; mask: string }[]
  scheduledBillPayments: ScheduledBillPayment[]
  applyBankingSnapshot: ReturnType<
    typeof useAccounts
  >['applyBankingSnapshot']
  pinRequired: boolean
  transactionPin: string
  submitForApproval: ReturnType<typeof useApprovals>['submitForApproval']
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [payees, setPayees] = useState<string[]>(() => [...PAYEE_PRESETS])
  const [fromId, setFromId] = useState(() => accounts[0]?.id ?? '')
  const [payee, setPayee] = useState(payees[0] ?? '')
  const [amount, setAmount] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newPayee, setNewPayee] = useState('')
  const [payMode, setPayMode] = useState<'now' | 'schedule'>('now')
  const [scheduleDate, setScheduleDate] = useState(() => {
    const t = new Date()
    t.setDate(t.getDate() + 3)
    return localCalendarISO(t)
  })
  type CancelModalPhase = 'confirm' | 'cancelling' | 'done'
  const [cancelModal, setCancelModal] = useState<ScheduledBillPayment | null>(
    null,
  )
  const [cancelModalPhase, setCancelModalPhase] =
    useState<CancelModalPhase>('confirm')

  const sortedScheduled = useMemo(
    () =>
      [...scheduledBillPayments].sort((a, b) =>
        a.deliverBy.localeCompare(b.deliverBy),
      ),
    [scheduledBillPayments],
  )

  useEffect(() => {
    if (!cancelModal || cancelModalPhase !== 'confirm') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCancelModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancelModal, cancelModalPhase])

  function accountLabel(id: string): string {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.name} ···${a.mask}` : id
  }

  function saveNewPayee() {
    const name = newPayee.trim()
    if (!name) return
    setPayees((p) => [...p, name])
    setPayee(name)
    setNewPayee('')
    setShowAdd(false)
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault()
    const cents = parseDollarsToCents(amount)
    if (cents === null) {
      onError('Enter a valid dollar amount.')
      return
    }
    if (!payee.trim()) {
      onError('Choose or add a payee.')
      return
    }
    const name = payee.trim()

    const pinErr = transactionPinMessage(pinRequired, transactionPin)
    if (pinErr) {
      onError(pinErr)
      return
    }

    if (payMode === 'schedule') {
      const res = await submitForApproval({
        type: 'scheduled_bill',
        title: `Schedule ${formatCurrency(cents)} to ${name} (deliver by ${scheduleDate})`,
        payload: {
          fromId,
          payeeName: name,
          amountCents: cents,
          deliverBy: scheduleDate,
        },
        ...approvalPinFields(pinRequired, transactionPin),
      })
      if (!res.ok) {
        onError(res.error)
        return
      }
      onSuccess(
        `Scheduled payment request submitted (${formatCurrency(cents)} to ${name}, ${formatDeliverByLabel(scheduleDate)}). Reference ${res.item.id}.`,
      )
      setAmount('')
      return
    }

    const res = await submitForApproval({
      type: 'bill_pay',
      title: `Bill pay ${formatCurrency(cents)} to ${name}`,
      payload: {
        fromId,
        payeeName: name,
        amountCents: cents,
      },
      ...approvalPinFields(pinRequired, transactionPin),
    })
    if (!res.ok) {
      onError(res.error)
      return
    }
    onSuccess(
      `Bill payment request submitted (${formatCurrency(cents)} to ${name}). Reference ${res.item.id}.`,
    )
    setAmount('')
  }

  const minDate = localCalendarISO()

  async function confirmCancelScheduled() {
    if (!cancelModal) return
    const snap = cancelModal
    setCancelModalPhase('cancelling')
    try {
      const banking = await cancelScheduledBillPayment(snap.id)
      applyBankingSnapshot(banking)
      onSuccess(`Cancelled scheduled payment to ${snap.payeeName}.`)
      setCancelModalPhase('done')
      await new Promise((r) => setTimeout(r, 900))
      setCancelModal(null)
    } catch (e) {
      setCancelModalPhase('confirm')
      onError(
        e instanceof Error ? e.message : 'Could not cancel scheduled payment.',
      )
    }
  }

  function dismissCancelModal() {
    if (cancelModalPhase !== 'confirm') return
    setCancelModal(null)
  }

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-xl font-semibold text-bw-navy-900">
            Pay a bill
          </h2>
          <p className="mt-1 text-sm text-bw-muted">
            Pay now or schedule a payment for a future date. Scheduled payments
            remain pending until the send date; you can cancel them anytime
            before processing.
          </p>
          <form
            className="mt-6 grid gap-5 sm:max-w-lg"
            onSubmit={(e) => void handlePay(e)}
          >
            <fieldset>
              <legend className="text-sm font-medium text-bw-navy-900">
                When to pay
              </legend>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="bp-mode"
                    checked={payMode === 'now'}
                    onChange={() => setPayMode('now')}
                    className="border-bw-sand-200 text-bw-red-700 focus:ring-bw-blue-500"
                  />
                  Pay now
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="bp-mode"
                    checked={payMode === 'schedule'}
                    onChange={() => setPayMode('schedule')}
                    className="border-bw-sand-200 text-bw-red-700 focus:ring-bw-blue-500"
                  />
                  Schedule for later
                </label>
              </div>
            </fieldset>
            {payMode === 'schedule' && (
              <div>
                <label
                  className="text-sm font-medium text-bw-navy-900"
                  htmlFor="bp-deliver"
                >
                  Deliver by
                </label>
                <input
                  id="bp-deliver"
                  type="date"
                  min={minDate}
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
                <p className="mt-1 text-xs text-bw-muted">
                  We aim to send this payment on or before this date, subject to
                  cutoff times and payee delivery windows.
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-bw-navy-900" htmlFor="bp-from">
                Pay from
              </label>
              <select
                id="bp-from"
                className="mt-1 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
              >
                {accountOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-bw-navy-900" htmlFor="bp-payee">
                  Payee
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold text-bw-blue-600 hover:underline"
                  onClick={() => setShowAdd((s) => !s)}
                >
                  {showAdd ? 'Close' : 'Add payee'}
                </button>
              </div>
              {showAdd && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className="min-w-[12rem] flex-1 rounded-md border border-bw-sand-200 px-3 py-2 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                    placeholder="Payee name"
                    value={newPayee}
                    onChange={(e) => setNewPayee(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveNewPayee()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-md bg-bw-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-bw-navy-800"
                    onClick={saveNewPayee}
                  >
                    Save
                  </button>
                </div>
              )}
              <select
                id="bp-payee"
                className="mt-2 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
              >
                {payees.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-bw-navy-900" htmlFor="bp-amt">
                Amount
              </label>
              <input
                id="bp-amt"
                inputMode="decimal"
                placeholder="0.00"
                className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-bw-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-bw-red-600"
            >
              {payMode === 'schedule' ? 'Schedule payment' : 'Pay bill now'}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-xl font-semibold text-bw-navy-900">
            Upcoming scheduled payments
          </h2>
          <p className="mt-1 text-sm text-bw-muted">
            Cancel a payment here if your plans change. Funds are not debited
            until each payment is sent.
          </p>
          {sortedScheduled.length === 0 ? (
            <p className="mt-4 text-sm text-bw-muted">
              You have no scheduled payments.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-bw-sand-200">
              {sortedScheduled.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-bw-navy-900">{s.payeeName}</p>
                    <p className="mt-0.5 text-sm text-bw-muted">
                      {formatCurrency(s.amountCents)} from {accountLabel(s.fromId)}
                    </p>
                    <p className="mt-0.5 text-xs text-bw-muted">
                      Deliver by {formatDeliverByLabel(s.deliverBy)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-bw-sand-200 px-3 py-2 text-sm font-semibold text-bw-navy-900 hover:bg-red-50 hover:text-bw-red-800 hover:border-bw-red-600/30"
                    onClick={() => {
                      setCancelModalPhase('confirm')
                      setCancelModal(s)
                    }}
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <aside className="rounded-xl border border-bw-sand-200 bg-bw-sand-100/80 p-6 lg:h-fit">
        <h3 className="text-sm font-semibold text-bw-navy-900">Bill pay tips</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-bw-muted">
          <li>Allow two business days for electronic payments to post.</li>
          <li>Verify the payee name matches your statement.</li>
          <li>Cancel scheduled payments if the amount or date no longer works.</li>
        </ul>
      </aside>
    </div>

    {cancelModal && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="presentation"
      >
        {cancelModalPhase === 'confirm' ? (
          <button
            type="button"
            className="absolute inset-0 bg-bw-navy-950/55 backdrop-blur-[1px]"
            aria-label="Dismiss"
            onClick={dismissCancelModal}
          />
        ) : (
          <div
            className="absolute inset-0 bg-bw-navy-950/55 backdrop-blur-[1px]"
            aria-hidden
          />
        )}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-scheduled-title"
          aria-busy={cancelModalPhase === 'cancelling'}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-bw-sand-200 bg-white p-6 shadow-2xl"
        >
          {cancelModalPhase === 'confirm' && (
            <>
              <h2
                id="cancel-scheduled-title"
                className="font-display text-xl font-semibold text-bw-navy-900"
              >
                Cancel this payment?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-bw-muted">
                Are you sure you want to cancel this scheduled payment? It will
                be removed from your upcoming list.
              </p>
              <div className="mt-4 rounded-lg border border-bw-sand-200 bg-bw-sand-100/50 px-4 py-3 text-sm">
                <p className="font-medium text-bw-navy-900">
                  {cancelModal.payeeName}
                </p>
                <p className="mt-1 text-bw-muted">
                  {formatCurrency(cancelModal.amountCents)} from{' '}
                  {accountLabel(cancelModal.fromId)}
                </p>
                <p className="mt-1 text-xs text-bw-muted">
                  Deliver by {formatDeliverByLabel(cancelModal.deliverBy)}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-bw-sand-200 px-4 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
                  onClick={dismissCancelModal}
                >
                  No, keep payment
                </button>
                <button
                  type="button"
                  className="rounded-md bg-bw-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-red-600"
                  onClick={() => void confirmCancelScheduled()}
                >
                  Yes, cancel payment
                </button>
              </div>
            </>
          )}

          {cancelModalPhase === 'cancelling' && (
            <div
              className="flex flex-col items-center py-8 text-center"
              role="status"
              aria-live="polite"
            >
              <div
                className="h-12 w-12 animate-spin rounded-full border-2 border-bw-sand-200 border-t-bw-navy-900"
                aria-hidden
              />
              <p
                id="cancel-scheduled-title"
                className="mt-6 font-display text-lg font-semibold text-bw-navy-900"
              >
                Cancelling payment…
              </p>
              <p className="mt-2 max-w-xs text-sm text-bw-muted">
                Sending your request to our bill pay service. This usually takes
                just a moment.
              </p>
              <div className="mt-6 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-bw-sand-200">
                <div
                  className="h-full w-full bg-gradient-to-r from-transparent via-bw-navy-800/40 to-transparent"
                  style={{
                    animation: 'bw-cancel-shimmer 1.1s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          )}

          {cancelModalPhase === 'done' && (
            <div className="flex flex-col items-center py-6 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full bg-bw-sky-100 text-bw-blue-600"
                style={{
                  animation: 'bw-cancel-pop 0.5s ease-out forwards',
                }}
                aria-hidden
              >
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2
                id="cancel-scheduled-title"
                className="mt-5 font-display text-xl font-semibold text-bw-navy-900"
              >
                Payment cancelled
              </h2>
              <p className="mt-2 text-sm text-bw-muted">
                {cancelModal.payeeName} has been removed from your scheduled
                payments.
              </p>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  )
}

function SendMoneyForm({
  accountOptions,
  accounts,
  pinRequired,
  transactionPin,
  submitForApproval,
  onSuccess,
  onError,
}: {
  accountOptions: Opt[]
  accounts: { id: string }[]
  pinRequired: boolean
  transactionPin: string
  submitForApproval: ReturnType<typeof useApprovals>['submitForApproval']
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [fromId, setFromId] = useState(() => accounts[0]?.id ?? '')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const f = first.trim()
    const l = last.trim()
    if (!f || !l) {
      onError('Enter the recipient’s first and last name.')
      return
    }
    const cents = parseDollarsToCents(amount)
    if (cents === null) {
      onError('Enter a valid dollar amount.')
      return
    }
    const label = `${f} ${l}${email.trim() ? ` (${email.trim()})` : ''}`
    const recipientLabel = note.trim() ? `${label} — ${note.trim()}` : label

    const pinErr = transactionPinMessage(pinRequired, transactionPin)
    if (pinErr) {
      onError(pinErr)
      return
    }

    const res = await submitForApproval({
      type: 'send_to_person',
      title: `Send ${formatCurrency(cents)} to ${f} ${l}`,
      payload: {
        fromId,
        recipientLabel,
        amountCents: cents,
      },
      ...approvalPinFields(pinRequired, transactionPin),
    })
    if (!res.ok) {
      onError(res.error)
      return
    }
    onSuccess(
      `Send request submitted (${formatCurrency(cents)} to ${f} ${l}). Reference ${res.item.id}.`,
    )
    setAmount('')
    setNote('')
  }

  return (
    <section className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-xl font-semibold text-bw-navy-900">
        Send to someone
      </h2>
      <p className="mt-1 text-sm text-bw-muted">
        Send money from your account to friends or family. Outbound transfers
        are reviewed before funds leave your account.
      </p>
      <form
        className="mt-6 grid gap-5 sm:max-w-lg"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <div>
          <label className="text-sm font-medium text-bw-navy-900" htmlFor="sm-from">
            From
          </label>
          <select
            id="sm-from"
            className="mt-1 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          >
            {accountOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-bw-navy-900" htmlFor="sm-first">
              First name
            </label>
            <input
              id="sm-first"
              autoComplete="given-name"
              className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-bw-navy-900" htmlFor="sm-last">
              Last name
            </label>
            <input
              id="sm-last"
              autoComplete="family-name"
              className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              value={last}
              onChange={(e) => setLast(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-bw-navy-900" htmlFor="sm-email">
            Email or mobile <span className="font-normal text-bw-muted">(optional)</span>
          </label>
          <input
            id="sm-email"
            type="text"
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="For your records"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-bw-navy-900" htmlFor="sm-amt">
            Amount
          </label>
          <input
            id="sm-amt"
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-bw-navy-900" htmlFor="sm-note">
            Note <span className="font-normal text-bw-muted">(optional)</span>
          </label>
          <input
            id="sm-note"
            className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-bw-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-bw-red-600"
        >
          Send money
        </button>
      </form>
    </section>
  )
}

type WireStep = 'form' | 'sending_otp' | 'otp' | 'processing' | 'success'

function WireTransferForm({
  accountOptions,
  pinRequired,
  transactionPin,
  submitForApproval,
  onSuccess,
  onError,
}: {
  accountOptions: Opt[]
  pinRequired: boolean
  transactionPin: string
  submitForApproval: ReturnType<typeof useApprovals>['submitForApproval']
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const bankCfg = useBankConfig()
  const [wireScope, setWireScope] = useState<'domestic' | 'international'>(
    'domestic',
  )
  const [fromId, setFromId] = useState(() => accountOptions[0]?.id ?? '')
  const [beneficiary, setBeneficiary] = useState('')
  const [bankName, setBankName] = useState('')
  const [routing, setRouting] = useState('')
  const [acctNum, setAcctNum] = useState('')
  const [country, setCountry] = useState('')
  const [swift, setSwift] = useState('')
  const [iban, setIban] = useState('')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<WireStep>('form')
  const [receiptRef, setReceiptRef] = useState('')
  const [submittedScope, setSubmittedScope] = useState<
    'domestic' | 'international'
  >('domestic')
  const [pendingWire, setPendingWire] = useState<PendingWireSubmit | null>(
    null,
  )
  const [wireOtpChallengeId, setWireOtpChallengeId] = useState('')
  const [wireOtpMaskedEmail, setWireOtpMaskedEmail] = useState<string | null>(
    null,
  )
  const [wireOtpCode, setWireOtpCode] = useState('')
  const [wireOtpResendsRemaining, setWireOtpResendsRemaining] = useState(0)
  const [wireOtpResendBusy, setWireOtpResendBusy] = useState(false)

  const fee =
    wireScope === 'international'
      ? bankCfg.fees.wireInternationalCents
      : bankCfg.fees.wireDomesticCents

  async function finalizeWireSubmission(
    pending: PendingWireSubmit,
    otp?: { wireOtpChallengeId: string; wireOtpCode: string },
  ) {
    setSubmittedScope(pending.submittedScope)
    setStep('processing')
    await new Promise((r) =>
      setTimeout(r, pending.submittedScope === 'international' ? 2_000 : 1_700),
    )

    const res = await submitForApproval({
      type: 'wire_transfer',
      title: pending.title,
      payload: pending.payload,
      ...approvalPinFields(pinRequired, transactionPin),
      ...(otp
        ? {
            wireOtpChallengeId: otp.wireOtpChallengeId,
            wireOtpCode: otp.wireOtpCode,
          }
        : {}),
    })

    if (!res.ok) {
      setStep(otp ? 'otp' : 'form')
      onError(res.error)
      return
    }
    setReceiptRef(res.item.id)
    setPendingWire(null)
    setWireOtpChallengeId('')
    setWireOtpMaskedEmail(null)
    setWireOtpCode('')
    setStep('success')
    const label =
      pending.submittedScope === 'international'
        ? 'International wire'
        : 'Domestic wire'
    onSuccess(
      `${label} request of ${formatCurrency(pending.cents)} submitted for approval. Reference ${res.item.id}.`,
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cents = parseDollarsToCents(amount)
    if (cents === null) {
      onError('Enter a valid wire amount.')
      return
    }

    if (wireScope === 'domestic') {
      const routingDigits = routing.replace(/\D/g, '')
      if (!/^\d{9}$/.test(routingDigits)) {
        onError('Enter a valid 9-digit ABA routing number.')
        return
      }
      if (acctNum.trim().length < 4) {
        onError('Enter the beneficiary account number.')
        return
      }
    } else {
      if (!country.trim()) {
        onError('Enter the beneficiary country.')
        return
      }
      const swiftNorm = swift.replace(/\s/g, '').toUpperCase()
      if (!/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swiftNorm)) {
        onError('Enter a valid SWIFT / BIC code (8 or 11 characters).')
        return
      }
      const ibanNorm = iban.replace(/\s/g, '')
      if (ibanNorm.length < 10) {
        onError(
          'Enter the beneficiary IBAN or local account number (at least 10 characters).',
        )
        return
      }
    }

    const pinErr = transactionPinMessage(pinRequired, transactionPin)
    if (pinErr) {
      onError(pinErr)
      return
    }

    const payload =
      wireScope === 'domestic'
        ? {
            fromId,
            amountCents: cents,
            beneficiaryName: beneficiary.trim(),
            receivingBank: bankName.trim(),
            scope: 'domestic' as const,
            routingNumber: routing,
            beneficiaryAccount: acctNum,
          }
        : {
            fromId,
            amountCents: cents,
            beneficiaryName: beneficiary.trim(),
            receivingBank: bankName.trim(),
            scope: 'international' as const,
            country: country.trim(),
            swiftBic: swift,
            ibanOrAccount: iban,
          }

    const pending: PendingWireSubmit = {
      payload,
      title: `${wireScope === 'international' ? 'International' : 'Domestic'} wire ${formatCurrency(cents)} to ${beneficiary.trim()}`,
      cents,
      submittedScope: wireScope,
    }
    setPendingWire(pending)

    setStep('sending_otp')
    const otpStart = await apiStartWireTransferOtp()
    if (!otpStart.ok) {
      setStep('form')
      setPendingWire(null)
      onError(otpStart.error)
      return
    }
    if (otpStart.skipped) {
      await finalizeWireSubmission(pending)
      return
    }
    setWireOtpChallengeId(otpStart.wireOtpChallengeId)
    setWireOtpMaskedEmail(otpStart.maskedEmail)
    setWireOtpResendsRemaining(otpStart.otpResendsRemaining)
    setWireOtpCode('')
    setStep('otp')
  }

  async function handleWireOtpResend() {
    if (!wireOtpChallengeId || wireOtpResendBusy) return
    if (wireOtpResendsRemaining <= 0) {
      onError(
        'Maximum resend attempts reached. Cancel and submit the wire form again for a new code.',
      )
      return
    }
    setWireOtpResendBusy(true)
    setStep('sending_otp')
    const res = await apiResendWireTransferOtp(wireOtpChallengeId)
    if (!res.ok) {
      setStep('otp')
      onError(res.error)
      setWireOtpResendBusy(false)
      return
    }
    setWireOtpChallengeId(res.wireOtpChallengeId)
    setWireOtpMaskedEmail(res.maskedEmail)
    setWireOtpResendsRemaining(res.otpResendsRemaining)
    setWireOtpCode('')
    setWireOtpResendBusy(false)
    setStep('otp')
  }

  async function handleOtpAuthorize() {
    const pending = pendingWire
    if (!pending || !wireOtpChallengeId) {
      onError('Start over and request a new verification code.')
      setStep('form')
      return
    }
    const code = digitsOnly6(wireOtpCode)
    if (code.length !== 6) {
      onError('Enter the 6-digit code from your email.')
      return
    }
    await finalizeWireSubmission(pending, {
      wireOtpChallengeId,
      wireOtpCode: code,
    })
  }

  function resetForm() {
    setStep('form')
    setReceiptRef('')
    setWireScope('domestic')
    setBeneficiary('')
    setBankName('')
    setRouting('')
    setAcctNum('')
    setCountry('')
    setSwift('')
    setIban('')
    setAmount('')
    setPendingWire(null)
    setWireOtpChallengeId('')
    setWireOtpMaskedEmail(null)
    setWireOtpCode('')
    setWireOtpResendsRemaining(0)
  }

  return (
    <section className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-xl font-semibold text-bw-navy-900">
        Wire transfer
      </h2>
      <p className="mt-1 text-sm text-bw-muted">
        Send U.S. domestic wires or international wires in USD. You will receive
        a one-time email code to authorize each wire request.{' '}
        {bankCfg.wireDisclaimerFees} Fees:{' '}
        {formatCurrency(bankCfg.fees.wireDomesticCents)} domestic,{' '}
        {formatCurrency(bankCfg.fees.wireInternationalCents)} international.
      </p>

      {step === 'form' && (
        <form className="mt-6 grid gap-5 sm:max-w-lg" onSubmit={(e) => void handleSubmit(e)}>
          <fieldset>
            <legend className="text-sm font-medium text-bw-navy-900">
              Wire destination
            </legend>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="wt-scope"
                  checked={wireScope === 'domestic'}
                  onChange={() => setWireScope('domestic')}
                  className="border-bw-sand-200 text-bw-red-700 focus:ring-bw-blue-500"
                />
                Domestic (U.S.)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="wt-scope"
                  checked={wireScope === 'international'}
                  onChange={() => setWireScope('international')}
                  className="border-bw-sand-200 text-bw-red-700 focus:ring-bw-blue-500"
                />
                International
              </label>
            </div>
          </fieldset>

          <div>
            <label className="text-sm font-medium text-bw-navy-900" htmlFor="wt-from">
              Send from
            </label>
            <select
              id="wt-from"
              className="mt-1 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              {accountOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-bw-navy-900" htmlFor="wt-ben">
              Beneficiary name
            </label>
            <input
              id="wt-ben"
              className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-bw-navy-900" htmlFor="wt-bank">
              {wireScope === 'domestic'
                ? 'Receiving bank name'
                : 'Beneficiary bank name'}
            </label>
            <input
              id="wt-bank"
              className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>

          {wireScope === 'domestic' ? (
            <>
              <div>
                <label className="text-sm font-medium text-bw-navy-900" htmlFor="wt-rt">
                  Routing (ABA) number
                </label>
                <input
                  id="wt-rt"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="9 digits"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={routing}
                  onChange={(e) => setRouting(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-bw-navy-900" htmlFor="wt-acct">
                  Beneficiary account number
                </label>
                <input
                  id="wt-acct"
                  inputMode="numeric"
                  autoComplete="off"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={acctNum}
                  onChange={(e) => setAcctNum(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-bw-navy-900" htmlFor="wt-country">
                  Beneficiary country
                </label>
                <input
                  id="wt-country"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. United Kingdom"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-bw-navy-900" htmlFor="wt-swift">
                  SWIFT / BIC
                </label>
                <input
                  id="wt-swift"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm font-mono uppercase outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={swift}
                  onChange={(e) => setSwift(e.target.value.toUpperCase())}
                  placeholder="8 or 11 characters"
                  maxLength={11}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-bw-navy-900" htmlFor="wt-iban">
                  IBAN or beneficiary account number
                </label>
                <input
                  id="wt-iban"
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm font-mono outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="Spaces optional"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-bw-muted">
                  Amount is sent in USD; the receiving bank may convert to local
                  currency at its rate. Additional correspondent or beneficiary
                  fees may apply.
                </p>
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-medium text-bw-navy-900" htmlFor="wt-amt">
              Wire amount (USD)
            </label>
            <input
              id="wt-amt"
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-bw-muted">
              Total debit: wire amount + {formatCurrency(fee)} wire fee.
            </p>
          </div>
          <button
            type="submit"
            className="rounded-md bg-bw-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-bw-red-600"
          >
            Submit wire request
          </button>
        </form>
      )}

      {step === 'sending_otp' && (
        <div
          className="mt-10 flex flex-col items-center py-8 text-center"
          role="status"
          aria-live="polite"
        >
          <div
            className="h-12 w-12 animate-spin rounded-full border-2 border-bw-sand-200 border-t-bw-navy-900"
            aria-hidden
          />
          <p className="mt-6 font-display text-lg font-semibold text-bw-navy-900">
            {wireOtpResendBusy
              ? 'Resending verification code…'
              : 'Sending verification code…'}
          </p>
          <p className="mt-2 max-w-sm text-sm text-bw-muted">
            {wireOtpResendBusy
              ? 'Sending a fresh verification code to your email…'
              : 'We email a one-time code to authorize this wire transfer.'}
          </p>
        </div>
      )}

      {step === 'otp' && pendingWire && (
        <div className="mt-8 grid max-w-lg gap-5">
          <div>
            <p className="font-display text-lg font-semibold text-bw-navy-900">
              Verify your identity
            </p>
            <p className="mt-2 text-sm text-bw-muted">
              Enter the 6-digit code we sent to{' '}
              <span className="font-semibold text-bw-navy-900">
                {wireOtpMaskedEmail ?? 'your registered email'}
              </span>{' '}
              to authorize this{' '}
              <span className="font-semibold text-bw-navy-900">
                {formatCurrency(pendingWire.cents)}
              </span>{' '}
              wire transfer.
            </p>
          </div>
          <div>
            <label
              className="text-sm font-medium text-bw-navy-900"
              htmlFor="wire-otp-code"
            >
              Verification code
            </label>
            <input
              id="wire-otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 font-mono text-lg tracking-[0.35em] outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              placeholder="000000"
              maxLength={6}
              value={wireOtpCode}
              onChange={(e) => setWireOtpCode(digitsOnly6(e.target.value))}
            />
            <p className="mt-2 text-xs text-bw-muted">
              {wireOtpResendsRemaining > 0 ? (
                <>
                  Didn&apos;t get the email or code expired? Resends left:{' '}
                  <span className="font-semibold text-bw-navy-900">
                    {wireOtpResendsRemaining}
                  </span>{' '}
                  (max 3).
                </>
              ) : (
                <>
                  No resends left — cancel and submit the wire form again for a
                  new code.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                wireOtpResendBusy ||
                wireOtpResendsRemaining <= 0 ||
                !wireOtpChallengeId
              }
              className="rounded-md border border-bw-sand-200 bg-white px-4 py-3 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleWireOtpResend()}
            >
              {wireOtpResendBusy
                ? 'Sending…'
                : wireOtpResendsRemaining <= 0
                  ? 'No resends left'
                  : `Resend code (${wireOtpResendsRemaining} left)`}
            </button>
            <button
              type="button"
              className="rounded-md bg-bw-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-bw-red-600"
              onClick={() => void handleOtpAuthorize()}
            >
              Authorize and submit wire
            </button>
            <button
              type="button"
              className="rounded-md border border-bw-sand-200 bg-white px-4 py-3 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
              onClick={() => {
                resetForm()
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div
          className="mt-10 flex flex-col items-center py-8 text-center"
          role="status"
          aria-live="polite"
        >
          <div
            className="h-12 w-12 animate-spin rounded-full border-2 border-bw-sand-200 border-t-bw-navy-900"
            aria-hidden
          />
          <p className="mt-6 font-display text-lg font-semibold text-bw-navy-900">
            Submitting wire instructions…
          </p>
          <p className="mt-2 max-w-sm text-sm text-bw-muted">
            {submittedScope === 'international'
              ? 'Verifying SWIFT, sanctions screening, and compliance. Please wait.'
              : 'Verifying routing and compliance. Please wait.'}
          </p>
        </div>
      )}

      {step === 'success' && (
        <div className="mt-8 text-center sm:mx-auto sm:max-w-lg">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bw-sky-100 text-bw-blue-600"
            aria-hidden
          >
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="mt-4 font-display text-xl font-semibold text-bw-navy-900">
            Wire request queued
          </p>
          <p className="mt-2 text-sm text-bw-muted">
            Pending operator approval. Reference{' '}
            <span className="font-mono font-semibold text-bw-navy-900">
              {receiptRef}
            </span>
          </p>
          <button
            type="button"
            className="mt-6 rounded-md bg-bw-navy-900 px-4 py-3 text-sm font-semibold text-white hover:bg-bw-navy-800"
            onClick={resetForm}
          >
            Send another wire
          </button>
        </div>
      )}
    </section>
  )
}

function DepositRailTabs({
  depositRail,
  depositsCfg,
  onSelectRail,
}: {
  depositRail: DepositRailId
  depositsCfg: BankDepositsAndFees | undefined
  onSelectRail: (rail: DepositRailId) => void
}) {
  const m = depositsCfg?.depositMethods
  const items: { id: DepositRailId; label: string }[] = []
  if (m?.bankTransfer !== false) {
    items.push({ id: 'mobile', label: 'Mobile check' })
  }
  if (m?.cardFunding === true) {
    items.push({ id: 'card', label: 'Card funding' })
  }
  if (m?.crypto === true) {
    items.push({ id: 'crypto', label: 'Crypto on-ramp' })
  }
  if (items.length <= 1) return null
  return (
    <div
      className="flex flex-wrap gap-1 rounded-lg border border-bw-sand-200 bg-white p-1 shadow-sm"
      role="tablist"
      aria-label="Deposit method"
    >
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={depositRail === id}
          onClick={() => onSelectRail(id)}
          className={[
            'rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:px-4',
            depositRail === id
              ? 'bg-bw-navy-900 text-white shadow-sm'
              : 'text-bw-muted hover:bg-bw-sand-100 hover:text-bw-navy-900',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

type RailsDepositMode = 'card' | 'crypto'

function railsIncomingCopy(mode: RailsDepositMode): {
  approvalType: ApprovalType
  feeRail: DepositRailId
  heading: string
  description: string
  amountLabel: string
  submitLabel: string
  processingLine: string
  feeSuccessNoun: string
} {
  if (mode === 'card') {
    return {
      approvalType: 'card_funding_deposit',
      feeRail: 'card',
      heading: 'Card funding deposit',
      description:
        'Request a simulated push-to-card or external card load into your deposit account. A specialist may contact you to confirm source-of-funds details before the credit posts.',
      amountLabel: 'Amount to credit',
      submitLabel: 'Submit funding request',
      processingLine: 'Submitting your funding request…',
      feeSuccessNoun: 'card funding fee',
    }
  }
  return {
    approvalType: 'crypto_deposit',
    feeRail: 'crypto',
    heading: 'Crypto on-ramp',
    description:
      'Request a simulated fiat on-ramp credit (USD) to your deposit account. This demo does not move cryptocurrency; it only queues an operator-reviewed ledger credit.',
    amountLabel: 'USD amount to credit',
    submitLabel: 'Submit on-ramp request',
    processingLine: 'Submitting your on-ramp request…',
    feeSuccessNoun: 'crypto on-ramp fee',
  }
}

type RailsDepositStep = 'form' | 'processing' | 'success'

function RailsIncomingDepositForm({
  mode,
  accountOptions,
  accounts,
  pinRequired,
  transactionPin,
  submitForApproval,
  onSuccess,
  onError,
  onRefreshAccounts,
}: {
  mode: RailsDepositMode
  accountOptions: Opt[]
  accounts: { id: string; name: string; mask: string }[]
  pinRequired: boolean
  transactionPin: string
  submitForApproval: ReturnType<typeof useApprovals>['submitForApproval']
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
  onRefreshAccounts?: () => void
}) {
  const bankCfg = useBankConfig()
  const copy = railsIncomingCopy(mode)
  const [toId, setToId] = useState(() => accounts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<RailsDepositStep>('form')
  const [receiptRef, setReceiptRef] = useState('')
  const [creditedCents, setCreditedCents] = useState<number | null>(null)
  const [wasAutoApplied, setWasAutoApplied] = useState(false)
  const [feeTakenCents, setFeeTakenCents] = useState(0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cents = parseDollarsToCents(amount)
    if (cents === null) {
      onError(`Enter ${copy.amountLabel.toLowerCase()} as a dollar amount.`)
      return
    }
    const pinErr = transactionPinMessage(pinRequired, transactionPin)
    if (pinErr) {
      onError(pinErr)
      return
    }
    setStep('processing')
    await new Promise((r) => setTimeout(r, 1_600))
    const acc = accounts.find((a) => a.id === toId)
    const res = await submitForApproval({
      type: copy.approvalType,
      title: `${copy.heading} ${formatCurrency(cents)} to ${acc?.name ?? toId}`,
      payload: { toId, amountCents: cents },
      ...approvalPinFields(pinRequired, transactionPin),
    })
    if (!res.ok) {
      setStep('form')
      onError(res.error)
      return
    }
    const svc = incomingFeeCentsForRail(
      bankCfg.depositsAndFees,
      copy.feeRail,
      cents,
    )
    const net = cents - svc
    setReceiptRef(res.item.id)
    setWasAutoApplied(Boolean(res.depositAutoApplied))
    setFeeTakenCents(svc)
    setCreditedCents(res.depositAutoApplied ? net : cents)
    setStep('success')
    onRefreshAccounts?.()
    const kind = mode === 'card' ? 'Card funding' : 'Crypto on-ramp'
    onSuccess(
      res.depositAutoApplied
        ? `${kind} ${formatCurrency(net)} to ${acc?.name ?? 'account'} was credited immediately (per bank policy). Reference ${res.item.id}.`
        : `${kind} request (${formatCurrency(cents)} to ${acc?.name ?? 'account'}) submitted for approval. Reference ${res.item.id}.`,
    )
  }

  function resetForm() {
    setStep('form')
    setReceiptRef('')
    setCreditedCents(null)
    setWasAutoApplied(false)
    setFeeTakenCents(0)
    setAmount('')
  }

  const creditAccountLabel =
    accounts.find((a) => a.id === toId)?.name ?? 'account'

  return (
    <section className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-xl font-semibold text-bw-navy-900">
        {copy.heading}
      </h2>
      <p className="mt-1 text-sm text-bw-muted">{copy.description}</p>

      {step === 'form' && (
        <form
          className="mt-6 grid max-w-lg gap-5"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <div>
            <label className="text-sm font-medium text-bw-navy-900" htmlFor={`rd-to-${mode}`}>
              Credit to
            </label>
            <select
              id={`rd-to-${mode}`}
              className="mt-1 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              {accountOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-bw-navy-900" htmlFor={`rd-amt-${mode}`}>
              {copy.amountLabel}
            </label>
            <input
              id={`rd-amt-${mode}`}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-bw-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-bw-red-600"
          >
            {copy.submitLabel}
          </button>
        </form>
      )}

      {step === 'processing' && (
        <div
          className="mt-10 flex flex-col items-center py-8 text-center"
          role="status"
          aria-live="polite"
        >
          <div
            className="h-12 w-12 animate-spin rounded-full border-2 border-bw-sand-200 border-t-bw-navy-900"
            aria-hidden
          />
          <p className="mt-6 font-display text-lg font-semibold text-bw-navy-900">
            {copy.processingLine}
          </p>
          <p className="mt-2 max-w-sm text-sm text-bw-muted">
            {bankCfg.depositsAndFees?.manualDepositApprovalRequired === false
              ? 'Finishing request — your account will update in a moment.'
              : 'Funds appear after an operator approves and credits the deposit.'}
          </p>
        </div>
      )}

      {step === 'success' && creditedCents !== null && (
        <div className="mt-8 text-center sm:max-w-lg">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bw-sky-100 text-bw-blue-600"
            aria-hidden
          >
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="mt-4 font-display text-xl font-semibold text-bw-navy-900">
            {wasAutoApplied ? 'Deposit credited' : 'Request submitted'}
          </p>
          <p className="mt-2 text-sm text-bw-muted">
            {wasAutoApplied ? (
              <>
                {formatCurrency(creditedCents)} to {creditAccountLabel} is now
                in your available balance
                {feeTakenCents > 0
                  ? ` (after a ${formatCurrency(feeTakenCents)} ${copy.feeSuccessNoun})`
                  : ''}
                .
              </>
            ) : (
              <>
                {formatCurrency(creditedCents)} to {creditAccountLabel} is
                pending operator approval; your balance updates after approval.
                {feeTakenCents > 0 ? (
                  <>
                    {' '}
                    When credited, the bank may deduct a fee of{' '}
                    {formatCurrency(feeTakenCents)} per your institution&apos;s
                    schedule.
                  </>
                ) : null}
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-bw-muted">
            Reference{' '}
            <span className="font-mono font-semibold text-bw-navy-900">
              {receiptRef}
            </span>
          </p>
          <button
            type="button"
            className="mt-6 rounded-md bg-bw-navy-900 px-4 py-3 text-sm font-semibold text-white hover:bg-bw-navy-800"
            onClick={resetForm}
          >
            Submit another request
          </button>
        </div>
      )}
    </section>
  )
}

type MobileStep = 'form' | 'processing' | 'success'

function MobileDepositForm({
  accountOptions,
  accounts,
  pinRequired,
  transactionPin,
  submitForApproval,
  onSuccess,
  onError,
  onRefreshAccounts,
}: {
  accountOptions: Opt[]
  accounts: { id: string; name: string; mask: string }[]
  pinRequired: boolean
  transactionPin: string
  submitForApproval: ReturnType<typeof useApprovals>['submitForApproval']
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
  onRefreshAccounts?: () => void
}) {
  const bankCfg = useBankConfig()
  const [toId, setToId] = useState(() => accounts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [step, setStep] = useState<MobileStep>('form')
  const [receiptRef, setReceiptRef] = useState('')
  const [creditedCents, setCreditedCents] = useState<number | null>(null)
  const [wasAutoApplied, setWasAutoApplied] = useState(false)
  const [feeTakenCents, setFeeTakenCents] = useState(0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cents = parseDollarsToCents(amount)
    if (cents === null) {
      onError('Enter the amount shown on the check.')
      return
    }
    if (!front || !back) {
      onError('Add photos of the front and back of your check to continue.')
      return
    }
    const pinErr = transactionPinMessage(pinRequired, transactionPin)
    if (pinErr) {
      onError(pinErr)
      return
    }
    setStep('processing')
    await new Promise((r) => setTimeout(r, 2_200))
    const acc = accounts.find((a) => a.id === toId)
    const res = await submitForApproval({
      type: 'mobile_deposit',
      title: `Mobile deposit ${formatCurrency(cents)} to ${acc?.name ?? toId}`,
      payload: { toId, amountCents: cents },
      ...approvalPinFields(pinRequired, transactionPin),
    })
    if (!res.ok) {
      setStep('form')
      onError(res.error)
      return
    }
    const svc = incomingFeeCentsForRail(bankCfg.depositsAndFees, 'mobile', cents)
    const net = cents - svc
    setReceiptRef(res.item.id)
    setWasAutoApplied(Boolean(res.depositAutoApplied))
    setFeeTakenCents(svc)
    setCreditedCents(res.depositAutoApplied ? net : cents)
    setStep('success')
    onRefreshAccounts?.()
    onSuccess(
      res.depositAutoApplied
        ? `Mobile deposit ${formatCurrency(net)} to ${acc?.name ?? 'account'} was credited immediately (per bank policy). Reference ${res.item.id}.`
        : `Mobile deposit request (${formatCurrency(cents)} to ${acc?.name ?? 'account'}) submitted for approval. Reference ${res.item.id}.`,
    )
  }

  function resetForm() {
    setStep('form')
    setReceiptRef('')
    setCreditedCents(null)
    setWasAutoApplied(false)
    setFeeTakenCents(0)
    setAmount('')
    setFront(null)
    setBack(null)
    setFileKey((k) => k + 1)
  }

  const creditAccountLabel =
    accounts.find((a) => a.id === toId)?.name ?? 'account'

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-2">
        <h2 className="font-display text-xl font-semibold text-bw-navy-900">
          Mobile deposit
        </h2>
        <p className="mt-1 text-sm text-bw-muted">
          Endorse your check, photograph both sides, and deposit to your
          account. Images attach to your deposit request for review; keep the
          physical check until the deposit clears.
        </p>

        {step === 'form' && (
          <form
            key={fileKey}
            className="mt-6 grid gap-5 sm:max-w-lg"
            onSubmit={(e) => void handleSubmit(e)}
          >
            <div>
              <label className="text-sm font-medium text-bw-navy-900" htmlFor="md-to">
                Deposit to
              </label>
              <select
                id="md-to"
                className="mt-1 w-full rounded-md border border-bw-sand-200 bg-white px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
              >
                {accountOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-bw-navy-900" htmlFor="md-front">
                Check front (photo)
              </label>
              <input
                id="md-front"
                key={`f-${fileKey}`}
                type="file"
                accept="image/*"
                capture="environment"
                className="mt-1 block w-full text-sm text-bw-muted file:mr-3 file:rounded-md file:border-0 file:bg-bw-navy-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-bw-navy-800"
                onChange={(e) => setFront(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-bw-navy-900" htmlFor="md-back">
                Check back (photo)
              </label>
              <input
                id="md-back"
                key={`b-${fileKey}`}
                type="file"
                accept="image/*"
                capture="environment"
                className="mt-1 block w-full text-sm text-bw-muted file:mr-3 file:rounded-md file:border-0 file:bg-bw-navy-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-bw-navy-800"
                onChange={(e) => setBack(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-bw-navy-900" htmlFor="md-amt">
                Check amount
              </label>
              <input
                id="md-amt"
                inputMode="decimal"
                placeholder="0.00"
                className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-bw-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-bw-red-600"
            >
              Deposit check
            </button>
          </form>
        )}

        {step === 'processing' && (
          <div
            className="mt-10 flex flex-col items-center py-8 text-center"
            role="status"
            aria-live="polite"
          >
            <div
              className="h-12 w-12 animate-spin rounded-full border-2 border-bw-sand-200 border-t-bw-navy-900"
              aria-hidden
            />
            <p className="mt-6 font-display text-lg font-semibold text-bw-navy-900">
              Reviewing your check…
            </p>
            <p className="mt-2 max-w-sm text-sm text-bw-muted">
              {bankCfg.depositsAndFees?.manualDepositApprovalRequired === false
                ? 'Finishing deposit — your account will update in a moment.'
                : 'Reading amount and endorsements. Funds will appear in your available balance once the deposit is approved and credited.'}
            </p>
          </div>
        )}

        {step === 'success' && creditedCents !== null && (
          <div className="mt-8 text-center sm:max-w-lg">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bw-sky-100 text-bw-blue-600"
              aria-hidden
            >
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="mt-4 font-display text-xl font-semibold text-bw-navy-900">
              {wasAutoApplied ? 'Deposit credited' : 'Request submitted'}
            </p>
            <p className="mt-2 text-sm text-bw-muted">
              {wasAutoApplied ? (
                <>
                  {formatCurrency(creditedCents)} to {creditAccountLabel} is now
                  in your available balance
                  {feeTakenCents > 0
                    ? ` (after a ${formatCurrency(feeTakenCents)} incoming deposit fee)`
                    : ''}
                  .
                </>
              ) : (
                <>
                  {formatCurrency(creditedCents)} to {creditAccountLabel} is
                  pending operator approval; your balance updates after approval.
                  {feeTakenCents > 0 ? (
                    <>
                      {' '}
                      When credited, the bank may deduct a scheduled fee of{' '}
                      {formatCurrency(feeTakenCents)} per your institution&apos;s
                      schedule.
                    </>
                  ) : null}
                </>
              )}
            </p>
            <p className="mt-1 text-sm text-bw-muted">
              Reference{' '}
              <span className="font-mono font-semibold text-bw-navy-900">
                {receiptRef}
              </span>
            </p>
            <button
              type="button"
              className="mt-6 rounded-md bg-bw-navy-900 px-4 py-3 text-sm font-semibold text-white hover:bg-bw-navy-800"
              onClick={resetForm}
            >
              Deposit another check
            </button>
          </div>
        )}
      </section>
      <aside className="rounded-xl border border-bw-sand-200 bg-bw-sand-100/80 p-6 lg:h-fit">
        <h3 className="text-sm font-semibold text-bw-navy-900">
          Before you deposit
        </h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-bw-muted">
          <li>
            Sign the back and write “{bankCfg.mobileDepositEndorsement}”
          </li>
          <li>Use good lighting and capture all four corners of the check.</li>
          <li>Destroy the paper check after a successful deposit per bank policy.</li>
        </ul>
      </aside>
    </div>
  )
}
