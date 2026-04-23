import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '..', 'data', 'users-store.json')

const SESSION_DAYS = 30
const ACCESS_TTL_MS = 15 * 60 * 1000
const REFRESH_TTL_MS = SESSION_DAYS * 86400_000
const BCRYPT_ROUNDS = 11

function ensureDir() {
  const dir = path.dirname(DATA_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function generateInternetBankingId(data) {
  for (;;) {
    const ib = String(Math.floor(1_000_000_000 + Math.random() * 9_000_000_000))
    const clash = Object.values(data.users).some((u) => u.internetBankingId === ib)
    if (!clash) return ib
  }
}

function cardTxnUid() {
  return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function randomCardLast4() {
  return String(1000 + Math.floor(Math.random() * 9000))
}

function defaultDebitCardShape() {
  const now = new Date()
  const y = now.getFullYear() + 3
  const m = now.getMonth() + 1
  return {
    last4: '0000',
    expMonth: m,
    expYear: y,
    locked: false,
    travelNoticeEnabled: false,
    contactlessEnabled: true,
    cardType: 'physical',
    issuedAt: null,
    adminFrozen: false,
    stolenBlocked: false,
    singleTransactionLimitCents: null,
    dailySpendLimitCents: null,
    transactions: [],
  }
}

function ensureDebitCardShape(banking) {
  if (!banking || typeof banking !== 'object') return
  if (!banking.debitCard || typeof banking.debitCard !== 'object') {
    banking.debitCard = defaultDebitCardShape()
    return
  }
  const d = banking.debitCard
  if (typeof d.last4 !== 'string' || !/^\d{4}$/.test(d.last4)) d.last4 = '0000'
  d.expMonth = Math.min(12, Math.max(1, Math.round(Number(d.expMonth)) || 12))
  const ey = Math.round(Number(d.expYear))
  d.expYear = Number.isFinite(ey) && ey >= 2000 ? ey : new Date().getFullYear() + 3
  d.locked = Boolean(d.locked)
  d.travelNoticeEnabled = Boolean(d.travelNoticeEnabled)
  d.contactlessEnabled = d.contactlessEnabled !== false
  d.cardType = d.cardType === 'virtual' ? 'virtual' : 'physical'
  d.issuedAt =
    d.issuedAt === null || d.issuedAt === undefined
      ? null
      : typeof d.issuedAt === 'string'
        ? d.issuedAt
        : null
  d.adminFrozen = Boolean(d.adminFrozen)
  d.stolenBlocked = Boolean(d.stolenBlocked)
  const st = d.singleTransactionLimitCents
  d.singleTransactionLimitCents =
    st != null && Number.isFinite(Number(st)) && Number(st) > 0
      ? Math.round(Number(st))
      : null
  const dy = d.dailySpendLimitCents
  d.dailySpendLimitCents =
    dy != null && Number.isFinite(Number(dy)) && Number(dy) > 0
      ? Math.round(Number(dy))
      : null
  if (!Array.isArray(d.transactions)) d.transactions = []
}

function ensureBankingProductShape(banking) {
  if (!banking || typeof banking !== 'object') return
  if (!Array.isArray(banking.loanApplications)) banking.loanApplications = []
  if (!Array.isArray(banking.fixedDeposits)) banking.fixedDeposits = []
  if (!Array.isArray(banking.dpsPlans)) banking.dpsPlans = []
  if (!Array.isArray(banking.fxHoldings)) banking.fxHoldings = []
  ensureDebitCardShape(banking)
}

/**
 * Upgrade persisted users for Internet Banking ID, optional TX PIN, product modules.
 * @param {object} data
 * @returns {boolean} whether JSON was rewritten
 */
function migrateStoreShape(data) {
  if (!data || typeof data.users !== 'object') return false
  let changed = false
  for (const u of Object.values(data.users)) {
    if (!u.internetBankingId) {
      u.internetBankingId = generateInternetBankingId(data)
      changed = true
    }
    if (u.transactionPinHash === undefined) {
      u.transactionPinHash = null
      changed = true
    }
    if (u.banking) {
      const before = JSON.stringify({
        la: u.banking.loanApplications,
        fd: u.banking.fixedDeposits,
        dp: u.banking.dpsPlans,
        fx: u.banking.fxHoldings,
        dc: u.banking.debitCard,
      })
      ensureBankingProductShape(u.banking)
      const after = JSON.stringify({
        la: u.banking.loanApplications,
        fd: u.banking.fixedDeposits,
        dp: u.banking.dpsPlans,
        fx: u.banking.fxHoldings,
        dc: u.banking.debitCard,
      })
      if (before !== after) changed = true
    }
    if (u.onlineBankingRestricted !== true && u.onlineBankingRestricted !== false) {
      u.onlineBankingRestricted = false
      changed = true
    }
    if (u.onlineBankingRestrictionReason === undefined) {
      u.onlineBankingRestrictionReason = null
      changed = true
    } else if (
      u.onlineBankingRestrictionReason !== null &&
      typeof u.onlineBankingRestrictionReason !== 'string'
    ) {
      u.onlineBankingRestrictionReason = null
      changed = true
    }
    if (!u.customerOnboarding || typeof u.customerOnboarding !== 'object') {
      const interests =
        Array.isArray(u.openAccountInterest) && u.openAccountInterest.length
          ? u.openAccountInterest
          : ['not_sure']
      if (!Array.isArray(u.openAccountInterest) || u.openAccountInterest.length === 0) {
        u.openAccountInterest = [...interests]
      }
      u.customerOnboarding = {
        version: 1,
        status: 'active',
        lastClientStepKey: 'legacy_backfill',
        interests: [...interests],
        updatedAt: u.createdAt || new Date().toISOString(),
      }
      changed = true
    }
  }
  return changed
}

function readStore() {
  ensureDir()
  if (!fs.existsSync(DATA_PATH)) {
    const initial = { users: {}, sessions: {}, refreshById: {} }
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2), 'utf8')
    return initial
  }
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8')
    const data = JSON.parse(raw)
    if (!data || typeof data.users !== 'object' || typeof data.sessions !== 'object')
      return { users: {}, sessions: {}, refreshById: {} }
    if (!data.refreshById || typeof data.refreshById !== 'object')
      data.refreshById = {}
    if (migrateStoreShape(data)) writeStore(data)
    return data
  } catch {
    return { users: {}, sessions: {}, refreshById: {} }
  }
}

function writeStore(data) {
  ensureDir()
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8')
}

export function createInitialBankingState() {
  return {
    accounts: [
      {
        id: 'chk',
        name: 'Premier Checking',
        mask: '4821',
        type: 'Checking',
        balanceCents: 0,
      },
      {
        id: 'sav',
        name: 'High Yield Savings',
        mask: '9033',
        type: 'Savings',
        balanceCents: 0,
      },
    ],
    activity: [],
    scheduledBillPayments: [],
    debitCard: {
      ...defaultDebitCardShape(),
      last4: '2847',
      expMonth: 9,
      expYear: 2028,
      issuedAt: new Date().toISOString(),
    },
    replacementBanner: null,
    loanApplications: [],
    fixedDeposits: [],
    dpsPlans: [],
    fxHoldings: [],
  }
}

function newUserId() {
  return `usr_${crypto.randomBytes(12).toString('hex')}`
}

function newSessionToken() {
  return `cs_${crypto.randomBytes(32).toString('hex')}`
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase().slice(0, 320)
}

/** Normalize email for comparison and storage (exported for auth routes). */
export function normalizeCustomerEmail(raw) {
  return normalizeEmail(raw)
}

/**
 * @param {string} userId
 * @param {string} normalizedEmail
 */
export function isCustomerEmailTakenByOther(userId, normalizedEmail) {
  const data = readStore()
  const n = normalizeEmail(normalizedEmail)
  return Object.values(data.users).some(
    (u) => u.id !== userId && normalizeEmail(u.email) === n,
  )
}

const OPEN_ACCOUNT_INTEREST_SLUGS = [
  'checking',
  'savings',
  'investments',
  'business',
  'not_sure',
]

/**
 * Strict signup product selections: unknown slugs are rejected (400).
 * Omitted / null → undecided legacy path.
 * @param {unknown} raw
 * @returns {string[]}
 * @throws {Error & { statusCode?: number, rejected?: string[] }}
 */
export function parseOpenAccountInterestStrict(raw) {
  const allowed = new Set(OPEN_ACCOUNT_INTEREST_SLUGS)
  if (raw === undefined || raw === null) {
    return ['not_sure']
  }
  if (!Array.isArray(raw)) {
    const err = new Error(
      'openAccountInterest must be an array of allowed product codes.',
    )
    err.statusCode = 400
    throw err
  }
  const strings = raw.map((x) => String(x).trim()).filter(Boolean)
  if (strings.length === 0) {
    const err = new Error(
      'Select at least one account interest, or omit the field to register as undecided.',
    )
    err.statusCode = 400
    throw err
  }
  const rejected = strings.filter((s) => !allowed.has(s))
  if (rejected.length) {
    const err = new Error(`Invalid product selections: ${[...new Set(rejected)].join(', ')}.`)
    err.statusCode = 400
    err.rejected = [...new Set(rejected)]
    throw err
  }
  const uniq = [...new Set(strings)]
  if (uniq.includes('not_sure') && uniq.length > 1) {
    return uniq.filter((x) => x !== 'not_sure').sort()
  }
  return uniq.sort()
}

/**
 * @param {object} user internal row
 */
function ensureCustomerOnboardingShape(user) {
  if (!user || typeof user !== 'object') return
  const interests =
    Array.isArray(user.openAccountInterest) && user.openAccountInterest.length
      ? user.openAccountInterest
      : ['not_sure']
  if (!user.customerOnboarding || typeof user.customerOnboarding !== 'object') {
    user.customerOnboarding = {
      version: 1,
      status: 'active',
      lastClientStepKey: 'legacy',
      interests: [...interests],
      updatedAt: user.createdAt || new Date().toISOString(),
    }
    return
  }
  const o = user.customerOnboarding
  if (!Array.isArray(o.interests) || o.interests.length === 0) {
    o.interests = [...interests]
  }
  if (typeof o.status !== 'string' || !o.status.trim()) o.status = 'active'
  if (typeof o.lastClientStepKey !== 'string') o.lastClientStepKey = 'unknown'
  if (typeof o.updatedAt !== 'string') o.updatedAt = new Date().toISOString()
  if (o.version !== 1) o.version = 1
}

/**
 * @param {string} userId
 */
export function markCustomerOnboardingKycSubmitted(userId) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) return
  ensureCustomerOnboardingShape(user)
  user.customerOnboarding.status = 'kyc_submitted'
  user.customerOnboarding.lastClientStepKey = 'kyc_package_submitted'
  user.customerOnboarding.updatedAt = new Date().toISOString()
  writeStore(data)
}

/**
 * @param {string} userId
 * @param {{ legalName: string, tradeName?: string }} input
 */
export function patchCustomerOnboardingBusiness(userId, input) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('User not found.')
    err.statusCode = 404
    throw err
  }
  const interests = Array.isArray(user.openAccountInterest)
    ? user.openAccountInterest
    : []
  if (!interests.includes('business')) {
    const err = new Error(
      'Business details are only collected when business banking was selected.',
    )
    err.statusCode = 400
    throw err
  }
  const n = String(input?.legalName ?? '')
    .trim()
    .slice(0, 200)
  if (n.length < 2) {
    const err = new Error('Enter the legal business name (at least 2 characters).')
    err.statusCode = 400
    throw err
  }
  const trade = String(input?.tradeName ?? '')
    .trim()
    .slice(0, 120)
  ensureCustomerOnboardingShape(user)
  user.customerOnboarding.businessProfile = {
    legalName: n,
    ...(trade ? { tradeName: trade } : {}),
    capturedAt: new Date().toISOString(),
  }
  user.customerOnboarding.lastClientStepKey = 'business_profile'
  user.customerOnboarding.updatedAt = new Date().toISOString()
  writeStore(data)
}

/**
 * @param {string} userId
 */
export function getCustomerOnboardingForApi(userId) {
  const user = getInternalUser(userId)
  if (!user) return null
  const ob =
    user.customerOnboarding && typeof user.customerOnboarding === 'object'
      ? user.customerOnboarding
      : null
  const interests =
    Array.isArray(user.openAccountInterest) && user.openAccountInterest.length
      ? user.openAccountInterest
      : Array.isArray(ob?.interests) && ob.interests.length
        ? ob.interests
        : ['not_sure']
  const bp = ob?.businessProfile
  const legal = bp && typeof bp.legalName === 'string' ? bp.legalName.trim() : ''
  const needsBusinessProfile =
    interests.includes('business') && legal.length < 2
  return {
    interests,
    needsBusinessProfile,
    businessProfile:
      legal.length >= 2
        ? {
            legalName: legal,
            ...(typeof bp.tradeName === 'string' && bp.tradeName.trim()
              ? { tradeName: bp.tradeName.trim() }
              : {}),
            capturedAt:
              typeof bp.capturedAt === 'string' ? bp.capturedAt : undefined,
          }
        : null,
    status: typeof ob?.status === 'string' ? ob.status : 'active',
    updatedAt: typeof ob?.updatedAt === 'string' ? ob.updatedAt : null,
  }
}

/**
 * @param {{
 *   email: string
 *   password: string
 *   displayName: string
 *   openAccountInterest?: unknown
 * }} input
 */
export function createUser(input) {
  const email = normalizeEmail(input.email)
  const password = String(input.password)
  const displayName = String(input.displayName || '')
    .trim()
    .slice(0, 120) || 'Customer'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Enter a valid email address.')
    err.statusCode = 400
    throw err
  }
  if (password.length < 8) {
    const err = new Error('Password must be at least 8 characters.')
    err.statusCode = 400
    throw err
  }

  const data = readStore()
  for (const u of Object.values(data.users)) {
    if (u.email === email) {
      const err = new Error('An account with this email already exists.')
      err.statusCode = 409
      throw err
    }
  }

  const id = newUserId()
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS)
  const internetBankingId = generateInternetBankingId(data)
  const banking = createInitialBankingState()
  ensureBankingProductShape(banking)
  banking.debitCard.last4 = randomCardLast4()
  banking.debitCard.issuedAt = new Date().toISOString()
  const openAccountInterest = parseOpenAccountInterestStrict(input.openAccountInterest)
  const now = new Date().toISOString()
  data.users[id] = {
    id,
    internetBankingId,
    email,
    passwordHash,
    transactionPinHash: null,
    displayName,
    emailOtpEnabled: false,
    createdAt: now,
    openAccountInterest,
    customerOnboarding: {
      version: 1,
      status: 'kyc_pending',
      lastClientStepKey: 'post_credentials',
      interests: [...openAccountInterest],
      updatedAt: now,
    },
    banking,
  }
  writeStore(data)
  return data.users[id]
}

function sha256secret(secret) {
  return crypto.createHash('sha256').update(String(secret), 'utf8').digest('hex')
}

/**
 * @param {object} data
 * @param {string} userId
 * @param {string | null} [existingFamilyId]
 * @returns {{ accessToken: string, refreshToken: string, expiresIn: number }}
 */
function createSessionPairForUser(data, userId, existingFamilyId = null) {
  const familyId = existingFamilyId || crypto.randomBytes(12).toString('hex')
  const rid = `rft_${crypto.randomBytes(12).toString('hex')}`
  const secret = crypto.randomBytes(32).toString('hex')
  const accessToken = newSessionToken()
  const now = Date.now()
  data.refreshById[rid] = {
    userId,
    expiresAt: now + REFRESH_TTL_MS,
    secretHash: sha256secret(secret),
    familyId,
  }
  data.sessions[accessToken] = {
    userId,
    expiresAt: now + ACCESS_TTL_MS,
    refreshRid: rid,
    familyId,
  }
  writeStore(data)
  return {
    accessToken,
    refreshToken: `${rid}.${secret}`,
    expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
  }
}

function toPublicCustomerUser(user) {
  return {
    id: user.id,
    internetBankingId: user.internetBankingId ?? null,
    email: user.email,
    displayName: user.displayName,
    emailOtpEnabled: Boolean(user.emailOtpEnabled),
    hasTransactionPin: Boolean(user.transactionPinHash),
  }
}

/**
 * @param {string} rawLoginId Internet Banking ID (10 digits) or email
 * @returns {object | null} internal user row
 */
export function findUserByLoginIdentifier(rawLoginId) {
  const s = String(rawLoginId || '').trim()
  if (!s) return null
  const data = readStore()
  if (/^\d{10}$/.test(s)) {
    return Object.values(data.users).find((u) => u.internetBankingId === s) ?? null
  }
  const email = normalizeEmail(s)
  return Object.values(data.users).find((u) => u.email === email) ?? null
}

/**
 * @param {{ email: string, password: string }} input
 * @returns {object | null} internal user row (includes passwordHash); never expose to HTTP clients
 */
export function verifyPasswordForEmail(input) {
  const email = normalizeEmail(input.email)
  const password = String(input.password)
  const data = readStore()
  const user = Object.values(data.users).find((u) => u.email === email)
  if (!user) return null
  if (!bcrypt.compareSync(password, user.passwordHash)) return null
  return user
}

/**
 * @param {{ loginId: string, password: string }} input
 */
export function verifyPasswordForLoginIdentifier(input) {
  const user = findUserByLoginIdentifier(input.loginId)
  if (!user) return null
  if (!bcrypt.compareSync(String(input.password), user.passwordHash)) return null
  return user
}

/**
 * @param {string} userId
 * @returns {{ user: object, accessToken: string, refreshToken: string, expiresIn: number } | null}
 */
export function issueAuthTokensForUserId(userId) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) return null
  if (user.onlineBankingRestricted) return null
  const pair = createSessionPairForUser(data, userId)
  return { user: toPublicCustomerUser(user), ...pair }
}

/**
 * @param {{ loginId?: string, email?: string, password: string }} input
 * @returns {{ user: object, accessToken: string, refreshToken: string, expiresIn: number } | null}
 */
export function authenticateUser(input) {
  const loginId = String(input.loginId ?? input.email ?? '').trim()
  const user = verifyPasswordForLoginIdentifier({
    loginId,
    password: input.password,
  })
  if (!user) return null
  return issueAuthTokensForUserId(user.id)
}

export function revokeSession(token) {
  const t = String(token).trim()
  if (!t) return
  const data = readStore()
  const sess = data.sessions[t]
  if (sess?.refreshRid && data.refreshById[sess.refreshRid]) {
    delete data.refreshById[sess.refreshRid]
  }
  delete data.sessions[t]
  writeStore(data)
}

/**
 * Revokes every access and refresh token for a customer (e.g. operator fraud lockout).
 * @param {string} userId
 */
export function revokeAllSessionsForUserId(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return
  const data = readStore()
  let changed = false
  for (const [at, s] of Object.entries({ ...data.sessions })) {
    if (s?.userId !== uid) continue
    if (s.refreshRid && data.refreshById[s.refreshRid]) {
      delete data.refreshById[s.refreshRid]
    }
    delete data.sessions[at]
    changed = true
  }
  for (const rid of Object.keys({ ...data.refreshById })) {
    const rec = data.refreshById[rid]
    if (rec?.userId === uid) {
      delete data.refreshById[rid]
      changed = true
    }
  }
  if (changed) writeStore(data)
}

/**
 * Revokes a refresh token (e.g. logout body) without requiring access token.
 * @param {string} rawRefresh
 */
export function revokeRefreshTokenRaw(rawRefresh) {
  const raw = String(rawRefresh).trim()
  const dot = raw.indexOf('.')
  if (dot < 1) return
  const rid = raw.slice(0, dot)
  const secret = raw.slice(dot + 1)
  const data = readStore()
  const rec = data.refreshById[rid]
  if (!rec) {
    writeStore(data)
    return
  }
  if (rec.secretHash !== sha256secret(secret)) return
  delete data.refreshById[rid]
  for (const [at, s] of Object.entries(data.sessions)) {
    if (s.refreshRid === rid) delete data.sessions[at]
  }
  writeStore(data)
}

/**
 * @param {string} rawRefresh
 * @returns {{ accessToken: string, refreshToken: string, expiresIn: number, user: object } | null}
 */
export function refreshWithToken(rawRefresh) {
  const raw = String(rawRefresh).trim()
  const dot = raw.indexOf('.')
  if (dot < 1) return null
  const rid = raw.slice(0, dot)
  const secret = raw.slice(dot + 1)
  if (!rid || !secret) return null
  const data = readStore()
  const rec = data.refreshById[rid]
  if (!rec || rec.expiresAt < Date.now()) {
    if (rec) delete data.refreshById[rid]
    writeStore(data)
    return null
  }
  if (rec.secretHash !== sha256secret(secret)) return null
  const userId = rec.userId
  const familyId = rec.familyId
  delete data.refreshById[rid]
  for (const [at, s] of Object.entries(data.sessions)) {
    if (s.refreshRid === rid) delete data.sessions[at]
  }
  const user = data.users[userId]
  if (!user) {
    writeStore(data)
    return null
  }
  const pair = createSessionPairForUser(data, userId, familyId)
  return {
    ...pair,
    user: toPublicCustomerUser(user),
  }
}

/**
 * @param {string} token
 * @returns {object | null} user row without passwordHash
 */
export function getUserFromSessionToken(token) {
  const t = String(token).trim()
  if (!t) return null
  const data = readStore()
  const sess = data.sessions[t]
  if (!sess || sess.expiresAt < Date.now()) {
    if (sess) {
      delete data.sessions[t]
      writeStore(data)
    }
    return null
  }
  const user = data.users[sess.userId]
  if (!user) {
    delete data.sessions[t]
    writeStore(data)
    return null
  }
  return toPublicCustomerUser(user)
}

/**
 * Non-monetary debit-card settings should not appear in Recent activity / account ledgers.
 * @param {{ description?: string }} row
 */
function isDebitCardSettingsActivityRow(row) {
  const d =
    typeof row?.description === 'string' ? row.description.trim() : ''
  if (!d) return false
  if (/^Debit card ending in .+ locked$/i.test(d)) return true
  if (/^Debit card ending in .+ unlocked$/i.test(d)) return true
  if (/^Debit card replacement requested/i.test(d)) return true
  return false
}

function isoToActivityDateLabel(iso) {
  const t = typeof iso === 'string' ? Date.parse(iso) : NaN
  if (Number.isNaN(t)) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(t))
}

/** Transfers and other non-operator lines: local wall clock with full date + time. */
function activityInstantListLabelLocal(d) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d)
}

function activityTimestampMsFromRowId(id) {
  if (typeof id !== 'string') return NaN
  const adm = /^adm_(\d+)_/.exec(id)
  if (adm) {
    const n = Number(adm[1])
    return Number.isFinite(n) ? n : NaN
  }
  const legacy = /^(\d+)-/.exec(id)
  if (legacy) {
    const n = Number(legacy[1])
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

/**
 * Recompute list `dateLabel` from `bookedAt` / `postedAt` / row id so clients always
 * see year + time even when JSON still has an older short label.
 * @param {Record<string, unknown>} row
 */
function normalizeActivityRowDateLabel(row) {
  if (!row || typeof row !== 'object') return row
  const out = { ...row }
  const bookedRaw =
    typeof row.bookedAt === 'string' ? row.bookedAt.trim() : ''
  if (bookedRaw) {
    const ms = Date.parse(bookedRaw)
    if (!Number.isNaN(ms)) {
      out.dateLabel = activityDateLabelFromDate(new Date(ms))
      return out
    }
  }
  const postedRaw =
    typeof row.postedAt === 'string' ? row.postedAt.trim() : ''
  if (postedRaw) {
    const label = isoToActivityDateLabel(postedRaw)
    if (label) {
      out.dateLabel = label
      return out
    }
  }
  const idMs = activityTimestampMsFromRowId(
    typeof row.id === 'string' ? row.id : '',
  )
  if (!Number.isNaN(idMs) && idMs >= Date.UTC(2000, 0, 1)) {
    out.dateLabel = activityInstantListLabelLocal(new Date(idMs))
    return out
  }
  return out
}

function activityRowSortTs(row) {
  if (row && typeof row.postedAt === 'string') {
    const u = Date.parse(row.postedAt)
    if (!Number.isNaN(u)) return u
  }
  if (row && typeof row.bookedAt === 'string') {
    const u = Date.parse(row.bookedAt)
    if (!Number.isNaN(u)) return u
  }
  return 0
}

function primaryCheckingFundingHint(banking) {
  const accts = Array.isArray(banking.accounts) ? banking.accounts : []
  const chk =
    accts.find((a) => typeof a?.type === 'string' && /checking/i.test(a.type)) ??
    accts[0]
  if (!chk || typeof chk.mask !== 'string') return ''
  const name =
    typeof chk.name === 'string' && chk.name.trim() ? chk.name.trim() : 'Checking'
  return `${name} ···${chk.mask}`
}

/**
 * Purchases and declines/pending; omit $0 “posted” noise (e.g. card issued).
 * @param {{ amountCents?: number, status?: string }} txn
 */
function cardTxnEligibleForRecentActivity(txn) {
  const st = String(txn?.status || 'posted').toLowerCase()
  if (st === 'declined' || st === 'pending') return true
  const amt = Math.round(Number(txn?.amountCents))
  return Number.isFinite(amt) && amt !== 0
}

/**
 * @param {{ id: string, postedAt?: string, merchant: string, amountCents: number, status?: string }} txn
 * @param {string} fundingHint e.g. "Premier Checking ···4821"
 * @param {string} last4
 */
function debitCardTxnToActivityRow(txn, fundingHint, last4) {
  const postedAt =
    typeof txn.postedAt === 'string' && txn.postedAt.trim()
      ? txn.postedAt.trim()
      : new Date().toISOString()
  const st = String(txn.status || 'posted').toLowerCase()
  const suffix =
    st === 'declined' ? ' — Declined' : st === 'pending' ? ' — Pending' : ''
  const merchant =
    typeof txn.merchant === 'string' ? txn.merchant.trim().slice(0, 120) : ''
  const tail = fundingHint ? ` · ${fundingHint}` : ''
  const description = `${merchant}${suffix} · Card ···${last4}${tail}`
  return {
    id: `dctx_${txn.id}`,
    dateLabel: isoToActivityDateLabel(postedAt),
    description,
    amountCents: Math.round(Number(txn.amountCents)),
    postedAt,
  }
}

export function getUserBankingSnapshot(userId) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) return null
  const banking = JSON.parse(JSON.stringify(user.banking))
  ensureBankingProductShape(banking)
  const baseActivity = Array.isArray(banking.activity)
    ? banking.activity.filter((row) => !isDebitCardSettingsActivityRow(row))
    : []

  const dc = banking.debitCard
  const last4 =
    typeof dc?.last4 === 'string' && /^\d{4}$/.test(dc.last4)
      ? dc.last4
      : '0000'
  const fundingHint = primaryCheckingFundingHint(banking)
  const txs = Array.isArray(dc?.transactions) ? dc.transactions : []
  const cardActivityRows = txs
    .filter(cardTxnEligibleForRecentActivity)
    .map((txn) => debitCardTxnToActivityRow(txn, fundingHint, last4))

  const merged = [...baseActivity, ...cardActivityRows]
  merged.sort((a, b) => activityRowSortTs(b) - activityRowSortTs(a))
  banking.activity = merged.map((row) => normalizeActivityRowDateLabel(row))

  return banking
}

/**
 * @param {string} userId
 * @param {object} banking full banking state
 */
export function saveUserBanking(userId, banking) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('User not found.')
    err.statusCode = 404
    throw err
  }
  user.banking = banking
  writeStore(data)
}

export function getInternalUser(userId) {
  const data = readStore()
  return data.users[userId] ?? null
}

/**
 * @param {string} userId
 * @returns {{ restricted: boolean, reason: string | null }}
 */
export function getOnlineBankingRestriction(userId) {
  const u = getInternalUser(userId)
  if (!u) return { restricted: false, reason: null }
  const restricted = Boolean(u.onlineBankingRestricted)
  const raw =
    typeof u.onlineBankingRestrictionReason === 'string'
      ? u.onlineBankingRestrictionReason.trim()
      : ''
  return {
    restricted,
    reason: restricted && raw ? raw.slice(0, 800) : null,
  }
}

/**
 * @param {string} userId
 * @param {{ restricted: boolean, reason?: string | null }} input
 * @returns {{ restricted: boolean, reason: string | null }}
 */
export function setOnlineBankingRestriction(userId, input) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('User not found.')
    err.statusCode = 404
    throw err
  }
  const restricted = Boolean(input.restricted)
  user.onlineBankingRestricted = restricted
  if (!restricted) {
    user.onlineBankingRestrictionReason = null
  } else {
    const r =
      typeof input.reason === 'string' && input.reason.trim()
        ? input.reason.trim().slice(0, 800)
        : null
    user.onlineBankingRestrictionReason = r
  }
  writeStore(data)
  if (restricted) {
    revokeAllSessionsForUserId(userId)
  }
  return getOnlineBankingRestriction(userId)
}

export function countOnlineBankingRestrictedUsers() {
  const data = readStore()
  return Object.values(data.users).filter((u) => Boolean(u.onlineBankingRestricted))
    .length
}

/**
 * Display name only. Email changes use OTP verification (`/api/auth/email-change/*`).
 * @param {string} userId
 * @param {{ displayName?: string }} input
 */
export function patchCustomerProfile(userId, input) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('User not found.')
    err.statusCode = 404
    throw err
  }

  if (typeof input.displayName === 'string') {
    user.displayName = String(input.displayName).trim().slice(0, 120) || 'Customer'
  }

  writeStore(data)
  return toPublicCustomerUser(user)
}

/**
 * Called after OTP sent to `newEmail` has been validated.
 * @param {string} userId
 * @param {string} newEmailNormalized lower-case trimmed email from challenge
 */
export function finalizeCustomerEmail(userId, newEmailNormalized) {
  const nextEmail = normalizeEmail(newEmailNormalized)
  if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    const err = new Error('Enter a valid email address.')
    err.statusCode = 400
    throw err
  }
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('User not found.')
    err.statusCode = 404
    throw err
  }
  const taken = Object.values(data.users).some(
    (u) => u.id !== userId && normalizeEmail(u.email) === nextEmail,
  )
  if (taken) {
    const err = new Error('An account with this email already exists.')
    err.statusCode = 409
    throw err
  }
  user.email = nextEmail
  writeStore(data)
  return toPublicCustomerUser(user)
}

/**
 * @param {string} userId
 * @param {string} password
 */
export function verifyUserPassword(userId, password) {
  const user = getInternalUser(userId)
  if (!user) return false
  return bcrypt.compareSync(String(password), user.passwordHash)
}

/**
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 */
export function changeUserPassword(userId, currentPassword, newPassword) {
  if (!verifyUserPassword(userId, currentPassword)) {
    const err = new Error('Current password is incorrect.')
    err.statusCode = 401
    throw err
  }
  const next = String(newPassword ?? '')
  if (next.length < 8) {
    const err = new Error('Password must be at least 8 characters.')
    err.statusCode = 400
    throw err
  }
  if (next.length > 256) {
    const err = new Error('Password is too long.')
    err.statusCode = 400
    throw err
  }
  if (verifyUserPassword(userId, next)) {
    const err = new Error('New password must be different from your current password.')
    err.statusCode = 400
    throw err
  }
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('User not found.')
    err.statusCode = 404
    throw err
  }
  user.passwordHash = bcrypt.hashSync(next, BCRYPT_ROUNDS)
  writeStore(data)
  return toPublicCustomerUser(user)
}

/**
 * @param {string} userId
 * @param {boolean} enabled
 */
export function setUserEmailOtpEnabled(userId, enabled) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('User not found.')
    err.statusCode = 404
    throw err
  }
  user.emailOtpEnabled = Boolean(enabled)
  writeStore(data)
  return toPublicCustomerUser(user)
}

export function dismissReplacementBanner(userId) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('User not found.')
    err.statusCode = 404
    throw err
  }
  user.banking.replacementBanner = null
  writeStore(data)
}

/**
 * Operator directory (no password material).
 * @returns {Array<{ id: string, email: string, displayName: string, createdAt: string, emailOtpEnabled: boolean }>}
 */
export function listCustomersForAdmin() {
  const data = readStore()
  return Object.values(data.users).map((u) => ({
    id: u.id,
    internetBankingId: u.internetBankingId ?? null,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt,
    emailOtpEnabled: Boolean(u.emailOtpEnabled),
    hasTransactionPin: Boolean(u.transactionPinHash),
    onlineBankingRestricted: Boolean(u.onlineBankingRestricted),
    openAccountInterest: Array.isArray(u.openAccountInterest)
      ? u.openAccountInterest
      : [],
    onboardingStatus:
      u.customerOnboarding && typeof u.customerOnboarding.status === 'string'
        ? u.customerOnboarding.status
        : null,
  }))
}

/**
 * One customer for admin: accounts and counts (no password hash).
 * @param {string} userId
 */
export function getCustomerAdminDetail(userId) {
  const user = getInternalUser(userId)
  if (!user) return null
  const banking = user.banking || {}
  const accounts = Array.isArray(banking.accounts) ? banking.accounts : []
  const totalBalanceCents = accounts.reduce(
    (s, a) => s + (Number(a.balanceCents) || 0),
    0,
  )
  const scheduled = Array.isArray(banking.scheduledBillPayments)
    ? banking.scheduledBillPayments
    : []
  ensureBankingProductShape(banking)
  const ob =
    user.customerOnboarding && typeof user.customerOnboarding === 'object'
      ? user.customerOnboarding
      : null
  const bp = ob?.businessProfile
  const access = getOnlineBankingRestriction(userId)
  return {
    id: user.id,
    internetBankingId: user.internetBankingId ?? null,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    emailOtpEnabled: Boolean(user.emailOtpEnabled),
    hasTransactionPin: Boolean(user.transactionPinHash),
    onlineBankingRestricted: access.restricted,
    onlineBankingRestrictionReason: access.reason,
    openAccountInterest: Array.isArray(user.openAccountInterest)
      ? user.openAccountInterest
      : [],
    onboardingStatus: typeof ob?.status === 'string' ? ob.status : null,
    onboardingUpdatedAt: typeof ob?.updatedAt === 'string' ? ob.updatedAt : null,
    businessLegalName:
      bp && typeof bp.legalName === 'string' && bp.legalName.trim()
        ? bp.legalName.trim()
        : null,
    businessTradeName:
      bp && typeof bp.tradeName === 'string' && bp.tradeName.trim()
        ? bp.tradeName.trim()
        : null,
    loanApplicationCount: banking.loanApplications.length,
    fixedDepositCount: banking.fixedDeposits.length,
    dpsPlanCount: banking.dpsPlans.length,
    fxHoldingCount: banking.fxHoldings.length,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      mask: a.mask,
      type: a.type,
      balanceCents: a.balanceCents,
    })),
    totalBalanceCents,
    scheduledBillCount: scheduled.length,
    activityCount: Array.isArray(banking.activity) ? banking.activity.length : 0,
  }
}

/**
 * Operator edits customer profile / sign-in flags (demo JSON store).
 * @param {string} userId
 * @param {{
 *   displayName?: string
 *   email?: string
 *   emailOtpEnabled?: boolean
 *   newPassword?: string
 * }} body
 */
export function adminPatchCustomerRecord(userId, body) {
  if (!body || typeof body !== 'object') {
    const err = new Error('Invalid body.')
    err.statusCode = 400
    throw err
  }
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('Customer not found.')
    err.statusCode = 404
    throw err
  }

  let touched = false

  if (typeof body.displayName === 'string') {
    user.displayName = String(body.displayName).trim().slice(0, 120) || 'Customer'
    touched = true
  }
  if (typeof body.email === 'string') {
    const next = normalizeEmail(body.email)
    if (!next || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      const err = new Error('Enter a valid email address.')
      err.statusCode = 400
      throw err
    }
    if (isCustomerEmailTakenByOther(userId, next)) {
      const err = new Error('An account with this email already exists.')
      err.statusCode = 409
      throw err
    }
    user.email = next
    touched = true
  }
  if (body.emailOtpEnabled !== undefined) {
    user.emailOtpEnabled = Boolean(body.emailOtpEnabled)
    touched = true
  }
  if (typeof body.newPassword === 'string' && body.newPassword.trim()) {
    const pw = body.newPassword.trim()
    if (pw.length < 8) {
      const err = new Error('Password must be at least 8 characters.')
      err.statusCode = 400
      throw err
    }
    if (pw.length > 256) {
      const err = new Error('Password is too long.')
      err.statusCode = 400
      throw err
    }
    user.passwordHash = bcrypt.hashSync(pw, BCRYPT_ROUNDS)
    revokeAllSessionsForUserId(userId)
    touched = true
  }

  if (!touched) {
    const err = new Error('No updates provided.')
    err.statusCode = 400
    throw err
  }

  writeStore(data)
  return getCustomerAdminDetail(userId)
}

export function verifyTransactionPin(userId, pin) {
  const user = getInternalUser(userId)
  if (!user?.transactionPinHash) return false
  const d = String(pin ?? '').replace(/\D/g, '')
  if (!/^\d{6}$/.test(d)) return false
  return bcrypt.compareSync(d, user.transactionPinHash)
}

/**
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPinDigits exactly 6 digits
 */
export function setUserTransactionPin(userId, currentPassword, newPinDigits) {
  if (!verifyUserPassword(userId, currentPassword)) {
    const err = new Error('Current password is incorrect.')
    err.statusCode = 401
    throw err
  }
  const d = String(newPinDigits ?? '').replace(/\D/g, '')
  if (!/^\d{6}$/.test(d)) {
    const err = new Error('Transaction PIN must be exactly 6 digits.')
    err.statusCode = 400
    throw err
  }
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('User not found.')
    err.statusCode = 404
    throw err
  }
  user.transactionPinHash = bcrypt.hashSync(d, BCRYPT_ROUNDS)
  writeStore(data)
  return toPublicCustomerUser(user)
}

function adminActivityUid() {
  return `adm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function activityDateLabelFromDate(d) {
  return (
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(d) + ' UTC'
  )
}

/**
 * @param {{ postedOn?: string, bookedAt?: string }} opts
 * @returns {{ bookedAt: string, dateLabel: string }}
 */
function resolveOperatorActivityTimestamps(opts) {
  const postedOn =
    typeof opts?.postedOn === 'string' ? opts.postedOn.trim().slice(0, 12) : ''
  const bookedAtRaw =
    typeof opts?.bookedAt === 'string' ? opts.bookedAt.trim().slice(0, 80) : ''
  const now = new Date()
  const minMs = Date.UTC(2000, 0, 1)
  const maxMs = now.getTime()
  const err = (m) => {
    const e = new Error(m)
    e.statusCode = 400
    throw e
  }

  if (bookedAtRaw) {
    const ms = Date.parse(bookedAtRaw)
    if (Number.isNaN(ms)) err('bookedAt must be a valid ISO date-time string.')
    if (ms < minMs || ms > maxMs) {
      err('bookedAt must be between 2000-01-01 and the current time (server clock).')
    }
    const d = new Date(ms)
    return { bookedAt: d.toISOString(), dateLabel: activityDateLabelFromDate(d) }
  }

  if (postedOn) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(postedOn)
    if (!m) err('postedOn must be YYYY-MM-DD (calendar date).')
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const da = Number(m[3])
    const ms = Date.UTC(y, mo, da, 12, 0, 0, 0)
    const chk = new Date(ms)
    if (
      Number.isNaN(ms) ||
      chk.getUTCFullYear() !== y ||
      chk.getUTCMonth() !== mo ||
      chk.getUTCDate() !== da
    ) {
      err('postedOn is not a valid calendar date.')
    }
    const todayUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    if (postedOn < '2000-01-01' || postedOn > todayUtc) {
      err('postedOn must be between 2000-01-01 and today (UTC calendar date).')
    }
    return { bookedAt: chk.toISOString(), dateLabel: activityDateLabelFromDate(chk) }
  }

  return {
    bookedAt: now.toISOString(),
    dateLabel: activityDateLabelFromDate(now),
  }
}

/**
 * Operator-initiated ledger credit or debit on a customer deposit account.
 * @param {string} userId
 * @param {{
 *   accountId: string
 *   deltaCents: number
 *   description?: string
 *   postedOn?: string
 *   bookedAt?: string
 * }} input
 */
export function adminApplyBalanceAdjustment(userId, input) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('Customer not found.')
    err.statusCode = 404
    throw err
  }
  const aid = String(input.accountId || '').trim()
  const d = Math.round(Number(input.deltaCents))
  if (!aid || !Number.isFinite(d) || d === 0) {
    const err = new Error('accountId and a non-zero deltaCents are required.')
    err.statusCode = 400
    throw err
  }
  const banking = user.banking
  ensureBankingProductShape(banking)
  const acc = banking.accounts.find((a) => a.id === aid)
  if (!acc) {
    const err = new Error('Account not found for this customer.')
    err.statusCode = 404
    throw err
  }
  const curBal = Math.round(Number(acc.balanceCents) || 0)
  acc.balanceCents = curBal
  const nextBal = curBal + d
  if (nextBal < 0) {
    const err = new Error('Adjustment would overdraw the account.')
    err.statusCode = 400
    throw err
  }
  acc.balanceCents = nextBal
  const desc =
    String(input.description || '')
      .trim()
      .slice(0, 240) || (d > 0 ? 'Branch / operator credit' : 'Branch / operator debit')
  if (!Array.isArray(banking.activity)) banking.activity = []
  const { bookedAt, dateLabel } = resolveOperatorActivityTimestamps({
    postedOn: input.postedOn,
    bookedAt: input.bookedAt,
  })
  banking.activity.unshift({
    id: adminActivityUid(),
    dateLabel,
    description: desc,
    amountCents: d,
    bookedAt,
    operatorAccountId: aid,
  })
  writeStore(data)
  return JSON.parse(JSON.stringify(banking))
}

/**
 * Rows for admin transaction feed: operator credits/debits stored on customer activity.
 * @returns {Array<{
 *   id: string
 *   status: 'approved'
 *   type: 'operator_deposit' | 'operator_withdrawal'
 *   engineKind: 'deposit' | 'withdrawal'
 *   amountCents: number
 *   userId: string
 *   submitterId: string
 *   title: string
 *   createdAt: string
 *   decidedAt: string
 *   appliedAt: string
 *   reversedAt: null
 *   decisionNote: string | null
 *   effectiveAt: string
 *   createdMs: number
 *   suspicious: boolean
 *   suspiciousNote: null
 *   withdrawalCoApprovals: number
 * }>}
 */
export function listOperatorLedgerDigestRows() {
  const data = readStore()
  /** @type {any[]} */
  const out = []
  for (const u of Object.values(data.users)) {
    const act = u.banking?.activity
    if (!Array.isArray(act)) continue
    for (const row of act) {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string') continue
      if (!row.id.startsWith('adm_')) continue
      const d = Math.round(Number(row.amountCents))
      if (!Number.isFinite(d) || d === 0) continue
      const bookedAt =
        typeof row.bookedAt === 'string' && row.bookedAt.trim()
          ? row.bookedAt.trim()
          : new Date(0).toISOString()
      const createdMs = Date.parse(bookedAt)
      const deposit = d > 0
      const acct =
        typeof row.operatorAccountId === 'string' && row.operatorAccountId.trim()
          ? row.operatorAccountId.trim()
          : '—'
      out.push({
        id: row.id,
        status: /** @type {'approved'} */ ('approved'),
        type: deposit ? 'operator_deposit' : 'operator_withdrawal',
        engineKind: deposit ? 'deposit' : 'withdrawal',
        amountCents: Math.abs(d),
        userId: u.id,
        submitterId: 'bank_operator',
        title:
          typeof row.description === 'string' && row.description.trim()
            ? row.description.trim()
            : deposit
              ? 'Operator deposit'
              : 'Operator withdrawal',
        createdAt: bookedAt,
        decidedAt: bookedAt,
        appliedAt: bookedAt,
        reversedAt: null,
        decisionNote: `Account ${acct}`,
        effectiveAt: bookedAt,
        createdMs: Number.isNaN(createdMs) ? 0 : createdMs,
        suspicious: false,
        suspiciousNote: null,
        withdrawalCoApprovals: 0,
      })
    }
  }
  return out
}

/**
 * @returns {Array<{ userId: string, displayName: string, email: string, debitCard: object }>}
 */
export function listAdminCards() {
  const data = readStore()
  return Object.values(data.users).map((u) => {
    const banking = u.banking || {}
    ensureBankingProductShape(banking)
    const dc = banking.debitCard
    return {
      userId: u.id,
      displayName: u.displayName,
      email: u.email,
      debitCard: {
        ...dc,
        transactions: Array.isArray(dc.transactions)
          ? dc.transactions.slice(0, 80)
          : [],
      },
    }
  })
}

/**
 * @param {string} userId
 * @param {{ cardType?: 'virtual' | 'physical' }} input
 */
export function adminIssueDebitCard(userId, input) {
  const ct = input?.cardType === 'virtual' ? 'virtual' : 'physical'
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('Customer not found.')
    err.statusCode = 404
    throw err
  }
  const banking = user.banking || {}
  ensureBankingProductShape(banking)
  const prevTx = Array.isArray(banking.debitCard.transactions)
    ? banking.debitCard.transactions
    : []
  const now = new Date()
  const expY = now.getFullYear() + 3
  const expM = now.getMonth() + 1
  const last4 = randomCardLast4()
  const issueLine = {
    id: cardTxnUid(),
    postedAt: now.toISOString(),
    merchant:
      ct === 'virtual'
        ? 'Operator — virtual card issued'
        : 'Operator — physical card issued',
    amountCents: 0,
    status: 'posted',
  }
  banking.debitCard = {
    ...banking.debitCard,
    last4,
    expMonth: expM,
    expYear: expY,
    cardType: ct,
    issuedAt: now.toISOString(),
    locked: false,
    adminFrozen: false,
    stolenBlocked: false,
    transactions: [issueLine, ...prevTx].slice(0, 200),
  }
  banking.replacementBanner = null
  user.banking = banking
  writeStore(data)
  return JSON.parse(JSON.stringify(banking.debitCard))
}

/**
 * @param {string} userId
 * @param {{
 *   adminFrozen?: boolean
 *   stolenBlocked?: boolean
 *   singleTransactionLimitCents?: number | null
 *   dailySpendLimitCents?: number | null
 * }} body
 */
export function adminPatchDebitCard(userId, body) {
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('Customer not found.')
    err.statusCode = 404
    throw err
  }
  ensureBankingProductShape(user.banking)
  const d = user.banking.debitCard
  if (body.adminFrozen !== undefined) d.adminFrozen = Boolean(body.adminFrozen)
  if (body.stolenBlocked !== undefined) d.stolenBlocked = Boolean(body.stolenBlocked)
  if (body.singleTransactionLimitCents !== undefined) {
    const v = body.singleTransactionLimitCents
    d.singleTransactionLimitCents =
      v === null || v === ''
        ? null
        : Math.max(1, Math.round(Number(v)))
  }
  if (body.dailySpendLimitCents !== undefined) {
    const v = body.dailySpendLimitCents
    d.dailySpendLimitCents =
      v === null || v === ''
        ? null
        : Math.max(1, Math.round(Number(v)))
  }
  writeStore(data)
  return JSON.parse(JSON.stringify(d))
}

/**
 * @param {string} userId
 * @param {{ merchant: string, amountCents: number, status?: string }} input
 */
export function adminAppendCardTransaction(userId, input) {
  const merchant = String(input?.merchant || '').trim().slice(0, 120)
  const amountCents = Math.round(Number(input?.amountCents))
  const statusRaw = String(input?.status || 'posted').toLowerCase()
  const status =
    statusRaw === 'declined' || statusRaw === 'pending' ? statusRaw : 'posted'
  if (!merchant) {
    const err = new Error('merchant is required.')
    err.statusCode = 400
    throw err
  }
  if (!Number.isFinite(amountCents)) {
    const err = new Error('amountCents is required.')
    err.statusCode = 400
    throw err
  }
  const data = readStore()
  const user = data.users[userId]
  if (!user) {
    const err = new Error('Customer not found.')
    err.statusCode = 404
    throw err
  }
  ensureBankingProductShape(user.banking)
  const row = {
    id: cardTxnUid(),
    postedAt: new Date().toISOString(),
    merchant,
    amountCents,
    status,
  }
  user.banking.debitCard.transactions.unshift(row)
  user.banking.debitCard.transactions = user.banking.debitCard.transactions.slice(
    0,
    200,
  )
  writeStore(data)
  return row
}

/**
 * Single-pass aggregates for the operator dashboard (no password material).
 * @returns {{
 *   totalBalanceCents: number,
 *   verifiedPinCount: number,
 *   newSignups7d: number,
 *   topByBalance: Array<{ id: string, displayName: string, email: string, internetBankingId: string|null, totalBalanceCents: number }>,
 * }}
 */
export function summarizeAdminLedger() {
  const data = readStore()
  const now = Date.now()
  const d7 = 7 * 24 * 60 * 60 * 1000
  let totalBalanceCents = 0
  let verifiedPinCount = 0
  let newSignups7d = 0
  const rows = []
  for (const u of Object.values(data.users)) {
    const banking = u.banking || {}
    ensureBankingProductShape(banking)
    const accounts = Array.isArray(banking.accounts) ? banking.accounts : []
    let t = 0
    for (const a of accounts) t += Number(a.balanceCents) || 0
    totalBalanceCents += t
    if (u.transactionPinHash) verifiedPinCount++
    const ct = Date.parse(u.createdAt)
    if (!Number.isNaN(ct) && now - ct <= d7) newSignups7d++
    rows.push({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      internetBankingId: u.internetBankingId ?? null,
      totalBalanceCents: t,
    })
  }
  rows.sort((a, b) => b.totalBalanceCents - a.totalBalanceCents)
  return {
    totalBalanceCents,
    verifiedPinCount,
    newSignups7d,
    topByBalance: rows.slice(0, 6),
  }
}
