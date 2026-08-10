import type { Event } from '@sentry/tanstackstart-react'
import { describe, expect, it } from 'vitest'
import { redactSentryEvent } from './sentryPrivacy'

describe('redactSentryEvent', () => {
  it('removes invite secrets and URL query or fragment data from known Sentry seams', () => {
    const event = {
      breadcrumbs: [
        {
          data: {
            from: '/campaigns/invite/from-token?token_hash=from-secret',
            referrer: 'https://app.example.test/campaigns/invite/referrer-token#fragment',
            safe: 'preserve me',
            to: '/campaigns/invite/to-token?token_hash=to-secret',
            url: 'https://app.example.test/campaigns/invite/breadcrumb-token?token_hash=secret'
          }
        }
      ],
      request: {
        headers: {
          Referer: 'https://app.example.test/campaigns/invite/header-token?token_hash=secret',
          REFERRER: 'https://app.example.test/campaigns/invite/header-token#fragment',
          'x-request-id': 'safe-request-id'
        },
        query_string: 'token_hash=request-secret',
        url: 'https://app.example.test/campaigns/invite/request-token?token_hash=request-secret#fragment'
      },
      spans: [
        {
          data: {
            'http.query': 'token_hash=http-query-secret',
            'http.request.header.referer':
              'https://app.example.test/campaigns/invite/span-header-token?token_hash=secret',
            'http.target': '/campaigns/invite/target-token?token_hash=target-secret',
            'http.url':
              'https://app.example.test/campaigns/invite/http-url-token?token_hash=secret',
            referrer: 'https://app.example.test/campaigns/invite/span-referrer-token#fragment',
            url: 'https://app.example.test/campaigns/invite/span-url-token?token_hash=span-secret',
            'url.full':
              'https://app.example.test/campaigns/invite/full-url-token?token_hash=secret',
            'url.query': 'token_hash=url-query-secret'
          },
          description:
            'https://app.example.test/campaigns/invite/description-token?token_hash=secret',
          span_id: 'span-id',
          start_timestamp: 1,
          trace_id: 'trace-id'
        }
      ],
      transaction: '/campaigns/invite/transaction-token?token_hash=secret#fragment'
    } satisfies Event

    const result = redactSentryEvent(event)

    expect(result.request).toEqual({
      headers: { 'x-request-id': 'safe-request-id' },
      url: 'https://app.example.test/campaigns/invite/[redacted]'
    })
    expect(result.breadcrumbs?.[0]?.data).toEqual({
      from: '/campaigns/invite/[redacted]',
      referrer: 'https://app.example.test/campaigns/invite/[redacted]',
      safe: 'preserve me',
      to: '/campaigns/invite/[redacted]',
      url: 'https://app.example.test/campaigns/invite/[redacted]'
    })
    expect(result.transaction).toBe('/campaigns/invite/[redacted]')
    expect(result.spans?.[0]).toMatchObject({
      data: {
        'http.request.header.referer': 'https://app.example.test/campaigns/invite/[redacted]',
        'http.target': '/campaigns/invite/[redacted]',
        'http.url': 'https://app.example.test/campaigns/invite/[redacted]',
        referrer: 'https://app.example.test/campaigns/invite/[redacted]',
        url: 'https://app.example.test/campaigns/invite/[redacted]',
        'url.full': 'https://app.example.test/campaigns/invite/[redacted]'
      },
      description: 'https://app.example.test/campaigns/invite/[redacted]'
    })
  })

  it('preserves non-URL context while scrubbing safe URL paths', () => {
    const event = {
      breadcrumbs: [{ data: { url: '/campaigns/abc?tab=overview', value: 'not a URL' } }],
      request: { url: 'https://app.example.test/campaigns/abc?tab=overview#section' },
      transaction: 'load campaign details'
    } satisfies Event

    const result = redactSentryEvent(event)

    expect(result.request?.url).toBe('https://app.example.test/campaigns/abc')
    expect(result.breadcrumbs?.[0]?.data).toEqual({
      url: '/campaigns/abc',
      value: 'not a URL'
    })
    expect(result.transaction).toBe('load campaign details')
  })
})
