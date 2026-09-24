import { describe, expect, it } from 'vitest'
import { clockDisplayTime, hasCorrectionReason } from './campaignClockTime'

describe('Campaign clock corrections', () => {
  it('requires an explicit reason for rewind and reset', () => {
    expect(hasCorrectionReason('   ')).toBe(false)
    expect(hasCorrectionReason('Corrected a mistaken advance')).toBe(true)
  })

  it('advances the display across midnight without changing durable clock state', () => {
    const clock = {
      campaignId: 'campaign',
      day: 2,
      minuteOfDay: 1439,
      running: true,
      runningSince: '2026-09-09T12:00:00.000Z',
      dawnMinute: 360,
      duskMinute: 1080,
      processedBoundaryAbsoluteMinute: 2879,
      version: 4,
      updatedAt: '2026-09-09T12:00:00.000Z'
    }
    expect(clockDisplayTime(clock, Date.parse('2026-09-09T12:02:00.000Z'))).toEqual({
      day: 3,
      minuteOfDay: 1
    })
    expect(clockDisplayTime(clock, Date.parse('2026-09-09T11:59:00.000Z'))).toEqual({
      day: 2,
      minuteOfDay: 1439
    })
    expect(
      clockDisplayTime({ ...clock, running: false }, Date.parse('2026-09-09T12:02:00.000Z'))
    ).toEqual({ day: 2, minuteOfDay: 1439 })
    expect(clock.version).toBe(4)
    expect(clock.processedBoundaryAbsoluteMinute).toBe(2879)
  })
})
