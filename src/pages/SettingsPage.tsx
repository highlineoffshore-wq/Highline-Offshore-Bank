import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
function digitsOnly6(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6)
}

const NOTIF_STORAGE = 'online-bank-settings-notif'

type NotifPrefs = {
  transactionEmail: boolean
  marketingEmail: boolean
  pushAlerts: boolean
  paperless: boolean
}

const NOTIF_DEFAULTS: NotifPrefs = {
  transactionEmail: true,
  marketingEmail: false,
  pushAlerts: true,
  paperless: true,
}

function loadNotif(): NotifPrefs {
  try {
    const raw = sessionStorage.getItem(NOTIF_STORAGE)
    if (!raw) return NOTIF_DEFAULTS
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>
    return { ...NOTIF_DEFAULTS, ...parsed }
  } catch {
    return NOTIF_DEFAULTS
  }
}

function saveNotif(prefs: NotifPrefs) {
  try {
    sessionStorage.setItem(NOTIF_STORAGE, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

function Switch({
  checked,
  onChange,
  id,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  id: string
  label: string
  description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-bw-sand-100 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium text-bw-navy-900" id={`${id}-label`}>
          {label}
        </p>
        {description ? (
          <p className="mt-0.5 text-sm text-bw-muted">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={[
          'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue-500 focus-visible:ring-offset-2',
          checked ? 'bg-bw-blue-600' : 'bg-bw-sand-200',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
          aria-hidden
        />
      </button>
    </div>
  )
}

function normEmail(s: string): string {
  return s.trim().toLowerCase()
}

export function SettingsPage() {
  const {
    displayName,
    updateProfile,
    startEmailChange,
    confirmEmailChange,
    user,
    updateEmailOtp,
    changePassword,
    updateTransactionPin,
  } = useAuth()
  const [nameDraft, setNameDraft] = useState(displayName)
  const [emailDraft, setEmailDraft] = useState(user?.email ?? '')
  const [profilePassword, setProfilePassword] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileErr, setProfileErr] = useState('')
  const [emailVerificationPending, setEmailVerificationPending] =
    useState(false)
  const [emailChangeChallengeId, setEmailChangeChallengeId] = useState('')
  const [emailMaskedDestination, setEmailMaskedDestination] = useState<
    string | null
  >(null)
  const [emailConfirmCode, setEmailConfirmCode] = useState('')
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmErr, setConfirmErr] = useState('')
  const [notif, setNotif] = useState<NotifPrefs>(loadNotif)
  const [emailOtpDialog, setEmailOtpDialog] = useState<'on' | 'off' | null>(
    null,
  )
  const [emailOtpPassword, setEmailOtpPassword] = useState('')
  const [emailOtpBusy, setEmailOtpBusy] = useState(false)
  const [emailOtpErr, setEmailOtpErr] = useState('')
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const [pwOk, setPwOk] = useState(false)
  const [sessionsHint, setSessionsHint] = useState(false)

  const [txPinPassword, setTxPinPassword] = useState('')
  const [txPinNew, setTxPinNew] = useState('')
  const [txPinConfirm, setTxPinConfirm] = useState('')
  const [txPinBusy, setTxPinBusy] = useState(false)
  const [txPinErr, setTxPinErr] = useState('')
  const [txPinOk, setTxPinOk] = useState(false)

  useEffect(() => {
    setNameDraft(displayName)
  }, [displayName])

  useEffect(() => {
    setEmailDraft(user?.email ?? '')
  }, [user?.email])

  const emailChanging =
    normEmail(emailDraft) !== normEmail(user?.email ?? '')

  function cancelEmailVerification() {
    setEmailVerificationPending(false)
    setEmailChangeChallengeId('')
    setEmailMaskedDestination(null)
    setEmailConfirmCode('')
    setConfirmErr('')
    setEmailDraft(user?.email ?? '')
  }

  async function handleConfirmEmailVerification(e: FormEvent) {
    e.preventDefault()
    setConfirmErr('')
    const code = digitsOnly6(emailConfirmCode)
    if (code.length !== 6) {
      setConfirmErr('Enter the 6-digit code from your email.')
      return
    }
    if (!emailChangeChallengeId) {
      setConfirmErr('Verification session expired. Cancel and try again.')
      return
    }
    setConfirmBusy(true)
    try {
      await confirmEmailChange(emailChangeChallengeId, code)
      setEmailVerificationPending(false)
      setEmailChangeChallengeId('')
      setEmailMaskedDestination(null)
      setEmailConfirmCode('')
      setProfileSaved(true)
      window.setTimeout(() => setProfileSaved(false), 4500)
    } catch (err) {
      setConfirmErr(
        err instanceof Error ? err.message : 'Verification failed.',
      )
    } finally {
      setConfirmBusy(false)
    }
  }

  const patchNotif = useCallback((patch: Partial<NotifPrefs>) => {
    setNotif((prev) => {
      const next = { ...prev, ...patch }
      saveNotif(next)
      return next
    })
  }, [])

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault()
    if (emailVerificationPending) return
    setProfileErr('')
    const nextName = nameDraft.trim() || displayName
    const nextEmail = emailDraft.trim()
    if (emailChanging) {
      if (!profilePassword.trim()) {
        setProfileErr(
          'Enter your current password to change your email address.',
        )
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(nextEmail))) {
        setProfileErr('Enter a valid email address.')
        return
      }
    }
    setProfileBusy(true)
    try {
      await updateProfile({ displayName: nextName })
      if (emailChanging) {
        const res = await startEmailChange(nextEmail, profilePassword)
        setEmailChangeChallengeId(res.emailChangeChallengeId)
        setEmailMaskedDestination(res.maskedEmail)
        setEmailVerificationPending(true)
        setProfilePassword('')
        setEmailConfirmCode('')
        setConfirmErr('')
        return
      }
      setProfileSaved(true)
      window.setTimeout(() => setProfileSaved(false), 3500)
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setProfileBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-bw-navy-900">
          Settings
        </h1>
        <p className="mt-1 text-bw-muted">
          Manage how your name appears, alerts, and security preferences. Profile
          changes sync to your account on the application server.
        </p>
      </div>

      <section className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-bw-navy-900">
          Profile
        </h2>
        <p className="mt-1 text-sm text-bw-muted">
          Your display name and the email you use to sign in. To change email,
          we send a one-time code to the <strong>new</strong> address after you
          confirm your password (code expires in 10 minutes).
        </p>
        <form
          className="mt-6 max-w-md space-y-4"
          onSubmit={(e) => void handleProfileSubmit(e)}
        >
          {profileErr ? (
            <div
              role="alert"
              className="rounded-lg border border-bw-red-600/30 bg-red-50 px-4 py-3 text-sm text-bw-red-800"
            >
              {profileErr}
            </div>
          ) : null}
          {emailVerificationPending ? (
            <div
              className="rounded-lg border border-bw-blue-200 bg-bw-sky-50/80 px-4 py-3 text-sm text-bw-navy-900"
              role="status"
            >
              <p className="font-medium">Check your new inbox</p>
              <p className="mt-1 text-bw-muted">
                We sent a 6-digit code to{' '}
                <span className="font-medium text-bw-navy-900">
                  {emailMaskedDestination ?? 'that address'}
                </span>
                . Enter it below to finish updating your email.
              </p>
            </div>
          ) : null}
          <div>
            <label
              className="block text-sm font-medium text-bw-navy-900"
              htmlFor="settings-display-name"
            >
              Display name
            </label>
            <input
              id="settings-display-name"
              name="displayName"
              autoComplete="name"
              disabled={emailVerificationPending}
              className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="e.g. Jordan"
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium text-bw-navy-900"
              htmlFor="settings-email"
            >
              Email address
            </label>
            <input
              id="settings-email"
              name="email"
              type="email"
              autoComplete="email"
              disabled={emailVerificationPending}
              className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {emailChanging && !emailVerificationPending ? (
            <div>
              <label
                className="block text-sm font-medium text-bw-navy-900"
                htmlFor="settings-profile-password"
              >
                Current password (required to start email change)
              </label>
              <input
                id="settings-profile-password"
                name="profilePassword"
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                value={profilePassword}
                onChange={(e) => setProfilePassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={profileBusy || emailVerificationPending}
              className="rounded-md bg-bw-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profileBusy
                ? 'Saving…'
                : emailChanging && !emailVerificationPending
                  ? 'Save & send verification code'
                  : 'Save profile'}
            </button>
            {emailVerificationPending ? (
              <button
                type="button"
                onClick={() => cancelEmailVerification()}
                className="rounded-md border border-bw-sand-200 px-4 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
              >
                Cancel email change
              </button>
            ) : null}
            {profileSaved ? (
              <span className="text-sm font-medium text-bw-blue-600">
                Profile updated.
              </span>
            ) : null}
          </div>
        </form>
        {emailVerificationPending ? (
          <form
            className="mt-6 max-w-md space-y-4 rounded-lg border border-bw-sand-200 bg-bw-sand-50/60 p-4"
            onSubmit={(e) => void handleConfirmEmailVerification(e)}
          >
            <h3 className="text-sm font-semibold text-bw-navy-900">
              Verify new email
            </h3>
            {confirmErr ? (
              <p className="text-sm text-bw-red-800" role="alert">
                {confirmErr}
              </p>
            ) : null}
            <div>
              <label
                className="block text-sm font-medium text-bw-navy-900"
                htmlFor="settings-email-otp"
              >
                6-digit code
              </label>
              <input
                id="settings-email-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 font-mono text-lg tracking-widest outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2"
                maxLength={6}
                value={emailConfirmCode}
                onChange={(e) =>
                  setEmailConfirmCode(digitsOnly6(e.target.value))
                }
                placeholder="000000"
              />
            </div>
            <button
              type="submit"
              disabled={confirmBusy || emailConfirmCode.length !== 6}
              className="rounded-md bg-bw-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmBusy ? 'Verifying…' : 'Confirm new email'}
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-bw-navy-900">
          Internet Banking ID
        </h2>
        <p className="mt-1 text-sm text-bw-muted">
          Use this 10-digit ID or your email address when you sign in. Keep it
          somewhere safe; it is not a secret like your password.
        </p>
        <div className="mt-4 rounded-lg border border-bw-sand-200 bg-bw-sand-100/40 px-4 py-3">
          {user?.internetBankingId ? (
            <p className="font-mono text-lg font-semibold tracking-widest text-bw-navy-900">
              {user.internetBankingId}
            </p>
          ) : (
            <p className="text-sm text-bw-muted">
              Your ID will appear here after you refresh the page or sign in
              again.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-bw-navy-900">
          Notifications
        </h2>
        <p className="mt-1 text-sm text-bw-muted">
          Preferences are saved in session storage for this browser tab session.
        </p>
        <div className="mt-2">
          <Switch
            id="notif-transactions"
            label="Transaction and balance alerts"
            description="Email when deposits, withdrawals, or low balance thresholds occur."
            checked={notif.transactionEmail}
            onChange={(v) => patchNotif({ transactionEmail: v })}
          />
          <Switch
            id="notif-push"
            label="Push notifications"
            description="Mobile alerts for payments and sign-in activity."
            checked={notif.pushAlerts}
            onChange={(v) => patchNotif({ pushAlerts: v })}
          />
          <Switch
            id="notif-marketing"
            label="Product updates and offers"
            description="Occasional messages about new features and rates."
            checked={notif.marketingEmail}
            onChange={(v) => patchNotif({ marketingEmail: v })}
          />
          <Switch
            id="notif-paperless"
            label="Paperless statements"
            description="Deliver statements and tax forms electronically instead of mail."
            checked={notif.paperless}
            onChange={(v) => patchNotif({ paperless: v })}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-bw-sand-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-bw-navy-900">
          Security
        </h2>
        <p className="mt-1 text-sm text-bw-muted">
          In production you would verify identity before changing passwords or
          signing out other devices.
        </p>

        <div className="mt-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-bw-navy-900">Password</p>
              <p className="text-sm text-bw-muted">
                Change the password you use to sign in online. Use at least 8
                characters.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (passwordPanelOpen) {
                  setPwCurrent('')
                  setPwNew('')
                  setPwConfirm('')
                }
                setPasswordPanelOpen((x) => !x)
                setPwErr('')
                setPwOk(false)
              }}
              className="shrink-0 rounded-md border border-bw-sand-200 px-4 py-2 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
            >
              {passwordPanelOpen ? 'Close' : 'Change password'}
            </button>
          </div>
          {passwordPanelOpen ? (
            <form
              className="mt-2 max-w-md space-y-4 rounded-lg border border-bw-sand-200 bg-bw-sand-50 p-4"
              onSubmit={(e) => {
                e.preventDefault()
                setPwErr('')
                setPwOk(false)
                if (!pwCurrent.trim()) {
                  setPwErr('Enter your current password.')
                  return
                }
                if (pwNew.length < 8) {
                  setPwErr('New password must be at least 8 characters.')
                  return
                }
                if (pwNew.length > 256) {
                  setPwErr('New password is too long.')
                  return
                }
                if (pwNew !== pwConfirm) {
                  setPwErr('New password and confirmation do not match.')
                  return
                }
                if (pwNew === pwCurrent) {
                  setPwErr('New password must be different from your current password.')
                  return
                }
                setPwBusy(true)
                void (async () => {
                  try {
                    await changePassword(pwCurrent, pwNew)
                    setPwCurrent('')
                    setPwNew('')
                    setPwConfirm('')
                    setPwOk(true)
                    setPasswordPanelOpen(false)
                    window.setTimeout(() => setPwOk(false), 5000)
                  } catch (err) {
                    setPwErr(
                      err instanceof Error ? err.message : 'Update failed.',
                    )
                  } finally {
                    setPwBusy(false)
                  }
                })()
              }}
            >
              {pwErr ? (
                <p className="text-sm text-bw-red-800" role="alert">
                  {pwErr}
                </p>
              ) : null}
              <div>
                <label
                  className="block text-sm font-medium text-bw-navy-900"
                  htmlFor="settings-pw-current"
                >
                  Current password
                </label>
                <input
                  id="settings-pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  disabled={pwBusy}
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-bw-navy-900"
                  htmlFor="settings-pw-new"
                >
                  New password
                </label>
                <input
                  id="settings-pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  disabled={pwBusy}
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-bw-navy-900"
                  htmlFor="settings-pw-confirm"
                >
                  Confirm new password
                </label>
                <input
                  id="settings-pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  disabled={pwBusy}
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={
                    pwBusy ||
                    !pwCurrent.trim() ||
                    pwNew.length < 8 ||
                    !pwConfirm
                  }
                  className="rounded-md bg-bw-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pwBusy ? 'Saving…' : 'Save new password'}
                </button>
              </div>
            </form>
          ) : null}
          {pwOk ? (
            <p
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
              role="status"
            >
              Password updated. Use your new password the next time you sign in.
            </p>
          ) : null}

          <Switch
            id="security-2fa"
            label="Email sign-in verification"
            description="After your password, we email a 6-digit code. SMTP must be configured on the server (operator console → Settings → Email delivery)."
            checked={Boolean(user?.emailOtpEnabled)}
            onChange={(v) => {
              setEmailOtpErr('')
              setEmailOtpPassword('')
              setEmailOtpDialog(v ? 'on' : 'off')
            }}
          />
          {emailOtpDialog ? (
            <div className="rounded-lg border border-bw-sand-200 bg-bw-sand-50 p-4">
              <p className="text-sm text-bw-navy-900">
                {emailOtpDialog === 'on'
                  ? 'Enter your current password to turn on email verification at sign-in.'
                  : 'Enter your current password to turn off email verification.'}
              </p>
              {emailOtpErr ? (
                <p className="mt-2 text-sm text-bw-red-800" role="alert">
                  {emailOtpErr}
                </p>
              ) : null}
              <label
                className="mt-3 block text-sm font-medium text-bw-navy-900"
                htmlFor="email-otp-pw"
              >
                Current password
              </label>
              <input
                id="email-otp-pw"
                type="password"
                autoComplete="current-password"
                value={emailOtpPassword}
                onChange={(e) => setEmailOtpPassword(e.target.value)}
                disabled={emailOtpBusy}
                className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={emailOtpBusy || !emailOtpPassword}
                  onClick={() => {
                    void (async () => {
                      setEmailOtpBusy(true)
                      setEmailOtpErr('')
                      try {
                        await updateEmailOtp(
                          emailOtpDialog === 'on',
                          emailOtpPassword,
                        )
                        setEmailOtpDialog(null)
                        setEmailOtpPassword('')
                      } catch (e) {
                        setEmailOtpErr(
                          e instanceof Error ? e.message : 'Update failed.',
                        )
                      } finally {
                        setEmailOtpBusy(false)
                      }
                    })()
                  }}
                  className="rounded-md bg-bw-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {emailOtpBusy ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  disabled={emailOtpBusy}
                  onClick={() => {
                    setEmailOtpDialog(null)
                    setEmailOtpPassword('')
                    setEmailOtpErr('')
                  }}
                  className="rounded-md border border-bw-sand-200 px-4 py-2.5 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-bw-sand-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-bw-navy-900">
                Sign out other sessions
              </p>
              <p className="text-sm text-bw-muted">
                End active sessions on other browsers or devices.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSessionsHint(true)
                window.setTimeout(() => setSessionsHint(false), 4000)
              }}
              className="shrink-0 rounded-md border border-bw-sand-200 px-4 py-2 text-sm font-semibold text-bw-navy-900 hover:bg-bw-sand-100"
            >
              Sign out everywhere else
            </button>
          </div>
          {sessionsHint ? (
            <p className="rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-4 py-3 text-sm text-bw-navy-900">
              Other sessions would be ended. Device-level session management is
              available in the full security center.
            </p>
          ) : null}

          <div className="border-t border-bw-sand-100 pt-6">
            <p className="font-medium text-bw-navy-900">Transaction PIN</p>
            <p className="mt-1 text-sm text-bw-muted">
              Six digits used to authorize transfers, bill pay, wires, and other
              payment requests after you sign in. This is separate from your
              password.
            </p>
            {user?.hasTransactionPin ? (
              <p className="mt-2 text-sm font-medium text-emerald-800">
                A transaction PIN is on your account. You can replace it below.
              </p>
            ) : (
              <p className="mt-2 text-sm text-bw-muted">
                You have not set a transaction PIN yet. Set one to require it on
                payment requests.
              </p>
            )}
            {txPinErr ? (
              <p className="mt-3 text-sm text-bw-red-800" role="alert">
                {txPinErr}
              </p>
            ) : null}
            {txPinOk ? (
              <p className="mt-3 text-sm font-medium text-emerald-700">
                Transaction PIN saved.
              </p>
            ) : null}
            <form
              className="mt-4 grid max-w-md gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                setTxPinErr('')
                setTxPinOk(false)
                const p1 = digitsOnly6(txPinNew)
                const p2 = digitsOnly6(txPinConfirm)
                if (!txPinPassword.trim()) {
                  setTxPinErr('Enter your current password.')
                  return
                }
                if (p1.length !== 6) {
                  setTxPinErr('New PIN must be exactly 6 digits.')
                  return
                }
                if (p1 !== p2) {
                  setTxPinErr('New PIN and confirmation do not match.')
                  return
                }
                setTxPinBusy(true)
                void (async () => {
                  try {
                    await updateTransactionPin(txPinPassword, p1)
                    setTxPinPassword('')
                    setTxPinNew('')
                    setTxPinConfirm('')
                    setTxPinOk(true)
                    window.setTimeout(() => setTxPinOk(false), 4000)
                  } catch (err) {
                    setTxPinErr(
                      err instanceof Error ? err.message : 'Update failed.',
                    )
                  } finally {
                    setTxPinBusy(false)
                  }
                })()
              }}
            >
              <div>
                <label
                  className="block text-sm font-medium text-bw-navy-900"
                  htmlFor="tx-pin-password"
                >
                  Current password
                </label>
                <input
                  id="tx-pin-password"
                  type="password"
                  autoComplete="current-password"
                  disabled={txPinBusy}
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
                  value={txPinPassword}
                  onChange={(e) => setTxPinPassword(e.target.value)}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-bw-navy-900"
                  htmlFor="tx-pin-new"
                >
                  New 6-digit PIN
                </label>
                <input
                  id="tx-pin-new"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  pattern="[0-9]*"
                  disabled={txPinBusy}
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm tracking-widest outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
                  value={txPinNew}
                  onChange={(e) =>
                    setTxPinNew(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-bw-navy-900"
                  htmlFor="tx-pin-confirm"
                >
                  Confirm new PIN
                </label>
                <input
                  id="tx-pin-confirm"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  disabled={txPinBusy}
                  className="mt-1 w-full rounded-md border border-bw-sand-200 px-3 py-2.5 text-sm tracking-widest outline-none ring-bw-blue-500/40 focus:border-bw-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-sand-100"
                  value={txPinConfirm}
                  onChange={(e) =>
                    setTxPinConfirm(
                      e.target.value.replace(/\D/g, '').slice(0, 6),
                    )
                  }
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={txPinBusy}
                className="rounded-md bg-bw-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bw-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {txPinBusy ? 'Saving…' : 'Save transaction PIN'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
