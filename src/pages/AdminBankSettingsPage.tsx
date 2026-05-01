import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AdminBankDepositsFeesPanel } from '../components/admin/AdminBankDepositsFeesPanel'
import { AdminConsoleShell } from '../components/admin/AdminConsoleShell'
import { ADMIN_CONSOLE_SIDEBAR_LEFT_CLASS } from '../components/admin/adminSidebarNav'
import type { BankConfig } from '../types/bankConfig'
import { getApiBase } from '../lib/apiBase'
import {
  fetchAdminBankConfig,
  fetchAdminSmtpSettings,
  getAdminToken,
  postAdminBankLogo,
  postAdminHomeHeroImage,
  previewAdminEmailLetter,
  saveAdminBankConfig,
  saveAdminSmtpSettings,
  type EmailLetterPreviewType,
} from '../lib/adminApi'
import { fetchNotifyHealth, sendNotifyTestEmail } from '../lib/notifyApi'

const SECTION_NAV = [
  { id: 'section-smtp', label: 'Email delivery (SMTP)', step: '01' },
  { id: 'section-brand', label: 'Brand & marketing', step: '02' },
  { id: 'section-support', label: 'Support & chat', step: '03' },
  { id: 'section-products', label: 'Product labels', step: '04' },
  { id: 'section-fees', label: 'Deposits & fees', step: '05' },
  { id: 'section-theme', label: 'Theme colors', step: '06' },
  { id: 'section-email-letters', label: 'Email letters', step: '07' },
  { id: 'section-legal', label: 'Legal copy', step: '08' },
] as const

const THEME_KEYS = [
  ['navy950', 'Navy 950'],
  ['navy900', 'Navy 900'],
  ['navy800', 'Navy 800'],
  ['blue600', 'Blue 600'],
  ['blue500', 'Blue 500'],
  ['sky100', 'Sky 100'],
  ['red800', 'Red 800'],
  ['red700', 'Red 700'],
  ['red600', 'Red 600'],
  ['sand100', 'Sand 100'],
  ['sand200', 'Sand 200'],
  ['muted', 'Muted text'],
] as const

const PRODUCT_FIELD_COUNT = 8
const CONFIG_SECTION_COUNT = SECTION_NAV.length
const THEME_TOKEN_COUNT = THEME_KEYS.length

const lbl =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500'
const inp =
  'mt-1.5 w-full rounded-lg border border-bw-sand-200 bg-white px-3.5 py-2.5 text-sm text-bw-navy-950 shadow-inner shadow-stone-900/5 outline-none transition placeholder:text-bw-muted focus:border-bw-blue-600/55 focus:ring-2 focus:ring-bw-blue-600/20'

function bankMediaPreviewUrl(src: string): string {
  const s = src.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('/api/')) {
    const base = getApiBase().replace(/\/$/, '')
    return `${base}${s}`
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${s.startsWith('/') ? s : `/${s}`}`
  }
  return s
}

function IconEnvelope({ className = 'h-6 w-6' }: { className?: string }) {
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
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  )
}

function IconBuilding({ className = 'h-6 w-6' }: { className?: string }) {
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
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5 0V9M9 9v.008M9 12v.008M9 15v.008M9 18v.008M15 9v.008M15 12v.008M15 15v.008M15 18v.008M9 6.75h4.5v4.5H9V6.75z"
      />
    </svg>
  )
}

function IconChat({ className = 'h-6 w-6' }: { className?: string }) {
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
        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a48.109 48.109 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  )
}

function IconCube({ className = 'h-6 w-6' }: { className?: string }) {
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
        d="M21 7.5V18M12 3L3 7.5M12 3l9 4.5M3 7.5L12 12m-9-4.5V18l9 4.5M12 12l9-4.5M12 12v9m0-9L3 7.5M12 21l9-4.5"
      />
    </svg>
  )
}

function IconPalette({ className = 'h-6 w-6' }: { className?: string }) {
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
        d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 4.125V17.25a3.75 3.75 0 01-3.75 3.75H6.75z"
      />
    </svg>
  )
}

function IconScale({ className = 'h-6 w-6' }: { className?: string }) {
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
        d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.588 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"
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

function ConfigOverview({
  bankName,
  onCopyPath,
  copiedKey,
}: {
  bankName: string
  onCopyPath: (path: string, key: string) => void
  copiedKey: string | null
}) {
  const paths = [
    { key: 'live', label: 'Active config', path: 'server/data/bank-config.json' },
    {
      key: 'smtp',
      label: 'SMTP settings',
      path: 'server/data/smtp-settings.json',
    },
    {
      key: 'defaults',
      label: 'Canonical defaults',
      path: 'src/data/bank.defaults.json',
    },
  ] as const

  const kpi = [
    {
      label: 'Configuration areas',
      value: String(CONFIG_SECTION_COUNT),
      hint: 'Major sections on this page',
    },
    {
      label: 'Theme tokens',
      value: String(THEME_TOKEN_COUNT),
      hint: 'Mapped to Tailwind / CSS vars',
    },
    {
      label: 'Product fields',
      value: String(PRODUCT_FIELD_COUNT),
      hint: 'Accounts & fund display names',
    },
    {
      label: 'Wire fee inputs',
      value: '5',
      hint: 'Domestic, intl., COT, IMF, FX ref',
    },
  ] as const

  return (
    <div className="mb-10 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpi.map((row) => (
          <div
            key={row.label}
            className="rounded-xl border border-bw-sand-200 bg-white/85 px-4 py-4 shadow-inner shadow-stone-900/10"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {row.label}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-bw-navy-950">
              {row.value}
            </p>
            <p className="mt-1 text-xs leading-snug text-slate-500">{row.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-bw-sand-200 bg-white/90 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-bw-navy-950">Persistence targets</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Copy paths into runbooks or tickets. Live values are written to the
            first file on save.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {paths.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onCopyPath(p.path, p.key)}
              className="inline-flex items-center justify-center rounded-lg border border-bw-sand-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-bw-blue-600/35 hover:bg-bw-sand-200 hover:text-bw-navy-950"
            >
              {copiedKey === p.key ? (
                <span className="text-bw-sky-100">Copied</span>
              ) : (
                <>
                  Copy <span className="mx-1 text-slate-500">·</span> {p.label}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-bw-sand-200 bg-white/80 px-4 py-3 text-xs text-slate-500">
        Active institution:{' '}
        <span className="font-semibold text-slate-200">{bankName}</span>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-24 rounded-xl bg-white" />
      <div className="h-72 rounded-xl bg-white" />
      <div className="h-56 rounded-xl bg-white" />
    </div>
  )
}

export function AdminBankSettingsPage() {
  const location = useLocation()
  const [draft, setDraft] = useState<BankConfig | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>(
    SECTION_NAV[0].id,
  )

  const [mailHealth, setMailHealth] = useState<{
    ready: boolean
    fromPreview: string | null
    senderName?: string | null
    hint: string | null
  } | null>(null)
  const [mailHealthLoading, setMailHealthLoading] = useState(true)
  const [mailHealthErr, setMailHealthErr] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testBusy, setTestBusy] = useState(false)
  const [testFeedback, setTestFeedback] = useState<{
    type: 'ok' | 'err'
    text: string
  } | null>(null)
  const [heroUploadBusy, setHeroUploadBusy] = useState(false)
  const [heroUploadErr, setHeroUploadErr] = useState('')
  const [heroPreviewKey, setHeroPreviewKey] = useState(0)
  const [logoUploadBusy, setLogoUploadBusy] = useState(false)
  const [logoUploadErr, setLogoUploadErr] = useState('')
  const [logoPreviewKey, setLogoPreviewKey] = useState(0)

  const [smtpLoading, setSmtpLoading] = useState(true)
  const [smtpLoadErr, setSmtpLoadErr] = useState('')
  const [smtpSaveBusy, setSmtpSaveBusy] = useState(false)
  const [smtpSaveErr, setSmtpSaveErr] = useState('')
  const [smtpSaveOk, setSmtpSaveOk] = useState(false)
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false)
  const [smtpPass, setSmtpPass] = useState('')
  const [smtpPassTouched, setSmtpPassTouched] = useState(false)
  const [letterPreviewOpen, setLetterPreviewOpen] = useState(false)
  const [letterPreviewType, setLetterPreviewType] =
    useState<EmailLetterPreviewType | null>(null)
  const [letterPreviewSubject, setLetterPreviewSubject] = useState('')
  const [letterPreviewHtml, setLetterPreviewHtml] = useState('')
  const [letterPreviewText, setLetterPreviewText] = useState('')
  const [letterPreviewBusy, setLetterPreviewBusy] = useState(false)
  const [letterPreviewErr, setLetterPreviewErr] = useState<string | null>(null)
  const [smtpForm, setSmtpForm] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    fromName: '',
    fromEmail: '',
  })

  const refreshMailHealth = useCallback(() => {
    setMailHealthLoading(true)
    setMailHealthErr(null)
    fetchNotifyHealth()
      .then((r) => setMailHealth(r.mail))
      .catch(() => {
        setMailHealth(null)
        setMailHealthErr(
          'Could not reach the API. Ensure the server is running and the Vite proxy reaches the same port as NOTIFY_PORT in server/.env.',
        )
      })
      .finally(() => setMailHealthLoading(false))
  }, [])

  const copyFeedback = useCallback((text: string, key: string) => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedKey(key)
        window.setTimeout(() => setCopiedKey(null), 2000)
      } catch {
        setCopiedKey('!')
        window.setTimeout(() => setCopiedKey(null), 2000)
      }
    })()
  }, [])

  useEffect(() => {
    if (!getAdminToken()) return
    ;(async () => {
      try {
        const cfg = await fetchAdminBankConfig()
        setDraft(cfg)
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Load failed.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!getAdminToken()) return
    refreshMailHealth()
  }, [refreshMailHealth])

  const loadSmtpForm = useCallback(() => {
    setSmtpLoading(true)
    setSmtpLoadErr('')
    fetchAdminSmtpSettings()
      .then((s) => {
        setSmtpForm({
          host: s.host,
          port: s.port,
          secure: s.secure,
          user: s.user,
          fromName: s.fromName,
          fromEmail: s.fromEmail,
        })
        setSmtpPasswordSet(s.passwordSet)
        setSmtpPass('')
        setSmtpPassTouched(false)
      })
      .catch((e) => {
        setSmtpLoadErr(e instanceof Error ? e.message : 'Could not load SMTP.')
      })
      .finally(() => setSmtpLoading(false))
  }, [])

  useEffect(() => {
    if (!getAdminToken()) return
    loadSmtpForm()
  }, [loadSmtpForm])

  const openLetterPreview = useCallback(
    async (type: EmailLetterPreviewType) => {
      if (!draft) return
      setLetterPreviewBusy(true)
      setLetterPreviewErr(null)
      try {
        const r = await previewAdminEmailLetter(type, draft)
        setLetterPreviewSubject(r.subject)
        setLetterPreviewHtml(r.html)
        setLetterPreviewText(r.text)
        setLetterPreviewType(type)
        setLetterPreviewOpen(true)
      } catch (e) {
        setLetterPreviewErr(
          e instanceof Error ? e.message : 'Could not render preview.',
        )
      } finally {
        setLetterPreviewBusy(false)
      }
    },
    [draft],
  )

  useEffect(() => {
    if (!draft) return
    const ids = SECTION_NAV.map((s) => s.id)
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id)
        }
      },
      { rootMargin: '-12% 0px -55% 0px', threshold: [0, 0.1, 0.25, 0.5, 1] },
    )

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [draft])

  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    if (!hash) return
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    return () => window.clearTimeout(t)
  }, [loading, draft, location.hash, location.pathname])

  if (!getAdminToken()) {
    return <Navigate to="/admin/login" replace />
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    setSaveErr('')
    setSaveOk(false)
    try {
      const next = await saveAdminBankConfig(draft)
      setDraft(next)
      setSaveOk(true)
      window.setTimeout(() => setSaveOk(false), 5000)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed.')
    }
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const letterPreviewTitles: Record<EmailLetterPreviewType, string> = {
    otp: 'Sign-in verification (OTP)',
    email_change: 'Email address change (OTP)',
    wire_transfer: 'Wire transfer authorization (OTP)',
    kyc: 'KYC operator notification',
    test: 'SMTP test email',
  }

  const headerAside = draft ? (
    <span className="inline-flex items-center rounded-full border border-bw-sand-200 bg-bw-sky-100 px-3 py-1.5 text-xs font-medium text-bw-navy-900">
      <span
        className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bw-blue-500 shadow-[0_0_8px_rgba(99,102,241,0.65)]"
        aria-hidden
      />
      Save, then refresh the public site to preview
    </span>
  ) : null

  return (
    <AdminConsoleShell
      title="Bank settings"
      breadcrumb="Configuration"
      subtitle={
        draft ? (
          <>
            Editing <span className="font-semibold text-slate-200">{draft.bankName}</span>
            . Save to write <span className="font-mono text-slate-400">server/data/bank-config.json</span>
            , then refresh the public site to preview. SMTP for OTP and mail lives in{' '}
            <span className="font-mono text-slate-400">server/.env</span> (see Email delivery below).
          </>
        ) : (
          'Load institution copy, product labels, theme tokens, and legal text.'
        )
      }
      headerAside={headerAside}
      footer={
        draft ? (
          <div
            className={[
              'fixed inset-x-0 bottom-0 z-50 border-t border-bw-sand-200 bg-white/95 px-4 pt-4 shadow-bw-card backdrop-blur-xl sm:px-8 sm:pt-4',
              ADMIN_CONSOLE_SIDEBAR_LEFT_CLASS,
            ].join(' ')}
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                {saveOk ? (
                  <span className="font-medium text-bw-sky-100/95">
                    Saved successfully. Refresh the public site to pull changes.
                  </span>
                ) : saveErr ? (
                  <span className="text-red-400">{saveErr}</span>
                ) : (
                  <span>
                    Changes apply after save. Unsaved edits stay in this browser
                    only.
                  </span>
                )}
              </div>
              <button
                type="submit"
                form="admin-bank-config-form"
                className="rounded-lg bg-bw-blue-600 px-8 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-amber-900/12 transition hover:bg-bw-navy-800"
              >
                Save all changes
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <LoadingSkeleton />
      ) : loadErr ? (
        <div className="max-w-xl rounded-2xl border border-red-500/25 bg-red-950/30 p-6">
          <h2 className="font-display text-lg font-semibold text-red-100">
            Could not load config
          </h2>
          <p className="mt-2 text-sm text-red-200/80">{loadErr}</p>
          <button
            type="button"
            onClick={() => {
              setLoadErr('')
              setLoading(true)
              ;(async () => {
                try {
                  const cfg = await fetchAdminBankConfig()
                  setDraft(cfg)
                } catch (e) {
                  setLoadErr(e instanceof Error ? e.message : 'Load failed.')
                } finally {
                  setLoading(false)
                }
              })()
            }}
            className="mt-5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-red-900 transition hover:bg-red-50"
          >
            Try again
          </button>
        </div>
      ) : draft ? (
        <form id="admin-bank-config-form" onSubmit={onSave} className="pb-4">
          <ConfigOverview
            bankName={draft.bankName}
            onCopyPath={copyFeedback}
            copiedKey={copiedKey}
          />
          <div className="mb-8">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Bank configuration sections
            </p>
            <div className="flex flex-wrap gap-2" role="navigation" aria-label="Configuration sections">
              {SECTION_NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={[
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                    activeSection === item.id
                      ? 'bg-bw-blue-600/20 text-bw-navy-950 ring-1 ring-bw-blue-600/35'
                      : 'bg-white text-slate-400 hover:bg-bw-sand-200 hover:text-bw-navy-950',
                  ].join(' ')}
                >
                  <span className="mr-1.5 font-mono text-[10px] text-slate-500">
                    {item.step}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-10">
              <AdminSection
                id="section-smtp"
                step="01"
                title="Email delivery (SMTP)"
                description="Outbound mail for sign-in OTP, KYC notify, and test sends. Values are stored on the server only (never exposed in API responses)."
                icon={<IconEnvelope />}
              >
                <div className="space-y-8">
                  <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
                    Save settings below to write{' '}
                    <code className="rounded bg-bw-sand-100 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                      server/data/smtp-settings.json
                    </code>{' '}
                    and apply them immediately for this API process. You can
                    still use{' '}
                    <code className="rounded bg-bw-sand-100 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                      server/.env
                    </code>{' '}
                    as a fallback when no saved file exists; saved settings override
                    env for SMTP when the file is present.
                  </p>

                  <div className="rounded-lg border border-bw-sand-200 bg-white/80 px-4 py-3 text-sm text-slate-300">
                    {mailHealthLoading ? (
                      <p className="text-slate-500">Checking mail service…</p>
                    ) : mailHealthErr ? (
                      <div className="space-y-2">
                        <p>{mailHealthErr}</p>
                        <button
                          type="button"
                          onClick={() => refreshMailHealth()}
                          className="text-xs font-semibold text-bw-blue-500 hover:underline"
                        >
                          Retry
                        </button>
                      </div>
                    ) : mailHealth?.ready ? (
                      <p>
                        <span className="font-semibold text-bw-sky-100">
                          Ready.
                        </span>{' '}
                        Outbound mail will send from{' '}
                        {mailHealth.senderName ? (
                          <>
                            <span className="font-semibold text-slate-100">
                              {mailHealth.senderName}
                            </span>{' '}
                            <span className="text-slate-500">·</span>{' '}
                          </>
                        ) : null}
                        <span className="font-mono text-xs text-slate-200">
                          {mailHealth.fromPreview ?? '—'}
                        </span>
                        .
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-amber-200/95">
                          SMTP not configured
                        </p>
                        <p className="text-slate-500">
                          {mailHealth?.hint ??
                            'Set SMTP host and From address below, then save. Add user and password if your provider requires authentication.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {smtpLoadErr ? (
                    <p className="text-sm text-red-300">{smtpLoadErr}</p>
                  ) : null}

                  <form
                    className="max-w-3xl space-y-5"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setSmtpSaveErr('')
                      setSmtpSaveOk(false)
                      const port = Number(smtpForm.port)
                      if (!Number.isFinite(port) || port < 1 || port >= 65536) {
                        setSmtpSaveErr('Port must be between 1 and 65535.')
                        return
                      }
                      if (!smtpForm.fromEmail.trim()) {
                        setSmtpSaveErr('From email address is required.')
                        return
                      }
                      setSmtpSaveBusy(true)
                      try {
                        const payload = {
                          host: smtpForm.host.trim(),
                          port,
                          secure: smtpForm.secure,
                          user: smtpForm.user.trim(),
                          fromName: smtpForm.fromName.trim(),
                          fromEmail: smtpForm.fromEmail.trim(),
                          ...(smtpPassTouched ? { pass: smtpPass } : {}),
                        }
                        const saved = await saveAdminSmtpSettings(payload)
                        setSmtpPasswordSet(saved.passwordSet)
                        setSmtpPass('')
                        setSmtpPassTouched(false)
                        setSmtpSaveOk(true)
                        window.setTimeout(() => setSmtpSaveOk(false), 4000)
                        refreshMailHealth()
                      } catch (err) {
                        setSmtpSaveErr(
                          err instanceof Error ? err.message : 'Save failed.',
                        )
                      } finally {
                        setSmtpSaveBusy(false)
                      }
                    }}
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block sm:col-span-1">
                        <span className={lbl}>SMTP host</span>
                        <input
                          id="admin-smtp-host"
                          name="smtpHost"
                          type="text"
                          autoComplete="off"
                          placeholder="smtp.your-provider.com"
                          className={inp}
                          value={smtpForm.host}
                          onChange={(e) =>
                            setSmtpForm((f) => ({
                              ...f,
                              host: e.target.value,
                            }))
                          }
                          disabled={smtpLoading || smtpSaveBusy}
                        />
                      </label>
                      <label className="block sm:col-span-1">
                        <span className={lbl}>Port</span>
                        <input
                          id="admin-smtp-port"
                          name="smtpPort"
                          type="number"
                          min={1}
                          max={65534}
                          className={`${inp} tabular-nums`}
                          value={smtpForm.port}
                          onChange={(e) =>
                            setSmtpForm((f) => ({
                              ...f,
                              port: Number(e.target.value) || 0,
                            }))
                          }
                          disabled={smtpLoading || smtpSaveBusy}
                        />
                      </label>
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-bw-sand-200 bg-white/80 px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-bw-sand-200 bg-bw-sand-100 text-bw-blue-600 focus:ring-bw-blue-600/40"
                        checked={smtpForm.secure}
                        onChange={(e) =>
                          setSmtpForm((f) => ({
                            ...f,
                            secure: e.target.checked,
                          }))
                        }
                        disabled={smtpLoading || smtpSaveBusy}
                      />
                      <span className="text-sm text-slate-300">
                        Use TLS (implicit SSL) — typical for port{' '}
                        <span className="font-mono text-xs text-slate-400">
                          465
                        </span>
                      </span>
                    </label>

                    <label className="block max-w-xl">
                      <span className={lbl}>SMTP username (optional)</span>
                      <input
                        id="admin-smtp-user"
                        name="smtpUser"
                        type="text"
                        autoComplete="off"
                        className={inp}
                        value={smtpForm.user}
                        onChange={(e) =>
                          setSmtpForm((f) => ({
                            ...f,
                            user: e.target.value,
                          }))
                        }
                        disabled={smtpLoading || smtpSaveBusy}
                      />
                    </label>

                    <label className="block max-w-xl">
                      <span className={lbl}>SMTP password</span>
                      <input
                        id="admin-smtp-pass"
                        name="smtpPass"
                        type="password"
                        autoComplete="new-password"
                        placeholder={
                          smtpPasswordSet && !smtpPassTouched
                            ? 'Leave blank to keep current password'
                            : '••••••••'
                        }
                        className={inp}
                        value={smtpPass}
                        onChange={(e) => {
                          setSmtpPass(e.target.value)
                          setSmtpPassTouched(true)
                        }}
                        disabled={smtpLoading || smtpSaveBusy}
                      />
                      <span className="mt-1.5 block text-xs text-slate-500">
                        {smtpPasswordSet
                          ? 'Leave blank when saving to keep the existing password. Enter a new value to replace it, or clear the field and save to remove it.'
                          : 'Required only if your provider authenticates SMTP.'}
                      </span>
                    </label>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block sm:col-span-1">
                        <span className={lbl}>Sender display name (optional)</span>
                        <input
                          id="admin-smtp-from-name"
                          name="smtpFromName"
                          type="text"
                          autoComplete="organization"
                          placeholder="Example National Bank"
                          className={inp}
                          value={smtpForm.fromName}
                          onChange={(e) =>
                            setSmtpForm((f) => ({
                              ...f,
                              fromName: e.target.value,
                            }))
                          }
                          disabled={smtpLoading || smtpSaveBusy}
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          Shown as the sender in most mail apps (your institution
                          name).
                        </span>
                      </label>
                      <label className="block sm:col-span-1">
                        <span className={lbl}>From email address</span>
                        <input
                          id="admin-smtp-from-email"
                          name="smtpFromEmail"
                          type="email"
                          autoComplete="email"
                          placeholder="noreply@yourbank.com"
                          className={inp}
                          value={smtpForm.fromEmail}
                          onChange={(e) =>
                            setSmtpForm((f) => ({
                              ...f,
                              fromEmail: e.target.value,
                            }))
                          }
                          disabled={smtpLoading || smtpSaveBusy}
                        />
                      </label>
                    </div>

                    {smtpSaveErr ? (
                      <p className="text-sm text-red-300">{smtpSaveErr}</p>
                    ) : null}
                    {smtpSaveOk ? (
                      <p className="text-sm font-medium text-bw-sky-100">
                        SMTP settings saved. They are active for this server
                        process now.
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={smtpLoading || smtpSaveBusy}
                        className="rounded-lg bg-bw-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bw-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {smtpSaveBusy ? 'Saving…' : 'Save SMTP settings'}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadSmtpForm()}
                        disabled={smtpLoading || smtpSaveBusy}
                        className="rounded-lg border border-bw-sand-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-bw-blue-600/35 hover:text-bw-navy-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reload from server
                      </button>
                    </div>
                  </form>

                  <div className="max-w-3xl border-t border-bw-sand-200 pt-8">
                    <h3 className="text-sm font-semibold text-bw-navy-950">
                      Test delivery
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Sends a short message using the SMTP settings above (save
                      first if you just changed them).
                    </p>
                    <form
                      className="mt-4 max-w-md space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setTestFeedback(null)
                      const to = testEmail.trim()
                      if (!to) {
                        setTestFeedback({
                          type: 'err',
                          text: 'Enter an email address.',
                        })
                        return
                      }
                      setTestBusy(true)
                      const result = await sendNotifyTestEmail(to, 'Operator')
                      setTestBusy(false)
                      if (result.ok) {
                        setTestFeedback({
                          type: 'ok',
                          text: result.message ?? 'Test email sent.',
                        })
                      } else {
                        setTestFeedback({
                          type: 'err',
                          text: result.error ?? 'Send failed.',
                        })
                      }
                    }}
                  >
                    <label className="block" htmlFor="admin-smtp-test-email">
                        <span className={lbl}>Recipient email</span>
                      <input
                        id="admin-smtp-test-email"
                        name="testEmail"
                        type="email"
                        autoComplete="email"
                        placeholder="you@yourdomain.com"
                        className={inp}
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        disabled={
                          testBusy || mailHealthLoading || !!mailHealthErr
                        }
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={
                          testBusy ||
                          mailHealthLoading ||
                          !!mailHealthErr ||
                          !mailHealth?.ready
                        }
                          className="rounded-lg bg-bw-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bw-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                          {testBusy ? 'Sending…' : 'Send test email'}
                      </button>
                      {testFeedback ? (
                        <span
                          className={
                            testFeedback.type === 'ok'
                              ? 'text-sm font-medium text-bw-sky-100'
                              : 'text-sm font-medium text-red-300'
                          }
                        >
                          {testFeedback.text}
                        </span>
                      ) : null}
                    </div>
                  </form>
                  </div>
                </div>
              </AdminSection>

              <AdminSection
                id="section-brand"
                step="02"
                title="Brand & marketing"
                description="Legal name, short name, logo, home page hero, sign-in disclaimer, and header tagline shown to end users."
                icon={<IconBuilding />}
              >
                <div className="space-y-8">
                  <AdminFieldGroup
                    title="Institution identity"
                    hint="Displayed in headers, footers, and legal lines."
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block">
                        <span className={lbl}>Legal / full bank name</span>
                        <input
                          className={inp}
                          value={draft.bankName}
                          onChange={(e) =>
                            setDraft({ ...draft, bankName: e.target.value })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>Short name</span>
                        <input
                          className={inp}
                          value={draft.bankNameShort}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              bankNameShort: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="col-span-full block sm:col-span-2">
                        <span className={lbl}>Public header tagline</span>
                        <input
                          className={inp}
                          value={draft.taglineHeader}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              taglineHeader: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>
                  <AdminFieldGroup
                    title="Logo mark"
                    hint="Shown in the public header, signed-in app header, debit card illustration, operator sidebar, and admin login. Leave empty or remove to use the built-in mark. Use a square or wide logo on a transparent background for best results."
                  >
                    <label className="block">
                      <span className={lbl}>Image URL or path</span>
                      <input
                        className={inp}
                        value={draft.bankLogoSrc ?? ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bankLogoSrc: e.target.value,
                          })
                        }
                        placeholder="/logo.svg or https://… or upload below"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <input
                        id="admin-bank-logo-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={() => setLogoUploadErr('')}
                      />
                      <label
                        htmlFor="admin-bank-logo-file"
                        className="inline-flex cursor-pointer rounded-lg border border-bw-blue-600/50 bg-amber-900/10 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-bw-blue-600 hover:bg-amber-900/15"
                      >
                        Choose logo…
                      </label>
                      <button
                        type="button"
                        disabled={logoUploadBusy}
                        className="rounded-lg bg-bw-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bw-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          const el = document.getElementById(
                            'admin-bank-logo-file',
                          ) as HTMLInputElement | null
                          const f = el?.files?.[0]
                          if (!f) {
                            setLogoUploadErr(
                              'Choose a JPEG, PNG, or WebP file first.',
                            )
                            return
                          }
                          setLogoUploadErr('')
                          setLogoUploadBusy(true)
                          void (async () => {
                            try {
                              const next = await postAdminBankLogo(f)
                              setDraft(next)
                              setLogoPreviewKey((k) => k + 1)
                              if (el) el.value = ''
                            } catch (e) {
                              setLogoUploadErr(
                                e instanceof Error
                                  ? e.message
                                  : 'Upload failed.',
                              )
                            } finally {
                              setLogoUploadBusy(false)
                            }
                          })()
                        }}
                      >
                        {logoUploadBusy ? 'Uploading…' : 'Upload & save'}
                      </button>
                      <button
                        type="button"
                        disabled={logoUploadBusy || !draft.bankLogoSrc?.trim()}
                        className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          if (!draft.bankLogoSrc?.trim()) return
                          setLogoUploadErr('')
                          setLogoUploadBusy(true)
                          void (async () => {
                            try {
                              const next = await saveAdminBankConfig({
                                ...draft,
                                bankLogoSrc: '',
                              })
                              setDraft(next)
                              setLogoPreviewKey((k) => k + 1)
                              const el = document.getElementById(
                                'admin-bank-logo-file',
                              ) as HTMLInputElement | null
                              if (el) el.value = ''
                            } catch (e) {
                              setLogoUploadErr(
                                e instanceof Error
                                  ? e.message
                                  : 'Could not remove logo.',
                              )
                            } finally {
                              setLogoUploadBusy(false)
                            }
                          })()
                        }}
                      >
                        Remove custom logo
                      </button>
                      {logoUploadErr ? (
                        <span className="text-sm text-red-400">
                          {logoUploadErr}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-5">
                      <p className={lbl}>Preview</p>
                      <div className="mt-2 flex flex-wrap items-center gap-6 rounded-xl border border-bw-sand-200 bg-bw-sand-100 px-6 py-8">
                        {draft.bankLogoSrc?.trim() ? (
                          <>
                            <div className="rounded-xl bg-white/10 p-1 ring-1 ring-white/15">
                              <img
                                key={`logo-light-${draft.bankLogoSrc}-${logoPreviewKey}`}
                                src={bankMediaPreviewUrl(draft.bankLogoSrc)}
                                alt=""
                                className="h-12 w-12 object-contain"
                              />
                            </div>
                            <div className="rounded-xl bg-[#ebe6dd] p-1 ring-1 ring-bw-sand-200">
                              <img
                                key={`logo-dark-${draft.bankLogoSrc}-${logoPreviewKey}`}
                                src={bankMediaPreviewUrl(draft.bankLogoSrc)}
                                alt=""
                                className="h-12 w-12 object-contain"
                              />
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Built-in mark is used when this field is empty. Upload
                            or paste a URL to preview on light and neutral
                            backgrounds.
                          </p>
                        )}
                      </div>
                    </div>
                  </AdminFieldGroup>
                  <AdminFieldGroup
                    title="Homepage"
                    hint="Primary marketing band on the public landing page."
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block">
                        <span className={lbl}>Home eyebrow</span>
                        <input
                          className={inp}
                          value={draft.homeEyebrow}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              homeEyebrow: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="col-span-full block sm:col-span-2">
                        <span className={lbl}>Home headline</span>
                        <input
                          className={inp}
                          value={draft.homeHeadline}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              homeHeadline: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="col-span-full block sm:col-span-2">
                        <span className={lbl}>Home subtext</span>
                        <textarea
                          rows={3}
                          className={inp}
                          value={draft.homeSubtext}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              homeSubtext: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>Home CTA (talk)</span>
                        <input
                          className={inp}
                          value={draft.homeCtaTalk}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              homeCtaTalk: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>
                  <AdminFieldGroup
                    title="Homepage hero image"
                    hint="Large photo beside the headline on the public home page. Site paths (/…) use files from the deployed web app (e.g. public/). Upload stores the file on the API server and updates this path. External URLs must start with https://."
                  >
                    <label className="block">
                      <span className={lbl}>Image URL or path</span>
                      <input
                        className={inp}
                        value={draft.homeHeroImageSrc}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            homeHeroImageSrc: e.target.value,
                          })
                        }
                        placeholder="/home-hero-banking.svg or https://…"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <input
                        id="admin-home-hero-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={() => setHeroUploadErr('')}
                      />
                      <label
                        htmlFor="admin-home-hero-file"
                        className="inline-flex cursor-pointer rounded-lg border border-bw-blue-600/50 bg-amber-900/10 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-bw-blue-600 hover:bg-amber-900/15"
                      >
                        Choose image…
                      </label>
                      <button
                        type="button"
                        disabled={heroUploadBusy}
                        className="rounded-lg bg-bw-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bw-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          const el = document.getElementById(
                            'admin-home-hero-file',
                          ) as HTMLInputElement | null
                          const f = el?.files?.[0]
                          if (!f) {
                            setHeroUploadErr(
                              'Choose a JPEG, PNG, or WebP file first.',
                            )
                            return
                          }
                          setHeroUploadErr('')
                          setHeroUploadBusy(true)
                          void (async () => {
                            try {
                              const next = await postAdminHomeHeroImage(f)
                              setDraft(next)
                              setHeroPreviewKey((k) => k + 1)
                              if (el) el.value = ''
                            } catch (e) {
                              setHeroUploadErr(
                                e instanceof Error
                                  ? e.message
                                  : 'Upload failed.',
                              )
                            } finally {
                              setHeroUploadBusy(false)
                            }
                          })()
                        }}
                      >
                        {heroUploadBusy ? 'Uploading…' : 'Upload & save'}
                      </button>
                      {heroUploadErr ? (
                        <span className="text-sm text-red-400">
                          {heroUploadErr}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-5">
                      <p className={lbl}>Preview</p>
                      <div className="mt-2 overflow-hidden rounded-xl border border-bw-sand-200 bg-bw-sand-100">
                        {draft.homeHeroImageSrc.trim() ? (
                          <img
                            key={`${draft.homeHeroImageSrc}-${heroPreviewKey}`}
                            src={bankMediaPreviewUrl(draft.homeHeroImageSrc)}
                            alt=""
                            className="max-h-56 w-full object-cover object-center"
                          />
                        ) : (
                          <p className="px-4 py-8 text-center text-xs text-slate-500">
                            Enter a path or upload an image to preview.
                          </p>
                        )}
                      </div>
                    </div>
                  </AdminFieldGroup>
                  <AdminFieldGroup
                    title="Sign-in experience"
                    hint="Shown near the customer authentication form."
                  >
                    <label className="block">
                      <span className={lbl}>Sign-in disclaimer</span>
                      <textarea
                        rows={2}
                        className={inp}
                        value={draft.signInDisclaimer}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            signInDisclaimer: e.target.value,
                          })
                        }
                      />
                    </label>
                  </AdminFieldGroup>
                </div>
              </AdminSection>

              <AdminSection
                id="section-support"
                step="03"
                title="Support & chat"
                description="Phone numbers, hours line, virtual chat persona, and invest product brand string."
                icon={<IconChat />}
              >
                <div className="space-y-8">
                  <AdminFieldGroup title="Contact channels">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block">
                        <span className={lbl}>Main phone</span>
                        <input
                          className={inp}
                          value={draft.supportPhone}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              supportPhone: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>Fraud phone</span>
                        <input
                          className={inp}
                          value={draft.supportPhoneFraud}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              supportPhoneFraud: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>Support email</span>
                        <input
                          className={inp}
                          value={draft.supportEmail}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              supportEmail: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="col-span-full block sm:col-span-2">
                        <span className={lbl}>Support hours line</span>
                        <input
                          className={inp}
                          value={draft.supportHoursLine}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              supportHoursLine: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>
                  <AdminFieldGroup title="Virtual assistant & invest">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block">
                        <span className={lbl}>Chat agent name</span>
                        <input
                          className={inp}
                          value={draft.chatAgentName}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              chatAgentName: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>Chat header title</span>
                        <input
                          className={inp}
                          value={draft.chatHeaderTitle}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              chatHeaderTitle: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>Chat header subtitle</span>
                        <input
                          className={inp}
                          value={draft.chatHeaderSubtitle}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              chatHeaderSubtitle: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>Invest brand name</span>
                        <input
                          className={inp}
                          value={draft.investBrandName}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              investBrandName: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>
                </div>
              </AdminSection>

              <AdminSection
                id="section-products"
                step="04"
                title="Product labels"
                description="Labels paired with sample accounts and fund names on the invest screen."
                icon={<IconCube />}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  {(
                    [
                      ['checkingName', 'Checking product name'],
                      ['checkingMask', 'Checking mask (last 4)'],
                      ['savingsName', 'Savings product name'],
                      ['savingsMask', 'Savings mask'],
                      ['fundTotalMarket', 'Fund: total market'],
                      ['fundInternational', 'Fund: international'],
                      ['fundCoreBond', 'Fund: core bond'],
                      ['fundCashSweep', 'Fund: cash sweep'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block">
                      <span className={lbl}>{label}</span>
                      <input
                        className={inp}
                        value={draft.products[key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            products: {
                              ...draft.products,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </AdminSection>

              <AdminBankDepositsFeesPanel draft={draft} setDraft={setDraft} />

              <AdminSection
                id="section-theme"
                step="06"
                title="Theme colors"
                description="Design tokens as hex. Each maps to a CSS variable consumed by the public Tailwind theme (#RRGGBB)."
                icon={<IconPalette />}
              >
                <div className="overflow-hidden rounded-xl border border-bw-sand-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-bw-sand-200 bg-white/90 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          <th className="whitespace-nowrap px-4 py-3.5">
                            Token key
                          </th>
                          <th className="whitespace-nowrap px-4 py-3.5">
                            Display name
                          </th>
                          <th className="px-4 py-3.5">Swatch</th>
                          <th className="min-w-[10rem] px-4 py-3.5">Hex value</th>
                          <th className="w-24 px-4 py-3.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bw-sand-200">
                        {THEME_KEYS.map(([key, label]) => {
                          const hex = draft.theme[key]
                          const safe =
                            /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#888888'
                          const copyId = `theme-${key}`
                          return (
                            <tr
                              key={key}
                              className="transition hover:bg-white/80"
                            >
                              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
                                {key}
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                {label}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className="inline-block h-9 w-9 rounded-lg border border-bw-sand-200 shadow-inner ring-1 ring-stone-300"
                                  style={{ backgroundColor: safe }}
                                  title={hex}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  className={`${inp} font-mono text-xs`}
                                  value={draft.theme[key]}
                                  onChange={(e) =>
                                    setDraft({
                                      ...draft,
                                      theme: {
                                        ...draft.theme,
                                        [key]: e.target.value,
                                      },
                                    })
                                  }
                                  aria-label={`${label} hex`}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => copyFeedback(hex, copyId)}
                                  className="rounded-md border border-bw-sand-200 bg-bw-sand-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-bw-blue-600/40 hover:text-bw-navy-950"
                                >
                                  {copiedKey === copyId ? (
                                    <span className="text-bw-sky-100">
                                      Copied
                                    </span>
                                  ) : (
                                    'Copy'
                                  )}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </AdminSection>

              <AdminSection
                id="section-email-letters"
                step="07"
                title="Email letters"
                description="Branded HTML correspondence for sign-in codes, KYC notices, and SMTP tests. Inner HTML is wrapped in an official letter shell using your theme colors and footer."
                icon={<IconEnvelope />}
              >
                <div className="space-y-10">
                  <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
                    Use{' '}
                    <code className="rounded bg-bw-sand-100 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                      {'{{placeholders}}'}
                    </code>{' '}
                    in subjects and bodies; dynamic values are escaped for HTML.
                    Theme header uses{' '}
                    <span className="font-mono text-xs text-slate-300">
                      theme.navy950
                    </span>{' '}
                    and{' '}
                    <span className="font-mono text-xs text-slate-300">
                      theme.blue600
                    </span>
                    . Preview uses sample customer data and includes{' '}
                    <strong className="font-semibold text-slate-300">
                      unsaved edits
                    </strong>{' '}
                    on this page.
                  </p>

                  {letterPreviewErr && !letterPreviewOpen ? (
                    <div
                      role="alert"
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm text-red-100"
                    >
                      <span>{letterPreviewErr}</span>
                      <button
                        type="button"
                        onClick={() => setLetterPreviewErr(null)}
                        className="shrink-0 text-xs font-semibold text-red-200 underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}

                  <AdminFieldGroup
                    title="Sign-in verification (OTP)"
                    hint="Sent when a customer uses email sign-in verification. Plain text is required for mail clients that do not render HTML."
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-bw-sand-200/80 pb-4">
                      <p className="text-xs text-slate-500">
                        Sample code &amp; greeting · full branded HTML
                      </p>
                      <button
                        type="button"
                        disabled={letterPreviewBusy || !draft}
                        onClick={() => void openLetterPreview('otp')}
                        className="rounded-lg border border-bw-sand-200 bg-white px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-bw-blue-600/40 hover:text-bw-navy-950 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {letterPreviewBusy ? 'Rendering…' : 'Preview letter'}
                      </button>
                    </div>
                    <div className="space-y-5">
                      <label className="block max-w-2xl">
                        <span className={lbl}>Subject line</span>
                        <input
                          className={inp}
                          value={draft.emailLetters.otpSubjectTemplate}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                otpSubjectTemplate: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          Placeholders:{' '}
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{bankName}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Letter body (HTML fragment)</span>
                        <textarea
                          rows={10}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.otpInnerHtml}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                otpInnerHtml: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          HTML inside the branded wrapper only.{' '}
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{greetingLine}} {{code}} {{expiryMinutes}} {{supportEmail}} {{supportPhoneFraud}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Plain-text version</span>
                        <textarea
                          rows={6}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.otpTextBody}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                otpTextBody: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>

                  <AdminFieldGroup
                    title="Wire transfer authorization (OTP)"
                    hint="Sent when a customer submits a domestic or international wire in Pay & transfer — before the approval queue. Uses the same placeholders as sign-in OTP plus wire-specific copy in your templates."
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-bw-sand-200/80 pb-4">
                      <p className="text-xs text-slate-500">
                        Sample code &amp; greeting · full branded HTML
                      </p>
                      <button
                        type="button"
                        disabled={letterPreviewBusy || !draft}
                        onClick={() => void openLetterPreview('wire_transfer')}
                        className="rounded-lg border border-bw-sand-200 bg-white px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-bw-blue-600/40 hover:text-bw-navy-950 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {letterPreviewBusy ? 'Rendering…' : 'Preview letter'}
                      </button>
                    </div>
                    <div className="space-y-5">
                      <label className="block max-w-2xl">
                        <span className={lbl}>Subject line</span>
                        <input
                          className={inp}
                          value={draft.emailLetters.wireTransferOtpSubjectTemplate}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                wireTransferOtpSubjectTemplate: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          Placeholders:{' '}
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{bankName}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Letter body (HTML fragment)</span>
                        <textarea
                          rows={10}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.wireTransferOtpInnerHtml}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                wireTransferOtpInnerHtml: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          HTML inside the branded wrapper only.{' '}
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{greetingLine}} {{code}} {{expiryMinutes}} {{supportEmail}} {{supportPhoneFraud}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Plain-text version</span>
                        <textarea
                          rows={6}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.wireTransferOtpTextBody}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                wireTransferOtpTextBody: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>

                  <AdminFieldGroup
                    title="Email address change (OTP)"
                    hint="Sent to the customer’s new email when they request an address change in Settings. Plain text is required for mail clients that do not render HTML."
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-bw-sand-200/80 pb-4">
                      <p className="text-xs text-slate-500">
                        Sample code &amp; greeting · full branded HTML
                      </p>
                      <button
                        type="button"
                        disabled={letterPreviewBusy || !draft}
                        onClick={() => void openLetterPreview('email_change')}
                        className="rounded-lg border border-bw-sand-200 bg-white px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-bw-blue-600/40 hover:text-bw-navy-950 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {letterPreviewBusy ? 'Rendering…' : 'Preview letter'}
                      </button>
                    </div>
                    <div className="space-y-5">
                      <label className="block max-w-2xl">
                        <span className={lbl}>Subject line</span>
                        <input
                          className={inp}
                          value={draft.emailLetters.emailChangeSubjectTemplate}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                emailChangeSubjectTemplate: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          Placeholders:{' '}
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{bankName}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Letter body (HTML fragment)</span>
                        <textarea
                          rows={10}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.emailChangeInnerHtml}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                emailChangeInnerHtml: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          HTML inside the branded wrapper only.{' '}
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{greetingLine}} {{code}} {{expiryMinutes}} {{supportEmail}} {{supportPhoneFraud}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Plain-text version</span>
                        <textarea
                          rows={6}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.emailChangeTextBody}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                emailChangeTextBody: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>

                  <AdminFieldGroup
                    title="KYC — operator notification"
                    hint="Sent to KYC_NOTIFY_EMAIL in server/.env when a customer submits documents."
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-bw-sand-200/80 pb-4">
                      <p className="text-xs text-slate-500">
                        Sample submission ID · full branded HTML
                      </p>
                      <button
                        type="button"
                        disabled={letterPreviewBusy || !draft}
                        onClick={() => void openLetterPreview('kyc')}
                        className="rounded-lg border border-bw-sand-200 bg-white px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-bw-blue-600/40 hover:text-bw-navy-950 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {letterPreviewBusy ? 'Rendering…' : 'Preview letter'}
                      </button>
                    </div>
                    <div className="space-y-5">
                      <label className="block max-w-2xl">
                        <span className={lbl}>Subject line</span>
                        <input
                          className={inp}
                          value={draft.emailLetters.kycNotifySubjectTemplate}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                kycNotifySubjectTemplate: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{bankName}} {{submissionId}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Letter body (HTML fragment)</span>
                        <textarea
                          rows={10}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.kycNotifyInnerHtml}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                kycNotifyInnerHtml: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{submissionId}} {{customerEmail}} {{displayName}} {{bankName}} {{supportEmail}} {{supportPhone}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Plain-text version</span>
                        <textarea
                          rows={6}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.kycNotifyTextBody}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                kycNotifyTextBody: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>

                  <AdminFieldGroup
                    title="SMTP test email"
                    hint="Used when you send a test from Email delivery (SMTP)."
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-bw-sand-200/80 pb-4">
                      <p className="text-xs text-slate-500">
                        Sample greeting · matches SMTP test send
                      </p>
                      <button
                        type="button"
                        disabled={letterPreviewBusy || !draft}
                        onClick={() => void openLetterPreview('test')}
                        className="rounded-lg border border-bw-sand-200 bg-white px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-bw-blue-600/40 hover:text-bw-navy-950 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {letterPreviewBusy ? 'Rendering…' : 'Preview letter'}
                      </button>
                    </div>
                    <div className="space-y-5">
                      <label className="block max-w-2xl">
                        <span className={lbl}>Subject line</span>
                        <input
                          className={inp}
                          value={draft.emailLetters.testSubjectTemplate}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                testSubjectTemplate: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{bankName}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Letter body (HTML fragment)</span>
                        <textarea
                          rows={8}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.testInnerHtml}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                testInnerHtml: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="mt-1.5 block text-xs text-slate-500">
                          <code className="font-mono text-[11px] text-slate-400">
                            {'{{greetingLine}} {{bankName}} {{supportEmail}} {{displayName}}'}
                          </code>
                        </span>
                      </label>
                      <label className="block">
                        <span className={lbl}>Plain-text version</span>
                        <textarea
                          rows={5}
                          className={`${inp} font-mono text-xs leading-relaxed`}
                          spellCheck={false}
                          value={draft.emailLetters.testTextBody}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              emailLetters: {
                                ...draft.emailLetters,
                                testTextBody: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>
                </div>
              </AdminSection>

              <AdminSection
                id="section-legal"
                step="08"
                title="Legal copy"
                description="Footer disclaimer, copyright suffix, mobile deposit endorsement, and wire-related legal lines."
                icon={<IconScale />}
              >
                <div className="space-y-8">
                  <AdminFieldGroup
                    title="Public footer & copyright"
                    hint="Rendered with the bank name on marketing and app chrome."
                  >
                    <div className="space-y-5">
                      <label className="block">
                        <span className={lbl}>
                          Regulatory footer (follows bank name in sentence)
                        </span>
                        <textarea
                          rows={3}
                          className={inp}
                          value={draft.legalDemoFooter}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              legalDemoFooter: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>
                          Copyright suffix (after © year and bank name)
                        </span>
                        <input
                          className={inp}
                          value={draft.legalCopyright}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              legalCopyright: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>
                  <AdminFieldGroup
                    title="Deposits & wires"
                    hint="Shown on mobile deposit and wire flows."
                  >
                    <div className="space-y-5">
                      <label className="block">
                        <span className={lbl}>Mobile deposit endorsement</span>
                        <input
                          className={inp}
                          value={draft.mobileDepositEndorsement}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              mobileDepositEndorsement: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>Wire authorization line</span>
                        <textarea
                          rows={2}
                          className={inp}
                          value={draft.wireAuthLine}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              wireAuthLine: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={lbl}>Wire fees disclaimer</span>
                        <textarea
                          rows={2}
                          className={inp}
                          value={draft.wireDisclaimerFees}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              wireDisclaimerFees: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </AdminFieldGroup>
                </div>
              </AdminSection>
          </div>
        </form>
      ) : (
        <p className="text-slate-500">No configuration loaded.</p>
      )}

      {letterPreviewOpen && letterPreviewType ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-letter-preview-title"
          onClick={() => {
            setLetterPreviewOpen(false)
            setLetterPreviewErr(null)
          }}
        >
          <div
            className="flex max-h-[min(900px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-bw-sand-200 bg-white shadow-2xl shadow-stone-900/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-bw-sand-200 px-5 py-4">
              <div>
                <h2
                  id="email-letter-preview-title"
                  className="font-display text-lg font-semibold text-bw-navy-950"
                >
                  {letterPreviewTitles[letterPreviewType]}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Subject line below is what recipients see. HTML matches outgoing
                  mail (multipart with plain-text part).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLetterPreviewOpen(false)
                  setLetterPreviewErr(null)
                }}
                className="rounded-lg border border-bw-sand-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-bw-navy-950"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 shrink space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <span className={lbl}>Subject</span>
                <p className="mt-1.5 rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3.5 py-2.5 font-mono text-sm text-slate-200">
                  {letterPreviewSubject}
                </p>
              </div>
              <div>
                <span className={lbl}>HTML (branded)</span>
                <div className="mt-1.5 overflow-hidden rounded-lg border border-bw-sand-200 bg-white">
                  <iframe
                    title="Email HTML preview"
                    sandbox=""
                    className="h-[min(480px,55vh)] w-full border-0"
                    srcDoc={letterPreviewHtml}
                  />
                </div>
              </div>
              <div>
                <span className={lbl}>Plain-text part</span>
                <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-bw-sand-200 bg-bw-sand-100 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-300">
                  {letterPreviewText}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminConsoleShell>
  )
}
