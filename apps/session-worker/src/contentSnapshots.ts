import {
  CONTENT_SNAPSHOT_PATH_PREFIX,
  CONTENT_SNAPSHOT_PUBLIC_METADATA,
  parseContentSnapshotObjectKey,
  type ContentSnapshotTokenClaims
} from '@artificer-toolkit/schema/api/contentSnapshots'

import { verifyContentSnapshotToken } from './contentToken.js'
import { allowedOrigins, type SessionWorkerEnvironment } from './environment.js'

// ADR 0036 delivery. `docs/architecture/media.md` describes the authorization matrix.

const IMMUTABLE_YEAR = 'max-age=31536000, immutable'

/**
 * Serves one content snapshot object. PLATFORM source objects (marked public by the build) are
 * public; every other object needs a content token in the Authorization header naming its USER
 * source or Campaign. Nothing is written to the edge cache.
 */
export async function serveContentSnapshot(
  request: Request,
  environment: SessionWorkerEnvironment
): Promise<Response> {
  const origin = request.headers.get('origin')
  // Browsers always send Origin on these cross-origin reads; other origins get no CORS grant.
  if (origin !== null && !allowedOrigins(environment).has(origin))
    return new Response('Origin is not allowed.', { status: 403 })
  const cors: Record<string, string> =
    origin === null ? {} : { 'access-control-allow-origin': origin, vary: 'Origin' }
  const refuse = (status: number, message: string) =>
    new Response(message, { status, headers: { ...cors, 'cache-control': 'no-store' } })

  if (request.method === 'OPTIONS')
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'access-control-allow-headers': 'authorization',
        'access-control-allow-methods': 'GET',
        'access-control-max-age': '86400'
      }
    })
  if (request.method !== 'GET') return refuse(405, 'Method not allowed.')
  const url = new URL(request.url)
  // Keys are content-addressed, so no request needs a query; a token there would leak into logs.
  if (url.search !== '') return refuse(400, 'Content requests take no query string.')
  const key = url.pathname.slice(CONTENT_SNAPSHOT_PATH_PREFIX.length)
  const parsed = parseContentSnapshotObjectKey(key)
  if (!parsed) return refuse(404, 'Not found.')

  let claims: ContentSnapshotTokenClaims | null = null
  const authorization = request.headers.get('authorization')
  if (authorization !== null) {
    const token = /^Bearer ([^\s]+)$/.exec(authorization)?.[1]
    if (!token) return refuse(401, 'Content token is invalid.')
    try {
      claims = await verifyContentSnapshotToken(token, environment.CONTENT_SNAPSHOT_TOKEN_SECRET)
    } catch {
      return refuse(401, 'Content token is invalid.')
    }
  }

  const object = await environment.CONTENT_SNAPSHOTS.get(key)
  if (!object) return refuse(404, 'Not found.')
  const isPublic = object.customMetadata?.access === CONTENT_SNAPSHOT_PUBLIC_METADATA.access
  if (!isPublic) {
    const { scope, scopeId } = parsed.header
    const granted =
      (scope === 'SOURCE' && claims?.userSourceIds.includes(scopeId)) ||
      (scope === 'CAMPAIGN' && claims?.campaignIds.includes(scopeId))
    if (!granted) {
      await object.body.cancel()
      return claims ? refuse(403, 'Forbidden.') : refuse(401, 'Content token is required.')
    }
  }
  return new Response(object.body, {
    // The stored body is already gzip; the runtime must not encode it again.
    encodeBody: 'manual',
    headers: {
      ...cors,
      'cache-control': `${isPublic ? 'public' : 'private'}, ${IMMUTABLE_YEAR}`,
      ...(object.httpMetadata?.contentEncoding
        ? { 'content-encoding': object.httpMetadata.contentEncoding }
        : {}),
      'content-type': object.httpMetadata?.contentType ?? 'application/json',
      etag: object.httpEtag,
      'x-content-type-options': 'nosniff'
    }
  })
}
