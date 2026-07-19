import IBook from '#assets/icons/IBook'
import ICategory from '#assets/icons/ICategory'
import IChar from '#assets/icons/IChar'
import IScroll from '#assets/icons/IScroll'
import { marketingFeatures } from '../data/marketingContent'
import {
  featureAudience,
  featureBody,
  featureBullet,
  featureBulletList,
  featureBulletMarker,
  featureCard,
  featureCardHeader,
  featureCardNarrow,
  featureCardWide,
  featureGrid,
  featureIcon,
  featureTitle,
  section,
  sectionCopy,
  sectionHeader,
  sectionLabel,
  sectionTitle
} from '../marketing.css'

const featureIcons = {
  character: IChar,
  scroll: IScroll,
  book: IBook,
  status: ICategory
} as const

export function MarketingFeatureSection() {
  return (
    <section id='features' className={section} aria-labelledby='features-title'>
      <div className={sectionHeader} data-marketing-scroll-target='features'>
        <p className={sectionLabel}>Features</p>
        <h2 id='features-title' className={sectionTitle}>
          Built for real tabletop workflows, not generic content forms
        </h2>
        <p className={sectionCopy}>
          Building and playing need different surfaces. The toolkit keeps their structure consistent
          without flattening them into one crowded screen.
        </p>
      </div>

      <div className={featureGrid}>
        {marketingFeatures.map((feature, index) => {
          const Icon = featureIcons[feature.icon]
          const layoutClass = index === 0 || index === 3 ? featureCardWide : featureCardNarrow

          return (
            <article key={feature.title} className={`${featureCard} ${layoutClass}`}>
              <div className={featureCardHeader}>
                <div className={featureIcon} aria-hidden='true'>
                  <Icon />
                </div>
                <span className={featureAudience}>{feature.audience}</span>
                <h3 className={featureTitle}>{feature.title}</h3>
                <p className={featureBody}>{feature.copy}</p>
              </div>
              <ul className={featureBulletList}>
                {feature.bullets.map((bullet) => (
                  <li key={bullet} className={featureBullet}>
                    <span className={featureBulletMarker} aria-hidden='true' />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}
