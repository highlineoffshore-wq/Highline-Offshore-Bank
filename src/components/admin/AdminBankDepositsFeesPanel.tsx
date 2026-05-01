import { type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import type { BankConfig } from '../../types/bankConfig'

const lbl =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500'
const inp =
  'mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3.5 py-2.5 text-sm text-white shadow-inner shadow-stone-900/10 outline-none transition placeholder:text-white/25 focus:border-bw-blue-600/55 focus:ring-2 focus:ring-bw-blue-600/20'

function IconBanknote({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0015.797 2.743c.796 0 1.582-.05 2.363-.154M3.75 9.75h16.5m-16.5 4.5h16.5M5.25 5.25h13.5a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5z"
      />
    </svg>
  )
}

function AdminFieldGroup({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-bw-sand-200 bg-white p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
      <div className="border-b border-bw-sand-200 pb-3">
        <h3 className="text-sm font-semibold text-bw-navy-950">{title}</h3>
        {hint ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
}

function AdminSection({
  id,
  step,
  title,
  description,
  icon,
  children,
}: {
  id: string
  step?: string
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-44 rounded-xl border border-bw-sand-200 bg-white shadow-lg shadow-black/25 sm:scroll-mt-40 lg:scroll-mt-28"
    >
      <div className="flex flex-col gap-4 border-b border-bw-sand-200 px-6 py-6 sm:flex-row sm:items-start sm:gap-5 md:px-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bw-blue-600/15 text-bw-blue-500 ring-1 ring-bw-blue-600/25">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5 gap-y-1">
            {step ? (
              <span className="rounded-md border border-bw-blue-600/30 bg-bw-blue-600/10 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums tracking-tight text-bw-blue-500">
                {step}
              </span>
            ) : null}
            <h2 className="font-display text-xl font-semibold tracking-tight text-bw-navy-950 md:text-[1.35rem]">
              {title}
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {description}
          </p>
        </div>
      </div>
      <div className="px-6 py-6 md:px-8 md:py-8">{children}</div>
    </section>
  )
}

export function AdminBankDepositsFeesPanel({
  draft,
  setDraft,
  sectionId = 'section-fees',
}: {
  draft: BankConfig
  setDraft: Dispatch<SetStateAction<BankConfig | null>>
  sectionId?: string
}) {
  return (
    <AdminSection
      id={sectionId}
      step="05"
      title="Deposits & fees"
      description="Incoming money policy, which deposit rails are offered, transaction and maintenance fee modes, and the outbound wire fee schedule used at approval time."
      icon={<IconBanknote />}
    >
      <div className="space-y-10">
        <AdminFieldGroup
          title="Incoming money control"
          hint="Mobile check deposits always create an approval record. When manual approval is off, the demo server credits the account immediately after a successful submit."
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-bw-sand-200 bg-white/80 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-bw-sand-200 bg-bw-sand-100 text-bw-blue-600 focus:ring-bw-blue-600/40"
              checked={draft.depositsAndFees.manualDepositApprovalRequired}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  depositsAndFees: {
                    ...draft.depositsAndFees,
                    manualDepositApprovalRequired: e.target.checked,
                  },
                })
              }
            />
            <span>
              <span className="block text-sm font-semibold text-bw-navy-950">
                Require manual operator approval for incoming deposits
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                When enabled, deposits stay in the queue until an operator
                approves them in{' '}
                <Link
                  to="/admin/transactions"
                  className="font-semibold text-bw-blue-500 hover:underline"
                >
                  Transactions
                </Link>
                .
              </span>
            </span>
          </label>
        </AdminFieldGroup>

        <AdminFieldGroup
          title="Deposit methods offered"
          hint="Controls which deposit rails appear under Pay & transfer → Deposits. Fees use the schedule below when transaction fees are set to auto."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                [
                  'bankTransfer',
                  'Bank transfer / check deposit',
                  'Mobile check capture',
                ],
                [
                  'cardFunding',
                  'Card funding',
                  'Pay & transfer → Deposits',
                ],
                ['crypto', 'Crypto (optional)', 'Pay & transfer → Deposits'],
              ] as const
            ).map(([key, titleText, sub]) => (
              <label
                key={key}
                className="flex cursor-pointer flex-col gap-2 rounded-lg border border-bw-sand-200 bg-white/80 px-4 py-3"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-bw-sand-200 bg-bw-sand-100 text-bw-blue-600 focus:ring-bw-blue-600/40"
                    checked={draft.depositsAndFees.depositMethods[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        depositsAndFees: {
                          ...draft.depositsAndFees,
                          depositMethods: {
                            ...draft.depositsAndFees.depositMethods,
                            [key]: e.target.checked,
                          },
                        },
                      })
                    }
                  />
                  <span className="text-sm font-semibold text-bw-navy-950">
                    {titleText}
                  </span>
                </span>
                <span className="text-xs text-slate-500">{sub}</span>
              </label>
            ))}
          </div>
        </AdminFieldGroup>

        <AdminFieldGroup
          title="Fee configuration"
          hint="Auto applies scheduled amounts (where the engine supports them). Manual leaves fees to operator judgment on each approval."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <span className={lbl}>Transaction fees</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['auto', 'manual'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        depositsAndFees: {
                          ...draft.depositsAndFees,
                          transactionFeesMode: mode,
                        },
                      })
                    }
                    className={[
                      'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition',
                      draft.depositsAndFees.transactionFeesMode === mode
                        ? 'bg-bw-blue-600 text-white shadow-sm'
                        : 'border border-bw-sand-200 bg-bw-sand-100 text-slate-400 hover:border-bw-blue-600/40 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {mode === 'auto' ? 'Auto (schedule)' : 'Manual'}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Auto mode applies the fee fields below to the matching deposit
                rail when it posts (mobile check, card funding, or crypto
                on-ramp). Wire fees always use the table in the next group.
              </p>
            </div>
            <div>
              <span className={lbl}>Maintenance fees</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['auto', 'manual'] as const).map((mode) => (
                  <button
                    key={`m-${mode}`}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        depositsAndFees: {
                          ...draft.depositsAndFees,
                          maintenanceFeesMode: mode,
                        },
                      })
                    }
                    className={[
                      'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition',
                      draft.depositsAndFees.maintenanceFeesMode === mode
                        ? 'bg-bw-blue-600 text-white shadow-sm'
                        : 'border border-bw-sand-200 bg-bw-sand-100 text-slate-400 hover:border-bw-blue-600/40 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {mode === 'auto' ? 'Auto (schedule)' : 'Manual'}
                  </button>
                ))}
              </div>
              <label className="mt-3 block">
                <span className={lbl}>
                  Monthly maintenance (¢){' '}
                  <span className="font-normal normal-case text-slate-500">
                    — disclosure / future automation
                  </span>
                </span>
                <input
                  type="number"
                  min={0}
                  className={inp}
                  disabled={
                    draft.depositsAndFees.maintenanceFeesMode === 'manual'
                  }
                  value={draft.depositsAndFees.maintenanceFeeMonthlyCents}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      depositsAndFees: {
                        ...draft.depositsAndFees,
                        maintenanceFeeMonthlyCents: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
            </div>
          </div>

          <div
            className={`mt-6 grid gap-5 sm:grid-cols-3 ${draft.depositsAndFees.transactionFeesMode === 'manual' ? 'opacity-50' : ''}`}
          >
            <label className="block">
              <span className={lbl}>Incoming transfer / check fee (¢)</span>
              <input
                type="number"
                min={0}
                className={inp}
                disabled={
                  draft.depositsAndFees.transactionFeesMode === 'manual'
                }
                value={draft.depositsAndFees.incomingBankTransferFeeCents}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    depositsAndFees: {
                      ...draft.depositsAndFees,
                      incomingBankTransferFeeCents:
                        Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
            <label className="block">
              <span className={lbl}>Card funding fee (¢)</span>
              <input
                type="number"
                min={0}
                className={inp}
                disabled={
                  draft.depositsAndFees.transactionFeesMode === 'manual'
                }
                value={draft.depositsAndFees.cardFundingFeeCents}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    depositsAndFees: {
                      ...draft.depositsAndFees,
                      cardFundingFeeCents: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
            <label className="block">
              <span className={lbl}>Crypto deposit fee (¢)</span>
              <input
                type="number"
                min={0}
                className={inp}
                disabled={
                  draft.depositsAndFees.transactionFeesMode === 'manual'
                }
                value={draft.depositsAndFees.cryptoDepositFeeCents}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    depositsAndFees: {
                      ...draft.depositsAndFees,
                      cryptoDepositFeeCents: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
          </div>
        </AdminFieldGroup>

        <AdminFieldGroup
          title="Outbound wire fee schedule"
          hint="Used when wire approvals execute. Amounts are in cents."
        >
          <div className="grid gap-5 sm:max-w-2xl sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className={lbl}>Domestic (¢)</span>
              <input
                type="number"
                min={0}
                className={inp}
                value={draft.fees.wireDomesticCents}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fees: {
                      ...draft.fees,
                      wireDomesticCents: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
            <label className="block">
              <span className={lbl}>International (¢)</span>
              <input
                type="number"
                min={0}
                className={inp}
                value={draft.fees.wireInternationalCents}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fees: {
                      ...draft.fees,
                      wireInternationalCents: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
            <label className="block">
              <span className={lbl}>COT surcharge (¢)</span>
              <input
                type="number"
                min={0}
                className={inp}
                value={draft.fees.wireCotCents ?? 0}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fees: {
                      ...draft.fees,
                      wireCotCents: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
            <label className="block">
              <span className={lbl}>IMF surcharge (¢)</span>
              <input
                type="number"
                min={0}
                className={inp}
                value={draft.fees.wireImfCents ?? 0}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fees: {
                      ...draft.fees,
                      wireImfCents: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
            <label className="block sm:col-span-2 lg:col-span-1">
              <span className={lbl}>FX reference (USD per 1 EUR)</span>
              <input
                type="number"
                min={0}
                step={0.0001}
                className={inp}
                value={draft.fees.fxUsdPerEur ?? 0}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fees: {
                      ...draft.fees,
                      fxUsdPerEur: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
          </div>
        </AdminFieldGroup>
      </div>
    </AdminSection>
  )
}
