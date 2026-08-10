import { richHtmlToPlainText } from '#lib/richText'

export function summarizeAuthoredDescription(description: string | null | undefined): string {
  return (description ? richHtmlToPlainText(description) : '') || 'No description yet.'
}
