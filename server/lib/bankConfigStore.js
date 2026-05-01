import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULTS_PATH = path.join(__dirname, '../../src/data/bank.defaults.json')
const DATA_PATH = path.join(__dirname, '../data/bank-config.json')

function readDefaults() {
  const raw = fs.readFileSync(DEFAULTS_PATH, 'utf8')
  return JSON.parse(raw)
}

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function mergeDeep(base, patch) {
  if (!isPlainObject(base)) return patch
  if (!isPlainObject(patch)) return base
  const out = { ...base }
  for (const k of Object.keys(patch)) {
    const pv = patch[k]
    const bv = base[k]
    if (isPlainObject(pv) && isPlainObject(bv)) {
      out[k] = mergeDeep(bv, pv)
    } else {
      out[k] = pv
    }
  }
  return out
}

const HEX = /^#[0-9A-Fa-f]{6}$/

function validateBankConfig(c) {
  const err = (m) => {
    const e = new Error(m)
    e.statusCode = 400
    throw e
  }
  const reqStr = (v, max, label) => {
    if (typeof v !== 'string' || !v.trim()) err(`${label} is required.`)
    if (v.length > max) err(`${label} is too long (max ${max}).`)
    return v.trim()
  }
  reqStr(c.bankName, 120, 'bankName')
  reqStr(c.bankNameShort, 40, 'bankNameShort')
  reqStr(c.taglineHeader, 200, 'taglineHeader')
  reqStr(c.homeEyebrow, 120, 'homeEyebrow')
  reqStr(c.homeHeadline, 300, 'homeHeadline')
  reqStr(c.homeSubtext, 800, 'homeSubtext')
  const heroSrc = typeof c.homeHeroImageSrc === 'string' ? c.homeHeroImageSrc.trim() : ''
  if (!heroSrc) err('homeHeroImageSrc is required.')
  if (heroSrc.length > 500) err('homeHeroImageSrc is too long (max 500).')
  if (!/^https?:\/\//i.test(heroSrc) && !heroSrc.startsWith('/')) {
    err('homeHeroImageSrc must start with / (site path) or http(s)://.')
  }
  if (/[<>"'`\s\\]/.test(heroSrc)) err('homeHeroImageSrc contains invalid characters.')
  c.homeHeroImageSrc = heroSrc
  const logoSrc =
    typeof c.bankLogoSrc === 'string' ? String(c.bankLogoSrc).trim() : ''
  if (logoSrc) {
    if (logoSrc.length > 500) err('bankLogoSrc is too long (max 500).')
    if (!/^https?:\/\//i.test(logoSrc) && !logoSrc.startsWith('/')) {
      err('bankLogoSrc must start with / (site path) or http(s)://.')
    }
    if (/[<>"'`\s\\]/.test(logoSrc))
      err('bankLogoSrc contains invalid characters.')
  }
  c.bankLogoSrc = logoSrc
  reqStr(c.homeCtaTalk, 80, 'homeCtaTalk')
  reqStr(c.signInDisclaimer, 600, 'signInDisclaimer')
  reqStr(c.supportPhone, 40, 'supportPhone')
  reqStr(c.supportPhoneFraud, 40, 'supportPhoneFraud')
  reqStr(c.supportEmail, 120, 'supportEmail')
  reqStr(c.supportHoursLine, 200, 'supportHoursLine')
  reqStr(c.chatAgentName, 60, 'chatAgentName')
  reqStr(c.chatHeaderTitle, 80, 'chatHeaderTitle')
  reqStr(c.chatHeaderSubtitle, 80, 'chatHeaderSubtitle')
  reqStr(c.investBrandName, 80, 'investBrandName')
  reqStr(c.legalDemoFooter, 600, 'legalDemoFooter')
  reqStr(c.legalCopyright, 200, 'legalCopyright')
  reqStr(c.mobileDepositEndorsement, 200, 'mobileDepositEndorsement')
  reqStr(c.wireAuthLine, 400, 'wireAuthLine')
  reqStr(c.wireDisclaimerFees, 400, 'wireDisclaimerFees')

  if (!c.emailLetters || typeof c.emailLetters !== 'object') {
    err('emailLetters object required.')
  }
  const el = c.emailLetters
  const elSubj = (v, key) => {
    if (typeof v !== 'string' || !v.trim()) err(`${key} is required.`)
    if (v.length > 200) err(`${key} is too long (max 200).`)
    return v.trim()
  }
  const elHtml = (v, key) => {
    if (typeof v !== 'string' || !v.trim()) err(`${key} is required.`)
    if (v.length > 120_000) err(`${key} is too long (max 120000).`)
    return v
  }
  const elText = (v, key) => {
    if (typeof v !== 'string' || !v.trim()) err(`${key} is required.`)
    if (v.length > 16_000) err(`${key} is too long (max 16000).`)
    return v
  }
  el.otpSubjectTemplate = elSubj(el.otpSubjectTemplate, 'emailLetters.otpSubjectTemplate')
  el.otpInnerHtml = elHtml(el.otpInnerHtml, 'emailLetters.otpInnerHtml')
  el.otpTextBody = elText(el.otpTextBody, 'emailLetters.otpTextBody')
  el.emailChangeSubjectTemplate = elSubj(
    el.emailChangeSubjectTemplate,
    'emailLetters.emailChangeSubjectTemplate',
  )
  el.emailChangeInnerHtml = elHtml(
    el.emailChangeInnerHtml,
    'emailLetters.emailChangeInnerHtml',
  )
  el.emailChangeTextBody = elText(
    el.emailChangeTextBody,
    'emailLetters.emailChangeTextBody',
  )
  el.kycNotifySubjectTemplate = elSubj(
    el.kycNotifySubjectTemplate,
    'emailLetters.kycNotifySubjectTemplate',
  )
  el.kycNotifyInnerHtml = elHtml(
    el.kycNotifyInnerHtml,
    'emailLetters.kycNotifyInnerHtml',
  )
  el.kycNotifyTextBody = elText(
    el.kycNotifyTextBody,
    'emailLetters.kycNotifyTextBody',
  )
  el.testSubjectTemplate = elSubj(
    el.testSubjectTemplate,
    'emailLetters.testSubjectTemplate',
  )
  el.testInnerHtml = elHtml(el.testInnerHtml, 'emailLetters.testInnerHtml')
  el.testTextBody = elText(el.testTextBody, 'emailLetters.testTextBody')
  el.wireTransferOtpSubjectTemplate = elSubj(
    el.wireTransferOtpSubjectTemplate,
    'emailLetters.wireTransferOtpSubjectTemplate',
  )
  el.wireTransferOtpInnerHtml = elHtml(
    el.wireTransferOtpInnerHtml,
    'emailLetters.wireTransferOtpInnerHtml',
  )
  el.wireTransferOtpTextBody = elText(
    el.wireTransferOtpTextBody,
    'emailLetters.wireTransferOtpTextBody',
  )

  if (!c.products || typeof c.products !== 'object') err('products object required.')
  for (const k of [
    'checkingName',
    'checkingMask',
    'savingsName',
    'savingsMask',
    'fundTotalMarket',
    'fundInternational',
    'fundCoreBond',
    'fundCashSweep',
  ]) {
    reqStr(c.products[k], 120, `products.${k}`)
  }

  if (!c.fees || typeof c.fees !== 'object') err('fees object required.')
  const wd = Number(c.fees.wireDomesticCents)
  const wi = Number(c.fees.wireInternationalCents)
  if (!Number.isFinite(wd) || wd < 0 || wd > 1_000_000_00)
    err('fees.wireDomesticCents must be a non-negative number.')
  if (!Number.isFinite(wi) || wi < 0 || wi > 1_000_000_00)
    err('fees.wireInternationalCents must be a non-negative number.')
  c.fees.wireDomesticCents = Math.round(wd)
  c.fees.wireInternationalCents = Math.round(wi)

  const cot = Number(c.fees.wireCotCents ?? 0)
  const imf = Number(c.fees.wireImfCents ?? 0)
  const fx = Number(c.fees.fxUsdPerEur ?? 0)
  if (!Number.isFinite(cot) || cot < 0 || cot > 1_000_000_00)
    err('fees.wireCotCents must be a non-negative number.')
  if (!Number.isFinite(imf) || imf < 0 || imf > 1_000_000_00)
    err('fees.wireImfCents must be a non-negative number.')
  if (!Number.isFinite(fx) || fx < 0 || fx > 1_000)
    err('fees.fxUsdPerEur must be a non-negative number (USD per EUR).')
  c.fees.wireCotCents = Math.round(cot)
  c.fees.wireImfCents = Math.round(imf)
  c.fees.fxUsdPerEur = fx

  if (!c.depositsAndFees || typeof c.depositsAndFees !== 'object') {
    err('depositsAndFees object required.')
  }
  const df = c.depositsAndFees
  df.manualDepositApprovalRequired = Boolean(df.manualDepositApprovalRequired)
  const tfm = String(df.transactionFeesMode || 'auto').toLowerCase()
  if (tfm !== 'auto' && tfm !== 'manual') {
    err('depositsAndFees.transactionFeesMode must be auto or manual.')
  }
  df.transactionFeesMode = tfm
  const mfm = String(df.maintenanceFeesMode || 'manual').toLowerCase()
  if (mfm !== 'auto' && mfm !== 'manual') {
    err('depositsAndFees.maintenanceFeesMode must be auto or manual.')
  }
  df.maintenanceFeesMode = mfm
  const mMaint = Number(df.maintenanceFeeMonthlyCents ?? 0)
  if (!Number.isFinite(mMaint) || mMaint < 0 || mMaint > 1_000_000_00) {
    err('depositsAndFees.maintenanceFeeMonthlyCents must be a non-negative number.')
  }
  df.maintenanceFeeMonthlyCents = Math.round(mMaint)
  const ibt = Number(df.incomingBankTransferFeeCents ?? 0)
  const cff = Number(df.cardFundingFeeCents ?? 0)
  const cdf = Number(df.cryptoDepositFeeCents ?? 0)
  if (!Number.isFinite(ibt) || ibt < 0 || ibt > 1_000_000_00) {
    err('depositsAndFees.incomingBankTransferFeeCents must be a non-negative number.')
  }
  if (!Number.isFinite(cff) || cff < 0 || cff > 1_000_000_00) {
    err('depositsAndFees.cardFundingFeeCents must be a non-negative number.')
  }
  if (!Number.isFinite(cdf) || cdf < 0 || cdf > 1_000_000_00) {
    err('depositsAndFees.cryptoDepositFeeCents must be a non-negative number.')
  }
  df.incomingBankTransferFeeCents = Math.round(ibt)
  df.cardFundingFeeCents = Math.round(cff)
  df.cryptoDepositFeeCents = Math.round(cdf)
  if (!df.depositMethods || typeof df.depositMethods !== 'object') {
    err('depositsAndFees.depositMethods object required.')
  }
  df.depositMethods.bankTransfer = Boolean(df.depositMethods.bankTransfer)
  df.depositMethods.crypto = Boolean(df.depositMethods.crypto)
  df.depositMethods.cardFunding = Boolean(df.depositMethods.cardFunding)

  if (!c.theme || typeof c.theme !== 'object') err('theme object required.')
  for (const k of [
    'navy950',
    'navy900',
    'navy800',
    'blue600',
    'blue500',
    'blue700',
    'blue800',
    'sky100',
    'red800',
    'red700',
    'red600',
    'sand100',
    'sand200',
    'muted',
  ]) {
    const v = c.theme[k]
    if (typeof v !== 'string' || !HEX.test(v))
      err(`theme.${k} must be a #RRGGBB hex color.`)
  }

  if (!c.withdrawals || typeof c.withdrawals !== 'object')
    err('withdrawals object required.')
  const w = c.withdrawals
  w.multiStepEnabled = Boolean(w.multiStepEnabled)
  const thr = Number(w.secondStepThresholdCents)
  if (!Number.isFinite(thr) || thr < 0 || thr > 100_000_000_00)
    err('withdrawals.secondStepThresholdCents must be a non-negative number.')
  w.secondStepThresholdCents = Math.round(thr)
  const mx = w.maxSingleWithdrawalCents
  if (mx != null && mx !== '') {
    const n = Number(mx)
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000_00)
      err('withdrawals.maxSingleWithdrawalCents invalid.')
    w.maxSingleWithdrawalCents = Math.round(n)
  } else {
    w.maxSingleWithdrawalCents = null
  }
  const md = w.maxDailyWithdrawalPerCustomerCents
  if (md != null && md !== '') {
    const n = Number(md)
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000_00)
      err('withdrawals.maxDailyWithdrawalPerCustomerCents invalid.')
    w.maxDailyWithdrawalPerCustomerCents = Math.round(n)
  } else {
    w.maxDailyWithdrawalPerCustomerCents = null
  }
}

/**
 * Deep-merge `bank.defaults.json` with a partial (e.g. current admin form draft) for preview/validation.
 * @param {unknown} partial
 */
export function mergeConfigWithDefaults(partial) {
  const defaults = readDefaults()
  if (!partial || typeof partial !== 'object') {
    return structuredClone(defaults)
  }
  return mergeDeep(defaults, /** @type {object} */ (partial))
}

export function loadBankConfig() {
  let defaults
  try {
    defaults = readDefaults()
  } catch (e) {
    console.error('[bank-config] could not read defaults JSON:', e)
    throw e
  }
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true })
      fs.writeFileSync(DATA_PATH, JSON.stringify(defaults, null, 2), 'utf8')
      return structuredClone(defaults)
    }
    const raw = fs.readFileSync(DATA_PATH, 'utf8')
    const fromFile = JSON.parse(raw)
    return mergeDeep(defaults, fromFile)
  } catch (e) {
    console.error('[bank-config] load failed, using defaults only:', e)
    return structuredClone(defaults)
  }
}

export function saveBankConfigFromBody(body) {
  const defaults = readDefaults()
  const merged = mergeDeep(defaults, body && typeof body === 'object' ? body : {})
  validateBankConfig(merged)
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true })
  fs.writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2), 'utf8')
  return merged
}
