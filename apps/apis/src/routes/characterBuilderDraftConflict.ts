export class CharacterBuilderDraftConflictError extends Error {
  constructor(characterId: string) {
    super(`Character "${characterId}" changed after this builder draft was saved. Reload the character before finalizing.`)
    this.name = 'CharacterBuilderDraftConflictError'
  }
}

type RevisionTimestamp = Date | string | null | undefined

const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:\s*(Z|[+-]\d{2}(?::?\d{2})?))?$/

function getOffsetSeconds(offset: string | undefined): number {
  if (offset == null || offset === 'Z') return 0

  const sign = offset.startsWith('-') ? -1 : 1
  const digits = offset.slice(1).replace(':', '')
  const hours = Number(digits.slice(0, 2))
  const minutes = Number(digits.slice(2, 4) || '0')

  return sign * ((hours * 60 + minutes) * 60)
}

function toComparableRevision(value: RevisionTimestamp): string | null {
  if (value == null) return null

  if (value instanceof Date) {
    return toComparableRevision(value.toISOString())
  }

  const normalized = value.trim()
  if (normalized.length === 0) return null

  const match = TIMESTAMP_PATTERN.exec(normalized)
  if (!match) return normalized

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
    fraction = '',
    offset
  ] = match
  const epochSeconds = Math.trunc(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) / 1000) - getOffsetSeconds(offset)

  if (!Number.isFinite(epochSeconds)) return normalized

  return `${epochSeconds}.${fraction.padEnd(6, '0')}`
}

export function assertCharacterBuilderDraftRevisionFresh(params: {
  activeUpdatedAt: RevisionTimestamp
  baseActiveUpdatedAt: RevisionTimestamp
  characterId: string
  shouldCheckRevision: boolean
}): void {
  const activeUpdatedAt = toComparableRevision(params.activeUpdatedAt)
  if (activeUpdatedAt == null) return

  if (!params.shouldCheckRevision) return

  const baseActiveUpdatedAt = toComparableRevision(params.baseActiveUpdatedAt)
  if (baseActiveUpdatedAt == null || baseActiveUpdatedAt !== activeUpdatedAt) {
    throw new CharacterBuilderDraftConflictError(params.characterId)
  }
}
