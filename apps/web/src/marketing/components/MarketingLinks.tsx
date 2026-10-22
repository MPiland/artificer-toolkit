import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react'
import { findOption } from '../../forms/utils/valueGuards'
import { scrollToMarketingHash } from './marketing.utils'

const marketingRoutes = ['/', '/sign-in', '/sign-up'] as const

type MarketingRouteHref = (typeof marketingRoutes)[number]

function isHashHref(href: string): href is `#${string}` {
  return href.startsWith('#')
}

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
  if (isHashHref(href)) {
    return (
      <MarketingHashLink className={className} href={href}>
        {children}
      </MarketingHashLink>
    )
  }

  const route = findOption(marketingRoutes, href)
  if (!route) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    )
  }

  return (
    <MarketingRouteLink className={className} to={route}>
      {children}
    </MarketingRouteLink>
  )
}
