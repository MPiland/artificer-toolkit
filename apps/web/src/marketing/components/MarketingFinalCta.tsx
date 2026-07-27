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
          Start your first character or your first piece of homebrew.
        </h2>
        <p className={sectionCopy}>
          Create structured homebrew, build a character, and take a dedicated sheet to the table
          from one toolkit.
        </p>
        <MarketingRouteLink className={primaryLink} to='/sign-up'>
          Start creating for free
        </MarketingRouteLink>
      </div>
    </section>
  )
}
