import nodemailer from 'nodemailer'

export function smtpFromEnv() {
  const host = process.env.MAIL_SMTP_HOST?.trim()
  const port = Number(process.env.MAIL_SMTP_PORT || 587)
  const secure =
    process.env.MAIL_SMTP_SECURE === 'true' ||
    process.env.MAIL_SMTP_SECURE === '1'
  const user = process.env.MAIL_SMTP_USER?.trim()
  const pass = process.env.MAIL_SMTP_PASS ?? ''
  const from = process.env.MAIL_FROM?.trim()
  return { host, port, secure, user, pass, from }
}

/**
 * Template values copied from docs/examples must not count as “configured” or
 * health/test-email will misleadingly show ready while sends fail.
 */
export function isPlaceholderMailConfig(cfg) {
  const host = (cfg.host || '').toLowerCase()
  const from = (cfg.from || '').toLowerCase()
  if (!host || !from) return false

  const placeholderHosts = new Set([
    'smtp.yourdomain.com',
    'smtp.example.com',
    'mail.yourdomain.com',
    'mail.example.com',
  ])
  if (placeholderHosts.has(host)) return true
  if (host.endsWith('.yourdomain.com') || host.endsWith('.example.com'))
    return true

  if (/@yourdomain\.com\b/.test(from)) return true
  if (/@example\.(com|org|net)\b/.test(from)) return true
  return false
}

export function isMailReady(cfg) {
  if (!cfg.host || !cfg.from) return false
  if (isPlaceholderMailConfig(cfg)) return false
  return true
}

function envFlag(name) {
  const v = process.env[name]?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function createTransport(cfg) {
  /** @type {import('nodemailer').TransportOptions} */
  const transportOpts = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    // Avoid hanging sign-in when SMTP is wrong or unreachable (OTP path).
    connectionTimeout: 18_000,
    greetingTimeout: 18_000,
    socketTimeout: 25_000,
  }

  /** DigitalOcean / some VPS: IPv6 egress can fail while AAAA exists — force IPv4. */
  if (envFlag('MAIL_SMTP_FORCE_IPV4')) {
    transportOpts.family = 4
  }

  /**
   * Ports 587 / 2525 use STARTTLS (implicit TLS uses 465 + secure:true).
   * requireTLS helps some hosts (e.g. Microsoft 365). Restrict to these ports so
   * dev mail sinks on arbitrary ports (1025, etc.) still work.
   * Set MAIL_SMTP_REQUIRE_TLS=0 if your relay rejects STARTTLS negotiation.
   */
  const p = cfg.port
  const requireTlsOff = /^0|false|no$/i.test(
    String(process.env.MAIL_SMTP_REQUIRE_TLS ?? '').trim(),
  )
  if (
    !requireTlsOff &&
    !cfg.secure &&
    typeof p === 'number' &&
    (p === 587 || p === 2525)
  ) {
    transportOpts.requireTLS = true
  }

  if (envFlag('MAIL_SMTP_DEBUG')) {
    transportOpts.debug = true
    transportOpts.logger = console
  }

  if (cfg.user && cfg.pass) {
    transportOpts.auth = { user: cfg.user, pass: cfg.pass }
  }
  return nodemailer.createTransport(transportOpts)
}

/**
 * When true, transactional mail endpoints may append the SMTP error message to the
 * JSON `error` string so operators can fix MAIL_* without reading server logs.
 * Defaults to on when NODE_ENV is not production; force off with MAIL_SHOW_SMTP_ERRORS=0.
 */
export function smtpErrorsVisibleToClient() {
  const v = process.env.MAIL_SHOW_SMTP_ERRORS?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  if (v === '1' || v === 'true' || v === 'yes') return true
  return process.env.NODE_ENV !== 'production'
}

/** @param {unknown} err */
export function clientMessageForMailSendFailure(err, genericMessage) {
  const base =
    typeof genericMessage === 'string' && genericMessage.trim()
      ? genericMessage.trim()
      : 'Could not send mail.'
  if (!smtpErrorsVisibleToClient()) return base
  const raw = err instanceof Error ? err.message : String(err)
  const detail = raw.replace(/\s+/g, ' ').trim().slice(0, 320)
  if (!detail) return base
  const sep = base.endsWith('.') ? '' : '.'
  return `${base}${sep} (${detail})`
}

export function fromPreview(from) {
  if (!from) return null
  const m = from.match(/<([^>]+)>/)
  return m ? m[1].trim() : from
}
