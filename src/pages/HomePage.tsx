import { Link } from 'react-router-dom'
import { useBankConfig } from '../contexts/BankConfigContext'
import { resolvePublicMediaUrl } from '../lib/apiBase'

const btnPrimary =
  'inline-flex items-center justify-center rounded-full bg-bw-red-700 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-bw-red-900/20 ring-1 ring-white/15 transition hover:bg-bw-red-600 hover:shadow-lg active:scale-[0.98]'

const btnSecondary =
  'inline-flex items-center justify-center rounded-full border border-white/45 bg-white/12 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/60 hover:bg-white/20'

const btnGhost =
  'inline-flex items-center justify-center rounded-full border border-white/35 bg-transparent px-6 py-3.5 text-sm font-semibold text-white/95 transition hover:bg-white/10'

export function HomePage() {
  const cfg = useBankConfig()

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-bw-navy-950 via-bw-navy-900 to-bw-blue-600 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%23fff' d='M30 0L60 30 30 60 0 30z'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 top-0 h-[28rem] w-[28rem] rounded-full bg-bw-red-600/25 blur-3xl" />
          <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-bw-sky-100/20 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-24">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-bw-sky-100/90">
              {cfg.homeEyebrow}
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.15rem]">
              {cfg.homeHeadline}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/88">
              {cfg.homeSubtext}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/sign-in" className={btnPrimary}>
                Sign in to online banking
              </Link>
              <Link to="/sign-up" className={btnSecondary}>
                Open an account
              </Link>
              <a href="#products" className={btnGhost}>
                Explore products
              </a>
            </div>
            <dl className="mt-12 max-w-md border-t border-white/20 pt-10">
              <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                  Client support
                </dt>
                <dd className="mt-2 text-sm font-medium text-white/92">
                  {cfg.supportHoursLine}
                </dd>
              </div>
            </dl>
          </div>
          <figure className="shadow-bw-glow overflow-hidden rounded-2xl border border-white/20 ring-1 ring-white/10">
            <img
              src={resolvePublicMediaUrl(cfg.homeHeroImageSrc)}
              alt="Clients speaking with a banker in a bright, modern banking lounge."
              className="aspect-[4/3] w-full object-cover lg:aspect-auto lg:max-h-[min(28rem,55vh)] lg:min-h-[18rem]"
              width={1200}
              height={900}
              loading="eager"
              decoding="async"
            />
            <figcaption className="sr-only">
              Illustrative scene for marketing only; not an actual branch,
              staff, or customers of {cfg.bankNameShort}.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="border-b border-bw-sand-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-bw-navy-900 sm:text-[2rem]">
            Why clients choose {cfg.bankNameShort}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-bw-muted">
            We combine the reliability of a full-service institution with tools
            and guidance that respect your time—whether you prefer self-service
            banking or regular conversations with a dedicated team.
          </p>
          <div className="mt-12 grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Advice by segment',
                body: 'Personal, small business, and wealth programs each have distinct products, disclosures, and specialists—so recommendations align with your situation, not a generic script.',
              },
              {
                title: 'Clarity on fees',
                body: 'Rates, wire fees, and account requirements are documented up front. Online banking surfaces key costs before you confirm a transfer or payment.',
              },
              {
                title: 'Security you can see',
                body: 'Multi-factor sign-in options, card controls, transaction alerts, and around-the-clock card and fraud support help you act quickly when something looks off.',
              },
              {
                title: 'Accessible service',
                body: 'Phone, secure message, branch appointments, and extended specialist hours make it straightforward to resolve questions without repeating your story.',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="group relative isolate flex min-h-0 min-w-0 flex-col rounded-2xl border border-bw-sand-200/90 bg-bw-sand-100/40 p-6 shadow-bw-soft transition-transform duration-300 hover:z-[1] hover:-translate-y-0.5 hover:border-bw-blue-500/25 hover:shadow-bw-card"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bw-navy-900 font-display text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-bw-navy-900">
                  {item.title}
                </h3>
                <p className="mt-2 min-w-0 text-sm leading-relaxed text-bw-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="products"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="max-w-3xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-bw-navy-900 sm:text-[2.15rem]">
            Choose how you bank with {cfg.bankNameShort}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-bw-muted">
            Select the path that matches your goals. Each area includes product
            overviews, how onboarding works, security practices, and answers to
            common questions—so you can evaluate options before you speak with
            us.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            {
              title: 'Personal',
              body: 'Checking and savings, debit and credit cards, lending, digital banking, and payments—designed for individuals and families who want straightforward money management.',
              tone: 'from-bw-sky-100/90 via-white to-white',
              to: '/personal',
              cta: 'Explore Personal',
              bullets: [
                'Compare deposit and borrowing options side by side',
                'Step-by-step view of opening an account',
                'Digital banking, privacy, and fraud-prevention highlights',
              ],
            },
            {
              title: 'Small business',
              body: 'Business checking, credit, receivables, treasury controls, and industry-focused guidance for owners who need visibility into cash and growth.',
              tone: 'from-bw-sand-100 via-white to-white',
              to: '/small-business',
              cta: 'Explore Small business',
              bullets: [
                'Checking tiers and lending structures explained',
                'Controls for wires, ACH, and dual approval',
                'Scenarios for cash flow, expansion, and governance',
              ],
            },
            {
              title: 'Wealth',
              body: `${cfg.investBrandName}, private banking, financial planning, trust coordination, and institutional-quality portfolio building blocks for complex balance sheets.`,
              tone: 'from-bw-sky-100/80 via-white to-bw-sand-100/60',
              to: '/wealth',
              cta: 'Explore Wealth',
              bullets: [
                'Relationship tiers and how service deepens over time',
                'Investment philosophy and sample portfolio sleeves',
                'Planning, tax-aware investing, and legacy considerations',
              ],
            },
          ].map((card) => (
            <article
              key={card.title}
              className={`flex flex-col rounded-2xl border border-bw-sand-200/90 bg-gradient-to-br ${card.tone} p-7 shadow-bw-soft transition duration-300 hover:-translate-y-1 hover:border-bw-blue-500/30 hover:shadow-bw-card`}
            >
              <h3 className="font-display text-xl font-semibold text-bw-navy-900">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-bw-muted">
                {card.body}
              </p>
              <ul className="mt-5 space-y-2.5 border-t border-bw-sand-200/80 pt-5 text-xs leading-snug text-bw-navy-900">
                {card.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800"
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
                className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-bw-blue-600 transition hover:gap-2 hover:text-bw-blue-500"
              >
                {card.cta}
                <span aria-hidden>→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-b from-bw-sand-100 to-bw-sand-200/60 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-bw-navy-900">
              Depth on every path
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-bw-muted sm:text-base">
              Our segment pages go beyond headlines: product comparisons,
              timelines for onboarding, risk and security context, and structured
              FAQs. Use them to prepare for a conversation with a banker or
              advisor, or to share with your tax and legal professionals when you
              are evaluating a change.
            </p>
          </div>
          <div className="rounded-2xl border border-bw-sand-200 bg-white p-7 shadow-bw-card sm:p-8">
            <h3 className="font-display text-lg font-semibold text-bw-navy-900">
              Popular next steps
            </h3>
            <ul className="mt-5 space-y-4 text-sm">
              <li>
                <Link
                  className="font-semibold text-bw-blue-600 transition hover:text-bw-blue-500 hover:underline"
                  to="/personal"
                >
                  Personal banking
                </Link>
                <span className="mt-1 block text-xs text-bw-muted">
                  Accounts, borrowing, digital banking, frequently asked
                  questions
                </span>
              </li>
              <li>
                <Link
                  className="font-semibold text-bw-blue-600 transition hover:text-bw-blue-500 hover:underline"
                  to="/small-business"
                >
                  Small business banking
                </Link>
                <span className="mt-1 block text-xs text-bw-muted">
                  Deposits, credit, treasury, industry considerations
                </span>
              </li>
              <li>
                <Link
                  className="font-semibold text-bw-blue-600 transition hover:text-bw-blue-500 hover:underline"
                  to="/wealth"
                >
                  Wealth management
                </Link>
                <span className="mt-1 block text-xs text-bw-muted">
                  Investing, private banking, trust, legacy planning
                </span>
              </li>
              <li>
                <Link
                  className="font-semibold text-bw-blue-600 transition hover:text-bw-blue-500 hover:underline"
                  to="/sign-up"
                >
                  Enroll online
                </Link>
                <span className="mt-1 block text-xs text-bw-muted">
                  Start a new relationship in guided steps
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-bw-sand-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-20">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-bw-navy-900">
              Questions before you open an account?
            </h2>
            <p className="mt-3 text-bw-muted sm:text-base">
              Schedule a confidential conversation with a specialist. We will
              review your goals, answer product questions, and outline next
              steps—without obligation.
            </p>
          </div>
          <a
            href="#"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-bw-navy-900 px-8 py-3.5 text-sm font-semibold text-white shadow-bw-soft ring-1 ring-bw-navy-800 transition hover:bg-bw-navy-800 hover:shadow-bw-card"
          >
            {cfg.homeCtaTalk}
          </a>
        </div>
      </section>
    </>
  )
}
