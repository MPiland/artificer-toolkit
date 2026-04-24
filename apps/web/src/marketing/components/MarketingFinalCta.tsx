import { finalCta, primaryLink, sectionCopy, sectionTitle } from '../marketing.css'
import { MarketingRouteLink } from './MarketingLinks'

export function MarketingFinalCta() {
  return (
    <section className={finalCta} aria-labelledby='final-cta-title'>
      <h2 id='final-cta-title' className={sectionTitle}>
        Ready to build your world?
      </h2>
      <p className={sectionCopy}>Join adventurers for free, upgrade when you are ready.</p>
      <MarketingRouteLink className={primaryLink} to='/sign-up'>
        Start for free - no card required
      </MarketingRouteLink>
    </section>
  )
}
