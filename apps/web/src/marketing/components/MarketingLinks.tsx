import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react'
import { scrollToMarketingHash } from './marketing.utils'

type MarketingRouteHref = '/' | '/sign-in' | '/sign-up'

type MarketingHashLinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  href: `#${string}`
}

interface MarketingRouteLinkProps {
  className?: string
  children: ReactNode
  to: MarketingRouteHref
}

export function MarketingHashLink({ href, onClick, ...props }: MarketingHashLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)

    if (event.defaultPrevented) {
      return
    }

    event.preventDefault()

    const details = event.currentTarget.closest('details')

    if (details instanceof HTMLDetailsElement) {
      details.open = false
    }

    scrollToMarketingHash(href)
  }

  return <a href={href} onClick={handleClick} {...props} />
}

export function MarketingRouteLink({ className, children, to }: MarketingRouteLinkProps) {
  return (
    <a className={className} href={to}>
      {children}
    </a>
  )
}

export function MarketingNavLink({
  href,
  className,
  children
}: Pick<ComponentPropsWithoutRef<'a'>, 'className' | 'children'> & { href: string }) {
  if (href.startsWith('#')) {
    return (
      <MarketingHashLink className={className} href={href as `#${string}`}>
        {children}
      </MarketingHashLink>
    )
  }

  return (
    <MarketingRouteLink className={className} to={href as MarketingRouteHref}>
      {children}
    </MarketingRouteLink>
  )
}
