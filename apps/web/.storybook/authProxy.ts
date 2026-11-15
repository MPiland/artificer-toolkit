import type { ProxyOptions } from 'vite'

/**
 * Backend stories sign in through the running web app's `/api/auth` proxy (D221), so Storybook holds
 * no auth secret and the proxy's own checks still run. Better Auth trusts only the web app's origin,
 * so requests carry it as the review-data CLI's do, and the session cookie is rewritten onto the
 * Storybook host.
 */
export const storyAuthProxy: Record<string, ProxyOptions> = {
  '/api/auth': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    cookieDomainRewrite: '',
    headers: { origin: 'http://localhost:3000' }
  }
}
