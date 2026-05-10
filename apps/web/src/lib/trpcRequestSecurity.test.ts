import { describe, expect, it } from 'vitest'
import {
  applySameOriginRequestHeader,
  isTrustedSameOriginMutationRequest,
  isTrustedSameOriginRequest
} from './trpcRequestSecurity'

describe('same-origin request security', () => {
  it('allows read requests without a CSRF marker', () => {
    const request = new Request('https://app.test/api/trpc/content.spells.list')

    expect(isTrustedSameOriginRequest(request)).toBe(true)
  })

  it('allows same-origin tRPC writes with the adapter marker header', () => {
    const headers = applySameOriginRequestHeader(new Headers({
      Origin: 'https://app.test',
      'Sec-Fetch-Site': 'same-origin'
    }))
    const request = new Request('https://app.test/api/trpc/content.spells.saveDraft', {
      headers,
      method: 'POST'
    })

    expect(isTrustedSameOriginRequest(request)).toBe(true)
  })

  it('blocks cross-site form-style writes that cannot provide the adapter marker header', () => {
    const request = new Request('https://app.test/api/trpc/content.spells.saveDraft', {
      headers: {
        Origin: 'https://evil.test',
        'Sec-Fetch-Site': 'cross-site'
      },
      method: 'POST'
    })

    expect(isTrustedSameOriginRequest(request)).toBe(false)
  })

  it('blocks writes with a mismatched referer even when a marker header is present', () => {
    const headers = applySameOriginRequestHeader(new Headers({
      Referer: 'https://evil.test/page'
    }))
    const request = new Request('https://app.test/api/trpc/content.spells.saveDraft', {
      headers,
      method: 'POST'
    })

    expect(isTrustedSameOriginRequest(request)).toBe(false)
  })

  it('allows same-origin auth server function writes without the tRPC marker header', () => {
    const request = new Request('https://app.test/_server/logout', {
      headers: {
        Origin: 'https://app.test',
        'Sec-Fetch-Site': 'same-origin'
      },
      method: 'POST'
    })

    expect(isTrustedSameOriginMutationRequest(request)).toBe(true)
  })

  it('blocks cross-origin auth server function writes', () => {
    const request = new Request('https://app.test/_server/logout', {
      headers: {
        Origin: 'https://evil.test',
        'Sec-Fetch-Site': 'cross-site'
      },
      method: 'POST'
    })

    expect(isTrustedSameOriginMutationRequest(request)).toBe(false)
  })
})
