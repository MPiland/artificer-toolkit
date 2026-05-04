export class CharacterBuilderDraftConflictError extends Error {
  constructor(characterId: string) {
    super(`Character "${characterId}" changed after this builder draft was saved. Reload the character before finalizing.`)
    this.name = 'CharacterBuilderDraftConflictError'
  }
}

type RevisionTimestamp = Date | string | null | undefined

function toEpochMs(value: RevisionTimestamp): number | null {
  if (value == null) return null

  const epochMs = value instanceof Date
    ? value.getTime()
    : new Date(value).getTime()

  return Number.isFinite(epochMs) ? epochMs : null
}

export function assertCharacterBuilderDraftRevisionFresh(params: {
  activeUpdatedAt: RevisionTimestamp
  characterId: string
  draftBaseActiveUpdatedAt: RevisionTimestamp
  hasDraft: boolean
}): void {
  const activeUpdatedAtMs = toEpochMs(params.activeUpdatedAt)
  if (activeUpdatedAtMs == null) return

  const draftBaseActiveUpdatedAtMs = toEpochMs(params.draftBaseActiveUpdatedAt)
  if (!params.hasDraft || draftBaseActiveUpdatedAtMs == null || draftBaseActiveUpdatedAtMs !== activeUpdatedAtMs) {
    throw new CharacterBuilderDraftConflictError(params.characterId)
  }
}
