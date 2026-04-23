/**
 * Pure banking mutations for server-side approval execution.
 * Mirrors src/contexts/AccountsContext.tsx logic.
 */

function formatCurrency(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function todayLabel() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date())
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function cloneBanking(banking) {
  return JSON.parse(JSON.stringify(banking))
}

function ensureProductArrays(state) {
  if (!Array.isArray(state.loanApplications)) state.loanApplications = []
  if (!Array.isArray(state.fixedDeposits)) state.fixedDeposits = []
  if (!Array.isArray(state.dpsPlans)) state.dpsPlans = []
  if (!Array.isArray(state.fxHoldings)) state.fxHoldings = []
}

/**
 * @param {string} type
 * @returns {{
 *   grossAmountError: string
 *   feeCapError: (svc: number) => string
 *   creditDesc: (to: { name: string; mask: string }) => string
 *   feeDesc: string
 *   revCreditDesc: (to: { name: string; mask: string }) => string
 *   revFeeDesc: string
 * } | null}
 */
function incomingDepositRailCopy(type) {
  switch (type) {
    case 'mobile_deposit':
      return {
        grossAmountError: 'Enter the check amount.',
        feeCapError: (svc) =>
          `Deposit must exceed the incoming transfer fee (${formatCurrency(svc)}).`,
        creditDesc: (to) => `Mobile deposit — ${to.name} ···${to.mask}`,
        feeDesc: 'Incoming deposit service fee',
        revCreditDesc: (to) =>
          `Reversal — mobile deposit (${to.name} ···${to.mask})`,
        revFeeDesc: 'Reversal — incoming deposit service fee credit',
      }
    case 'card_funding_deposit':
      return {
        grossAmountError: 'Enter the funding amount.',
        feeCapError: (svc) =>
          `Deposit must exceed the card funding fee (${formatCurrency(svc)}).`,
        creditDesc: (to) => `Card funding deposit — ${to.name} ···${to.mask}`,
        feeDesc: 'Card funding service fee',
        revCreditDesc: (to) =>
          `Reversal — card funding deposit (${to.name} ···${to.mask})`,
        revFeeDesc: 'Reversal — card funding service fee credit',
      }
    case 'crypto_deposit':
      return {
        grossAmountError: 'Enter the on-ramp amount.',
        feeCapError: (svc) =>
          `Deposit must exceed the crypto on-ramp fee (${formatCurrency(svc)}).`,
        creditDesc: (to) => `Crypto on-ramp — ${to.name} ···${to.mask}`,
        feeDesc: 'Crypto on-ramp service fee',
        revCreditDesc: (to) =>
          `Reversal — crypto on-ramp (${to.name} ···${to.mask})`,
        revFeeDesc: 'Reversal — crypto on-ramp service fee credit',
      }
    default:
      return null
  }
}

/**
 * @param {object[]} accounts
 * @param {(row: object) => void} pushActivity
 * @param {Record<string, unknown>} p
 * @param {{ incomingDepositFeeCents?: number }} fees
 * @param {string} type
 */
function applyIncomingDepositRail(accounts, pushActivity, p, fees, type) {
  const copy = incomingDepositRailCopy(type)
  if (!copy) return { ok: false, error: 'Unknown incoming deposit type.' }
  const toId = String(p.toId)
  const amountCents = Number(p.amountCents)
  if (!toId) return { ok: false, error: 'Select an account.' }
  if (amountCents <= 0)
    return { ok: false, error: copy.grossAmountError }
  const to = accounts.find((a) => a.id === toId)
  if (!to) return { ok: false, error: 'Account not found.' }
  const svc = Math.min(
    Math.max(0, Math.round(Number(fees.incomingDepositFeeCents) || 0)),
    Math.max(0, amountCents - 1),
  )
  const net = amountCents - svc
  if (net <= 0) {
    return { ok: false, error: copy.feeCapError(svc) }
  }
  to.balanceCents += net
  pushActivity({
    id: uid(),
    dateLabel: todayLabel(),
    description: copy.creditDesc(to),
    amountCents: net,
  })
  if (svc > 0) {
    pushActivity({
      id: uid(),
      dateLabel: todayLabel(),
      description: copy.feeDesc,
      amountCents: -svc,
    })
  }
  return { ok: true }
}

/**
 * @param {object[]} accounts
 * @param {(row: object) => void} pushActivity
 * @param {Record<string, unknown>} p
 * @param {{ incomingDepositFeeCents?: number }} fees
 * @param {string} type
 */
function reverseIncomingDepositRail(accounts, pushActivity, p, fees, type) {
  const copy = incomingDepositRailCopy(type)
  if (!copy) return { ok: false, error: 'Unknown incoming deposit type.' }
  const toId = String(p.toId)
  const amountCents = Number(p.amountCents)
  if (!toId || amountCents <= 0)
    return { ok: false, error: 'Invalid deposit payload for reversal.' }
  const to = accounts.find((a) => a.id === toId)
  if (!to) return { ok: false, error: 'Account not found.' }
  const svc = Math.min(
    Math.max(0, Math.round(Number(fees.incomingDepositFeeCents) || 0)),
    Math.max(0, amountCents - 1),
  )
  const net = amountCents - svc
  if (to.balanceCents < net)
    return {
      ok: false,
      error:
        'Cannot reverse deposit: current balance is lower than the credited amount.',
    }
  to.balanceCents -= net
  pushActivity({
    id: uid(),
    dateLabel: todayLabel(),
    description: copy.revCreditDesc(to),
    amountCents: -net,
  })
  if (svc > 0) {
    pushActivity({
      id: uid(),
      dateLabel: todayLabel(),
      description: copy.revFeeDesc,
      amountCents: svc,
    })
  }
  return { ok: true }
}

/**
 * @param {object} banking
 * @param {string} type
 * @param {unknown} payload
 * @param {{
 *   wireDomesticCents: number
 *   wireInternationalCents: number
 *   wireCotCents?: number
 *   wireImfCents?: number
 *   fxUsdPerEur?: number
 *   incomingDepositFeeCents?: number
 * }} fees
 * @returns {{ ok: true, banking: object } | { ok: false, error: string }}
 */
export function applyApprovalToBankingState(banking, type, payload, fees) {
  const state = cloneBanking(banking)
  ensureProductArrays(state)
  const p =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : {}

  const accounts = state.accounts
  const activity = state.activity
  const scheduled = state.scheduledBillPayments
  const debitCard = state.debitCard

  function pushActivity(row) {
    activity.unshift(row)
  }

  switch (type) {
    case 'internal_transfer': {
      const fromId = String(p.fromId)
      const toId = String(p.toId)
      const amountCents = Math.round(Number(p.amountCents))
      const memo = typeof p.memo === 'string' ? p.memo : ''
      if (!fromId || !toId)
        return { ok: false, error: 'Select both accounts.' }
      if (fromId === toId)
        return { ok: false, error: 'Choose two different accounts.' }
      if (!Number.isFinite(amountCents) || amountCents <= 0)
        return { ok: false, error: 'Enter an amount greater than zero.' }
      const from = accounts.find((a) => a.id === fromId)
      const to = accounts.find((a) => a.id === toId)
      if (!from || !to) return { ok: false, error: 'Account not found.' }
      const fromBal = Math.round(Number(from.balanceCents) || 0)
      const toBal = Math.round(Number(to.balanceCents) || 0)
      if (fromBal < amountCents)
        return {
          ok: false,
          error: 'That amount exceeds your available balance.',
        }
      const extra = memo.trim() ? ` — ${memo.trim()}` : ''
      for (const a of accounts) {
        if (a.id === fromId) a.balanceCents = fromBal - amountCents
        if (a.id === toId) a.balanceCents = toBal + amountCents
      }
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Transfer to ${to.name} ···${to.mask}${extra}`,
        amountCents: -amountCents,
      })
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Transfer from ${from.name} ···${from.mask}${extra}`,
        amountCents: amountCents,
      })
      break
    }
    case 'bill_pay': {
      const fromId = String(p.fromId)
      const payeeName = String(p.payeeName)
      const amountCents = Number(p.amountCents)
      if (!fromId) return { ok: false, error: 'Select an account.' }
      if (amountCents <= 0)
        return { ok: false, error: 'Enter an amount greater than zero.' }
      const from = accounts.find((a) => a.id === fromId)
      if (!from) return { ok: false, error: 'Account not found.' }
      if (from.balanceCents < amountCents)
        return {
          ok: false,
          error: 'That amount exceeds your available balance.',
        }
      from.balanceCents -= amountCents
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Bill payment — ${payeeName}`,
        amountCents: -amountCents,
      })
      break
    }
    case 'scheduled_bill': {
      const fromId = String(p.fromId)
      const name = String(p.payeeName).trim()
      const amountCents = Number(p.amountCents)
      const deliverBy = String(p.deliverBy)
      if (!fromId) return { ok: false, error: 'Select an account.' }
      if (amountCents <= 0)
        return { ok: false, error: 'Enter an amount greater than zero.' }
      if (!name) return { ok: false, error: 'Choose or add a payee.' }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deliverBy))
        return { ok: false, error: 'Choose a deliver-by date.' }
      const from = accounts.find((a) => a.id === fromId)
      if (!from) return { ok: false, error: 'Account not found.' }
      if (from.balanceCents < amountCents)
        return {
          ok: false,
          error:
            'That amount exceeds your available balance for scheduling this payment.',
        }
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const due = new Date(`${deliverBy}T12:00:00`)
      if (Number.isNaN(due.getTime()))
        return { ok: false, error: 'That date is not valid.' }
      if (due < today)
        return { ok: false, error: 'Choose today or a future date.' }
      scheduled.unshift({
        id: uid(),
        fromId,
        payeeName: name,
        amountCents,
        deliverBy,
      })
      break
    }
    case 'send_to_person': {
      const fromId = String(p.fromId)
      const recipientLabel = String(p.recipientLabel)
      const amountCents = Number(p.amountCents)
      if (!fromId) return { ok: false, error: 'Select an account.' }
      if (amountCents <= 0)
        return { ok: false, error: 'Enter an amount greater than zero.' }
      const from = accounts.find((a) => a.id === fromId)
      if (!from) return { ok: false, error: 'Account not found.' }
      if (from.balanceCents < amountCents)
        return {
          ok: false,
          error: 'That amount exceeds your available balance.',
        }
      from.balanceCents -= amountCents
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Send to ${recipientLabel}`,
        amountCents: -amountCents,
      })
      break
    }
    case 'wire_transfer': {
      const fromId = String(p.fromId)
      const amountCents = Number(p.amountCents)
      const scope = p.scope === 'international' ? 'international' : 'domestic'
      const ben = String(p.beneficiaryName).trim()
      const bank = String(p.receivingBank).trim()
      if (!fromId) return { ok: false, error: 'Select an account.' }
      if (amountCents <= 0)
        return { ok: false, error: 'Enter an amount greater than zero.' }
      if (!ben) return { ok: false, error: 'Enter the beneficiary name.' }
      if (!bank) return { ok: false, error: 'Enter the receiving bank name.' }
      if (scope === 'domestic') {
        const rt = String(p.routingNumber ?? '').replace(/\D/g, '')
        if (!/^\d{9}$/.test(rt))
          return {
            ok: false,
            error: 'Enter a valid 9-digit ABA routing number.',
          }
        if ((String(p.beneficiaryAccount ?? '').trim().length ?? 0) < 4)
          return {
            ok: false,
            error: 'Enter the beneficiary account number.',
          }
      } else {
        const ctry = String(p.country ?? '').trim()
        if (!ctry)
          return { ok: false, error: 'Enter the beneficiary country.' }
        const swift = String(p.swiftBic ?? '')
          .replace(/\s/g, '')
          .toUpperCase()
        if (!/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swift))
          return {
            ok: false,
            error: 'Enter a valid SWIFT / BIC code (8 or 11 characters).',
          }
        const iban = String(p.ibanOrAccount ?? '').replace(/\s/g, '')
        if (iban.length < 10)
          return {
            ok: false,
            error:
              'Enter the beneficiary IBAN or local account number (at least 10 characters).',
          }
      }
      const wireFee =
        scope === 'international'
          ? fees.wireInternationalCents
          : fees.wireDomesticCents
      const cot = Boolean(p.applyCot) ? Number(fees.wireCotCents) || 0 : 0
      const imf = Boolean(p.applyImf) ? Number(fees.wireImfCents) || 0 : 0
      const total = amountCents + wireFee + cot + imf
      const from = accounts.find((a) => a.id === fromId)
      if (!from) return { ok: false, error: 'Account not found.' }
      if (from.balanceCents < total)
        return {
          ok: false,
          error: `Insufficient funds. Wire amount plus fees (${formatCurrency(wireFee + cot + imf)}) exceeds your balance.`,
        }
      from.balanceCents -= total
      const wireDesc =
        scope === 'international'
          ? `Outgoing international wire — ${ben} (${bank}, ${String(p.country ?? '').trim()})`
          : `Outgoing domestic wire — ${ben} (${bank})`
      const feeDesc =
        scope === 'international'
          ? 'International wire transfer fee'
          : 'Wire transfer fee'
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: wireDesc,
        amountCents: -amountCents,
      })
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: feeDesc,
        amountCents: -wireFee,
      })
      if (cot > 0) {
        pushActivity({
          id: uid(),
          dateLabel: todayLabel(),
          description: 'Wire regulatory fee (COT)',
          amountCents: -cot,
        })
      }
      if (imf > 0) {
        pushActivity({
          id: uid(),
          dateLabel: todayLabel(),
          description: 'Wire regulatory fee (IMF)',
          amountCents: -imf,
        })
      }
      break
    }
    case 'mobile_deposit':
    case 'card_funding_deposit':
    case 'crypto_deposit': {
      const r = applyIncomingDepositRail(accounts, pushActivity, p, fees, type)
      if (!r.ok) return r
      break
    }
    case 'debit_card_lock': {
      if (debitCard.stolenBlocked) {
        return {
          ok: false,
          error:
            'This card is blocked for security (theft report). Contact the bank to review.',
        }
      }
      if (debitCard.adminFrozen) {
        return {
          ok: false,
          error:
            'This card is frozen by the bank. Contact support when the review is complete.',
        }
      }
      const locked = Boolean(p.locked)
      if (debitCard.locked !== locked) {
        debitCard.locked = locked
        // Card lock/unlock is shown on the debit card page only, not account activity.
      }
      break
    }
    case 'debit_card_travel_notice': {
      if (debitCard.stolenBlocked || debitCard.adminFrozen) {
        return {
          ok: false,
          error: 'Card controls are unavailable while the card is blocked or frozen by the bank.',
        }
      }
      debitCard.travelNoticeEnabled = Boolean(p.enabled)
      break
    }
    case 'debit_card_contactless': {
      if (debitCard.stolenBlocked || debitCard.adminFrozen) {
        return {
          ok: false,
          error: 'Card controls are unavailable while the card is blocked or frozen by the bank.',
        }
      }
      debitCard.contactlessEnabled = Boolean(p.enabled)
      break
    }
    case 'debit_card_replacement': {
      if (debitCard.stolenBlocked || debitCard.adminFrozen) {
        return {
          ok: false,
          error: 'Replacement cannot be requested while the card is blocked or frozen by the bank.',
        }
      }
      state.replacementBanner =
        'Replacement ordered. Your new card should arrive in 5–7 business days. Continue using this card until you activate the new one.'
      // Replacement request banner + debit card page; omit from deposit account activity.
      break
    }
    case 'loan_application': {
      const amountCents = Number(p.amountCents)
      const productLabel = String(p.productLabel || 'Loan').trim().slice(0, 120)
      if (amountCents <= 0)
        return { ok: false, error: 'Enter a loan amount greater than zero.' }
      state.loanApplications.unshift({
        id: uid(),
        productLabel,
        amountCents,
        termMonths: Math.max(0, Math.round(Number(p.termMonths) || 0)),
        status: 'booked',
        createdAt: new Date().toISOString(),
      })
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Loan booked — ${productLabel}`,
        amountCents: 0,
      })
      break
    }
    case 'fdr_open': {
      const amountCents = Number(p.amountCents)
      const termMonths = Math.max(1, Math.round(Number(p.termMonths) || 12))
      const rateBps = Math.max(0, Math.round(Number(p.rateBps) || 0))
      if (amountCents <= 0)
        return { ok: false, error: 'Enter a deposit amount greater than zero.' }
      const from = accounts.find((a) => a.id === String(p.fromId))
      if (!from) return { ok: false, error: 'Account not found.' }
      if (from.balanceCents < amountCents)
        return { ok: false, error: 'Insufficient balance to fund this deposit.' }
      from.balanceCents -= amountCents
      state.fixedDeposits.unshift({
        id: uid(),
        principalCents: amountCents,
        termMonths,
        rateBps,
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Fixed deposit opened — ${termMonths} mo @ ${(rateBps / 100).toFixed(2)}% APR (indicative)`,
        amountCents: -amountCents,
      })
      break
    }
    case 'dps_open': {
      const monthlyCents = Number(p.monthlyContributionCents)
      if (monthlyCents <= 0)
        return {
          ok: false,
          error: 'Enter a monthly pension contribution greater than zero.',
        }
      state.dpsPlans.unshift({
        id: uid(),
        monthlyContributionCents: monthlyCents,
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: 'Deposit pension plan (DPS) enrollment started',
        amountCents: 0,
      })
      break
    }
    case 'currency_exchange': {
      const fromId = String(p.fromId)
      const sell = Number(p.sellAmountCents)
      const buyCur = String(p.buyCurrency || 'EUR')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 3) || 'EUR'
      const buyAmt = Number(p.buyAmountCents)
      if (!fromId) return { ok: false, error: 'Select an account.' }
      if (sell <= 0 || buyAmt <= 0)
        return { ok: false, error: 'Enter sell and buy amounts greater than zero.' }
      const from = accounts.find((a) => a.id === fromId)
      if (!from) return { ok: false, error: 'Account not found.' }
      if (from.balanceCents < sell)
        return { ok: false, error: 'Insufficient USD balance for this exchange.' }
      from.balanceCents -= sell
      let hold = state.fxHoldings.find((x) => x.currency === buyCur)
      if (!hold) {
        hold = { currency: buyCur, balanceCents: 0 }
        state.fxHoldings.push(hold)
      }
      hold.balanceCents += buyAmt
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `FX — sold ${formatCurrency(sell)} for ${buyCur} ${(buyAmt / 100).toFixed(2)} (ledger cents)`,
        amountCents: -sell,
      })
      break
    }
    case 'cancel_scheduled_bill': {
      const sid = String(p.scheduledPaymentId)
      const idx = scheduled.findIndex((x) => x.id === sid)
      if (idx === -1)
        return { ok: false, error: 'Scheduled payment was already removed.' }
      scheduled.splice(idx, 1)
      break
    }
    default:
      return { ok: false, error: 'Unknown approval type.' }
  }

  return { ok: true, banking: state }
}

const REVERSIBLE_TYPES = new Set([
  'mobile_deposit',
  'card_funding_deposit',
  'crypto_deposit',
  'internal_transfer',
  'bill_pay',
  'send_to_person',
  'wire_transfer',
])

export function isReversibleApprovalType(type) {
  return typeof type === 'string' && REVERSIBLE_TYPES.has(type)
}

/**
 * Undoes balance effects of an already-applied approval (subset of types).
 * @param {object} banking
 * @param {string} type
 * @param {unknown} payload
 * @param {{
 *   wireDomesticCents: number
 *   wireInternationalCents: number
 *   wireCotCents?: number
 *   wireImfCents?: number
 *   fxUsdPerEur?: number
 *   incomingDepositFeeCents?: number
 * }} fees
 * @returns {{ ok: true, banking: object } | { ok: false, error: string }}
 */
export function reverseAppliedApprovalEffect(banking, type, payload, fees) {
  if (!isReversibleApprovalType(type)) {
    return { ok: false, error: 'This approval type cannot be reversed automatically.' }
  }
  const state = cloneBanking(banking)
  ensureProductArrays(state)
  const p =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? /** @type {Record<string, unknown>} */ (payload)
      : {}
  const accounts = state.accounts
  const activity = state.activity

  function pushActivity(row) {
    activity.unshift(row)
  }

  switch (type) {
    case 'internal_transfer': {
      const fromId = String(p.fromId)
      const toId = String(p.toId)
      const amountCents = Math.round(Number(p.amountCents))
      const memo = typeof p.memo === 'string' ? p.memo : ''
      if (!fromId || !toId || !Number.isFinite(amountCents) || amountCents <= 0)
        return { ok: false, error: 'Invalid transfer payload for reversal.' }
      const from = accounts.find((a) => a.id === fromId)
      const to = accounts.find((a) => a.id === toId)
      if (!from || !to) return { ok: false, error: 'Account not found.' }
      const toBal = Math.round(Number(to.balanceCents) || 0)
      if (toBal < amountCents)
        return {
          ok: false,
          error:
            'Cannot reverse: destination account balance is too low to pull funds back.',
        }
      const fromBal = Math.round(Number(from.balanceCents) || 0)
      for (const a of accounts) {
        if (a.id === fromId) a.balanceCents = fromBal + amountCents
        if (a.id === toId) a.balanceCents = toBal - amountCents
      }
      const extra = memo.trim() ? ` — ${memo.trim()}` : ''
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Reversal — transfer from ${to.name} ···${to.mask}${extra}`,
        amountCents: -amountCents,
      })
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Reversal — transfer to ${from.name} ···${from.mask}${extra}`,
        amountCents: amountCents,
      })
      break
    }
    case 'bill_pay': {
      const fromId = String(p.fromId)
      const payeeName = String(p.payeeName)
      const amountCents = Number(p.amountCents)
      if (!fromId || amountCents <= 0)
        return { ok: false, error: 'Invalid bill pay payload for reversal.' }
      const from = accounts.find((a) => a.id === fromId)
      if (!from) return { ok: false, error: 'Account not found.' }
      from.balanceCents += amountCents
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Reversal — bill payment (${payeeName})`,
        amountCents: amountCents,
      })
      break
    }
    case 'send_to_person': {
      const fromId = String(p.fromId)
      const recipientLabel = String(p.recipientLabel)
      const amountCents = Number(p.amountCents)
      if (!fromId || amountCents <= 0)
        return { ok: false, error: 'Invalid send payload for reversal.' }
      const from = accounts.find((a) => a.id === fromId)
      if (!from) return { ok: false, error: 'Account not found.' }
      from.balanceCents += amountCents
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Reversal — send to ${recipientLabel}`,
        amountCents: amountCents,
      })
      break
    }
    case 'wire_transfer': {
      const fromId = String(p.fromId)
      const amountCents = Number(p.amountCents)
      const scope = p.scope === 'international' ? 'international' : 'domestic'
      if (!fromId || amountCents <= 0)
        return { ok: false, error: 'Invalid wire payload for reversal.' }
      const wireFee =
        scope === 'international'
          ? fees.wireInternationalCents
          : fees.wireDomesticCents
      const cot = Boolean(p.applyCot) ? Number(fees.wireCotCents) || 0 : 0
      const imf = Boolean(p.applyImf) ? Number(fees.wireImfCents) || 0 : 0
      const total = amountCents + wireFee + cot + imf
      const from = accounts.find((a) => a.id === fromId)
      if (!from) return { ok: false, error: 'Account not found.' }
      from.balanceCents += total
      const ben = String(p.beneficiaryName ?? '').trim() || 'beneficiary'
      pushActivity({
        id: uid(),
        dateLabel: todayLabel(),
        description: `Reversal — outgoing wire (${ben})`,
        amountCents: amountCents,
      })
      if (wireFee > 0) {
        pushActivity({
          id: uid(),
          dateLabel: todayLabel(),
          description: 'Reversal — wire transfer fee credit',
          amountCents: wireFee,
        })
      }
      if (cot > 0) {
        pushActivity({
          id: uid(),
          dateLabel: todayLabel(),
          description: 'Reversal — wire regulatory fee (COT) credit',
          amountCents: cot,
        })
      }
      if (imf > 0) {
        pushActivity({
          id: uid(),
          dateLabel: todayLabel(),
          description: 'Reversal — wire regulatory fee (IMF) credit',
          amountCents: imf,
        })
      }
      break
    }
    case 'mobile_deposit':
    case 'card_funding_deposit':
    case 'crypto_deposit': {
      const r = reverseIncomingDepositRail(
        accounts,
        pushActivity,
        p,
        fees,
        type,
      )
      if (!r.ok) return r
      break
    }
    default:
      return { ok: false, error: 'Unknown approval type.' }
  }

  return { ok: true, banking: state }
}
