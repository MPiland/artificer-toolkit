import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { buildCharacterGrantFoldModifierFacts } from '@artificer-toolkit/rules-runtime/character/characterGrantFoldSourceFacts'
import {
  readCharacterEffect,
  readEncounterEffect
} from '@artificer-toolkit/encounter-persistence/effectStore'
import { readSpatialEffect } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { modifierGrantDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { compileModifierGrant } from '@artificer-toolkit/shared/compilers'
import { convexTest } from '../../tests/convexTest'
import schema from '../schema'

const runMigration = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'rules/modifierOperationMigration:run'
)

function uuid(offset: number) {
  return `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`
}

const ids = { character: uuid(1), encounter: uuid(2), actor: uuid(3), scene: uuid(4) }

const grants = [
  compileModifierGrant(
    modifierGrantDtoSchema.parse({
      id: 'shield-of-faith',
      order: 0,
      grantKind: 'MODIFIER_GRANT',
      selectionKind: 'GRANTED',
      valueDomainCode: 'ARMOR_CLASS',
      modifierKind: 'BONUS',
      scope: 'GLOBAL',
      domain: {},
      payload: { valueKind: 'FIXED', amount: 2 }
    })
  ),
  compileModifierGrant(
    modifierGrantDtoSchema.parse({
      id: 'font-of-inspiration',
      order: 1,
      grantKind: 'MODIFIER_GRANT',
      selectionKind: 'GRANTED',
      valueDomainCode: 'CHARGE_RESET',
      modifierKind: 'REPLACE_CHARGE_RESET_KIND',
      scope: 'GLOBAL',
      domain: {},
      payload: { resetKind: 'SHORT_REST' },
      restrictions: {
        id: 'font-restriction',
        groups: [
          {
            id: 'font-group',
            order: 0,
            contexts: [
              {
                id: 'font-resources',
                order: 0,
                subject: 'RESOURCE',
                authoringModeKind: 'SELECTED',
                resourceIds: ['bardic-inspiration']
              }
            ]
          }
        ]
      }
    })
  )
]
const modifiers = buildCharacterGrantFoldModifierFacts(grants)
const grantContribution = {
  kind: 'MODIFIER_GRANT' as const,
  applyGrantOutcomeId: 'apply-grant',
  modifiers,
  senses: [],
  sourceLabel: 'Shield of Faith',
  sourceHidden: false
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
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: encounter ? 'ENCOUNTER' : 'OWNER',
      expiration: encounter
        ? { kind: 'TICKS', initialRemaining: 3, decrementStage: 'END_OF_TURN', anchor: 'HOLDER' }
        : { kind: 'INDEFINITE' }
    },
    stateContributions: [grantContribution]
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

/** The pre-PLATFORM-20 stored form: each operation carries its compiled grant as a JSON dump. */
function legacyDefinitionJson(current: ActiveRuleEffectDefinitionDto) {
  const legacy = {
    ...current,
    stateContributions: [
      {
        ...grantContribution,
        modifiers: modifiers.map(
          (
            { scope: _scope, payload: _payload, scopeResourceIds: _resources, ...operation },
            index
          ) => ({
            ...operation,
            grant: grants[index]
          })
        )
      }
    ]
  }
  return {
    definitionJson: JSON.stringify(legacy),
    definitionChecksum: checksumCanonicalJson(legacy)
  }
}

it('rebuilds frozen modifier operations from their grant dump and re-checksums each effect', async ({
  onTestFinished
}) => {
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(t)
  expect(modifiers.map(({ scope, scopeResourceIds }) => ({ scope, scopeResourceIds }))).toEqual([
    { scope: 'GLOBAL', scopeResourceIds: [] },
    { scope: 'GLOBAL', scopeResourceIds: ['bardic-inspiration'] }
  ])

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
      ...legacyDefinitionJson(encounterDefinition),
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
  expect(migrated.spatial.map((effect) => effect.definition)).toEqual([encounterDefinition])
})
