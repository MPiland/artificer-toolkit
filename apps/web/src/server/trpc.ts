import { createServerClient } from '@supabase/ssr'
import { handleTrpcFetchRequest } from '@artificer-toolkit/apis/trpc-handler'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { crossSiteRequestResponse, isTrustedSameOriginRequest } from '#app/lib/trpcRequestSecurity'
import { hasPendingInvitationSetup } from '#app/auth/invitationStatus'
import {
  appendResponseCookies,
  getRequestCookies,
  type ResponseCookie
} from './auth/requestCookies'

function getDatabaseConnectionString(): string | undefined {
  return process.env.DATABASE_CONNECTION_STRING
}

function isTrueClaim(value: unknown): boolean {
  return value === true || value === 'true'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getSubjectClaim(claims: unknown): string | null {
  if (!isRecord(claims)) return null
  return typeof claims.sub === 'string' ? claims.sub : null
}

function getSuperAdminClaim(claims: unknown): boolean {
  if (!isRecord(claims)) return false
  const appMetadata = claims.app_metadata
  if (!isRecord(appMetadata)) return false
  return isTrueClaim(appMetadata.admin)
}

export async function handleTrpcRequest(request: Request): Promise<Response> {
  if (!isTrustedSameOriginRequest(request)) {
    return crossSiteRequestResponse()
  }

  const boundedRequest = await boundTrpcRequestBody(request)
  if (boundedRequest instanceof Response) return boundedRequest
  request = boundedRequest

  const responseCookies: ResponseCookie[] = []
  const supabase = createServerClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return getRequestCookies(request)
        },
        setAll(cookies) {
          responseCookies.push(...cookies)
        }
      }
    }
  )

  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const userId = getSubjectClaim(claims)
  const isSuperAdmin = getSuperAdminClaim(claims)
  let invitationSetupPending = false
  if (userId) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    invitationSetupPending = Boolean(
      userError || !userData.user || hasPendingInvitationSetup(userData.user)
    )
  }

  const response = await handleTrpcFetchRequest(request, {
    databaseConnectionString: getDatabaseConnectionString(),
    invitationSetupPending,
    isSuperAdmin,
    userId
  })

  return appendResponseCookies(response, responseCookies)
}

async function boundTrpcRequestBody(request: Request): Promise<Request | Response> {
  const isTrpcMutation =
    request.method === 'POST' && new URL(request.url).pathname.startsWith('/api/trpc/')
  if (!isTrpcMutation || !request.body) return request

  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null && Number(declaredLength) > AUTHORED_LIMITS.mutationPayloadBytes) {
    return new Response('Authored payload exceeds 1 MiB', { status: 413 })
  }

  const chunks: Uint8Array[] = []
  const reader = request.body.getReader()
  let byteLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    byteLength += value.byteLength
    if (byteLength > AUTHORED_LIMITS.mutationPayloadBytes) {
      await reader.cancel().catch(() => undefined)
      return new Response('Authored payload exceeds 1 MiB', { status: 413 })
    }
    chunks.push(value)
  }

  const body = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  const headers = new Headers(request.headers)
  headers.set('content-length', String(byteLength))
  return new Request(request.url, {
    body,
    headers,
    method: request.method,
    signal: request.signal
  })
}
