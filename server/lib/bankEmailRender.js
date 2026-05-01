/**
 * Branded HTML letters + placeholder substitution for transactional mail.
 */

/** @param {unknown} v @param {string} fb */
function safeHexColor(v, fb) {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? s : fb
}

/**
 * @param {unknown} s
 */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Replace {{key}} with escaped values (safe for HTML body).
 * @param {string} template
 * @param {Record<string, string | number>} vars
 */
export function applyTemplateHtml(template, vars) {
  let out = template
  for (const [key, val] of Object.entries(vars)) {
    const safe = escapeHtml(val)
    out = out.split(`{{${key}}}`).join(safe)
  }
  return out
}

/**
 * Replace {{key}} for plain-text bodies (no HTML escaping).
 * @param {string} template
 * @param {Record<string, string | number>} vars
 */
export function applyTemplateText(template, vars) {
  let out = template
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(String(val ?? ''))
  }
  return out
}

/**
 * @param {object} bank — merged bank config (loadBankConfig())
 * @param {string} innerHtml — operator HTML after placeholder substitution
 */
export function wrapOfficialLetterHtml(innerHtml, bank) {
  const primary = safeHexColor(bank.theme?.navy950, '#1c1917')
  const accent = safeHexColor(bank.theme?.blue600, '#d97706')
  const bankName = escapeHtml(bank.bankName || 'Bank')
  const footEmail = escapeHtml(bank.supportEmail || '')
  const footPhone = escapeHtml(bank.supportPhone || '')
  const fraudPhone = escapeHtml(bank.supportPhoneFraud || bank.supportPhone || '')
  const legal = escapeHtml(String(bank.legalDemoFooter || '').slice(0, 340))
  const legalEllipsis =
    String(bank.legalDemoFooter || '').length > 340 ? '…' : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${bankName}</title>
</head>
<body style="margin:0;padding:0;background:#fffbeb;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffbeb;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="640" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #fde68a;box-shadow:0 4px 24px rgba(28,25,23,0.06);">
<tr><td style="background:linear-gradient(135deg, ${primary} 0%, ${accent} 100%);padding:26px 30px;">
<div style="font-family:Georgia,'Times New Roman',serif;color:rgba(255,255,255,0.9);font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">Official correspondence</div>
<div style="font-family:Georgia,serif;color:#ffffff;font-size:26px;font-weight:700;margin-top:10px;line-height:1.15;">${bankName}</div>
<div style="margin-top:10px;height:3px;width:56px;background:rgba(255,255,255,0.35);border-radius:2px;"></div>
</td></tr>
<tr><td style="padding:30px 30px 16px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#292524;">
${innerHtml}
</td></tr>
<tr><td style="padding:14px 30px 28px;font-family:'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.55;color:#78716c;border-top:1px solid #fde68a;background:#fffbeb;">
<p style="margin:0 0 10px;color:#78716c;">This secure message was sent by <strong style="color:#292524">${bankName}</strong> regarding your relationship with us.</p>
<p style="margin:0;">${footEmail ? `<span style="color:#292524">${footEmail}</span>` : ''}${footEmail && footPhone ? ' · ' : ''}${footPhone ? `<span style="color:#292524">${footPhone}</span>` : ''}${fraudPhone && fraudPhone !== footPhone ? `<br/><span style="display:inline-block;margin-top:8px;font-size:11px;color:#78716c;">Card / fraud hotline: ${fraudPhone}</span>` : ''}</p>
<p style="margin:14px 0 0;font-size:11px;line-height:1.45;color:#7c8498;">${legal}${legalEllipsis}</p>
</td></tr>
</table>
<p style="margin:16px auto 0;max-width:640px;text-align:center;font-family:'Segoe UI',sans-serif;font-size:11px;color:#7c8498;">Do not reply to automated messages unless instructed. Visit official channels listed above.</p>
</td></tr>
</table>
</body>
</html>`
}
