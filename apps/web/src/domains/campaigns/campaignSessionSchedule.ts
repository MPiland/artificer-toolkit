export function toSessionLocalDateTime(value: string | null, timeZone: string | null): string {
  if (!value) return ''
  const zone = timeZone ?? browserTimeZone()
  const parts = sessionDateTimeParts(new Date(value), zone)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function fromSessionLocalDateTime(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error('Session time is invalid.')
  const [, year, month, day, hour, minute] = match
  const wallClock = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  )
  let instant = wallClock
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = sessionDateTimeParts(new Date(instant), timeZone)
    const renderedWallClock = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    )
    instant += wallClock - renderedWallClock
  }
  const result = new Date(instant)
  const roundTrip = sessionDateTimeParts(result, timeZone)
  const normalized = `${roundTrip.year}-${roundTrip.month}-${roundTrip.day}T${roundTrip.hour}:${roundTrip.minute}`
  if (normalized !== value)
    throw new Error('That local time does not exist in the selected time zone.')
  return result.toISOString()
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function supportedSessionTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone')
  return [browserTimeZone(), 'UTC'].filter(
    (value, index, values) => values.indexOf(value) === index
  )
}

function sessionDateTimeParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute')
  }
}
