import {
  ctaRow,
  eyebrow,
  heroCopy,
  heroSection,
  heroTitle,
  primaryLink,
  secondaryLink
} from '../marketing.css'
import { AppMockup } from './AppMockup'
import { MarketingHashLink, MarketingRouteLink } from './MarketingLinks'

export interface MarketingHeroProps {
  showPricingLink?: boolean
}

export function MarketingHero({ showPricingLink = true }: MarketingHeroProps) {
  return (
    <section className={heroSection} aria-labelledby='marketing-hero-title'>
      <p className={eyebrow}>Built for players, homebrewers, and DMs</p>
      <h1 id='marketing-hero-title' className={heroTitle}>
        Run your table from one toolkit.
      </h1>
      <p className={heroCopy}>
        Build characters, organize homebrew, reference the SRD, and prep campaigns without juggling
        six different tabs.
      </p>
      <div className={ctaRow}>
        <MarketingRouteLink className={primaryLink} to='/sign-up'>
          Start for free
        </MarketingRouteLink>
        {showPricingLink
          ? (
              <MarketingHashLink className={secondaryLink} href='#pricing'>
                View pricing
              </MarketingHashLink>
            )
          : null}
      </div>
      <AppMockup />
    </section>
  )
}
