import { marketingRoot } from '../marketing.css'
import { isMarketingSectionEnabled } from '../data/marketingContent'
import {
  MarketingFeatureSection,
  MarketingFinalCta,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
  MarketingPricingSection
} from '../components'

export function MarketingPage() {
  const showFeatures = isMarketingSectionEnabled('#features')
  const showPricing = isMarketingSectionEnabled('#pricing')

  return (
    <div id='top' className={marketingRoot} data-marketing-scroll-root='true' data-testid='marketing-page'>
      <MarketingHeader />
      <main>
        <MarketingHero showPricingLink={showPricing} />
        {showFeatures ? <MarketingFeatureSection /> : null}
        {showPricing ? <MarketingPricingSection /> : null}
        <MarketingFinalCta />
      </main>
      <MarketingFooter />
    </div>
  )
}
