import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { apiResendLoginOtp } from '../lib/authApi'
import { useAuth } from '../contexts/AuthContext'
import { useBankConfig } from '../contexts/BankConfigContext'

function isOnlineBankingLockoutCopy(message: string): boolean {
  return message.includes(
    'You cannot use online banking due to suspicions of fraudulent activity',
  )
}

export function SignInPage() {
  const { isSignedIn, signIn, verifyLoginOtp, accessBlock } = useAuth()
  const bankCfg = useBankConfig()
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [step, setStep] = useState<'password' | 'mfa'>('password')
  const [loginChallengeId, setLoginChallengeId] = useState<string | null>(null)
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [otpResendsRemaining, setOtpResendsRemaining] = useState(3)
  const [resendBusy, setResendBusy] = useState(false)

  useEffect(() => {
    if (accessBlock?.error?.trim()) setErr(accessBlock.error.trim())
  }, [accessBlock])

  if (isSignedIn) return <Navigate to="/app" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      const res = await signIn(loginId.trim(), password)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      if (res.next === 'app') {
        navigate('/app', { replace: true })
        return
      }
      setLoginChallengeId(res.loginChallengeId)
      setMaskedEmail(res.maskedEmail)
      setOtpResendsRemaining(res.otpResendsRemaining)
      setShowPassword(false)
      setStep('mfa')
      setOtp('')
    } catch (cause) {
      const msg =
        cause instanceof Error ? cause.message : 'Sign-in failed unexpectedly.'
      setErr(
        msg.includes('timed out') || msg.includes('aborted')
          ? 'The server took too long to respond. Check your connection and try again.'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy || !loginChallengeId) return
    setErr('')
    setBusy(true)
    try {
      const res = await verifyLoginOtp(
        loginChallengeId,
        otp.replace(/\s+/g, ''),
      )
      if (!res.ok) {
        setErr(res.error)
        return
      }
      navigate('/app', { replace: true })
    } catch (cause) {
      const msg =
        cause instanceof Error ? cause.message : 'Verification failed unexpectedly.'
      setErr(
        msg.includes('timed out') || msg.includes('aborted')
          ? 'The server took too long to respond. Try again.'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleResendCode() {
    if (busy || resendBusy || !loginChallengeId) return
    if (otpResendsRemaining <= 0) {
      setErr(
        'Maximum resend attempts reached. Use “Use a different account” and sign in again.',
      )
      return
    }
    setErr('')
    setResendBusy(true)
    try {
      const res = await apiResendLoginOtp(loginChallengeId)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      setLoginChallengeId(res.loginChallengeId)
      setMaskedEmail(res.maskedEmail)
      setOtpResendsRemaining(res.otpResendsRemaining)
      setOtp('')
    } catch (cause) {
      setErr(
        cause instanceof Error ? cause.message : 'Could not resend the code.',
      )
    } finally {
      setResendBusy(false)
    }
  }

  function backToPassword() {
    setStep('password')
    setShowPassword(false)
    setLoginChallengeId(null)
    setMaskedEmail(null)
    setOtp('')
    setOtpResendsRemaining(3)
    setErr('')
  }

  return (
    <div className="bg-bw-sand-100 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-md px-4">
        <div className="relative overflow-hidden rounded-2xl border border-bw-sand-200 bg-white p-8 shadow-lg">
          <h1 className="text-center font-display text-2xl font-semibold text-bw-navy-900">
            Sign in
          </h1>
          <p className="mt-2 text-center text-sm text-bw-muted">
            {bankCfg.signInDisclaimer}
          </p>

          {err ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-bw-red-600/30 bg-red-50 px-4 py-3 text-sm text-bw-red-800"
            >
              {accessBlock || isOnlineBankingLockoutCopy(err) ? (
                <>
                  <p className="text-base font-extrabold tracking-tight text-bw-red-900">
                    Account Locked !!!!
                  </p>
                  <p className="mt-2 font-normal leading-relaxed">
                    {accessBlock?.error?.trim() || err}
                  </p>
                </>
              ) : (
                err
              )}
            </div>
          ) : null}

          {step === 'password' ? (
            <form className="mt-8 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
              <div>
                <label
                  className="block text-sm font-medium text-bw-navy-900"
                  htmlFor="signin-login-id"
                >
                  Internet Banking ID or email
                </label>
                <input
                  id="signin-login-id"
                  name="loginId"
                  type="text"
                  autoComplete="username"
                  required
                  disabled={busy}
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="10-digit ID or you@example.com"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-bw-navy-900"
                  htmlFor="signin-password"
                >
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="signin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    disabled={busy}
                    className="w-full rounded-md border border-bw-sand-200 py-2.5 pl-3 pr-11 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-bw-muted outline-none ring-bw-blue-500/40 hover:bg-bw-sand-50 hover:text-bw-navy-800 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-bw-red-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-bw-red-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={(e) => void handleOtpSubmit(e)}>
              <p className="text-sm text-bw-muted">
                Enter the 6-digit code sent to{' '}
                <span className="font-medium text-bw-navy-900">
                  {maskedEmail ?? 'your email'}
                </span>
                .
              </p>
              <div>
                <label
                  className="block text-sm font-medium text-bw-navy-900"
                  htmlFor="signin-otp"
                >
                  Verification code
                </label>
                <input
                  id="signin-otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  disabled={busy}
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm tracking-widest outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  aria-describedby="signin-otp-hint"
                />
                <p id="signin-otp-hint" className="mt-1 text-xs text-bw-muted">
                  Codes expire after 10 minutes.
                  {otpResendsRemaining > 0 ? (
                    <>
                      {' '}
                      Resends left this sign-in:{' '}
                      <span className="font-semibold text-bw-navy-900">
                        {otpResendsRemaining}
                      </span>{' '}
                      (max 3).
                    </>
                  ) : (
                    <>
                      {' '}
                      No resends left — use “Use a different account” and sign
                      in again for a fresh code.
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={
                  busy ||
                  resendBusy ||
                  otpResendsRemaining <= 0 ||
                  !loginChallengeId
                }
                aria-label="Resend verification code"
                onClick={() => void handleResendCode()}
                className="w-full rounded-md border border-bw-sand-200 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {resendBusy
                  ? 'Sending…'
                  : otpResendsRemaining <= 0
                    ? 'No resends left'
                    : `Resend code (${otpResendsRemaining} left)`}
              </button>
              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="w-full rounded-md bg-bw-red-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-bw-red-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? 'Verifying…' : 'Verify and sign in'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => backToPassword()}
                className="w-full rounded-md border border-bw-sand-200 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Use a different account
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-bw-muted">
            New to {bankCfg.bankNameShort}?{' '}
            <Link
              to="/sign-up"
              className="font-semibold text-bw-blue-600 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
