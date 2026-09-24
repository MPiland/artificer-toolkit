const PORTABLE_OMITTED_KEYS = new Set([
  'userId',
  'status',
  'createdAt',
  'updatedAt',
  'revisionId',
  'revisionNumber',
  'activeRevisionId',
  'baseActiveRevisionId',
  'baseActiveUpdatedAt',
  'permissions',
  'provenance'
])

export function stripPortableMetadata(value: unknown): Record<string, unknown> {
  const stripped = stripMetadataValue(value)
  return isRecord(stripped) ? stripped : {}
}

function stripMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMetadataValue)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      PORTABLE_OMITTED_KEYS.has(key) ? [] : [[key, stripMetadataValue(entry)]]
    )
  )
}

export function collectTopLevelReferenceCandidates(
  value: unknown,
  result = new Map<
    string,
    { kind: NonNullable<ReturnType<typeof referenceKindForKey>>; id: string }
  >()
): Array<{ kind: NonNullable<ReturnType<typeof referenceKindForKey>>; id: string }> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectTopLevelReferenceCandidates(entry, result))
    return [...result.values()]
  }
  if (!isRecord(value)) return [...result.values()]
  for (const [key, entry] of Object.entries(value)) {
    const kind = referenceKindForKey(key)
    if (kind) {
      const ids = Array.isArray(entry)
        ? entry.filter((id): id is string => typeof id === 'string')
        : [entry]
      for (const id of ids) {
        if (typeof id === 'string' && id) result.set(`${kind}:${id}`, { kind, id })
      }
    }
    collectTopLevelReferenceCandidates(entry, result)
  }
  return [...result.values()]
}

export function referenceKindForKey(key: string) {
  if (key === 'parentClassId' || key === 'classId' || key === 'classIds') return 'CLASS'
  if (key === 'parentRaceId' || key === 'raceId') return 'RACE'
  if (key === 'backgroundId') return 'BACKGROUND'
  if (key === 'parentEquipmentId' || key === 'equipmentId' || key === 'equipmentIds')
    return 'EQUIPMENT'
  if (key === 'featId' || key === 'featIds') return 'FEAT'
  if (key === 'spellId' || key === 'spellIds') return 'SPELL'
  if (key === 'creatureId' || key === 'creatureIds') return 'CREATURE'
  if (key === 'vehicleId' || key === 'vehicleIds') return 'VEHICLE'
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
