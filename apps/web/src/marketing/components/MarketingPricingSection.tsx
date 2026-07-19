import clsx from 'clsx'
import { pricingPlans } from '../data/marketingContent'
import {
  billingSummary,
  planBadge,
  planFeatureList,
  planName,
  planPrice,
  pricingCard,
  pricingCardFeatured,
  pricingCta,
  pricingGrid,
  primaryLink,
  secondaryLink,
  section,
  sectionAlt,
  sectionCopy,
  sectionHeader,
  sectionLabel,
  sectionTitle
} from '../marketing.css'
import { MarketingRouteLink } from './MarketingLinks'

export function MarketingPricingSection() {
  return (
    <section id='pricing' className={clsx(section, sectionAlt)} aria-labelledby='pricing-title'>
      <div className={sectionHeader} data-marketing-scroll-target='pricing'>
        <p className={sectionLabel}>Pricing</p>
        <h2 id='pricing-title' className={sectionTitle}>
          Start free, upgrade when your table needs more room to grow.
        </h2>
      </div>

      <p className={billingSummary}>Monthly plans shown. Annual billing saves 20%.</p>

      <div className={pricingGrid}>
        {pricingPlans.map((plan) => (
          <article
            key={plan.name}
            className={clsx(pricingCard, plan.featured && pricingCardFeatured)}
          >
            {plan.featured ? <span className={planBadge}>Most popular</span> : null}
            <p className={planName}>{plan.name}</p>
            <p className={planPrice}>{plan.price}</p>
            <p className={sectionCopy}>{plan.cadence}</p>
            <p className={sectionCopy}>{plan.description}</p>
            <ul className={planFeatureList}>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span aria-hidden='true'>+</span>
                  {feature}
                </li>
              ))}
            </ul>
            <MarketingRouteLink
              className={clsx(plan.featured ? primaryLink : secondaryLink, pricingCta)}
              to={plan.href}
            >
              {plan.cta}
            </MarketingRouteLink>
          </article>
        ))}
      </div>
    </section>
  )
}
