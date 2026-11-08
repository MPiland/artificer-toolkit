const limits = {
  authoritativeP95: 1000,
  durableP95: 250,
  durableP99: 500,
  ephemeralP95: 150,
  ruleConvergenceP95: 1500,
  sceneConvergenceP95: 1500
}

/** Where a browser journey runs. Only MANAGED (staging, real Cloudflare and hosted Convex) gates on wall-clock latency (D210). */
export type LatencyTopology = 'LOCAL' | 'MANAGED'

export type LatencyLimitName = keyof typeof limits

type Percentiles = { p95: number; p99: number } | null

export interface ConvergenceLatency {
  sceneOnly: Percentiles
  ruleBound: Percentiles
  authoritative: Percentiles
  ephemeral: Percentiles
  durable: Percentiles
}

export interface LatencyMeasure {
  limit: LatencyLimitName
  observedMs: number
  limitMs: number
  withinLimit: boolean
}

export const latencyLimits: Readonly<Record<LatencyLimitName, number>> = limits

function nearestRank(values: readonly number[], percentile: number): number {
  if (values.length === 0) throw new Error('A latency summary needs at least one sample.')
  return [...values].sort((left, right) => left - right)[Math.ceil(values.length * percentile) - 1]!
}

/** The nearest-rank summary every browser journey latency record uses. */
export function summarizeTimings(values: readonly number[]) {
  return {
    max: Math.max(...values),
    p50: nearestRank(values, 0.5),
    p95: nearestRank(values, 0.95),
    p99: nearestRank(values, 0.99),
    raw: values
  }
}

/** Scene and rule limits are exclusive; every other limit is inclusive. */
const exclusiveLimits: ReadonlySet<LatencyLimitName> = new Set([
  'sceneConvergenceP95',
  'ruleConvergenceP95'
])

/** Measures every observed convergence figure against its limit; the caller decides whether a miss fails the run. */
export function measureLatency(summary: ConvergenceLatency): LatencyMeasure[] {
  const observed: [LatencyLimitName, number | undefined][] = [
    ['sceneConvergenceP95', summary.sceneOnly?.p95],
    ['ruleConvergenceP95', summary.ruleBound?.p95],
    ['authoritativeP95', summary.authoritative?.p95],
    ['ephemeralP95', summary.ephemeral?.p95],
    ['durableP95', summary.durable?.p95],
    ['durableP99', summary.durable?.p99]
  ]
  return observed.flatMap(([limit, observedMs]) =>
    observedMs === undefined
      ? []
      : [
          {
            limit,
            observedMs,
            limitMs: latencyLimits[limit],
            withinLimit: exclusiveLimits.has(limit)
              ? observedMs < latencyLimits[limit]
              : observedMs <= latencyLimits[limit]
          }
        ]
  )
}

/** The misses that fail the run: all of them against a managed target, none for LOCAL (CI and developer machines), which only record. */
export function enforcedLatencyMisses(
  measures: readonly LatencyMeasure[],
  topology: LatencyTopology
): LatencyMeasure[] {
  return topology === 'MANAGED' ? measures.filter(({ withinLimit }) => !withinLimit) : []
}
