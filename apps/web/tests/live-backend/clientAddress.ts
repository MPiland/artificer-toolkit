import type { BrowserContext, Route } from '@playwright/test'

/**
 * Routes a browser context's same-origin requests through its own client address, as separate
 * players reach the app from separate IPs behind the Cloudflare edge. Local workerd keeps a
 * supplied CF-Connecting-IP, so the auth proxy signs it and Better Auth's per-IP rate limits key
 * per actor instead of per machine. Addresses come from the 198.51.100.0/24 documentation range.
 * Register this before any route that handles requests itself, and let those routes fall back.
 * Returns the function that removes the route, for a context that changes address.
 */
export async function routeFromClientAddress(
  context: BrowserContext,
  origin: string,
  actorSlot: number
): Promise<() => Promise<void>> {
  const clientAddress = `198.51.100.${11 + actorSlot}`
  const pattern = `${origin}/**`
  const handler = (route: Route) =>
    route.fallback({
      headers: { ...route.request().headers(), 'cf-connecting-ip': clientAddress }
    })
  await context.route(pattern, handler)
  return () => context.unroute(pattern, handler)
}
