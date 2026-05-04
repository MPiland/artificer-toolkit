export class CharacterBuilderDraftConflictError extends Error {
  constructor(characterId: string) {
    super(`Character "${characterId}" changed after this builder draft was saved. Reload the character before finalizing.`)
    this.name = 'CharacterBuilderDraftConflictError'
  }
}

type RevisionTimestamp = Date | string | null | undefined

function toComparableRevision(value: RevisionTimestamp): string | null {
  if (value == null) return null

  if (value instanceof Date) {
    return value.toISOString()
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function assertCharacterBuilderDraftRevisionFresh(params: {
  activeUpdatedAt: RevisionTimestamp
  characterId: string
  draftBaseActiveUpdatedAt: RevisionTimestamp
  hasDraft: boolean
}): void {
  const activeUpdatedAt = toComparableRevision(params.activeUpdatedAt)
  if (activeUpdatedAt == null) return

  const draftBaseActiveUpdatedAt = toComparableRevision(params.draftBaseActiveUpdatedAt)
  if (!params.hasDraft || draftBaseActiveUpdatedAt == null || draftBaseActiveUpdatedAt !== activeUpdatedAt) {
    throw new CharacterBuilderDraftConflictError(params.characterId)
  }
}
