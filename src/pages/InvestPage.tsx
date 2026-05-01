import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBankConfig } from '../contexts/BankConfigContext'
import { AccountsOverviewSection } from '../components/AccountsOverviewSection'
import { formatCurrency } from '../lib/money'

type Holding = {
  symbol: string
  name: string
  valueCents: number
  dayChangeCents: number
}

const ALLOCATION = [
  { label: 'US stocks', pct: 52, className: 'bg-bw-navy-900' },
  { label: 'International', pct: 22, className: 'bg-bw-blue-600' },
  { label: 'Bonds', pct: 18, className: 'bg-bw-blue-500' },
  { label: 'Cash', pct: 8, className: 'bg-bw-sand-200' },
] as const

const GOALS = [
  {
    id: '1',
    title: 'Retirement',
    subtitle: 'Target year 2045',
    fundedPct: 64,
    balanceLabel: '$428,400',
    targetLabel: '$670,000',
  },
  {
    id: '2',
    title: 'Education',
    subtitle: 'Family college fund',
    fundedPct: 41,
    balanceLabel: '$52,800',
    targetLabel: '$130,000',
  },
  {
    id: '3',
    title: 'Home purchase',
    subtitle: 'Down payment reserve',
    fundedPct: 88,
    balanceLabel: '$70,400',
    targetLabel: '$80,000',
  },
] as const

export function InvestPage() {
  const { displayName } = useAuth()
  const { products, investBrandName } = useBankConfig()

  const holdings = useMemo<Holding[]>(
    () => [
      {
        symbol: 'BYWLX',
        name: products.fundTotalMarket,
        valueCents: 118_400_00,
        dayChangeCents: 1_842_00,
      },
      {
        symbol: 'BYIFX',
        name: products.fundInternational,
        valueCents: 52_100_00,
        dayChangeCents: -312_00,
      },
      {
        symbol: 'BYBFX',
        name: products.fundCoreBond,
        valueCents: 38_750_00,
        dayChangeCents: 89_00,
      },
      {
        symbol: 'MMDA',
        name: products.fundCashSweep,
        valueCents: 18_920_00,
        dayChangeCents: 0,
      },
    ],
    [products],
  )

  const totalValue = holdings.reduce((s, h) => s + h.valueCents, 0)
  const dayChange = holdings.reduce((s, h) => s + h.dayChangeCents, 0)
  const dayChangePct =
    totalValue - dayChange !== 0
      ? (dayChange / (totalValue - dayChange)) * 100
      : 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-bw-navy-900">
            Plan &amp; invest
          </h1>
          <p className="mt-1 text-bw-muted">
            Your {investBrandName} relationship, {displayName}. Values update
            with market movements; official balances and performance appear on
            your statements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/pay"
            className="inline-flex items-center justify-center rounded-md border border-bw-sand-200 bg-white px-4 py-2.5 text-sm font-semibold text-bw-navy-900 shadow-sm hover:bg-bw-sand-100"
          >
            Move money
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center justify-center rounded-md bg-bw-navy-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-bw-navy-800"
          >
            Back to accounts
          </Link>
        </div>
      </div>

      <AccountsOverviewSection />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-bw-sand-200 bg-white p-5 shadow-sm sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
            Total invested assets
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-bw-navy-900">
            {formatCurrency(totalValue)}
          </p>
          <p
            className={`mt-2 text-sm font-semibold tabular-nums ${
              dayChange >= 0 ? 'text-bw-blue-600' : 'text-bw-red-700'
            }`}
          >
            {dayChange >= 0 ? '+' : ''}
            {formatCurrency(dayChange)} today (
            {dayChange >= 0 ? '+' : ''}
            {dayChangePct.toFixed(2)}%)
          </p>
        </div>
        <div className="rounded-xl border border-bw-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
            YTD return
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-bw-blue-600">
            +6.2%
          </p>
          <p className="mt-2 text-xs text-bw-muted">
            Compared to a 60/40 benchmark +5.4%.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-bw-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Asset mix
            </h2>
            <p className="mt-1 text-sm text-bw-muted">
              How your investable assets are allocated across major asset
              classes.
            </p>
            <div
              className="mt-4 flex h-3 overflow-hidden rounded-full bg-bw-sand-200"
              role="img"
              aria-label="Allocation: 52 percent US stocks, 22 international, 18 bonds, 8 cash"
            >
              {ALLOCATION.map((a) => (
                <div
                  key={a.label}
                  className={`${a.className} first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${a.pct}%` }}
                  title={`${a.label} ${a.pct}%`}
                />
              ))}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {ALLOCATION.map((a) => (
                <li key={a.label} className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-sm ${a.className}`}
                    aria-hidden
                  />
                  <span className="text-bw-muted">{a.label}</span>
                  <span className="font-semibold text-bw-navy-900">
                    {a.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-bw-sand-200 bg-white shadow-sm">
            <div className="border-b border-bw-sand-200 px-5 py-4">
              <h2 className="font-display text-lg font-semibold text-bw-navy-900">
                Holdings
              </h2>
              <p className="mt-1 text-sm text-bw-muted">
                Core positions across your {investBrandName} accounts.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-bw-sand-200 text-xs font-semibold uppercase tracking-wide text-bw-muted">
                    <th className="px-5 py-3">Symbol</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3 text-right">Value</th>
                    <th className="px-5 py-3 text-right">Day</th>
                    <th className="px-5 py-3 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bw-sand-200">
                  {holdings.map((h) => {
                    const weight = Math.round((h.valueCents / totalValue) * 1000) / 10
                    return (
                      <tr key={h.symbol} className="hover:bg-bw-sand-100/50">
                        <td className="px-5 py-3 font-mono font-semibold text-bw-navy-900">
                          {h.symbol}
                        </td>
                        <td className="max-w-[14rem] px-5 py-3 text-bw-muted">
                          {h.name}
                        </td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums text-bw-navy-900">
                          {formatCurrency(h.valueCents)}
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-semibold tabular-nums ${
                            h.dayChangeCents > 0
                              ? 'text-bw-blue-600'
                              : h.dayChangeCents < 0
                                ? 'text-bw-red-700'
                                : 'text-bw-muted'
                          }`}
                        >
                          {h.dayChangeCents === 0
                            ? '—'
                            : `${h.dayChangeCents > 0 ? '+' : ''}${formatCurrency(h.dayChangeCents)}`}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-bw-muted">
                          {weight}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-bw-sand-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-bw-navy-900">
              Goals
            </h2>
            <p className="mt-1 text-sm text-bw-muted">
              Track funding progress against targets you set with a specialist.
            </p>
            <ul className="mt-4 space-y-5">
              {GOALS.map((g) => (
                <li key={g.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-bw-navy-900">{g.title}</p>
                      <p className="text-xs text-bw-muted">{g.subtitle}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-bw-muted">
                      {g.fundedPct}%
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-bw-sand-200"
                    role="progressbar"
                    aria-valuenow={g.fundedPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-bw-blue-600 transition-[width]"
                      style={{ width: `${g.fundedPct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs tabular-nums text-bw-muted">
                    {g.balanceLabel} of {g.targetLabel}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-bw-blue-500/25 bg-bw-sky-100/60 p-5">
            <h3 className="text-sm font-semibold text-bw-navy-900">
              Talk with an advisor
            </h3>
            <p className="mt-2 text-sm text-bw-muted">
              Review risk, taxes, and beneficiaries with a {investBrandName}{' '}
              planning specialist—at no obligation.
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-md bg-bw-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800"
            >
              Schedule a session
            </button>
          </div>

          <div className="rounded-xl border border-bw-sand-200 bg-bw-sand-100/80 p-5">
            <h3 className="text-sm font-semibold text-bw-navy-900">
              Tools &amp; planning
            </h3>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left font-medium text-bw-navy-900 hover:bg-white/80"
                >
                  Retirement income planner →
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left font-medium text-bw-navy-900 hover:bg-white/80"
                >
                  Risk tolerance questionnaire →
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left font-medium text-bw-navy-900 hover:bg-white/80"
                >
                  Tax-loss harvesting summary →
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left font-medium text-bw-navy-900 hover:bg-white/80"
                >
                  Beneficiaries &amp; estate →
                </button>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <p className="text-xs leading-relaxed text-bw-muted">
        Investing involves risk, including possible loss of principal. Past
        performance does not guarantee future results. Securities and advisory
        services are offered through {investBrandName} and affiliated
        registered representatives, subject to applicable disclosures. Not
        FDIC insured—not a deposit—may lose value.
      </p>
    </div>
  )
}
