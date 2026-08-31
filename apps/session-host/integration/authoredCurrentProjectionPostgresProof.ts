import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  CharacterMechanicsProjectionMismatchError,
  checksumCharacterMechanicsCommandLane,
  checksumCharacterMechanicsProjection,
  createAuthoredVersionRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createDb,
  getSpellListQuery,
  srdBaselineContent,
  type DBLike
} from '@artificer-toolkit/db'
import {
  activateAuthoredDomainInput,
  authoredDomainConfigs
} from '@artificer-toolkit/functions/services'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { sql } from 'kysely'

import { advanceCharacterMechanicsProjectionCommandState } from '../../../packages/functions/src/services/character/characterMechanicsCompiler.js'

const OPERATION_TIMEOUT_MS = 10_000
const CONTENTION_TIMEOUT_MS = 5_000
const MARKER_FAILURE_MESSAGE = 'authored-current-projection-marker-failure'

export type AuthoredCurrentProjectionProofGroup =
  | 'catalog'
  | 'mechanics'
  | 'concurrency'
  | 'concurrency-c9'

export interface AuthoredCurrentProjectionCharacter {
  characterId: string
  classId: string
  userId: string
}

export interface AuthoredCurrentProjectionPostgresProofOptions {
  characters: readonly AuthoredCurrentProjectionCharacter[]
  clericClassId: string
  connectionString: string
  group: AuthoredCurrentProjectionProofGroup
  onSpellCreated(spellId: string): void
  ownerUserId: string
  systemId: string
}

interface OwnedSpellFixture {
  authored: SpellAuthored
  checksum: string
  id: string
  version: number
  versionId: string
}

interface PreparedCharacterFixture {
  projection: CharacterMechanicsProjection
  spell: OwnedSpellFixture
  streamVersion: number
  target: AuthoredCurrentProjectionCharacter
}

interface MechanicsStateSnapshot {
  character: unknown
  events: unknown[]
  hitPoints: unknown
  projection: unknown
}

interface SpellStateSnapshot {
  classes: unknown[]
  marker: unknown
  root: unknown
  route: unknown
  versions: unknown[]
}

class ProofEnvironmentError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProofEnvironmentError'
  }
}

class ProofPlumbingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProofPlumbingError'
  }
}

class RollbackSentinel extends Error {}

function canonicalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function boundedReason(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error)
  return value.replaceAll(/\s+/g, ' ').slice(0, 600)
}

function isEnvironmentFailure(error: unknown): boolean {
  return /ECONNREFUSED|ECONNRESET|ENOTFOUND|connection (?:is )?(?:closed|terminated)|fetch failed|socket hang up/i.test(
    boundedReason(error)
  )
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

function wrongChecksum(value: string): string {
  const zeroes = '0'.repeat(64)
  return value === zeroes ? '1'.repeat(64) : zeroes
}

function taggedConnectionString(connectionString: string, label: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('application_name', `artificer-current-projection-${label}`)
  return url.toString()
}

function createTaggedDb(connectionString: string, label: string) {
  return createDb({ connectionString: taggedConnectionString(connectionString, label) })
}

async function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new ProofPlumbingError(`${label} exceeded ${OPERATION_TIMEOUT_MS} ms.`)),
          OPERATION_TIMEOUT_MS
        )
      })
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function waitForBlockedActivity(
  observer: DBLike,
  label: string,
  queryFragment: string
): Promise<void> {
  const applicationName = `artificer-current-projection-${label}`
  const deadline = Date.now() + CONTENTION_TIMEOUT_MS
  while (Date.now() < deadline) {
    const result = await sql<{ blocked: boolean }>`
      select exists (
        select 1
        from pg_stat_activity
        where datname = current_database()
          and application_name = ${applicationName}
          and wait_event_type = 'Lock'
          and query ilike ${`%${queryFragment}%`}
      ) as blocked
    `.execute(observer)
    if (result.rows[0]?.blocked) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  const diagnostic = await sql<{
    query: string
    state: string
    waitEvent: string | null
    waitEventType: string | null
  }>`
    select
      left(query, 300) as query,
      state,
      wait_event as "waitEvent",
      wait_event_type as "waitEventType"
    from pg_stat_activity
    where datname = current_database()
      and application_name = ${applicationName}
    order by pid
  `.execute(observer)
  throw new ProofPlumbingError(
    `${label} did not block on ${queryFragment} within ${CONTENTION_TIMEOUT_MS} ms: ${JSON.stringify(diagnostic.rows)}`
  )
}

function requireCharacter(
  options: AuthoredCurrentProjectionPostgresProofOptions,
  index: number
): AuthoredCurrentProjectionCharacter {
  const target = options.characters[index]
  if (!target) {
    throw new ProofPlumbingError(
      `${options.group} proof requires Character fixture ${index + 1}, but it was not provisioned.`
    )
  }
  return target
}

function requireClassByLabel(label: string) {
  const matches = srdBaselineContent.subjects.classes.filter((entry) => entry.label === label)
  assert.equal(matches.length, 1, `Expected exactly one seeded class named "${label}".`)
  return matches[0] as NonNullable<(typeof matches)[number]>
}

function findSeededClericSpell(clericClassId: string): SpellAuthored {
  const source = srdBaselineContent.subjects.spells.find(
    (spell) => spell.level > 0 && spell.classIds.includes(clericClassId)
  )
  assert.ok(source, 'The seeded corpus has no leveled Cleric Spell fixture.')
  return source
}

async function createOwnedSpell(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions,
  source: SpellAuthored,
  label: string,
  classIds: readonly string[] = source.classIds
): Promise<OwnedSpellFixture> {
  const id = randomUUID()
  options.onSpellCreated(id)
  await activateAuthoredDomainInput(
    db,
    authoredDomainConfigs.spells,
    {
      ...source,
      classIds: [...classIds],
      id,
      label: `PG ${label} ${id}`,
      systemId: options.systemId,
      userId: options.ownerUserId
    },
    options.ownerUserId
  )
  const record = await createAuthoredVersionRepository(db).findActive({
    subjectKind: 'SPELL',
    subjectId: id
  })
  assert.ok(record)
  return {
    authored: spellAuthoredDtoSchema.parse(record.authored.document) as SpellAuthored,
    checksum: record.authored.checksum,
    id,
    version: record.authored.version,
    versionId: record.authored.versionId
  }
}

async function activateNextSpellVersion(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions,
  spell: OwnedSpellFixture,
  classIds: readonly string[] = spell.authored.classIds
): Promise<OwnedSpellFixture> {
  await activateAuthoredDomainInput(
    db,
    authoredDomainConfigs.spells,
    {
      ...spell.authored,
      classIds: [...classIds],
      id: spell.id,
      label: `${spell.authored.label} v${spell.version + 1}`,
      userId: options.ownerUserId
    },
    options.ownerUserId
  )
  const record = await createAuthoredVersionRepository(db).findActive({
    subjectKind: 'SPELL',
    subjectId: spell.id
  })
  assert.ok(record)
  assert.equal(record.authored.version, spell.version + 1)
  return {
    authored: spellAuthoredDtoSchema.parse(record.authored.document) as SpellAuthored,
    checksum: record.authored.checksum,
    id: spell.id,
    version: record.authored.version,
    versionId: record.authored.versionId
  }
}

async function readSpellState(db: DBLike, spellId: string): Promise<SpellStateSnapshot> {
  const [root, versions, classes, marker, route] = await Promise.all([
    sql<{ snapshot: unknown }>`
      select to_jsonb(spell) as snapshot
      from public.spells spell
      where spell.id = ${spellId}::uuid
    `.execute(db),
    sql<{ snapshot: unknown }>`
      select to_jsonb(version) as snapshot
      from public.spell_versions version
      where version.spell_id = ${spellId}::uuid
      order by version.version, version.id
    `.execute(db),
    sql<{ snapshot: unknown }>`
      select to_jsonb(spell_class) as snapshot
      from public.spell_catalog_classes spell_class
      where spell_class.spell_id = ${spellId}::uuid
      order by spell_class.authored_version_id, spell_class.class_id
    `.execute(db),
    sql<{ snapshot: unknown }>`
      select to_jsonb(marker) as snapshot
      from public.spell_catalog_index_versions marker
      where marker.spell_id = ${spellId}::uuid
    `.execute(db),
    sql<{ snapshot: unknown }>`
      select to_jsonb(route) as snapshot
      from public.authored_route_ids route
      where route.subject_kind = 'SPELL'
        and route.subject_id = ${spellId}::uuid
    `.execute(db)
  ])
  return canonicalize({
    classes: classes.rows.map((row) => row.snapshot),
    marker: marker.rows[0]?.snapshot ?? null,
    root: root.rows[0]?.snapshot ?? null,
    route: route.rows[0]?.snapshot ?? null,
    versions: versions.rows.map((row) => row.snapshot)
  }) as SpellStateSnapshot
}

async function readMechanicsState(
  db: DBLike,
  characterId: string
): Promise<MechanicsStateSnapshot> {
  const [character, hitPoints, projection, events] = await Promise.all([
    sql<{ snapshot: unknown }>`
      select to_jsonb(character) as snapshot
      from public.characters character
      where character.id = ${characterId}::uuid
    `.execute(db),
    sql<{ snapshot: unknown }>`
      select to_jsonb(hit_points) as snapshot
      from public.character_hitpoint_state hit_points
      where hit_points.character_id = ${characterId}::uuid
    `.execute(db),
    sql<{ snapshot: unknown }>`
      select to_jsonb(projection) as snapshot
      from public.character_mechanics_projections projection
      where projection.character_id = ${characterId}::uuid
    `.execute(db),
    sql<{ snapshot: unknown }>`
      select to_jsonb(event) as snapshot
      from public.character_events event
      where event.character_id = ${characterId}::uuid
      order by event.occurred_at, event.event_id
    `.execute(db)
  ])
  return canonicalize({
    character: character.rows[0]?.snapshot ?? null,
    events: events.rows.map((row) => row.snapshot),
    hitPoints: hitPoints.rows[0]?.snapshot ?? null,
    projection: projection.rows[0]?.snapshot ?? null
  }) as MechanicsStateSnapshot
}

async function prepareOwnedSpellDependency(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions,
  target: AuthoredCurrentProjectionCharacter,
  label: string,
  existingSpell?: OwnedSpellFixture
): Promise<PreparedCharacterFixture> {
  const spell =
    existingSpell ??
    (await createOwnedSpell(db, options, findSeededClericSpell(options.clericClassId), label))
  const repository = createCharacterMechanicsProjectionRepository(db)
  const character = await createCharacterRepository(db).findById(target.characterId)
  assert.ok(character, `Character "${target.characterId}" was not found.`)
  const current = await repository.requireCurrent({
    characterId: target.characterId,
    expectedStreamVersion: character.stream_version
  })
  const next = nextHitPointProjection(current, current.characterStreamVersion + 1)
  const vectorByRoot = new Map(
    next.projection.authoredVersionVector.map((entry) => [
      `${entry.subjectKind}:${entry.subjectId}`,
      entry
    ])
  )
  vectorByRoot.set(`SPELL:${spell.id}`, {
    checksum: spell.checksum,
    subjectId: spell.id,
    subjectKind: 'SPELL',
    version: spell.version,
    versionId: spell.versionId
  })
  const projection = reorderProjectionVector(
    next.projection,
    [...vectorByRoot.values()].sort((left, right) =>
      `${left.subjectKind}:${left.subjectId}`.localeCompare(
        `${right.subjectKind}:${right.subjectId}`
      )
    )
  )
  const streamVersion = await createCharacterRepository(db).patchLiveHitPoints(target.characterId, {
    expected: next.expected,
    next: next.next,
    expectedStreamVersion: current.characterStreamVersion,
    afterPersist: async (trx, persistedStreamVersion) => {
      assert.equal(persistedStreamVersion, projection.characterStreamVersion)
      await createCharacterMechanicsProjectionRepository(trx).publish(projection)
    }
  })
  assert.equal(streamVersion, projection.characterStreamVersion)
  const attached = await repository.requireCurrent({
    characterId: target.characterId,
    expectedRuleRevisionId: projection.ruleRevisionId,
    expectedStreamVersion: streamVersion
  })
  assert.deepEqual(attached, projection)
  const metadata = await repository.requireCurrentMetadata({
    characterId: target.characterId,
    expectedCommandLaneChecksum: projection.commandLaneChecksum,
    expectedProjectionChecksum: projection.projectionChecksum,
    expectedRuleRevisionId: projection.ruleRevisionId,
    expectedStreamVersion: streamVersion
  })
  assert.equal(metadata.commandLaneChecksum, projection.commandLaneChecksum)
  assert.equal(metadata.projectionChecksum, projection.projectionChecksum)
  assert.ok(
    attached.authoredVersionVector.some(
      (entry) =>
        entry.subjectKind === 'SPELL' &&
        entry.subjectId === spell.id &&
        entry.versionId === spell.versionId &&
        entry.version === spell.version &&
        entry.checksum === spell.checksum
    ),
    `Character "${target.characterId}" did not publish the exact owned Spell dependency.`
  )
  return { projection: attached, spell, streamVersion, target }
}

function nextHitPointProjection(
  current: CharacterMechanicsProjection,
  nextStreamVersion: number
): {
  expected: { current: number; temp: number | undefined }
  next: { current: number; temp: number | undefined }
  projection: CharacterMechanicsProjection
} {
  const hitPoints = current.commandState.state.hitpoints
  const expected = { current: hitPoints.current, temp: hitPoints.temp }
  const next = { current: Math.max(0, expected.current - 1), temp: expected.temp }
  const projection = advanceCharacterMechanicsProjectionCommandState({
    current,
    characterCommandState: {
      ...current.commandState,
      state: {
        ...current.commandState.state,
        hitpoints: { ...current.commandState.state.hitpoints, ...next }
      }
    },
    characterStreamVersion: nextStreamVersion
  })
  return {
    expected,
    next,
    projection: canonicalize(projection) as CharacterMechanicsProjection
  }
}

function reorderProjectionVector(
  projection: CharacterMechanicsProjection,
  vector: CharacterMechanicsProjection['authoredVersionVector']
): CharacterMechanicsProjection {
  const laneCandidate: CharacterMechanicsProjection = {
    ...projection,
    authoredVersionVector: [...vector],
    commandLaneChecksum: '0'.repeat(64),
    projectionChecksum: '0'.repeat(64)
  }
  laneCandidate.commandLaneChecksum = checksumCharacterMechanicsCommandLane(laneCandidate)
  laneCandidate.projectionChecksum = checksumCharacterMechanicsProjection(laneCandidate)
  return laneCandidate
}

async function advanceCompactProjection(
  db: DBLike,
  current: CharacterMechanicsProjection
): Promise<CharacterMechanicsProjection> {
  const next = nextHitPointProjection(current, current.characterStreamVersion + 1)
  const streamVersion = await createCharacterRepository(db).patchLiveHitPoints(
    current.characterId,
    {
      expected: next.expected,
      next: next.next,
      expectedStreamVersion: current.characterStreamVersion,
      afterPersist: async (trx, persistedStreamVersion) => {
        assert.equal(persistedStreamVersion, next.projection.characterStreamVersion)
        await createCharacterMechanicsProjectionRepository(trx).advanceLiveCommandState({
          expectedPriorProjectionChecksum: current.projectionChecksum,
          expectedPriorStreamVersion: current.characterStreamVersion,
          projection: next.projection
        })
      }
    }
  )
  assert.equal(streamVersion, next.projection.characterStreamVersion)
  return next.projection
}

function isUnavailableSpellDependency(error: unknown): boolean {
  return (
    error instanceof CharacterMechanicsProjectionMismatchError &&
    error.message.includes('unavailable SPELL version dependency')
  )
}

async function assertUnavailableRootCompactRollback(
  db: DBLike,
  current: CharacterMechanicsProjection,
  spellId: string
): Promise<void> {
  const before = await readMechanicsState(db, current.characterId)
  const next = nextHitPointProjection(current, current.characterStreamVersion + 1)
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await sql`delete from public.spells where id = ${spellId}::uuid`.execute(trx)
      await createCharacterRepository(trx).patchLiveHitPoints(current.characterId, {
        expected: next.expected,
        next: next.next,
        expectedStreamVersion: current.characterStreamVersion,
        afterPersist: async (patchTrx) => {
          await createCharacterMechanicsProjectionRepository(patchTrx).advanceLiveCommandState({
            expectedPriorProjectionChecksum: current.projectionChecksum,
            expectedPriorStreamVersion: current.characterStreamVersion,
            projection: next.projection
          })
        }
      })
    }),
    isUnavailableSpellDependency
  )
  assert.deepEqual(await readMechanicsState(db, current.characterId), before)
}

async function assertAllOldProjectionLanesFail(
  db: DBLike,
  current: CharacterMechanicsProjection,
  unavailableSpellId: string
): Promise<void> {
  const repository = createCharacterMechanicsProjectionRepository(db)
  await assert.rejects(repository.publish(current), CharacterMechanicsProjectionMismatchError)
  await assert.rejects(
    repository.requireCurrent({
      characterId: current.characterId,
      expectedStreamVersion: current.characterStreamVersion
    }),
    CharacterMechanicsProjectionMismatchError
  )
  await assert.rejects(
    repository.requireCurrentMetadata({
      characterId: current.characterId,
      expectedCommandLaneChecksum: current.commandLaneChecksum,
      expectedProjectionChecksum: current.projectionChecksum,
      expectedRuleRevisionId: current.ruleRevisionId,
      expectedStreamVersion: current.characterStreamVersion
    }),
    CharacterMechanicsProjectionMismatchError
  )
  await assertUnavailableRootCompactRollback(db, current, unavailableSpellId)
}

async function assertAllOldProjectionLanesPass(
  db: DBLike,
  current: CharacterMechanicsProjection
): Promise<CharacterMechanicsProjection> {
  const repository = createCharacterMechanicsProjectionRepository(db)
  assert.deepEqual(await repository.publish(current), current)
  assert.deepEqual(
    await repository.requireCurrent({
      characterId: current.characterId,
      expectedRuleRevisionId: current.ruleRevisionId,
      expectedStreamVersion: current.characterStreamVersion
    }),
    current
  )
  const metadata = await repository.requireCurrentMetadata({
    characterId: current.characterId,
    expectedCommandLaneChecksum: current.commandLaneChecksum,
    expectedProjectionChecksum: current.projectionChecksum,
    expectedRuleRevisionId: current.ruleRevisionId,
    expectedStreamVersion: current.characterStreamVersion
  })
  assert.equal(metadata.projectionChecksum, current.projectionChecksum)
  const advanced = await advanceCompactProjection(db, current)
  assert.deepEqual(advanced.authoredVersionVector, current.authoredVersionVector)
  return advanced
}

async function installMarkerFailure(trx: DBLike, spellId: string): Promise<void> {
  await sql`
    select set_config('artificer.current_projection_spell_id', ${spellId}, true)
  `.execute(trx)
  await sql`
    create function pg_temp.raise_current_projection_marker_failure()
    returns trigger
    language plpgsql
    as $$
    begin
      raise exception 'authored-current-projection-marker-failure';
    end;
    $$
  `.execute(trx)
  await sql`
    create trigger authored_current_projection_marker_failure
    before insert or update on public.spell_catalog_index_versions
    for each row
    when (
      new.spell_id = current_setting('artificer.current_projection_spell_id')::uuid
    )
    execute function pg_temp.raise_current_projection_marker_failure()
  `.execute(trx)
}

async function runCatalogEquality(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions
): Promise<Record<string, unknown>> {
  const list = await getSpellListQuery(db, { systemId: options.systemId })
  const details: Record<string, unknown> = {}
  for (const label of ['Wizard', 'Cleric', 'Sorcerer', 'Warlock'] as const) {
    const classRecord = requireClassByLabel(label)
    const current = await sql<{ id: string; level: number }>`
      select distinct spell.id, spell.level
      from public.spell_catalog_classes spell_class
      join public.spells spell
        on spell.id = spell_class.spell_id
        and spell.active_version_id = spell_class.authored_version_id
      where spell_class.class_id = ${classRecord.id}::uuid
        and spell.system_id = ${options.systemId}::uuid
        and spell.status = 'ACTIVE'
      order by spell.id
    `.execute(db)
    const presentationIds = sortedUnique(
      list.meta.classes.find((entry) => entry.id === classRecord.id)?.spellIds ?? []
    )
    const currentIds = sortedUnique(current.rows.map((row) => row.id))
    assert.deepEqual(presentationIds, currentIds)
    const presentationLevelZero = presentationIds.filter(
      (id) => list.items.find((item) => item.id === id)?.level === 0
    )
    const currentLevelZero = current.rows.filter((row) => row.level === 0).map((row) => row.id)
    assert.deepEqual(sortedUnique(presentationLevelZero), sortedUnique(currentLevelZero))
    details[label] = {
      idsEqual: true,
      levelZero: currentLevelZero.length,
      total: currentIds.length
    }
  }
  return details
}

async function runCatalogActivation(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions
): Promise<Record<string, unknown>> {
  const v1 = await createOwnedSpell(
    db,
    options,
    findSeededClericSpell(options.clericClassId),
    'catalog-activation',
    [options.clericClassId]
  )
  const beforeList = await getSpellListQuery(db, { systemId: options.systemId })
  assert.ok(
    beforeList.meta.classes
      .find((entry) => entry.id === options.clericClassId)
      ?.spellIds.includes(v1.id)
  )
  const v2 = await activateNextSpellVersion(db, options, v1, [])
  const state = await readSpellState(db, v1.id)
  assert.equal((state.root as { active_version_id?: unknown }).active_version_id, v2.versionId)
  assert.equal(
    (state.marker as { authored_version_id?: unknown }).authored_version_id,
    v2.versionId
  )
  assert.equal(state.versions.length, 2)
  assert.deepEqual(state.classes, [])
  const afterList = await getSpellListQuery(db, { systemId: options.systemId })
  assert.equal(
    afterList.meta.classes.some((entry) => entry.spellIds.includes(v1.id)),
    false
  )
  return { spellId: v1.id, v1: v1.versionId, v2: v2.versionId }
}

async function runCatalogRollback(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions
): Promise<Record<string, unknown>> {
  const spell = await createOwnedSpell(
    db,
    options,
    findSeededClericSpell(options.clericClassId),
    'catalog-rollback',
    [options.clericClassId]
  )
  const before = await readSpellState(db, spell.id)
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await installMarkerFailure(trx, spell.id)
      await activateNextSpellVersion(trx, options, spell, [])
    }),
    (error: unknown) => error instanceof Error && error.message.includes(MARKER_FAILURE_MESSAGE)
  )
  assert.deepEqual(await readSpellState(db, spell.id), before)
  return { rollback: 'byte-equivalent', spellId: spell.id }
}

async function runFullPublicationAndReads(
  db: DBLike,
  fixture: PreparedCharacterFixture
): Promise<Record<string, unknown>> {
  const repository = createCharacterMechanicsProjectionRepository(db)
  const published = await repository.publish(fixture.projection)
  assert.deepEqual(published, fixture.projection)
  assert.deepEqual(
    await repository.requireCurrent({
      characterId: fixture.target.characterId,
      expectedRuleRevisionId: fixture.projection.ruleRevisionId,
      expectedStreamVersion: fixture.streamVersion
    }),
    fixture.projection
  )
  const metadata = await repository.requireCurrentMetadata({
    characterId: fixture.target.characterId,
    expectedCommandLaneChecksum: fixture.projection.commandLaneChecksum,
    expectedProjectionChecksum: fixture.projection.projectionChecksum,
    expectedRuleRevisionId: fixture.projection.ruleRevisionId,
    expectedStreamVersion: fixture.streamVersion
  })
  assert.equal(metadata.projectionChecksum, fixture.projection.projectionChecksum)
  await assert.rejects(
    repository.requireCurrent({
      characterId: fixture.target.characterId,
      expectedStreamVersion: fixture.streamVersion + 1
    }),
    CharacterMechanicsProjectionMismatchError
  )
  await assert.rejects(
    repository.requireCurrent({
      characterId: fixture.target.characterId,
      expectedRuleRevisionId: randomUUID(),
      expectedStreamVersion: fixture.streamVersion
    }),
    CharacterMechanicsProjectionMismatchError
  )
  await assert.rejects(
    repository.requireCurrentMetadata({
      characterId: fixture.target.characterId,
      expectedProjectionChecksum: wrongChecksum(fixture.projection.projectionChecksum),
      expectedStreamVersion: fixture.streamVersion
    }),
    CharacterMechanicsProjectionMismatchError
  )
  await assert.rejects(
    repository.requireCurrentMetadata({
      characterId: fixture.target.characterId,
      expectedCommandLaneChecksum: wrongChecksum(fixture.projection.commandLaneChecksum),
      expectedStreamVersion: fixture.streamVersion
    }),
    CharacterMechanicsProjectionMismatchError
  )
  return {
    projectionChecksum: fixture.projection.projectionChecksum,
    ruleRevisionId: fixture.projection.ruleRevisionId,
    streamVersion: fixture.streamVersion
  }
}

async function assertCorruptionRollsBack(
  db: DBLike,
  fixture: PreparedCharacterFixture,
  label: string,
  mutate: (trx: DBLike) => Promise<void>
): Promise<void> {
  const beforeSpell = await readSpellState(db, fixture.spell.id)
  const beforeMechanics = await readMechanicsState(db, fixture.target.characterId)
  const sentinel = new RollbackSentinel(label)
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await mutate(trx)
      const repository = createCharacterMechanicsProjectionRepository(trx)
      await assert.rejects(
        repository.requireCurrent({
          characterId: fixture.target.characterId,
          expectedStreamVersion: fixture.streamVersion
        }),
        CharacterMechanicsProjectionMismatchError
      )
      await assert.rejects(
        repository.requireCurrentMetadata({
          characterId: fixture.target.characterId,
          expectedStreamVersion: fixture.streamVersion
        }),
        CharacterMechanicsProjectionMismatchError
      )
      throw sentinel
    }),
    (error: unknown) => error === sentinel
  )
  assert.deepEqual(await readSpellState(db, fixture.spell.id), beforeSpell)
  assert.deepEqual(await readMechanicsState(db, fixture.target.characterId), beforeMechanics)
}

async function runCanonicalSourceCorruptions(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions,
  fixture: PreparedCharacterFixture
): Promise<Record<string, unknown>> {
  const beforeSpell = await readSpellState(db, fixture.spell.id)
  const sentinel = new RollbackSentinel('pointer-and-status-do-not-invalidate-pin')
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await sql`
        update public.spells
        set active_version_id = null, status = 'DRAFT'
        where id = ${fixture.spell.id}::uuid
      `.execute(trx)
      const repository = createCharacterMechanicsProjectionRepository(trx)
      assert.deepEqual(
        await repository.requireCurrent({
          characterId: fixture.target.characterId,
          expectedStreamVersion: fixture.streamVersion
        }),
        fixture.projection
      )
      const metadata = await repository.requireCurrentMetadata({
        characterId: fixture.target.characterId,
        expectedProjectionChecksum: fixture.projection.projectionChecksum,
        expectedStreamVersion: fixture.streamVersion
      })
      assert.equal(metadata.projectionChecksum, fixture.projection.projectionChecksum)
      throw sentinel
    }),
    (error: unknown) => error === sentinel
  )
  assert.deepEqual(await readSpellState(db, fixture.spell.id), beforeSpell)
  await assertCorruptionRollsBack(db, fixture, 'checksum-mismatch', async (trx) => {
    await sql`
      update public.spell_versions
      set authored_checksum = ${wrongChecksum(fixture.spell.checksum)}
      where id = ${fixture.spell.versionId}::uuid
    `.execute(trx)
  })
  await assertCorruptionRollsBack(db, fixture, 'version-mismatch', async (trx) => {
    await sql`
      update public.spell_versions
      set version = version + 1000000
      where id = ${fixture.spell.versionId}::uuid
    `.execute(trx)
  })
  await assertCorruptionRollsBack(db, fixture, 'canonical-system-mismatch', async (trx) => {
    const alternateSystemId = randomUUID()
    const alternateContentSourceId = randomUUID()
    await sql`
      insert into public.systems (id, user_id, label, description, ruleset_code, ruleset_version)
      select
        ${alternateSystemId}::uuid,
        ${options.ownerUserId}::uuid,
        'PG alternate current projection system',
        'Transaction-local mismatch fixture.',
        system.ruleset_code,
        system.ruleset_version
      from public.systems system
      where system.id = ${options.systemId}::uuid
    `.execute(trx)
    await sql`
      insert into public.content_sources (
        id, game_system_id, kind, owner_user_id, code, label, description
      ) values (
        ${alternateContentSourceId}::uuid,
        ${alternateSystemId}::uuid,
        'USER',
        ${options.ownerUserId}::uuid,
        null,
        'PG alternate current projection source',
        'Transaction-local mismatch fixture.'
      )
    `.execute(trx)
    await sql`
      update public.spells
      set
        system_id = ${alternateSystemId}::uuid,
        content_source_id = ${alternateContentSourceId}::uuid
      where id = ${fixture.spell.id}::uuid
    `.execute(trx)
  })
  await assertCorruptionRollsBack(db, fixture, 'missing-root-and-version', async (trx) => {
    await sql`delete from public.spells where id = ${fixture.spell.id}::uuid`.execute(trx)
  })
  return {
    corruptions: [
      'checksum-mismatch',
      'version-mismatch',
      'canonical-system-mismatch',
      'missing-root-and-version'
    ],
    pointerAndStatusDoNotInvalidatePin: true,
    rollback: 'verified'
  }
}

async function runCompactLane(
  db: DBLike,
  fixture: PreparedCharacterFixture
): Promise<Record<string, unknown>> {
  const before = await readMechanicsState(db, fixture.target.characterId)
  const advanced = await advanceCompactProjection(db, fixture.projection)
  const after = await readMechanicsState(db, fixture.target.characterId)
  assert.notDeepEqual(after.character, before.character)
  assert.notDeepEqual(after.hitPoints, before.hitPoints)
  assert.notDeepEqual(after.projection, before.projection)
  assert.deepEqual(after.events, before.events)
  assert.deepEqual(
    await createCharacterMechanicsProjectionRepository(db).requireCurrent({
      characterId: fixture.target.characterId,
      expectedStreamVersion: advanced.characterStreamVersion
    }),
    advanced
  )
  const once = await readMechanicsState(db, fixture.target.characterId)
  await assert.rejects(
    createCharacterMechanicsProjectionRepository(db).advanceLiveCommandState({
      expectedPriorProjectionChecksum: fixture.projection.projectionChecksum,
      expectedPriorStreamVersion: fixture.projection.characterStreamVersion,
      projection: advanced
    }),
    CharacterMechanicsProjectionMismatchError
  )
  assert.deepEqual(await readMechanicsState(db, fixture.target.characterId), once)
  await assertUnavailableRootCompactRollback(db, advanced, fixture.spell.id)
  return {
    exactlyOnce: true,
    staleRollback: true,
    streamVersion: advanced.characterStreamVersion
  }
}

async function runActivationFirst(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions,
  target: AuthoredCurrentProjectionCharacter
): Promise<Record<string, unknown>> {
  const fixture = await prepareOwnedSpellDependency(db, options, target, 'activation-first')
  const v2 = await activateNextSpellVersion(db, options, fixture.spell)
  const advanced = await assertAllOldProjectionLanesPass(db, fixture.projection)
  const retained = advanced.authoredVersionVector.find(
    (entry) => entry.subjectKind === 'SPELL' && entry.subjectId === fixture.spell.id
  )
  assert.equal(retained?.versionId, fixture.spell.versionId)
  return {
    activeVersionId: v2.versionId,
    pinnedVersionId: retained?.versionId,
    spellId: fixture.spell.id
  }
}

async function runUseFirstDeletion(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions,
  target: AuthoredCurrentProjectionCharacter
): Promise<Record<string, unknown>> {
  const fixture = await prepareOwnedSpellDependency(db, options, target, 'use-first-deletion')
  const useDb = createTaggedDb(options.connectionString, 'use-first-reader')
  const deletionDb = createTaggedDb(options.connectionString, 'use-first-deletion')
  const observer = createTaggedDb(options.connectionString, 'use-first-observer')
  let releaseUse: (() => void) | undefined
  let markUseReady: (() => void) | undefined
  const useReady = new Promise<void>((resolve) => {
    markUseReady = resolve
  })
  const useReleased = new Promise<void>((resolve) => {
    releaseUse = resolve
  })
  let deletion: Promise<string> | undefined
  const use = useDb.transaction().execute(async (trx) => {
    const repository = createCharacterMechanicsProjectionRepository(trx)
    const full = await repository.requireCurrent({
      characterId: target.characterId,
      expectedStreamVersion: fixture.streamVersion
    })
    const metadata = await repository.requireCurrentMetadata({
      characterId: target.characterId,
      expectedProjectionChecksum: fixture.projection.projectionChecksum,
      expectedStreamVersion: fixture.streamVersion
    })
    markUseReady?.()
    await useReleased
    return { full, metadata }
  })
  try {
    await withTimeout('use-first current-source locks', useReady)
    deletion = withTimeout(
      'use-first deletion',
      deletionDb.transaction().execute(async (trx) => {
        const deleted = await sql<{ id: string }>`
          delete from public.spells
          where id = ${fixture.spell.id}::uuid
          returning id
        `.execute(trx)
        assert.equal(deleted.rows.length, 1)
        return deleted.rows[0]!.id
      })
    )
    void deletion.catch(() => undefined)
    await waitForBlockedActivity(observer, 'use-first-deletion', 'spells')
    releaseUse?.()
    const [used, deletedId] = await withTimeout(
      'use-first deletion settlement',
      Promise.all([use, deletion])
    )
    assert.deepEqual(used.full, fixture.projection)
    assert.equal(used.metadata.projectionChecksum, fixture.projection.projectionChecksum)
    assert.equal(deletedId, fixture.spell.id)
  } finally {
    releaseUse?.()
    const pending: Promise<unknown>[] = [use]
    if (deletion) pending.push(deletion)
    await Promise.allSettled(pending)
    await Promise.all([useDb.destroy(), deletionDb.destroy(), observer.destroy()])
  }
  await assertAllOldProjectionLanesFail(db, fixture.projection, fixture.spell.id)
  return { deletionBlocked: true, pointInTimeUse: true, spellId: fixture.spell.id }
}

async function runConcurrentVectorPublication(
  db: DBLike,
  options: AuthoredCurrentProjectionPostgresProofOptions,
  firstTarget: AuthoredCurrentProjectionCharacter,
  secondTarget: AuthoredCurrentProjectionCharacter
): Promise<Record<string, unknown>> {
  const first = await prepareOwnedSpellDependency(db, options, firstTarget, 'deterministic-lock-a')
  const second = await prepareOwnedSpellDependency(
    db,
    options,
    secondTarget,
    'deterministic-lock-b',
    first.spell
  )
  const firstVectorKeys = sortedUnique(
    first.projection.authoredVersionVector.map(
      (entry) => `${entry.subjectKind}:${entry.subjectId}:${entry.versionId}`
    )
  )
  const secondVectorKeys = sortedUnique(
    second.projection.authoredVersionVector.map(
      (entry) => `${entry.subjectKind}:${entry.subjectId}:${entry.versionId}`
    )
  )
  assert.deepEqual(secondVectorKeys, firstVectorKeys)
  const representedKinds = new Set(
    first.projection.authoredVersionVector.map((entry) => entry.subjectKind)
  ).size
  assert.ok(representedKinds > 1)

  const holder = createTaggedDb(options.connectionString, 'deterministic-holder')
  const firstDb = createTaggedDb(options.connectionString, 'deterministic-a')
  const secondDb = createTaggedDb(options.connectionString, 'deterministic-b')
  const observer = createTaggedDb(options.connectionString, 'deterministic-observer')
  let releaseHolder: (() => void) | undefined
  let markHolderReady: (() => void) | undefined
  const holderReady = new Promise<void>((resolve) => {
    markHolderReady = resolve
  })
  const holderReleased = new Promise<void>((resolve) => {
    releaseHolder = resolve
  })
  const held = holder.transaction().execute(async (trx) => {
    await sql`select id from public.spells where id = ${first.spell.id}::uuid for update`.execute(
      trx
    )
    markHolderReady?.()
    await holderReleased
  })
  let firstAdvance: Promise<CharacterMechanicsProjection> | undefined
  let secondAdvance: Promise<CharacterMechanicsProjection> | undefined
  try {
    await withTimeout('deterministic root holder', holderReady)
    const firstNext = nextHitPointProjection(
      first.projection,
      first.projection.characterStreamVersion + 1
    )
    const secondNext = nextHitPointProjection(
      second.projection,
      second.projection.characterStreamVersion + 1
    )
    secondNext.projection = reorderProjectionVector(
      secondNext.projection,
      [...secondNext.projection.authoredVersionVector].reverse()
    )
    firstAdvance = createCharacterRepository(firstDb)
      .patchLiveHitPoints(first.target.characterId, {
        expected: firstNext.expected,
        next: firstNext.next,
        expectedStreamVersion: first.projection.characterStreamVersion,
        afterPersist: async (trx) => {
          await createCharacterMechanicsProjectionRepository(trx).publish(firstNext.projection)
        }
      })
      .then(() => firstNext.projection)
    secondAdvance = createCharacterRepository(secondDb)
      .patchLiveHitPoints(second.target.characterId, {
        expected: secondNext.expected,
        next: secondNext.next,
        expectedStreamVersion: second.projection.characterStreamVersion,
        afterPersist: async (trx) => {
          await createCharacterMechanicsProjectionRepository(trx).publish(secondNext.projection)
        }
      })
      .then(() => secondNext.projection)
    void firstAdvance.catch(() => undefined)
    void secondAdvance.catch(() => undefined)
    await Promise.all([
      waitForBlockedActivity(observer, 'deterministic-a', 'spell_versions'),
      waitForBlockedActivity(observer, 'deterministic-b', 'spell_versions')
    ])
    releaseHolder?.()
    await withTimeout('deterministic holder release', held)
    const settled = await withTimeout(
      'deterministic publication settlement',
      Promise.allSettled([firstAdvance, secondAdvance])
    )
    assert.equal(settled[0]?.status, 'fulfilled')
    assert.equal(settled[1]?.status, 'fulfilled')
    const repository = createCharacterMechanicsProjectionRepository(db)
    const firstCurrent = await repository.requireCurrent({
      characterId: first.target.characterId,
      expectedStreamVersion: firstNext.projection.characterStreamVersion
    })
    const secondCurrent = await repository.requireCurrent({
      characterId: second.target.characterId,
      expectedStreamVersion: secondNext.projection.characterStreamVersion
    })
    assert.deepEqual(firstCurrent, firstNext.projection)
    assert.deepEqual(secondCurrent, secondNext.projection)
    const [firstMetadata, secondMetadata] = await Promise.all([
      repository.requireCurrentMetadata({
        characterId: first.target.characterId,
        expectedCommandLaneChecksum: firstNext.projection.commandLaneChecksum,
        expectedProjectionChecksum: firstNext.projection.projectionChecksum,
        expectedStreamVersion: firstNext.projection.characterStreamVersion
      }),
      repository.requireCurrentMetadata({
        characterId: second.target.characterId,
        expectedCommandLaneChecksum: secondNext.projection.commandLaneChecksum,
        expectedProjectionChecksum: secondNext.projection.projectionChecksum,
        expectedStreamVersion: secondNext.projection.characterStreamVersion
      })
    ])
    assert.equal(firstMetadata.projectionChecksum, firstNext.projection.projectionChecksum)
    assert.equal(secondMetadata.projectionChecksum, secondNext.projection.projectionChecksum)
    return {
      representedKinds,
      reverseInput: true
    }
  } finally {
    releaseHolder?.()
    const pending: Promise<unknown>[] = [held]
    if (firstAdvance) pending.push(firstAdvance)
    if (secondAdvance) pending.push(secondAdvance)
    await Promise.allSettled(pending)
    await Promise.all([holder.destroy(), firstDb.destroy(), secondDb.destroy(), observer.destroy()])
  }
}

async function runResult(
  id: `C${number}`,
  group: AuthoredCurrentProjectionProofGroup,
  completed: number,
  groupTotal: number,
  operation: () => Promise<Record<string, unknown>>
): Promise<void> {
  try {
    const details = await withTimeout(id, operation())
    console.log(
      JSON.stringify({
        completed,
        details,
        fixedTotal: 9,
        group,
        groupTotal,
        result: id,
        status: 'PASS'
      })
    )
  } catch (error) {
    if (error instanceof ProofPlumbingError || isEnvironmentFailure(error)) {
      if (isEnvironmentFailure(error) && !(error instanceof ProofEnvironmentError)) {
        throw new ProofEnvironmentError(boundedReason(error), { cause: error })
      }
      throw error
    }
    console.error(
      JSON.stringify({
        completed: completed - 1,
        error: boundedReason(error),
        fixedTotal: 9,
        group,
        groupTotal,
        result: id,
        status: 'FAIL'
      })
    )
    throw error
  }
}

export async function proveAuthoredCurrentProjectionPostgresSemantics(
  options: AuthoredCurrentProjectionPostgresProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  try {
    if (options.group === 'catalog') {
      assert.equal(options.characters.length, 0)
      await runResult('C1', 'catalog', 1, 3, () => runCatalogEquality(db, options))
      await runResult('C2', 'catalog', 2, 3, () => runCatalogActivation(db, options))
      await runResult('C3', 'catalog', 3, 3, () => runCatalogRollback(db, options))
      return
    }

    if (options.group === 'mechanics') {
      assert.equal(options.characters.length, 1)
      let fixture: PreparedCharacterFixture | undefined
      await runResult('C4', 'mechanics', 1, 3, async () => {
        fixture = await prepareOwnedSpellDependency(
          db,
          options,
          requireCharacter(options, 0),
          'mechanics'
        )
        return runFullPublicationAndReads(db, fixture)
      })
      const preparedFixture = fixture
      if (!preparedFixture) {
        throw new ProofPlumbingError('C4 completed without a mechanics fixture.')
      }
      await runResult('C5', 'mechanics', 2, 3, () =>
        runCanonicalSourceCorruptions(db, options, preparedFixture)
      )
      await runResult('C6', 'mechanics', 3, 3, () => runCompactLane(db, preparedFixture))
      return
    }

    if (options.group === 'concurrency-c9') {
      assert.equal(options.characters.length, 2)
      await runResult('C9', 'concurrency', 3, 3, () =>
        runConcurrentVectorPublication(
          db,
          options,
          requireCharacter(options, 0),
          requireCharacter(options, 1)
        )
      )
      return
    }

    assert.equal(options.characters.length, 4)
    await runResult('C7', 'concurrency', 1, 3, () =>
      runActivationFirst(db, options, requireCharacter(options, 0))
    )
    await runResult('C8', 'concurrency', 2, 3, () =>
      runUseFirstDeletion(db, options, requireCharacter(options, 1))
    )
    await runResult('C9', 'concurrency', 3, 3, () =>
      runConcurrentVectorPublication(
        db,
        options,
        requireCharacter(options, 2),
        requireCharacter(options, 3)
      )
    )
  } finally {
    await db.destroy()
  }
}
