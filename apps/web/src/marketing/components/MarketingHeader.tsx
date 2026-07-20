import ILogo from '#assets/icons/ILogo'
import { ThemeToggle } from '#ui/primitives'
import { getMarketingNavigation } from '../data/marketingContent'
import {
  brandLink,
  desktopNav,
  headerActions,
  logoMark,
  marketingHeader,
  marketingHeaderThemeToggle,
  mobileSignInLink,
  navLink,
  primaryLink
} from '../marketing.css'
import { MarketingHashLink, MarketingNavLink, MarketingRouteLink } from './MarketingLinks'

export function MarketingHeader({ publicSignUpEnabled = false }: { publicSignUpEnabled?: boolean }) {
  const navigation = getMarketingNavigation(publicSignUpEnabled)

  return (
    <header className={marketingHeader} data-testid='marketing-header'>
      <MarketingHashLink className={brandLink} href='#top'>
        <ILogo className={logoMark} aria-hidden='true' />
        <span>Artificer Toolkit</span>
      </MarketingHashLink>

      <nav className={desktopNav} aria-label='Marketing navigation'>
        {navigation.map((item) => (
          <MarketingNavLink key={item.href} className={navLink} href={item.href}>
            {item.label}
          </MarketingNavLink>
        ))}
        {publicSignUpEnabled ? (
          <MarketingRouteLink className={primaryLink} to='/sign-up'>
            Get started free
          </MarketingRouteLink>
        ) : null}
      </nav>

      <div className={headerActions}>
        <MarketingRouteLink className={mobileSignInLink} to='/sign-in'>
          Sign in
        </MarketingRouteLink>
        <ThemeToggle className={marketingHeaderThemeToggle} />
      </div>
    </header>
  )
}
