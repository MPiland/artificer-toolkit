import type { BrowserOptions, Event } from '@sentry/tanstackstart-react'

const URL_BREADCRUMB_KEYS = ['url', 'referer', 'referrer', 'from', 'to'] as const
const URL_SPAN_ATTRIBUTE_KEYS = new Set([
  'url',
  'url.full',
  'http.url',
  'http.target',
  'referer',
  'referrer'
])
const HTTP_HEADER_SPAN_ATTRIBUTE = /^http\.(?:request|response)\.header\./
const QUERY_SPAN_ATTRIBUTE_KEYS = new Set([
  'url.query',
  'url.fragment',
  'http.query',
  'http.fragment'
])
const ROUTE_PARAMETER_SPAN_ATTRIBUTE_PREFIX = 'url.path.parameter.'
const SENSITIVE_HEADER_DENYLIST = ['forwarded', '-ip', 'remote-', 'via', '-user']

type StreamedSpan = Parameters<NonNullable<BrowserOptions['beforeSendSpan']>>[0]

function isUrlLike(value: string): boolean {
  return value.startsWith('/') || /^https?:\/\//i.test(value)
}

export function scrubSentryUrl(value: string): string {
  if (!isUrlLike(value)) return value

  return value.split(/[?#]/, 1)[0]
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

  return event
}

function scrubAttributeValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubSentryUrl(value)
  if (Array.isArray(value)) return value.map(scrubAttributeValue)
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return { ...value, value: scrubAttributeValue(value.value) }
  }
  return value
}

/** Span streaming (the v11 default) sends spans individually, so `beforeSendTransaction` never runs. */
export function redactSentrySpan(span: StreamedSpan): StreamedSpan {
  span.name = scrubSentryUrl(span.name)

  for (const [key, value] of Object.entries(span.attributes)) {
    if (
      QUERY_SPAN_ATTRIBUTE_KEYS.has(key) ||
      key.startsWith(ROUTE_PARAMETER_SPAN_ATTRIBUTE_PREFIX)
    ) {
      delete span.attributes[key]
    } else if (URL_SPAN_ATTRIBUTE_KEYS.has(key) || HTTP_HEADER_SPAN_ATTRIBUTE.test(key)) {
      span.attributes[key] = scrubAttributeValue(value)
    }
  }

  return span
}

/** Logs and metrics are not collected: nothing here emits them, and they carry no redaction path. */
function dropSentryTelemetry(): null {
  return null
}

/** The v10 `sendDefaultPii: false` baseline; v11 widens collection when `dataCollection` is unset. */
const SENTRY_DATA_COLLECTION: NonNullable<BrowserOptions['dataCollection']> = {
  cookies: false,
  databaseQueryData: false,
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
  httpBodies: [],
  httpHeaders: {
    request: { deny: SENSITIVE_HEADER_DENYLIST },
    response: { deny: SENSITIVE_HEADER_DENYLIST }
  },
  queues: false,
  urlQueryParams: { deny: SENSITIVE_HEADER_DENYLIST },
  userInfo: false
}

/** Privacy hooks and collection baseline shared by the browser and Worker Sentry options. */
export const sentryPrivacyOptions = {
  beforeSend: redactSentryEvent,
  beforeSendLog: dropSentryTelemetry,
  beforeSendMetric: dropSentryTelemetry,
  beforeSendSpan: redactSentrySpan,
  dataCollection: SENTRY_DATA_COLLECTION
}
