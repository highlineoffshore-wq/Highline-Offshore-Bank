import { loadBankConfig } from './bankConfigStore.js'

const FALLBACK_SUPPORT_EMAIL = 'support@example.com'

export function supportEmailForOnlineBankingLockout() {
  try {
    const e = loadBankConfig()?.supportEmail
    return typeof e === 'string' && e.trim() ? e.trim() : FALLBACK_SUPPORT_EMAIL
  } catch {
    return FALLBACK_SUPPORT_EMAIL
  }
}

/**
 * @param {import('express').Response} res
 * @param {{ onlineBankingRestrictionReason?: string | null }} userLike internal or store user row
 */
export function sendOnlineBankingRestrictedForbidden(res, userLike) {
  const supportEmail = supportEmailForOnlineBankingLockout()
  const custom =
    typeof userLike?.onlineBankingRestrictionReason === 'string' &&
    userLike.onlineBankingRestrictionReason.trim()
      ? userLike.onlineBankingRestrictionReason.trim()
      : ''
  const tail = `You cannot use online banking due to suspicions of fraudulent activity. Contact us by email: ${supportEmail}.`
  const error = custom ? `${custom} ${tail}` : tail
  res.status(403).json({
    ok: false,
    code: 'ONLINE_BANKING_RESTRICTED',
    supportEmail,
    error,
  })
}
