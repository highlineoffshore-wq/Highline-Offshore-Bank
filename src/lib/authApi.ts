import { getApiBase } from './apiBase'

const ACCESS_KEY = 'bw_customer_access'
const REFRESH_KEY = 'bw_customer_refresh'
/** @deprecated migrated on read */
const LEGACY_SESSION_KEY = 'bw_customer_session'
/**
 * Set only when an operator uses admin “Sign in as customer”; enables the
 * Return to operator console control in the banking app header.
 */
const OPERATOR_IMPERSONATION_RETURN_KEY = 'bw_operator_impersonation_return'

export type AuthUser = {
  id: string
  /** 10-digit Internet Banking ID (sign-in with this or email). */
  internetBankingId?: string | null
  email: string
  displayName: string
  emailOtpEnabled?: boolean
  /** When true, payment requests require `transactionPin` on `/api/approvals`. */
  hasTransactionPin?: boolean
}

export const ONLINE_BANKING_RESTRICTED_CODE = 'ONLINE_BANKING_RESTRICTED' as const

export type OnlineBankingAccessBlockPayload = {
  error: string
  supportEmail: string
}

export type ApiMeResult =
  | { status: 'signed_in'; user: AuthUser }
  | { status: 'signed_out' }
  | { status: 'restricted'; error: string; supportEmail: string }

function restrictionBlockFromBody(data: Record<string, unknown>) {
  const supportEmail =
    typeof data.supportEmail === 'string' && data.supportEmail.trim()
      ? data.supportEmail.trim()
      : 'support@example.com'
  const defaultError = `You cannot use online banking due to suspicions of fraudulent activity. Contact us by email: ${supportEmail}.`
  const block: OnlineBankingAccessBlockPayload = {
    error:
      typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : defaultError,
    supportEmail,
  }
  return block
}

function emitOnlineBankingRestricted(block: OnlineBankingAccessBlockPayload) {
  clearCustomerToken()
  window.dispatchEvent(
    new CustomEvent('bw-online-banking-restricted', { detail: block }),
  )
}

async function emitIfOnlineBankingRestrictedResponse(res: Response) {
  if (res.status !== 403) return
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  if (!ct.includes('json')) return
  let raw: Record<string, unknown>
  try {
    raw = (await res.clone().json()) as Record<string, unknown>
  } catch {
    return
  }
  if (raw.code !== ONLINE_BANKING_RESTRICTED_CODE) return
  emitOnlineBankingRestricted(restrictionBlockFromBody(raw))
}

export type LoginNext =
  | { next: 'app'; user: AuthUser }
  | {
      next: 'mfa'
      loginChallengeId: string
      maskedEmail: string | null
      /** Additional emails allowed after the first (max 3 resends). */
      otpResendsRemaining: number
    }

export function getCustomerToken(): string | null {
  try {
    const a = sessionStorage.getItem(ACCESS_KEY)
    if (a) return a
    const legacy = sessionStorage.getItem(LEGACY_SESSION_KEY)
    if (legacy) {
      sessionStorage.setItem(ACCESS_KEY, legacy)
      sessionStorage.removeItem(LEGACY_SESSION_KEY)
      return legacy
    }
    return null
  } catch {
    return null
  }
}

export function getRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

export function setCustomerTokens(accessToken: string, refreshToken: string) {
  try {
    sessionStorage.setItem(ACCESS_KEY, accessToken)
    sessionStorage.setItem(REFRESH_KEY, refreshToken)
    sessionStorage.removeItem(LEGACY_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** Customer session created from admin impersonation — shows Return to console in header. */
export function setCustomerTokensFromAdminImpersonation(
  accessToken: string,
  refreshToken: string,
) {
  setCustomerTokens(accessToken, refreshToken)
  try {
    sessionStorage.setItem(OPERATOR_IMPERSONATION_RETURN_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** True when this banking tab was opened via operator “Sign in as customer”. */
export function hasOperatorConsoleReturnHint(): boolean {
  try {
    return sessionStorage.getItem(OPERATOR_IMPERSONATION_RETURN_KEY) === '1'
  } catch {
    return false
  }
}

export function clearCustomerToken() {
  try {
    sessionStorage.removeItem(ACCESS_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(LEGACY_SESSION_KEY)
    sessionStorage.removeItem(OPERATOR_IMPERSONATION_RETURN_KEY)
  } catch {
    /* ignore */
  }
}

async function tryRefreshToken(): Promise<boolean> {
  const rt = getRefreshToken()
  if (!rt) return false
  const r = await fetch(`${getApiBase()}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  })
  const data = (await r.json()) as {
    ok?: boolean
    accessToken?: string
    refreshToken?: string
    code?: string
  }
  if (r.status === 403 && data.code === ONLINE_BANKING_RESTRICTED_CODE) {
    emitOnlineBankingRestricted(restrictionBlockFromBody(data as Record<string, unknown>))
    return false
  }
  if (!r.ok || !data.ok || !data.accessToken || !data.refreshToken) {
    clearCustomerToken()
    return false
  }
  setCustomerTokens(data.accessToken, data.refreshToken)
  return true
}

/**
 * Authenticated customer fetch: retries once after refresh on 401.
 */
export async function customerFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  const access = getCustomerToken()
  if (access) headers.set('Authorization', `Bearer ${access}`)
  let res = await fetch(url, { ...init, headers })
  await emitIfOnlineBankingRestrictedResponse(res)
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      headers.set('Authorization', `Bearer ${getCustomerToken()}`)
      res = await fetch(url, { ...init, headers })
      await emitIfOnlineBankingRestrictedResponse(res)
    }
  }
  return res
}

export async function apiMe(): Promise<ApiMeResult> {
  const t = getCustomerToken()
  if (!t) return { status: 'signed_out' }
  const r = await customerFetch(`${getApiBase()}/api/auth/me`)
  const data = (await r.json()) as {
    ok?: boolean
    user?: AuthUser
    code?: string
    error?: string
    supportEmail?: string
  }
  if (r.status === 403 && data.code === ONLINE_BANKING_RESTRICTED_CODE) {
    clearCustomerToken()
    return {
      status: 'restricted',
      ...restrictionBlockFromBody(data as Record<string, unknown>),
    }
  }
  if (!r.ok || !data.ok || !data.user) {
    clearCustomerToken()
    return { status: 'signed_out' }
  }
  return { status: 'signed_in', user: data.user }
}

const LOGIN_FETCH_MS = 45_000

const API_HTML_HINT =
  'From the repo root run npm run dev (API + Vite). If the API port is busy, set NOTIFY_PORT in server/.env and restart (Vite reads it for the proxy). Check http://127.0.0.1:<NOTIFY_PORT>/api/health — expect {"ok":true,"service":"banking-api"}.'

async function readJsonBody(
  r: Response,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const ct = (r.headers.get('content-type') || '').toLowerCase()
  const text = await r.text()
  const trimmed = text.trim()
  if (!trimmed) {
    if (!r.ok) {
      return {
        ok: false,
        error: `Empty response from API (${r.status}). ${API_HTML_HINT}`,
      }
    }
    return { ok: true, data: {} }
  }
  if (trimmed.startsWith('<') || ct.includes('text/html')) {
    const wrongService =
      r.status === 404 &&
      /cannot post\s+\/api\//i.test(trimmed.replace(/\s+/g, ' '))
    return {
      ok: false,
      error: wrongService
        ? `Wrong service on the API port (${r.status}): another app answered instead of this banking API. Pick a free NOTIFY_PORT in server/.env (e.g. 8791), restart npm run dev, and curl http://127.0.0.1:<port>/api/health — you should see {"ok":true,"service":"banking-api"}.`
        : `No JSON from API (${r.status}). ${API_HTML_HINT}`,
    }
  }
  try {
    const data = JSON.parse(text) as unknown
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'Unexpected response from server.' }
    }
    return { ok: true, data: data as Record<string, unknown> }
  } catch {
    return {
      ok: false,
      error: `Invalid response from server (${r.status}). ${API_HTML_HINT}`,
    }
  }
}

export async function apiLogin(
  loginIdOrEmail: string,
  password: string,
): Promise<
  | { ok: true; login: LoginNext }
  | { ok: false; error: string; accessBlock?: OnlineBankingAccessBlockPayload }
> {
  let r: Response
  try {
    r = await fetch(`${getApiBase()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: loginIdOrEmail.trim(), password }),
      signal: AbortSignal.timeout(LOGIN_FETCH_MS),
    })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, error: 'Sign-in timed out. Try again.' }
    }
    return { ok: false, error: 'Could not reach the server. Check your connection.' }
  }

  const parsed = await readJsonBody(r)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  const data = parsed.data as {
    ok?: boolean
    step?: string
    loginChallengeId?: string
    maskedEmail?: string | null
    otpResendsRemaining?: number
    accessToken?: string
    refreshToken?: string
    expiresIn?: number
    user?: AuthUser
    error?: string
  }

  if (!r.ok || !data.ok) {
    const body = parsed.data as Record<string, unknown>
    if (r.status === 403 && body.code === ONLINE_BANKING_RESTRICTED_CODE) {
      const accessBlock = restrictionBlockFromBody(body)
      return { ok: false, error: accessBlock.error, accessBlock }
    }
    return { ok: false, error: data.error ?? 'Sign-in failed.' }
  }
  const stepNorm =
    typeof data.step === 'string' ? data.step.trim().toLowerCase() : ''
  const challengeId =
    typeof data.loginChallengeId === 'string'
      ? data.loginChallengeId.trim()
      : ''
  if (stepNorm === 'mfa' && challengeId) {
    const remaining =
      typeof data.otpResendsRemaining === 'number' &&
      Number.isFinite(data.otpResendsRemaining)
        ? Math.max(0, Math.floor(data.otpResendsRemaining))
        : 3
    return {
      ok: true,
      login: {
        next: 'mfa',
        loginChallengeId: challengeId,
        maskedEmail:
          typeof data.maskedEmail === 'string' ? data.maskedEmail : null,
        otpResendsRemaining: remaining,
      },
    }
  }
  if (
    data.accessToken &&
    data.refreshToken &&
    data.user &&
    (data.step === 'session' || data.step === undefined)
  ) {
    setCustomerTokens(data.accessToken, data.refreshToken)
    return { ok: true, login: { next: 'app', user: data.user } }
  }
  return { ok: false, error: data.error ?? 'Sign-in failed.' }
}

export async function apiVerifyLoginCode(
  loginChallengeId: string,
  code: string,
): Promise<
  | { ok: true; user: AuthUser }
  | { ok: false; error: string; accessBlock?: OnlineBankingAccessBlockPayload }
> {
  let r: Response
  try {
    r = await fetch(`${getApiBase()}/api/auth/verify-login-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginChallengeId, code }),
      signal: AbortSignal.timeout(LOGIN_FETCH_MS),
    })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, error: 'Verification timed out. Try again.' }
    }
    return { ok: false, error: 'Could not reach the server.' }
  }

  const parsed = await readJsonBody(r)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  const body = parsed.data as Record<string, unknown>
  if (r.status === 403 && body.code === ONLINE_BANKING_RESTRICTED_CODE) {
    const accessBlock = restrictionBlockFromBody(body)
    return { ok: false, error: accessBlock.error, accessBlock }
  }
  const data = parsed.data as {
    ok?: boolean
    accessToken?: string
    refreshToken?: string
    user?: AuthUser
    error?: string
  }
  if (
    !r.ok ||
    !data.ok ||
    !data.accessToken ||
    !data.refreshToken ||
    !data.user
  ) {
    return { ok: false, error: data.error ?? 'Verification failed.' }
  }
  setCustomerTokens(data.accessToken, data.refreshToken)
  return { ok: true, user: data.user }
}

export async function apiStartWireTransferOtp(): Promise<
  | { ok: true; skipped: true }
  | {
      ok: true
      skipped: false
      wireOtpChallengeId: string
      maskedEmail: string | null
      otpResendsRemaining: number
    }
  | { ok: false; error: string }
> {
  const r = await customerFetch(
    `${getApiBase()}/api/auth/wire-transfer-otp/start`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
  )
  const data = (await r.json()) as {
    ok?: boolean
    skipped?: boolean
    wireOtpChallengeId?: string
    maskedEmail?: string | null
    otpResendsRemaining?: number
    error?: string
  }
  if (!r.ok || !data.ok) {
    return {
      ok: false,
      error: data.error ?? 'Could not send verification email.',
    }
  }
  if (data.skipped === true) {
    return { ok: true, skipped: true }
  }
  const id =
    typeof data.wireOtpChallengeId === 'string'
      ? data.wireOtpChallengeId.trim()
      : ''
  if (!id) {
    return { ok: false, error: 'Unexpected response from server.' }
  }
  const remaining =
    typeof data.otpResendsRemaining === 'number' &&
    Number.isFinite(data.otpResendsRemaining)
      ? Math.max(0, Math.floor(data.otpResendsRemaining))
      : 3
  return {
    ok: true,
    skipped: false,
    wireOtpChallengeId: id,
    maskedEmail:
      typeof data.maskedEmail === 'string' ? data.maskedEmail : null,
    otpResendsRemaining: remaining,
  }
}

export async function apiResendWireTransferOtp(
  previousWireOtpChallengeId: string,
): Promise<
  | {
      ok: true
      wireOtpChallengeId: string
      maskedEmail: string | null
      otpResendsRemaining: number
    }
  | { ok: false; error: string }
> {
  const r = await customerFetch(
    `${getApiBase()}/api/auth/wire-transfer-otp/resend`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previousWireOtpChallengeId }),
    },
  )
  const data = (await r.json()) as {
    ok?: boolean
    wireOtpChallengeId?: string
    maskedEmail?: string | null
    otpResendsRemaining?: number
    error?: string
  }
  if (!r.ok || !data.ok) {
    return {
      ok: false,
      error: data.error ?? 'Could not resend verification email.',
    }
  }
  const id =
    typeof data.wireOtpChallengeId === 'string'
      ? data.wireOtpChallengeId.trim()
      : ''
  if (!id) {
    return { ok: false, error: 'Unexpected response from server.' }
  }
  const remaining =
    typeof data.otpResendsRemaining === 'number' &&
    Number.isFinite(data.otpResendsRemaining)
      ? Math.max(0, Math.floor(data.otpResendsRemaining))
      : 0
  return {
    ok: true,
    wireOtpChallengeId: id,
    maskedEmail:
      typeof data.maskedEmail === 'string' ? data.maskedEmail : null,
    otpResendsRemaining: remaining,
  }
}

export async function apiResendLoginOtp(loginChallengeId: string): Promise<
  | {
      ok: true
      loginChallengeId: string
      maskedEmail: string | null
      otpResendsRemaining: number
    }
  | { ok: false; error: string }
> {
  let r: Response
  try {
    r = await fetch(`${getApiBase()}/api/auth/login-otp/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginChallengeId }),
      signal: AbortSignal.timeout(LOGIN_FETCH_MS),
    })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, error: 'Request timed out. Try again.' }
    }
    return { ok: false, error: 'Could not reach the server.' }
  }
  const data = (await r.json()) as {
    ok?: boolean
    loginChallengeId?: string
    maskedEmail?: string | null
    otpResendsRemaining?: number
    error?: string
  }
  if (!r.ok || !data.ok) {
    return {
      ok: false,
      error: data.error ?? 'Could not resend code.',
    }
  }
  const id =
    typeof data.loginChallengeId === 'string'
      ? data.loginChallengeId.trim()
      : ''
  if (!id) {
    return { ok: false, error: 'Unexpected response from server.' }
  }
  const remaining =
    typeof data.otpResendsRemaining === 'number' &&
    Number.isFinite(data.otpResendsRemaining)
      ? Math.max(0, Math.floor(data.otpResendsRemaining))
      : 0
  return {
    ok: true,
    loginChallengeId: id,
    maskedEmail:
      typeof data.maskedEmail === 'string' ? data.maskedEmail : null,
    otpResendsRemaining: remaining,
  }
}

export async function apiPatchPassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthUser> {
  const r = await customerFetch(`${getApiBase()}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  const data = (await r.json()) as {
    ok?: boolean
    user?: AuthUser
    error?: string
  }
  if (!r.ok || !data.ok || !data.user) {
    throw new Error(data.error ?? 'Could not change password.')
  }
  return data.user
}

export async function apiPatchEmailOtp(
  enabled: boolean,
  password: string,
): Promise<AuthUser> {
  const r = await customerFetch(`${getApiBase()}/api/auth/email-otp`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, password }),
  })
  const data = (await r.json()) as {
    ok?: boolean
    user?: AuthUser
    error?: string
  }
  if (!r.ok || !data.ok || !data.user) {
    throw new Error(data.error ?? 'Could not update sign-in verification.')
  }
  return data.user
}

export async function apiPatchTransactionPin(
  password: string,
  newPin: string,
): Promise<AuthUser> {
  const r = await customerFetch(`${getApiBase()}/api/auth/transaction-pin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, newPin }),
  })
  const data = (await r.json()) as {
    ok?: boolean
    user?: AuthUser
    error?: string
  }
  if (!r.ok || !data.ok || !data.user) {
    throw new Error(data.error ?? 'Could not update transaction PIN.')
  }
  return data.user
}

export async function apiRegister(
  email: string,
  password: string,
  displayName: string,
  openAccountInterest?: string[],
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const r = await fetch(`${getApiBase()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      displayName,
      ...(openAccountInterest?.length
        ? { openAccountInterest }
        : {}),
    }),
  })
  const data = (await r.json()) as {
    ok?: boolean
    accessToken?: string
    refreshToken?: string
    user?: AuthUser
    error?: string
  }
  if (
    !r.ok ||
    !data.ok ||
    !data.accessToken ||
    !data.refreshToken ||
    !data.user
  ) {
    return { ok: false, error: data.error ?? 'Registration failed.' }
  }
  setCustomerTokens(data.accessToken, data.refreshToken)
  return { ok: true, user: data.user }
}

export async function apiLogout(): Promise<void> {
  const access = getCustomerToken()
  const refresh = getRefreshToken()
  if (access) {
    try {
      await fetch(`${getApiBase()}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          refresh ? { refreshToken: refresh } : {},
        ),
      })
    } catch {
      /* ignore */
    }
  }
  clearCustomerToken()
}

export type ApiPatchProfileInput = {
  displayName: string
}

export async function apiPatchProfile(
  input: ApiPatchProfileInput,
): Promise<AuthUser> {
  if (typeof input.displayName !== 'string') {
    throw new Error('Nothing to update.')
  }
  const r = await customerFetch(`${getApiBase()}/api/auth/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: input.displayName }),
  })
  const data = (await r.json()) as {
    ok?: boolean
    user?: AuthUser
    error?: string
  }
  if (!r.ok || !data.ok || !data.user) {
    throw new Error(data.error ?? 'Could not update profile.')
  }
  return data.user
}

export async function apiStartEmailChange(
  newEmail: string,
  password: string,
): Promise<{
  emailChangeChallengeId: string
  maskedEmail: string | null
}> {
  const r = await customerFetch(`${getApiBase()}/api/auth/email-change/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newEmail, password }),
  })
  const data = (await r.json()) as {
    ok?: boolean
    emailChangeChallengeId?: string
    maskedEmail?: string | null
    error?: string
  }
  if (
    !r.ok ||
    !data.ok ||
    typeof data.emailChangeChallengeId !== 'string'
  ) {
    throw new Error(data.error ?? 'Could not send verification email.')
  }
  return {
    emailChangeChallengeId: data.emailChangeChallengeId,
    maskedEmail:
      typeof data.maskedEmail === 'string' ? data.maskedEmail : null,
  }
}

export async function apiConfirmEmailChange(
  emailChangeChallengeId: string,
  code: string,
): Promise<AuthUser> {
  const r = await customerFetch(`${getApiBase()}/api/auth/email-change/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailChangeChallengeId, code }),
  })
  const data = (await r.json()) as {
    ok?: boolean
    user?: AuthUser
    error?: string
  }
  if (!r.ok || !data.ok || !data.user) {
    throw new Error(data.error ?? 'Verification failed.')
  }
  return data.user
}

export async function apiUpdateDisplayName(
  displayName: string,
): Promise<AuthUser> {
  return apiPatchProfile({ displayName })
}
