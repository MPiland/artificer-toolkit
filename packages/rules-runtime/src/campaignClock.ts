import type { CampaignClockDto } from '@artificer-toolkit/schema/api/campaignSessions'

export function absoluteMinute(day: number, minuteOfDay: number): number {
  return (day - 1) * 1440 + minuteOfDay
}

/** A round is six seconds: ten rounds make a Campaign minute, and a started minute counts in full. */
export const ROUNDS_PER_CAMPAIGN_MINUTE = 10

export function campaignMinutesForRounds(rounds: number): number {
  return Math.ceil(rounds / ROUNDS_PER_CAMPAIGN_MINUTE)
}

export function splitAbsoluteMinute(value: number): { day: number; minuteOfDay: number } {
  return { day: Math.floor(value / 1440) + 1, minuteOfDay: value % 1440 }
}

// Clock commands are atomic: no resource can be used between repeated boundaries of the same
// kind. Only the latest occurrence is needed to preserve the final recovery state.
export function latestBoundaryOccurrences(
  fromAbsolute: number,
  targetAbsolute: number,
  dawnMinute: number,
  duskMinute: number
): Array<{ absolute: number; kind: 'DAILY' | 'DAWN' | 'DUSK'; order: number }> {
  if (targetAbsolute < fromAbsolute) return []
  const targetMinuteOfDay = targetAbsolute % 1440
  const targetDayStart = targetAbsolute - targetMinuteOfDay
  return [
    { kind: 'DAILY' as const, minute: 0, order: 0 },
    { kind: 'DAWN' as const, minute: dawnMinute, order: 1 },
    { kind: 'DUSK' as const, minute: duskMinute, order: 2 }
  ]
    .map(({ kind, minute, order }) => ({
      absolute: targetDayStart - (minute <= targetMinuteOfDay ? 0 : 1440) + minute,
      kind,
      order
    }))
    .filter(({ absolute }) => absolute >= fromAbsolute)
    .sort((left, right) => left.absolute - right.absolute || left.order - right.order)
}

export function deriveClock(
  clock: CampaignClockDto,
  now: string
): { clock: CampaignClockDto; elapsedMinutes: number } {
  if (!clock.running || !clock.runningSince) return { clock, elapsedMinutes: 0 }
  // ponytail: one real minute equals one game minute; add a speed setting only if play proves it necessary.
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.parse(now) - Date.parse(clock.runningSince)) / 60_000)
  )
  if (elapsedMinutes === 0) return { clock, elapsedMinutes: 0 }
  const next = splitAbsoluteMinute(absoluteMinute(clock.day, clock.minuteOfDay) + elapsedMinutes)
  const runningSince = new Date(
    Date.parse(clock.runningSince) + elapsedMinutes * 60_000
  ).toISOString()
  return {
    clock: { ...clock, ...next, runningSince, updatedAt: now },
    elapsedMinutes
  }
}
