import ILogo from '#assets/icons/ILogo'
import { ThemeToggle } from '#ui/primitives'
import { marketingNavigation } from '../data/marketingContent'
import {
  brandLink,
  desktopNav,
  headerActions,
  logoMark,
  marketingHeader,
  mobileMenu,
  mobileNavPanel,
  mobileSummary,
  navLink,
  primaryLink
} from '../marketing.css'
import { MarketingHashLink, MarketingNavLink, MarketingRouteLink } from './MarketingLinks'

export function MarketingHeader() {
  return (
    <header className={marketingHeader} data-testid='marketing-header'>
      <MarketingHashLink className={brandLink} href='#top'>
        <ILogo className={logoMark} aria-hidden='true' />
        <span>Artificer Toolkit</span>
      </MarketingHashLink>

      <nav className={desktopNav} aria-label='Marketing navigation'>
        {marketingNavigation.map((item) => (
          <MarketingNavLink key={item.href} className={navLink} href={item.href}>
            {item.label}
          </MarketingNavLink>
        ))}
        <MarketingRouteLink className={primaryLink} to='/sign-up'>
          Get started free
        </MarketingRouteLink>
      </nav>

      <div className={headerActions}>
        <ThemeToggle />

        <details className={mobileMenu}>
          <summary className={mobileSummary}>Menu</summary>
          <nav className={mobileNavPanel} aria-label='Mobile marketing navigation'>
            {marketingNavigation.map((item) => (
              <MarketingNavLink key={item.href} className={navLink} href={item.href}>
                {item.label}
              </MarketingNavLink>
            ))}
            <MarketingRouteLink className={primaryLink} to='/sign-up'>
              Get started free
            </MarketingRouteLink>
          </nav>
        </details>
      </div>
    </header>
  )
}
