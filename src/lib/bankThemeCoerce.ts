import type { BankConfig, BankTheme } from '../types/bankConfig'

function parseRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** True for saturated blues/indigos/cyans (legacy Tailwind accent), not amber/gold. */
function isCoolChromeAccent(hex: string): boolean {
  const p = parseRgb(hex)
  if (!p) return false
  const { r, g, b } = p
  return b >= 160 && b > r + 25 && b > g + 15
}

/** True for very light cool tints (e.g. old sky-100) — warm cream should fail this. */
function isCoolPaperTint(hex: string): boolean {
  const p = parseRgb(hex)
  if (!p) return false
  const { r, g, b } = p
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return y > 210 && b > r + 12 && b > g + 8
}

function themeNeedsBundledPalette(remote: BankTheme): boolean {
  return (
    isCoolChromeAccent(remote.blue600) ||
    isCoolChromeAccent(remote.blue500) ||
    isCoolPaperTint(remote.sky100)
  )
}

/**
 * Remote APIs (e.g. operator `bank-config.json` on the droplet) may still ship
 * legacy blue/indigo hex for accent keys. Coerce to bundled defaults so static
 * CSS variables stay on the gold palette when the API has not been updated.
 */
export function normalizeBankConfig(config: BankConfig, bundled: BankConfig): BankConfig {
  const t = config.theme
  if (themeNeedsBundledPalette(t)) {
    return { ...config, theme: { ...bundled.theme } }
  }
  return { ...config, theme: { ...bundled.theme, ...t } }
}
