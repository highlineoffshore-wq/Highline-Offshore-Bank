import { Link } from 'react-router-dom'
import {
  SegmentBottomCta,
  SegmentCheckColumns,
  SegmentCrossLinks,
  SegmentFaq,
  SegmentFeatureGrid,
  SegmentHero,
  SegmentProseBand,
  SegmentSimpleTable,
  SegmentSplitPanels,
  SegmentTimeline,
} from '../components/segment/SegmentSections'
import { useBankConfig } from '../contexts/BankConfigContext'
import { formatCurrency } from '../lib/money'

export function PersonalPage() {
  const cfg = useBankConfig()
  const wireDom = formatCurrency(cfg.fees.wireDomesticCents)
  const wireIntl = formatCurrency(cfg.fees.wireInternationalCents)

  return (
    <>
      <SegmentHero
        eyebrow="Individual banking"
        headline="Cash flow without the clutter."
        subtext="Route paychecks, choreograph borrowing, and stack goals behind one login—rates articulated where you tap, and humans who recall why you consolidated after a move or refinanced during a hectic spring."
        gradientClass="from-bw-navy-900 via-bw-navy-800 to-bw-blue-600"
        stats={[
          { value: '8am–10pm ET', label: 'Specialist support hours' },
          { value: '24/7', label: 'Card & fraud line' },
          { value: '$0', label: 'Monthly fee on select checking tiers' },
          { value: 'Same day', label: 'Internal transfers (typical)' },
        ]}
      >
        <p className="mt-10 text-sm text-white/70">
          <Link
            className="font-medium text-white underline-offset-4 hover:underline"
            to="/"
          >
            ← Return home
          </Link>
        </p>
      </SegmentHero>

      <SegmentProseBand
        title="Built around households—not glossy brochures"
        paragraphs={[
          `Few mornings begin with “what’s my APY?” Most begin with tuition, rent hikes, or finally booking that renovation. ${cfg.bankNameShort} Personal mirrors those beats—cash landing, cash leaving, cushions stashed, long bets funded.`,
          'Single credentials stitch checking, savings, plastic, and installment debt together; you decide who else sees what. Alerts fan out on razor-thin balances, chunky purchases, or inbound ACH so drama stays rare. Odd charge? Freeze the plastic, challenge from the ledger, or ping a banker who already skimmed your notes.',
          'What follows unpacks accounts, credit, digital habits, and onboarding cadence. Anything here is orientation—the Truth in Savings packet, loan agreements, and fee schedules you sign still win.',
        ]}
        footnote={`${cfg.bankName} is Member FDIC. Insurance caps apply. Credit decisions hinge on underwriting.`}
      />

      <SegmentFeatureGrid
        heading={`Inside ${cfg.bankNameShort} Personal`}
        intro="From debut paycheck to “we’re finally remodeling,” the fundamentals stay legible—dig deeper only when curiosity kicks in."
        features={[
          {
            title: 'Checking & savings',
            body: `Choose accounts that fit your rhythm—including ${cfg.products.checkingName} and ${cfg.products.savingsName}. Tiered balance options, overdraft choices, and automatic savings rules help you stay on track without micromanaging.`,
            tone: 'from-bw-sky-100 to-white',
            bullets: [
              `Early direct deposit on ${cfg.products.checkingName} (where eligible)`,
              'Round-up transfers to savings',
              'No-fee inbound ACH; outbound limits shown before confirm',
              'Joint and individual registration paths',
            ],
          },
          {
            title: 'Cards & controls',
            body: 'Debit and credit options with instant lock, spend alerts, merchant-level controls, and travel notices from your phone. Replacement cards can be expedited in many markets where courier service is available.',
            tone: 'from-bw-sand-100 to-white',
            bullets: [
              'Tap-to-pay and digital wallet provisioning',
              'Per-card daily limits and ATM preferences',
              'Cash-back categories you can change each quarter (credit)',
              'Itemized yearly summaries for taxes',
            ],
          },
          {
            title: 'Borrow with clarity',
            body: 'Credit cards, personal loans, auto, and home lending with one place to track balances, amortization, and payoff scenarios. Rate quotes show assumptions in plain language.',
            tone: 'from-bw-sky-100 via-white to-bw-sand-100',
            bullets: [
              'Pre-qualification that does not hard-pull until you proceed',
              'Extra principal payments on loans without phone calls',
              'Home equity line draw schedules and fixed-rate options',
              'Refinance calculators with break-even timing',
            ],
          },
          {
            title: 'Pay & move money',
            body: `Bill pay, person-to-person transfers, and domestic wires with cutoffs and fees shown up front. International wires include disclosure of correspondent and beneficiary fees when applicable; many retail clients see a standard international wire fee of ${wireIntl}.`,
            tone: 'from-white to-bw-sky-100',
            bullets: [
              `Domestic wire fee for qualifying accounts: ${wireDom} (see your fee schedule)`,
              'Recurring payments and e-bills in one queue',
              'Payment history export (CSV) for budgeting apps',
              'Dual confirmation optional for wires above a threshold',
            ],
          },
          {
            title: 'Goals & insights',
            body: 'Savings buckets, cash-flow snapshots, subscription detection, and gentle nudges so you can plan without a spreadsheet habit. Retirement and education projections tie to your funding pattern—not generic benchmarks.',
            tone: 'from-bw-sand-100 to-bw-sky-100',
            bullets: [
              'Goal deadlines with suggested weekly transfers',
              '“Safe to spend” estimate after bills and savings',
              'Spending by category with merchant roll-ups',
              'Year-over-year comparison for irregular income',
            ],
          },
          {
            title: 'Support on your terms',
            body: `Chat, secure message, phone, and branch options—plus 24/7 help for lost cards and fraud. During business hours, many clients reach a specialist in just a few minutes.`,
            tone: 'from-bw-sky-100 to-bw-sand-100',
            bullets: [
              `Call ${cfg.supportPhone} for general service`,
              `Report fraud: ${cfg.supportPhoneFraud}`,
              'Co-browse available for complex troubleshooting',
              'Appointment scheduling for mortgage and trust handoffs',
            ],
          },
        ]}
      />

      <SegmentSimpleTable
        title="Personal deposit accounts at a glance"
        description="Representative structure; current rates, APYs, and fee schedules are provided in official disclosures and in online banking before you open or change an account."
        columns={['Account', 'Best for', 'Monthly fee', 'Highlights']}
        rows={[
          [
            cfg.products.checkingName,
            'Daily spending & direct deposit',
            '$0 with qualifying activity',
            'Early pay, nationwide ATM access where eligible, overdraft choices',
          ],
          [
            cfg.products.savingsName,
            'Emergency fund & goals',
            '$0 above minimum balance',
            'Competitive APY tier, automatic transfers, joint ownership',
          ],
          [
            `${cfg.bankNameShort} Money Market`,
            'Higher balances & check access',
            '$12 waivable',
            'Tiered APY, limited check writing, FDIC insurance within limits',
          ],
          [
            'Certificates (CDs)',
            'Locked rate for a set term',
            'No monthly fee',
            'Terms from 3 months to 5 years; early withdrawal penalties apply',
          ],
        ]}
        footnote="APYs and fees are subject to change. This overview is not an offer or account agreement."
      />

      <SegmentSimpleTable
        title="Borrowing products (overview)"
        description="Typical ranges; credit approval, collateral, and applicable law determine what you qualify for."
        columns={['Product', 'Typical use', 'Terms & notes']}
        rows={[
          [
            'Credit cards',
            'Revolving spend & rewards',
            'APR varies with credit; balance transfer promos may apply',
          ],
          [
            'Personal loans',
            'Consolidation, major purchase',
            '$3k–$50k typical; fixed rate; 12–84 months',
          ],
          [
            'Auto loans',
            'New & used vehicles',
            'Dealer & private-party paths; GAP optional',
          ],
          [
            'Mortgages & HELOC',
            'Purchase, refi, equity access',
            'Fixed & ARM; closing cost estimator in application',
          ],
        ]}
        footnote="Not a commitment to lend. All loans subject to credit approval and documentation."
      />

      <SegmentTimeline
        title="How opening an account usually works"
        intro="Exact steps vary by product and verification method; this is the happy path many customers see."
        steps={[
          {
            title: 'Choose products & preferences',
            body: 'Pick checking, savings, or a bundle. Set overdraft preference, debit card design, and optional paperless defaults.',
          },
          {
            title: 'Verify identity securely',
            body: 'Government ID scan, knowledge-based questions, or in-branch verification. Minor accounts require guardian co-registration.',
          },
          {
            title: 'Fund your account',
            body: `Link an external bank for micro-deposit or instant verification where supported, or fund later from another ${cfg.bankNameShort} account.`,
          },
          {
            title: 'Activate digital banking',
            body: 'Create username, password, and optional email OTP. Enroll in alerts and connect Apple Pay / Google Pay.',
          },
          {
            title: 'Receive materials',
            body: 'Debit card mailed in 5–7 business days (typical); temporary digital card for immediate use where available.',
          },
        ]}
      />

      <SegmentSplitPanels
        eyebrow="Digital & security"
        title="Stay in control on every device"
        lead="The same protections you expect from a major bank—without burying the levers three menus deep."
        panels={[
          {
            title: 'Mobile & web features',
            body: 'Fingerprint and face unlock, session timeout controls, and device management so you can revoke access from an old phone in seconds.',
            bullets: [
              'Mobile check deposit with on-screen limits',
              'Card on/off and location-aware fraud scoring',
              'Downloadable statements for the retention period we maintain',
              'Dark mode and larger text for accessibility',
            ],
          },
          {
            title: 'Privacy & fraud prevention',
            body: 'Encryption in transit and at rest, continuous login monitoring, and optional verbal password for high-risk phone requests.',
            bullets: [
              'Email OTP for sign-in when you turn it on in Settings',
              'Push alerts for password or contact info changes',
              'Zero liability on unauthorized card charges (terms apply)',
              'Dedicated fraud line printed on cards and in the app',
            ],
          },
        ]}
      />

      <SegmentCheckColumns
        title="Included with most personal relationships"
        intro="Exact bundles depend on account type; this lists capabilities commonly included with online and mobile banking."
        columns={[
          {
            heading: 'Money movement',
            items: [
              'Internal transfers in real time between your accounts',
              'Scheduled bill pay to payees you add once',
              'Person-to-person with daily send limits shown up front',
              'Wire templates for repeat domestic recipients',
            ],
          },
          {
            heading: 'Visibility',
            items: [
              'Searchable transaction history with notes and tags',
              'Balance alerts by text, email, or push',
              'Cash-flow calendar for known bills',
              'Tax organizer export for interest and mortgage interest',
            ],
          },
          {
            heading: 'Life events',
            items: [
              'Name change checklist with document upload',
              'Address update propagated to cards and statements',
              'Power-of-attorney registration workflow (guided)',
              'Death notification intake with estate specialist routing',
            ],
          },
        ]}
      />

      <SegmentFaq
        title="Personal banking FAQ"
        items={[
          {
            q: 'Do I need both checking and savings?',
            a: 'No—you can open either product alone. Many customers pair them so automatic savings rules move a set amount after each paycheck without thinking about it.',
          },
          {
            q: 'How quickly does direct deposit arrive?',
            a: 'With early direct deposit, funds may arrive up to two days before the stated pay date when your employer submits payroll early. Timing depends on the payer and is not guaranteed.',
          },
          {
            q: 'Can I add someone to my account later?',
            a: 'Yes. Joint owners can be added with updated agreements and identity verification. Some products restrict joint ownership until the primary account has been open for a short period.',
          },
          {
            q: 'What if I travel internationally?',
            a: 'Set a travel notice in the app or call us so card activity abroad is expected. Carry a backup payment method and know your daily ATM withdrawal limits.',
          },
          {
            q: 'How do wire cutoffs work?',
            a: 'Domestic wires submitted before the published cutoff (often 4 PM ET on business days) typically leave the same day. After cutoff, they process the next business day. Fees and limits display before you confirm.',
          },
          {
            q: 'Where can I find current rates and fees?',
            a: 'Visit a branch, call the number on your statement, or review the Rates & Fees section in online banking. Your welcome package and periodic updates also list changes that affect your accounts.',
          },
        ]}
      />

      <SegmentCrossLinks
        items={[
          {
            label: 'Small business',
            to: '/small-business',
            description:
              'Liquidity rails, credit posture, and treasury muscle for scaling crews.',
          },
          {
            label: 'Wealth',
            to: '/wealth',
            description:
              'Investments, scenario planning, and private banking under one roof.',
          },
          {
            label: 'Home',
            to: '/',
            description: `The full ${cfg.bankNameShort} map—segments, stories, entry points.`,
          },
        ]}
      />

      <SegmentBottomCta cfg={cfg} />
    </>
  )
}
