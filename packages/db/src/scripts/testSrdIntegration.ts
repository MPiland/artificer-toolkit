import assert from 'node:assert/strict'

import { sql, type Transaction } from 'kysely'
import type { ZodType } from 'zod'

import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { cloneAuthoredItem } from '@artificer-toolkit/shared/utils'

import { createDb } from '../client.js'
import {
  createAuthoredDefinitionRepository,
  createBackgroundRepository,
  createClassRepository,
  createCreatureRepository,
  createEquipmentRepository,
  createFeatRepository,
  createRaceRepository,
  createSpellRepository,
  createVehicleRepository
} from '../repositories/index.js'
import { seedBaselineContent } from '../seed/baseline.js'
import { assignBaselineContentOwner, type BaselineContentBundle } from '../source-data/content.js'
import { SRD_SYSTEM_ID, srdBaselineContent } from '../source-data/srd/index.js'
import type { Database, Json } from '../types/index.js'
type Db = ReturnType<typeof createDb>
type SrdTransaction = Transaction<Database>
type SrdClassRecord = BaselineContentBundle['subjects']['classes'][number]
type SrdBaseClassRecord = Extract<SrdClassRecord, { category: 'BASE' }>

interface RootRecord {
  id: string
  label: string
  systemId: string
  status?: unknown
  userId?: string
}

interface RootCloneCase {
  domain: string
  subjectKind: AuthoredSubjectKindDto
  records: readonly RootRecord[]
  schema: ZodType
}

interface RevisionSnapshot {
  subjectId: string
  subjectKind: string
  activeRevisionId: string
  revisionNumber: number
  payload: Json
}

interface DatabaseFingerprint {
  definitions: Array<{
    subjectId: string
    activeRevisionId: string | null
    nextRevisionNumber: number
  }>
  routes: Array<{
    subjectId: string
    subjectKind: string
    publicId: string
  }>
}

interface IdOccurrence {
  id: string
  path: string
}

interface OwnedCloneDraftSnapshot {
  label: string
  payload: Json
  revisionId: string
  subjectId: string
  subjectKind: AuthoredSubjectKindDto
  systemId: string
}

interface OwnedCloneAudit {
  cloneDraftsBySourceId: Map<string, OwnedCloneDraftSnapshot>
  count: number
}

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

function requireLocalDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error(
      'DATABASE_CONNECTION_STRING is required for the SRD integration gate.'
    )
  }

  let host: string
  try {
    host = new URL(connectionString).hostname.toLowerCase()
  } catch {
    throw new Error('The SRD integration gate requires a URL-shaped Postgres connection string.')
  }

  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run the rollback SRD integration gate against non-local database host "${host}".`
    )
  }

  return connectionString
}

function canonicalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function collectOwnedIdOccurrences(
  value: unknown,
  path = '$',
  occurrences: IdOccurrence[] = []
): IdOccurrence[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectOwnedIdOccurrences(item, `${path}[${index}]`, occurrences)
    })
    return occurrences
  }

  if (typeof value !== 'object' || value === null) return occurrences

  for (const [entryKey, entryValue] of Object.entries(value)) {
    const entryPath = `${path}.${entryKey}`
    if (entryKey === 'id' && typeof entryValue === 'string') {
      occurrences.push({ id: entryValue, path: entryPath })
    }
    collectOwnedIdOccurrences(entryValue, entryPath, occurrences)
  }

  return occurrences
}

function collectIdReferenceOccurrences(
  value: unknown,
  path = '$',
  key?: string,
  occurrences: IdOccurrence[] = []
): IdOccurrence[] {
  if (typeof value === 'string') {
    if (key !== 'id' && (key?.endsWith('Id') === true || key?.endsWith('Ids') === true)) {
      occurrences.push({ id: value, path })
    }
    return occurrences
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectIdReferenceOccurrences(item, `${path}[${index}]`, key, occurrences)
    })
    return occurrences
  }

  if (typeof value !== 'object' || value === null) return occurrences

  for (const [entryKey, entryValue] of Object.entries(value)) {
    collectIdReferenceOccurrences(entryValue, `${path}.${entryKey}`, entryKey, occurrences)
  }

  return occurrences
}

function collectStringValues(value: unknown, values: string[] = []): string[] {
  if (typeof value === 'string') {
    values.push(value)
    return values
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, values)
    return values
  }

  if (typeof value !== 'object' || value === null) return values

  for (const entryValue of Object.values(value)) collectStringValues(entryValue, values)
  return values
}

function assertNoSharedMutableReferences(source: unknown, clone: unknown, path = '$'): void {
  if (Array.isArray(source)) {
    assert.ok(Array.isArray(clone), `Clone changed the array shape at ${path}.`)
    assert.notStrictEqual(clone, source, `Clone retained the source array at ${path}.`)
    assert.equal(clone.length, source.length, `Clone changed the array length at ${path}.`)
    source.forEach((item, index) => {
      assertNoSharedMutableReferences(item, clone[index], `${path}[${index}]`)
    })
    return
  }

  if (typeof source !== 'object' || source === null) return

  assert.ok(
    typeof clone === 'object' && clone !== null && !Array.isArray(clone),
    `Clone changed the object shape at ${path}.`
  )
  assert.notStrictEqual(clone, source, `Clone retained the source object at ${path}.`)
  assert.deepStrictEqual(
    Object.keys(clone).sort(),
    Object.keys(source).sort(),
    `Clone changed the object keys at ${path}.`
  )
  for (const [key, value] of Object.entries(source)) {
    assertNoSharedMutableReferences(
      value,
      (clone as Record<string, unknown>)[key],
      `${path}.${key}`
    )
  }
}

function collectStartingEquipmentEligibilityFacetIds(bundle: BaselineContentBundle): string[] {
  return [
    ...bundle.subjects.backgrounds,
    ...bundle.subjects.classes.filter(
      (record): record is SrdBaseClassRecord => record.category === 'BASE'
    )
  ]
    .flatMap((record) => record.startingEquipment?.sets ?? [])
    .flatMap((set) => set.groups)
    .flatMap((group) => group.options)
    .flatMap((option) => (option.eligibility ? [option.eligibility.id] : []))
}

async function assertStartingEquipmentEligibilityOwnership(
  db: SrdTransaction,
  bundle: BaselineContentBundle
): Promise<void> {
  const expectedIds = collectStartingEquipmentEligibilityFacetIds(bundle).sort()
  if (expectedIds.length === 0) return

  const [facetRows, optionRows] = await Promise.all([
    db.selectFrom('facets').select('id').where('id', 'in', expectedIds).execute(),
    db
      .selectFrom('starting_equipment_options')
      .select('eligibility_facet_id')
      .where('eligibility_facet_id', 'in', expectedIds)
      .execute()
  ])

  assert.deepStrictEqual(
    facetRows.map((row) => row.id).sort(),
    expectedIds,
    'Every authored starting-equipment eligibility facet must be persisted.'
  )
  assert.deepStrictEqual(
    optionRows.map((row) => row.eligibility_facet_id).sort((left, right) => {
      const leftValue = String(left)
      const rightValue = String(right)
      return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
    }),
    expectedIds,
    'Every starting-equipment eligibility facet must be owned by exactly one option.'
  )
}

async function findSeedOwnerUserId(db: SrdTransaction): Promise<string> {
  const configuredUserId = process.env.SEED_OWNER_USER_ID
  const result = configuredUserId
    ? await sql<{ id: string }>`
        select id::text as id
        from auth.users
        where id = ${configuredUserId}::uuid
        limit 1
      `.execute(db)
    : await sql<{ id: string }>`
        select id::text as id
        from auth.users
        order by created_at, id
        limit 1
      `.execute(db)
  const userId = result.rows[0]?.id

  if (!userId) {
    throw new Error(
      configuredUserId
        ? `SEED_OWNER_USER_ID "${configuredUserId}" does not exist in the local database.`
        : 'The local database has no auth user. Run `yarn seed:srd:local` before the SRD integration gate.'
    )
  }

  return userId
}

function allRootRecords(bundle: BaselineContentBundle): RootRecord[] {
  return [
    ...bundle.subjects.backgrounds,
    ...bundle.subjects.classes,
    ...bundle.subjects.creatures,
    ...bundle.subjects.equipment,
    ...bundle.subjects.feats,
    ...bundle.subjects.races,
    ...bundle.subjects.spells,
    ...bundle.subjects.vehicles
  ]
}

function allRootCloneCases(bundle: BaselineContentBundle): RootCloneCase[] {
  return [
    {
      domain: 'Background',
      subjectKind: 'BACKGROUND',
      records: bundle.subjects.backgrounds,
      schema: backgroundAuthoredDtoSchema
    },
    {
      domain: 'Class',
      subjectKind: 'CLASS',
      records: bundle.subjects.classes,
      schema: classAuthoredDtoSchema
    },
    {
      domain: 'Creature',
      subjectKind: 'CREATURE',
      records: bundle.subjects.creatures,
      schema: creatureAuthoredDtoSchema
    },
    {
      domain: 'Equipment',
      subjectKind: 'EQUIPMENT',
      records: bundle.subjects.equipment,
      schema: equipmentAuthoredDtoSchema
    },
    {
      domain: 'Feat',
      subjectKind: 'FEAT',
      records: bundle.subjects.feats,
      schema: featAuthoredDtoSchema
    },
    {
      domain: 'Race',
      subjectKind: 'RACE',
      records: bundle.subjects.races,
      schema: raceAuthoredDtoSchema
    },
    {
      domain: 'Spell',
      subjectKind: 'SPELL',
      records: bundle.subjects.spells,
      schema: spellAuthoredDtoSchema
    },
    {
      domain: 'Vehicle',
      subjectKind: 'VEHICLE',
      records: bundle.subjects.vehicles,
      schema: vehicleAuthoredDtoSchema
    }
  ]
}

async function readRevisionSnapshot(db: SrdTransaction): Promise<RevisionSnapshot[]> {
  const result = await sql<{
    subject_id: string
    subject_kind: string
    active_revision_id: string
    revision_number: number
    payload: Json
  }>`
    select
      definition.subject_id::text,
      definition.subject_kind,
      definition.active_revision_id::text,
      revision.revision_number,
      revision.payload
    from authored_definitions definition
    join authored_definition_revisions revision
      on revision.definition_id = definition.subject_id
      and revision.id = definition.active_revision_id
    where definition.system_id = ${SRD_SYSTEM_ID}::uuid
      and definition.is_master is true
    order by definition.subject_kind, definition.subject_id
  `.execute(db)

  return result.rows.map((row) => ({
    subjectId: row.subject_id,
    subjectKind: row.subject_kind,
    activeRevisionId: row.active_revision_id,
    revisionNumber: row.revision_number,
    payload: row.payload
  }))
}

async function readDatabaseFingerprint(db: Db): Promise<DatabaseFingerprint> {
  const [definitionResult, routeResult] = await Promise.all([
    sql<{
      subject_id: string
      active_revision_id: string | null
      next_revision_number: number
    }>`
      select
        subject_id::text,
        active_revision_id::text,
        next_revision_number
      from authored_definitions
      where system_id = ${SRD_SYSTEM_ID}::uuid
        and is_master is true
      order by subject_id
    `.execute(db),
    sql<{
      subject_id: string
      subject_kind: string
      public_id: string
    }>`
      select route.subject_id::text, route.subject_kind, route.public_id
      from authored_route_ids route
      join authored_definitions definition
        on definition.subject_id = route.subject_id
        and definition.subject_kind = route.subject_kind
      where definition.system_id = ${SRD_SYSTEM_ID}::uuid
        and definition.is_master is true
      order by route.subject_kind, route.subject_id
    `.execute(db)
  ])

  return {
    definitions: definitionResult.rows.map((row) => ({
      subjectId: row.subject_id,
      activeRevisionId: row.active_revision_id,
      nextRevisionNumber: row.next_revision_number
    })),
    routes: routeResult.rows.map((row) => ({
      subjectId: row.subject_id,
      subjectKind: row.subject_kind,
      publicId: row.public_id
    }))
  }
}

async function assertHydratedRecords<TRecord extends RootRecord>(
  records: readonly TRecord[],
  findById: (id: string) => Promise<unknown>,
  domain: string
): Promise<void> {
  for (const expected of records) {
    const actual = await findById(expected.id)
    assert.ok(actual, `${domain} "${expected.label}" did not hydrate after seeding.`)
    assert.deepStrictEqual(
      canonicalize(actual),
      canonicalize(expected),
      `${domain} "${expected.label}" changed during normalized persistence/hydration.`
    )
  }
}

async function assertHydratedCorpus(
  db: SrdTransaction,
  bundle: BaselineContentBundle
): Promise<void> {
  const backgroundRepository = createBackgroundRepository(db)
  const classRepository = createClassRepository(db)
  const creatureRepository = createCreatureRepository(db)
  const equipmentRepository = createEquipmentRepository(db)
  const featRepository = createFeatRepository(db)
  const raceRepository = createRaceRepository(db)
  const spellRepository = createSpellRepository(db)
  const vehicleRepository = createVehicleRepository(db)

  await assertHydratedRecords(
    bundle.subjects.backgrounds,
    (id) => backgroundRepository.findById(id),
    'Background'
  )
  await assertHydratedRecords(
    bundle.subjects.classes,
    (id) => classRepository.findById(id),
    'Class'
  )
  await assertHydratedRecords(
    bundle.subjects.creatures,
    (id) => creatureRepository.findById(id),
    'Creature'
  )
  await assertHydratedRecords(
    bundle.subjects.equipment,
    (id) => equipmentRepository.findById(id),
    'Equipment'
  )
  await assertHydratedRecords(bundle.subjects.feats, (id) => featRepository.findById(id), 'Feat')
  await assertHydratedRecords(bundle.subjects.races, (id) => raceRepository.findById(id), 'Race')
  await assertHydratedRecords(bundle.subjects.spells, (id) => spellRepository.findById(id), 'Spell')
  await assertHydratedRecords(
    bundle.subjects.vehicles,
    (id) => vehicleRepository.findById(id),
    'Vehicle'
  )
}

function assertRevisionPayloads(
  revisions: readonly RevisionSnapshot[],
  bundle: BaselineContentBundle
): void {
  const expectedRecords = new Map(allRootRecords(bundle).map((record) => [record.id, record]))
  assert.equal(
    revisions.length,
    expectedRecords.size,
    'Every seeded root must have one active master revision.'
  )

  for (const revision of revisions) {
    const expected = expectedRecords.get(revision.subjectId)
    assert.ok(
      expected,
      `Unexpected master revision for ${revision.subjectKind} ${revision.subjectId}.`
    )
    assert.deepStrictEqual(
      canonicalize(revision.payload),
      canonicalize(expected),
      `Active revision payload diverged for ${revision.subjectKind} "${expected.label}".`
    )
  }
}

async function assertRoutes(db: SrdTransaction, bundle: BaselineContentBundle): Promise<void> {
  const result = await sql<{ subject_id: string }>`
    select route.subject_id::text
    from authored_route_ids route
    join authored_definitions definition
      on definition.subject_id = route.subject_id
      and definition.subject_kind = route.subject_kind
    where definition.system_id = ${SRD_SYSTEM_ID}::uuid
      and definition.is_master is true
  `.execute(db)
  const actualIds = new Set(result.rows.map((row) => row.subject_id))
  const expectedIds = new Set(allRootRecords(bundle).map((record) => record.id))

  assert.deepStrictEqual(
    actualIds,
    expectedIds,
    'Every seeded root must have one stable authored route identity.'
  )
}

async function assertOwnedClones(
  db: SrdTransaction,
  bundle: BaselineContentBundle,
  userId: string
): Promise<OwnedCloneAudit> {
  const repository = createAuthoredDefinitionRepository(db)
  const cloneIds = new Set<string>()
  const cloneOwnedIds = new Set<string>()
  const cloneDraftsBySourceId = new Map<string, OwnedCloneDraftSnapshot>()

  for (const domainCase of allRootCloneCases(bundle)) {
    for (const source of domainCase.records) {
      const clonedSource = cloneAuthoredItem(source)
      assertNoSharedMutableReferences(source, clonedSource)
      const clone = {
        ...clonedSource,
        userId
      }
      const parsed = domainCase.schema.parse(clone) as RootRecord
      const sourceOwnedIdOccurrences = collectOwnedIdOccurrences(source)
      const clonedOwnedIdOccurrences = collectOwnedIdOccurrences(parsed)
      const sourceOwnedIds = sourceOwnedIdOccurrences.map(({ id }) => id)
      const clonedOwnedIds = clonedOwnedIdOccurrences.map(({ id }) => id)
      const sourceOwnedIdSet = new Set(sourceOwnedIds)
      const clonedOwnedIdsByPath = new Map(
        clonedOwnedIdOccurrences.map(({ id, path }) => [path, id])
      )
      const sourceToCloneId = new Map<string, string>()

      assert.notEqual(
        parsed.id,
        source.id,
        `${domainCase.domain} "${source.label}" retained its root id while cloning.`
      )
      assert.equal(parsed.label, `${source.label} Copy`)
      if ('status' in source) assert.equal(parsed.status, 'DRAFT')
      assert.deepStrictEqual(
        [...clonedOwnedIdsByPath.keys()].sort(),
        sourceOwnedIdOccurrences.map(({ path }) => path).sort(),
        `${domainCase.domain} "${source.label}" did not preserve its complete owned-id structure while cloning.`
      )

      sourceOwnedIdOccurrences.forEach((sourceOccurrence) => {
        const clonedId = clonedOwnedIdsByPath.get(sourceOccurrence.path)
        assert.ok(
          clonedId,
          `${domainCase.domain} "${source.label}" lost the owned id at ${sourceOccurrence.path}.`
        )
        assert.notEqual(
          clonedId,
          sourceOccurrence.id,
          `${domainCase.domain} "${source.label}" retained the owned id at ${sourceOccurrence.path}.`
        )

        const existingCloneId = sourceToCloneId.get(sourceOccurrence.id)
        if (existingCloneId) {
          assert.equal(
            clonedId,
            existingCloneId,
            `${domainCase.domain} "${source.label}" remapped the same source identity inconsistently.`
          )
        } else {
          sourceToCloneId.set(sourceOccurrence.id, clonedId)
        }
      })

      assert.deepStrictEqual(
        clonedOwnedIds.filter((id) => sourceOwnedIdSet.has(id)),
        [],
        `${domainCase.domain} "${source.label}" retained one or more owned ids while cloning.`
      )
      assert.deepStrictEqual(
        collectStringValues(parsed).filter((value) => sourceOwnedIdSet.has(value)),
        [],
        `${domainCase.domain} "${source.label}" retained a reference to its source-owned structure while cloning.`
      )

      const sourceReferences = collectIdReferenceOccurrences(source)
      const clonedReferences = collectIdReferenceOccurrences(parsed)
      const clonedReferencesByPath = new Map(clonedReferences.map(({ id, path }) => [path, id]))
      assert.deepStrictEqual(
        [...clonedReferencesByPath.keys()].sort(),
        sourceReferences.map(({ path }) => path).sort(),
        `${domainCase.domain} "${source.label}" changed its id-reference structure while cloning.`
      )
      sourceReferences.forEach((sourceReference) => {
        const expectedId = sourceToCloneId.get(sourceReference.id) ?? sourceReference.id
        assert.equal(
          clonedReferencesByPath.get(sourceReference.path),
          expectedId,
          `${domainCase.domain} "${source.label}" did not preserve or remap ${sourceReference.path} correctly.`
        )
      })

      for (const ownedId of new Set(clonedOwnedIds)) {
        assert.ok(
          !cloneOwnedIds.has(ownedId),
          `${domainCase.domain} "${source.label}" produced an owned id already used by another clone.`
        )
        cloneOwnedIds.add(ownedId)
      }
      assert.ok(
        !cloneIds.has(parsed.id),
        `${domainCase.domain} "${source.label}" produced a duplicate clone id.`
      )
      cloneIds.add(parsed.id)

      const draft = await repository.saveDraft({
        subjectKind: domainCase.subjectKind,
        subjectId: parsed.id,
        userId,
        systemId: parsed.systemId,
        label: parsed.label,
        payload: canonicalize(parsed) as Json
      })

      assert.deepStrictEqual(canonicalize(draft.payload), canonicalize(parsed))
      assert.equal(draft.draftState, 'DRAFT_ONLY')
      assert.ok(
        !cloneDraftsBySourceId.has(source.id),
        `${domainCase.domain} "${source.label}" reused a root id from another source record.`
      )
      cloneDraftsBySourceId.set(source.id, {
        label: parsed.label,
        payload: draft.payload,
        revisionId: draft.revisionId,
        subjectId: parsed.id,
        subjectKind: domainCase.subjectKind,
        systemId: parsed.systemId
      })
    }
  }

  assert.equal(cloneIds.size, allRootRecords(bundle).length)
  return { cloneDraftsBySourceId, count: cloneIds.size }
}

async function runRollbackAudit(
  db: Db
): Promise<{ clones: number; roots: number; revisions: number }> {
  let completed: { clones: number; roots: number; revisions: number } | undefined
  const rollback = new Error('ROLLBACK_SRD_INTEGRATION_GATE')

  try {
    await db.transaction().execute(async (transaction) => {
      const userId = await findSeedOwnerUserId(transaction)
      const bundle = assignBaselineContentOwner(srdBaselineContent, userId)

      await seedBaselineContent({ db: transaction, systemId: SRD_SYSTEM_ID }, bundle)
      const firstRevisions = await readRevisionSnapshot(transaction)
      assertRevisionPayloads(firstRevisions, bundle)
      await assertRoutes(transaction, bundle)
      await assertHydratedCorpus(transaction, bundle)
      await assertStartingEquipmentEligibilityOwnership(transaction, bundle)
      const cloneAudit = await assertOwnedClones(transaction, bundle, userId)
      const cloneIsolationSource = bundle.subjects.classes.find(
        (record): record is SrdBaseClassRecord =>
          record.category === 'BASE' &&
          record.startingEquipment.sets.some((set) =>
            set.groups.some((group) => group.options.some((option) => option.eligibility))
          )
      )
      assert.ok(
        cloneIsolationSource,
        'The SRD integration corpus requires a conditional starting-equipment clone target.'
      )
      const cloneDraftSnapshot = cloneAudit.cloneDraftsBySourceId.get(cloneIsolationSource.id)
      assert.ok(
        cloneDraftSnapshot,
        `The controlled source ${cloneIsolationSource.id} has no owned clone draft.`
      )
      const sourceBeforeCloneRevision = canonicalize(cloneIsolationSource)
      const revisedClonePayload = classAuthoredDtoSchema.parse(cloneDraftSnapshot.payload)
      assert.equal(
        revisedClonePayload.category,
        'BASE',
        'The controlled clone must remain a base class.'
      )
      if (revisedClonePayload.category !== 'BASE') {
        throw new Error('The controlled clone must remain a base class.')
      }
      const revisedCloneOption = revisedClonePayload.startingEquipment.sets
        .flatMap((set) => set.groups)
        .flatMap((group) => group.options)
        .find((option) => option.eligibility)
      assert.ok(
        revisedCloneOption?.eligibility,
        'The controlled clone revision target must own an eligibility facet.'
      )
      revisedCloneOption.eligibility = cloneAuthoredItem({
        id: revisedCloneOption.eligibility.id,
        label: 'Starting Equipment Eligibility',
        eligibility: revisedCloneOption.eligibility
      }).eligibility
      const revisedCloneDraft = await createAuthoredDefinitionRepository(transaction).saveDraft({
        subjectKind: cloneDraftSnapshot.subjectKind,
        subjectId: cloneDraftSnapshot.subjectId,
        userId,
        systemId: cloneDraftSnapshot.systemId,
        label: cloneDraftSnapshot.label,
        payload: canonicalize(revisedClonePayload) as Json
      })
      assert.equal(revisedCloneDraft.revisionNumber, 2)
      assert.deepStrictEqual(
        canonicalize(cloneIsolationSource),
        sourceBeforeCloneRevision,
        'Revising a nested clone payload mutated its source object graph.'
      )
      cloneDraftSnapshot.payload = revisedCloneDraft.payload
      cloneDraftSnapshot.revisionId = revisedCloneDraft.revisionId
      assert.deepStrictEqual(
        canonicalize(await readRevisionSnapshot(transaction)),
        canonicalize(firstRevisions),
        'Creating and revising owned clones changed a source master revision.'
      )

      await seedBaselineContent({ db: transaction, systemId: SRD_SYSTEM_ID }, bundle)
      const secondRevisions = await readRevisionSnapshot(transaction)
      assert.deepStrictEqual(
        secondRevisions.map(({ subjectId, activeRevisionId, revisionNumber }) => ({
          subjectId,
          activeRevisionId,
          revisionNumber
        })),
        firstRevisions.map(({ subjectId, activeRevisionId, revisionNumber }) => ({
          subjectId,
          activeRevisionId,
          revisionNumber
        })),
        'Reseeding unchanged SRD content must not create revision churn.'
      )
      await assertHydratedCorpus(transaction, bundle)
      await assertStartingEquipmentEligibilityOwnership(transaction, bundle)

      const deltaBundle = structuredClone(bundle)
      const deltaClass = deltaBundle.subjects.classes.find(
        (record): record is SrdBaseClassRecord =>
          record.category === 'BASE' &&
          record.startingEquipment.sets.some((set) =>
            set.groups.some((group) => group.options.some((option) => option.eligibility))
          )
      )
      assert.ok(
        deltaClass,
        'The SRD integration corpus requires a conditional starting-equipment target.'
      )
      const deltaOption = deltaClass.startingEquipment.sets
        .flatMap((set) => set.groups)
        .flatMap((group) => group.options)
        .find((option) => option.eligibility)
      assert.ok(
        deltaOption?.eligibility,
        'The controlled delta target must own an eligibility facet.'
      )
      const priorEligibilityFacetId = deltaOption.eligibility.id
      deltaOption.eligibility = cloneAuthoredItem({
        id: deltaOption.eligibility.id,
        label: 'Starting Equipment Eligibility',
        eligibility: deltaOption.eligibility
      }).eligibility

      await seedBaselineContent({ db: transaction, systemId: SRD_SYSTEM_ID }, deltaBundle)
      const deltaRevisions = await readRevisionSnapshot(transaction)
      const priorById = new Map(secondRevisions.map((revision) => [revision.subjectId, revision]))
      const changed = deltaRevisions.filter((revision) => {
        return revision.activeRevisionId !== priorById.get(revision.subjectId)?.activeRevisionId
      })

      assert.deepStrictEqual(
        changed.map((revision) => revision.subjectId),
        [deltaClass.id],
        'A controlled source delta must create exactly one new active revision.'
      )
      assert.equal(
        changed[0]?.revisionNumber,
        (priorById.get(deltaClass.id)?.revisionNumber ?? 0) + 1
      )
      const cloneAfterSourceRevision = await createAuthoredDefinitionRepository(
        transaction
      ).findDraftBySubject({
        subjectKind: cloneDraftSnapshot.subjectKind,
        subjectId: cloneDraftSnapshot.subjectId,
        userId
      })
      assert.ok(
        cloneAfterSourceRevision,
        'The controlled clone draft disappeared after revising its source.'
      )
      assert.equal(
        cloneAfterSourceRevision.revisionId,
        cloneDraftSnapshot.revisionId,
        'Revising the source changed the clone revision identity.'
      )
      assert.deepStrictEqual(
        canonicalize(cloneAfterSourceRevision.payload),
        canonicalize(cloneDraftSnapshot.payload),
        'Revising the source changed the clone revision payload.'
      )
      await assertHydratedRecords(
        [deltaClass],
        (id) => createClassRepository(transaction).findById(id),
        'Class eligibility delta'
      )
      await assertStartingEquipmentEligibilityOwnership(transaction, deltaBundle)
      assert.equal(
        await transaction
          .selectFrom('facets')
          .select('id')
          .where('id', '=', priorEligibilityFacetId)
          .executeTakeFirst(),
        undefined,
        'Replacing option-owned eligibility must delete the orphaned prior facet.'
      )

      completed = {
        clones: cloneAudit.count,
        roots: allRootRecords(bundle).length,
        revisions: firstRevisions.length
      }
      throw rollback
    })
  } catch (error) {
    if (error !== rollback) throw error
  }

  assert.ok(completed, 'The rollback SRD integration gate did not reach its assertions.')
  return completed
}

async function main() {
  const connectionString = requireLocalDatabaseUrl()
  const db = createDb({ connectionString })

  try {
    const before = await readDatabaseFingerprint(db)
    const result = await runRollbackAudit(db)
    const after = await readDatabaseFingerprint(db)

    assert.deepStrictEqual(
      after,
      before,
      'The SRD integration gate leaked changes outside its transaction.'
    )
    console.info(
      JSON.stringify(
        {
          ...result,
          cloneIsolation: 'verified',
          convergence: 'verified',
          delta: 'verified',
          rollback: 'verified'
        },
        null,
        2
      )
    )
  } finally {
    await db.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
