import { describe, expect, it } from 'vitest'
import {
  clientCpuThrottlingRate,
  clientLatencySummaryLine,
  summarizeClientLatency,
  type ClientLatencyEvidence
} from './clientLatency'

describe('summarizeClientLatency', () => {
  it('records nothing for a measure the pass did not observe', () => {
    expect(summarizeClientLatency('artificer:vtt-scene-render', 'main', [])).toBeNull()
  })

  it('summarizes main-thread durations as throttled, rounded to a tenth of a millisecond', () => {
    expect(summarizeClientLatency('artificer:vtt-scene-render', 'main', [12.34, 30.06, 8])).toEqual(
      {
        measure: 'artificer:vtt-scene-render',
        thread: 'main',
        cpuThrottled: true,
        max: 30.1,
        p50: 12.3,
        p95: 30.1,
        p99: 30.1,
        raw: [12.3, 30.1, 8]
      }
    )
  })

  it('labels worker durations as not throttled, because Chromium throttles pages only', () => {
    expect(
      summarizeClientLatency('artificer:content-snapshot-parse', 'worker', [5])?.cpuThrottled
    ).toBe(false)
  })
})

describe('clientLatencySummaryLine', () => {
  const evidence: ClientLatencyEvidence = {
    journey: 'Builder',
    cpuThrottlingRate: clientCpuThrottlingRate,
    figures: [
      summarizeClientLatency('character-builder:resolution-latency', 'main', [100, 200])!,
      summarizeClientLatency('artificer:content-snapshot-parse', 'worker', [4])!
    ],
    error: null
  }

  it('lists every figure with its thread and throttling', () => {
    expect(clientLatencySummaryLine(evidence)).toBe(
      '- Builder client latency at 6x CPU (recorded, not gated): ' +
        'character-builder:resolution-latency (main) p50 100 ms, p95 200 ms, max 200 ms, n=2; ' +
        'artificer:content-snapshot-parse (worker, not throttled) p50 4 ms, p95 4 ms, max 4 ms, n=1'
    )
  })

  it('records why a pass measured nothing instead of failing the run', () => {
    expect(
      clientLatencySummaryLine({ ...evidence, figures: [], error: 'Timeout 60000ms exceeded.' })
    ).toBe(
      '- Builder client latency at 6x CPU (recorded, not gated): not recorded: Timeout 60000ms exceeded.'
    )
    expect(clientLatencySummaryLine({ ...evidence, figures: [] })).toBe(
      '- Builder client latency at 6x CPU (recorded, not gated): no measure observed'
    )
  })
})
