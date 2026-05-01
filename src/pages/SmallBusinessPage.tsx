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

export function SmallBusinessPage() {
  const cfg = useBankConfig()
  const wireDom = formatCurrency(cfg.fees.wireDomesticCents)

  return (
    <>
      <SegmentHero
        eyebrow="Growing companies"
        headline="Stay inside the business—not inside banking tabs."
        subtext={`Invoice one through valuation chatter, you need cash telemetry, faster settlement, and credit that lands when payroll or inventory refuses to pause. ${cfg.bankNameShort} Business blends operator-grade tooling with an RM who speaks your vertical—so treasury chores shrink and customer minutes expand.`}
        gradientClass="from-bw-navy-900 via-bw-navy-800 to-bw-blue-600"
        stats={[
          { value: '1 RM', label: 'Dedicated contact (typical)' },
          { value: wireDom, label: 'Standard domestic wire (many accounts)' },
          { value: 'Dual', label: 'Approval on high-risk wires' },
          { value: 'API', label: 'Accounting & ERP bank feeds' },
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
        title="When retail banking stops fitting the P&amp;L"
        paragraphs={[
          'Personal apps obsess over one wallet. Your firm juggles operating cash, tax wallets, payroll buoyancy, maybe founder draws—each on its own cadence. We mirror that mess cleanly: sub-ledgers, role-aware users, exports your accountant loves.',
          'Getting paid matters as much as where it sits. Processor pricing, dispute choreography, and funding windows hit the table before ink—not page-six mice type. Borrowing lines hug how you truly operate: seasonal lifts, milestone billing, inventory arcs.',
          'Skim below for checking ladders, credit posture, treasury rails, industries we coach often, and onboarding tempo. Conversation starters only—merchant, treasury, and loan paperwork governs reality.',
        ]}
        footnote={`${cfg.bankName} commercial offerings need underwriting and paperwork. Member FDIC.`}
      />

      <SegmentFeatureGrid
        heading="What operators actually touch"
        intro="Solo desk or third location on the horizon—these levers exist to delete busywork, not add ceremony."
        features={[
          {
            title: 'Business checking',
            body: 'Multiple signers, reserved balances for taxes and payroll, positive pay for checks, and accounting integrations including QuickBooks, Xero, and major ERP export formats.',
            tone: 'from-bw-sand-100 to-white',
            bullets: [
              'Tiered earnings credit on analyzed accounts',
              'ACH batches with templates for recurring vendors',
              'Mobile deposit for checks with higher limits after review',
              'Debit cards with per-employee limits and MCC blocks',
            ],
          },
          {
            title: 'Credit & lending',
            body: 'Lines of credit, equipment term loans, commercial cards, and SBA-guaranteed structures when they fit. Draws, availability, and maturity dates stay visible in online banking.',
            tone: 'from-bw-sky-100 to-white',
            bullets: [
              'Revolver replenishes as principal is repaid',
              'Seasonal payment schedules for retail & hospitality',
              'Landlord lien waiver coordination on construction draws',
              'Annual review with updated financial package upload',
            ],
          },
          {
            title: 'Payments & deposits',
            body: 'In-person, online, and mobile card acceptance; ACH collections; lockbox services where offered; and same-day ACH when cutoff allows.',
            tone: 'from-bw-sky-100 via-white to-bw-sand-100',
            bullets: [
              'Next-day or same-day funding options by plan',
              'Chargeback dashboard with evidence upload',
              'Recurring billing for memberships & subscriptions',
              'Tokenized card-on-file for repeat customers',
            ],
          },
          {
            title: 'Treasury & controls',
            body: 'Balance sweeps to pay down credit, zero-balance accounts for subsidiaries, and dual approval on wires above thresholds you set.',
            tone: 'from-white to-bw-sand-100',
            bullets: [
              'IP allowlisting for finance team sign-in',
              'Segregation of duties: initiator vs approver',
              'Intraday balance alerts to SMS or email',
              'Foreign exchange desk for international receivables (eligible clients)',
            ],
          },
          {
            title: 'Payroll & HR sync',
            body: 'Connect major payroll providers or upload NACHA files. We validate file totals before release and keep an audit trail for quarter-end.',
            tone: 'from-bw-sand-100 to-bw-sky-100',
            bullets: [
              'Tax payment scheduling reminders',
              'Worker classification checklist (contractor vs W-2)',
              'Garnishment routing instructions stored securely',
              '401(k) plan remittance handoff to recordkeeper partners',
            ],
          },
          {
            title: 'Relationship & industry focus',
            body: 'Your RM coordinates credit memos, treasury tweaks, and referrals to merchant specialists. Vertical playbooks cover common pain points.',
            tone: 'from-bw-sky-100 to-white',
            bullets: [
              'Retail: peak-season inventory lines',
              'Professional services: WIP and AR borrowing base',
              'Health: payer delay smoothing',
              'Trades: job-cost cards & per-project subaccounts',
            ],
          },
        ]}
      />

      <SegmentSimpleTable
        title="Business checking tiers (overview)"
        description="Balances, transaction volumes, and cash management needs determine the best fit. We reconcile activity monthly so you are not guessing which tier you are in."
        columns={['Tier', 'Best for', 'Monthly fee', 'Notable features']}
        rows={[
          [
            'Essential',
            'Sole props & side businesses',
            '$0 with min balance',
            '200 free transactions; basic mobile deposit',
          ],
          [
            'Growth',
            'Hiring, steady vendor AP',
            '$22 waivable',
            'ACH batches; 2 debit cards included; earnings credit intro',
          ],
          [
            'Performance',
            'Multi-location & higher volume',
            '$65 analyzed',
            'Positive pay; armored pickup (markets vary); dedicated RM',
          ],
          [
            'Treasury',
            'Complex liquidity & subsidiaries',
            'Custom pricing',
            'ZBA; sweeps; multi-entity reporting package',
          ],
        ]}
        footnote="Transaction counts, waivers, and analyzed pricing depend on activity and agreement. Not an offer."
      />

      <SegmentSimpleTable
        title="Lending snapshot"
        description="Underwriting uses tax returns, interim statements, and sometimes receivables aging. Below are typical structures—not approvals."
        columns={['Product', 'Purpose', 'Typical structure']}
        rows={[
          [
            'Business line of credit',
            'Working capital & AR smoothing',
            '$25k–$500k revolving; annual renewal',
          ],
          [
            'Term loan',
            'Equipment, expansion, refinance',
            '3–10 year amortization; fixed or floating',
          ],
          [
            'Commercial real estate',
            'Owner-occupied or investment',
            'Up to 25-year amortization; LTV per appraisal',
          ],
          [
            'SBA 7(a) style',
            'Acquisition, partner buyout',
            'Guaranty portions as applicable; longer timelines',
          ],
        ]}
        footnote="All loans subject to credit approval. Collateral and guarantees may be required."
      />

      <SegmentTimeline
        title="Onboarding a business relationship"
        intro="Speed depends on entity type and documentation quality. LLCs with clear operating agreements move faster than complex trusts."
        steps={[
          {
            title: 'Discovery & product map',
            body: 'RM reviews cash cycle, payment mix, and debt needs. You leave with a checklist: formation docs, EIN letter, ownership chart, and two years of financials if borrowing.',
          },
          {
            title: 'KYC / KYB verification',
            body: 'Beneficial owners 25%+ are identified per policy. ID verification and OFAC screening run before accounts go live.',
          },
          {
            title: 'Account opening & treasury setup',
            body: 'Checking funded, subaccounts created, user roles assigned. Positive pay and ACH limits configured with dual approval.',
          },
          {
            title: 'Payments activation',
            body: 'Merchant application or ACH company ID established. Test transactions confirm settlement paths before you go live on a Friday payroll.',
          },
          {
            title: 'Ongoing rhythm',
            body: 'Quarterly touchpoints (or monthly during ramp). Annual credit review with updated financials and covenant testing where applicable.',
          },
        ]}
      />

      <SegmentSplitPanels
        eyebrow="Risk & operations"
        title="Controls that scale with you"
        lead="Fraud and errors hurt small businesses disproportionately. We bake in checkpoints without turning every payment into a committee meeting."
        panels={[
          {
            title: 'Payment fraud prevention',
            body: 'ACH debit blocks, callback verification for new wire beneficiaries, and device fingerprinting for users who move money.',
            bullets: [
              'Threshold-based step-up authentication',
              'Beneficiary allowlists with expiry',
              'Check positive pay with exception queue',
              'After-hours wire holds until morning callback',
            ],
          },
          {
            title: 'Reporting for owners & advisors',
            body: 'Monthly PDF packages or live QuickBooks feeds. Custom tags map transactions to departments or jobs for cleaner P&L.',
            bullets: [
              'Multi-user access with view-only accountants',
              'CSV / OFX export for tax season',
              'Loan compliance certificate generation',
              `Consolidated view if you also bank personally with ${cfg.bankNameShort}`,
            ],
          },
        ]}
      />

      <SegmentCheckColumns
        title="Where we often help"
        intro="Common scenarios our bankers and credit teams address—your situation may differ."
        columns={[
          {
            heading: 'Cash flow',
            items: [
              'Smoothing payroll when receivables lag 30–45 days',
              'Inventory builds ahead of holidays or construction season',
              'Bridge financing between project milestones',
              'Consolidating expensive card balances into a term structure',
            ],
          },
          {
            heading: 'Growth',
            items: [
              'Second location build-out and FF&E financing',
              'Hiring ramp with higher benefits deductions',
              'Winning a large contract that strains supplier prepays',
              'Acquiring a competitor’s book of business',
            ],
          },
          {
            heading: 'Governance',
            items: [
              'Adding a new partner and updating signing authority',
              'Separating personal and business expenses cleanly',
              'Preparing for diligence before a minority investment',
              'Succession planning with owner draw discipline',
            ],
          },
        ]}
      />

      <SegmentFaq
        title="Small business FAQ"
        items={[
          {
            q: 'Do I need a separate EIN?',
            a: 'Most LLCs and corporations use an EIN for business accounts. Sole proprietors may use SSN in some cases, but an EIN is still recommended for privacy and payroll.',
          },
          {
            q: 'How fast can I get a line of credit?',
            a: 'Simple renewals can be days; new relationships with borrowing often take several weeks while we verify financials and collateral. Your RM will give a realistic timeline after the first document drop.',
          },
          {
            q: 'Can my bookkeeper initiate wires?',
            a: 'Yes, with role-based permissions. Many businesses require a second approver for wires above a set amount or for new beneficiaries.',
          },
          {
            q: 'What merchant rate will I pay?',
            a: 'Rates depend on card mix, average ticket, and chargeback history. You receive a detailed pricing sheet and contract terms before equipment is deployed.',
          },
          {
            q: 'Do you work with nonprofits?',
            a: 'Yes—treasury, donation processing, and board reporting packages are available. Some fee waivers align with nonprofit status where policy allows.',
          },
          {
            q: 'Where are business fees and limits published?',
            a: 'Your deposit and treasury agreements, merchant schedule of fees, and online banking fee center list current pricing. Your RM can provide a consolidated summary for your board.',
          },
        ]}
      />

      <SegmentCrossLinks
        items={[
          {
            label: 'Personal',
            to: '/personal',
            description:
              'Household deposits, plastic, installment debt, and digital rituals.',
          },
          {
            label: 'Wealth',
            to: '/wealth',
            description:
              'When surplus cash graduates from the operating account.',
          },
          {
            label: 'Home',
            to: '/',
            description: `The panorama of ${cfg.bankNameShort} lanes and proof points.`,
          },
        ]}
      />

      <SegmentBottomCta cfg={cfg} />
    </>
  )
}
