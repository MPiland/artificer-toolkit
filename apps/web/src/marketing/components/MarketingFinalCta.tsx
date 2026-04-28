import { finalCta, finalCtaPanel, primaryLink, sectionCopy, sectionTitle } from '../marketing.css'
import { MarketingRouteLink } from './MarketingLinks'

export function MarketingFinalCta() {
  return (
    <section className={finalCta} aria-labelledby='final-cta-title'>
      <div className={finalCtaPanel}>
        <h2 id='final-cta-title' className={sectionTitle}>
          Start your first character or your first piece of homebrew.
        </h2>
        <p className={sectionCopy}>
          Open the toolkit, create something real, and keep it ready for play as the rest of the app
          grows around it.
        </p>
        <MarketingRouteLink className={primaryLink} to='/sign-up'>
          Start creating for free
        </MarketingRouteLink>
      </div>
    </section>
  )
}
