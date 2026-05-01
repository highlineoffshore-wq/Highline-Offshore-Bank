import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { BankConfig } from '../../types/bankConfig'

const heroShell =
  'relative overflow-hidden bg-gradient-to-br text-white'

type Stat = { value: string; label: string }

type HeroProps = {
  eyebrow: string
  headline: string
  subtext: string
  gradientClass: string
  stats?: Stat[]
  children?: ReactNode
}

export function SegmentHero({
  eyebrow,
  headline,
  subtext,
  gradientClass,
  stats,
  children,
}: HeroProps) {
  return (
    <section className={`${heroShell} ${gradientClass}`}>
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-white blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-bw-sky-100 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {headline}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-white/85">{subtext}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/sign-up"
            className="inline-flex items-center justify-center rounded-md bg-bw-red-700 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-bw-red-600"
          >
            Start an application
          </Link>
          <Link
            to="/sign-in"
            className="inline-flex items-center justify-center rounded-md border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Sign in
          </Link>
        </div>
        {stats && stats.length > 0 ? (
          <dl className="mt-12 grid gap-8 border-t border-white/20 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-sm font-medium text-white/70">{s.label}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {children}
      </div>
    </section>
  )
}

export type SegmentFeature = {
  title: string
  body: string
  tone: string
  bullets?: string[]
}

export function SegmentFeatureGrid({
  heading,
  intro,
  features,
}: {
  heading: string
  intro: string
  features: SegmentFeature[]
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div className="max-w-2xl">
        <h2 className="font-display text-3xl font-semibold text-bw-navy-900">
          {heading}
        </h2>
        <p className="mt-3 text-bw-muted">{intro}</p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((card) => (
          <article
            key={card.title}
            className={`flex flex-col rounded-xl border border-bw-sand-200 bg-gradient-to-br ${card.tone} p-6 shadow-sm`}
          >
            <h3 className="font-display text-xl font-semibold text-bw-navy-900">
              {card.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-bw-muted">
              {card.body}
            </p>
            {card.bullets && card.bullets.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-bw-sand-200/80 pt-4 text-sm text-bw-navy-900">
                {card.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-0.5 shrink-0 font-semibold text-bw-blue-600">
                      ✓
                    </span>
                    <span className="text-bw-muted">{b}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

export function SegmentProseBand({
  title,
  paragraphs,
  footnote,
}: {
  title: string
  paragraphs: string[]
  footnote?: string
}) {
  return (
    <section className="border-y border-bw-sand-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="font-display text-3xl font-semibold text-bw-navy-900">
          {title}
        </h2>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-bw-muted">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {footnote ? (
          <p className="mt-6 text-xs leading-relaxed text-bw-muted">{footnote}</p>
        ) : null}
      </div>
    </section>
  )
}

export function SegmentSplitPanels({
  eyebrow,
  title,
  lead,
  panels,
}: {
  eyebrow?: string
  title: string
  lead: string
  panels: { title: string; body: string; bullets?: string[] }[]
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-sm font-semibold uppercase tracking-wider text-bw-blue-600">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 font-display text-3xl font-semibold text-bw-navy-900">
          {title}
        </h2>
        <p className="mt-3 text-bw-muted">{lead}</p>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {panels.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-bw-sand-200 bg-bw-sand-100 p-6 sm:p-8"
          >
            <h3 className="font-display text-xl font-semibold text-bw-navy-900">
              {p.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-bw-muted">
              {p.body}
            </p>
            {p.bullets ? (
              <ul className="mt-4 space-y-2 text-sm text-bw-navy-900">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-bw-blue-600">·</span>
                    <span className="text-bw-muted">{b}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

export function SegmentSimpleTable({
  title,
  description,
  columns,
  rows,
  footnote,
}: {
  title: string
  description?: string
  columns: string[]
  rows: string[][]
  footnote?: string
}) {
  return (
    <section className="bg-bw-sand-100 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display text-3xl font-semibold text-bw-navy-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 max-w-3xl text-bw-muted">{description}</p>
        ) : null}
        <div className="mt-8 overflow-x-auto rounded-xl border border-bw-sand-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-bw-sand-200 bg-bw-sand-100">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="whitespace-nowrap px-4 py-3 font-semibold text-bw-navy-900 first:pl-5 last:pr-5"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-bw-sand-100 last:border-0"
                >
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="px-4 py-3 text-bw-muted first:pl-5 last:pr-5 first:font-medium first:text-bw-navy-900"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {footnote ? (
          <p className="mt-4 text-xs leading-relaxed text-bw-muted">{footnote}</p>
        ) : null}
      </div>
    </section>
  )
}

export function SegmentTimeline({
  title,
  intro,
  steps,
}: {
  title: string
  intro?: string
  steps: { title: string; body: string }[]
}) {
  return (
    <section className="mx-auto max-w-6xl min-w-0 px-4 py-16 sm:py-20">
      <div className="max-w-2xl">
        <h2 className="font-display text-3xl font-semibold text-bw-navy-900">
          {title}
        </h2>
        {intro ? <p className="mt-3 text-bw-muted">{intro}</p> : null}
      </div>
      <ol className="mt-10 flex min-w-0 list-none flex-col gap-10">
        {steps.map((step, i) => (
          <li key={step.title} className="flex min-w-0 gap-4 sm:gap-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bw-navy-900 font-display text-sm font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="font-display text-lg font-semibold text-bw-navy-900">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-bw-muted">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function SegmentCheckColumns({
  title,
  intro,
  columns,
}: {
  title: string
  intro?: string
  columns: { heading: string; items: string[] }[]
}) {
  return (
    <section className="border-y border-bw-sand-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display text-3xl font-semibold text-bw-navy-900">
          {title}
        </h2>
        {intro ? <p className="mt-3 max-w-3xl text-bw-muted">{intro}</p> : null}
        <div className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="font-display text-lg font-semibold text-bw-navy-900">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-bw-muted">
                {col.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span
                      className="mt-0.5 shrink-0 text-bw-blue-600"
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SegmentFaq({
  title,
  items,
}: {
  title: string
  items: { q: string; a: string }[]
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <h2 className="font-display text-3xl font-semibold text-bw-navy-900">
        {title}
      </h2>
      <p className="mt-3 text-sm text-bw-muted">
        General information only—not legal, tax, or investment advice for your
        specific situation.
      </p>
      <div className="mt-8 space-y-3">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-bw-sand-200 bg-bw-sand-100 px-4 py-3 open:bg-white open:shadow-sm"
          >
            <summary className="cursor-pointer list-none font-medium text-bw-navy-900 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                {item.q}
                <span className="text-bw-muted transition group-open:rotate-180">
                  ▼
                </span>
              </span>
            </summary>
            <p className="mt-3 border-t border-bw-sand-200 pt-3 text-sm leading-relaxed text-bw-muted">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function SegmentCrossLinks({
  items,
}: {
  items: { label: string; to: string; description: string }[]
}) {
  return (
    <section className="border-y border-bw-sand-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-display text-xl font-semibold text-bw-navy-900">
          Other paths through our house
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="block rounded-xl border border-bw-sand-200 bg-bw-sand-100 p-5 transition hover:border-bw-blue-500/40 hover:bg-white hover:shadow-sm"
              >
                <span className="font-display text-lg font-semibold text-bw-navy-900">
                  {item.label}
                </span>
                <p className="mt-1 text-sm text-bw-muted">{item.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function SegmentBottomCta({ cfg }: { cfg: BankConfig }) {
  return (
    <section className="border-t border-bw-sand-200 bg-bw-sand-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-bw-navy-900">
            Want the human version?
          </h2>
          <p className="mt-2 text-bw-muted">
            A teammate can translate jargon, pressure-test assumptions, and sketch
            sensible moves—even if you are only collecting intel today.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-bw-navy-900 px-6 py-3 text-sm font-semibold text-white">
          {cfg.homeCtaTalk}
        </span>
      </div>
    </section>
  )
}
