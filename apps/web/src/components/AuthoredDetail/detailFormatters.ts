const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return 'Not set'

  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatCount(count: number | null | undefined, singular: string, plural = `${singular}s`): string {
  const safeCount = count ?? 0
  return `${safeCount} ${safeCount === 1 ? singular : plural}`
}

export function formatReference(value: string | null | undefined, fallback = 'Configured'): string {
  if (!value) return 'Not set'
  return uuidPattern.test(value) ? fallback : formatEnumLabel(value)
}

export function formatReferenceList(values: readonly string[] | null | undefined, fallback: string): string {
  if (!values?.length) return 'None'

  const visibleValues = values
    .filter((value) => !uuidPattern.test(value))
    .map(formatEnumLabel)

  if (visibleValues.length) return visibleValues.join(', ')

  return formatCount(values.length, fallback)
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''

  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function summarizeHtml(html: string | null | undefined, fallback: string): string {
  const text = stripHtml(html)
  if (!text) return fallback
  return text.length > 190 ? `${text.slice(0, 187).trim()}...` : text
}

export function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (value == null) return 'Not set'
  return `${value}${suffix}`
}
