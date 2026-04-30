import type { ApprovalItem, ApprovalStatus } from '../types/approvals'
import type { KycSubmission } from '../types/kyc'
import type { SupportTicket, SupportTicketStatus } from '../types/supportTicket'
import type { EngineKind } from './adminTransactionTaxonomy'
import type { BankConfig } from '../types/bankConfig'
import type { DebitCardInfo, DebitCardTransaction } from '../types/banking'
import type { AuthUser } from './authApi'
import { getApiBase } from './apiBase'

const TOKEN_KEY = 'bw_bank_admin_token'

/** Shown when admin fetch gets HTML or garbage — Vite proxy must match the API port. */
const DEV_API_HINT =
  'Run npm run dev (API + Vite) or npm run dev:web (starts the API if it is not already up, then Vite). NOTIFY_PORT in server/.env must match the API and the Vite /api proxy; curl the /api/health URL on that port — expect {"ok":true,"service":"banking-api"}. For Vite without auto-start use npm run vite:only and npm run dev:api in another terminal.'

async function readJsonBody<T>(r: Response): Promise<T> {
  const text = await r.text()
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error(`Empty response from server (${r.status}). ${DEV_API_HINT}`)
  }
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const hint =
      trimmed.startsWith('<') || trimmed.startsWith('<!')
        ? 'Received HTML instead of JSON (wrong URL or dev proxy not reaching the API).'
        : 'Response was not valid JSON.'
    const url = typeof r.url === 'string' && r.url ? ` [fetched: ${r.url}]` : ''
    throw new Error(`${hint} Status ${r.status}.${url} ${DEV_API_HINT}`)
  }
}

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function clearAdminToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export type AdminTokenVerifyResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Confirms the bearer matches `ADMIN_API_SECRET` by loading bank config.
 * Rejects HTML responses (Netlify SPA fallback) and surfaces timeouts/network errors.
 */
export async function verifyAdminToken(
  token: string,
): Promise<AdminTokenVerifyResult> {
  const url = `${getApiBase()}/api/admin/bank-config`
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(25_000),
    })
    const ct = (r.headers.get('content-type') ?? '').toLowerCase()
    if (!ct.includes('application/json')) {
      return {
        ok: false,
        message:
          'The admin API returned HTML instead of JSON. Usually Netlify is serving index.html for /api paths: put the /api → droplet redirect above /* → /index.html in netlify.toml, redeploy (clear cache), and remove VITE_API_BASE so requests stay same-origin.',
      }
    }
    let data: { ok?: boolean; error?: string }
    try {
      data = (await r.json()) as { ok?: boolean; error?: string }
    } catch {
      return {
        ok: false,
        message: 'Invalid JSON from admin API. Confirm /api/admin/bank-config reaches your Node server.',
      }
    }
    if (r.status === 401 || r.status === 403) {
      return {
        ok: false,
        message: data.error ?? 'Invalid admin secret.',
      }
    }
    if (!r.ok || data.ok !== true) {
      return {
        ok: false,
        message: data.error ?? 'Could not verify admin access.',
      }
    }
    return { ok: true }
  } catch (e) {
    const aborted =
      e instanceof DOMException &&
      (e.name === 'AbortError' || e.name === 'TimeoutError')
    return {
      ok: false,
      message: aborted
        ? 'Request timed out. Check that the API is reachable from the browser (Netlify redirects, firewall, or wrong VITE_API_BASE).'
        : 'Could not reach the admin API (network or browser blocking). Open DevTools → Network for /api/admin/bank-config.',
    }
  }
}

export async function fetchAdminBankConfig(): Promise<BankConfig> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/bank-config`, {
    headers: { Authorization: `Bearer ${t}` },
  })
  const data = await readJsonBody<{
    ok?: boolean
    config?: BankConfig
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.config) {
    throw new Error(data.error ?? 'Could not load configuration.')
  }
  return data.config
}

export type EmailLetterPreviewType =
  | 'otp'
  | 'email_change'
  | 'wire_transfer'
  | 'kyc'
  | 'test'

/** Renders sample-data preview of a letter using current config (including unsaved draft). */
export async function previewAdminEmailLetter(
  type: EmailLetterPreviewType,
  bankConfig: BankConfig,
): Promise<{ subject: string; html: string; text: string }> {
  const tok = getAdminToken()
  if (!tok) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/email-letters/preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tok}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type, bankConfig }),
  })
  const data = await readJsonBody<{
    ok?: boolean
    subject?: string
    html?: string
    text?: string
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (
    !r.ok ||
    !data.ok ||
    typeof data.subject !== 'string' ||
    typeof data.html !== 'string' ||
    typeof data.text !== 'string'
  ) {
    throw new Error(data.error ?? 'Preview failed.')
  }
  return { subject: data.subject, html: data.html, text: data.text }
}

export async function saveAdminBankConfig(
  config: BankConfig,
): Promise<BankConfig> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/bank-config`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  })
  const data = await readJsonBody<{
    ok?: boolean
    config?: BankConfig
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.config) {
    throw new Error(data.error ?? 'Save failed.')
  }
  window.dispatchEvent(new Event('bank-config-updated'))
  return data.config
}

export type AdminSmtpSettings = {
  host: string
  port: number
  secure: boolean
  user: string
  /** Shown as the sender name in inboxes when set (e.g. institution name). */
  fromName: string
  /** Envelope from address (required for sending). */
  fromEmail: string
  passwordSet: boolean
}

export async function fetchAdminSmtpSettings(): Promise<AdminSmtpSettings> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/smtp-settings`, {
    headers: { Authorization: `Bearer ${t}` },
  })
  const data = await readJsonBody<{
    ok?: boolean
    smtp?: AdminSmtpSettings
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.smtp) {
    throw new Error(data.error ?? 'Could not load SMTP settings.')
  }
  return data.smtp
}

export async function saveAdminSmtpSettings(body: {
  host: string
  port: number
  secure: boolean
  user: string
  fromName: string
  fromEmail: string
  pass?: string
}): Promise<AdminSmtpSettings> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/smtp-settings`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    smtp?: AdminSmtpSettings
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.smtp) {
    throw new Error(data.error ?? 'Save failed.')
  }
  return data.smtp
}

export type OtpPolicyFlags = {
  skipLoginEmailOtp: boolean
  requireLoginEmailOtp: boolean
  skipWireEmailOtp: boolean
}

export type AdminOtpPolicySnapshot = {
  effective: OtpPolicyFlags
  envDefaults: OtpPolicyFlags
  persisted: OtpPolicyFlags | null
  persistedFile: boolean
  persistedFileInvalid: boolean
}

export async function fetchAdminOtpPolicy(): Promise<AdminOtpPolicySnapshot> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/otp-policy`, {
    headers: { Authorization: `Bearer ${t}` },
  })
  const data = await readJsonBody<{
    ok?: boolean
    effective?: OtpPolicyFlags
    envDefaults?: OtpPolicyFlags
    persisted?: OtpPolicyFlags | null
    persistedFile?: boolean
    persistedFileInvalid?: boolean
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (
    !r.ok ||
    !data.ok ||
    !data.effective ||
    !data.envDefaults ||
    typeof data.persistedFile !== 'boolean' ||
    typeof data.persistedFileInvalid !== 'boolean'
  ) {
    throw new Error(data.error ?? 'Could not load OTP policy.')
  }
  return {
    effective: data.effective,
    envDefaults: data.envDefaults,
    persisted: data.persisted ?? null,
    persistedFile: data.persistedFile,
    persistedFileInvalid: data.persistedFileInvalid,
  }
}

export async function saveAdminOtpPolicy(
  body: OtpPolicyFlags,
): Promise<AdminOtpPolicySnapshot> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/otp-policy`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    effective?: OtpPolicyFlags
    envDefaults?: OtpPolicyFlags
    persisted?: OtpPolicyFlags | null
    persistedFile?: boolean
    persistedFileInvalid?: boolean
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (
    !r.ok ||
    !data.ok ||
    !data.effective ||
    !data.envDefaults ||
    typeof data.persistedFile !== 'boolean' ||
    typeof data.persistedFileInvalid !== 'boolean'
  ) {
    throw new Error(data.error ?? 'Save failed.')
  }
  return {
    effective: data.effective,
    envDefaults: data.envDefaults,
    persisted: data.persisted ?? null,
    persistedFile: data.persistedFile,
    persistedFileInvalid: data.persistedFileInvalid,
  }
}

export async function clearAdminOtpPolicy(): Promise<AdminOtpPolicySnapshot> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/otp-policy`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${t}` },
  })
  const data = await readJsonBody<{
    ok?: boolean
    effective?: OtpPolicyFlags
    envDefaults?: OtpPolicyFlags
    persisted?: OtpPolicyFlags | null
    persistedFile?: boolean
    persistedFileInvalid?: boolean
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (
    !r.ok ||
    !data.ok ||
    !data.effective ||
    !data.envDefaults ||
    typeof data.persistedFile !== 'boolean' ||
    typeof data.persistedFileInvalid !== 'boolean'
  ) {
    throw new Error(data.error ?? 'Reset failed.')
  }
  return {
    effective: data.effective,
    envDefaults: data.envDefaults,
    persisted: data.persisted ?? null,
    persistedFile: data.persistedFile,
    persistedFileInvalid: data.persistedFileInvalid,
  }
}

async function fileToBase64Payload(file: File): Promise<{
  imageBase64: string
  contentType: string
}> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[],
    )
  }
  return {
    imageBase64: btoa(binary),
    contentType: file.type || 'application/octet-stream',
  }
}

/** Uploads a new home hero image; saves config with `homeHeroImageSrc` pointing at `/api/media/home-hero.{jpg|png|webp}`. */
export async function postAdminHomeHeroImage(file: File): Promise<BankConfig> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const { imageBase64, contentType } = await fileToBase64Payload(file)
  const r = await fetch(`${getApiBase()}/api/admin/bank-config/home-hero-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageBase64, contentType }),
  })
  const data = await readJsonBody<{
    ok?: boolean
    config?: BankConfig
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.config) {
    throw new Error(data.error ?? 'Upload failed.')
  }
  window.dispatchEvent(new Event('bank-config-updated'))
  return data.config
}

/** Uploads bank logo; saves config with `bankLogoSrc` pointing at `/api/media/bank-logo.{jpg|png|webp}`. */
export async function postAdminBankLogo(file: File): Promise<BankConfig> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const { imageBase64, contentType } = await fileToBase64Payload(file)
  const r = await fetch(`${getApiBase()}/api/admin/bank-config/bank-logo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageBase64, contentType }),
  })
  const data = await readJsonBody<{
    ok?: boolean
    config?: BankConfig
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.config) {
    throw new Error(data.error ?? 'Upload failed.')
  }
  window.dispatchEvent(new Event('bank-config-updated'))
  return data.config
}

export async function fetchAdminApprovals(params?: {
  status?: string
  limit?: number
}): Promise<ApprovalItem[]> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.limit != null) q.set('limit', String(params.limit))
  const r = await fetch(
    `${getApiBase()}/api/admin/approvals${q.toString() ? `?${q}` : ''}`,
    { headers: { Authorization: `Bearer ${t}` } },
  )
  const data = await readJsonBody<{
    ok?: boolean
    items?: ApprovalItem[]
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !Array.isArray(data.items)) {
    throw new Error(data.error ?? 'Could not load approvals.')
  }
  return data.items
}

export type PatchAdminApprovalResult = {
  item: ApprovalItem
  withdrawalApprovalStage?: string
}

export async function patchAdminApproval(
  id: string,
  body:
    | { status: 'approved' | 'rejected'; note?: string }
    | { suspicious: boolean; suspiciousNote?: string },
): Promise<PatchAdminApprovalResult> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/approvals/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    item?: ApprovalItem
    withdrawalApprovalStage?: string
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.item) {
    throw new Error(data.error ?? 'Update failed.')
  }
  return {
    item: data.item,
    withdrawalApprovalStage: data.withdrawalApprovalStage,
  }
}

export async function fetchAdminWithdrawalsQueue(): Promise<
  AdminTransactionRow[]
> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/withdrawals/queue`, {
    headers: { Authorization: `Bearer ${t}` },
  })
  const data = await readJsonBody<{
    ok?: boolean
    items?: AdminTransactionRow[]
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !Array.isArray(data.items)) {
    throw new Error(data.error ?? 'Could not load withdrawal queue.')
  }
  return data.items
}

export type AdminTransactionRow = {
  id: string
  status: ApprovalStatus
  type: ApprovalItem['type']
  engineKind: EngineKind
  amountCents: number | null
  userId: string | null
  submitterId: string
  title: string
  createdAt: string
  decidedAt: string | null
  appliedAt: string | null
  reversedAt: string | null
  decisionNote: string | null
  effectiveAt: string
  createdMs: number
  suspicious: boolean
  suspiciousNote: string | null
  withdrawalCoApprovals: number
}

export async function fetchAdminTransactions(params?: {
  status?: string
  engineKind?: string
  userId?: string
  from?: string
  to?: string
  minAmount?: number
  maxAmount?: number
  limit?: number
}): Promise<AdminTransactionRow[]> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.engineKind) q.set('engineKind', params.engineKind)
  if (params?.userId) q.set('userId', params.userId)
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  if (params?.minAmount != null) q.set('minAmount', String(params.minAmount))
  if (params?.maxAmount != null) q.set('maxAmount', String(params.maxAmount))
  if (params?.limit != null) q.set('limit', String(params.limit))
  const r = await fetch(
    `${getApiBase()}/api/admin/transactions${q.toString() ? `?${q}` : ''}`,
    { headers: { Authorization: `Bearer ${t}` } },
  )
  const data = await readJsonBody<{
    ok?: boolean
    items?: AdminTransactionRow[]
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !Array.isArray(data.items)) {
    throw new Error(data.error ?? 'Could not load transactions.')
  }
  return data.items
}

export async function postAdminReverseApproval(id: string): Promise<ApprovalItem> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(id)
  const r = await fetch(`${getApiBase()}/api/admin/approvals/${enc}/reverse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}` },
  })
  const data = await readJsonBody<{
    ok?: boolean
    item?: ApprovalItem
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.item) {
    throw new Error(data.error ?? 'Reverse failed.')
  }
  return data.item
}

export type AdminCardRow = {
  userId: string
  displayName: string
  email: string
  debitCard: DebitCardInfo
}

export async function fetchAdminCards(): Promise<AdminCardRow[]> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}/api/admin/cards`, {
    headers: { Authorization: `Bearer ${t}` },
  })
  const data = await readJsonBody<{
    ok?: boolean
    rows?: AdminCardRow[]
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !Array.isArray(data.rows)) {
    throw new Error(data.error ?? 'Could not load cards.')
  }
  return data.rows
}

export async function postAdminIssueCard(
  userId: string,
  body: { cardType: 'virtual' | 'physical' },
): Promise<DebitCardInfo> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(userId)
  const r = await fetch(`${getApiBase()}/api/admin/cards/${enc}/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    debitCard?: DebitCardInfo
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.debitCard) {
    throw new Error(data.error ?? 'Issue failed.')
  }
  return data.debitCard
}

export async function patchAdminCard(
  userId: string,
  body: {
    adminFrozen?: boolean
    stolenBlocked?: boolean
    singleTransactionLimitCents?: number | null
    dailySpendLimitCents?: number | null
  },
): Promise<DebitCardInfo> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(userId)
  const r = await fetch(`${getApiBase()}/api/admin/cards/${enc}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    debitCard?: DebitCardInfo
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.debitCard) {
    throw new Error(data.error ?? 'Update failed.')
  }
  return data.debitCard
}

export async function postAdminCardTransaction(
  userId: string,
  body: {
    merchant: string
    amountCents: number
    status?: 'posted' | 'declined' | 'pending'
  },
): Promise<DebitCardTransaction> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(userId)
  const r = await fetch(`${getApiBase()}/api/admin/cards/${enc}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    row?: DebitCardTransaction
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.row) {
    throw new Error(data.error ?? 'Could not add transaction.')
  }
  return data.row
}

export type AdminOverview = {
  customerCount: number
  approvalsPending: number
  approvalsApproved: number
  approvalsRejected: number
  approvalsTotal: number
  totalBalanceCents: number
  adminDepositsCents: number
  adminWithdrawalsCents: number
  adminNetOperatorCents: number
  verifiedUsersCount: number
  newSignups7d: number
  suspendedCount: number
  pendingKycCount: number
  openSupportTicketsCount: number
  topCustomersByBalance: Array<{
    id: string
    displayName: string
    email: string
    internetBankingId?: string | null
    totalBalanceCents: number
  }>
  pendingApprovalsPreview: Array<{
    id: string
    title: string
    type: string
    createdAt: string
    status: string
  }>
  recentApprovedApprovals: Array<{
    id: string
    title: string
    type: string
    when: string
  }>
  recentActivity: Array<{
    ts: string
    action: string
    target: string | null
  }>
}

export type AdminCustomerRow = {
  id: string
  email: string
  displayName: string
  createdAt: string
  emailOtpEnabled: boolean
  internetBankingId?: string | null
  hasTransactionPin?: boolean
  /** Operator fraud / security hold — customer sees read-only banking. */
  onlineBankingRestricted?: boolean
  openAccountInterest?: string[]
  onboardingStatus?: string | null
}

export type AdminCustomerDetail = AdminCustomerRow & {
  onlineBankingRestrictionReason?: string | null
  onboardingUpdatedAt?: string | null
  businessLegalName?: string | null
  businessTradeName?: string | null
  loanApplicationCount?: number
  fixedDepositCount?: number
  dpsPlanCount?: number
  fxHoldingCount?: number
  accounts: Array<{
    id: string
    name: string
    mask: string
    type: string
    balanceCents: number
  }>
  totalBalanceCents: number
  scheduledBillCount: number
  activityCount: number
  pendingApprovals: number
  recentApprovals: ApprovalItem[]
}

export type AdminAuditEvent = {
  ts: string
  action: string
  actorType: string
  actorId: string | null
  target: string | null
  ip: string | null
  meta: unknown
}

async function adminGetJson<T>(path: string): Promise<T> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const r = await fetch(`${getApiBase()}${path}`, {
    headers: { Authorization: `Bearer ${t}` },
  })
  const data = await readJsonBody<T & { ok?: boolean; error?: string }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(
      (data as { error?: string }).error ?? 'Session expired.',
    )
  }
  if (!r.ok || !(data as { ok?: boolean }).ok) {
    throw new Error(
      (data as { error?: string }).error ?? 'Request failed.',
    )
  }
  return data
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const data = await adminGetJson<{ ok: true; overview: AdminOverview }>(
    '/api/admin/overview',
  )
  return data.overview
}

export async function fetchAdminCustomers(): Promise<AdminCustomerRow[]> {
  const data = await adminGetJson<{ ok: true; customers: AdminCustomerRow[] }>(
    '/api/admin/customers',
  )
  return data.customers
}

export async function fetchAdminCustomer(
  userId: string,
): Promise<AdminCustomerDetail> {
  const enc = encodeURIComponent(userId)
  const data = await adminGetJson<{
    ok: true
    customer: AdminCustomerDetail
  }>(`/api/admin/customers/${enc}`)
  return data.customer
}

/** Issues customer session tokens for operator “sign in as user” (audit logged server-side). */
export async function postAdminCustomerImpersonate(userId: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(userId)
  const r = await fetch(
    `${getApiBase()}/api/admin/customers/${enc}/impersonate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  )
  const data = await readJsonBody<{
    ok?: boolean
    accessToken?: string
    refreshToken?: string
    expiresIn?: number
    user?: AuthUser
    error?: string
    code?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (
    !r.ok ||
    !data.ok ||
    typeof data.accessToken !== 'string' ||
    typeof data.refreshToken !== 'string' ||
    typeof data.expiresIn !== 'number' ||
    !data.user
  ) {
    throw new Error(data.error ?? 'Could not sign in as customer.')
  }
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    user: data.user,
  }
}

/** Payload from PATCH customer (approval queue fields only on GET full detail). */
export type AdminCustomerRecord = Omit<
  AdminCustomerDetail,
  'pendingApprovals' | 'recentApprovals'
>

export type AdminPatchCustomerBody = {
  displayName?: string
  email?: string
  emailOtpEnabled?: boolean
  /** Signs the customer out of all sessions when set. */
  newPassword?: string
}

export async function patchAdminCustomer(
  userId: string,
  body: AdminPatchCustomerBody,
): Promise<AdminCustomerRecord> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(userId)
  const r = await fetch(`${getApiBase()}/api/admin/customers/${enc}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    customer?: AdminCustomerRecord
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.customer) {
    throw new Error(data.error ?? 'Could not update customer.')
  }
  return data.customer
}

/** Email outcome when access restriction is applied or removed. */
export type AccessEmailNotice =
  | 'sent'
  | 'skipped_no_recipient'
  | 'skipped_no_smtp'
  | 'skipped_send_failed'

/** @deprecated use AccessEmailNotice */
export type LockoutEmailNotice = AccessEmailNotice

export async function patchAdminCustomerAccess(
  userId: string,
  body: { restricted: boolean; reason?: string },
): Promise<{
  onlineBankingRestricted: boolean
  onlineBankingRestrictionReason: string | null
  lockoutEmailNotice?: AccessEmailNotice
  unlockEmailNotice?: AccessEmailNotice
}> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(userId)
  const r = await fetch(`${getApiBase()}/api/admin/customers/${enc}/access`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    onlineBankingRestricted?: boolean
    onlineBankingRestrictionReason?: string | null
    lockoutEmailNotice?: AccessEmailNotice
    unlockEmailNotice?: AccessEmailNotice
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (
    !r.ok ||
    !data.ok ||
    typeof data.onlineBankingRestricted !== 'boolean'
  ) {
    const raw =
      typeof data.error === 'string' && data.error.trim() ? data.error.trim() : ''
    if (
      raw === 'Not found.' ||
      raw.startsWith('No matching API route')
    ) {
      throw new Error(
        'Saving access settings failed: the API did not expose this endpoint. Restart the Node API server (same NOTIFY_PORT Vite proxies to), then try again.',
      )
    }
    throw new Error(raw || 'Could not update access.')
  }
  return {
    onlineBankingRestricted: data.onlineBankingRestricted,
    onlineBankingRestrictionReason:
      typeof data.onlineBankingRestrictionReason === 'string'
        ? data.onlineBankingRestrictionReason
        : null,
    ...(data.lockoutEmailNotice ? { lockoutEmailNotice: data.lockoutEmailNotice } : {}),
    ...(data.unlockEmailNotice ? { unlockEmailNotice: data.unlockEmailNotice } : {}),
  }
}

export async function postAdminCustomerDeposit(
  userId: string,
  input: {
    accountId: string
    amountCents: number
    memo?: string
    postedOn?: string
    bookedAt?: string
  },
): Promise<string | null> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(userId)
  const postedOn =
    typeof input.postedOn === 'string' ? input.postedOn.trim().slice(0, 12) : ''
  const bookedAt =
    typeof input.bookedAt === 'string' ? input.bookedAt.trim().slice(0, 80) : ''
  const r = await fetch(`${getApiBase()}/api/admin/customers/${enc}/deposit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: input.accountId,
      amountCents: input.amountCents,
      ...(input.memo?.trim() ? { memo: input.memo.trim() } : {}),
      ...(postedOn ? { postedOn } : {}),
      ...(bookedAt ? { bookedAt } : {}),
    }),
  })
  const data = await readJsonBody<{
    ok?: boolean
    error?: string
    banking?: { activity?: Array<{ id?: string }> }
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok) {
    throw new Error(data.error ?? 'Deposit failed.')
  }
  const top = data.banking?.activity?.[0]?.id
  return typeof top === 'string' ? top : null
}

export async function postAdminCustomerWithdrawal(
  userId: string,
  input: {
    accountId: string
    amountCents: number
    memo?: string
    postedOn?: string
    bookedAt?: string
  },
): Promise<string | null> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(userId)
  const postedOn =
    typeof input.postedOn === 'string' ? input.postedOn.trim().slice(0, 12) : ''
  const bookedAt =
    typeof input.bookedAt === 'string' ? input.bookedAt.trim().slice(0, 80) : ''
  const r = await fetch(`${getApiBase()}/api/admin/customers/${enc}/withdrawal`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: input.accountId,
      amountCents: input.amountCents,
      ...(input.memo?.trim() ? { memo: input.memo.trim() } : {}),
      ...(postedOn ? { postedOn } : {}),
      ...(bookedAt ? { bookedAt } : {}),
    }),
  })
  const data = await readJsonBody<{
    ok?: boolean
    error?: string
    banking?: { activity?: Array<{ id?: string }> }
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok) {
    throw new Error(data.error ?? 'Withdrawal failed.')
  }
  const top = data.banking?.activity?.[0]?.id
  return typeof top === 'string' ? top : null
}

export async function fetchAdminAuditEvents(params?: {
  limit?: number
}): Promise<AdminAuditEvent[]> {
  const q = new URLSearchParams()
  if (params?.limit != null) q.set('limit', String(params.limit))
  const path =
    `/api/admin/audit-events${q.toString() ? `?${q}` : ''}`
  const data = await adminGetJson<{ ok: true; events: AdminAuditEvent[] }>(
    path,
  )
  return data.events
}

export async function fetchAdminApprovalById(
  id: string,
): Promise<ApprovalItem> {
  const enc = encodeURIComponent(id)
  const data = await adminGetJson<{ ok: true; item: ApprovalItem }>(
    `/api/admin/approvals/${enc}`,
  )
  return data.item
}

export async function fetchAdminKycSubmissions(params?: {
  status?: string
  limit?: number
}): Promise<KycSubmission[]> {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.limit != null) q.set('limit', String(params.limit))
  const path = `/api/admin/kyc${q.toString() ? `?${q}` : ''}`
  const data = await adminGetJson<{ ok: true; items: KycSubmission[] }>(path)
  return data.items
}

export async function fetchAdminKycDocumentBlob(
  submissionId: string,
  docId: string,
): Promise<Blob> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const sid = encodeURIComponent(submissionId)
  const did = encodeURIComponent(docId)
  const r = await fetch(
    `${getApiBase()}/api/admin/kyc/${sid}/documents/${did}/file`,
    { headers: { Authorization: `Bearer ${t}` } },
  )
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error('Session expired.')
  }
  if (!r.ok) {
    const text = await r.text()
    let msg = 'Could not load file.'
    try {
      const j = JSON.parse(text) as { error?: string }
      if (typeof j.error === 'string' && j.error.trim()) msg = j.error.trim()
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return r.blob()
}

export async function fetchAdminSupportTickets(params?: {
  status?: SupportTicketStatus | ''
  assignedTo?: string
  limit?: number
}): Promise<SupportTicket[]> {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.assignedTo != null && params.assignedTo !== '') {
    q.set('assignedTo', params.assignedTo)
  }
  if (params?.limit != null) q.set('limit', String(params.limit))
  const path = `/api/admin/support/tickets${q.toString() ? `?${q}` : ''}`
  const data = await adminGetJson<{ ok: true; items: SupportTicket[] }>(path)
  return data.items
}

export async function fetchAdminSupportTicket(
  id: string,
): Promise<SupportTicket> {
  const enc = encodeURIComponent(id)
  const data = await adminGetJson<{ ok: true; item: SupportTicket }>(
    `/api/admin/support/tickets/${enc}`,
  )
  return data.item
}

export async function patchAdminSupportTicket(
  id: string,
  body: {
    status?: SupportTicketStatus
    assignedTo?: string | null
    linkedAccountIds?: string[]
  },
): Promise<SupportTicket> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(id)
  const r = await fetch(`${getApiBase()}/api/admin/support/tickets/${enc}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    item?: SupportTicket
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.item) {
    throw new Error(data.error ?? 'Update failed.')
  }
  return data.item
}

export async function postAdminSupportTicketMessage(
  id: string,
  body: { body: string; staffLabel?: string },
): Promise<SupportTicket> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(id)
  const r = await fetch(
    `${getApiBase()}/api/admin/support/tickets/${enc}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  const data = await readJsonBody<{
    ok?: boolean
    item?: SupportTicket
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.item) {
    throw new Error(data.error ?? 'Could not send reply.')
  }
  return data.item
}

export async function patchAdminKycSubmission(
  id: string,
  body: {
    riskLevel?: KycSubmission['riskLevel']
    documentExpiresAt?: string | null
    complianceNotes?: string
    decision?: 'approve' | 'reject'
    decisionNote?: string
  },
): Promise<KycSubmission> {
  const t = getAdminToken()
  if (!t) throw new Error('Not signed in.')
  const enc = encodeURIComponent(id)
  const r = await fetch(`${getApiBase()}/api/admin/kyc/${enc}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await readJsonBody<{
    ok?: boolean
    item?: KycSubmission
    error?: string
  }>(r)
  if (r.status === 401 || r.status === 403) {
    clearAdminToken()
    throw new Error(data.error ?? 'Session expired.')
  }
  if (!r.ok || !data.ok || !data.item) {
    throw new Error(data.error ?? 'Update failed.')
  }
  return data.item
}
