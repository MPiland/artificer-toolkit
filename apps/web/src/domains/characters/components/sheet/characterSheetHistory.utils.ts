const historyDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
})

export function formatHistoryTimestamp(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : historyDateFormatter.format(date)
}

export function formatHistoryEventType(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase()
}
