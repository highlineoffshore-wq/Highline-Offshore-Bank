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

export function WealthPage() {
  const cfg = useBankConfig()

  return (
    <>
      <SegmentHero
        eyebrow="Balance-sheet life"
        headline="Compound, shelter, and hand it forward—deliberately."
        subtext={`“Wealth” is less a SKU than choreography: market exposure, tax-framed planning, opportunistic credit, trust execution, and family dialogues people follow. ${cfg.bankNameShort} Wealth lines up advisors, strategists, and private bankers on one play sheet—no musical-chair handoffs.`}
        gradientClass="from-bw-navy-950 via-bw-navy-900 to-bw-blue-600"
        stats={[
          { value: '$1M+', label: 'Typical private tier threshold' },
          { value: 'CFP®', label: '& CFA® charterholders on model teams' },
          { value: 'Annual', label: 'Plan refresh cadence' },
          { value: 'Family', label: 'Multi-generational meeting support' },
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
        title="One narrative across siloed statements"
        paragraphs={[
          `Most families land with assets flung about: a vestigial 401(k), a brokerage opened the year the bonus hit, rent-bearing real estate, and ${cfg.products.savingsName.toLowerCase()} parked at ${cfg.bankNameShort}. First we draw the map—what you own, where risk piles, and whether cash buffers cover spend plus tax reality.`,
          `Next we map capital to horizon—tuition in eight years, financial independence in two decades, giving that never really stops. ${cfg.investBrandName} supplies model architecture and tax-aware trading habits; your lead talks trade-offs in cash flows and stress tests, not just pie pieces.`,
          'Trust + estate partners align titling, beneficiary language, and distribution cadence with intent. Business sales, separations, windfalls? We refresh the whole canvas, not the one account that moved.',
        ]}
        footnote="Markets involve risk, including loss of principal. Advisory and brokerage relationships run through agreements that spell out costs, conflicts, and regulations. Not every vehicle suits every client."
      />

      <SegmentFeatureGrid
        heading={`${cfg.investBrandName} on the larger wealth stage`}
        intro="From a starter brokerage account to a single-stock overhang, we add sophistication with paperwork you can read—not buzzwords to duck."
        features={[
          {
            title: 'Guided & strategic investing',
            body: `Core/satellite portfolios, ESG tilts, and tax-managed equity in taxable accounts. ${cfg.investBrandName} publishes drift bands and rebalance triggers you can see in advance.`,
            tone: 'from-bw-sky-100 to-white',
            bullets: [
              `Funds such as ${cfg.products.fundTotalMarket} & ${cfg.products.fundCoreBond} in model sleeves`,
              'Direct indexing where share counts justify customization',
              'Concentrated position rules: 10b5-1 plans, collars (where permitted)',
              `Cash sweep into ${cfg.products.fundCashSweep} between trades`,
            ],
          },
          {
            title: 'Private banking & credit',
            body: 'Structured lending against marketable securities, residential mortgages with relationship pricing, and custom lines for liquidity events without forced asset sales.',
            tone: 'from-bw-sand-100 to-white',
            bullets: [
              'Advance rate schedules tied to eligible collateral',
              'Interest-only periods aligned to bonus or exit timing',
              'Priority service channels for qualifying relationships',
              'Concierge bill pay and signature authorization paths',
            ],
          },
          {
            title: 'Financial planning',
            body: 'Monte Carlo retirement probability, education funding, insurance gap analysis, and Social Security claiming strategies. Plans link to actual balances via secure aggregation.',
            tone: 'from-bw-sky-100 via-white to-bw-sand-100',
            bullets: [
              'Roth conversion “what-if” with bracket stacking view',
              'Required minimum distribution forecasts and QCD tracking',
              'Long-term care funding options comparison',
              'Stock option exercise modeling (ISO/NSO)',
            ],
          },
          {
            title: 'Trust & estate coordination',
            body: 'Corporate trust officer works with your attorney on drafting reviews, while we administer accounts and distributions per governing documents.',
            tone: 'from-white to-bw-sky-100',
            bullets: [
              'Irrevocable life insurance trust (ILIT) premium reminders',
              'Special needs trust payment guardrails',
              'Crummey notices and gift tax recordkeeping',
              'Testamentary trust investment policy statements',
            ],
          },
          {
            title: 'Alternatives & private markets',
            body: 'For qualified investors, curated feeder funds, secondaries, and real asset sleeves with liquidity terms clearly documented before you commit.',
            tone: 'from-bw-sand-100 to-bw-sky-100',
            bullets: [
              'Minimums, lockups, and capital call schedules in one dashboard',
              'Vintage year diversification guidance',
              'Private credit sleeves with floating-rate emphasis where appropriate',
              'Quarterly capital account statements normalized across sponsors',
            ],
          },
          {
            title: 'Family dynamics & philanthropy',
            body: 'Facilitated conversations with heirs, donor-advised funds, and impact reporting when values matter as much as returns.',
            tone: 'from-bw-sky-100 to-bw-sand-100',
            bullets: [
              'Next-gen education modules (ages 18–30)',
              'Family governance charters and mission statements',
              'DAF grant recommendations with charity due diligence',
              'Split-interest trust illustrations with CPA review',
            ],
          },
        ]}
      />

      <SegmentSimpleTable
        title="Relationship tiers (overview)"
        description="Minimums and services vary by market and regulation. Your proposal letter lists everything that applies to you."
        columns={['Tier', 'Who it fits', 'What you get']}
        rows={[
          [
            'Guided wealth',
            'Accumulating investors',
            `${cfg.investBrandName} models, annual plan, digital meetings`,
          ],
          [
            'Partner',
            'Complex cash flow & equity comp',
            'Dedicated advisor, tax-aware trading, lending specialist intro',
          ],
          [
            'Private',
            'Significant balance sheet complexity',
            'Private banker, trust admin, alternatives access (qualified)',
          ],
          [
            'Family office lite',
            'Multi-entity & multi-gen',
            'Consolidated reporting, CFO-style cash forecasts, project RM',
          ],
        ]}
        footnote="Not all services available to all clients. Qualification, agreements, and disclosures apply."
      />

      <SegmentSimpleTable
        title="Investment building blocks (sample)"
        description="Actual allocations are personalized. This table shows how sleeves might combine in a balanced growth profile."
        columns={['Sleeve', 'Role in portfolio', 'Example vehicles']}
        rows={[
          [
            'Global equity',
            'Long-term growth',
            `${cfg.products.fundTotalMarket}, international developed & emerging markets`,
          ],
          [
            'Fixed income',
            'Stability & income',
            `${cfg.products.fundCoreBond}, munis if tax-bracket fit`,
          ],
          [
            'Real assets',
            'Inflation sensitivity',
            'REITs, infrastructure, commodities (tactical)',
          ],
          [
            'Liquidity',
            'Spending & opportunities',
            `${cfg.products.fundCashSweep}, government money market funds`,
          ],
        ]}
        footnote="Past performance does not guarantee future results. Diversification does not ensure profit or protect against loss."
      />

      <SegmentTimeline
        title="How a wealth relationship typically starts"
        intro="Some clients begin after a liquidity event; others gradually deepen from personal banking. Both paths use the same discovery depth."
        steps={[
          {
            title: 'Discovery & goals inventory',
            body: 'We document balance sheet, cash needs, risk tolerance, and constraints (employer stock, ESG preferences, legacy wishes). You upload statements or grant secure link access.',
          },
          {
            title: 'Investment policy statement (IPS)',
            body: 'Targets, ranges, and rebalance rules are written down. Tax location of assets (IRA vs taxable) is decided up front when possible.',
          },
          {
            title: 'Implementation & transfer',
            body: 'ACAT transfers, 401(k) rollover analysis, and careful cost-basis review. We avoid unnecessary taxable events during moves.',
          },
          {
            title: 'Ongoing stewardship',
            body: 'Quarterly check-ins or calmer annual deep dives depending on complexity. Proactive calls around tax law changes, not just market headlines.',
          },
          {
            title: 'Life-event recalibration',
            body: 'Marriage, birth, sale of business, death—each triggers an IPS and estate document review within weeks, not quarters.',
          },
        ]}
      />

      <SegmentSplitPanels
        eyebrow="Taxes, risk, and legacy"
        title="Decisions that cross disciplines"
        lead="Your advisor loops in tax and legal partners with your permission—so recommendations do not collide."
        panels={[
          {
            title: 'Tax-aware investing',
            body: 'Asset location, lot selection on withdrawals, and municipal vs taxable fixed income based on your marginal bracket and state of residence.',
            bullets: [
              'Harvest losses without violating wash-sale rules',
              'Qualified charitable distributions after RMD age',
              'NUA considerations for employer stock in retirement plans',
              'Estimated tax vouchers when realizing large gains',
            ],
          },
          {
            title: 'Risk beyond the portfolio',
            body: 'Concentration in employer stock, private business value, and real estate can dominate risk even when the public portfolio looks balanced.',
            bullets: [
              'Hedging and staged diversification playbooks',
              'Insurance sufficiency: life, disability, umbrella',
              'Longevity risk and healthcare cost stress tests',
              'Contingent beneficiaries and per stirpes elections reviewed yearly',
            ],
          },
        ]}
      />

      <SegmentCheckColumns
        title="Documents worth having ready"
        intro="Not all at once—but gathering early speeds up your first plan draft."
        columns={[
          {
            heading: 'Financial',
            items: [
              'Two years of tax returns (personal & business if blended)',
              'Recent pay stubs or K-1s',
              'Statements for all investment and retirement accounts',
              'Debt schedules with rates, maturity, and covenants',
            ],
          },
          {
            heading: 'Legal / estate',
            items: [
              'Will, trust, and power of attorney (latest executed copies)',
              'Prenuptial or postnuptial agreements if they affect planning',
              'Shareholder or operating agreements for private business',
              'Charitable pledge letters or DAF adoption agreements',
            ],
          },
          {
            heading: 'Insurance',
            items: [
              'In-force illustrations for permanent life policies',
              'Property & casualty declarations pages',
              'Long-term care policy benefits and elimination periods',
              'Title policies for significant real estate',
            ],
          },
        ]}
      />

      <SegmentFaq
        title="Wealth FAQ"
        items={[
          {
            q: `What is the minimum to work with ${cfg.bankNameShort} Wealth?`,
            a: 'Minimums depend on program, market, and regulatory classification. Your relationship manager explains thresholds, services, and documentation requirements before you share sensitive information.',
          },
          {
            q: 'Are you a fiduciary?',
            a: 'In advisory relationships we typically act as fiduciary when managing discretionary assets; brokerage-only transactions may differ. The advisory agreement spells out the standard that applies to each account.',
          },
          {
            q: 'How do fees work?',
            a: 'Advisory fees are often a percentage of assets under management, billed quarterly in arrears. Planning projects may have a flat fee. Commissions may still apply on certain insurance or brokerage products—your schedule discloses each.',
          },
          {
            q: 'Can you work with my CPA and attorney?',
            a: 'Yes, with your written consent. We share meeting notes and action items so everyone operates from the same assumptions.',
          },
          {
            q: 'What about international assets?',
            a: 'Reporting requirements (FBAR, FATCA) and cross-border tax treaties matter. We coordinate with specialists when you have accounts or property abroad.',
          },
          {
            q: 'Where can I read regulatory disclosures?',
            a: 'Form CRS, advisory agreements, fund prospectuses, and privacy notices are available before you invest. Your advisor can walk through each document and answer questions.',
          },
        ]}
      />

      <SegmentCrossLinks
        items={[
          {
            label: 'Personal',
            to: '/personal',
            description:
              'Day-to-day banking before the balance sheet gets orchestral.',
          },
          {
            label: 'Small business',
            to: '/small-business',
            description:
              'Harvest enterprise value without starving operating fuel.',
          },
          {
            label: 'Home',
            to: '/',
            description: `Where ${cfg.bankNameShort} introduces every storyline.`,
          },
        ]}
      />

      <SegmentBottomCta cfg={cfg} />
    </>
  )
}
