import {
  createAuthoredVersionRepository,
  type AuthoredSubjectKind,
  type AuthoredVersionRecord,
  type DBLike
} from '@artificer-toolkit/db'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections/identity'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  resolveEquipmentAuthored,
  resolveRaceAuthored,
  type ResolvedEquipment,
  type ResolvedRace
} from '@artificer-toolkit/shared/subjects/compilers'

interface VersionedCharacterSource<T extends { id: string; systemId: string }> {
  authored: T
  authoredDependencies: readonly AuthoredVersionVector[number][]
}

function toVersionedCharacterSource<T extends { id: string; systemId: string }>(
  record: AuthoredVersionRecord
): VersionedCharacterSource<T> {
  return {
    authored: record.authored.document as unknown as T,
    authoredDependencies: record.compiled.authoredDependencies
  }
}

async function loadExactCharacterDependency(
  db: DBLike,
  owner: VersionedCharacterSource<{ id: string; systemId: string }>,
  subjectKind: AuthoredSubjectKind,
  subjectId: string
): Promise<AuthoredVersionRecord> {
  const dependency = owner.authoredDependencies.find(
    (entry) => entry.subjectKind === subjectKind && entry.subjectId === subjectId
  )
  if (!dependency) {
    throw new Error(
      `Character source "${owner.authored.id}" is missing exact ${subjectKind} dependency "${subjectId}".`
    )
  }
  const records = await createAuthoredVersionRepository(db).findExactVersions({
    entries: [dependency]
  })
  const record = records.get(`${subjectKind}:${subjectId}`)
  if (!record) {
    throw new Error(
      `Character source "${owner.authored.id}" has an unavailable exact ${subjectKind} dependency "${subjectId}".`
    )
  }
  return record
}

export async function loadActiveCharacterSources<T extends { id: string; systemId: string }>(
  db: DBLike,
  subjectKind: AuthoredSubjectKind,
  subjectIds: readonly string[],
  systemId: string,
  userId: string
): Promise<Map<string, VersionedCharacterSource<T>>> {
  const ids = [...new Set(subjectIds)]
  if (ids.length === 0) return new Map()
  const records = await createAuthoredVersionRepository(db).findActiveByIds({
    subjectKind,
    subjectIds: ids,
    systemId,
    userId,
    includeMaster: true
  })
  return new Map(
    [...records.entries()].flatMap(([id, record]) => {
      const source = toVersionedCharacterSource<T>(record)
      return source.authored.systemId === systemId ? [[id, source] as const] : []
    })
  )
}

export async function resolveActiveCharacterRaces(
  db: DBLike,
  subjectIds: readonly string[],
  systemId: string,
  userId: string
): Promise<ResolvedRace[]> {
  const roots = await loadActiveCharacterSources<RaceAuthored>(
    db,
    'RACE',
    subjectIds,
    systemId,
    userId
  )
  return Promise.all(
    [...new Set(subjectIds)].flatMap(async (subjectId) => {
      const root = roots.get(subjectId)
      if (!root) return []
      const parents = new Map<string, RaceAuthored>()
      const loadParents = async (
        source: VersionedCharacterSource<RaceAuthored>,
        lineage: ReadonlySet<string> = new Set()
      ): Promise<void> => {
        if (source.authored.category !== 'SUBRACE') return
        if (lineage.has(source.authored.id)) {
          throw new Error(`Character Subrace "${source.authored.id}" has a parent cycle.`)
        }
        const parentRecord = await loadExactCharacterDependency(
          db,
          source,
          'RACE',
          source.authored.parentRaceId
        )
        const parent = toVersionedCharacterSource<RaceAuthored>(parentRecord)
        if (parent.authored.systemId !== systemId) {
          throw new Error(
            `Character Race dependency "${parent.authored.id}" belongs to another rules system.`
          )
        }
        parents.set(parent.authored.id, parent.authored)
        await loadParents(parent, new Set([...lineage, source.authored.id]))
      }
      await loadParents(root)
      return [resolveRaceAuthored(root.authored, (parentId) => parents.get(parentId))]
    })
  ).then((records) => records.flat())
}

export async function resolveActiveCharacterEquipment(
  db: DBLike,
  subjectIds: readonly string[],
  systemId: string,
  userId: string
): Promise<ResolvedEquipment[]> {
  const roots = await loadActiveCharacterSources<EquipmentAuthored>(
    db,
    'EQUIPMENT',
    subjectIds,
    systemId,
    userId
  )
  return Promise.all(
    [...new Set(subjectIds)].flatMap(async (subjectId) => {
      const root = roots.get(subjectId)
      if (!root) return []
      const parents = new Map<string, EquipmentAuthored>()
      const loadParents = async (
        source: VersionedCharacterSource<EquipmentAuthored>,
        lineage: ReadonlySet<string> = new Set()
      ): Promise<void> => {
        if (source.authored.category !== 'VARIANT') return
        if (lineage.has(source.authored.id)) {
          throw new Error(`Character Equipment variant "${source.authored.id}" has a parent cycle.`)
        }
        const parentRecord = await loadExactCharacterDependency(
          db,
          source,
          'EQUIPMENT',
          source.authored.parentEquipmentId
        )
        const parent = toVersionedCharacterSource<EquipmentAuthored>(parentRecord)
        if (parent.authored.systemId !== systemId) {
          throw new Error(
            `Character Equipment dependency "${parent.authored.id}" belongs to another rules system.`
          )
        }
        parents.set(parent.authored.id, parent.authored)
        await loadParents(parent, new Set([...lineage, source.authored.id]))
      }
      await loadParents(root)
      return [resolveEquipmentAuthored(root.authored, (parentId) => parents.get(parentId))]
    })
  ).then((records) => records.flat())
}
