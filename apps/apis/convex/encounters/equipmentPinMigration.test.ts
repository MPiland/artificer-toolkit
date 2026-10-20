import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { checksumActorSnapshot } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { hydrateStoredCompilation } from '@artificer-toolkit/rules-runtime/authoredPublicationHydrate'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internal } from '../_generated/api'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import { importedSubject } from '../../tests/fixtures/publication'

/** The runner migrates one row per scheduled batch, so a full pass exceeds convex-test's 100. */
const MIGRATION_BATCHES = 2000
const runMigration = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'content/compilationMigration:run'
)

const loadoutEntryId = '10000000-0000-4000-8000-000000000002'

async function fixtureWithLegacyPin() {
  const base = await createEncounterSceneFixture()
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...club, subjectKind: 'EQUIPMENT', document: club })]
  })
  const { version, stored } = await base.t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', club.id))
      .unique()
    const version = await ctx.db
      .query('authoredVersions')
      .withIndex('by_versionId', (q) => q.eq('versionId', root!.currentVersionPublicId))
      .unique()
    const stored = await ctx.db
      .query('authoredVersionCompilations')
      .withIndex('by_versionId', (q) => q.eq('versionId', version!.versionId))
      .unique()
    return { version: version!, stored: stored! }
  })
  // The pin D163 replaced: the authored Equipment itself, compiled by every reader.
  const legacyPin = {
    loadoutEntryId,
    equipmentId: club.id,
    sourceRevision: version.version,
    sourceVersionId: version.versionId,
    sourceChecksum: checksumRuleDocument(club),
    payload: JSON.parse(JSON.stringify(club))
  }
  return { base, stored: stored.compilation, legacyPin }
}

it('replaces Blueprint pins of the old shape with the pinned version compilation', async ({
  onTestFinished
}) => {
  const { base, stored, legacyPin } = await fixtureWithLegacyPin()
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(base.t)
  const [blueprint] = await base.t.run((ctx) => ctx.db.query('encounterBlueprints').collect())
  const enemies: { snapshot: Record<string, unknown> }[] = JSON.parse(blueprint!.enemiesJson)
  await base.t.run((ctx) =>
    ctx.db.patch(blueprint!._id, {
      enemiesJson: JSON.stringify(
        enemies.map((enemy) => ({
          ...enemy,
          snapshot: { ...enemy.snapshot, equipmentSources: [legacyPin] }
        }))
      )
    })
  )

  await base.t.mutation(runMigration, {})
  await base.t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)
  const migrated = await base.t.run((ctx) => ctx.db.get(blueprint!._id))
  await base.t.mutation(runMigration, {})
  await base.t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)

  const current: { snapshot: { equipmentSources: Record<string, unknown>[] } }[] = JSON.parse(
    migrated!.enemiesJson
  )
  for (const enemy of current) {
    const { payload, ...pin } = legacyPin
    expect(payload).toBeDefined()
    expect(enemy.snapshot.equipmentSources).toEqual([
      { ...pin, sourceChecksum: stored.authoredChecksum, compilation: stored }
    ])
    expect(
      hydrateStoredCompilation(
        'EQUIPMENT',
        { id: club.id, checksum: stored.authoredChecksum },
        stored
      ).id
    ).toBe(club.id)
  }
  expect(migrated!.setupChecksum).toBe(
    checksumCanonicalJson({ name: migrated!.name, enemies: current })
  )
  expect(await base.t.run((ctx) => ctx.db.get(blueprint!._id))).toEqual(migrated)
})

it('moves a Run actor to the migrated snapshot row and drops the legacy one', async ({
  onTestFinished
}) => {
  const { base, stored, legacyPin } = await fixtureWithLegacyPin()
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(base.t)
  const readActors = () =>
    base.t.run((ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
        .collect()
    )
  const [actor, ...others] = await readActors()
  const legacy = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterActorSnapshots')
      .withIndex('by_encounterId_checksum', (q) =>
        q.eq('encounterId', base.run.id).eq('checksum', actor!.snapshotChecksum)
      )
      .unique()
    const snapshot = { ...JSON.parse(row!.snapshotJson), equipmentSources: [legacyPin] }
    const checksum = checksumActorSnapshot(snapshot)
    await ctx.db.insert('encounterActorSnapshots', {
      encounterId: base.run.id,
      checksum,
      snapshotJson: JSON.stringify(snapshot)
    })
    await ctx.db.patch(actor!._id, { snapshotChecksum: checksum })
    return { checksum, original: row!.checksum }
  })

  await base.t.mutation(runMigration, {})
  await base.t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)
  const migrated = await readActors()
  await base.t.mutation(runMigration, {})
  await base.t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)

  const [row] = migrated
  expect(row!.snapshotChecksum).not.toBe(legacy.checksum)
  const snapshots = await base.t.run((ctx) =>
    ctx.db
      .query('encounterActorSnapshots')
      .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', base.run.id))
      .collect()
  )
  const snapshotRow = snapshots.find((snapshot) => snapshot.checksum === row!.snapshotChecksum)
  expect(snapshots.some((snapshot) => snapshot.checksum === legacy.checksum)).toBe(false)
  const snapshot = JSON.parse(snapshotRow!.snapshotJson)
  expect(checksumActorSnapshot(snapshot)).toBe(row!.snapshotChecksum)
  const { payload: _payload, ...pin } = legacyPin
  expect(snapshot.equipmentSources).toEqual([
    { ...pin, sourceChecksum: stored.authoredChecksum, compilation: stored }
  ])
  // The actor's own state still verifies, and the rows it did not touch are unchanged.
  expect(readStoredRunActor(row!).snapshotChecksum).toBe(row!.snapshotChecksum)
  expect(migrated.slice(1)).toEqual(others)
  expect(await readActors()).toEqual(migrated)
})
