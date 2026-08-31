import { randomUUID } from 'node:crypto'

import {
  normalizeCanonicalJson,
  createAuthoredVersionRepository,
  syncSpellCatalogClassIndex,
  createSystemVocabularySnapshotRepository,
  upsertAuthoredRootEnvelope,
  withTransaction,
  type AuthoredVersionRecord,
  type DBLike
} from '@artificer-toolkit/db'
import {
  authoredDocumentVersionSchema,
  type CompiledAuthoredProjection
} from '@artificer-toolkit/schema/projections/authoredContent'
import type { AuthoredSubjectKind, JsonValue } from '@artificer-toolkit/schema/projections/identity'
import {
  equipmentAuthoredDtoSchema,
  raceAuthoredDtoSchema,
  spellAuthoredDtoSchema
} from '@artificer-toolkit/schema/subjects'
import {
  assertCompiledSubjectMechanicsIndex,
  compileSubjectWithMechanicsIndex,
  resolveEquipmentAuthored,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { checksumProjectionDocument } from '../projections/projectionChecksum.js'

export const AUTHORED_DOCUMENT_SCHEMA_VERSION = 1
export const AUTHORED_PROJECTION_SCHEMA_VERSION = 1
export const AUTHORED_PROJECTION_COMPILER_VERSION = 'subject-compiler-v1'

function requireProjectionRecord(value: unknown): Record<string, JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Authored compilation must produce an object projection.')
  }
  return value as Record<string, JsonValue>
}

async function prepareCompilation(input: {
  authored: { id: string; systemId: string }
  db: DBLike
  subjectKind: AuthoredSubjectKind
}): Promise<{
  authoredDependencies: CompiledAuthoredProjection['authoredDependencies']
  compiled: unknown
}> {
  switch (input.subjectKind) {
    case 'RACE': {
      const race = raceAuthoredDtoSchema.parse(input.authored) as unknown as RaceAuthored
      if (race.category !== 'SUBRACE') {
        const compiled = compileSubjectWithMechanicsIndex({
          subjectKind: input.subjectKind,
          authored: race
        })
        assertCompiledSubjectMechanicsIndex(compiled.mechanicsIndex)
        return { authoredDependencies: [], compiled: compiled.compiled }
      }

      const parent = await createAuthoredVersionRepository(input.db).findActive({
        subjectKind: 'RACE',
        subjectId: race.parentRaceId
      })
      if (!parent || parent.authored.subjectKind !== 'RACE') {
        throw new Error(
          `Cannot activate subrace "${race.id}" without an active parent race version.`
        )
      }
      const parentRace = raceAuthoredDtoSchema.parse(
        parent.authored.document
      ) as unknown as RaceAuthored

      return {
        authoredDependencies: [
          {
            subjectKind: parent.authored.subjectKind,
            subjectId: parent.authored.subjectId,
            versionId: parent.authored.versionId,
            version: parent.authored.version,
            checksum: parent.authored.checksum
          }
        ],
        compiled: (() => {
          const compilation = compileSubjectWithMechanicsIndex({
            subjectKind: input.subjectKind,
            authored: race,
            effectiveAuthored: resolveRaceAuthored(race, (raceId) =>
              raceId === parent.authored.subjectId ? parentRace : null
            )
          })
          assertCompiledSubjectMechanicsIndex(compilation.mechanicsIndex)
          return compilation.compiled
        })()
      }
    }
    case 'EQUIPMENT': {
      const equipment = equipmentAuthoredDtoSchema.parse(
        input.authored
      ) as unknown as EquipmentAuthored
      if (equipment.category !== 'VARIANT') {
        const compiled = compileSubjectWithMechanicsIndex({
          subjectKind: input.subjectKind,
          authored: equipment
        })
        assertCompiledSubjectMechanicsIndex(compiled.mechanicsIndex)
        return { authoredDependencies: [], compiled: compiled.compiled }
      }

      const parent = await createAuthoredVersionRepository(input.db).findActive({
        subjectKind: 'EQUIPMENT',
        subjectId: equipment.parentEquipmentId
      })
      if (!parent || parent.authored.subjectKind !== 'EQUIPMENT') {
        throw new Error(
          `Cannot activate equipment variant "${equipment.id}" without an active parent equipment version.`
        )
      }
      const parentEquipment = equipmentAuthoredDtoSchema.parse(
        parent.authored.document
      ) as unknown as EquipmentAuthored

      return {
        authoredDependencies: [
          {
            subjectKind: parent.authored.subjectKind,
            subjectId: parent.authored.subjectId,
            versionId: parent.authored.versionId,
            version: parent.authored.version,
            checksum: parent.authored.checksum
          }
        ],
        compiled: (() => {
          const compilation = compileSubjectWithMechanicsIndex({
            subjectKind: input.subjectKind,
            authored: equipment,
            effectiveAuthored: resolveEquipmentAuthored(equipment, (equipmentId) =>
              equipmentId === parent.authored.subjectId ? parentEquipment : null
            )
          })
          assertCompiledSubjectMechanicsIndex(compilation.mechanicsIndex)
          return compilation.compiled
        })()
      }
    }
    default: {
      const compiled = compileSubjectWithMechanicsIndex({
        subjectKind: input.subjectKind,
        authored: input.authored
      })
      assertCompiledSubjectMechanicsIndex(compiled.mechanicsIndex)
      return { authoredDependencies: [], compiled: compiled.compiled }
    }
  }
}

export async function publishVersionedAuthoredAggregate(input: {
  authored: {
    id: string
    systemId: string
  }
  contentSourceId: string
  db: DBLike
  subjectKind: AuthoredSubjectKind
}): Promise<AuthoredVersionRecord> {
  return withTransaction(input.db, async (db) => {
    const publicationInput = { ...input, db }
    const versionId = randomUUID()
    const compilation = await prepareCompilation(publicationInput)
    const vocabularySnapshot = await createSystemVocabularySnapshotRepository(db).findActive(
      input.authored.systemId
    )
    if (!vocabularySnapshot) {
      throw new Error(
        `Cannot activate ${input.subjectKind} "${input.authored.id}" without an active vocabulary snapshot.`
      )
    }

    const authoredDocument = normalizeCanonicalJson(input.authored)
    const authoredChecksum = checksumProjectionDocument(authoredDocument)
    const compiledDocument = requireProjectionRecord(normalizeCanonicalJson(compilation.compiled))
    const authored = authoredDocumentVersionSchema.parse({
      subjectKind: input.subjectKind,
      subjectId: input.authored.id,
      versionId,
      version: 1,
      documentSchemaVersion: AUTHORED_DOCUMENT_SCHEMA_VERSION,
      checksum: authoredChecksum,
      document: authoredDocument
    })
    await upsertAuthoredRootEnvelope(db, {
      contentSourceId: input.contentSourceId,
      document: authored.document,
      subjectKind: input.subjectKind
    })
    const published = await createAuthoredVersionRepository(db).publish({
      subjectKind: authored.subjectKind,
      contentSourceId: input.contentSourceId,
      subjectId: authored.subjectId,
      versionId: authored.versionId,
      documentSchemaVersion: authored.documentSchemaVersion,
      authoredChecksum: authored.checksum,
      document: authored.document,
      projectionSchemaVersion: AUTHORED_PROJECTION_SCHEMA_VERSION,
      compilerVersion: AUTHORED_PROJECTION_COMPILER_VERSION,
      vocabularySnapshotId: vocabularySnapshot.snapshotId,
      vocabularySnapshotVersion: vocabularySnapshot.snapshotVersion,
      vocabularySnapshotChecksum: vocabularySnapshot.checksum,
      authoredDependencies: compilation.authoredDependencies,
      compiledDocument
    })
    if (authored.subjectKind === 'SPELL') {
      const spell = spellAuthoredDtoSchema.parse(authored.document)
      await syncSpellCatalogClassIndex(db, {
        authoredVersionId: published.authored.versionId,
        classIds: spell.classIds,
        spellId: spell.id
      })
    }
    return published
  })
}
