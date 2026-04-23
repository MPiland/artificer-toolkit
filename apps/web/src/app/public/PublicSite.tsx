import clsx from 'clsx'
import ILogo from '#assets/icons/ILogo'
import { marketingFeatures, pricingPlans, publicNavigation } from './marketingContent'
import {
  billingActive,
  billingMuted,
  billingToggle,
  brandLink,
  ctaRow,
  desktopNav,
  eyebrow,
  featureCard,
  featureGrid,
  featureIcon,
  finalCta,
  heroCopy,
  heroMockup,
  heroSection,
  heroTitle,
  logoMark,
  marketingRoot,
  mobileMenu,
  mobileNavPanel,
  mobileSummary,
  mockupBody,
  mockupCard,
  mockupContent,
  mockupRail,
  mockupSplit,
  mockupTopbar,
  navLink,
  planBadge,
  planFeatureList,
  planName,
  planPrice,
  pricingCard,
  pricingCardFeatured,
  pricingGrid,
  primaryLink,
  publicFooter,
  publicHeader,
  railDot,
  railDotActive,
  secondaryLink,
  section,
  sectionAlt,
  sectionCopy,
  sectionHeader,
  sectionLabel,
  sectionTitle
} from './public.css'

export function PublicSiteHeader() {
  return (
    <header className={publicHeader} data-testid='public-header'>
      <a className={brandLink} href='/'>
        <ILogo className={logoMark} aria-hidden='true' />
        <span>Artificer Toolkit</span>
      </a>

      <nav className={desktopNav} aria-label='Public navigation'>
        {publicNavigation.map((item) => (
          <a key={item.href} className={navLink} href={item.href}>
            {item.label}
          </a>
        ))}
        <a className={primaryLink} href='/signup'>
          Get started free
        </a>
      </nav>

      <details className={mobileMenu}>
        <summary className={mobileSummary}>Menu</summary>
        <nav className={mobileNavPanel} aria-label='Mobile public navigation'>
          {publicNavigation.map((item) => (
            <a key={item.href} className={navLink} href={item.href}>
              {item.label}
            </a>
          ))}
          <a className={primaryLink} href='/signup'>
            Get started free
          </a>
        </nav>
      </details>
    </header>
  )
}

export function MarketingHero() {
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
        <a className={primaryLink} href='/signup'>
          Start for free
        </a>
        <a className={secondaryLink} href='#pricing'>
          View pricing
        </a>
      </div>
      <AppMockup />
    </section>
  )
}

function AppMockup() {
  return (
    <div className={heroMockup} aria-label='Campaign overview preview'>
      <div className={mockupTopbar} />
      <div className={mockupBody}>
        <div className={mockupRail} aria-hidden='true'>
          <div className={railDotActive} />
          <div className={railDot} />
          <div className={railDot} />
          <div className={railDot} />
          <div className={railDot} />
        </div>
        <div className={mockupContent}>
          <div>
            <h2 className={sectionTitle}>Campaign overview</h2>
            <p className={sectionCopy}>
              Keep characters, notes, and encounters ready for session night.
            </p>
          </div>
          <article className={mockupCard}>
            <span className={planBadge}>Active</span>
            <strong>Party roster</strong>
            <span>
              Track player resources, classes, and party balance at a glance before the next session.
            </span>
          </article>
          <div className={mockupSplit}>
            <article className={mockupCard}>
              <strong>Encounter prep</strong>
              <span>Build and save initiative, creatures, and notes before game night starts.</span>
            </article>
            <article className={mockupCard}>
              <strong>Shared content</strong>
              <span>Send custom spells, races, and items directly to your campaign.</span>
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MarketingFeatureSection() {
  return (
    <section id='features' className={section} aria-labelledby='features-title'>
      <div className={sectionHeader}>
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

export function MarketingPricingSection() {
  return (
    <section id='pricing' className={clsx(section, sectionAlt)} aria-labelledby='pricing-title'>
      <div className={sectionHeader}>
        <p className={sectionLabel}>Pricing</p>
        <h2 id='pricing-title' className={sectionTitle}>
          Start free, upgrade when your table needs more room to grow.
        </h2>
      </div>

      <div className={billingToggle} aria-label='Billing cadence'>
        <span className={billingActive}>Monthly</span>
        <span className={billingMuted}>Annual - Save 20%</span>
      </div>

      <div className={pricingGrid}>
        {pricingPlans.map((plan) => (
          <article
            key={plan.name}
            className={clsx(pricingCard, plan.featured && pricingCardFeatured)}
          >
            {plan.featured ? <span className={planBadge}>Most popular</span> : null}
            <p className={planName}>{plan.name}</p>
            <p className={planPrice}>{plan.price}</p>
            <p className={sectionCopy}>{plan.cadence}</p>
            <p className={sectionCopy}>{plan.description}</p>
            <ul className={planFeatureList}>
              {plan.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <a className={plan.featured ? primaryLink : secondaryLink} href={plan.href}>
              {plan.cta}
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

export function MarketingFinalCta() {
  return (
    <section className={finalCta} aria-labelledby='final-cta-title'>
      <h2 id='final-cta-title' className={sectionTitle}>
        Ready to build your world?
      </h2>
      <p className={sectionCopy}>Join adventurers for free, upgrade when you are ready.</p>
      <a className={primaryLink} href='/signup'>
        Start for free - no card required
      </a>
    </section>
  )
}

export function PublicSiteFooter() {
  return (
    <footer className={publicFooter} data-testid='public-footer'>
      <p>© 2026 Artificer Toolkit · All rights reserved</p>
    </footer>
  )
}

export function MarketingPage() {
  return (
    <div className={marketingRoot} data-testid='marketing-page'>
      <PublicSiteHeader />
      <main>
        <MarketingHero />
        <MarketingFeatureSection />
        <MarketingPricingSection />
        <MarketingFinalCta />
      </main>
      <PublicSiteFooter />
    </div>
  )
}
