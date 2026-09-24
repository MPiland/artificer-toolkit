import * as core from 'zod/v4/core'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import { referenceKindForKey, stripPortableMetadata } from '@artificer-toolkit/shared/utils'

import { sanitizeImportedValue } from './importParsers.js'

type ImportedAuthoredPayloadConfig = { schema: core.$ZodType }

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
  config: ImportedAuthoredPayloadConfig,
  payload: Record<string, unknown>
): boolean {
  return !containsEmptyIdentifier(payload) && core.safeParse(config.schema, payload).success
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

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
