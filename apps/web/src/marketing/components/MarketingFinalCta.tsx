import { finalCta, finalCtaPanel, primaryLink, sectionCopy, sectionTitle } from '../marketing.css'
import { MarketingRouteLink } from './MarketingLinks'

export function MarketingFinalCta({
  publicSignUpEnabled = false
}: {
  publicSignUpEnabled?: boolean
}) {
  if (!publicSignUpEnabled) return null

  return (
    <section className={finalCta} aria-labelledby='final-cta-title'>
      <div className={finalCtaPanel}>
        <h2 id='final-cta-title' className={sectionTitle}>
          Create your first character or homebrew draft.
        </h2>
        <p className={sectionCopy}>
          Start from SRD content or make your own, then use it on a Character Sheet when it is
          ready.
        </p>
        <MarketingRouteLink className={primaryLink} to='/sign-up'>
          Create free account
        </MarketingRouteLink>
      </div>
    </section>
  )
}
