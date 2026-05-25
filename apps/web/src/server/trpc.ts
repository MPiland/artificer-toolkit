import { createServerClient, parseCookieHeader, serializeCookieHeader, type CookieOptions } from '@supabase/ssr'
import { handleTrpcFetchRequest, type TrpcContext } from '@artificer-toolkit/apis/trpc-handler'
import { crossSiteRequestResponse, isTrustedSameOriginRequest } from '#app/lib/trpcRequestSecurity'

interface ResponseCookie {
  name: string
  options: CookieOptions
  value: string
}

function getRequestCookies(request: Request) {
  return parseCookieHeader(request.headers.get('Cookie') ?? '')
    .map((cookie) => ({
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

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? null
  const isSuperAdmin = isTrueClaim(userData.user?.app_metadata?.admin)

  const response = await handleTrpcFetchRequest(request, {
    databaseConnectionString: getDatabaseConnectionString(),
    isSuperAdmin,
    userId
  })

  return appendResponseCookies(response, responseCookies)
}
