import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'
import rawDefaults from '../data/bank.defaults.json'
import { getApiBase } from '../lib/apiBase'
import type { BankConfig } from '../types/bankConfig'

const FALLBACK = rawDefaults as BankConfig

/** Last good public bank config — avoids a flash of bundled “Bywells…” defaults on refresh. */
const STORAGE_KEY = 'bw-public-bank-config-v1'

function readCachedBankConfig(): BankConfig | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BankConfig
    const short = String(parsed.bankNameShort ?? '').trim()
    const full = String(parsed.bankName ?? '').trim()
    if (!short && !full) return null
    return parsed
  } catch {
    return null
  }
}

function persistBankConfigCache(next: BankConfig): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}

const initialCached = readCachedBankConfig()

const BankConfigContext = createContext<BankConfig>(FALLBACK)

export function BankConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BankConfig>(() => initialCached ?? FALLBACK)
  /** True once we have cache and/or a successful `/api/public/bank-config` load. */
  const [bankConfigHydrated, setBankConfigHydrated] = useState(
    () => initialCached != null,
  )

  const reload = useCallback(() => {
    const base = getApiBase()
    fetch(`${base}/api/public/bank-config`, { cache: 'no-store' })
      .then(async (r) => {
        const ct = r.headers.get('content-type') ?? ''
        if (!r.ok || !ct.includes('application/json')) {
          throw new Error(`bank-config HTTP ${r.status}`)
        }
        return r.json() as Promise<{ ok?: boolean; config?: BankConfig }>
      })
      .then((data) => {
        if (data?.ok && data.config) {
          persistBankConfigCache(data.config)
          setConfig(data.config)
          setBankConfigHydrated(true)
        }
      })
      .catch(() => {
        if (import.meta.env.PROD && !String(getApiBase()).trim()) {
          console.warn(
            '[bywells] Could not load /api/public/bank-config. When the SPA is hosted separately (e.g. Netlify), set VITE_API_BASE to your API origin at build time and redeploy.',
          )
        }
      })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    window.addEventListener('bank-config-updated', reload)
    return () => window.removeEventListener('bank-config-updated', reload)
  }, [reload])

  useLayoutEffect(() => {
    if (!bankConfigHydrated) return
    const short = String(config.bankNameShort ?? '').trim()
    const full = String(config.bankName ?? '').trim()
    const tabTitle = short || full
    if (tabTitle) document.title = tabTitle
  }, [bankConfigHydrated, config.bankName, config.bankNameShort])

  useLayoutEffect(() => {
    const t = config.theme
    const r = document.documentElement
    r.style.setProperty('--color-bw-navy-950', t.navy950)
    r.style.setProperty('--color-bw-navy-900', t.navy900)
    r.style.setProperty('--color-bw-navy-800', t.navy800)
    r.style.setProperty('--color-bw-blue-600', t.blue600)
    r.style.setProperty('--color-bw-blue-500', t.blue500)
    r.style.setProperty('--color-bw-sky-100', t.sky100)
    r.style.setProperty('--color-bw-red-800', t.red800)
    r.style.setProperty('--color-bw-red-700', t.red700)
    r.style.setProperty('--color-bw-red-600', t.red600)
    r.style.setProperty('--color-bw-sand-100', t.sand100)
    r.style.setProperty('--color-bw-sand-200', t.sand200)
    r.style.setProperty('--color-bw-muted', t.muted)
  }, [config.theme])

  return (
    <BankConfigContext.Provider value={config}>
      {children}
    </BankConfigContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook paired with provider
export function useBankConfig(): BankConfig {
  return useContext(BankConfigContext)
}
