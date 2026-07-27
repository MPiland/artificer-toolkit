import { expect, type Page, type Response } from '@playwright/test'

type TrpcMethod = 'GET' | 'POST'

type WaitForTrpcOptions = {
  method?: TrpcMethod
  timeout?: number
}

export async function waitForSuccessfulTrpcProcedure(
  page: Page,
  procedure: string,
  options: WaitForTrpcOptions = {}
): Promise<Response> {
  return await waitForSuccessfulTrpcRequest(page, [procedure], options)
}

export async function waitForSuccessfulTrpcBatch(
  page: Page,
  procedures: readonly [string, ...string[]],
  options: WaitForTrpcOptions = {}
): Promise<Response> {
  return await waitForSuccessfulTrpcRequest(page, procedures, options)
}

async function waitForSuccessfulTrpcRequest(
  page: Page,
  procedures: readonly [string, ...string[]],
  options: WaitForTrpcOptions
): Promise<Response> {
  const procedureLabel = procedures.join(',')
  const expectedPathname = `/api/trpc/${procedureLabel}`
  const response = await page.waitForResponse(
    (candidate) => {
      const request = candidate.request()
      return (
        new URL(candidate.url()).pathname === expectedPathname &&
        (!options.method || request.method() === options.method)
      )
    },
    { timeout: options.timeout ?? 30_000 }
  )

  expect(
    response.status(),
    `${procedureLabel} should return a 2xx response`
  ).toBeGreaterThanOrEqual(200)
  expect(response.status(), `${procedureLabel} should return a 2xx response`).toBeLessThan(300)

  const payload: unknown = await response.json().catch(() => undefined)
  expect(hasTopLevelTrpcError(payload), `${procedureLabel} returned a tRPC error payload`).toBe(
    false
  )
  return response
}

export async function runAndWaitForSuccessfulTrpcProcedure(
  page: Page,
  procedure: string,
  action: () => Promise<void>,
  options: WaitForTrpcOptions = {}
): Promise<Response> {
  const responsePromise = waitForSuccessfulTrpcProcedure(page, procedure, options)
  await action()
  return await responsePromise
}

function hasTopLevelTrpcError(payload: unknown): boolean {
  if (Array.isArray(payload)) return payload.some(hasTopLevelTrpcError)
  return isRecord(payload) && Object.prototype.hasOwnProperty.call(payload, 'error')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
