import type { Event } from '@sentry/tanstackstart-react'

const URL_BREADCRUMB_KEYS = ['url', 'referer', 'referrer', 'from', 'to'] as const
const URL_SPAN_DATA_KEYS = [
  'url',
  'url.full',
  'http.url',
  'http.target',
  'referer',
  'referrer',
  'http.request.header.referer',
  'http.request.header.referrer'
] as const
const QUERY_SPAN_DATA_KEYS = ['url.query', 'http.query'] as const
const INVITE_PATH_PATTERN = /\/campaigns\/invite\/[^/?#]+/g

function isUrlLike(value: string): boolean {
  return value.startsWith('/') || /^https?:\/\//i.test(value)
}

export function scrubSentryUrl(value: string): string {
  if (!isUrlLike(value)) return value

  const pathWithoutQueryOrFragment = value.split(/[?#]/, 1)[0]
  return pathWithoutQueryOrFragment.replace(INVITE_PATH_PATTERN, '/campaigns/invite/[redacted]')
}

function scrubUrlValue(value: unknown): string | undefined {
  return typeof value === 'string' ? scrubSentryUrl(value) : undefined
}

export function redactSentryEvent<T extends Event>(event: T): T {
  if (event.request) {
    const requestUrl = scrubUrlValue(event.request.url)
    if (requestUrl !== undefined) event.request.url = requestUrl

    delete event.request.query_string

    for (const headerName of Object.keys(event.request.headers ?? {})) {
      if (/^referr?er$/i.test(headerName)) {
        delete event.request.headers?.[headerName]
      }
    }
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    for (const key of URL_BREADCRUMB_KEYS) {
      const url = scrubUrlValue(breadcrumb.data?.[key])
      if (url !== undefined && breadcrumb.data) breadcrumb.data[key] = url
    }
  }

  const transaction = scrubUrlValue(event.transaction)
  if (transaction !== undefined) event.transaction = transaction

  for (const span of event.spans ?? []) {
    const description = scrubUrlValue(span.description)
    if (description !== undefined) span.description = description

    for (const key of URL_SPAN_DATA_KEYS) {
      const url = scrubUrlValue(span.data[key])
      if (url !== undefined) span.data[key] = url
    }
    for (const key of QUERY_SPAN_DATA_KEYS) {
      delete span.data[key]
    }
  }

  return event
}
