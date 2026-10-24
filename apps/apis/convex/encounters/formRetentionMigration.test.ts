import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import {
  readCharacterEffect,
  readEncounterEffect
} from '@artificer-toolkit/encounter-persistence/effectStore'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { convexTest } from '../../tests/convexTest'
import schema from '../schema'

const runMigration = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'encounters/formRetentionMigration:run'
)

function uuid(offset: number) {
  return `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`
}

const ids = { character: uuid(1), encounter: uuid(2), actor: uuid(3) }

const formContribution = {
  kind: 'CREATURE_FORM' as const,
  formOutcomeId: 'polymorph',
  creatureId: uuid(5),
  excessDamageCarriesOver: true,
  retainedAbilityIds: [],
  retainsProficiencies: false
}

function definition(
  origin: ActiveRuleEffectDefinitionDto['origin']
): ActiveRuleEffectDefinitionDto {
  const encounter = origin.kind === 'ENCOUNTER'
  return {
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    origin,
    authoredEffectId: uuid(10),
    compiledEntryId: uuid(11),
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId: uuid(10),
        gameSystemId: uuid(12),
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: uuid(11), nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'END_OF_TURN',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: encounter ? 'ENCOUNTER' : 'OWNER',
      expiration: {
        kind: 'TICKS',
        initialRemaining: 3,
        decrementStage: 'END_OF_TURN',
        anchor: 'HOLDER'
      }
    },
    stateContributions: [formContribution]
  }
}

const characterDefinition = definition({
  kind: 'CHARACTER',
  sourceAggregateId: ids.character,
  sourceOccurrenceId: uuid(13),
  rootCommandId: uuid(14)
})
const encounterDefinition = definition({
  kind: 'ENCOUNTER',
  sourceAggregateId: ids.encounter,
  sourceOccurrenceId: uuid(13),
  rootCommandId: uuid(14),
  sourceActorId: null
})

/** The pre-T2s stored form: the contribution names no retained scores and no proficiency rule. */
function legacyDefinitionJson(current: ActiveRuleEffectDefinitionDto) {
  const {
    retainedAbilityIds: _retained,
    retainsProficiencies: _proficiencies,
    ...legacyForm
  } = formContribution
  const legacy = { ...current, stateContributions: [legacyForm] }
  return {
    definitionJson: JSON.stringify(legacy),
    definitionChecksum: checksumCanonicalJson(legacy)
  }
}

it("gives each stored creature form no retained scores, the form's proficiencies, and re-checksums the effect", async ({
  onTestFinished
}) => {
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(t)

  const createdAt = new Date().toISOString()
  const lifecycle = { schemaVersion: 1 as const, remainingTicks: 3 }
  const row = {
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    lifecycle,
    lifecycleChecksum: checksumCanonicalJson(lifecycle)
  }
  await t.run(async (ctx) => {
    await ctx.db.insert('characterActiveRuleEffects', {
      ...row,
      id: uuid(20),
      characterId: ids.character,
      sourceEncounterId: null,
      concentrationCasterCharacterId: null,
      ...legacyDefinitionJson(characterDefinition)
    })
    await ctx.db.insert('encounterActiveRuleEffects', {
      ...row,
      id: uuid(21),
      encounterId: ids.encounter,
      targetActorId: ids.actor,
      ...legacyDefinitionJson(encounterDefinition)
    })
  })

  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  // A second pass proves the migration is idempotent on migrated rows.
  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  const migrated = await t.run(async (ctx) => ({
    character: (await ctx.db.query('characterActiveRuleEffects').take(10)).map(readCharacterEffect),
    encounter: (await ctx.db.query('encounterActiveRuleEffects').take(10)).map(readEncounterEffect)
  }))
  expect(migrated.character.map((effect) => effect.definition)).toEqual([characterDefinition])
  expect(migrated.encounter.map((effect) => effect.definition)).toEqual([encounterDefinition])
})
