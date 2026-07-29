const STATE_CHANGING_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT'])
const SAME_ORIGIN_REQUEST_HEADER = 'x-artificer-trpc'
const SAME_ORIGIN_REQUEST_VALUE = '1'

function getHeaderOrigin(value: string | null): string | null {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function hasTrustedSameOriginMetadata(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin
  const origin = getHeaderOrigin(request.headers.get('Origin'))
  if (origin && origin !== requestOrigin) {
    return false
  }

  const referer = getHeaderOrigin(request.headers.get('Referer'))
  if (referer && referer !== requestOrigin) {
    return false
  }

  const fetchSite = request.headers.get('Sec-Fetch-Site')
  return (
    !fetchSite || fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none'
  )
}

export function applySameOriginRequestHeader(headers: Headers): Headers {
  headers.set(SAME_ORIGIN_REQUEST_HEADER, SAME_ORIGIN_REQUEST_VALUE)
  return headers
}

export function isTrustedSameOriginMutationRequest(request: Request): boolean {
  if (!STATE_CHANGING_METHODS.has(request.method.toUpperCase())) {
    return true
  }

  return hasTrustedSameOriginMetadata(request)
}

export function isTrustedSameOriginRequest(request: Request): boolean {
  if (!STATE_CHANGING_METHODS.has(request.method.toUpperCase())) {
    return true
  }

  if (request.headers.get(SAME_ORIGIN_REQUEST_HEADER) !== SAME_ORIGIN_REQUEST_VALUE) {
    return false
  }

  return hasTrustedSameOriginMetadata(request)
}

export function crossSiteRequestResponse(): Response {
  return new Response('Cross-site request blocked', { status: 403 })
}
