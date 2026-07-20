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

export function MarketingPage({ publicSignUpEnabled = false }: { publicSignUpEnabled?: boolean }) {
  const showFeatures = isMarketingSectionEnabled('#features')
  const showPricing = publicSignUpEnabled && isMarketingSectionEnabled('#pricing')

  return (
    <div id='top' className={marketingRoot} data-marketing-scroll-root='true' data-testid='marketing-page'>
      <MarketingHeader publicSignUpEnabled={publicSignUpEnabled} />
      <main>
        <MarketingHero
          publicSignUpEnabled={publicSignUpEnabled}
          showPricingLink={showPricing}
        />
        {showFeatures ? <MarketingFeatureSection /> : null}
        {showPricing ? <MarketingPricingSection publicSignUpEnabled /> : null}
        <MarketingFinalCta publicSignUpEnabled={publicSignUpEnabled} />
      </main>
      <MarketingFooter />
    </div>
  )
}
