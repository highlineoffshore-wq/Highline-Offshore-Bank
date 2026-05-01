import { Link } from 'react-router-dom'
import { useBankConfig } from '../contexts/BankConfigContext'
import { resolvePublicMediaUrl } from '../lib/apiBase'
import type { BankConfig } from '../types/bankConfig'

function contactHref(cfg: BankConfig): string {
  const phone = String(cfg.supportPhone ?? '').trim()
  if (phone) return `tel:${phone.replace(/\s+/g, '')}`
  const email = String(cfg.supportEmail ?? '').trim()
  if (email) return `mailto:${email}`
  return '#contact'
}

const heroBtnPrimary =
  'inline-flex items-center justify-center rounded-full bg-bw-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-amber-900/15 ring-1 ring-bw-sand-200/80 transition hover:bg-bw-navy-800 hover:shadow-xl active:scale-[0.98]'

const heroBtnSecondary =
  'inline-flex items-center justify-center rounded-full border border-bw-sand-300 bg-white px-6 py-3.5 text-sm font-semibold text-bw-navy-950 shadow-sm transition hover:border-bw-blue-600/40 hover:bg-bw-sand-100'

const heroBtnGhost =
  'inline-flex items-center justify-center rounded-full border border-transparent bg-transparent px-6 py-3.5 text-sm font-semibold text-bw-navy-900/90 underline-offset-4 transition hover:bg-white/80 hover:text-bw-navy-950'

function IconShield({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChart({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19h16M7 15l3-4 3 2 5-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconBolt({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function HomePage() {
  const cfg = useBankConfig()
  const tag = String(cfg.taglineHeader ?? '').trim()

  return (
    <>
      {/* Hero — light editorial + framed media (replaces dark gradient band) */}
      <section className="relative overflow-hidden border-b border-bw-sand-200 bg-gradient-to-b from-white via-bw-sand-100/70 to-bw-sky-100/35 text-bw-navy-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%2378716c'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_80%_-10%,rgba(251,191,36,0.18),transparent_55%)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 top-8 h-[22rem] w-[22rem] rounded-full bg-bw-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-bw-sand-200/90 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-14 lg:pb-24 lg:pt-16">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-6 lg:pr-4">
              {tag ? (
                <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-bw-sand-200 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-bw-navy-900 shadow-sm">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-bw-blue-600 shadow-[0_0_10px_rgba(217,119,6,0.65)]" />
                  {tag}
                </p>
              ) : null}
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-bw-blue-600">
                {cfg.homeEyebrow}
              </p>
              <h1 className="mt-3 max-w-[20ch] font-display text-[2.25rem] font-semibold leading-[1.08] tracking-tight text-bw-navy-950 sm:text-5xl lg:text-[3.15rem]">
                {cfg.homeHeadline}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-bw-muted sm:text-xl">
                {cfg.homeSubtext}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link to="/sign-in" className={heroBtnPrimary}>
                  Log in to digital banking
                </Link>
                <Link to="/sign-up" className={heroBtnSecondary}>
                  Become a client
                </Link>
              </div>
              <p className="mt-4">
                <a href="#products" className={heroBtnGhost}>
                  Browse solutions →
                </a>
              </p>

              <dl className="mt-12 grid max-w-lg gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="rounded-2xl border border-bw-sand-200 bg-white/90 p-4 shadow-bw-soft">
                  <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-bw-muted">
                    <IconShield className="h-4 w-4 text-bw-blue-600" />
                    Support hours
                  </dt>
                  <dd className="mt-2 text-sm font-medium leading-snug text-bw-navy-900">
                    {cfg.supportHoursLine}
                  </dd>
                </div>
                <div className="rounded-2xl border border-bw-sand-200 bg-white/90 p-4 shadow-bw-soft">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-bw-muted">
                    Talk to us
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-bw-navy-900">
                    {cfg.supportPhone ? (
                      <a
                        className="font-semibold text-bw-blue-600 underline decoration-bw-sand-300 underline-offset-2 transition hover:text-bw-navy-800"
                        href={`tel:${cfg.supportPhone.replace(/\s+/g, '')}`}
                      >
                        {cfg.supportPhone}
                      </a>
                    ) : null}
                    {cfg.supportPhone && cfg.supportEmail ? (
                      <span className="text-bw-muted"> · </span>
                    ) : null}
                    {cfg.supportEmail ? (
                      <a
                        className="font-semibold text-bw-blue-600 underline decoration-bw-sand-300 underline-offset-2 transition hover:text-bw-navy-800"
                        href={`mailto:${cfg.supportEmail}`}
                      >
                        Email
                      </a>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="relative lg:col-span-6">
              <div
                className="absolute -left-4 top-8 hidden h-48 w-48 rounded-3xl bg-gradient-to-br from-bw-blue-500/30 to-bw-sand-200/50 lg:block"
                aria-hidden
              />
              <figure className="relative overflow-hidden rounded-2xl border border-bw-sand-200 bg-white shadow-bw-card ring-1 ring-bw-sand-200/80">
                <img
                  src={resolvePublicMediaUrl(cfg.homeHeroImageSrc)}
                  alt="Illustrative banking scene for marketing only."
                  className="aspect-[4/3] w-full object-cover sm:aspect-[16/11] lg:max-h-[min(30rem,56vh)] lg:min-h-[18rem]"
                  width={1200}
                  height={800}
                  loading="eager"
                  decoding="async"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bw-sand-100/90 to-transparent" />
                <figcaption className="sr-only">
                  Illustrative scene for marketing only; not an actual branch,
                  staff, or customers of {cfg.bankNameShort}.
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-bw-sand-200 bg-gradient-to-r from-white via-bw-sand-100/50 to-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-6 sm:justify-between sm:px-6">
          {[
            { label: 'Designed around real routines', icon: IconBolt },
            { label: 'Advisors by chapter of life', icon: IconChart },
            { label: 'Safety you can act on', icon: IconShield },
          ].map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 text-sm font-semibold text-bw-navy-900"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bw-sky-100/90 text-bw-blue-600 ring-1 ring-bw-blue-500/15">
                <Icon />
              </span>
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Why choose */}
      <section className="border-b border-bw-sand-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-bw-navy-900 sm:text-[2.1rem]">
              Why households lean on {cfg.bankNameShort}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-bw-muted sm:text-lg">
              One relationship for deposits, credit, and planning—pricing spelled
              out upfront, fraud help that answers at odd hours, and bankers who
              already know why you called.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-12 lg:gap-6">
            <article className="relative flex flex-col overflow-hidden rounded-2xl border border-bw-sand-200/90 bg-gradient-to-br from-bw-sky-100/50 via-white to-white p-7 shadow-bw-soft lg:col-span-7 lg:min-h-[280px] lg:p-8">
              <div className="absolute right-0 top-0 h-40 w-40 translate-x-6 -translate-y-6 rounded-full bg-bw-blue-500/10 blur-2xl" />
              <h3 className="relative font-display text-xl font-semibold text-bw-navy-900">
                Guidance by life chapter
              </h3>
              <p className="relative mt-3 max-w-xl text-sm leading-relaxed text-bw-muted sm:text-[15px]">
                Retail, business, and wealth tracks carry their own playbooks—so
                you hear suggestions rooted in your balance sheet, not a generic
                script.
              </p>
            </article>
            <article className="flex flex-col rounded-2xl border border-bw-sand-200/90 bg-bw-sand-100/35 p-7 shadow-bw-soft lg:col-span-5">
              <h3 className="font-display text-lg font-semibold text-bw-navy-900">
                Fewer fee surprises
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-bw-muted">
                Tariffs, wire charges, and minimums live in plain sight before
                you commit—and the app flashes anything material again right as
                you approve money movement.
              </p>
            </article>
            <article className="flex flex-col rounded-2xl border border-bw-sand-200/90 bg-white p-7 shadow-bw-soft lg:col-span-5">
              <h3 className="font-display text-lg font-semibold text-bw-navy-900">
                Controls at your fingertips
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-bw-muted">
                Layered sign-in, instant card freezes, configurable alerts, and a
                fraud desk that actually picks up when your gut says something is
                wrong.
              </p>
            </article>
            <article className="flex flex-col rounded-2xl border border-bw-sand-200/90 bg-gradient-to-br from-white to-bw-sand-100/50 p-7 shadow-bw-soft lg:col-span-7">
              <h3 className="font-display text-lg font-semibold text-bw-navy-900">
                Humans when you want them
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-bw-muted">
                Voice, encrypted messaging, scheduled branch time, and stretched
                coverage windows—without narrating your file from zero on every
                transfer.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Products */}
      <section
        id="products"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="max-w-3xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-bw-navy-900 sm:text-[2.2rem]">
            Pick the lane that matches your balance sheet
          </h2>
          <p className="mt-4 text-base leading-relaxed text-bw-muted sm:text-lg">
            Each route spells out offerings, realistic onboarding clocks, risk
            habits we watch for, and answers to the questions clients ask before
            they ever sit across from us.
          </p>
        </div>
        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {[
            {
              title: 'Personal',
              body: 'Spend-and-save stacks, plastic with grown-up controls, lending that reads your cash rhythm, and payments without spreadsheet gymnastics.',
              tone: 'from-bw-sky-100/90 via-white to-white',
              to: '/personal',
              cta: 'See Personal',
              bullets: [
                'Deposit + borrowing pathways in one narrative',
                'Step-by-step enrollment outline',
                'Security posture we rehearse with households',
              ],
            },
            {
              title: 'Small business',
              body: 'Operating accounts, working-capital lines, getting paid, holding treasury tight, and an RM who speaks owner—not buzzword.',
              tone: 'from-bw-sand-100 via-white to-white',
              to: '/small-business',
              cta: 'See Small business',
              bullets: [
                'Which tiers fit which payroll tempo',
                'Wires, ACH, maker-checker habits',
                'Stress-tests for growth, payroll, and audits',
              ],
            },
            {
              title: 'Wealth',
              body: `${cfg.investBrandName}, private balance-sheet banking, scenario planning, and trust choreography when life gets layered.`,
              tone: 'from-bw-sky-100/75 via-white to-bw-sand-100/55',
              to: '/wealth',
              cta: 'See Wealth',
              bullets: [
                'How relationships deepen as assets climb',
                'Investment beliefs plus sample sleeve mixes',
                'Tax-aware moves, liquidity bridges, legacy wiring',
              ],
            },
          ].map((card) => (
            <article
              key={card.title}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border border-bw-sand-200/90 bg-gradient-to-br ${card.tone} p-8 shadow-bw-soft transition duration-300 hover:-translate-y-1 hover:border-bw-blue-500/35 hover:shadow-bw-card`}
            >
              <div
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-bw-blue-600 via-bw-red-600 to-bw-blue-500 opacity-90"
                aria-hidden
              />
              <h3 className="mt-2 font-display text-xl font-semibold text-bw-navy-900">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-bw-muted">
                {card.body}
              </p>
              <ul className="mt-6 space-y-2.5 border-t border-bw-sand-200/80 pt-6 text-xs leading-snug text-bw-navy-900">
                {card.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bw-sky-100 text-[10px] font-bold text-bw-blue-600 ring-1 ring-bw-blue-500/20"
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={card.to}
                className="mt-8 inline-flex items-center gap-1 text-sm font-bold text-bw-blue-600 transition hover:gap-2 hover:text-bw-blue-500"
              >
                {card.cta}
                <span aria-hidden>→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Next steps + quote */}
      <section className="bg-gradient-to-b from-bw-sand-100 to-bw-sand-200/55 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-bw-navy-900">
              Storytelling, not slogans
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-bw-muted sm:text-base">
              Each lane unpacks comparisons, realistic onboarding clocks, the
              risks we stare at, and FAQs worth forwarding to your CPA or
              counsel—so meetings start mid-conversation, not at chapter one.
            </p>
            <blockquote className="mt-10 border-l-4 border-bw-blue-600 pl-5 text-sm italic leading-relaxed text-bw-navy-800 sm:text-[15px]">
              “We wrote these pages so you never wonder what happens next—just
              calmer decisions and a bank relationship that actually stretches as
              you do.”
            </blockquote>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-bw-muted">
              — {cfg.bankNameShort} digital experience studio
            </p>
          </div>
          <div className="rounded-2xl border border-bw-sand-200 bg-white p-8 shadow-bw-card sm:p-9">
            <h3 className="font-display text-lg font-semibold text-bw-navy-900">
              Start somewhere concrete
            </h3>
            <ul className="mt-6 space-y-5 text-sm">
              {[
                {
                  to: '/personal',
                  title: 'Personal banking hub',
                  sub: 'Money-in / money-out, credit, digital habits, FAQs',
                },
                {
                  to: '/small-business',
                  title: 'Business operators',
                  sub: 'Liquidity, lending, payables, sector snapshots',
                },
                {
                  to: '/wealth',
                  title: 'Wealth & legacy desk',
                  sub: 'Investing posture, private banking, trusts',
                },
                {
                  to: '/sign-up',
                  title: 'Begin enrollment',
                  sub: 'Guided intake with fewer dead ends',
                },
              ].map((item) => (
                <li key={item.to}>
                  <Link
                    className="font-semibold text-bw-blue-600 transition hover:text-bw-blue-500 hover:underline"
                    to={item.to}
                  >
                    {item.title}
                  </Link>
                  <span className="mt-1 block text-xs text-bw-muted">
                    {item.sub}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-bw-navy-900/10 bg-gradient-to-br from-bw-navy-900 via-bw-navy-800 to-bw-blue-600 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='48' height='48' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle fill='%23fff' cx='3' cy='3' r='1.5'/%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-20">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.05rem]">
              Still weighing whether we fit?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
              Book a no-pressure conversation: we map what you need, translate the
              fine print, and lay out sensible next moves—even if now isn’t the
              moment to switch.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={contactHref(cfg)}
              className="inline-flex items-center justify-center rounded-full bg-bw-red-700 px-8 py-3.5 text-sm font-semibold text-white shadow-bw-card ring-1 ring-white/15 transition hover:bg-bw-red-600"
            >
              {cfg.homeCtaTalk}
            </a>
            <Link
              to="/sign-in"
              className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
