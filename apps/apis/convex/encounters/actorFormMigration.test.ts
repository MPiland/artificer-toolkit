import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { runActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { encounterStoredRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'

const runActorForm = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'encounters/actorFormMigration:run'
)

it('gives stored actors a null form and form-origin checksum, and re-checksums them', async ({
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
  const current = await readRows()
  expect(current.length).toBeGreaterThan(0)

  // Rows written before D130 carry no form and a checksum over that shape.
  await base.t.run(async (ctx) => {
    for (const row of current) {
      const { form: _form, ...legacy }: Record<string, unknown> = JSON.parse(row.stateJson)
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(legacy),
        stateChecksum: checksumCanonicalJson(legacy)
      })
    }
  })

  await base.t.mutation(runActorForm, {})
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  // A second pass proves the migration is idempotent on migrated rows.
  await base.t.mutation(runActorForm, {})
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)

  const migrated = await readRows()
  expect(migrated).toHaveLength(current.length)
  for (const row of migrated) {
    const actor = encounterStoredRunActorStateSchema.parse(JSON.parse(row.stateJson))
    expect(row.formOriginSnapshotChecksum).toBeNull()
    if (actor.kind !== 'CHARACTER') expect(actor.form).toBeNull()
    expect(row.stateChecksum).toBe(checksumCanonicalJson(runActorPlayState(actor)))
  }
})
