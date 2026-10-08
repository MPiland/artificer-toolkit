import type { Page, Request, Response, TestInfo } from '@playwright/test'

type AuditNetworkRecord = {
  durationMs: number | null
  error?: string
  method: string
  resourceType: string
  status: number | null
  url: string
}

type MutableRecord = AuditNetworkRecord & { startedAt: number }

type AuditNetworkCapture = {
  records: () => AuditNetworkRecord[]
  attach: (testInfo: TestInfo, name: string) => Promise<void>
  dispose: () => void
}

export function captureAuditNetwork(page: Page): AuditNetworkCapture {
  const starts = new Map<Request, MutableRecord>()
  const completed: AuditNetworkRecord[] = []

  const onRequest = (request: Request) => {
    const startedAt = Date.now()
    starts.set(request, {
      durationMs: null,
      method: request.method(),
      resourceType: request.resourceType(),
      startedAt,
      status: null,
      url: request.url()
    })
  }

  const onResponse = (response: Response) => {
    const request = response.request()
    const started = starts.get(request)
    if (!started) return

    starts.delete(request)
    completed.push({
      durationMs: Date.now() - started.startedAt,
      method: started.method,
      resourceType: started.resourceType,
      status: response.status(),
      url: started.url
    })
  }

  const onRequestFailed = (request: Request) => {
    const started = starts.get(request)
    if (!started) return

    starts.delete(request)
    completed.push({
      durationMs: Date.now() - started.startedAt,
      error: request.failure()?.errorText ?? 'request failed',
      method: started.method,
      resourceType: started.resourceType,
      status: null,
      url: started.url
    })
  }

  page.on('request', onRequest)
  page.on('response', onResponse)
  page.on('requestfailed', onRequestFailed)

  return {
    records: () => [...completed],
    attach: async (testInfo, name) => {
      await testInfo.attach(name, {
        body: JSON.stringify(completed, null, 2),
        contentType: 'application/json'
      })
    },
    dispose: () => {
      page.off('request', onRequest)
      page.off('response', onResponse)
      page.off('requestfailed', onRequestFailed)
    }
  }
}

export function countMutationRequests(records: AuditNetworkRecord[]): number {
  return records.filter((record) => record.method !== 'GET' && record.method !== 'HEAD').length
}
