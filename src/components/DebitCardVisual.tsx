import { LogoMark } from './LogoMark'

type Props = {
  cardholderName: string
  last4: string
  expMonth: number
  expYear: number
  locked: boolean
  contactlessEnabled: boolean
  /** e.g. "Linked to Premier Checking" */
  linkedAccountLine: string
  /** Issued as a virtual card (visual badge). */
  virtualBadge?: boolean
  /** Institution logo URL/path from bank config (optional). */
  institutionLogoSrc?: string
  className?: string
}

function formatExp(m: number, y: number): string {
  return `${String(m).padStart(2, '0')}/${String(y).slice(-2)}`
}

function ContactlessIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8.5 16.5c2.5-2.2 2.5-6.8 0-9M11 18c3.8-3.4 3.8-8.6 0-12M6 15c1.6-1.4 1.6-4.6 0-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function DebitCardVisual({
  cardholderName,
  last4,
  expMonth,
  expYear,
  locked,
  contactlessEnabled,
  linkedAccountLine,
  virtualBadge = false,
  institutionLogoSrc,
  className = '',
}: Props) {
  const name =
    cardholderName.trim() || 'Valued Customer'
  const upper = name.toUpperCase().slice(0, 26)

  return (
    <div
      className={`relative mx-auto w-full max-w-[26rem] select-none motion-reduce:perspective-none ${className}`}
      style={{ perspective: '1200px' }}
    >
      <div
        className="relative w-full overflow-hidden rounded-2xl shadow-[0_25px_50px_-12px_rgba(6,20,40,0.45)] ring-1 ring-white/10 [transform-style:preserve-3d] [transform:rotateX(2deg)_rotateY(-4deg)] motion-reduce:transform-none"
        style={{ aspectRatio: '85.6 / 53.98' }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-bw-navy-900 via-[#0c2848] to-[#061018]"
          aria-hidden
        />
        <div
          className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-bw-red-600/20 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-bw-blue-500/25 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        <div className="absolute right-6 top-1/2 hidden h-px w-24 -translate-y-1/2 bg-gradient-to-l from-transparent via-white/25 to-transparent sm:block" />

        <div className="relative z-10 flex h-full flex-col justify-between p-6 text-white sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="relative h-11 w-[3.35rem] shrink-0 rounded-md bg-gradient-to-br from-amber-100 via-amber-400 to-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.35)]"
                aria-hidden
              >
                <div className="absolute inset-1 rounded-sm bg-gradient-to-br from-amber-200/80 to-amber-600/90 opacity-90" />
                <div
                  className="absolute inset-2 grid grid-cols-4 gap-px opacity-40"
                  aria-hidden
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="rounded-[1px] bg-bw-navy-900/30" />
                  ))}
                </div>
              </div>
              {contactlessEnabled ? (
                <ContactlessIcon className="mt-1 h-8 w-8 text-white/75" />
              ) : (
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Tap off
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {virtualBadge ? (
                <span className="rounded-md bg-bw-blue-500/25 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white ring-1 ring-white/25">
                  Virtual
                </span>
              ) : null}
              <LogoMark
                className="h-10 w-10 opacity-95"
                variant="dark"
                imageSrc={institutionLogoSrc}
                alt=""
              />
            </div>
          </div>

          <div className="space-y-1">
            <p className="font-mono text-lg tracking-[0.2em] text-white/95 sm:text-xl">
              <span className="text-white/35">···· ···· ····</span>{' '}
              <span className="tracking-widest">{last4}</span>
            </p>
            <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Valid thru
                </p>
                <p className="font-mono text-sm tabular-nums text-white/90">
                  {formatExp(expMonth, expYear)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Cardholder
                </p>
                <p className="max-w-[14rem] truncate font-display text-sm font-semibold tracking-wide">
                  {upper}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between border-t border-white/10 pt-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                Debit
              </p>
              <p className="text-xs font-medium text-white/70">
                {linkedAccountLine}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded bg-white px-2 py-1 font-display text-sm font-bold tracking-tight text-bw-navy-900">
                VISA
              </span>
            </div>
          </div>
        </div>

        {locked ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-bw-navy-950/78 backdrop-blur-[3px]"
            aria-live="polite"
          >
            <span className="rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-white">
              Locked
            </span>
            <p className="px-6 text-center text-sm text-white/85">
              New purchases and ATM withdrawals are paused
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
