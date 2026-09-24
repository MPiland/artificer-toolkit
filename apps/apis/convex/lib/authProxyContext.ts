import { SignJWT, jwtVerify } from 'jose'
import {
  authProxyContextDtoSchema,
  type AuthProxyContextDto
} from '@artificer-toolkit/schema/api/auth'

export const AUTH_PROXY_CONTEXT_HEADER = 'x-artificer-auth-proxy-context'
const ISSUER = 'artificer-auth-proxy'

function signingKey() {
  const secret = process.env.AUTH_PROXY_SECRET
  if (!secret || secret.length < 64)
    throw new Error('AUTH_PROXY_SECRET must be configured securely.')
  return new TextEncoder().encode(secret)
}

export async function signAuthProxyContext(context: AuthProxyContextDto, audience: string) {
  return new SignJWT(authProxyContextDtoSchema.parse(context))
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('30s')
    .sign(signingKey())
}

export async function verifyAuthProxyContext(request: Request, audience: string) {
  const token = request.headers.get(AUTH_PROXY_CONTEXT_HEADER)
  if (!token) return null
  if (token.length > 2048) throw new Error('Invalid auth proxy context.')
  const { payload } = await jwtVerify(token, signingKey(), {
    algorithms: ['HS256'],
    typ: 'JWT',
    issuer: ISSUER,
    audience,
    requiredClaims: ['iat', 'exp'],
    maxTokenAge: '30s'
  })
  const context = authProxyContextDtoSchema.parse({
    ip: payload.ip,
    method: payload.method,
    path: payload.path
  })
  if (context.method !== request.method || context.path !== new URL(request.url).pathname) {
    throw new Error('Invalid auth proxy context.')
  }
  return context
}
