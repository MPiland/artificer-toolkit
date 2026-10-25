import type { ReferenceOption } from '#app/data/contentReferences'
import { richHtmlToPlainText } from '#lib/richText'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return 'Not set'

  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatCount(
  count: number | null | undefined,
  singular: string,
  plural = `${singular}s`
): string {
  const safeCount = count ?? 0
  return `${safeCount} ${safeCount === 1 ? singular : plural}`
}

export function formatReference(value: string | null | undefined, fallback = 'Configured'): string {
  if (!value) return 'Not set'
  return uuidPattern.test(value) ? fallback : formatEnumLabel(value)
}

export function formatReferenceLabel(
  value: string | null | undefined,
  fallback = 'Configured',
  options: readonly ReferenceOption[] = []
): string {
  if (!value) return 'Not set'
  return options.find((option) => option.value === value)?.label ?? formatReference(value, fallback)
}

export function formatReferenceList(
  values: readonly string[] | null | undefined,
  fallback: string
): string {
  if (!values?.length) return 'None'

  const visibleValues = values.filter((value) => !uuidPattern.test(value)).map(formatEnumLabel)

  if (visibleValues.length) return visibleValues.join(', ')

  return formatCount(values.length, fallback)
}

export function formatReferenceLabelList(
  values: readonly string[] | null | undefined,
  fallback: string,
  options: readonly ReferenceOption[] = []
): string {
  if (!values?.length) return 'None'

  const labels = values
    .map(
      (value) =>
        options.find((option) => option.value === value)?.label ??
        (uuidPattern.test(value) ? null : formatEnumLabel(value))
    )
    .filter((label): label is string => Boolean(label))

  if (labels.length) return labels.join(', ')

  return formatCount(values.length, fallback)
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return richHtmlToPlainText(html)
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (value == null) return 'Not set'
  return `${value}${suffix}`
}
