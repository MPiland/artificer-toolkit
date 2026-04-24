import { marketingFeatures } from '../data/marketingContent'
import {
  featureCard,
  featureGrid,
  featureIcon,
  section,
  sectionCopy,
  sectionHeader,
  sectionLabel,
  sectionTitle
} from '../marketing.css'

export function MarketingFeatureSection() {
  return (
    <section id='features' className={section} aria-labelledby='features-title'>
      <div className={sectionHeader} data-marketing-scroll-target='features'>
        <p className={sectionLabel}>Features</p>
        <h2 id='features-title' className={sectionTitle}>
          One place for the whole table
        </h2>
        <p className={sectionCopy}>
          From solo characters to full campaign prep, Artificer Toolkit keeps rules, content, and
          play in sync.
        </p>
      </div>

      <div className={featureGrid}>
        {marketingFeatures.map((feature) => (
          <article key={feature.title} className={featureCard}>
            <div className={featureIcon} aria-hidden='true' />
            <h3>{feature.title}</h3>
            <p>{feature.copy}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
