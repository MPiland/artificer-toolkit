import type { CampaignClockDto } from '@artificer-toolkit/schema/api/campaignSessions'

export function parseTime(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':')
  return Number(hours) * 60 + Number(minutes)
}

export function formatTime(minuteOfDay: number) {
  return `${Math.floor(minuteOfDay / 60)
    .toString()
    .padStart(2, '0')}:${(minuteOfDay % 60).toString().padStart(2, '0')}`
}

export function hasCorrectionReason(value: string) {
  return value.trim().length > 0
}

// Display elapsed time between native updates; only the server applies recovery and versions.
export function clockDisplayTime(clock: CampaignClockDto, now: number) {
  const elapsed =
    clock.running && clock.runningSince
      ? Math.max(0, Math.floor((now - Date.parse(clock.runningSince)) / 60_000))
      : 0
  const minute = clock.minuteOfDay + elapsed
  return { day: clock.day + Math.floor(minute / 1440), minuteOfDay: minute % 1440 }
}
