import IBook from '#assets/icons/IBook'
import IChar from '#assets/icons/IChar'
import IMortPest from '#assets/icons/IMortPest'
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
  campaign: IMortPest
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
          Players, creators, and DMs all need different things. The product stays consistent across
          those jobs without flattening them into one messy screen.
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
