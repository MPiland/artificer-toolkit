import { summarizeTimings } from './latencyGate'

/**
 * CPU slowdown of the throttled browser journey pass (PERF-6.3). Chrome DevTools calibrates its
 * mid-tier mobile preset to about 4x on a developer machine (3.7x in its own example; Lighthouse
 * also uses 4x) and its low-tier preset slower still, so 6x stands in for a low-end device. The rate
 * is relative to the host and the runner is not calibrated, so compare figures across like runners only.
 */
export const clientCpuThrottlingRate = 6

/** Chromium throttles a page's main thread only; it refuses `Emulation.setCPUThrottlingRate` on workers. */
export type ClientLatencyThread = 'main' | 'worker'

export type ClientLatencyFigure = {
  /** The product's performance measure, such as `character-builder:resolution-latency`. */
  measure: string
  thread: ClientLatencyThread
  cpuThrottled: boolean
} & ReturnType<typeof summarizeTimings>

/** One throttled pass's record: what it measured, or why it measured nothing. It never fails a run. */
export interface ClientLatencyEvidence {
  journey: string
  cpuThrottlingRate: number
  figures: ClientLatencyFigure[]
  error: string | null
}

/** Summarizes one measure's durations, or null when the pass did not observe it. */
export function summarizeClientLatency(
  measure: string,
  thread: ClientLatencyThread,
  durations: readonly number[]
): ClientLatencyFigure | null {
  if (durations.length === 0) return null
  const rounded = durations.map((duration) => Math.round(duration * 10) / 10)
  return { measure, thread, cpuThrottled: thread === 'main', ...summarizeTimings(rounded) }
}

/** The run summary's Markdown bullet for one pass (`$GITHUB_STEP_SUMMARY`). */
export function clientLatencySummaryLine(evidence: ClientLatencyEvidence): string {
  const figures = evidence.figures.map(
    ({ cpuThrottled, max, measure, p50, p95, raw, thread }) =>
      `${measure} (${thread}${cpuThrottled ? '' : ', not throttled'}) p50 ${p50} ms, p95 ${p95} ms, max ${max} ms, n=${raw.length}`
  )
  const detail = [
    ...figures,
    ...(evidence.error ? [`not recorded: ${evidence.error}`] : []),
    ...(figures.length === 0 && !evidence.error ? ['no measure observed'] : [])
  ].join('; ')
  return `- ${evidence.journey} client latency at ${evidence.cpuThrottlingRate}x CPU (recorded, not gated): ${detail}`
}
