import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DebitCardVisual } from '../components/DebitCardVisual'
import { useAccounts } from '../contexts/AccountsContext'
import { useApprovals } from '../contexts/ApprovalsContext'
import { useAuth } from '../contexts/AuthContext'
import { useBankConfig } from '../contexts/BankConfigContext'

function digitsOnly6(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6)
}

function debitCardPinMessage(pinRequired: boolean, rawPin: string): string | null {
  if (!pinRequired) return null
  return digitsOnly6(rawPin).length === 6
    ? null
    : 'Enter your 6-digit transaction PIN to authorize this request.'
}

function debitCardPinFields(
  pinRequired: boolean,
  rawPin: string,
): { transactionPin?: string } {
  if (!pinRequired) return {}
  return { transactionPin: digitsOnly6(rawPin) }
}

export function DebitCardPage() {
  const { displayName, user } = useAuth()
  const cfg = useBankConfig()
  const { submitForApproval, pendingCount } = useApprovals()
  const pinRequired = Boolean(user?.hasTransactionPin)
  const [transactionPin, setTransactionPin] = useState('')
  const [actionMsg, setActionMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const {
    accounts,
    debitCard,
    replacementBanner,
    dismissDebitCardReplacementBanner,
    refresh,
    onlineBankingRestricted,
  } = useAccounts()
  const [replaceOpen, setReplaceOpen] = useState(false)

  const cardBlockedByBank = Boolean(
    debitCard.adminFrozen || debitCard.stolenBlocked,
  )

  const checking = accounts.find((a) => a.id === 'chk')
  const linkedLine = `Linked to ${cfg.products.checkingName}`
  const linkedRow = `${cfg.products.checkingName} ···${checking?.mask ?? cfg.products.checkingMask}`

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-bw-navy-900">
            Debit card
          </h1>
          <p className="mt-1 text-bw-muted">
            Lock and unlock apply immediately on your card. Travel notice,
            contactless, and replacement requests go to back-office approval
            before they take effect. Card network not connected in this
            environment.
          </p>
        </div>
        <Link
          to="/app"
          className="text-sm font-semibold text-bw-blue-600 hover:underline"
        >
          ← Back to accounts
        </Link>
      </div>

      {pendingCount > 0 ? (
        <div
          role="status"
          className="rounded-xl border border-bw-blue-500/25 bg-bw-sky-100/80 px-5 py-4 text-sm text-bw-navy-900"
        >
          You have {pendingCount} open request
          {pendingCount === 1 ? '' : 's'} in the approval queue (including
          transfers or payments from other screens).
        </div>
      ) : null}

      {debitCard.stolenBlocked ? (
        <div
          role="alert"
          className="rounded-xl border border-bw-red-600/35 bg-red-50 px-5 py-4 text-sm text-bw-red-800"
        >
          <strong className="font-semibold">Card blocked — theft or fraud.</strong>{' '}
          This card cannot be used for purchases or ATM withdrawals. Contact
          {cfg.supportPhoneFraud} or the number on the back of your card.
        </div>
      ) : null}

      {debitCard.adminFrozen && !debitCard.stolenBlocked ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-50 px-5 py-4 text-sm text-amber-950"
        >
          <strong className="font-semibold">Card frozen by the bank.</strong>{' '}
          Our team is reviewing activity. Card controls are temporarily disabled
          until the review is complete. Call {cfg.supportPhone} if you need help.
        </div>
      ) : null}

      {actionMsg ? (
        <div
          role="status"
          className={
            actionMsg.type === 'success'
              ? 'rounded-xl border border-bw-blue-500/20 bg-bw-sky-100 px-5 py-4 text-sm text-bw-navy-900'
              : 'rounded-xl border border-bw-red-600/30 bg-red-50 px-5 py-4 text-sm text-bw-red-800'
          }
        >
          {actionMsg.text}
        </div>
      ) : null}

      {pinRequired ? (
        <div className="rounded-xl border border-bw-sand-200 bg-white px-5 py-4 shadow-sm">
          <label
            className="block text-sm font-medium text-bw-navy-900"
            htmlFor="debit-tx-pin"
          >
            Transaction PIN
          </label>
          <input
            id="debit-tx-pin"
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
            Required for card requests when a transaction PIN is on your
            account.
          </p>
        </div>
      ) : null}

      {replacementBanner ? (
        <div
          className="flex flex-col gap-3 rounded-xl border border-bw-blue-500/30 bg-bw-sky-100/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="text-sm text-bw-navy-900">{replacementBanner}</p>
          <button
            type="button"
            onClick={dismissDebitCardReplacementBanner}
            className="shrink-0 rounded-md bg-bw-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-bw-navy-800"
          >
            Got it
          </button>
        </div>
      ) : null}

      <fieldset
        disabled={onlineBankingRestricted}
        className="min-w-0 border-0 p-0 disabled:opacity-[0.55]"
      >
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-bw-muted">
            Your card
          </h2>
          <DebitCardVisual
            cardholderName={displayName}
            last4={debitCard.last4}
            expMonth={debitCard.expMonth}
            expYear={debitCard.expYear}
            locked={debitCard.locked}
            contactlessEnabled={debitCard.contactlessEnabled}
            linkedAccountLine={linkedLine}
            virtualBadge={debitCard.cardType === 'virtual'}
            institutionLogoSrc={cfg.bankLogoSrc || undefined}
          />
          <p className="text-center text-xs text-bw-muted lg:text-left">
            Card art is illustrative. Contactless icon reflects your tap
            setting below.
          </p>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Status
            </h2>
            <p className="mt-1 text-sm text-bw-muted">
              {cardBlockedByBank
                ? 'The bank has restricted this card. See the notice above.'
                : debitCard.locked
                  ? 'Purchases and ATM withdrawals are blocked until you unlock.'
                  : 'Your card is active for purchases, ATMs, and digital wallets.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  debitCard.stolenBlocked
                    ? 'bg-bw-red-700/15 text-bw-red-900'
                    : debitCard.adminFrozen
                      ? 'bg-amber-600/15 text-amber-900'
                      : debitCard.locked
                        ? 'bg-bw-red-700/10 text-bw-red-800'
                        : 'bg-bw-blue-600/10 text-bw-blue-700'
                }`}
              >
                {debitCard.stolenBlocked
                  ? 'Blocked'
                  : debitCard.adminFrozen
                    ? 'Bank freeze'
                    : debitCard.locked
                      ? 'Locked'
                      : 'Active'}
              </span>
              <button
                type="button"
                disabled={cardBlockedByBank || onlineBankingRestricted}
                onClick={() => {
                  void (async () => {
                    const pinErr = debitCardPinMessage(pinRequired, transactionPin)
                    if (pinErr) {
                      setActionMsg({ type: 'error', text: pinErr })
                      return
                    }
                    const nextLocked = !debitCard.locked
                    const res = await submitForApproval({
                      type: 'debit_card_lock',
                      title: nextLocked ? 'Lock debit card' : 'Unlock debit card',
                      payload: { locked: nextLocked },
                      ...debitCardPinFields(pinRequired, transactionPin),
                    })
                    if (!res.ok) {
                      setActionMsg({ type: 'error', text: res.error })
                      return
                    }
                    if (res.bankingAutoApplied) void refresh()
                    setActionMsg({
                      type: 'success',
                      text: res.bankingAutoApplied
                        ? nextLocked
                          ? 'Your card is locked. Purchases and ATM withdrawals are blocked until you unlock.'
                          : 'Your card is unlocked and active for purchases, ATMs, and digital wallets.'
                        : `Request submitted (${res.item.id}). Your card status updates after approval.`,
                    })
                  })()
                }}
                className={`rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  debitCard.locked
                    ? 'bg-bw-navy-900 text-white hover:bg-bw-navy-800'
                    : 'border border-bw-sand-200 text-bw-navy-900 hover:bg-bw-sand-100'
                }`}
              >
                {debitCard.locked ? 'Unlock card' : 'Lock card'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Limits &amp; features
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-bw-sand-100 pb-3">
                <dt className="text-bw-muted">Single purchase cap (bank-set)</dt>
                <dd className="font-semibold tabular-nums text-bw-navy-900">
                  {debitCard.singleTransactionLimitCents != null
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(debitCard.singleTransactionLimitCents / 100)
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-bw-sand-100 pb-3">
                <dt className="text-bw-muted">Daily spend cap (bank-set)</dt>
                <dd className="font-semibold tabular-nums text-bw-navy-900">
                  {debitCard.dailySpendLimitCents != null
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(debitCard.dailySpendLimitCents / 100)
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-bw-sand-100 pb-3">
                <dt className="text-bw-muted">ATM withdrawal (daily)</dt>
                <dd className="font-semibold tabular-nums text-bw-navy-900">
                  $800
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-bw-sand-100 pb-3">
                <dt className="text-bw-muted">Purchase limit (daily)</dt>
                <dd className="font-semibold tabular-nums text-bw-navy-900">
                  $5,000
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-bw-muted">Linked account</dt>
                <dd className="text-right font-medium text-bw-navy-900">
                  {linkedRow}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Preferences
            </h2>
            <ul className="mt-4 divide-y divide-bw-sand-100">
              <li className="flex items-start justify-between gap-4 py-4 first:pt-0">
                <div>
                  <p className="font-medium text-bw-navy-900">
                    Travel notice
                  </p>
                  <p className="mt-0.5 text-sm text-bw-muted">
                    Reduces fraud blocks when you are away from home. Turn on
                    before you travel.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={debitCard.travelNoticeEnabled}
                  disabled={cardBlockedByBank}
                  onClick={() => {
                    void (async () => {
                      const pinErr = debitCardPinMessage(pinRequired, transactionPin)
                      if (pinErr) {
                        setActionMsg({ type: 'error', text: pinErr })
                        return
                      }
                      const next = !debitCard.travelNoticeEnabled
                      const res = await submitForApproval({
                        type: 'debit_card_travel_notice',
                        title: next
                          ? 'Enable travel notice on debit card'
                          : 'Turn off travel notice on debit card',
                        payload: { enabled: next },
                        ...debitCardPinFields(pinRequired, transactionPin),
                      })
                      if (!res.ok) {
                        setActionMsg({ type: 'error', text: res.error })
                        return
                      }
                      setActionMsg({
                        type: 'success',
                        text: `Travel notice request submitted (${res.item.id}).`,
                      })
                    })()
                  }}
                  className={[
                    'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
                    debitCard.travelNoticeEnabled
                      ? 'bg-bw-blue-600'
                      : 'bg-bw-sand-200',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                      debitCard.travelNoticeEnabled
                        ? 'translate-x-5'
                        : 'translate-x-0',
                    ].join(' ')}
                    aria-hidden
                  />
                </button>
              </li>
              <li className="flex items-start justify-between gap-4 py-4">
                <div>
                  <p className="font-medium text-bw-navy-900">
                    Contactless (tap to pay)
                  </p>
                  <p className="mt-0.5 text-sm text-bw-muted">
                    Turn off if you prefer chip or swipe only.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={debitCard.contactlessEnabled}
                  disabled={cardBlockedByBank}
                  onClick={() => {
                    void (async () => {
                      const pinErr = debitCardPinMessage(pinRequired, transactionPin)
                      if (pinErr) {
                        setActionMsg({ type: 'error', text: pinErr })
                        return
                      }
                      const next = !debitCard.contactlessEnabled
                      const res = await submitForApproval({
                        type: 'debit_card_contactless',
                        title: next
                          ? 'Enable contactless (tap) on debit card'
                          : 'Disable contactless (tap) on debit card',
                        payload: { enabled: next },
                        ...debitCardPinFields(pinRequired, transactionPin),
                      })
                      if (!res.ok) {
                        setActionMsg({ type: 'error', text: res.error })
                        return
                      }
                      setActionMsg({
                        type: 'success',
                        text: `Contactless setting request submitted (${res.item.id}).`,
                      })
                    })()
                  }}
                  className={[
                    'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
                    debitCard.contactlessEnabled
                      ? 'bg-bw-blue-600'
                      : 'bg-bw-sand-200',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                      debitCard.contactlessEnabled
                        ? 'translate-x-5'
                        : 'translate-x-0',
                    ].join(' ')}
                    aria-hidden
                  />
                </button>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Card activity
            </h2>
            <p className="mt-1 text-sm text-bw-muted">
              Recent authorizations and operator events on this card (demo
              ledger).
            </p>
            {debitCard.transactions && debitCard.transactions.length > 0 ? (
              <ul className="mt-4 divide-y divide-bw-sand-100">
                {debitCard.transactions.slice(0, 25).map((tx) => (
                  <li
                    key={tx.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-bw-navy-900">{tx.merchant}</p>
                      <p className="text-xs text-bw-muted">
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        }).format(new Date(tx.postedAt))}{' '}
                        ·{' '}
                        <span className="uppercase">{tx.status}</span>
                      </p>
                    </div>
                    <p
                      className={`font-mono font-semibold tabular-nums ${
                        tx.amountCents < 0
                          ? 'text-bw-red-800'
                          : 'text-bw-navy-900'
                      }`}
                    >
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(tx.amountCents / 100)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-bw-muted">
                No card-level transactions yet.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Replace card
            </h2>
            <p className="mt-1 text-sm text-bw-muted">
              Order a new physical card if yours is damaged, lost, or worn.
            </p>
            {!replaceOpen ? (
              <button
                type="button"
                disabled={cardBlockedByBank}
                onClick={() => setReplaceOpen(true)}
                className="mt-4 rounded-md border border-bw-sand-200 px-4 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Order replacement
              </button>
            ) : (
              <div className="mt-4 space-y-3 rounded-lg border border-bw-sand-200 bg-bw-sand-100/50 p-4">
                <p className="text-sm text-bw-navy-900">
                  We will mail a new card to the address on file. Your current
                  card keeps working until you activate the replacement.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={cardBlockedByBank}
                    onClick={() => {
                      void (async () => {
                        const pinErr = debitCardPinMessage(
                          pinRequired,
                          transactionPin,
                        )
                        if (pinErr) {
                          setActionMsg({ type: 'error', text: pinErr })
                          return
                        }
                        const res = await submitForApproval({
                          type: 'debit_card_replacement',
                          title: 'Order debit card replacement',
                          payload: {},
                          ...debitCardPinFields(pinRequired, transactionPin),
                        })
                        if (!res.ok) {
                          setActionMsg({ type: 'error', text: res.error })
                          return
                        }
                        setReplaceOpen(false)
                        setActionMsg({
                          type: 'success',
                          text: `Replacement request submitted (${res.item.id}).`,
                        })
                      })()
                    }}
                    className="rounded-md bg-bw-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bw-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Confirm order
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplaceOpen(false)}
                    className="rounded-md border border-bw-sand-200 px-4 py-2 text-sm font-semibold text-bw-navy-900 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      </fieldset>
    </div>
  )
}
