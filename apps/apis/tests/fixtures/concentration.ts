import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../../convex/_generated/api'
import { sourceImportBatches } from '../../convex/content/importBatches'
import { createActiveRuleEffectStore } from '../../convex/rules/effectStore'
import { setupCharacterRun } from './encounterCharacter'
import { importedSubject } from './publication'
import { setAutoRollDice, type FixtureRolls } from './rollPreferences'

const creatureId = '00000000-0000-4000-8000-000000000ce0'
const featureId = '00000000-0000-4000-8000-000000000ce1'
const effectId = '00000000-0000-4000-8000-000000000ce2'

const creature = {
  ...wolf,
  id: creatureId,
  features: wolf.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          id: featureId,
          effects: feature.effects?.slice(0, 1).map((effect) => ({
            ...effect,
            id: effectId,
            invocation: {
              ...effect.invocation,
              triggerCode: 'ACTIVATED' as const,
              range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
              targeting: {
                selectionKind: 'SINGLE_TARGET' as const,
                dispositionKind: 'ANY' as const
              }
            },
            paths: effect.paths?.slice(0, 1).map((path) =>
              'resultBlock' in path
                ? {
                    ...path,
                    pathCode: 'ON_USE' as const,
                    resultBlock: {
                      ...path.resultBlock,
                      outcomes: path.resultBlock.outcomes.map((outcome) =>
                        outcome.effectKind === 'DAMAGE'
                          ? {
                              id: outcome.id,
                              effectKind: 'DAMAGE' as const,
                              damageTypeId: outcome.damageTypeId,
                              valueKind: 'FIXED' as const,
                              scalingKind: 'NONE' as const,
                              amount: 1
                            }
                          : outcome
                      )
                    }
                  }
                : path
            )
          }))
        }
  )
}

export async function setupConcentration(rolls: FixtureRolls) {
  const base = await setupCharacterRun()
  await setAutoRollDice(base.t, base.owner.userId, rolls === 'AUTO_ROLL')
  for (const definitions of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...SRD_CONCENTRATION_DEFINITIONS
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Concentration damage fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creatureId }]
  })
  const run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((candidate) => candidate.kind === 'CREATURE')
  const target = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  if (!actor || !target) throw new Error('Concentration fixture actors are unavailable.')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Concentration fixture Run is unavailable.')
    const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
    const active = encounterRunStateSchema.parse({
      ...state,
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: actor.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: actor.id
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
  })
  const actionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', run.id).eq('id', actor.id))
      .unique()
    if (!row) throw new Error('Concentration source actor is unavailable.')
    const capability = discoverEncounterFeatureActionCapabilities({
      actor: encounterRunActorStateSchema.parse(JSON.parse(row.stateJson)),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map((ability) => ({
        id: ability.id,
        code: ability.code
      }))
    }).find((candidate) => candidate.mechanicFacts.invocation.triggerCode === 'ACTIVATED')
    if (!capability) throw new Error('Concentration damage action is unavailable.')
    return capability.actionId
  })
  return { ...base, run, actor, target, actionId }
}

export function concentrationAction(
  fixture: Awaited<ReturnType<typeof setupConcentration>>,
  expectedVersion = fixture.run.version,
  commandId = crypto.randomUUID()
): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: fixture.run.id,
    commandId,
    expectedVersion,
    actorId: fixture.actor.id,
    targetActorId: fixture.target.id,
    actionId: fixture.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }
}

export async function seedConcentration(fixture: {
  t: Awaited<ReturnType<typeof setupCharacterRun>>['t']
  run: { id: string; gameSystemId: string }
  target: { id: string }
  character: { id: string }
}) {
  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  const poisoned = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'POISONED')
  if (!blinded || !poisoned) throw new Error('Concentration conditions are unavailable.')
  const maintenanceDefinition = SRD_CONCENTRATION_DEFINITIONS.find(
    (definition) => definition.id === SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  )
  if (!maintenanceDefinition)
    throw new Error('Concentration maintenance definition is unavailable.')
  return fixture.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore(ctx)
    const state = await store.createMaintainedState({
      id: crypto.randomUUID(),
      encounterId: fixture.run.id,
      ownerActorId: fixture.target.id,
      descriptor: {
        schemaVersion: 2,
        maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
        definitionChecksum: maintenanceDefinition.checksum,
        sourceActionId: crypto.randomUUID(),
        sourceOccurrenceId: crypto.randomUUID(),
        sourceActorId: fixture.target.id,
        replacementPolicy: 'REPLACE_SAME_DEFINITION',
        emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
      }
    })
    const sourceOccurrenceId = crypto.randomUUID()
    const compiledEntryId = crypto.randomUUID()
    const authoredEffectId = crypto.randomUUID()
    const definition = {
      schemaVersion: 2,
      origin: {
        kind: 'ENCOUNTER' as const,
        sourceAggregateId: fixture.run.id,
        sourceOccurrenceId,
        rootCommandId: crypto.randomUUID(),
        sourceActorId: fixture.target.id
      },
      authoredEffectId,
      compiledEntryId,
      frozenGraphNodeId: 'entry',
      frozenGraph: {
        schemaVersion: 1 as const,
        source: {
          definitionId: authoredEffectId,
          gameSystemId: fixture.run.gameSystemId,
          definitionFamilyKey: 'effect',
          checksum: 'a'.repeat(64)
        },
        capabilityContractVersion: 1,
        factContracts: [],
        nodes: [
          {
            id: 'entry',
            operation: { key: 'comparison', contractVersion: 1 },
            inputs: {}
          }
        ],
        sourceEntryBindings: [{ sourceEntryId: compiledEntryId, nodeId: 'entry' }],
        outputs: { result: { kind: 'LITERAL' as const, value: true } }
      },
      adapterFacts: {},
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: 'NONE' as const,
        consumeOnFirstEvent: null,
        endOnEvents: [],
        lifetimeScope: 'ENCOUNTER' as const,
        expiration: {
          kind: 'TICKS' as const,
          initialRemaining: 3,
          decrementStage: 'END_OF_TURN' as const
        }
      },
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: blinded.id, baselinePresent: false },
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: poisoned.id, baselinePresent: false }
      ]
    } satisfies ActiveRuleEffectDefinitionDto
    const dependent = await store.create({
      id: crypto.randomUUID(),
      owner: { kind: 'CHARACTER', characterId: fixture.character.id },
      definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 3 },
      maintainedEffectStateId: state.id
    })
    const independentAuthoredEffectId = crypto.randomUUID()
    const independentCompiledEntryId = crypto.randomUUID()
    const independent = await store.create({
      id: crypto.randomUUID(),
      owner: { kind: 'CHARACTER', characterId: fixture.character.id },
      definition: {
        ...definition,
        authoredEffectId: independentAuthoredEffectId,
        compiledEntryId: independentCompiledEntryId,
        frozenGraphNodeId: 'entry',
        frozenGraph: {
          ...definition.frozenGraph,
          source: {
            ...definition.frozenGraph.source,
            definitionId: independentAuthoredEffectId
          },
          sourceEntryBindings: [{ sourceEntryId: independentCompiledEntryId, nodeId: 'entry' }]
        },
        stateContributions: [
          {
            kind: 'CONDITION_OWNERSHIP',
            conditionId: poisoned.id,
            baselinePresent: false
          }
        ]
      },
      lifecycle: { schemaVersion: 1, remainingTicks: 3 }
    })
    const characterRow = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (query) => query.eq('id', fixture.character.id))
      .unique()
    if (!characterRow) throw new Error('Concentration Character is unavailable.')
    const character = characterAuthoredDtoSchema.parse(JSON.parse(characterRow.documentJson))
    const nextCharacter = {
      ...character,
      state: {
        ...character.state,
        conditions: [{ conditionTypeId: blinded.id }, { conditionTypeId: poisoned.id }]
      }
    }
    await ctx.db.patch(characterRow._id, {
      documentJson: canonicalizeRuleDocument(nextCharacter),
      checksum: checksumRuleDocument(nextCharacter)
    })
    return { state, dependent, independent, blinded, poisoned }
  })
}

export async function concentrationRecords(
  fixture: Awaited<ReturnType<typeof setupConcentration>>
) {
  return fixture.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', fixture.run.id))
      .collect(),
    states: await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (query) =>
        query.eq('encounterId', fixture.run.id)
      )
      .collect(),
    effects: await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (query) =>
        query.eq('characterId', fixture.character.id)
      )
      .collect(),
    character: await ctx.db
      .query('characters')
      .withIndex('by_publicId', (query) => query.eq('id', fixture.character.id))
      .unique(),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (query) => query.eq('encounterId', fixture.run.id))
      .collect(),
    characterReceipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (query) =>
        query.eq('characterId', fixture.character.id)
      )
      .collect(),
    pending: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (query) =>
        query.eq('encounterId', fixture.run.id).eq('state', 'PENDING')
      )
      .collect(),
    completed: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (query) =>
        query.eq('encounterId', fixture.run.id).eq('state', 'COMPLETED')
      )
      .collect()
  }))
}
