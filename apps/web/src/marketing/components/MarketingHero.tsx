import {
  ctaRow,
  heroContent,
  heroCopy,
  heroHighlightCard,
  heroHighlightCopy,
  heroHighlightGrid,
  heroHighlightLabel,
  heroSection,
  heroTitle,
  primaryLink,
  secondaryLink
} from '../marketing.css'
import { marketingHeroHighlights } from '../data/marketingContent'
import { AppMockup } from './AppMockup'
import { MarketingHashLink, MarketingRouteLink } from './MarketingLinks'

interface MarketingHeroProps {
  publicSignUpEnabled?: boolean
  showPricingLink?: boolean
}

export function MarketingHero({
  publicSignUpEnabled = false,
  showPricingLink = true
}: MarketingHeroProps) {
  return (
    <section className={heroSection} aria-labelledby='marketing-hero-title'>
      <div className={heroContent}>
        <h1 id='marketing-hero-title' className={heroTitle}>
          Build characters and homebrew you can use at the table.
        </h1>
        <p className={heroCopy}>
          Create spells, classes, creatures, equipment, and more. Use that content in Character
          Builder, then play from the Character Sheet.
        </p>
        <div className={ctaRow}>
          {publicSignUpEnabled ? (
            <MarketingRouteLink className={primaryLink} to='/sign-up'>
              Create free account
            </MarketingRouteLink>
          ) : null}
          {showPricingLink ? (
            <MarketingHashLink className={secondaryLink} href='#pricing'>
              View pricing
            </MarketingHashLink>
          ) : null}
        </div>
        <div className={heroHighlightGrid} aria-label='Product highlights'>
          {marketingHeroHighlights.map((highlight) => (
            <article key={highlight.label} className={heroHighlightCard}>
              <span className={heroHighlightLabel}>{highlight.label}</span>
              <span className={heroHighlightCopy}>{highlight.copy}</span>
            </article>
          ))}
        </div>
      </div>
      <AppMockup />
    </section>
  )
}
