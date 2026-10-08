import type { ImportPreviewResponseDto } from '@artificer-toolkit/schema/api/imports'

export type ImportCustomContentChoice = 'ACTIVE' | 'DRAFT'

export type ImportRelatedContent = NonNullable<
  ImportPreviewResponseDto['items'][number]['relatedContent']
>[number]

export type ImportExistingMatch = NonNullable<
  ImportPreviewResponseDto['items'][number]['existingMatches']
>[number]

export type ImportNotImportedContent = NonNullable<
  ImportPreviewResponseDto['items'][number]['notImported']
>[number]

export function getImportCustomContentKey(
  entryId: string,
  content: Pick<ImportRelatedContent, 'externalId' | 'subjectKind'>
): string {
  return `${entryId}:${content.subjectKind}:${content.externalId}`
}

export function getDefaultImportCustomContentChoice(
  content: ImportRelatedContent
): ImportCustomContentChoice {
  return content.activationEligible && content.destination.kind === 'ACTIVE_AUTHORED_CONTENT'
    ? 'ACTIVE'
    : 'DRAFT'
}
