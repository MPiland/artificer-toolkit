import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS_PATH = '/api/auth/convex/jwks'

/** One cached key set per Convex site: the JWKS route is rate-limited, so keys are fetched rarely. */
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

/**
 * The Better Auth subject of a Convex access token, proven locally against the Convex site's public
 * keys (ADR 0035 Amendment 18). Null when the token cannot be proven for any reason (bad signature,
 * wrong issuer or audience, expired, or the keys unavailable): the caller then asks Convex.
 */
export async function verifiedAccessTokenSubject(
  accessToken: string,
  convexSiteUrl: string,
  now: Date
): Promise<string | null> {
  try {
    let keys = keySets.get(convexSiteUrl)
    if (!keys) {
      keys = createRemoteJWKSet(new URL(JWKS_PATH, convexSiteUrl))
      keySets.set(convexSiteUrl, keys)
    }
    const { payload } = await jwtVerify(accessToken, keys, {
      algorithms: ['RS256'],
      audience: 'convex',
      currentDate: now,
      issuer: convexSiteUrl
    })
    return payload.sub ?? null
  } catch {
    return null
  }
}
