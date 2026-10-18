import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { readMaintainedState } from '@artificer-toolkit/encounter-persistence/effectStore'
import type { EncounterMaintainedEffectDescriptorDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { convexTest } from '../../tests/convexTest'
import schema from '../schema'

const runMigration = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'rules/maintainedProvenanceMigration:run'
)

function uuid(offset: number) {
  return `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`
}

const ids = { encounter: uuid(1), actor: uuid(2), definition: uuid(3), occurrence: uuid(4) }

const policy = {
  schemaVersion: 2,
  maintenanceDefinitionId: ids.definition,
  definitionChecksum: 'a'.repeat(64),
  sourceActorId: ids.actor,
  replacementPolicy: 'REPLACE_SAME_DEFINITION',
  emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
} as const

it('moves a stored descriptor’s action identity into its provenance and re-checksums it', async ({
  onTestFinished
}) => {
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(t)

  // The pre-D151 stored form: the action ids sat on the descriptor itself.
  const legacy = { ...policy, sourceActionId: 'cast', sourceOccurrenceId: ids.occurrence }
  const carried: EncounterMaintainedEffectDescriptorDto = {
    ...policy,
    provenance: { kind: 'CARRIED', casterCharacterId: uuid(5) }
  }
  const createdAt = new Date().toISOString()
  const row = (id: string, descriptor: object) => ({
    id,
    encounterId: ids.encounter,
    ownerActorId: ids.actor,
    maintenanceDefinitionId: ids.definition,
    descriptorJson: JSON.stringify(descriptor),
    descriptorChecksum: checksumCanonicalJson(descriptor),
    version: 1,
    createdAt,
    updatedAt: createdAt
  })
  await t.run(async (ctx) => {
    await ctx.db.insert('encounterMaintainedEffectStates', row(uuid(10), legacy))
    await ctx.db.insert('encounterMaintainedEffectStates', row(uuid(11), carried))
  })

  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  // A second pass proves the migration is idempotent on migrated rows.
  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  const migrated = await t.run(async (ctx) =>
    (await ctx.db.query('encounterMaintainedEffectStates').take(10)).map(readMaintainedState)
  )
  expect(migrated.map(({ id, descriptor }) => ({ id, descriptor }))).toEqual([
    {
      id: uuid(10),
      descriptor: {
        ...policy,
        provenance: { kind: 'ACTION', sourceActionId: 'cast', sourceOccurrenceId: ids.occurrence }
      }
    },
    { id: uuid(11), descriptor: carried }
  ])
})
