import { createServerClient } from '@supabase/ssr'
import { commitImports, exportAuthoredContent, previewImports } from '@artificer-toolkit/apis'
import { IMPORT_MAX_BATCH_BYTES } from '@artificer-toolkit/schema/api/imports'
import { crossSiteRequestResponse, isTrustedSameOriginRequest } from '#app/lib/trpcRequestSecurity'
import {
  appendResponseCookies,
  getRequestCookies,
  type ResponseCookie
} from './auth/requestCookies'

// JSON.stringify escapes the uploaded JSON again; the schema still enforces 25 MiB decoded.
const maxImportRequestBytes = IMPORT_MAX_BATCH_BYTES * 2 + 256 * 1024

export async function handleImportRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST' || !isTrustedSameOriginRequest(request)) {
    return crossSiteRequestResponse()
  }

  const boundedRequest = await boundImportRequestBody(request)
  if (boundedRequest instanceof Response) return boundedRequest

  const responseCookies: ResponseCookie[] = []
  const supabase = createServerClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => getRequestCookies(boundedRequest),
        setAll: (cookies) => {
          responseCookies.push(...cookies)
        }
      }
    }
  )
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken)
    return appendResponseCookies(new Response('Unauthorized', { status: 401 }), responseCookies)

  const forwardedHeaders = new Headers(boundedRequest.headers)
  forwardedHeaders.set('Authorization', `Bearer ${accessToken}`)
  forwardedHeaders.delete('Cookie')
  const forwardedRequest = new Request(boundedRequest, { headers: forwardedHeaders })
  const pathname = new URL(request.url).pathname
  const response =
    pathname === '/api/imports/preview'
      ? await previewImports(forwardedRequest)
      : pathname === '/api/imports/commit'
        ? await commitImports(forwardedRequest)
        : await exportAuthoredContent(forwardedRequest)

  return appendResponseCookies(response, responseCookies)
}

async function boundImportRequestBody(request: Request): Promise<Request | Response> {
  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null && Number(declaredLength) > maxImportRequestBytes) {
    return new Response('Import payload exceeds the maximum batch size', { status: 413 })
  }
  if (!request.body) return request

  const chunks: Uint8Array[] = []
  const reader = request.body.getReader()
  let byteLength = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    byteLength += value.byteLength
    if (byteLength > maxImportRequestBytes) {
      await reader.cancel().catch(() => undefined)
      return new Response('Import payload exceeds the maximum batch size', { status: 413 })
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
  return new Request(request.url, { body, headers, method: request.method, signal: request.signal })
}
