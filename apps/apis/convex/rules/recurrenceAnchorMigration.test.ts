import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import {
  readCharacterEffect,
  readEncounterEffect
} from '@artificer-toolkit/encounter-persistence/effectStore'
import { readSpatialEffect } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { convexTest } from '../../tests/convexTest'
import schema from '../schema'

const runMigration = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'rules/recurrenceAnchorMigration:run'
)

function uuid(offset: number) {
  return `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`
}

const ids = {
  character: uuid(1),
  encounter: uuid(2),
  actor: uuid(3),
  scene: uuid(4),
  source: uuid(5)
}

type Recurrence = NonNullable<ActiveRuleEffectDefinitionDto['recurrence']>

function definition(
  origin: ActiveRuleEffectDefinitionDto['origin'],
  anchor: Recurrence['anchor'],
  expiration: Recurrence['expiration']
): ActiveRuleEffectDefinitionDto {
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
      recurrenceStage: 'NONE',
      anchor,
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: origin.kind === 'ENCOUNTER' ? 'ENCOUNTER' : 'OWNER',
      expiration
    },
    stateContributions: []
  }
}

const encounterOrigin = {
  kind: 'ENCOUNTER' as const,
  sourceAggregateId: ids.encounter,
  sourceOccurrenceId: uuid(13),
  rootCommandId: uuid(14),
  sourceActorId: ids.source
}
const ticks = {
  kind: 'TICKS' as const,
  initialRemaining: 3,
  decrementStage: 'END_OF_TURN' as const
}
// An uncounted recurrence stored no anchor: its holder's turns timed it.
const characterDefinition = definition(
  {
    kind: 'CHARACTER',
    sourceAggregateId: ids.character,
    sourceOccurrenceId: uuid(13),
    rootCommandId: uuid(14)
  },
  'HOLDER',
  { kind: 'INDEFINITE' }
)
const encounterDefinition = definition(encounterOrigin, 'SOURCE', ticks)
const spatialDefinition = definition(encounterOrigin, 'HOLDER', ticks)

/** The pre-T6n2 stored form: a counted expiration names its anchor, the recurrence none. */
function legacyDefinitionJson(current: ActiveRuleEffectDefinitionDto) {
  if (!current.recurrence) throw new Error('Each fixture has a recurrence.')
  const { anchor, expiration, ...recurrence } = current.recurrence
  const legacy = {
    ...current,
    recurrence: {
      ...recurrence,
      expiration: expiration.kind === 'TICKS' ? { ...expiration, anchor } : expiration
    }
  }
  return {
    definitionJson: JSON.stringify(legacy),
    definitionChecksum: checksumCanonicalJson(legacy)
  }
}

it('moves each counted anchor onto its recurrence, times the rest by the holder, and re-checksums each effect', async ({
  onTestFinished
}) => {
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(t)

  const createdAt = new Date().toISOString()
  const ownerLifecycle = { schemaVersion: 1 as const, remainingTicks: null }
  const encounterLifecycle = { schemaVersion: 1 as const, remainingTicks: 3 }
  const row = {
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    createdAt,
    updatedAt: createdAt
  }
  await t.run(async (ctx) => {
    await ctx.db.insert('characterActiveRuleEffects', {
      ...row,
      id: uuid(20),
      characterId: ids.character,
      sourceEncounterId: null,
      concentrationCasterCharacterId: null,
      ...legacyDefinitionJson(characterDefinition),
      lifecycle: ownerLifecycle,
      lifecycleChecksum: checksumCanonicalJson(ownerLifecycle)
    })
    await ctx.db.insert('encounterActiveRuleEffects', {
      ...row,
      id: uuid(21),
      encounterId: ids.encounter,
      targetActorId: ids.actor,
      ...legacyDefinitionJson(encounterDefinition),
      lifecycle: encounterLifecycle,
      lifecycleChecksum: checksumCanonicalJson(encounterLifecycle)
    })
    const placement = {
      schemaVersion: 1 as const,
      anchorKind: 'FIXED' as const,
      sourceTokenId: null,
      geometry: {
        frame: 'SCENE_ABSOLUTE' as const,
        shape: { kind: 'CIRCLE' as const, center: { x: 0, y: 0 }, radius: 5 }
      },
      triggerModes: ['ENTER' as const],
      movementKinds: ['VOLUNTARY' as const],
      activation: 'ONE_SHOT' as const,
      visibility: 'PUBLIC' as const,
      revealOnTrigger: false
    }
    const spatialState = { schemaVersion: 1 as const, revealed: true }
    await ctx.db.insert('encounterSpatialRuleEffects', {
      ...row,
      id: uuid(22),
      encounterId: ids.encounter,
      sceneId: ids.scene,
      ...legacyDefinitionJson(spatialDefinition),
      lifecycle: encounterLifecycle,
      lifecycleChecksum: checksumCanonicalJson(encounterLifecycle),
      placement,
      placementChecksum: checksumCanonicalJson(placement),
      spatialState,
      spatialStateChecksum: checksumCanonicalJson(spatialState)
    })
  })

  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  // A second pass proves the migration is idempotent on migrated rows.
  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  const migrated = await t.run(async (ctx) => ({
    character: (await ctx.db.query('characterActiveRuleEffects').take(10)).map(readCharacterEffect),
    encounter: (await ctx.db.query('encounterActiveRuleEffects').take(10)).map(readEncounterEffect),
    spatial: (await ctx.db.query('encounterSpatialRuleEffects').take(10)).map(readSpatialEffect)
  }))
  expect(migrated.character.map((effect) => effect.definition)).toEqual([characterDefinition])
  expect(migrated.encounter.map((effect) => effect.definition)).toEqual([encounterDefinition])
  expect(migrated.spatial.map((effect) => effect.definition)).toEqual([spatialDefinition])
})
