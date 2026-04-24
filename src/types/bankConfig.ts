export type BankProducts = {
  checkingName: string
  checkingMask: string
  savingsName: string
  savingsMask: string
  fundTotalMarket: string
  fundInternational: string
  fundCoreBond: string
  fundCashSweep: string
}

export type BankTheme = {
  navy950: string
  navy900: string
  navy800: string
  blue600: string
  blue500: string
  sky100: string
  red800: string
  red700: string
  red600: string
  sand100: string
  sand200: string
  muted: string
}

export type BankFees = {
  wireDomesticCents: number
  wireInternationalCents: number
  /** Optional regulatory-style wire surcharge (COT), cents. */
  wireCotCents?: number
  /** Optional regulatory-style wire surcharge (IMF), cents. */
  wireImfCents?: number
  /** Reference FX rate for display / FX approvals (USD per 1 EUR). */
  fxUsdPerEur?: number
}

/** How scheduled transaction fees are taken from the fee table vs. operator discretion. */
export type BankFeeScheduleMode = 'auto' | 'manual'

/** Incoming money, deposit rails, and non-wire fee knobs for the operator console. */
export type BankDepositsAndFees = {
  /**
   * When true, mobile check deposits stay pending until an operator approves.
   * When false, qualifying mobile deposits credit immediately (demo policy).
   */
  manualDepositApprovalRequired: boolean
  /** Auto: use the fee amounts below for incoming deposit flows. Manual: operators decide per case. */
  transactionFeesMode: BankFeeScheduleMode
  /** Auto: maintenance fee amount is applied per policy (demo: amount stored for disclosure). Manual: posted case-by-case. */
  maintenanceFeesMode: BankFeeScheduleMode
  /** Monthly maintenance charge (cents) when maintenance mode is auto (disclosure / future automation). */
  maintenanceFeeMonthlyCents: number
  /** Incoming bank transfer / check deposit service fee in cents (auto transaction fees only). */
  incomingBankTransferFeeCents: number
  /** Card funding / push-to-card fee in cents when transaction fees are auto. */
  cardFundingFeeCents: number
  /** Crypto on-ramp fee in cents when transaction fees are auto. */
  cryptoDepositFeeCents: number
  depositMethods: {
    bankTransfer: boolean
    crypto: boolean
    cardFunding: boolean
  }
}

/** Bank-branded transactional email bodies (HTML fragments + plain text). */
export type BankEmailLetters = {
  otpSubjectTemplate: string
  /** Inner HTML placed inside the official letter wrapper (not a full document). */
  otpInnerHtml: string
  otpTextBody: string
  emailChangeSubjectTemplate: string
  emailChangeInnerHtml: string
  emailChangeTextBody: string
  kycNotifySubjectTemplate: string
  kycNotifyInnerHtml: string
  kycNotifyTextBody: string
  testSubjectTemplate: string
  testInnerHtml: string
  testTextBody: string
  wireTransferOtpSubjectTemplate: string
  wireTransferOtpInnerHtml: string
  wireTransferOtpTextBody: string
}

/** Institution rules for outbound / scheduled withdrawal queue items. */
export type BankWithdrawalsPolicy = {
  /** When true, amounts ≥ secondStepThresholdCents require two operator approvals before execution. */
  multiStepEnabled: boolean
  /** USD cents; second operator must approve when multi-step is on and amount ≥ this. */
  secondStepThresholdCents: number
  /** Hard cap per request (cents); null = no cap (beyond product validation). */
  maxSingleWithdrawalCents: number | null
  /** Reserved for daily aggregation; null = not enforced in engine yet. */
  maxDailyWithdrawalPerCustomerCents: number | null
}

export type BankConfig = {
  bankName: string
  bankNameShort: string
  taglineHeader: string
  homeEyebrow: string
  homeHeadline: string
  homeSubtext: string
  /**
   * Public home hero image: site-root path (e.g. `/home-hero-banking.svg` in `public/`)
   * or API-served upload (e.g. `/api/media/home-hero.png`) or `https://…` CDN URL.
   * On Netlify + separate API, set `VITE_API_BASE` at build time so `/api/media/…` resolves.
   */
  homeHeroImageSrc: string
  /**
   * Custom logo in headers, card art, and admin shell. Empty string = built-in mark.
   * Same path rules as `homeHeroImageSrc` (e.g. `/api/media/bank-logo.png`).
   */
  bankLogoSrc: string
  homeCtaTalk: string
  signInDisclaimer: string
  supportPhone: string
  supportPhoneFraud: string
  supportEmail: string
  supportHoursLine: string
  chatAgentName: string
  chatHeaderTitle: string
  chatHeaderSubtitle: string
  investBrandName: string
  products: BankProducts
  fees: BankFees
  depositsAndFees: BankDepositsAndFees
  withdrawals: BankWithdrawalsPolicy
  theme: BankTheme
  emailLetters: BankEmailLetters
  legalDemoFooter: string
  legalCopyright: string
  mobileDepositEndorsement: string
  wireAuthLine: string
  wireDisclaimerFees: string
}
