import { describe, expect, it } from 'vitest'
import {
  enforcedLatencyMisses,
  latencyLimits,
  measureLatency,
  type ConvergenceLatency
} from './latencyGate'

const withinLimits: ConvergenceLatency = {
  sceneOnly: { p95: 100, p99: 100 },
  ruleBound: { p95: 100, p99: 100 },
  authoritative: { p95: latencyLimits.authoritativeP95, p99: 0 },
  ephemeral: { p95: latencyLimits.ephemeralP95, p99: 0 },
  durable: { p95: latencyLimits.durableP95, p99: latencyLimits.durableP99 }
}
const slowEphemeral: ConvergenceLatency = {
  ...withinLimits,
  ephemeral: { p95: latencyLimits.ephemeralP95 + 192, p99: 0 }
}

describe('browser journey latency gate (D210)', () => {
  it('keeps the limits the journeys were specified with', () => {
    expect(latencyLimits).toEqual({
      authoritativeP95: 1000,
      durableP95: 250,
      durableP99: 500,
      ephemeralP95: 150,
      ruleConvergenceP95: 1500,
      sceneConvergenceP95: 1500
    })
  })

  it('measures inclusive and exclusive limits at their boundary', () => {
    const measures = measureLatency({
      ...withinLimits,
      sceneOnly: { p95: latencyLimits.sceneConvergenceP95, p99: 0 }
    })
    expect(measures.filter(({ withinLimit }) => !withinLimit).map(({ limit }) => limit)).toEqual([
      'sceneConvergenceP95'
    ])
  })

  it('skips figures that were not observed', () => {
    expect(
      measureLatency({
        sceneOnly: null,
        ruleBound: null,
        authoritative: null,
        ephemeral: null,
        durable: null
      })
    ).toEqual([])
  })

  it('fails a managed target that misses a limit', () => {
    const misses = enforcedLatencyMisses(measureLatency(slowEphemeral), 'MANAGED')
    expect(misses).toEqual([
      { limit: 'ephemeralP95', observedMs: 342, limitMs: 150, withinLimit: false }
    ])
  })

  it('records without failing a LOCAL (CI or developer) run that misses a limit', () => {
    const measures = measureLatency(slowEphemeral)
    expect(measures.some(({ withinLimit }) => !withinLimit)).toBe(true)
    expect(enforcedLatencyMisses(measures, 'LOCAL')).toEqual([])
  })

  it('passes a managed target within every limit', () => {
    expect(enforcedLatencyMisses(measureLatency(withinLimits), 'MANAGED')).toEqual([])
  })
})
