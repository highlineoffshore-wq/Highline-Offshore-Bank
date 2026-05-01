import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { KycDocumentSlotsForm } from '../components/KycDocumentSlotsForm'
import { useAuth } from '../contexts/AuthContext'
import { useBankConfig } from '../contexts/BankConfigContext'
import type { BankConfig } from '../types/bankConfig'
import {
  clearOpenAccountKycPending,
  getOpenAccountInterestSelections,
  hasOpenAccountKycPending,
  setOpenAccountInterestSelections,
  setOpenAccountKycPending,
} from '../lib/openAccountSession'
import {
  fetchCustomerOnboarding,
  patchCustomerBusinessOnboarding,
} from '../lib/onboardingCustomerApi'

function interestSummaryLines(slugs: string[], cfg: BankConfig): string[] {
  return slugs.map((s) => {
    switch (s) {
      case 'checking':
        return cfg.products.checkingName
      case 'savings':
        return cfg.products.savingsName
      case 'investments':
        return `${cfg.investBrandName} (investing)`
      case 'business':
        return 'Small business banking'
      case 'not_sure':
        return 'Still deciding — we will narrow it together'
      default:
        return s
    }
  })
}

function toggleInterestSlug(
  prev: string[],
  slug:
    | 'checking'
    | 'savings'
    | 'investments'
    | 'business'
    | 'not_sure',
): string[] {
  if (slug === 'not_sure') {
    return prev.includes('not_sure') ? [] : ['not_sure']
  }
  const noUnsure = prev.filter((x) => x !== 'not_sure')
  if (noUnsure.includes(slug)) {
    return noUnsure.filter((x) => x !== slug)
  }
  return [...noUnsure, slug]
}

export function SignUpPage() {
  const { isSignedIn, register } = useAuth()
  const bankCfg = useBankConfig()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [pathNeedsBusiness, setPathNeedsBusiness] = useState(false)
  const [businessLegalName, setBusinessLegalName] = useState('')
  const [businessTradeName, setBusinessTradeName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const interestSorted = useMemo(
    () => [...interests].sort(),
    [interests],
  )

  const progressTitles = useMemo(
    () =>
      pathNeedsBusiness
        ? ([
            'Your details',
            'Account interests',
            'Create login',
            'Business',
            'Verify ID',
            "You're in",
          ] as const)
        : ([
            'Your details',
            'Account interests',
            'Create login',
            'Verify ID',
            "You're in",
          ] as const),
    [pathNeedsBusiness],
  )

  const displayStep =
    pathNeedsBusiness || step <= 3 ? step : step >= 5 ? step - 1 : step

  useEffect(() => {
    if (!isSignedIn || !hasOpenAccountKycPending()) return
    let cancelled = false
    ;(async () => {
      const saved = getOpenAccountInterestSelections()
      if (saved.length) setInterests(saved)
      try {
        const o = await fetchCustomerOnboarding()
        if (cancelled) return
        setPathNeedsBusiness(o.interests.includes('business'))
        if (o.needsBusinessProfile) {
          setStep(4)
          return
        }
        setStep(5)
      } catch {
        if (cancelled) return
        const biz = saved.includes('business')
        setPathNeedsBusiness(biz)
        setStep(biz ? 4 : 5)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSignedIn])

  useEffect(() => {
    if (step !== 6) return
    const t = window.setTimeout(() => {
      navigate('/app', { replace: true })
    }, 2200)
    return () => window.clearTimeout(t)
  }, [step, navigate])

  if (isSignedIn && !hasOpenAccountKycPending()) {
    return <Navigate to="/app" replace />
  }

  function goNextFromDetails(e: FormEvent) {
    e.preventDefault()
    setErr('')
    const em = email.trim()
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setErr('Enter a valid email address.')
      return
    }
    setEmail(em)
    setStep(2)
  }

  function goNextFromInterests(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (interests.length === 0) {
      setErr('Choose at least one option so we know how to help you.')
      return
    }
    setPathNeedsBusiness(interests.includes('business'))
    setStep(3)
  }

  async function handleCreateAccount(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setErr('')
    if (interests.length === 0) {
      setErr('Choose the account types you are interested in before continuing.')
      setStep(2)
      return
    }
    if (password !== confirm) {
      setErr('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await register(
        email.trim(),
        password,
        displayName.trim() || email.trim().split('@')[0] || 'Customer',
        interestSorted,
      )
      if (!res.ok) {
        setErr(res.error)
        return
      }
      setOpenAccountInterestSelections(interestSorted)
      setOpenAccountKycPending()
      setPathNeedsBusiness(interestSorted.includes('business'))
      if (interestSorted.includes('business')) {
        setStep(4)
      } else {
        setStep(5)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleBusinessContinue(e: FormEvent) {
    e.preventDefault()
    setErr('')
    const legal = businessLegalName.trim()
    if (legal.length < 2) {
      setErr('Enter the legal business name as registered with the state.')
      return
    }
    setBusy(true)
    try {
      await patchCustomerBusinessOnboarding({
        legalName: legal,
        tradeName: businessTradeName.trim() || undefined,
      })
      setStep(5)
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const wideCard = step >= 5
  const kycLines = interestSummaryLines(interestSorted, bankCfg)

  return (
    <div className="bg-bw-sand-100 py-10 sm:py-14">
      <div
        className={`mx-auto px-4 ${wideCard ? 'max-w-2xl' : 'max-w-md'} w-full`}
      >
        <div className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-lg sm:p-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-bw-muted">
            Open an account online
          </p>
          <h1 className="mt-2 text-center font-display text-2xl font-semibold text-bw-navy-900">
            {bankCfg.bankNameShort}
          </h1>

          <div
            className="mt-6 flex items-center justify-center"
            role="list"
            aria-label="Application steps"
          >
            {progressTitles.map((label, i) => {
              const n = i + 1
              const active = displayStep === n
              const done = displayStep > n
              return (
                <Fragment key={label}>
                  <div
                    role="listitem"
                    className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  >
                    <span
                      className={[
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        done
                          ? 'bg-bw-blue-600 text-white'
                          : active
                            ? 'bg-bw-navy-900 text-white'
                            : 'bg-bw-sand-200 text-bw-muted',
                      ].join(' ')}
                      aria-current={active ? 'step' : undefined}
                    >
                      {done ? '✓' : n}
                    </span>
                    <span
                      className={[
                        'hidden text-center text-[10px] font-semibold uppercase leading-tight sm:block',
                        active ? 'text-bw-navy-900' : 'text-bw-muted',
                      ].join(' ')}
                    >
                      {label}
                    </span>
                  </div>
                  {i < progressTitles.length - 1 ? (
                    <div
                      aria-hidden
                      className={[
                        'mx-1 h-px w-6 shrink-0 sm:w-10',
                        displayStep > n ? 'bg-bw-blue-500' : 'bg-bw-sand-200',
                      ].join(' ')}
                    />
                  ) : null}
                </Fragment>
              )
            })}
          </div>

          {err ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-bw-red-600/30 bg-red-50 px-4 py-3 text-sm text-bw-red-800"
            >
              {err}
            </div>
          ) : null}

          {step === 1 ? (
            <>
              <p className="mt-6 text-center text-sm text-bw-muted">
                Start with the legal name on your ID and an email we can use for
                your account and sign-in.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => void goNextFromDetails(e)}
              >
                <div>
                  <label
                    className="block text-sm font-medium text-bw-navy-900"
                    htmlFor="oa-legal-name"
                  >
                    Full legal name
                  </label>
                  <input
                    id="oa-legal-name"
                    autoComplete="name"
                    required
                    className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="As shown on your government ID"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-bw-navy-900"
                    htmlFor="oa-email"
                  >
                    Email
                  </label>
                  <input
                    id="oa-email"
                    type="email"
                    autoComplete="email"
                    required
                    className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-bw-navy-900 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-bw-navy-800"
                >
                  Continue
                </button>
              </form>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="mt-6 text-center text-sm text-bw-muted">
                Tell us what you are looking to open. This drives disclosures and
                compliance routing. Most people finish this part in under a minute;
                identity review in this demo is usually same-day.
              </p>
              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => void goNextFromInterests(e)}
              >
                <fieldset>
                  <legend className="sr-only">Account interests</legend>
                  <ul className="space-y-3">
                    {(
                      [
                        {
                          slug: 'checking' as const,
                          title: bankCfg.products.checkingName,
                          hint: 'Debit card, direct deposit, everyday spending',
                        },
                        {
                          slug: 'savings' as const,
                          title: bankCfg.products.savingsName,
                          hint: 'Competitive yield on balances',
                        },
                        {
                          slug: 'investments' as const,
                          title: bankCfg.investBrandName,
                          hint: 'Brokerage and long-term investing',
                        },
                        {
                          slug: 'business' as const,
                          title: 'Commercial relationship',
                          hint: 'Adds a short business profile step before ID upload',
                        },
                        {
                          slug: 'not_sure' as const,
                          title: 'Still deciding',
                          hint: 'We will help you choose after signup',
                        },
                      ] as const
                    ).map(({ slug, title, hint }) => {
                      const checked = interests.includes(slug)
                      return (
                        <li key={slug}>
                          <label
                            className={[
                              'flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition',
                              checked
                                ? 'border-bw-navy-900 bg-bw-sky-100/60'
                                : 'border-bw-sand-200 hover:border-bw-sand-300',
                            ].join(' ')}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0 rounded border-bw-sand-300 text-bw-navy-900 focus:ring-bw-blue-500"
                              checked={checked}
                              onChange={() => {
                                setErr('')
                                setInterests((prev) =>
                                  toggleInterestSlug(prev, slug),
                                )
                              }}
                            />
                            <span>
                              <span className="block text-sm font-semibold text-bw-navy-900">
                                {title}
                              </span>
                              <span className="mt-0.5 block text-xs text-bw-muted">
                                {hint}
                              </span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </fieldset>
                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setErr('')
                      setStep(1)
                    }}
                    className="rounded-md border border-bw-sand-200 px-4 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-bw-navy-900 py-2.5 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-bw-navy-800 sm:ml-auto"
                  >
                    Continue
                  </button>
                </div>
              </form>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="mt-6 text-center text-sm text-bw-muted">
                Choose a password for {bankCfg.bankNameShort} online banking. You
                will use it with your email after your application is complete.
              </p>
              {interests.length > 0 ? (
                <div
                  className="mt-4 rounded-lg border border-bw-sand-200 bg-bw-sand-100/80 px-4 py-3 text-sm text-bw-navy-900"
                  role="status"
                >
                  <p className="font-semibold text-bw-navy-900">
                    You are applying for:
                  </p>
                  <ul className="mt-2 list-inside list-disc text-bw-muted">
                    {kycLines.map((line, i) => (
                      <li key={`${i}-${line}`} className="text-bw-navy-800">
                        {line}
                      </li>
                    ))}
                  </ul>
                  <ul className="mt-3 space-y-1 border-t border-bw-sand-200 pt-3 text-xs text-bw-muted">
                    <li>Requires government-issued ID verification</li>
                    <li>
                      You will have access to online banking while compliance
                      reviews your package
                    </li>
                  </ul>
                </div>
              ) : null}
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => void handleCreateAccount(e)}
              >
                <div>
                  <label
                    className="block text-sm font-medium text-bw-navy-900"
                    htmlFor="oa-pass"
                  >
                    Password
                  </label>
                  <input
                    id="oa-pass"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    disabled={busy}
                    className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:bg-bw-sand-100"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-bw-navy-900"
                    htmlFor="oa-confirm"
                  >
                    Confirm password
                  </label>
                  <input
                    id="oa-confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    disabled={busy}
                    className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:bg-bw-sand-100"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setErr('')
                      setStep(2)
                    }}
                    className="rounded-md border border-bw-sand-200 px-4 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-bw-red-700 py-2.5 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-bw-red-600 disabled:opacity-70 sm:ml-auto"
                  >
                    {busy ? 'Creating account…' : 'Create account & continue'}
                  </button>
                </div>
              </form>
            </>
          ) : null}

          {step === 4 && pathNeedsBusiness ? (
            <>
              <p className="mt-6 text-center text-sm text-bw-muted">
                Because you selected business banking, we capture the legal entity
                name now. Additional formation documents may be requested during
                review.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => void handleBusinessContinue(e)}
              >
                <div>
                  <label
                    className="block text-sm font-medium text-bw-navy-900"
                    htmlFor="oa-biz-legal"
                  >
                    Legal business name
                  </label>
                  <input
                    id="oa-biz-legal"
                    autoComplete="organization"
                    required
                    disabled={busy}
                    className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:bg-bw-sand-100"
                    value={businessLegalName}
                    onChange={(e) => setBusinessLegalName(e.target.value)}
                    placeholder="As registered with the state"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-bw-navy-900"
                    htmlFor="oa-biz-trade"
                  >
                    Trade name / DBA{' '}
                    <span className="font-normal text-bw-muted">(optional)</span>
                  </label>
                  <input
                    id="oa-biz-trade"
                    disabled={busy}
                    className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:bg-bw-sand-100"
                    value={businessTradeName}
                    onChange={(e) => setBusinessTradeName(e.target.value)}
                    placeholder="If customers know you by another name"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setErr('')
                      setStep(3)
                    }}
                    className="rounded-md border border-bw-sand-200 px-4 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-bw-navy-900 py-2.5 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-bw-navy-800 disabled:opacity-50 sm:ml-auto"
                  >
                    {busy ? 'Saving…' : 'Continue to identity verification'}
                  </button>
                </div>
              </form>
            </>
          ) : null}

          {step === 5 ? (
            <div className="mt-6 space-y-6">
              <p className="text-center text-sm text-bw-muted">
                Like most digital banks, we verify your identity as part of this
                application. Upload photos or PDFs of your ID (and optional proof
                of address). We will email you if the compliance team needs
                anything else; next you will land in online banking.
              </p>
              {kycLines.length > 0 ? (
                <div
                  className="rounded-lg border border-bw-sand-200 bg-bw-sand-100/80 px-4 py-3 text-sm"
                  role="status"
                >
                  <p className="font-semibold text-bw-navy-900">
                    Products you selected:
                  </p>
                  <ul className="mt-2 list-inside list-disc text-bw-navy-800">
                    {kycLines.map((line, i) => (
                      <li key={`${i}-${line}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <KycDocumentSlotsForm
                submitLabel="Submit documents & finish"
                heading="Identity documents"
                onSuccess={async () => {
                  clearOpenAccountKycPending()
                  setStep(6)
                }}
              />
            </div>
          ) : null}

          {step === 6 ? (
            <div className="mt-8 space-y-3 text-center">
              <p className="font-display text-xl font-semibold text-bw-navy-900">
                Welcome to {bankCfg.bankNameShort}
              </p>
              <p className="text-sm text-bw-muted">
                Your identity package is submitted. Your application is under
                review — you can use online banking while the team completes checks.
              </p>
            </div>
          ) : null}

          {step <= 3 ? (
            <p className="mt-6 text-center text-sm text-bw-muted">
              Already enrolled?{' '}
              <Link
                to="/sign-in"
                className="font-semibold text-bw-blue-600 hover:underline"
              >
                Sign in
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
