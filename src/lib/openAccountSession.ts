/** Set after register until KYC is submitted or user signs out (digital onboarding). */
export const OPEN_ACCOUNT_KYC_PENDING_KEY = 'online_bank_open_account_kyc_pending'

/** Product-interest slugs chosen during signup (survives refresh until KYC completes). */
const OPEN_ACCOUNT_INTERESTS_KEY = 'online_bank_open_account_interests'

export function setOpenAccountKycPending() {
  try {
    sessionStorage.setItem(OPEN_ACCOUNT_KYC_PENDING_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function setOpenAccountInterestSelections(slugs: string[]) {
  try {
    sessionStorage.setItem(OPEN_ACCOUNT_INTERESTS_KEY, JSON.stringify(slugs))
  } catch {
    /* ignore */
  }
}

export function getOpenAccountInterestSelections(): string[] {
  try {
    const raw = sessionStorage.getItem(OPEN_ACCOUNT_INTERESTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((x) => String(x).trim()).filter(Boolean)
  } catch {
    return []
  }
}

export function clearOpenAccountKycPending() {
  try {
    sessionStorage.removeItem(OPEN_ACCOUNT_KYC_PENDING_KEY)
    sessionStorage.removeItem(OPEN_ACCOUNT_INTERESTS_KEY)
  } catch {
    /* ignore */
  }
}

export function hasOpenAccountKycPending(): boolean {
  try {
    return sessionStorage.getItem(OPEN_ACCOUNT_KYC_PENDING_KEY) === '1'
  } catch {
    return false
  }
}
