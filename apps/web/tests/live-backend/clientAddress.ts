import type { BrowserContext } from '@playwright/test'

/**
 * Routes a browser context's same-origin requests through its own client address, as separate
 * players reach the app from separate IPs behind the Cloudflare edge. Local workerd keeps a
 * supplied CF-Connecting-IP, so the auth proxy signs it and Better Auth's per-IP rate limits key
 * per actor instead of per machine. Addresses come from the 198.51.100.0/24 documentation range.
 * Register this before any route that handles requests itself, and let those routes fall back.
 */
export async function routeFromClientAddress(
  context: BrowserContext,
  origin: string,
  actorSlot: number
): Promise<void> {
  const clientAddress = `198.51.100.${11 + actorSlot}`
  await context.route(`${origin}/**`, (route) =>
    route.fallback({
      headers: { ...route.request().headers(), 'cf-connecting-ip': clientAddress }
    })
  )
}
