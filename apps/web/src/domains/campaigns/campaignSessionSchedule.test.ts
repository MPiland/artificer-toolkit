import { describe, expect, it } from 'vitest'
import { fromSessionLocalDateTime, toSessionLocalDateTime } from './campaignSessionSchedule'

describe('Campaign Session scheduling', () => {
  it('round trips a Session time in its selected zone', () => {
    const local = '2026-08-08T19:30'
    const instant = fromSessionLocalDateTime(local, 'America/Chicago')

    expect(toSessionLocalDateTime(instant, 'America/Chicago')).toBe(local)
  })

  it('keeps the same instant readable in another zone', () => {
    const instant = fromSessionLocalDateTime('2026-08-08T19:30', 'America/Chicago')

    expect(toSessionLocalDateTime(instant, 'UTC')).toBe('2026-08-09T00:30')
  })
})
