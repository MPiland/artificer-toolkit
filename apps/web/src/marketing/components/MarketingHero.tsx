import {
  ctaRow,
  eyebrow,
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

export interface MarketingHeroProps {
  showPricingLink?: boolean
}

export function MarketingHero({ showPricingLink = true }: MarketingHeroProps) {
  return (
    <section className={heroSection} aria-labelledby='marketing-hero-title'>
      <div className={heroContent}>
        <p className={eyebrow}>Built for players, homebrewers, and DMs</p>
        <h1 id='marketing-hero-title' className={heroTitle}>
          Create the content you want to run, then bring it straight into play.
        </h1>
        <p className={heroCopy}>
          Artificer Toolkit gives you a structured place to author homebrew, build characters from
          that content, and use the result at the table without bouncing between disconnected tools.
        </p>
        <div className={ctaRow}>
          <MarketingRouteLink className={primaryLink} to='/sign-up'>
            Start building for free
          </MarketingRouteLink>
          {showPricingLink
            ? (
                <MarketingHashLink className={secondaryLink} href='#pricing'>
                  View pricing
                </MarketingHashLink>
              )
            : null}
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
