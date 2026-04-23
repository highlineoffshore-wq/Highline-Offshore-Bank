import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAccounts } from '../contexts/AccountsContext'
import {
  formatFullAccountNumberForDisplay,
  getInvestmentAccountProfile,
} from '../lib/investmentAccountProfiles'
import { formatActivityListDate } from '../lib/activityWhenLabel'
import { formatCurrency } from '../lib/money'
import type { AccountRow, ActivityRow } from '../types/banking'

function activityForAccount(
  rows: ActivityRow[],
  account: AccountRow,
): ActivityRow[] {
  const needle = `···${account.mask}`
  return rows.filter(
    (row) =>
      row.operatorAccountId === account.id ||
      row.description.includes(needle),
  )
}

function depositFullAccountNumber(account: AccountRow): string {
  return account.accountNumberFull ?? `794286319${account.mask}`
}

export function AccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const {
    accounts,
    activity,
    scheduledBillPayments,
    loading,
    error,
  } = useAccounts()

  const investment = useMemo(
    () => getInvestmentAccountProfile(accountId),
    [accountId],
  )

  const deposit = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId],
  )

  const accountActivity = useMemo(
    () => (deposit ? activityForAccount(activity, deposit) : []),
    [activity, deposit],
  )

  const scheduledFromAccount = useMemo(
    () =>
      deposit
        ? scheduledBillPayments.filter((p) => p.fromId === deposit.id)
        : [],
    [scheduledBillPayments, deposit],
  )

  if (!accountId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-bw-muted">Missing account.</p>
        <Link
          to="/app"
          className="text-sm font-semibold text-bw-blue-600 hover:underline"
        >
          ← Back to accounts
        </Link>
      </div>
    )
  }

  if (error && !investment) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-xl border border-bw-red-600/30 bg-red-50 px-5 py-4 text-sm text-bw-red-800"
        >
          {error}
        </div>
        <Link
          to="/app"
          className="text-sm font-semibold text-bw-blue-600 hover:underline"
        >
          ← Back to accounts
        </Link>
      </div>
    )
  }

  if (!investment) {
    if (loading && !deposit) {
      return <p className="text-sm text-bw-muted">Loading account…</p>
    }

    if (!loading && !deposit) {
      return (
        <div className="space-y-6">
          <div
            role="status"
            className="rounded-xl border border-bw-sand-200 bg-bw-sand-100/60 px-5 py-4 text-sm text-bw-navy-900"
          >
            We could not find that account. It may have been closed or the link
            is out of date.
          </div>
          <Link
            to="/app"
            className="inline-flex text-sm font-semibold text-bw-blue-600 hover:underline"
          >
            ← Back to accounts overview
          </Link>
        </div>
      )
    }

    if (!deposit) {
      return null
    }
  }

  const title = investment ? investment.name : deposit!.name
  const typeLine = investment
    ? `${investment.typeLabel} · ${investment.classification}`
    : `${deposit!.type} ···${deposit!.mask}`

  const fullNumberRaw = investment
    ? investment.accountNumberFull
    : depositFullAccountNumber(deposit!)
  const fullNumberDisplay = formatFullAccountNumberForDisplay(fullNumberRaw)

  const balanceCents = investment
    ? investment.balanceCents
    : deposit!.balanceCents

  const isInvestment = Boolean(investment)
  const primaryActionHref = isInvestment ? '/app/invest' : '/app/pay'
  const primaryActionLabel = isInvestment ? 'Plan & invest' : 'Transfer'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/app"
            className="text-sm font-semibold text-bw-blue-600 hover:underline"
          >
            ← Accounts overview
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold text-bw-navy-900">
            {title}
          </h1>
          <p className="mt-1 text-bw-muted">{typeLine}</p>
        </div>
        <Link
          to={primaryActionHref}
          className="inline-flex items-center justify-center rounded-md bg-bw-navy-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-bw-navy-800"
        >
          {primaryActionLabel}
        </Link>
      </div>

      <section className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
          Full account number
        </h2>
        <p
          className="mt-2 font-mono text-xl font-semibold tracking-wide text-bw-navy-900 sm:text-2xl"
          translate="no"
        >
          {fullNumberDisplay}
        </p>
        <p className="mt-2 text-xs text-bw-muted">
          For your security, the full number is only shown on this screen—not on
          the overview list.
        </p>
      </section>

      <section className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
          {isInvestment ? 'Account value' : 'Available balance'}
        </p>
        <p className="mt-2 font-display text-4xl font-semibold tabular-nums text-bw-navy-900">
          {formatCurrency(balanceCents)}
        </p>
        <p className="mt-2 text-sm text-bw-muted">
          {isInvestment
            ? 'Values move with the market; official figures appear on your statements.'
            : 'Balances reflect this service only; official figures appear on your statement.'}
        </p>
      </section>

      {!isInvestment && scheduledFromAccount.length > 0 ? (
        <section className="rounded-xl border border-bw-sand-200 bg-white shadow-sm">
          <div className="border-b border-bw-sand-200 px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Scheduled from this account
            </h2>
          </div>
          <ul className="divide-y divide-bw-sand-200">
            {scheduledFromAccount.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"
              >
                <div>
                  <p className="font-medium text-bw-navy-900">{p.payeeName}</p>
                  <p className="text-xs text-bw-muted">Deliver by {p.deliverBy}</p>
                </div>
                <span className="font-semibold tabular-nums text-bw-navy-900">
                  {formatCurrency(p.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-bw-sand-200 bg-white shadow-sm">
        <div className="border-b border-bw-sand-200 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-bw-navy-900">
            {isInvestment ? 'Holdings & activity' : 'Activity for this account'}
          </h2>
          <p className="mt-1 text-sm text-bw-muted">
            {isInvestment
              ? 'Positions, performance, and trade confirmations live on Plan & invest.'
              : 'Lines that reference this account or were posted to this account.'}
          </p>
        </div>
        {isInvestment ? (
          <div className="px-5 py-6">
            <p className="text-sm text-bw-muted">
              Open Plan & invest for holdings, allocation, and account-specific
              activity.
            </p>
            <Link
              to="/app/invest"
              className="mt-4 inline-flex text-sm font-semibold text-bw-blue-600 hover:underline"
            >
              Go to Plan & invest →
            </Link>
          </div>
        ) : accountActivity.length === 0 ? (
          <p className="px-5 py-6 text-sm text-bw-muted">
            No matching activity yet.
          </p>
        ) : (
          <ul className="divide-y divide-bw-sand-200">
            {accountActivity.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"
              >
                <div>
                  <p className="font-medium text-bw-navy-900">
                    {row.description}
                  </p>
                  <p className="text-xs text-bw-muted">
                    {formatActivityListDate(row)}
                  </p>
                </div>
                <span
                  className={`font-semibold tabular-nums ${
                    row.amountCents === 0
                      ? 'text-bw-muted'
                      : row.amountCents < 0
                        ? 'text-bw-red-700'
                        : 'text-emerald-700'
                  }`}
                >
                  {row.amountCents === 0
                    ? '—'
                    : `${row.amountCents < 0 ? '' : '+'}${formatCurrency(row.amountCents)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
