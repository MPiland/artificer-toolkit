import type { DBLike } from '@artificer-toolkit/db'
import {
  createAuthoredContentRepository,
  createAuthoredImportRefRepository
} from '@artificer-toolkit/db'
import type { ArtificerPortableContentDto } from '@artificer-toolkit/schema/api/imports'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'

import type { AuthoredDomainRuntimeConfig } from '../authoredContent/index.js'
import { sanitizeImportedValue } from './importParsers.js'

export function normalizeImportedAuthoredPayload(
  raw: Record<string, unknown>,
  subjectKind: AuthoredSubjectKindDto,
  subjectId: string,
  label: string,
  systemId: string,
  userId: string,
  createId: () => string,
  regenerateOwnedIds: boolean,
  rootIdMap: ReadonlyMap<string, string>
): Record<string, unknown> {
  const stripped = stripPortableMetadata(sanitizeImportedValue(raw))
  const ownedIdMap = regenerateOwnedIds
    ? collectOwnedIdMap(stripped, createId)
    : new Map<string, string>()
  const rootId = readString(stripped.id)
  if (rootId) ownedIdMap.set(rootId, subjectId)
  const remapped = remapImportedIds(stripped, ownedIdMap, rootIdMap, createId)
  const remappedRecord = isRecord(remapped) ? remapped : {}
  return {
    ...remappedRecord,
    ...(subjectKind === 'EQUIPMENT' ? { kind: 'EQUIPMENT' } : {}),
    id: subjectId,
    label,
    status: 'DRAFT',
    systemId,
    userId
  }
}

export function isCompleteExternalCustomContent(
  config: Pick<AuthoredDomainRuntimeConfig, 'schema'>,
  payload: Record<string, unknown>
): boolean {
  return !containsEmptyIdentifier(payload) && config.schema.safeParse(payload).success
}

export function stripPortableMetadata(value: unknown): Record<string, unknown> {
  const stripped = stripMetadataValue(value)
  return isRecord(stripped) ? stripped : {}
}

export async function collectPortableReferences(
  db: DBLike,
  payload: Record<string, unknown>,
  userId: string
): Promise<ArtificerPortableContentDto['references']> {
  const candidates = collectTopLevelReferenceCandidates(payload)
  const repository = createAuthoredContentRepository(db)
  const importRefRepository = createAuthoredImportRefRepository(db)
  return Promise.all(
    candidates.map(async ({ kind, id }) => {
      const [active, importRefs] = await Promise.all([
        repository.findActiveBySubject({ subjectKind: kind, subjectId: id }),
        importRefRepository.findBySubject({ userId, subjectKind: kind, subjectId: id })
      ])
      const importRef = importRefs[0]
      return {
        kind,
        id,
        label: active?.label ?? id,
        importSource: importRef?.source ?? null,
        importId: importRef?.externalId ?? null
      }
    })
  )
}

function collectOwnedIdMap(
  value: unknown,
  createId: () => string,
  result = new Map<string, string>()
): Map<string, string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectOwnedIdMap(entry, createId, result))
    return result
  }
  if (!isRecord(value)) return result
  const id = readString(value.id)
  if (id && !result.has(id)) result.set(id, createId())
  Object.values(value).forEach((entry) => collectOwnedIdMap(entry, createId, result))
  return result
}

function remapImportedIds(
  value: unknown,
  ownedIdMap: ReadonlyMap<string, string>,
  rootIdMap: ReadonlyMap<string, string>,
  createId: () => string,
  key?: string,
  inArrayObject = false
): unknown {
  if (typeof value === 'string' && shouldRemapIdKey(key)) {
    const referenceKind = key ? referenceKindForKey(key) : undefined
    return referenceKind
      ? (rootIdMap.get(`${referenceKind}:${value}`) ?? value)
      : (ownedIdMap.get(value) ?? value)
  }
  if (Array.isArray(value)) {
    return value.map((entry) => remapImportedIds(entry, ownedIdMap, rootIdMap, createId, key, true))
  }
  if (!isRecord(value)) return value
  const remapped = Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      remapImportedIds(entryValue, ownedIdMap, rootIdMap, createId, entryKey, false)
    ])
  )
  if (inArrayObject && !readString(remapped.id)) remapped.id = createId()
  return remapped
}

function containsEmptyIdentifier(value: unknown, key?: string): boolean {
  if (typeof value === 'string') {
    return (key === 'id' || key?.endsWith('Id') === true) && value.trim() === ''
  }
  if (Array.isArray(value)) return value.some((entry) => containsEmptyIdentifier(entry, key))
  if (!isRecord(value)) return false
  return Object.entries(value).some(([entryKey, entry]) => containsEmptyIdentifier(entry, entryKey))
}

function shouldRemapIdKey(key: string | undefined): boolean {
  return key === 'id' || key?.endsWith('Id') === true || key?.endsWith('Ids') === true
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

function collectTopLevelReferenceCandidates(
  value: unknown,
  result = new Map<string, { kind: AuthoredSubjectKindDto; id: string }>()
): Array<{ kind: AuthoredSubjectKindDto; id: string }> {
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

function referenceKindForKey(key: string): AuthoredSubjectKindDto | undefined {
  if (key === 'parentClassId' || key === 'classId' || key === 'classIds') return 'CLASS'
  if (key === 'parentRaceId' || key === 'raceId') return 'RACE'
  if (key === 'backgroundId') return 'BACKGROUND'
  if (key === 'equipmentId' || key === 'equipmentIds') return 'EQUIPMENT'
  if (key === 'featId' || key === 'featIds') return 'FEAT'
  if (key === 'spellId' || key === 'spellIds') return 'SPELL'
  if (key === 'creatureId' || key === 'creatureIds') return 'CREATURE'
  if (key === 'vehicleId' || key === 'vehicleIds') return 'VEHICLE'
  return undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
