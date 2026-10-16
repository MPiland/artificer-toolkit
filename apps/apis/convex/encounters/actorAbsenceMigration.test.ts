import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { runActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { encounterStoredRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'

const runActorAbsence = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'encounters/actorAbsenceMigration:run'
)

it('rewrites the retired outOfInitiative flag to absence and re-checksums stored actors', async ({
  onTestFinished
}) => {
  const base = await createEncounterSceneFixture()
  const [removedId, presentId] = base.run.actors.map((actor) => actor.id)
  if (!removedId || !presentId) throw new Error('The Run needs two actors.')
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
  const current = await readRows()
  const currentById = new Map(current.map((row) => [row.id, row]))

  // Rows written before D125 carry the flag, no `absence` and a checksum over that shape.
  await base.t.run(async (ctx) => {
    for (const [id, outOfInitiative] of [
      [removedId, true],
      [presentId, false]
    ] as const) {
      const row = currentById.get(id)!
      const { absence: _absence, ...legacy }: Record<string, unknown> = JSON.parse(row.stateJson)
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify({ ...legacy, outOfInitiative }),
        stateChecksum: checksumCanonicalJson({ ...legacy, outOfInitiative })
      })
    }
  })

  await base.t.mutation(runActorAbsence, {})
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  // A second pass proves the migration is idempotent on migrated rows.
  await base.t.mutation(runActorAbsence, {})
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)

  const migrated = await readRows()
  for (const row of migrated) {
    const actor = encounterStoredRunActorStateSchema.parse(JSON.parse(row.stateJson))
    expect(actor).not.toHaveProperty('outOfInitiative')
    expect(row.stateChecksum).toBe(checksumCanonicalJson(runActorPlayState(actor)))
    expect(actor.absence).toBe(row.id === removedId ? 'GM_REMOVED' : null)
  }
})
