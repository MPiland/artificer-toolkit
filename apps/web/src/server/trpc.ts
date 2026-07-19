import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieOptions
} from '@supabase/ssr'
import { handleTrpcFetchRequest } from '@artificer-toolkit/apis/trpc-handler'
import { crossSiteRequestResponse, isTrustedSameOriginRequest } from '#app/lib/trpcRequestSecurity'

interface ResponseCookie {
  name: string
  options: CookieOptions
  value: string
}

function getRequestCookies(request: Request) {
  return parseCookieHeader(request.headers.get('Cookie') ?? '').map((cookie) => ({
    name: cookie.name,
    value: cookie.value ?? ''
  }))
}

function appendResponseCookies(response: Response, cookies: ResponseCookie[]): Response {
  if (cookies.length === 0) {
    return response
  }

  const headers = new Headers(response.headers)
  for (const cookie of cookies) {
    headers.append('Set-Cookie', serializeCookieHeader(cookie.name, cookie.value, cookie.options))
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  })
}

function getDatabaseConnectionString(): string | undefined {
  return process.env.DATABASE_CONNECTION_STRING ?? process.env.DATABASE_URL
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

  const responseCookies: ResponseCookie[] = []
  const supabase = createServerClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!,
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

  const response = await handleTrpcFetchRequest(request, {
    databaseConnectionString: getDatabaseConnectionString(),
    isSuperAdmin,
    userId
  })

  return appendResponseCookies(response, responseCookies)
}
