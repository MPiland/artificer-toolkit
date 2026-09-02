import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { sql } from 'kysely'

import {
  authoredDocumentVersionSchema,
  type CompiledAuthoredProjection
} from '@artificer-toolkit/schema/projections/authoredContent'
import {
  type AuthoredSubjectKind,
  type JsonValue
} from '@artificer-toolkit/schema/projections/identity'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import {
  equipmentAuthoredDtoSchema,
  raceAuthoredDtoSchema,
  spellAuthoredDtoSchema
} from '@artificer-toolkit/schema/subjects'
import {
  compileBackground,
  compileClass,
  compileCreature,
  compileEquipment,
  compileFeat,
  compileRace,
  compileSpell,
  compileVehicle,
  resolveEquipmentAuthored,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { upsertSystem } from '../domains/index.js'
import {
  createAuthoredRouteIdRepository,
  createAuthoredVersionRepository,
  createSystemVocabularySnapshotRepository,
  syncSpellCatalogClassIndex,
  upsertAuthoredRootEnvelope
} from '../repositories/index.js'
import type { BaselineContentBundle, SystemSeedRecord } from '../source-data/content.js'
import { SRD_RULE_STATE_DEFINITIONS } from '../source-data/srd/ruleState.js'
import { SRD_SENSE_DEFINITIONS } from '../source-data/srd/senses.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '../source-data/srd/optionalCombat.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '../source-data/srd/encounterLifecycle.js'
import { SRD_CONCENTRATION_DEFINITIONS } from '../source-data/srd/concentration.js'
import {
  checksumCanonicalJson,
  checksumCompiledAuthoredProjection,
  checksumSystemVocabularySnapshot,
  normalizeCanonicalJson,
  withTransaction
} from '../utils/index.js'
import type { SeedBaselineContent, SeedContext, SeedResult } from './contracts.js'

type BaselineSubjectTable =
  | 'backgrounds'
  | 'classes'
  | 'creatures'
  | 'equipment'
  | 'feats'
  | 'races'
  | 'spells'
  | 'vehicles'

type BaselineSubjectKind =
  | 'BACKGROUND'
  | 'CLASS'
  | 'CREATURE'
  | 'EQUIPMENT'
  | 'FEAT'
  | 'RACE'
  | 'SPELL'
  | 'VEHICLE'

interface BaselineSubjectSet {
  table: BaselineSubjectTable
  subjectKind: BaselineSubjectKind
  ids: string[]
}

interface StaleBaselineSubjectSet extends BaselineSubjectSet {
  ids: string[]
}

const BASELINE_DOCUMENT_SCHEMA_VERSION = 1
const BASELINE_SYSTEM_VOCABULARY_SCHEMA_VERSION = 4
const BASELINE_PROJECTION_SCHEMA_VERSION = 1
const BASELINE_PROJECTION_COMPILER_VERSION = 'subject-compiler-v1'
const SRD_51_CONTENT_SOURCE_ID = '00000000-0000-4000-8000-000000000302'
const DND_2014_RULES_CATALOGUE_ID = '00000000-0000-4000-8000-000000000301'
const DND_5E_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'

type SrdReusableDefinitionSeed = {
  id: string
  definitionFamilyKey: string
  label: string
  description: string
  document: unknown
  checksum: string
}

async function seedSrdReusableDefinitions(
  context: SeedContext,
  publishedByUserId: string,
  definitions: readonly SrdReusableDefinitionSeed[]
): Promise<void> {
  for (const definition of definitions) {
    const existing = await sql<{
      game_system_id: string
      content_source_id: string
      current_contract_version: number | null
      current_document: unknown
      definition_family_key: string
      current_checksum: string | null
      label: string
      description: string | null
      published_by: string | null
    }>`
      SELECT game_system_id, content_source_id, definition_family_key,
             current_document, current_checksum, current_contract_version,
             published_by, label, description
      FROM public.reusable_definitions
      WHERE id = ${definition.id}::uuid
      FOR UPDATE
    `.execute(context.db)
    const root = existing.rows[0]

    if (!root) {
      await sql`
        INSERT INTO public.reusable_definitions (
          id, game_system_id, content_source_id, definition_family_key, label, description,
          current_document, current_checksum, current_contract_version, published_at, published_by, version
        ) VALUES (
          ${definition.id}::uuid, ${DND_5E_SYSTEM_ID}::uuid, ${SRD_51_CONTENT_SOURCE_ID}::uuid,
          ${definition.definitionFamilyKey}, ${definition.label}, ${definition.description},
          ${JSON.stringify(definition.document)}::jsonb, ${definition.checksum}, 1, now(),
          ${publishedByUserId}::uuid, 1
        )
      `.execute(context.db)
      continue
    }

    if (
      root.game_system_id !== DND_5E_SYSTEM_ID ||
      root.content_source_id !== SRD_51_CONTENT_SOURCE_ID ||
      root.definition_family_key !== definition.definitionFamilyKey
    ) {
      throw new Error(
        `Canonical SRD reusable definition "${definition.id}" has an incompatible root.`
      )
    }

    if (
      root.current_checksum !== definition.checksum ||
      root.current_contract_version !== 1 ||
      root.published_by !== publishedByUserId ||
      !isDeepStrictEqual(root.current_document, definition.document)
    ) {
      await sql`
        UPDATE public.reusable_definitions
        SET label = ${definition.label},
            description = ${definition.description},
            current_document = ${JSON.stringify(definition.document)}::jsonb,
            current_checksum = ${definition.checksum},
            current_contract_version = 1,
            published_at = now(),
            published_by = ${publishedByUserId}::uuid,
            version = version + 1
        WHERE id = ${definition.id}::uuid
      `.execute(context.db)
      continue
    }

    if (root.label !== definition.label || root.description !== definition.description) {
      await sql`
        UPDATE public.reusable_definitions
        SET label = ${definition.label}, description = ${definition.description}
        WHERE id = ${definition.id}::uuid
      `.execute(context.db)
    }
  }
}

function requireProjectionRecord(value: unknown): Record<string, JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Baseline compilation must produce an object projection.')
  }
  return value as Record<string, JsonValue>
}

async function ensureVocabularySnapshot(context: SeedContext, system: SystemSeedRecord) {
  const repository = createSystemVocabularySnapshotRepository(context.db)
  const active = await repository.findActiveForPublication(system.id)
  const document = systemVocabularySnapshotSchema.parse({
    snapshotId: 'seed-validation',
    systemId: system.id,
    snapshotVersion: 1,
    schemaVersion: BASELINE_SYSTEM_VOCABULARY_SCHEMA_VERSION,
    checksum: '0'.repeat(64),
    document: system
  }).document
  if (active) {
    const checksum = checksumSystemVocabularySnapshot({
      snapshotId: active.snapshotId,
      systemId: system.id,
      snapshotVersion: active.snapshotVersion,
      schemaVersion: BASELINE_SYSTEM_VOCABULARY_SCHEMA_VERSION,
      document
    })
    if (active.checksum === checksum) return active
  }
  return repository.publish({
    snapshotId: randomUUID(),
    systemId: system.id,
    schemaVersion: BASELINE_SYSTEM_VOCABULARY_SCHEMA_VERSION,
    document
  })
}

async function publishBaselineSubjectVersion(input: {
  authored: { id: string; systemId: string }
  contentSourceId: string
  authoredDependencies: CompiledAuthoredProjection['authoredDependencies']
  compiled: unknown
  context: SeedContext
  subjectKind: AuthoredSubjectKind
  vocabularySnapshot: Awaited<ReturnType<typeof ensureVocabularySnapshot>>
}): Promise<void> {
  const authoredDocument = normalizeCanonicalJson(input.authored)
  const compiledDocument = requireProjectionRecord(normalizeCanonicalJson(input.compiled))
  const authoredChecksum = checksumCanonicalJson(authoredDocument)
  const authored = authoredDocumentVersionSchema.parse({
    subjectKind: input.subjectKind,
    subjectId: input.authored.id,
    versionId: randomUUID(),
    version: 1,
    documentSchemaVersion: BASELINE_DOCUMENT_SCHEMA_VERSION,
    checksum: authoredChecksum,
    document: authoredDocument
  })
  await upsertAuthoredRootEnvelope(input.context.db, {
    contentSourceId: input.contentSourceId,
    document: authored.document,
    subjectKind: input.subjectKind
  })
  const versionRepository = createAuthoredVersionRepository(input.context.db)
  const active = await versionRepository.findActiveForPublication({
    subjectKind: input.subjectKind,
    subjectId: input.authored.id
  })
  if (
    active?.authored.checksum === authoredChecksum &&
    active.compiled.projectionChecksum ===
      checksumCompiledAuthoredProjection({
        subjectKind: input.subjectKind,
        subjectId: input.authored.id,
        authoredVersionId: active.authored.versionId,
        authoredVersion: active.authored.version,
        authoredChecksum,
        projectionSchemaVersion: BASELINE_PROJECTION_SCHEMA_VERSION,
        compilerVersion: BASELINE_PROJECTION_COMPILER_VERSION,
        vocabularySnapshotId: input.vocabularySnapshot.snapshotId,
        vocabularySnapshotVersion: input.vocabularySnapshot.snapshotVersion,
        vocabularySnapshotChecksum: input.vocabularySnapshot.checksum,
        authoredDependencies: input.authoredDependencies,
        projection: compiledDocument
      }) &&
    active.compiled.compilerVersion === BASELINE_PROJECTION_COMPILER_VERSION &&
    active.compiled.vocabularySnapshotId === input.vocabularySnapshot.snapshotId
  ) {
    if (authored.subjectKind === 'SPELL') {
      const spell = spellAuthoredDtoSchema.parse(authored.document)
      await syncSpellCatalogClassIndex(input.context.db, {
        authoredVersionId: active.authored.versionId,
        classIds: spell.classIds,
        spellId: spell.id
      })
    }
    return
  }

  const published = await versionRepository.publish({
    contentSourceId: input.contentSourceId,
    subjectKind: authored.subjectKind,
    subjectId: authored.subjectId,
    versionId: authored.versionId,
    documentSchemaVersion: authored.documentSchemaVersion,
    authoredChecksum: authored.checksum,
    document: authored.document,
    projectionSchemaVersion: BASELINE_PROJECTION_SCHEMA_VERSION,
    compilerVersion: BASELINE_PROJECTION_COMPILER_VERSION,
    vocabularySnapshotId: input.vocabularySnapshot.snapshotId,
    vocabularySnapshotVersion: input.vocabularySnapshot.snapshotVersion,
    vocabularySnapshotChecksum: input.vocabularySnapshot.checksum,
    authoredDependencies: input.authoredDependencies,
    compiledDocument
  })
  if (authored.subjectKind === 'SPELL') {
    const spell = spellAuthoredDtoSchema.parse(authored.document)
    await syncSpellCatalogClassIndex(input.context.db, {
      authoredVersionId: published.authored.versionId,
      classIds: spell.classIds,
      spellId: spell.id
    })
  }
}

async function prepareBaselineRaceProjection(input: {
  context: SeedContext
  race: BaselineContentBundle['subjects']['races'][number]
}): Promise<{
  authoredDependencies: CompiledAuthoredProjection['authoredDependencies']
  compiled: ReturnType<typeof compileRace>
}> {
  if (input.race.category === 'BASE') {
    return {
      authoredDependencies: [],
      compiled: compileRace(resolveRaceAuthored(input.race, () => null))
    }
  }

  const parent = await createAuthoredVersionRepository(input.context.db).findActive({
    subjectKind: 'RACE',
    subjectId: input.race.parentRaceId
  })
  if (!parent || parent.authored.subjectKind !== 'RACE') {
    throw new Error(`Cannot seed subrace "${input.race.id}" without an active parent race version.`)
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
    compiled: compileRace(
      resolveRaceAuthored(input.race, (raceId) =>
        raceId === parent.authored.subjectId ? parentRace : null
      )
    )
  }
}

async function prepareBaselineEquipmentProjection(input: {
  context: SeedContext
  equipment: BaselineContentBundle['subjects']['equipment'][number]
}): Promise<{
  authoredDependencies: CompiledAuthoredProjection['authoredDependencies']
  compiled: ReturnType<typeof compileEquipment>
}> {
  const equipment = equipmentAuthoredDtoSchema.parse(input.equipment) as EquipmentAuthored
  if (equipment.category !== 'VARIANT') {
    return {
      authoredDependencies: [],
      compiled: compileEquipment(equipment)
    }
  }

  const parent = await createAuthoredVersionRepository(input.context.db).findActive({
    subjectKind: 'EQUIPMENT',
    subjectId: equipment.parentEquipmentId
  })
  if (!parent || parent.authored.subjectKind !== 'EQUIPMENT') {
    throw new Error(
      `Cannot seed equipment variant "${equipment.id}" without an active parent equipment version.`
    )
  }
  const parentEquipment = equipmentAuthoredDtoSchema.parse(
    parent.authored.document
  ) as EquipmentAuthored

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
    compiled: compileEquipment(
      resolveEquipmentAuthored(equipment, (equipmentId) =>
        equipmentId === parent.authored.subjectId ? parentEquipment : null
      )
    )
  }
}

function getBaselineSubjectSets(bundle: BaselineContentBundle): BaselineSubjectSet[] {
  return [
    {
      table: 'backgrounds',
      subjectKind: 'BACKGROUND',
      ids: bundle.subjects.backgrounds.map((record) => record.id)
    },
    {
      table: 'classes',
      subjectKind: 'CLASS',
      ids: bundle.subjects.classes.map((record) => record.id)
    },
    {
      table: 'creatures',
      subjectKind: 'CREATURE',
      ids: bundle.subjects.creatures.map((record) => record.id)
    },
    {
      table: 'equipment',
      subjectKind: 'EQUIPMENT',
      ids: bundle.subjects.equipment.map((record) => record.id)
    },
    { table: 'feats', subjectKind: 'FEAT', ids: bundle.subjects.feats.map((record) => record.id) },
    { table: 'races', subjectKind: 'RACE', ids: bundle.subjects.races.map((record) => record.id) },
    {
      table: 'spells',
      subjectKind: 'SPELL',
      ids: bundle.subjects.spells.map((record) => record.id)
    },
    {
      table: 'vehicles',
      subjectKind: 'VEHICLE',
      ids: bundle.subjects.vehicles.map((record) => record.id)
    }
  ]
}

function getBaselineRouteSubjects(bundle: BaselineContentBundle) {
  return getBaselineSubjectSets(bundle).flatMap(({ subjectKind, ids }) =>
    ids.map((subjectId) => ({ subjectKind, subjectId }))
  )
}

async function findStaleBaselineSubjectIds(
  context: SeedContext,
  subject: BaselineSubjectSet
): Promise<string[]> {
  let query = context.db
    .selectFrom(subject.table)
    .select('id')
    .where('system_id', '=', context.systemId)
    .where('is_master', '=', true)

  if (subject.ids.length > 0) {
    query = query.where('id', 'not in', subject.ids)
  }

  return (await query.execute()).map((row) => row.id)
}

async function pruneStaleBaselineSubjects(
  context: SeedContext,
  subjects: readonly BaselineSubjectSet[]
): Promise<void> {
  const staleSubjects: StaleBaselineSubjectSet[] = []

  for (const subject of subjects) {
    staleSubjects.push({
      ...subject,
      ids: await findStaleBaselineSubjectIds(context, subject)
    })
  }

  for (const subject of staleSubjects) {
    if (subject.ids.length === 0) continue

    await context.db
      .deleteFrom(subject.table)
      .where('system_id', '=', context.systemId)
      .where('is_master', '=', true)
      .where('id', 'in', subject.ids)
      .execute()
    await context.db
      .deleteFrom('authored_route_ids')
      .where('subject_kind', '=', subject.subjectKind)
      .where('subject_id', 'in', subject.ids)
      .execute()
  }
}

export function pruneStaleBaselineContent(
  context: SeedContext,
  bundle: BaselineContentBundle
): Promise<void> {
  return pruneStaleBaselineSubjects(context, getBaselineSubjectSets(bundle))
}

async function markBaselineSubjectsMaster(
  context: SeedContext,
  table: BaselineSubjectTable,
  ids: string[]
) {
  if (ids.length === 0) return

  await context.db.updateTable(table).set({ is_master: true }).where('id', 'in', ids).execute()
}

async function seedBaselineSubjectRouteIds(
  context: SeedContext,
  subjects: readonly {
    subjectKind: BaselineSubjectKind
    subjectId: string
  }[]
) {
  if (subjects.length === 0) return

  await createAuthoredRouteIdRepository(context.db).seedSrdSubjects(subjects)
}

/**
 * Seeds one system-scoped baseline bundle as vocabulary plus immutable authored
 * versions/projections in one transaction.
 */
const seedBaselineContentInTransaction: SeedBaselineContent = async (context, bundle) => {
  const targetSystem = bundle.vocabulary.systems.find((system) => system.id === context.systemId)
  if (!targetSystem) {
    throw new Error(`Missing system seed record for systemId "${context.systemId}".`)
  }

  const vocabularySnapshots = new Map<
    string,
    Awaited<ReturnType<typeof ensureVocabularySnapshot>>
  >()
  for (const system of bundle.vocabulary.systems) {
    await upsertSystem(context.db, system)
    vocabularySnapshots.set(system.id, await ensureVocabularySnapshot(context, system))
  }

  if (context.systemId === DND_5E_SYSTEM_ID) {
    await sql`insert into public.rules_catalogues (id, game_system_id, code, label, description)
      values (${DND_2014_RULES_CATALOGUE_ID}::uuid, ${DND_5E_SYSTEM_ID}::uuid, 'dnd-2014', 'D&D 2014', 'D&D 5e 2014 catalogue.')
      on conflict (id) do nothing`.execute(context.db)
    await sql`insert into public.content_sources (id, game_system_id, kind, owner_user_id, code, label, description)
      values (${SRD_51_CONTENT_SOURCE_ID}::uuid, ${DND_5E_SYSTEM_ID}::uuid, 'PLATFORM', null, 'srd-5.1', 'SRD 5.1', 'D&D 5e SRD 5.1 platform source.')
      on conflict (id) do nothing`.execute(context.db)
    await sql`insert into public.rules_catalogue_content_sources (catalogue_id, content_source_id, game_system_id)
      values (${DND_2014_RULES_CATALOGUE_ID}::uuid, ${SRD_51_CONTENT_SOURCE_ID}::uuid, ${DND_5E_SYSTEM_ID}::uuid)
      on conflict (catalogue_id, content_source_id) do nothing`.execute(context.db)
    await seedSrdReusableDefinitions(context, targetSystem.userId, [
      ...SRD_SENSE_DEFINITIONS.map((definition) => ({
        ...definition,
        definitionFamilyKey: 'sense'
      })),
      ...SRD_RULE_STATE_DEFINITIONS,
      ...SRD_OPTIONAL_COMBAT_DEFINITIONS,
      ...SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS,
      ...SRD_CONCENTRATION_DEFINITIONS
    ])
  }

  await pruneStaleBaselineContent(context, bundle)

  const vocabularySnapshotFor = (systemId: string) => {
    const snapshot = vocabularySnapshots.get(systemId)
    if (!snapshot) {
      throw new Error(`Missing vocabulary snapshot for baseline system "${systemId}".`)
    }
    return snapshot
  }

  for (const background of bundle.subjects.backgrounds) {
    await publishBaselineSubjectVersion({
      context,
      subjectKind: 'BACKGROUND',
      authored: background,
      contentSourceId: SRD_51_CONTENT_SOURCE_ID,
      compiled: compileBackground(background),
      authoredDependencies: [],
      vocabularySnapshot: vocabularySnapshotFor(background.systemId)
    })
  }
  const classesByDependencyOrder = [...bundle.subjects.classes].sort((left, right) =>
    left.category === right.category ? 0 : left.category === 'BASE' ? -1 : 1
  )
  for (const characterClass of classesByDependencyOrder) {
    await publishBaselineSubjectVersion({
      context,
      subjectKind: 'CLASS',
      authored: characterClass,
      contentSourceId: SRD_51_CONTENT_SOURCE_ID,
      compiled: compileClass(characterClass),
      authoredDependencies: [],
      vocabularySnapshot: vocabularySnapshotFor(characterClass.systemId)
    })
  }
  for (const creature of bundle.subjects.creatures) {
    await publishBaselineSubjectVersion({
      context,
      subjectKind: 'CREATURE',
      authored: creature,
      contentSourceId: SRD_51_CONTENT_SOURCE_ID,
      compiled: compileCreature(creature),
      authoredDependencies: [],
      vocabularySnapshot: vocabularySnapshotFor(creature.systemId)
    })
  }
  const equipmentByDependencyOrder = [...bundle.subjects.equipment].sort((left, right) =>
    left.category === right.category ? 0 : left.category === 'VARIANT' ? 1 : -1
  )
  for (const equipment of equipmentByDependencyOrder) {
    const prepared = await prepareBaselineEquipmentProjection({ context, equipment })
    await publishBaselineSubjectVersion({
      context,
      subjectKind: 'EQUIPMENT',
      authored: equipment,
      contentSourceId: SRD_51_CONTENT_SOURCE_ID,
      compiled: prepared.compiled,
      authoredDependencies: prepared.authoredDependencies,
      vocabularySnapshot: vocabularySnapshotFor(equipment.systemId)
    })
  }
  for (const feat of bundle.subjects.feats) {
    await publishBaselineSubjectVersion({
      context,
      subjectKind: 'FEAT',
      authored: feat,
      contentSourceId: SRD_51_CONTENT_SOURCE_ID,
      compiled: compileFeat(feat),
      authoredDependencies: [],
      vocabularySnapshot: vocabularySnapshotFor(feat.systemId)
    })
  }
  const racesByDependencyOrder = [...bundle.subjects.races].sort((left, right) =>
    left.category === right.category ? 0 : left.category === 'BASE' ? -1 : 1
  )
  for (const race of racesByDependencyOrder) {
    const prepared = await prepareBaselineRaceProjection({ context, race })
    await publishBaselineSubjectVersion({
      context,
      subjectKind: 'RACE',
      authored: race,
      contentSourceId: SRD_51_CONTENT_SOURCE_ID,
      compiled: prepared.compiled,
      authoredDependencies: prepared.authoredDependencies,
      vocabularySnapshot: vocabularySnapshotFor(race.systemId)
    })
  }
  for (const spell of bundle.subjects.spells) {
    await publishBaselineSubjectVersion({
      context,
      subjectKind: 'SPELL',
      authored: spell,
      contentSourceId: SRD_51_CONTENT_SOURCE_ID,
      compiled: compileSpell(spell),
      authoredDependencies: [],
      vocabularySnapshot: vocabularySnapshotFor(spell.systemId)
    })
  }
  for (const vehicle of bundle.subjects.vehicles) {
    await publishBaselineSubjectVersion({
      context,
      subjectKind: 'VEHICLE',
      authored: vehicle,
      contentSourceId: SRD_51_CONTENT_SOURCE_ID,
      compiled: compileVehicle(vehicle),
      authoredDependencies: [],
      vocabularySnapshot: vocabularySnapshotFor(vehicle.systemId)
    })
  }

  for (const subject of getBaselineSubjectSets(bundle)) {
    await markBaselineSubjectsMaster(context, subject.table, subject.ids)
  }

  await seedBaselineSubjectRouteIds(context, getBaselineRouteSubjects(bundle))

  const result: SeedResult = {
    systems: bundle.vocabulary.systems.length,
    domainRoots: [
      bundle.subjects.backgrounds,
      bundle.subjects.classes,
      bundle.subjects.creatures,
      bundle.subjects.equipment,
      bundle.subjects.feats,
      bundle.subjects.races,
      bundle.subjects.spells,
      bundle.subjects.vehicles
    ].reduce((total, records) => total + records.length, 0)
  }

  return result
}

export const seedBaselineContent: SeedBaselineContent = (context, bundle) =>
  withTransaction(context.db, (db) => seedBaselineContentInTransaction({ ...context, db }, bundle))
