import { R2 } from '@convex-dev/r2'
import { components } from '../_generated/api'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be configured.`)
  return value
}

function origin(name: string): URL {
  const value = required(name)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) origin.`)
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(`${name} must be an HTTP(S) origin without credentials.`)
  return url
}

function isLoopback(url: URL): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

/** Called inside handlers, never during schema evaluation. No client-supplied storage config. */
export function createMediaStorage(): R2 {
  const mode = required('MEDIA_STORAGE_MODE')
  const site = origin('CONVEX_SITE_URL')
  if (mode === 'local') {
    const endpoint = origin('LOCAL_R2_ENDPOINT')
    if (!isLoopback(site) || !isLoopback(endpoint)) {
      throw new Error('Local media requires loopback Convex and R2 endpoints.')
    }
    // Local correctness tests must never inherit the developer's staging credentials.
    return new R2(components.r2, {
      endpoint: endpoint.origin,
      bucket: 'artificer-local-media',
      accessKeyId: 'local-media-access-key',
      secretAccessKey: 'local-media-secret-key'
    })
  }
  if (mode !== 'r2') throw new Error('MEDIA_STORAGE_MODE must be local or r2.')
  if (isLoopback(site)) throw new Error('Local Convex must use the local media provider.')
  if (site.protocol !== 'https:') throw new Error('Managed Convex requires an HTTPS site origin.')
  const endpoint = origin('R2_ENDPOINT')
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.port ||
    !/^[a-z0-9]+(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname)
  )
    throw new Error('R2_ENDPOINT must be an HTTPS Cloudflare R2 account endpoint.')
  const bucket = required('R2_BUCKET')
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error('R2_BUCKET must be a valid private bucket name.')
  }
  return new R2(components.r2, {
    endpoint: endpoint.origin,
    bucket,
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY')
  })
}
