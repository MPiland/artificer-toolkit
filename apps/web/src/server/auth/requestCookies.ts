import { parseCookieHeader, serializeCookieHeader, type CookieOptions } from '@supabase/ssr'

export interface ResponseCookie {
  name: string
  options: CookieOptions
  value: string
}

export function getRequestCookies(request: Request) {
  return parseCookieHeader(request.headers.get('Cookie') ?? '').map((cookie) => ({
    name: cookie.name,
    value: cookie.value ?? ''
  }))
}

export function appendResponseCookies(response: Response, cookies: ResponseCookie[]): Response {
  if (cookies.length === 0) return response

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
