import { appendFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import {
  clientCpuThrottlingRate,
  clientLatencySummaryLine,
  summarizeClientLatency,
  type ClientLatencyEvidence
} from '../src/test/clientLatency'

type ObservedMeasure = { name: string; duration: number }

/**
 * Collects every main-thread measure into the page, surviving reloads through the init script. The
 * observer sees measures the product clears as it records them; a second install only empties it.
 */
function observeMeasures(): void {
  const page = window as unknown as { __clientLatencyMeasures?: ObservedMeasure[] }
  if (page.__clientLatencyMeasures) {
    page.__clientLatencyMeasures.length = 0
    return
  }
  const measures: ObservedMeasure[] = []
  page.__clientLatencyMeasures = measures
  new PerformanceObserver((list) => {
    for (const { name, duration } of list.getEntries()) measures.push({ name, duration })
  }).observe({ type: 'measure', buffered: false })
}

/**
 * Runs `work` with the page's main thread CPU-throttled (PERF-6.3) and records the named product
 * measures as evidence: a JSON line in the proof's log and a bullet in the run summary. It never
 * fails the run: a failure inside `work` is recorded, and the throttle is always reset. Worker
 * measures are read from each live worker's timeline and are labelled not throttled.
 */
export async function recordThrottledClientLatency(
  page: Page,
  journey: string,
  measures: readonly string[],
  work: () => Promise<unknown>
): Promise<ClientLatencyEvidence> {
  const since = Date.now()
  let error: string | null = null
  const cdp = await page.context().newCDPSession(page)
  try {
    await page.addInitScript(observeMeasures)
    await page.evaluate(observeMeasures)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: clientCpuThrottlingRate })
    await work()
  } catch (caught) {
    error = (caught instanceof Error ? caught.message : String(caught)).split('\n')[0]!
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => undefined)
    await cdp.detach().catch(() => undefined)
  }

  const mainThread = await page
    .evaluate(
      () =>
        (window as unknown as { __clientLatencyMeasures?: ObservedMeasure[] })
          .__clientLatencyMeasures ?? []
    )
    .catch(() => [])
  const workerThreads = await Promise.all(
    page.workers().map((worker) =>
      worker
        .evaluate(
          (startedAt) =>
            performance
              .getEntriesByType('measure')
              .filter(({ startTime }) => performance.timeOrigin + startTime >= startedAt)
              .map(({ name, duration }) => ({ name, duration })),
          since
        )
        .catch(() => [])
    )
  )
  const durations = (observed: readonly ObservedMeasure[], measure: string) =>
    observed.filter(({ name }) => name === measure).map(({ duration }) => duration)
  const evidence: ClientLatencyEvidence = {
    journey,
    cpuThrottlingRate: clientCpuThrottlingRate,
    figures: measures.flatMap((measure) =>
      [
        summarizeClientLatency(measure, 'main', durations(mainThread, measure)),
        summarizeClientLatency(measure, 'worker', durations(workerThreads.flat(), measure))
      ].filter((figure) => figure !== null)
    ),
    error
  }

  console.info(
    `Client latency under CPU throttling (recorded, not gated): ${JSON.stringify(evidence)}`
  )
  const runSummary = process.env.GITHUB_STEP_SUMMARY
  if (runSummary)
    await appendFile(runSummary, `${clientLatencySummaryLine(evidence)}\n`).catch(() => undefined)
  return evidence
}
