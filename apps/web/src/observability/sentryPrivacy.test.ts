import type { Event } from '@sentry/tanstackstart-react'
import { describe, expect, it } from 'vitest'
import { redactSentryEvent } from './sentryPrivacy'

describe('redactSentryEvent', () => {
  it('removes URL query or fragment data from known Sentry seams', () => {
    const event = {
      breadcrumbs: [
        {
          data: {
            from: '/social/listings/listing-id?message=private',
            referrer: 'https://app.example.test/social/listings/listing-id#fragment',
            safe: 'preserve me',
            to: '/social/listings/listing-id?view=detail',
            url: 'https://app.example.test/social/listings/listing-id?message=private'
          }
        }
      ],
      request: {
        headers: {
          Referer: 'https://app.example.test/social/listings/listing-id?message=private',
          REFERRER: 'https://app.example.test/social/listings/listing-id#fragment',
          'x-request-id': 'safe-request-id'
        },
        query_string: 'message=private',
        url: 'https://app.example.test/social/listings/listing-id?message=private#fragment'
      },
      spans: [
        {
          data: {
            'http.query': 'message=private',
            'http.request.header.referer':
              'https://app.example.test/social/listings/listing-id?message=private',
            'http.target': '/social/listings/listing-id?view=detail',
            'http.url': 'https://app.example.test/social/listings/listing-id?message=private',
            referrer: 'https://app.example.test/social/listings/listing-id#fragment',
            url: 'https://app.example.test/social/listings/listing-id?message=private',
            'url.full': 'https://app.example.test/social/listings/listing-id?message=private',
            'url.query': 'message=private'
          },
          description: 'https://app.example.test/social/listings/listing-id?message=private',
          span_id: 'span-id',
          start_timestamp: 1,
          trace_id: 'trace-id'
        }
      ],
      transaction: '/social/listings/listing-id?message=private#fragment'
    } satisfies Event

    const result = redactSentryEvent(event)

    expect(result.request).toEqual({
      headers: { 'x-request-id': 'safe-request-id' },
      url: 'https://app.example.test/social/listings/listing-id'
    })
    expect(result.breadcrumbs?.[0]?.data).toEqual({
      from: '/social/listings/listing-id',
      referrer: 'https://app.example.test/social/listings/listing-id',
      safe: 'preserve me',
      to: '/social/listings/listing-id',
      url: 'https://app.example.test/social/listings/listing-id'
    })
    expect(result.transaction).toBe('/social/listings/listing-id')
    expect(result.spans?.[0]).toMatchObject({
      data: {
        'http.request.header.referer': 'https://app.example.test/social/listings/listing-id',
        'http.target': '/social/listings/listing-id',
        'http.url': 'https://app.example.test/social/listings/listing-id',
        referrer: 'https://app.example.test/social/listings/listing-id',
        url: 'https://app.example.test/social/listings/listing-id',
        'url.full': 'https://app.example.test/social/listings/listing-id'
      },
      description: 'https://app.example.test/social/listings/listing-id'
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
