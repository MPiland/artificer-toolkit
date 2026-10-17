import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'

const runActorIdentity = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'encounters/actorIdentityMigration:run'
)
const identityFields = ['id', 'encounterId', 'snapshotChecksum', 'sourceFactsChecksum'] as const

it('keeps an actor’s identity in its row columns alone and trims rows that repeat it', async ({
  onTestFinished
}) => {
  const base = await createEncounterSceneFixture()
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(base.t)
  const readRows = () =>
    base.t.run(async (ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
        .collect()
    )

  const written = await readRows()
  expect(written.length).toBeGreaterThan(1)
  for (const row of written) {
    const state: Record<string, unknown> = JSON.parse(row.stateJson)
    for (const field of identityFields) expect(state).not.toHaveProperty(field)
    const actor = readStoredRunActor(row)
    expect(actor.id).toBe(row.id)
    expect(actor.encounterId).toBe(row.encounterId)
    expect(actor.snapshotChecksum).toBe(row.snapshotChecksum)
  }

  // A row written before the trim repeats the identity inside its stored state.
  await base.t.run(async (ctx) => {
    for (const row of written)
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify({
          ...JSON.parse(row.stateJson),
          id: row.id,
          encounterId: row.encounterId,
          snapshotChecksum: row.snapshotChecksum,
          ...(row.sourceFactsChecksum === null
            ? {}
            : { sourceFactsChecksum: row.sourceFactsChecksum })
        })
      })
  })

  await base.t.mutation(runActorIdentity, {})
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)

  const migrated = await readRows()
  expect(migrated.map((row) => row.stateJson)).toEqual(written.map((row) => row.stateJson))
})
