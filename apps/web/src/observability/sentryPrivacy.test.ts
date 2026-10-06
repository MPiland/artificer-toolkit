import type { Event } from '@sentry/tanstackstart-react'
import { describe, expect, it } from 'vitest'
import { redactSentryEvent, redactSentrySpan, sentryPrivacyOptions } from './sentryPrivacy'

describe('redactSentrySpan', () => {
  it('scrubs the span name, URL attributes, header arrays, and route parameters', () => {
    const span = redactSentrySpan({
      attributes: {
        'http.request.header.referer': [
          'https://app.example.test/social/listings/listing-id?message=private#fragment'
        ],
        'http.request.header.x-request-id': ['safe-request-id'],
        'http.response.header.location': ['/campaigns/abc?tab=overview'],
        'http.route': '/social/listings/$listingId',
        'url.fragment': 'fragment',
        'url.full': 'https://app.example.test/social/listings/listing-id?message=private',
        'url.path.parameter.listingId': 'listing-id',
        'url.query': 'message=private'
      },
      is_segment: true,
      name: 'https://app.example.test/social/listings/listing-id?message=private',
      span_id: 'span-id',
      start_timestamp: 1,
      status: 'ok',
      trace_id: 'trace-id'
    })

    expect(span.name).toBe('https://app.example.test/social/listings/listing-id')
    expect(span.attributes).toEqual({
      'http.request.header.referer': ['https://app.example.test/social/listings/listing-id'],
      'http.request.header.x-request-id': ['safe-request-id'],
      'http.response.header.location': ['/campaigns/abc'],
      'http.route': '/social/listings/$listingId',
      'url.full': 'https://app.example.test/social/listings/listing-id'
    })
  })

  it('scrubs URL-shaped span names and attribute objects', () => {
    const span = redactSentrySpan({
      attributes: {
        'http.target': { value: '/social/listings/listing-id?view=detail' },
        'url.query': { value: 'message=private' }
      },
      is_segment: false,
      name: '/social/listings/listing-id?message=private#fragment',
      span_id: 'span-id',
      start_timestamp: 1,
      status: 'ok',
      trace_id: 'trace-id'
    })

    expect(span.name).toBe('/social/listings/listing-id')
    expect(span.attributes).toEqual({ 'http.target': { value: '/social/listings/listing-id' } })
  })
})

describe('sentryPrivacyOptions', () => {
  it('pins the v10 collection baseline and drops logs and metrics', () => {
    const { beforeSendLog, beforeSendMetric, dataCollection } = sentryPrivacyOptions
    const sensitiveHeaders = { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] }

    expect(dataCollection).toEqual({
      cookies: false,
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
      httpBodies: [],
      httpHeaders: { request: sensitiveHeaders, response: sensitiveHeaders },
      queues: false,
      urlQueryParams: sensitiveHeaders,
      userInfo: false
    })
    expect(beforeSendLog()).toBeNull()
    expect(beforeSendMetric()).toBeNull()
  })
})

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
