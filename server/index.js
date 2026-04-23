import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import rateLimit from 'express-rate-limit'

import {
  clientIp,
  readRecentAuditEvents,
  setAuditPgPool,
  writeAudit,
} from './lib/auditLog.js'
import { getPool, initPgSchema } from './lib/dbPool.js'

import {
  loadBankConfig,
  mergeConfigWithDefaults,
  saveBankConfigFromBody,
} from './lib/bankConfigStore.js'
import { applyApprovalToBankingState } from './lib/bankingEngine.js'
import {
  buildExecutionFees,
  executeApprovedApproval,
  executeReverseApprovedApproval,
} from './lib/approvalExecutor.js'
import { listAdminTransactionFeed } from './lib/adminTransactionFeed.js'
import {
  assertWithdrawalPolicyOnSubmit,
  withdrawalRequiresSecondOperator,
} from './lib/withdrawalPolicy.js'
import {
  countApprovalsByStatus,
  createApproval,
  finalizeApprovalApproved,
  getApprovalById,
  listAll,
  listByUserId,
  markApprovalReversed,
  patchApprovalSuspicious,
  recordWithdrawalFirstOperatorApproval,
  updateApprovalStatus,
} from './lib/approvalsStore.js'
import {
  createCustomerKycSubmission,
  getKycSubmission,
  getLatestKycForUser,
  listKycSubmissions,
  patchKycSubmission,
  readKycDocumentFile,
} from './lib/kycStore.js'
import {
  appendCustomerSupportMessage,
  appendStaffSupportMessage,
  countOpenSupportTickets,
  createSupportTicket,
  getSupportTicket,
  getSupportTicketForUser,
  listSupportTicketsAdmin,
  listSupportTicketsForUser,
  patchSupportTicketAdmin,
} from './lib/supportTicketsStore.js'
import { requireCustomer } from './lib/customerAuth.js'
import { sendOnlineBankingRestrictedForbidden } from './lib/onlineBankingLockout.js'
import {
  createLoginChallenge,
  consumeLoginChallenge,
  deleteLoginChallenge,
  otpResendsRemainingAfterSendCount,
  resendLoginChallenge,
} from './lib/loginChallenges.js'
import {
  buildEmailChangeOtpParts,
  buildKycNotifyParts,
  buildOtpEmailParts,
  buildWireTransferOtpParts,
  buildTestLetterParts,
  previewVarsFor,
  sendEmailChangeOtpEmail,
  effectiveMailFromEnvelope,
  sendKycSubmissionNotifyEmail,
  sendLoginOtpEmail,
  sendNotifyTestLetter,
  sendWireTransferOtpEmail,
} from './lib/mailTransactional.js'
import {
  applyPersistedSmtpToProcess,
  getSmtpSettingsForAdmin,
  parseMailFrom,
  saveSmtpSettings,
} from './lib/smtpAdminStore.js'
import {
  clearPersistedOtpPolicy,
  getOtpPolicySnapshot,
  getRequireLoginEmailOtp,
  getSkipLoginEmailOtp,
  getSkipWireEmailOtp,
  logOtpPolicyAtStartup,
  saveOtpPolicy,
} from './lib/otpPolicyStore.js'
import {
  clientMessageForMailSendFailure,
  createTransport,
  fromPreview,
  isMailReady,
  smtpFromEnv,
} from './lib/smtp.js'
import {
  authenticateUser,
  countOnlineBankingRestrictedUsers,
  createUser,
  dismissReplacementBanner,
  finalizeCustomerEmail,
  isCustomerEmailTakenByOther,
  normalizeCustomerEmail,
  getCustomerAdminDetail,
  getInternalUser,
  getOnlineBankingRestriction,
  getUserBankingSnapshot,
  getUserFromSessionToken,
  issueAuthTokensForUserId,
  adminPatchCustomerRecord,
  listCustomersForAdmin,
  listAdminCards,
  adminIssueDebitCard,
  adminPatchDebitCard,
  adminAppendCardTransaction,
  refreshWithToken,
  revokeRefreshTokenRaw,
  revokeSession,
  saveUserBanking,
  setOnlineBankingRestriction,
  setUserEmailOtpEnabled,
  setUserTransactionPin,
  patchCustomerProfile,
  changeUserPassword,
  adminApplyBalanceAdjustment,
  summarizeAdminLedger,
  verifyPasswordForLoginIdentifier,
  verifyTransactionPin,
  verifyUserPassword,
  getCustomerOnboardingForApi,
  markCustomerOnboardingKycSubmitted,
  patchCustomerOnboardingBusiness,
} from './lib/usersStore.js'
import {
  consumeEmailChangeChallenge,
  createEmailChangeChallenge,
  deleteEmailChangeChallenge,
} from './lib/emailChangeChallenges.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Uploaded marketing images (home hero); served under `/api/media/*`. */
const MEDIA_DIR = path.join(__dirname, 'data', 'media')
try {
  fs.mkdirSync(MEDIA_DIR, { recursive: true })
} catch {
  /* ignore */
}
if (!Object.prototype.hasOwnProperty.call(process.env, 'DOTENV_CONFIG_QUIET')) {
  process.env.DOTENV_CONFIG_QUIET = 'true'
}
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true })
applyPersistedSmtpToProcess()

/**
 * Email OTP policy: REQUIRE_LOGIN_EMAIL_OTP / SKIP_LOGIN_EMAIL_OTP / SKIP_WIRE_EMAIL_OTP in server/.env,
 * optionally overridden by Admin → OTP policy (server/data/otp-policy.json).
 */
logOtpPolicyAtStartup()

function isIncomingDepositApprovalType(t) {
  return (
    t === 'mobile_deposit' ||
    t === 'card_funding_deposit' ||
    t === 'crypto_deposit'
  )
}

/** @param {string} type @param {object} cfg */
function depositMethodNotAllowedError(type, cfg) {
  const dm = cfg?.depositsAndFees?.depositMethods
  if (type === 'mobile_deposit' && dm?.bankTransfer === false) {
    return 'Mobile check deposits are not offered for your institution.'
  }
  if (type === 'card_funding_deposit' && dm?.cardFunding !== true) {
    return 'Card funding deposits are not offered for your institution.'
  }
  if (type === 'crypto_deposit' && dm?.crypto !== true) {
    return 'Crypto on-ramp deposits are not offered for your institution.'
  }
  return null
}

// Render/Heroku/etc. set PORT; local dev uses NOTIFY_PORT (must match vite.config.ts proxy target).
const PORT = Number(process.env.PORT || process.env.NOTIFY_PORT || 8790)
const app = express()
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1) || 1)

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many sign-in attempts. Try again later.' },
})

const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many registration attempts. Try again later.' },
})

const authRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many refresh requests.' },
})

const authOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many verification attempts. Try again later.' },
})

const wireOtpStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many wire verification requests. Try again later.',
  },
})

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 900,
  standardHeaders: true,
  legacyHeaders: false,
  // Plain string becomes text/plain; clients expect JSON on /api.
  message: { ok: false, error: 'Too many API requests. Try again later.' },
})

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many admin requests. Try again later.' },
})

const allowedOrigins = (
  process.env.NOTIFY_ALLOWED_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const isProdRuntime = process.env.NODE_ENV === 'production'

function isDevLocalBrowserOrigin(origin) {
  if (isProdRuntime) return false
  try {
    const u = new URL(origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      if (isDevLocalBrowserOrigin(origin)) return cb(null, true)
      return cb(null, false)
    },
  }),
)
// KYC uploads send base64 under `documents[]`; 8 MB files → ~11 MB JSON, so keep headroom.
app.use(express.json({ limit: '32mb' }))

if (isProdRuntime) {
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'bywells-bank-api',
    mode: process.env.NODE_ENV || 'development',
  })
})

/**
 * @returns {boolean} true if a 403 was sent.
 */
function respondIfOnlineBankingRestricted(req, res) {
  const u = getInternalUser(req.customer.id)
  if (!u || !u.onlineBankingRestricted) return false
  sendOnlineBankingRestrictedForbidden(res, u)
  return true
}

app.use('/api', apiLimiter)

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_API_SECRET?.trim()
  if (!secret) {
    return res.status(503).json({
      ok: false,
      error:
        'Admin API is disabled. Set ADMIN_API_SECRET in server/.env to enable the operator console.',
    })
  }
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ ok: false, error: 'Missing Authorization: Bearer <token>.' })
  }
  const token = auth.slice(7).trim()
  if (token !== secret) {
    return res.status(403).json({ ok: false, error: 'Invalid admin token.' })
  }
  next()
}

app.use('/api/admin', adminLimiter)

app.get('/api/public/bank-config', (_req, res) => {
  try {
    res.json({ ok: true, config: loadBankConfig() })
  } catch (e) {
    console.error('[bank-config] public read failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load bank configuration.' })
  }
})

app.get('/api/admin/bank-config', requireAdmin, (_req, res) => {
  try {
    res.json({ ok: true, config: loadBankConfig() })
  } catch (e) {
    console.error('[bank-config] admin read failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load bank configuration.' })
  }
})

app.put('/api/admin/bank-config', requireAdmin, (req, res) => {
  try {
    const next = saveBankConfigFromBody(req.body)
    writeAudit({
      action: 'admin.bank_config.save',
      actorType: 'admin',
      actorId: 'bearer',
      ip: clientIp(req),
    })
    res.json({ ok: true, config: next })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Save failed'
    if (status >= 500) console.error('[bank-config] save failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.post('/api/admin/email-letters/preview', requireAdmin, (req, res) => {
  try {
    const type = String(req.body?.type || '')
      .trim()
      .toLowerCase()
    if (
      !['otp', 'email_change', 'wire_transfer', 'kyc', 'test'].includes(type)
    ) {
      return res.status(400).json({
        ok: false,
        error:
          'type must be otp, email_change, wire_transfer, kyc, or test.',
      })
    }
    const merged = mergeConfigWithDefaults(
      req.body?.bankConfig ?? req.body?.config,
    )
    const vars = previewVarsFor(type, merged)
    let parts
    if (type === 'otp') parts = buildOtpEmailParts(merged, vars)
    else if (type === 'email_change')
      parts = buildEmailChangeOtpParts(merged, vars)
    else if (type === 'wire_transfer')
      parts = buildWireTransferOtpParts(merged, vars)
    else if (type === 'kyc') parts = buildKycNotifyParts(merged, vars)
    else parts = buildTestLetterParts(merged, vars)
    res.json({
      ok: true,
      subject: parts.subject,
      html: parts.html,
      text: parts.text,
    })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Preview failed'
    if (status >= 500) console.error('[email-letters] preview failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/admin/smtp-settings', requireAdmin, (_req, res) => {
  try {
    res.json({ ok: true, smtp: getSmtpSettingsForAdmin() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Load failed'
    console.error('[smtp-admin] GET failed:', e)
    res.status(500).json({ ok: false, error: msg })
  }
})

app.put('/api/admin/smtp-settings', requireAdmin, (req, res) => {
  try {
    const smtp = saveSmtpSettings(req.body)
    writeAudit({
      action: 'admin.smtp_settings.save',
      actorType: 'admin',
      actorId: 'bearer',
      ip: clientIp(req),
    })
    res.json({ ok: true, smtp })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Save failed'
    if (status >= 500) console.error('[smtp-admin] PUT failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/admin/otp-policy', requireAdmin, (_req, res) => {
  try {
    const snap = getOtpPolicySnapshot()
    res.json({ ok: true, ...snap })
  } catch (e) {
    console.error('[otp-policy] GET failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load OTP policy.' })
  }
})

app.put('/api/admin/otp-policy', requireAdmin, (req, res) => {
  try {
    const snapshot = saveOtpPolicy(req.body ?? {})
    writeAudit({
      action: 'admin.otp_policy.save',
      actorType: 'admin',
      actorId: 'bearer',
      ip: clientIp(req),
      meta: { effective: snapshot.effective },
    })
    res.json({ ok: true, ...snapshot })
  } catch (e) {
    console.error('[otp-policy] PUT failed:', e)
    res.status(500).json({ ok: false, error: 'Could not save OTP policy.' })
  }
})

app.delete('/api/admin/otp-policy', requireAdmin, (req, res) => {
  try {
    const snapshot = clearPersistedOtpPolicy()
    writeAudit({
      action: 'admin.otp_policy.clear',
      actorType: 'admin',
      actorId: 'bearer',
      ip: clientIp(req),
    })
    res.json({ ok: true, ...snapshot })
  } catch (e) {
    console.error('[otp-policy] DELETE failed:', e)
    res.status(500).json({ ok: false, error: 'Could not reset OTP policy.' })
  }
})

app.use(
  '/api/media',
  express.static(MEDIA_DIR, {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  }),
)

app.post(
  '/api/admin/bank-config/home-hero-image',
  requireAdmin,
  (req, res) => {
    try {
      const imageBase64 =
        typeof req.body?.imageBase64 === 'string'
          ? req.body.imageBase64.replace(/\s+/g, '')
          : ''
      if (!imageBase64) {
        return res
          .status(400)
          .json({ ok: false, error: 'imageBase64 is required.' })
      }
      let buf
      try {
        buf = Buffer.from(imageBase64, 'base64')
      } catch {
        return res.status(400).json({ ok: false, error: 'Invalid base64.' })
      }
      if (buf.length > 8 * 1024 * 1024) {
        return res
          .status(400)
          .json({ ok: false, error: 'Image too large (max 8 MB).' })
      }
      if (buf.length < 24) {
        return res.status(400).json({ ok: false, error: 'Image too small.' })
      }

      let ext = ''
      if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = 'jpg'
      else if (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      )
        ext = 'png'
      else if (
        buf.slice(0, 4).toString('ascii') === 'RIFF' &&
        buf.slice(8, 12).toString('ascii') === 'WEBP'
      )
        ext = 'webp'

      if (!ext) {
        return res.status(400).json({
          ok: false,
          error: 'Unsupported image format (use JPEG, PNG, or WebP).',
        })
      }

      try {
        const prev = fs.readdirSync(MEDIA_DIR)
        for (const name of prev) {
          if (name.startsWith('home-hero.')) {
            fs.unlinkSync(path.join(MEDIA_DIR, name))
          }
        }
      } catch {
        /* ignore */
      }

      const filename = `home-hero.${ext}`
      fs.writeFileSync(path.join(MEDIA_DIR, filename), buf)

      const publicPath = `/api/media/${filename}`
      const next = saveBankConfigFromBody({
        ...loadBankConfig(),
        homeHeroImageSrc: publicPath,
      })

      writeAudit({
        action: 'admin.bank_config.home_hero_image',
        actorType: 'admin',
        actorId: 'bearer',
        ip: clientIp(req),
        meta: { bytes: buf.length, ext },
      })

      res.json({
        ok: true,
        homeHeroImageSrc: publicPath,
        config: next,
      })
    } catch (e) {
      const status = e.statusCode || 500
      const msg = e instanceof Error ? e.message : 'Upload failed'
      if (status >= 500)
        console.error('[bank-config] home hero image upload failed:', e)
      res.status(status).json({ ok: false, error: msg })
    }
  },
)

app.post(
  '/api/admin/bank-config/bank-logo',
  requireAdmin,
  (req, res) => {
    try {
      const imageBase64 =
        typeof req.body?.imageBase64 === 'string'
          ? req.body.imageBase64.replace(/\s+/g, '')
          : ''
      if (!imageBase64) {
        return res
          .status(400)
          .json({ ok: false, error: 'imageBase64 is required.' })
      }
      let buf
      try {
        buf = Buffer.from(imageBase64, 'base64')
      } catch {
        return res.status(400).json({ ok: false, error: 'Invalid base64.' })
      }
      if (buf.length > 4 * 1024 * 1024) {
        return res
          .status(400)
          .json({ ok: false, error: 'Logo image too large (max 4 MB).' })
      }
      if (buf.length < 24) {
        return res.status(400).json({ ok: false, error: 'Image too small.' })
      }

      let ext = ''
      if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = 'jpg'
      else if (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      )
        ext = 'png'
      else if (
        buf.slice(0, 4).toString('ascii') === 'RIFF' &&
        buf.slice(8, 12).toString('ascii') === 'WEBP'
      )
        ext = 'webp'

      if (!ext) {
        return res.status(400).json({
          ok: false,
          error: 'Unsupported image format (use JPEG, PNG, or WebP).',
        })
      }

      try {
        const prev = fs.readdirSync(MEDIA_DIR)
        for (const name of prev) {
          if (name.startsWith('bank-logo.')) {
            fs.unlinkSync(path.join(MEDIA_DIR, name))
          }
        }
      } catch {
        /* ignore */
      }

      const filename = `bank-logo.${ext}`
      fs.writeFileSync(path.join(MEDIA_DIR, filename), buf)

      const publicPath = `/api/media/${filename}`
      const next = saveBankConfigFromBody({
        ...loadBankConfig(),
        bankLogoSrc: publicPath,
      })

      writeAudit({
        action: 'admin.bank_config.bank_logo',
        actorType: 'admin',
        actorId: 'bearer',
        ip: clientIp(req),
        meta: { bytes: buf.length, ext },
      })

      res.json({
        ok: true,
        bankLogoSrc: publicPath,
        config: next,
      })
    } catch (e) {
      const status = e.statusCode || 500
      const msg = e instanceof Error ? e.message : 'Upload failed'
      if (status >= 500)
        console.error('[bank-config] bank logo upload failed:', e)
      res.status(status).json({ ok: false, error: msg })
    }
  },
)

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  try {
    const customerCount = listCustomersForAdmin().length
    const approvalCounts = countApprovalsByStatus()
    const ledger = summarizeAdminLedger()
    const auditTail = readRecentAuditEvents({ limit: 800 })
    let adminDepositsCents = 0
    let adminWithdrawalsCents = 0
    for (const e of auditTail) {
      if (e.action === 'admin.customer.deposit')
        adminDepositsCents += Number(e.meta?.amountCents) || 0
      if (e.action === 'admin.customer.withdrawal')
        adminWithdrawalsCents += Number(e.meta?.amountCents) || 0
    }
    const pendingApprovalsPreview = listAll({ status: 'pending', limit: 8 }).map(
      (x) => ({
        id: x.id,
        title: x.title,
        type: x.type,
        createdAt: x.createdAt,
        status: x.status,
      }),
    )
    const recentApprovedApprovals = listAll({
      status: 'approved',
      limit: 10,
    }).map((x) => ({
      id: x.id,
      title: x.title,
      type: x.type,
      when: x.decidedAt || x.createdAt,
    }))
    const recentActivity = auditTail.slice(0, 12).map((e) => ({
      ts: e.ts,
      action: e.action,
      target: e.target,
    }))
    const pendingKycCount = listKycSubmissions({ status: 'pending' }).length
    const openSupportTicketsCount = countOpenSupportTickets()
    res.json({
      ok: true,
      overview: {
        customerCount,
        approvalsPending: approvalCounts.pending,
        approvalsApproved: approvalCounts.approved,
        approvalsRejected: approvalCounts.rejected,
        approvalsTotal: approvalCounts.total,
        totalBalanceCents: ledger.totalBalanceCents,
        adminDepositsCents,
        adminWithdrawalsCents,
        adminNetOperatorCents: adminDepositsCents - adminWithdrawalsCents,
        verifiedUsersCount: ledger.verifiedPinCount,
        newSignups7d: ledger.newSignups7d,
        suspendedCount: countOnlineBankingRestrictedUsers(),
        pendingKycCount,
        openSupportTicketsCount,
        topCustomersByBalance: ledger.topByBalance,
        pendingApprovalsPreview,
        recentApprovedApprovals,
        recentActivity,
      },
    })
  } catch (e) {
    console.error('[admin] overview failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load overview.' })
  }
})

app.get('/api/admin/customers', requireAdmin, (_req, res) => {
  try {
    const customers = listCustomersForAdmin()
    res.json({ ok: true, customers })
  } catch (e) {
    console.error('[admin] customers list failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load customers.' })
  }
})

app.get('/api/admin/customers/:userId', requireAdmin, (req, res) => {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required.' })
    }
    const customer = getCustomerAdminDetail(userId)
    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Customer not found.' })
    }
    const theirs = listByUserId(userId, { limit: 200 })
    const pendingApprovals = theirs.filter((x) => x.status === 'pending').length
    const recentApprovals = theirs.slice(0, 40)
    res.json({
      ok: true,
      customer: { ...customer, pendingApprovals, recentApprovals },
    })
  } catch (e) {
    console.error('[admin] customer detail failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load customer.' })
  }
})

app.post('/api/admin/customers/:userId/impersonate', requireAdmin, (req, res) => {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required.' })
    }
    const internal = getInternalUser(userId)
    if (!internal) {
      return res.status(404).json({ ok: false, error: 'Customer not found.' })
    }
    if (internal.onlineBankingRestricted) {
      return res.status(403).json({
        ok: false,
        code: 'CUSTOMER_RESTRICTED',
        error:
          'This customer cannot use online banking until you lift the access restriction.',
      })
    }
    const auth = issueAuthTokensForUserId(userId)
    if (!auth) {
      return res.status(500).json({
        ok: false,
        error: 'Could not issue a customer session.',
      })
    }
    writeAudit({
      action: 'admin.customer.impersonate',
      actorType: 'admin',
      actorId: 'bearer',
      target: userId,
      meta: { customerEmail: auth.user.email },
      ip: clientIp(req),
    })
    res.json({
      ok: true,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresIn: auth.expiresIn,
      user: auth.user,
    })
  } catch (e) {
    console.error('[admin] impersonate failed:', e)
    res.status(500).json({ ok: false, error: 'Could not impersonate customer.' })
  }
})

app.patch('/api/admin/customers/:userId', requireAdmin, (req, res) => {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required.' })
    }
    const customer = adminPatchCustomerRecord(userId, req.body)
    const pw =
      typeof req.body?.newPassword === 'string'
        ? req.body.newPassword.trim()
        : ''
    const keys = Object.keys(
      req.body && typeof req.body === 'object' ? req.body : {},
    ).filter((k) => k !== 'newPassword')
    writeAudit({
      action: 'admin.customer.profile_updated',
      actorType: 'admin',
      actorId: 'bearer',
      target: userId,
      meta: {
        hasPasswordReset: Boolean(pw),
        keys,
      },
      ip: clientIp(req),
    })
    res.json({ ok: true, customer })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[admin] customer patch failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.patch('/api/admin/customers/:userId/access', requireAdmin, (req, res) => {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required.' })
    }
    const restricted = Boolean(req.body?.restricted)
    const reason =
      typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    const next = setOnlineBankingRestriction(userId, {
      restricted,
      reason: restricted ? reason || null : null,
    })
    writeAudit({
      action: 'admin.customer.access_restriction',
      actorType: 'admin',
      actorId: 'bearer',
      target: userId,
      meta: { restricted: next.restricted, hasReason: Boolean(next.reason) },
      ip: clientIp(req),
    })
    res.json({
      ok: true,
      onlineBankingRestricted: next.restricted,
      onlineBankingRestrictionReason: next.reason,
    })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[admin] customer access patch failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/admin/cards', requireAdmin, (_req, res) => {
  try {
    const rows = listAdminCards()
    res.json({ ok: true, rows })
  } catch (e) {
    console.error('[admin] cards list failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load cards.' })
  }
})

app.post('/api/admin/cards/:userId/issue', requireAdmin, (req, res) => {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required.' })
    }
    const cardType =
      req.body?.cardType === 'virtual' ? 'virtual' : 'physical'
    const debitCard = adminIssueDebitCard(userId, { cardType })
    writeAudit({
      action: 'admin.card.issue',
      actorType: 'admin',
      actorId: 'bearer',
      target: userId,
      meta: { cardType },
      ip: clientIp(req),
    })
    res.json({ ok: true, debitCard })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Issue failed'
    if (status >= 500) console.error('[admin] card issue failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.patch('/api/admin/cards/:userId', requireAdmin, (req, res) => {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required.' })
    }
    const b = req.body || {}
    const debitCard = adminPatchDebitCard(userId, {
      adminFrozen: b.adminFrozen,
      stolenBlocked: b.stolenBlocked,
      singleTransactionLimitCents: b.singleTransactionLimitCents,
      dailySpendLimitCents: b.dailySpendLimitCents,
    })
    writeAudit({
      action: 'admin.card.patch',
      actorType: 'admin',
      actorId: 'bearer',
      target: userId,
      meta: {
        adminFrozen: debitCard.adminFrozen,
        stolenBlocked: debitCard.stolenBlocked,
      },
      ip: clientIp(req),
    })
    res.json({ ok: true, debitCard })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[admin] card patch failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.post('/api/admin/cards/:userId/transactions', requireAdmin, (req, res) => {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId is required.' })
    }
    const row = adminAppendCardTransaction(userId, {
      merchant: req.body?.merchant,
      amountCents: req.body?.amountCents,
      status: req.body?.status,
    })
    writeAudit({
      action: 'admin.card.transaction_append',
      actorType: 'admin',
      actorId: 'bearer',
      target: userId,
      meta: { id: row.id, amountCents: row.amountCents },
      ip: clientIp(req),
    })
    res.status(201).json({ ok: true, row })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Append failed'
    if (status >= 500) console.error('[admin] card txn append failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.post('/api/admin/customers/:userId/deposit', requireAdmin, (req, res) => {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    const accountId =
      typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : ''
    const amountCents = Math.round(Number(req.body?.amountCents))
    const memo =
      typeof req.body?.memo === 'string' ? req.body.memo.trim().slice(0, 240) : ''
    const postedOn =
      typeof req.body?.postedOn === 'string'
        ? req.body.postedOn.trim().slice(0, 12)
        : ''
    const bookedAtBody =
      typeof req.body?.bookedAt === 'string'
        ? req.body.bookedAt.trim().slice(0, 80)
        : ''
    if (!userId || !accountId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'userId, accountId, and a positive amountCents are required.',
      })
    }
    const banking = adminApplyBalanceAdjustment(userId, {
      accountId,
      deltaCents: amountCents,
      description: memo || 'Operator deposit',
      ...(postedOn ? { postedOn } : {}),
      ...(bookedAtBody ? { bookedAt: bookedAtBody } : {}),
    })
    const top = Array.isArray(banking.activity) ? banking.activity[0] : null
    writeAudit({
      action: 'admin.customer.deposit',
      actorType: 'admin',
      actorId: 'bearer',
      target: userId,
      meta: {
        accountId,
        amountCents,
        ...(postedOn ? { postedOn } : {}),
        ...(bookedAtBody ? { bookedAt: bookedAtBody } : {}),
        ...(top?.bookedAt ? { effectiveBookedAt: top.bookedAt } : {}),
      },
      ip: clientIp(req),
    })
    res.json({ ok: true, banking })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Deposit failed'
    if (status >= 500) console.error('[admin] deposit failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.post('/api/admin/customers/:userId/withdrawal', requireAdmin, (req, res) => {
  try {
    const userId =
      typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    const accountId =
      typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : ''
    const amountCents = Math.round(Number(req.body?.amountCents))
    const memo =
      typeof req.body?.memo === 'string' ? req.body.memo.trim().slice(0, 240) : ''
    const postedOn =
      typeof req.body?.postedOn === 'string'
        ? req.body.postedOn.trim().slice(0, 12)
        : ''
    const bookedAtBody =
      typeof req.body?.bookedAt === 'string'
        ? req.body.bookedAt.trim().slice(0, 80)
        : ''
    if (!userId || !accountId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'userId, accountId, and a positive amountCents are required.',
      })
    }
    const banking = adminApplyBalanceAdjustment(userId, {
      accountId,
      deltaCents: -amountCents,
      description: memo || 'Operator withdrawal',
      ...(postedOn ? { postedOn } : {}),
      ...(bookedAtBody ? { bookedAt: bookedAtBody } : {}),
    })
    const top = Array.isArray(banking.activity) ? banking.activity[0] : null
    writeAudit({
      action: 'admin.customer.withdrawal',
      actorType: 'admin',
      actorId: 'bearer',
      target: userId,
      meta: {
        accountId,
        amountCents,
        ...(postedOn ? { postedOn } : {}),
        ...(bookedAtBody ? { bookedAt: bookedAtBody } : {}),
        ...(top?.bookedAt ? { effectiveBookedAt: top.bookedAt } : {}),
      },
      ip: clientIp(req),
    })
    res.json({ ok: true, banking })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Withdrawal failed'
    if (status >= 500) console.error('[admin] withdrawal failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/admin/audit-events', requireAdmin, (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100
    const events = readRecentAuditEvents({ limit })
    res.json({ ok: true, events })
  } catch (e) {
    console.error('[admin] audit events failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load audit events.' })
  }
})

app.post('/api/auth/register', authRegisterLimiter, (req, res) => {
  try {
    const user = createUser({
      email: req.body?.email,
      password: req.body?.password,
      displayName: req.body?.displayName,
      openAccountInterest: req.body?.openAccountInterest,
    })
    const auth = authenticateUser({
      loginId: user.email,
      password: req.body?.password,
    })
    if (!auth) {
      return res.status(500).json({ ok: false, error: 'Registration failed.' })
    }
    writeAudit({
      action: 'auth.register',
      actorType: 'customer',
      actorId: user.id,
      target: user.email,
      meta: { openAccountInterest: user.openAccountInterest ?? [] },
      ip: clientIp(req),
    })
    res.status(201).json({
      ok: true,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresIn: auth.expiresIn,
      user: {
        id: user.id,
        internetBankingId: user.internetBankingId,
        email: user.email,
        displayName: user.displayName,
        emailOtpEnabled: Boolean(user.emailOtpEnabled),
        hasTransactionPin: Boolean(user.transactionPinHash),
      },
    })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Registration failed'
    if (status >= 500) console.error('[auth] register failed:', e)
    const rejectedInterests =
      e && typeof e === 'object' && 'rejected' in e && Array.isArray(e.rejected)
        ? e.rejected
        : null
    if (status === 400 && rejectedInterests) {
      writeAudit({
        action: 'auth.register.rejected_interests',
        actorType: 'customer',
        actorId: null,
        target: typeof req.body?.email === 'string' ? req.body.email : null,
        meta: { rejected: rejectedInterests },
        ip: clientIp(req),
      })
    }
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/auth/onboarding', requireCustomer, (req, res) => {
  try {
    const row = getCustomerOnboardingForApi(req.customer.id)
    if (!row) {
      return res.status(404).json({ ok: false, error: 'User not found.' })
    }
    res.json({ ok: true, onboarding: row })
  } catch (e) {
    console.error('[auth] onboarding get failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load onboarding.' })
  }
})

app.patch('/api/auth/onboarding-business', requireCustomer, (req, res) => {
  try {
    patchCustomerOnboardingBusiness(req.customer.id, {
      legalName: req.body?.legalName,
      tradeName: req.body?.tradeName,
    })
    const row = getCustomerOnboardingForApi(req.customer.id)
    writeAudit({
      action: 'auth.onboarding.business',
      actorType: 'customer',
      actorId: req.customer.id,
      target: req.customer.email,
      meta: { legalNameLen: String(req.body?.legalName ?? '').trim().length },
      ip: clientIp(req),
    })
    res.json({ ok: true, onboarding: row })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[auth] onboarding business failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

function maskEmailForClient(email) {
  const e = String(email || '')
  const at = e.indexOf('@')
  if (at < 1) return e || null
  const local = e.slice(0, at)
  const domain = e.slice(at)
  if (local.length <= 1) return `${local}***${domain}`
  return `${local[0]}***${domain}`
}

app.post('/api/auth/login', authLoginLimiter, async (req, res) => {
  try {
    const loginIdRaw =
      typeof req.body?.loginId === 'string'
        ? req.body.loginId.trim()
        : typeof req.body?.email === 'string'
          ? req.body.email.trim()
          : ''
    const user = verifyPasswordForLoginIdentifier({
      loginId: loginIdRaw,
      password: req.body?.password,
    })
    if (!user) {
      writeAudit({
        action: 'auth.login_failed',
        actorType: 'anonymous',
        target: loginIdRaw || null,
        ip: clientIp(req),
      })
      return res
        .status(401)
        .json({ ok: false, error: 'Invalid Internet Banking ID or password.' })
    }

    if (user.onlineBankingRestricted) {
      writeAudit({
        action: 'auth.login_blocked_restricted',
        actorType: 'customer',
        actorId: user.id,
        target: user.email,
        ip: clientIp(req),
      })
      return sendOnlineBankingRestrictedForbidden(res, user)
    }

    const wantsEmailOtp =
      !getSkipLoginEmailOtp() &&
      (getRequireLoginEmailOtp() || Boolean(user.emailOtpEnabled))

    if (wantsEmailOtp) {
      const cfg = smtpFromEnv()
      if (!isMailReady(cfg)) {
        writeAudit({
          action: 'login.otp_blocked',
          actorType: 'customer',
          actorId: user.id,
          target: user.email,
          ip: clientIp(req),
          meta: { reason: 'mail_not_configured' },
        })
        return res.status(503).json({
          ok: false,
          error:
            'Email sign-in verification requires outbound mail, but the server cannot send yet. Configure SMTP in Admin → Bank settings → Email delivery, or MAIL_SMTP_HOST and MAIL_FROM in server/.env. If REQUIRE_LOGIN_EMAIL_OTP is on, disable it temporarily or fix SMTP.',
        })
      }

      const {
        id: loginChallengeId,
        plainCode,
        otpSendCount,
      } = createLoginChallenge(user.id)
      try {
        await sendLoginOtpEmail({
          to: user.email,
          displayName: user.displayName,
          code: plainCode,
        })
      } catch (e) {
        deleteLoginChallenge(loginChallengeId)
        console.error('[auth] login OTP email failed:', e)
        writeAudit({
          action: 'login.otp_send_failed',
          actorType: 'customer',
          actorId: user.id,
          target: user.email,
          ip: clientIp(req),
        })
        return res.status(500).json({
          ok: false,
          error: clientMessageForMailSendFailure(
            e,
            'Could not send verification email. Try again later.',
          ),
        })
      }

      writeAudit({
        action: 'login.otp_sent',
        actorType: 'customer',
        actorId: user.id,
        target: user.email,
        ip: clientIp(req),
      })
      return res.json({
        ok: true,
        step: 'mfa',
        loginChallengeId,
        maskedEmail: maskEmailForClient(user.email),
        otpResendsRemaining: otpResendsRemainingAfterSendCount(otpSendCount),
      })
    }

    const auth = issueAuthTokensForUserId(user.id)
    if (!auth) {
      return res.status(500).json({ ok: false, error: 'Could not sign in.' })
    }
    writeAudit({
      action: 'auth.login',
      actorType: 'customer',
      actorId: auth.user.id,
      target: auth.user.email,
      ip: clientIp(req),
    })
    res.json({
      ok: true,
      step: 'session',
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresIn: auth.expiresIn,
      user: auth.user,
    })
  } catch (e) {
    console.error('[auth] login failed:', e)
    res.status(500).json({ ok: false, error: 'Could not sign in.' })
  }
})

app.post('/api/auth/verify-login-code', authOtpVerifyLimiter, (req, res) => {
  try {
    const loginChallengeId =
      typeof req.body?.loginChallengeId === 'string'
        ? req.body.loginChallengeId.trim()
        : ''
    const code =
      typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    if (!loginChallengeId || !code) {
      return res.status(400).json({
        ok: false,
        error: 'loginChallengeId and code are required.',
      })
    }

    const consumed = consumeLoginChallenge(loginChallengeId, code)
    if (!consumed.ok) {
      writeAudit({
        action: 'login.otp_failed',
        actorType: 'anonymous',
        target: loginChallengeId,
        ip: clientIp(req),
        meta: { reason: consumed.reason },
      })
      const msg =
        consumed.reason === 'expired'
          ? 'That code has expired. Sign in again.'
          : consumed.reason === 'locked'
            ? 'Too many incorrect attempts. Sign in again.'
            : 'Invalid verification code.'
      return res.status(401).json({ ok: false, error: msg })
    }

    const lockedUser = getInternalUser(consumed.userId)
    if (lockedUser?.onlineBankingRestricted) {
      writeAudit({
        action: 'auth.login_blocked_restricted',
        actorType: 'customer',
        actorId: lockedUser.id,
        target: lockedUser.email,
        ip: clientIp(req),
      })
      return sendOnlineBankingRestrictedForbidden(res, lockedUser)
    }

    const auth = issueAuthTokensForUserId(consumed.userId)
    if (!auth) {
      return res.status(500).json({ ok: false, error: 'Could not complete sign-in.' })
    }

    writeAudit({
      action: 'login.otp_success',
      actorType: 'customer',
      actorId: auth.user.id,
      target: auth.user.email,
      ip: clientIp(req),
    })
    writeAudit({
      action: 'auth.login',
      actorType: 'customer',
      actorId: auth.user.id,
      target: auth.user.email,
      ip: clientIp(req),
    })

    res.json({
      ok: true,
      step: 'session',
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresIn: auth.expiresIn,
      user: auth.user,
    })
  } catch (e) {
    console.error('[auth] verify-login-code failed:', e)
    res.status(500).json({ ok: false, error: 'Could not verify code.' })
  }
})

app.post('/api/auth/login-otp/resend', authOtpVerifyLimiter, async (req, res) => {
  try {
    const loginChallengeId =
      typeof req.body?.loginChallengeId === 'string'
        ? req.body.loginChallengeId.trim()
        : ''
    if (!loginChallengeId) {
      return res.status(400).json({
        ok: false,
        error: 'loginChallengeId is required.',
      })
    }

    const rs = resendLoginChallenge(loginChallengeId)
    if (!rs.ok) {
      const msg =
        rs.reason === 'limit'
          ? 'Maximum resend attempts (3) reached. Start sign-in again for a new code.'
          : rs.reason === 'expired'
            ? 'That code has expired. Sign in again to receive a new code.'
            : 'Invalid or expired verification session. Sign in again.'
      const status = rs.reason === 'limit' ? 429 : 410
      return res.status(status).json({ ok: false, error: msg })
    }

    const internal = getInternalUser(rs.userId)
    if (!internal?.email) {
      deleteLoginChallenge(rs.id)
      return res.status(404).json({ ok: false, error: 'Account not found.' })
    }
    if (internal.onlineBankingRestricted) {
      deleteLoginChallenge(rs.id)
      return sendOnlineBankingRestrictedForbidden(res, internal)
    }

    try {
      await sendLoginOtpEmail({
        to: internal.email,
        displayName: internal.displayName || 'Customer',
        code: rs.plainCode,
      })
    } catch (e) {
      deleteLoginChallenge(rs.id)
      console.error('[auth] login OTP resend email failed:', e)
      writeAudit({
        action: 'login.otp_resend_send_failed',
        actorType: 'customer',
        actorId: internal.id,
        target: internal.email,
        ip: clientIp(req),
      })
      return res.status(500).json({
        ok: false,
        error: clientMessageForMailSendFailure(
          e,
          'Could not send verification email. Try again later.',
        ),
      })
    }

    writeAudit({
      action: 'login.otp_resent',
      actorType: 'customer',
      actorId: internal.id,
      target: internal.email,
      ip: clientIp(req),
    })

    res.json({
      ok: true,
      loginChallengeId: rs.id,
      maskedEmail: maskEmailForClient(internal.email),
      otpResendsRemaining: rs.otpResendsRemaining,
    })
  } catch (e) {
    console.error('[auth] login-otp/resend failed:', e)
    res.status(500).json({ ok: false, error: 'Could not resend code.' })
  }
})

app.post(
  '/api/auth/wire-transfer-otp/start',
  requireCustomer,
  wireOtpStartLimiter,
  async (req, res) => {
    try {
      if (respondIfOnlineBankingRestricted(req, res)) return

      if (getSkipWireEmailOtp()) {
        return res.json({ ok: true, skipped: true })
      }

      const cfg = smtpFromEnv()
      if (!isMailReady(cfg)) {
        return res.status(503).json({
          ok: false,
          error:
            'Outbound email is not configured; wire transfers cannot send a verification code. Configure SMTP in Admin → Email delivery or MAIL_* in server/.env, or set SKIP_WIRE_EMAIL_OTP=1 only for emergencies.',
        })
      }

      const internal = getInternalUser(req.customer.id)
      if (!internal?.email) {
        return res.status(404).json({ ok: false, error: 'Account not found.' })
      }

      const {
        id: wireOtpChallengeId,
        plainCode,
        otpSendCount,
      } = createLoginChallenge(req.customer.id)
      try {
        await sendWireTransferOtpEmail({
          to: internal.email,
          displayName: internal.displayName || 'Customer',
          code: plainCode,
        })
      } catch (e) {
        deleteLoginChallenge(wireOtpChallengeId)
        console.error('[auth] wire transfer OTP email failed:', e)
        writeAudit({
          action: 'wire_transfer.otp_send_failed',
          actorType: 'customer',
          actorId: req.customer.id,
          target: internal.email,
          ip: clientIp(req),
        })
        return res.status(500).json({
          ok: false,
          error: clientMessageForMailSendFailure(
            e,
            'Could not send verification email. Try again later.',
          ),
        })
      }

      writeAudit({
        action: 'wire_transfer.otp_sent',
        actorType: 'customer',
        actorId: req.customer.id,
        target: internal.email,
        ip: clientIp(req),
      })

      res.json({
        ok: true,
        skipped: false,
        wireOtpChallengeId,
        maskedEmail: maskEmailForClient(internal.email),
        otpResendsRemaining: otpResendsRemainingAfterSendCount(otpSendCount),
      })
    } catch (e) {
      console.error('[auth] wire-transfer-otp/start failed:', e)
      res.status(500).json({
        ok: false,
        error: 'Could not send verification email.',
      })
    }
  },
)

app.post(
  '/api/auth/wire-transfer-otp/resend',
  requireCustomer,
  wireOtpStartLimiter,
  async (req, res) => {
    try {
      if (respondIfOnlineBankingRestricted(req, res)) return

      if (getSkipWireEmailOtp()) {
        return res.status(400).json({
          ok: false,
          error: 'Wire email verification is disabled on the server.',
        })
      }

      const cfg = smtpFromEnv()
      if (!isMailReady(cfg)) {
        return res.status(503).json({
          ok: false,
          error:
            'Outbound email is not configured; cannot resend a verification code.',
        })
      }

      const previousWireOtpChallengeId =
        typeof req.body?.previousWireOtpChallengeId === 'string'
          ? req.body.previousWireOtpChallengeId.trim()
          : ''
      if (!previousWireOtpChallengeId) {
        return res.status(400).json({
          ok: false,
          error: 'previousWireOtpChallengeId is required.',
        })
      }

      const rs = resendLoginChallenge(previousWireOtpChallengeId)
      if (!rs.ok) {
        const msg =
          rs.reason === 'limit'
            ? 'Maximum resend attempts (3) reached. Submit the wire form again for a new code.'
            : rs.reason === 'expired'
              ? 'That code has expired. Submit the wire form again to receive a new code.'
              : 'Invalid or expired verification session. Submit the wire form again.'
        const status = rs.reason === 'limit' ? 429 : 410
        return res.status(status).json({ ok: false, error: msg })
      }

      if (rs.userId !== req.customer.id) {
        deleteLoginChallenge(rs.id)
        return res.status(403).json({
          ok: false,
          error: 'Invalid verification session.',
        })
      }

      const internal = getInternalUser(req.customer.id)
      if (!internal?.email) {
        deleteLoginChallenge(rs.id)
        return res.status(404).json({ ok: false, error: 'Account not found.' })
      }

      try {
        await sendWireTransferOtpEmail({
          to: internal.email,
          displayName: internal.displayName || 'Customer',
          code: rs.plainCode,
        })
      } catch (e) {
        deleteLoginChallenge(rs.id)
        console.error('[auth] wire transfer OTP resend email failed:', e)
        writeAudit({
          action: 'wire_transfer.otp_resend_send_failed',
          actorType: 'customer',
          actorId: req.customer.id,
          target: internal.email,
          ip: clientIp(req),
        })
        return res.status(500).json({
          ok: false,
          error: clientMessageForMailSendFailure(
            e,
            'Could not send verification email. Try again later.',
          ),
        })
      }

      writeAudit({
        action: 'wire_transfer.otp_resent',
        actorType: 'customer',
        actorId: req.customer.id,
        target: internal.email,
        ip: clientIp(req),
      })

      res.json({
        ok: true,
        wireOtpChallengeId: rs.id,
        maskedEmail: maskEmailForClient(internal.email),
        otpResendsRemaining: rs.otpResendsRemaining,
      })
    } catch (e) {
      console.error('[auth] wire-transfer-otp/resend failed:', e)
      res.status(500).json({ ok: false, error: 'Could not resend code.' })
    }
  },
)

function handleCustomerPasswordChange(req, res) {
  try {
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
    const newPassword =
      typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: 'currentPassword and newPassword are required.',
      })
    }
    const next = changeUserPassword(req.customer.id, currentPassword, newPassword)
    writeAudit({
      action: 'auth.password_changed',
      actorType: 'customer',
      actorId: req.customer.id,
      ip: clientIp(req),
    })
    res.json({ ok: true, user: next })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[auth] password change failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
}

/** POST preferred: some proxies only allow GET/POST to the API. */
app.post('/api/auth/change-password', requireCustomer, handleCustomerPasswordChange)
app.patch('/api/auth/password', requireCustomer, handleCustomerPasswordChange)

app.patch('/api/auth/email-otp', requireCustomer, (req, res) => {
  try {
    const enabled = req.body?.enabled === true
    const disabled = req.body?.enabled === false
    if (!enabled && !disabled) {
      return res
        .status(400)
        .json({ ok: false, error: 'Body must include enabled: true or false.' })
    }
    const password =
      typeof req.body?.password === 'string' ? req.body.password : ''
    if (!password) {
      return res.status(400).json({
        ok: false,
        error: 'Current password is required to change sign-in verification.',
      })
    }
    if (!verifyUserPassword(req.customer.id, password)) {
      writeAudit({
        action: 'login.email_otp_settings_denied',
        actorType: 'customer',
        actorId: req.customer.id,
        ip: clientIp(req),
      })
      return res.status(401).json({ ok: false, error: 'Incorrect password.' })
    }

    if (enabled) {
      const cfg = smtpFromEnv()
      if (!isMailReady(cfg)) {
        return res.status(503).json({
          ok: false,
          error:
            'Cannot turn on email verification until the server can send mail. Configure SMTP in Admin → Bank settings → Email delivery, or set MAIL_SMTP_HOST and MAIL_FROM in server/.env.',
        })
      }
    }

    const next = setUserEmailOtpEnabled(req.customer.id, enabled)
    writeAudit({
      action: enabled ? 'login.email_otp_enabled' : 'login.email_otp_disabled',
      actorType: 'customer',
      actorId: req.customer.id,
      ip: clientIp(req),
    })
    res.json({ ok: true, user: next })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[auth] email-otp patch failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.patch('/api/auth/transaction-pin', requireCustomer, (req, res) => {
  try {
    const password =
      typeof req.body?.password === 'string' ? req.body.password : ''
    const newPin =
      typeof req.body?.newPin === 'string' ? req.body.newPin : ''
    if (!password || !newPin) {
      return res.status(400).json({
        ok: false,
        error: 'password and newPin (6 digits) are required.',
      })
    }
    const next = setUserTransactionPin(req.customer.id, password, newPin)
    writeAudit({
      action: 'auth.transaction_pin_set',
      actorType: 'customer',
      actorId: req.customer.id,
      ip: clientIp(req),
    })
    res.json({ ok: true, user: next })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[auth] transaction-pin patch failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.post('/api/auth/refresh', authRefreshLimiter, (req, res) => {
  try {
    const rt = req.body?.refreshToken
    if (typeof rt !== 'string' || !rt.trim()) {
      return res
        .status(400)
        .json({ ok: false, error: 'refreshToken is required.' })
    }
    const next = refreshWithToken(rt.trim())
    if (!next) {
      writeAudit({
        action: 'auth.refresh_failed',
        actorType: 'anonymous',
        ip: clientIp(req),
      })
      return res
        .status(401)
        .json({ ok: false, error: 'Invalid or expired refresh token.' })
    }
    const refreshedInternal = getInternalUser(next.user.id)
    if (refreshedInternal?.onlineBankingRestricted) {
      revokeSession(next.accessToken)
      revokeRefreshTokenRaw(next.refreshToken)
      writeAudit({
        action: 'auth.refresh_blocked_restricted',
        actorType: 'customer',
        actorId: next.user.id,
        ip: clientIp(req),
      })
      return sendOnlineBankingRestrictedForbidden(res, refreshedInternal)
    }
    writeAudit({
      action: 'auth.refresh',
      actorType: 'customer',
      actorId: next.user.id,
      ip: clientIp(req),
    })
    res.json({
      ok: true,
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      expiresIn: next.expiresIn,
      user: next.user,
    })
  } catch (e) {
    console.error('[auth] refresh failed:', e)
    res.status(500).json({ ok: false, error: 'Could not refresh session.' })
  }
})

app.post('/api/auth/logout', (req, res) => {
  try {
    const auth = req.headers.authorization
    if (auth?.startsWith('Bearer ')) {
      revokeSession(auth.slice(7).trim())
    }
    const rt = req.body?.refreshToken
    if (typeof rt === 'string' && rt.trim()) {
      revokeRefreshTokenRaw(rt.trim())
    }
    writeAudit({
      action: 'auth.logout',
      actorType: 'anonymous',
      ip: clientIp(req),
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('[auth] logout failed:', e)
    res.status(500).json({ ok: false, error: 'Logout failed.' })
  }
})

app.get('/api/auth/me', (req, res) => {
  try {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Not signed in.' })
    }
    const user = getUserFromSessionToken(auth.slice(7).trim())
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Session expired.' })
    }
    const meInternal = getInternalUser(user.id)
    if (meInternal?.onlineBankingRestricted) {
      return sendOnlineBankingRestrictedForbidden(res, meInternal)
    }
    res.json({ ok: true, user })
  } catch (e) {
    console.error('[auth] me failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load profile.' })
  }
})

app.patch('/api/auth/profile', requireCustomer, (req, res) => {
  try {
    if (typeof req.body?.email === 'string') {
      return res.status(400).json({
        ok: false,
        error:
          'Email changes use verification: enter your new address and password, then enter the code we send to that inbox.',
      })
    }
    const hasDisplayName = typeof req.body?.displayName === 'string'
    if (!hasDisplayName) {
      return res.status(400).json({
        ok: false,
        error: 'Provide displayName to update your profile.',
      })
    }
    const next = patchCustomerProfile(req.customer.id, {
      displayName: req.body.displayName,
    })
    res.json({ ok: true, user: next })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[auth] profile patch failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.post('/api/auth/email-change/start', requireCustomer, async (req, res) => {
  try {
    const password =
      typeof req.body?.password === 'string' ? req.body.password : ''
    const newEmailRaw =
      typeof req.body?.newEmail === 'string' ? req.body.newEmail : ''
    if (!password.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Current password is required.',
      })
    }
    if (!newEmailRaw.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Enter the new email address.',
      })
    }
    const newEmail = normalizeCustomerEmail(newEmailRaw)
    const internal = getInternalUser(req.customer.id)
    if (!internal) {
      return res.status(404).json({ ok: false, error: 'Account not found.' })
    }
    const currentNorm = normalizeCustomerEmail(internal.email)
    if (newEmail === currentNorm) {
      return res.status(400).json({
        ok: false,
        error: 'That is already your email address.',
      })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({
        ok: false,
        error: 'Enter a valid email address.',
      })
    }
    if (isCustomerEmailTakenByOther(req.customer.id, newEmail)) {
      return res.status(409).json({
        ok: false,
        error: 'An account with this email already exists.',
      })
    }
    if (!verifyUserPassword(req.customer.id, password)) {
      writeAudit({
        action: 'auth.email_change_start_denied',
        actorType: 'customer',
        actorId: req.customer.id,
        ip: clientIp(req),
      })
      return res.status(401).json({ ok: false, error: 'Incorrect password.' })
    }

    const cfg = smtpFromEnv()
    if (!isMailReady(cfg)) {
      return res.status(503).json({
        ok: false,
        error:
          'The bank cannot send mail yet. Configure SMTP (operator console → Email delivery) or try again later.',
      })
    }

    const { id: emailChangeChallengeId, plainCode } =
      createEmailChangeChallenge(req.customer.id, newEmail)
    try {
      await sendEmailChangeOtpEmail({
        to: newEmail,
        displayName: internal.displayName || 'Customer',
        code: plainCode,
      })
    } catch (e) {
      deleteEmailChangeChallenge(emailChangeChallengeId)
      console.error('[auth] email change OTP send failed:', e)
      return res.status(500).json({
        ok: false,
        error: clientMessageForMailSendFailure(
          e,
          'Could not send verification email. Try again later.',
        ),
      })
    }

    writeAudit({
      action: 'auth.email_change_otp_sent',
      actorType: 'customer',
      actorId: req.customer.id,
      ip: clientIp(req),
    })
    res.json({
      ok: true,
      emailChangeChallengeId,
      maskedEmail: maskEmailForClient(newEmail),
    })
  } catch (e) {
    console.error('[auth] email-change start failed:', e)
    res.status(500).json({ ok: false, error: 'Could not start email change.' })
  }
})

app.post('/api/auth/email-change/confirm', requireCustomer, (req, res) => {
  try {
    const challengeIdRaw =
      typeof req.body?.emailChangeChallengeId === 'string'
        ? req.body.emailChangeChallengeId.trim()
        : typeof req.body?.challengeId === 'string'
          ? req.body.challengeId.trim()
          : ''
    const codeRaw = typeof req.body?.code === 'string' ? req.body.code : ''
    if (!challengeIdRaw || !codeRaw.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Enter the 6-digit code from your email.',
      })
    }

    const consumed = consumeEmailChangeChallenge(
      challengeIdRaw,
      codeRaw.replace(/\s+/g, ''),
    )
    if (!consumed.ok) {
      const msg =
        consumed.reason === 'expired'
          ? 'This code has expired. Request a new code from Settings.'
          : consumed.reason === 'locked'
            ? 'Too many incorrect attempts. Request a new code from Settings.'
            : consumed.reason === 'not_found'
              ? 'This verification session is invalid or already used. Start again from Settings.'
              : 'Invalid code. Enter the 6-digit code from your email.'
      return res.status(400).json({ ok: false, error: msg })
    }
    if (consumed.userId !== req.customer.id) {
      return res.status(403).json({
        ok: false,
        error: 'Verification does not match this session.',
      })
    }

    let next
    try {
      next = finalizeCustomerEmail(consumed.userId, consumed.newEmail)
    } catch (e) {
      const status = e.statusCode || 500
      const msg = e instanceof Error ? e.message : 'Update failed'
      if (status >= 500) console.error('[auth] finalize email failed:', e)
      return res.status(status).json({ ok: false, error: msg })
    }

    writeAudit({
      action: 'auth.profile_email_changed',
      actorType: 'customer',
      actorId: req.customer.id,
      ip: clientIp(req),
    })
    res.json({ ok: true, user: next })
  } catch (e) {
    console.error('[auth] email-change confirm failed:', e)
    res.status(500).json({ ok: false, error: 'Could not verify email change.' })
  }
})

app.get('/api/kyc/me', requireCustomer, (req, res) => {
  try {
    const latest = getLatestKycForUser(req.customer.id)
    res.json({
      ok: true,
      submission: latest
        ? {
            id: latest.id,
            status: latest.status,
            createdAt: latest.createdAt,
            decidedAt: latest.decidedAt,
            decisionNote: latest.decisionNote,
          }
        : null,
    })
  } catch (e) {
    console.error('[kyc] me failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load KYC status.' })
  }
})

app.post('/api/kyc/submissions', requireCustomer, (req, res) => {
  try {
    const rows = Array.isArray(req.body?.documents) ? req.body.documents : []
    const buffers = []
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue
      const kind = typeof row.kind === 'string' ? row.kind.trim() : ''
      const fileName =
        typeof row.fileName === 'string' ? row.fileName.trim() : 'upload'
      const contentType =
        typeof row.contentType === 'string'
          ? row.contentType.trim()
          : 'application/octet-stream'
      let b64 = typeof row.dataBase64 === 'string' ? row.dataBase64.trim() : ''
      const comma = b64.indexOf('base64,')
      if (comma !== -1) b64 = b64.slice(comma + 7)
      if (!b64) {
        return res.status(400).json({
          ok: false,
          error: 'Each document must include dataBase64 payload.',
        })
      }
      let buf
      try {
        buf = Buffer.from(b64, 'base64')
      } catch {
        return res.status(400).json({ ok: false, error: 'Invalid base64 data.' })
      }
      buffers.push({ kind, fileName, contentType, buffer: buf })
    }
    const item = createCustomerKycSubmission({
      userId: req.customer.id,
      customerEmail: req.customer.email,
      customerDisplayName: req.customer.displayName,
      documents: buffers,
    })
    writeAudit({
      action: 'kyc.customer.submit',
      actorType: 'customer',
      actorId: req.customer.id,
      target: item.id,
      meta: { docCount: item.documents.length },
      ip: clientIp(req),
    })
    markCustomerOnboardingKycSubmitted(req.customer.id)
    void sendKycSubmissionNotifyEmail({
      submissionId: item.id,
      customerEmail: item.customerEmail,
      displayName: item.customerDisplayName,
    }).catch((err) => {
      console.warn('[kyc] notify email failed:', err)
    })
    res.status(201).json({ ok: true, item })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Could not save submission'
    if (status >= 500) console.error('[kyc] submit failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/banking/state', requireCustomer, (req, res) => {
  try {
    const banking = getUserBankingSnapshot(req.customer.id)
    if (!banking) {
      return res.status(404).json({ ok: false, error: 'No banking data.' })
    }
    const accessRestriction = getOnlineBankingRestriction(req.customer.id)
    res.json({ ok: true, banking, accessRestriction })
  } catch (e) {
    console.error('[banking] state failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load accounts.' })
  }
})

app.post('/api/banking/dismiss-replacement-banner', requireCustomer, (req, res) => {
  try {
    dismissReplacementBanner(req.customer.id)
    const banking = getUserBankingSnapshot(req.customer.id)
    res.json({ ok: true, banking })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    res.status(status).json({ ok: false, error: msg })
  }
})

app.post('/api/banking/cancel-scheduled-bill', requireCustomer, (req, res) => {
  try {
    if (respondIfOnlineBankingRestricted(req, res)) return
    const sid =
      typeof req.body?.scheduledPaymentId === 'string'
        ? req.body.scheduledPaymentId.trim()
        : ''
    if (!sid) {
      return res
        .status(400)
        .json({ ok: false, error: 'scheduledPaymentId is required.' })
    }
    const user = getInternalUser(req.customer.id)
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Customer not found.' })
    }
    let cfg
    try {
      cfg = loadBankConfig()
    } catch {
      return res
        .status(500)
        .json({ ok: false, error: 'Could not load bank configuration.' })
    }
    const feePayload = buildExecutionFees(cfg, 'cancel_scheduled_bill')
    const result = applyApprovalToBankingState(
      user.banking,
      'cancel_scheduled_bill',
      { scheduledPaymentId: sid },
      feePayload,
    )
    if (!result.ok) {
      const gone =
        typeof result.error === 'string' &&
        result.error.includes('already removed')
      return res
        .status(gone ? 404 : 400)
        .json({ ok: false, error: result.error })
    }
    saveUserBanking(req.customer.id, result.banking)
    writeAudit({
      action: 'banking.cancel_scheduled_bill',
      actorType: 'customer',
      actorId: req.customer.id,
      target: sid,
      ip: clientIp(req),
    })
    const banking = getUserBankingSnapshot(req.customer.id)
    res.json({ ok: true, banking })
  } catch (e) {
    console.error('[banking] cancel scheduled bill failed:', e)
    res
      .status(500)
      .json({ ok: false, error: 'Could not cancel scheduled payment.' })
  }
})

app.post('/api/approvals', requireCustomer, (req, res) => {
  try {
    if (respondIfOnlineBankingRestricted(req, res)) return
    if (req.body?.type === 'cancel_scheduled_bill') {
      return res.status(400).json({
        ok: false,
        error:
          'Scheduled payment cancellation is applied immediately from Pay & transfer — not via the approval queue.',
      })
    }
    const internal = getInternalUser(req.customer.id)
    if (internal?.transactionPinHash) {
      const pin =
        typeof req.body?.transactionPin === 'string'
          ? req.body.transactionPin.trim()
          : ''
      if (!verifyTransactionPin(req.customer.id, pin)) {
        return res.status(401).json({
          ok: false,
          error: 'Enter your 6-digit transaction PIN to submit this request.',
        })
      }
    }

    const approvalTypeEarly =
      typeof req.body?.type === 'string' ? req.body.type.trim() : ''
    if (approvalTypeEarly === 'wire_transfer') {
      if (!getSkipWireEmailOtp()) {
        const cfg = smtpFromEnv()
        if (!isMailReady(cfg)) {
          return res.status(503).json({
            ok: false,
            error:
              'Wire transfers require email verification, but outbound mail is not configured. Configure SMTP in Admin → Email delivery or MAIL_* in server/.env.',
          })
        }
        const wireOtpChallengeId =
          typeof req.body?.wireOtpChallengeId === 'string'
            ? req.body.wireOtpChallengeId.trim()
            : ''
        const wireOtpCode =
          typeof req.body?.wireOtpCode === 'string'
            ? req.body.wireOtpCode.trim()
            : ''
        if (!wireOtpChallengeId || !wireOtpCode) {
          return res.status(400).json({
            ok: false,
            error:
              'Enter the verification code emailed to you to authorize this wire transfer.',
          })
        }
        const consumed = consumeLoginChallenge(wireOtpChallengeId, wireOtpCode)
        if (!consumed.ok) {
          writeAudit({
            action: 'wire_transfer.otp_failed',
            actorType: 'customer',
            actorId: req.customer.id,
            target: wireOtpChallengeId,
            ip: clientIp(req),
            meta: { reason: consumed.reason },
          })
          const msg =
            consumed.reason === 'expired'
              ? 'That verification code has expired. Request a new code from the wire form.'
              : consumed.reason === 'locked'
                ? 'Too many incorrect attempts. Request a new verification code.'
                : 'Invalid verification code.'
          return res.status(401).json({ ok: false, error: msg })
        }
        if (consumed.userId !== req.customer.id) {
          return res.status(401).json({
            ok: false,
            error: 'Invalid verification code.',
          })
        }
      }
    }

    const wErr = assertWithdrawalPolicyOnSubmit(
      req.body?.type,
      req.body?.payload,
    )
    if (wErr) {
      return res.status(400).json({ ok: false, error: wErr })
    }
    const approvalType = approvalTypeEarly
    if (isIncomingDepositApprovalType(approvalType)) {
      let cfg
      try {
        cfg = loadBankConfig()
      } catch {
        return res.status(500).json({
          ok: false,
          error: 'Could not load bank configuration.',
        })
      }
      const gate = depositMethodNotAllowedError(approvalType, cfg)
      if (gate) {
        return res.status(400).json({ ok: false, error: gate })
      }
    }
    const item = createApproval({
      userId: req.customer.id,
      submitterId: req.customer.displayName,
      type: req.body?.type,
      title: req.body?.title,
      payload: req.body?.payload,
    })
    writeAudit({
      action: 'approval.submit',
      actorType: 'customer',
      actorId: req.customer.id,
      target: item.id,
      meta: { type: item.type },
      ip: clientIp(req),
    })
    if (isIncomingDepositApprovalType(item.type)) {
      const cfg = loadBankConfig()
      const manual =
        cfg.depositsAndFees?.manualDepositApprovalRequired !== false
      if (!manual) {
        const exec = executeApprovedApproval(item)
        if (!exec.ok) {
          return res.status(400).json({
            ok: false,
            error: exec.error,
            item,
          })
        }
        const finalized = finalizeApprovalApproved(
          item.id,
          'Auto-applied (manual deposit approval disabled in bank config).',
        )
        writeAudit({
          action: 'approval.auto_apply',
          actorType: 'system',
          actorId: 'bank-config',
          target: item.id,
          meta: { type: item.type, userId: item.userId },
          ip: clientIp(req),
        })
        return res.status(201).json({
          ok: true,
          item: finalized,
          depositAutoApplied: true,
        })
      }
    }
    if (item.type === 'internal_transfer') {
      const exec = executeApprovedApproval(item)
      if (!exec.ok) {
        return res.status(400).json({
          ok: false,
          error: exec.error,
          item,
        })
      }
      const finalized = finalizeApprovalApproved(
        item.id,
        'Posted immediately — transfer between your accounts.',
      )
      writeAudit({
        action: 'approval.auto_apply',
        actorType: 'system',
        actorId: 'internal-transfer',
        target: item.id,
        meta: { type: item.type, userId: item.userId },
        ip: clientIp(req),
      })
      return res.status(201).json({
        ok: true,
        item: finalized,
        bankingAutoApplied: true,
      })
    }
    if (item.type === 'debit_card_lock') {
      const exec = executeApprovedApproval(item)
      if (!exec.ok) {
        return res.status(400).json({
          ok: false,
          error: exec.error,
          item,
        })
      }
      const finalized = finalizeApprovalApproved(
        item.id,
        'Posted immediately — debit card lock updated.',
      )
      writeAudit({
        action: 'approval.auto_apply',
        actorType: 'system',
        actorId: 'debit-card-lock',
        target: item.id,
        meta: { type: item.type, userId: item.userId },
        ip: clientIp(req),
      })
      return res.status(201).json({
        ok: true,
        item: finalized,
        bankingAutoApplied: true,
      })
    }
    res.status(201).json({ ok: true, item })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Could not create request'
    if (status >= 500) console.error('[approvals] create failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/approvals/my', requireCustomer, (req, res) => {
  try {
    const items = listByUserId(req.customer.id, { limit: 100 })
    res.json({ ok: true, items })
  } catch (e) {
    console.error('[approvals] list my failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load requests.' })
  }
})

app.get('/api/support/tickets', requireCustomer, (req, res) => {
  try {
    const items = listSupportTicketsForUser(req.customer.id)
    res.json({ ok: true, items })
  } catch (e) {
    console.error('[support] list failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load tickets.' })
  }
})

app.post('/api/support/tickets', requireCustomer, (req, res) => {
  try {
    const item = createSupportTicket({
      userId: req.customer.id,
      customerEmail: req.customer.email,
      customerDisplayName: req.customer.displayName,
      subject: req.body?.subject,
      body: req.body?.body,
      linkedAccountIds: req.body?.linkedAccountIds,
    })
    writeAudit({
      action: 'support.ticket.create',
      actorType: 'customer',
      actorId: req.customer.id,
      target: item.id,
      meta: { subject: item.subject },
      ip: clientIp(req),
    })
    res.status(201).json({ ok: true, item })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Could not create ticket'
    if (status >= 500) console.error('[support] create failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/support/tickets/:id', requireCustomer, (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      return res.status(400).json({ ok: false, error: 'id is required.' })
    }
    const item = getSupportTicketForUser(id, req.customer.id)
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Ticket not found.' })
    }
    res.json({ ok: true, item })
  } catch (e) {
    console.error('[support] get failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load ticket.' })
  }
})

app.post('/api/support/tickets/:id/messages', requireCustomer, (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      return res.status(400).json({ ok: false, error: 'id is required.' })
    }
    const item = appendCustomerSupportMessage(id, req.customer.id, {
      body: req.body?.body,
    })
    writeAudit({
      action: 'support.ticket.customer_reply',
      actorType: 'customer',
      actorId: req.customer.id,
      target: id,
      ip: clientIp(req),
    })
    res.json({ ok: true, item })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Could not send message'
    if (status >= 500) console.error('[support] customer reply failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/admin/support/tickets', requireAdmin, (req, res) => {
  try {
    const q = req.query
    const items = listSupportTicketsAdmin({
      status: typeof q.status === 'string' ? q.status : undefined,
      assignedTo:
        typeof q.assignedTo === 'string' ? q.assignedTo : undefined,
      limit: q.limit != null ? Number(q.limit) : undefined,
    })
    res.json({ ok: true, items })
  } catch (e) {
    console.error('[admin] support list failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load tickets.' })
  }
})

app.get('/api/admin/support/tickets/:id', requireAdmin, (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      return res.status(400).json({ ok: false, error: 'id is required.' })
    }
    const item = getSupportTicket(id)
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Ticket not found.' })
    }
    res.json({ ok: true, item })
  } catch (e) {
    console.error('[admin] support get failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load ticket.' })
  }
})

app.patch('/api/admin/support/tickets/:id', requireAdmin, (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      return res.status(400).json({ ok: false, error: 'id is required.' })
    }
    const before = getSupportTicket(id)
    const item = patchSupportTicketAdmin(id, req.body ?? {})
    writeAudit({
      action: 'admin.support.ticket.patch',
      actorType: 'admin',
      actorId: 'bearer',
      target: id,
      meta: {
        userId: item.userId,
        priorStatus: before?.status,
        status: item.status,
        assignedTo: item.assignedTo,
      },
      ip: clientIp(req),
    })
    res.json({ ok: true, item })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[admin] support patch failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.post('/api/admin/support/tickets/:id/messages', requireAdmin, (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      return res.status(400).json({ ok: false, error: 'id is required.' })
    }
    const item = appendStaffSupportMessage(id, {
      body: req.body?.body,
      staffLabel: req.body?.staffLabel,
    })
    writeAudit({
      action: 'admin.support.ticket.reply',
      actorType: 'admin',
      actorId: 'bearer',
      target: id,
      meta: { userId: item.userId },
      ip: clientIp(req),
    })
    res.json({ ok: true, item })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Could not send reply'
    if (status >= 500) console.error('[admin] support reply failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/admin/approvals', requireAdmin, (req, res) => {
  try {
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined
    const limit = req.query.limit ? Number(req.query.limit) : undefined
    const items = listAll({ status, limit })
    res.json({ ok: true, items })
  } catch (e) {
    console.error('[approvals] admin list failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load approvals.' })
  }
})

app.get('/api/admin/withdrawals/queue', requireAdmin, (_req, res) => {
  try {
    const items = listAdminTransactionFeed({
      status: 'pending',
      engineKind: 'withdrawal',
      limit: 200,
    })
    res.json({ ok: true, items })
  } catch (e) {
    console.error('[admin] withdrawals queue failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load withdrawal queue.' })
  }
})

app.get('/api/admin/transactions', requireAdmin, (req, res) => {
  try {
    const q = req.query
    const items = listAdminTransactionFeed({
      status: typeof q.status === 'string' ? q.status : undefined,
      engineKind: typeof q.engineKind === 'string' ? q.engineKind : undefined,
      userId: typeof q.userId === 'string' ? q.userId : undefined,
      from: typeof q.from === 'string' ? q.from : undefined,
      to: typeof q.to === 'string' ? q.to : undefined,
      minAmount: q.minAmount != null ? Number(q.minAmount) : undefined,
      maxAmount: q.maxAmount != null ? Number(q.maxAmount) : undefined,
      limit: q.limit != null ? Number(q.limit) : undefined,
    })
    res.json({ ok: true, items })
  } catch (e) {
    console.error('[admin] transactions list failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load transactions.' })
  }
})

app.get('/api/admin/kyc', requireAdmin, (req, res) => {
  try {
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined
    const limit = req.query.limit ? Number(req.query.limit) : undefined
    const items = listKycSubmissions({ status, limit })
    res.json({ ok: true, items })
  } catch (e) {
    console.error('[admin] kyc list failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load KYC submissions.' })
  }
})

app.get(
  '/api/admin/kyc/:submissionId/documents/:docId/file',
  requireAdmin,
  (req, res) => {
    try {
      const submissionId =
        typeof req.params.submissionId === 'string'
          ? req.params.submissionId.trim()
          : ''
      const docId =
        typeof req.params.docId === 'string' ? req.params.docId.trim() : ''
      if (!submissionId || !docId) {
        return res.status(400).json({ ok: false, error: 'Invalid path.' })
      }
      const read = readKycDocumentFile(submissionId, docId)
      if (!read) {
        return res.status(404).json({ ok: false, error: 'File not found.' })
      }
      res.setHeader('Content-Type', read.contentType)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', 'inline')
      res.send(read.buffer)
    } catch (e) {
      console.error('[admin] kyc file failed:', e)
      res.status(500).json({ ok: false, error: 'Could not read document.' })
    }
  },
)

app.get('/api/admin/kyc/:id', requireAdmin, (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      return res.status(400).json({ ok: false, error: 'id is required.' })
    }
    const item = getKycSubmission(id)
    if (!item) {
      return res.status(404).json({ ok: false, error: 'KYC submission not found.' })
    }
    res.json({ ok: true, item })
  } catch (e) {
    console.error('[admin] kyc get failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load KYC submission.' })
  }
})

app.patch('/api/admin/kyc/:id', requireAdmin, (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      return res.status(400).json({ ok: false, error: 'id is required.' })
    }
    const before = getKycSubmission(id)
    const item = patchKycSubmission(id, req.body ?? {})
    const action =
      typeof req.body?.decision === 'string'
        ? req.body.decision.trim().toLowerCase()
        : ''
    if (action === 'approve' || action === 'reject') {
      writeAudit({
        action: action === 'approve' ? 'admin.kyc.approve' : 'admin.kyc.reject',
        actorType: 'admin',
        actorId: 'bearer',
        target: id,
        meta: {
          userId: item.userId,
          priorStatus: before?.status,
        },
        ip: clientIp(req),
      })
    } else {
      const b = req.body && typeof req.body === 'object' ? req.body : {}
      const touched = ['riskLevel', 'documentExpiresAt', 'complianceNotes'].some(
        (k) => Object.prototype.hasOwnProperty.call(b, k),
      )
      if (touched) {
        writeAudit({
          action: 'admin.kyc.update',
          actorType: 'admin',
          actorId: 'bearer',
          target: id,
          meta: { userId: item.userId },
          ip: clientIp(req),
        })
      }
    }
    res.json({ ok: true, item })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[admin] kyc patch failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/admin/approvals/:id', requireAdmin, (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      return res.status(400).json({ ok: false, error: 'id is required.' })
    }
    const item = getApprovalById(id)
    if (!item) {
      return res
        .status(404)
        .json({ ok: false, error: 'Approval request not found.' })
    }
    res.json({ ok: true, item })
  } catch (e) {
    console.error('[approvals] admin get one failed:', e)
    res.status(500).json({ ok: false, error: 'Could not load approval.' })
  }
})

app.patch('/api/admin/approvals/:id', requireAdmin, (req, res) => {
  try {
    const status = req.body?.status
    const note =
      typeof req.body?.note === 'string' ? req.body.note : undefined
    const id = req.params.id

    if (
      req.body &&
      typeof req.body.suspicious === 'boolean' &&
      status === undefined
    ) {
      const item = patchApprovalSuspicious(id, {
        suspicious: req.body.suspicious,
        suspiciousNote:
          typeof req.body.suspiciousNote === 'string'
            ? req.body.suspiciousNote
            : undefined,
      })
      writeAudit({
        action: req.body.suspicious
          ? 'admin.withdrawal.flag_suspicious'
          : 'admin.withdrawal.unflag_suspicious',
        actorType: 'admin',
        actorId: 'bearer',
        target: id,
        ip: clientIp(req),
      })
      return res.json({ ok: true, item })
    }

    if (status === 'rejected') {
      const item = updateApprovalStatus(id, { status: 'rejected', note })
      writeAudit({
        action: 'admin.approval.reject',
        actorType: 'admin',
        actorId: 'bearer',
        target: id,
        ip: clientIp(req),
      })
      return res.json({ ok: true, item })
    }

    if (status === 'approved') {
      const pending = getApprovalById(id)
      if (!pending) {
        return res.status(404).json({ ok: false, error: 'Approval request not found.' })
      }
      if (pending.status !== 'pending') {
        return res
          .status(409)
          .json({ ok: false, error: 'Only pending requests can be approved.' })
      }
      const cfg = loadBankConfig()
      const wd = cfg.withdrawals || {}
      const co = Number(pending.withdrawalCoApprovals || 0)
      if (
        withdrawalRequiresSecondOperator(
          pending.type,
          pending.payload,
          wd,
          co,
        )
      ) {
        const item = recordWithdrawalFirstOperatorApproval(id)
        writeAudit({
          action: 'admin.withdrawal.first_approval',
          actorType: 'admin',
          actorId: 'bearer',
          target: id,
          meta: {
            userId: pending.userId,
            type: pending.type,
            withdrawalCoApprovals: item.withdrawalCoApprovals,
          },
          ip: clientIp(req),
        })
        return res.json({
          ok: true,
          item,
          withdrawalApprovalStage: 'awaiting_second_operator',
        })
      }
      const exec = executeApprovedApproval(pending)
      if (!exec.ok) {
        return res.status(400).json({ ok: false, error: exec.error })
      }
      const item = finalizeApprovalApproved(id, note)
      writeAudit({
        action: 'admin.approval.approve',
        actorType: 'admin',
        actorId: 'bearer',
        target: id,
        meta: { userId: pending.userId, type: pending.type },
        ip: clientIp(req),
      })
      return res.json({ ok: true, item })
    }

    return res.status(400).json({ ok: false, error: 'status must be approved or rejected.' })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Update failed'
    if (status >= 500) console.error('[approvals] admin patch failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.post('/api/admin/approvals/:id/reverse', requireAdmin, (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      return res.status(400).json({ ok: false, error: 'id is required.' })
    }
    const pending = getApprovalById(id)
    if (!pending) {
      return res.status(404).json({ ok: false, error: 'Approval request not found.' })
    }
    if (pending.status !== 'approved' || !pending.appliedAt) {
      return res.status(409).json({
        ok: false,
        error: 'Only applied approvals can be reversed.',
      })
    }
    if (pending.reversedAt) {
      return res
        .status(409)
        .json({ ok: false, error: 'This transaction was already reversed.' })
    }
    const exec = executeReverseApprovedApproval(pending)
    if (!exec.ok) {
      return res.status(400).json({ ok: false, error: exec.error })
    }
    const item = markApprovalReversed(id)
    writeAudit({
      action: 'admin.approval.reverse',
      actorType: 'admin',
      actorId: 'bearer',
      target: id,
      meta: { userId: pending.userId, type: pending.type },
      ip: clientIp(req),
    })
    res.json({ ok: true, item })
  } catch (e) {
    const status = e.statusCode || 500
    const msg = e instanceof Error ? e.message : 'Reverse failed'
    if (status >= 500) console.error('[approvals] admin reverse failed:', e)
    res.status(status).json({ ok: false, error: msg })
  }
})

app.get('/api/notify/health', (_req, res) => {
  const cfg = smtpFromEnv()
  const ready = isMailReady(cfg)
  const parsed =
    ready && cfg.from ? parseMailFrom(cfg.from) : { name: '', email: '' }
  res.json({
    ok: true,
    mail: {
      ready,
      fromPreview: ready ? fromPreview(cfg.from) : null,
      senderName: ready && parsed.name ? parsed.name : null,
      hint: ready
        ? null
        : 'Copy server/.env.example to server/.env and set MAIL_SMTP_HOST plus MAIL_FROM. Add MAIL_SMTP_USER and MAIL_SMTP_PASS when your provider requires authentication.',
    },
  })
})

app.post('/api/notify/test', async (req, res) => {
  const cfg = smtpFromEnv()
  if (!isMailReady(cfg)) {
    return res.status(503).json({
      ok: false,
      error:
        'Mail is not configured on the server. Add MAIL_* variables in server/.env.',
    })
  }

  const to = typeof req.body?.to === 'string' ? req.body.to.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res
      .status(400)
      .json({ ok: false, error: 'Enter a valid email address.' })
  }

  const displayName =
    typeof req.body?.displayName === 'string'
      ? req.body.displayName.trim().slice(0, 80)
      : ''

  try {
    await sendNotifyTestLetter({ to, displayName })
    res.json({ ok: true, message: 'Test email sent.' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Send failed'
    console.error('[notify] test send failed:', msg)
    res.status(500).json({ ok: false, error: msg })
  }
})

app.post('/api/notify/send', async (req, res) => {
  const cfg = smtpFromEnv()
  if (!isMailReady(cfg)) {
    return res.status(503).json({ ok: false, error: 'Mail is not configured.' })
  }

  const to = typeof req.body?.to === 'string' ? req.body.to.trim() : ''
  const subject =
    typeof req.body?.subject === 'string'
      ? req.body.subject.trim().slice(0, 200)
      : ''
  const text =
    typeof req.body?.text === 'string'
      ? req.body.text.trim().slice(0, 20_000)
      : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ ok: false, error: 'Invalid to address.' })
  }
  if (!subject || !text) {
    return res
      .status(400)
      .json({ ok: false, error: 'Subject and text are required.' })
  }

  try {
    const transporter = createTransport(cfg)
    await transporter.sendMail({
      from: effectiveMailFromEnvelope(cfg.from),
      to,
      subject,
      text,
    })
    res.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Send failed'
    console.error('[notify] send failed:', msg)
    res.status(500).json({ ok: false, error: msg })
  }
})

const distDir = path.join(__dirname, '..', 'dist')
const indexHtml = path.join(distDir, 'index.html')
const shouldServeClient =
  isProdRuntime &&
  process.env.BYWELLS_SERVE_STATIC !== '0' &&
  fs.existsSync(indexHtml)

if (shouldServeClient) {
  app.use(express.static(distDir, { index: false }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    if (req.path.startsWith('/api')) {
      next()
      return
    }
    res.sendFile(indexHtml, (err) => {
      if (err) next(err)
    })
  })
  console.log(
    '[bywells] Serving built SPA from dist/ (same origin as /api — set VITE_API_BASE only if UI is hosted elsewhere).',
  )
} else if (isProdRuntime) {
  console.warn(
    '[bywells] Production: dist/index.html not found — this process only serves /api. Run npm run build here or deploy static assets separately. Set BYWELLS_SERVE_STATIC=0 to silence.',
  )
}

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      ok: false,
      error:
        'No matching API route for this method and path. If you recently changed or deployed the server, restart the Node process so new routes (for example PATCH /api/admin/customers/:userId/access) are loaded.',
    })
  }
  res.status(404).type('text/plain').send('Not found')
})

async function start() {
  const pool = getPool()
  setAuditPgPool(pool)
  if (pool) {
    try {
      await initPgSchema()
    } catch (e) {
      console.error(
        '[bywells] PostgreSQL init failed:',
        e instanceof Error ? e.message : e,
      )
    }
  } else {
    console.log(
      '[bywells] DATABASE_URL not set — audit events append to server/data/audit.log only',
    )
  }

  const listenHost =
    process.env.BYWELLS_LISTEN_HOST?.trim() ||
    (isProdRuntime ? '0.0.0.0' : undefined)

  if (isProdRuntime) {
    if (!process.env.NOTIFY_ALLOWED_ORIGINS?.trim()) {
      console.warn(
        '[bywells] NOTIFY_ALLOWED_ORIGINS is empty — set it to your live https:// origins so browsers can call this API.',
      )
    }
    const adminSecret = process.env.ADMIN_API_SECRET?.trim()
    if (adminSecret && adminSecret.length < 24) {
      console.warn(
        '[bywells] ADMIN_API_SECRET is short — use a long random value (32+ chars) in production.',
      )
    }
  }

  const onListen = () => {
    const adminOn = Boolean(process.env.ADMIN_API_SECRET?.trim())
    const bind = listenHost ?? '(default)'
    console.log(`[bywells] Listening on ${bind}:${PORT}`)
    console.log(`[bywells] Health check: /api/health`)
    console.log(
      '[bywells] Customer accounts & banking: server/data/users-store.json',
    )
    console.log(
      adminOn
        ? '[bywells] Admin console: enabled (ADMIN_API_SECRET set)'
        : '[bywells] Admin console: disabled until ADMIN_API_SECRET is set',
    )
    if (shouldServeClient) {
      console.log('[bywells] Open the app at http://127.0.0.1:' + PORT + '/')
    }
  }

  const httpServer = listenHost
    ? app.listen(PORT, listenHost, onListen)
    : app.listen(PORT, onListen)
  httpServer.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(
        `[bywells] Port ${PORT} is already in use (another app or a stuck Bywells process). Set NOTIFY_PORT to a free port in server/.env and restart.`,
      )
    } else {
      console.error('[bywells] HTTP server error:', err)
    }
    process.exit(1)
  })
}

start()
