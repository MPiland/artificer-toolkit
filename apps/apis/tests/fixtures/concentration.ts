import { createConvexEncounterStore } from '../../convex/lib/convexEncounterStore'
import { readTestActor } from './storedActors'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { encodeCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { srdWolf as wolf } from './srdCreatures'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../../convex/_generated/api'
import { readCharacterRecord, readCharacterRow } from '../../convex/characters/stateDocuments'
import { readReceiptHeaders } from '../../convex/lib/receiptLedgers'
import { sourceImportBatches } from '../../convex/content/importBatches'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { setupCharacterRun } from './encounterCharacter'
import { importedSubject, importSeededSubjects } from './publication'
import { setAutoRollDice, type FixtureRolls } from './rollPreferences'
import { activateFixtureRun } from './activeInitiative'
import { readEncounterHistory } from './localRoomWorker'

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

/**
 * A Creature attacks the Character, or with `holder: 'CREATURE'` a second Creature of the same kind;
 * `source` swaps in another Creature action by trigger.
 */
export async function setupConcentration(
  rolls: FixtureRolls,
  source: { creature: { id: string; systemId: string; label: string }; triggerCode: string } = {
    creature,
    triggerCode: 'ACTIVATED'
  },
  holder: 'CHARACTER' | 'CREATURE' = 'CHARACTER'
) {
  const base = await setupCharacterRun()
  // Each roll follows its actor's controller: the GM for Creatures, the player for the Character.
  for (const userId of [base.owner.userId, base.player.userId])
    await setAutoRollDice(base.t, userId, rolls === 'AUTO_ROLL')
  for (const definitions of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...SRD_CONCENTRATION_DEFINITIONS
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...source.creature, subjectKind: 'CREATURE', document: source.creature })
    ]
  })
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Concentration damage fixture',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: holder === 'CREATURE' ? 2 : 1 }, () => ({
      kind: 'CREATURE' as const,
      sourceId: source.creature.id
    }))
  })
  const run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const creatures = run.actors.filter((candidate) => candidate.kind === 'CREATURE')
  const actor = creatures[0]
  const target =
    holder === 'CREATURE'
      ? creatures[1]
      : run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  if (!actor || !target) throw new Error('Concentration fixture actors are unavailable.')
  await base.t.run((ctx) =>
    activateFixtureRun(ctx, run.id, {
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: actor.id
    })
  )
  const actionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', run.id).eq('id', actor.id))
      .unique()
    if (!row) throw new Error('Concentration source actor is unavailable.')
    const capability = discoverEncounterFeatureActionCapabilities({
      spells: new Map(),
      actor: await readTestActor(ctx, row),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map((ability) => ({
        id: ability.id,
        code: ability.code
      }))
    }).find((candidate) => candidate.mechanicFacts.invocation.triggerCode === source.triggerCode)
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
    target: { kind: 'ACTOR', actorId: fixture.target.id },
    actionId: fixture.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }
}

/** The SRD Concentration state `ownerActorId` holds in the Run. */
export function createConcentrationState(
  store: ReturnType<typeof createActiveRuleEffectStore>,
  input: { encounterId: string; ownerActorId: string }
) {
  const maintenanceDefinition = SRD_CONCENTRATION_DEFINITIONS.find(
    (definition) => definition.id === SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  )
  if (!maintenanceDefinition)
    throw new Error('Concentration maintenance definition is unavailable.')
  return store.createMaintainedState({
    id: crypto.randomUUID(),
    encounterId: input.encounterId,
    ownerActorId: input.ownerActorId,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      definitionChecksum: maintenanceDefinition.checksum,
      provenance: {
        kind: 'ACTION',
        sourceActionId: crypto.randomUUID(),
        sourceOccurrenceId: crypto.randomUUID()
      },
      sourceActorId: input.ownerActorId,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    }
  })
}

export async function seedConcentration(fixture: {
  t: Awaited<ReturnType<typeof setupCharacterRun>>['t']
  run: { id: string; gameSystemId: string }
  target: { id: string }
  character: { id: string }
  /** The Character's current hit points when seeded; unchanged when omitted. */
  characterHitPoints?: number
  /** The target is a Creature: its effects belong to its Run actor and it has no Character state. */
  creatureHolder?: boolean
}) {
  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  const poisoned = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'POISONED')
  if (!blinded || !poisoned) throw new Error('Concentration conditions are unavailable.')
  return fixture.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const state = await createConcentrationState(store, {
      encounterId: fixture.run.id,
      ownerActorId: fixture.target.id
    })
    const sourceOccurrenceId = crypto.randomUUID()
    const compiledEntryId = crypto.randomUUID()
    const authoredEffectId = crypto.randomUUID()
    const definition = {
      schemaVersion: 2,
      linkedEffectId: null,
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
        consumeOnFirstEvents: [],
        endOnEvents: [],
        endOnTriggers: [],
        endOnConditionIds: [],
        holderEnd: null,
        lifetimeScope: 'ENCOUNTER' as const,
        expiration: {
          kind: 'TICKS' as const,
          initialRemaining: 3,
          decrementStage: 'END_OF_TURN' as const,
          anchor: 'HOLDER' as const
        }
      },
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: blinded.id, baselinePresent: false },
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: poisoned.id, baselinePresent: false }
      ]
    } satisfies ActiveRuleEffectDefinitionDto
    const owner = fixture.creatureHolder
      ? ({
          kind: 'ENCOUNTER_ACTOR',
          encounterId: fixture.run.id,
          targetActorId: fixture.target.id
        } as const)
      : ({ kind: 'CHARACTER', characterId: fixture.character.id } as const)
    const dependent = await store.create({
      id: crypto.randomUUID(),
      owner,
      definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 3 },
      maintainedEffectStateId: state.id
    })
    const independentAuthoredEffectId = crypto.randomUUID()
    const independentCompiledEntryId = crypto.randomUUID()
    const independent = await store.create({
      id: crypto.randomUUID(),
      owner,
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
    if (fixture.creatureHolder) return { state, dependent, independent, blinded, poisoned }
    const characterRow = await readCharacterRow(ctx, fixture.character.id)
    if (!characterRow) throw new Error('Concentration Character is unavailable.')
    const character = readCharacterRecord(characterRow)
    const encoded = encodeCharacterRecord(characterRow, {
      document: {
        ...character,
        state: {
          ...character.state,
          ...(fixture.characterHitPoints === undefined
            ? {}
            : { hitpoints: { ...character.state.hitpoints, current: fixture.characterHitPoints } }),
          conditions: [{ conditionTypeId: blinded.id }, { conditionTypeId: poisoned.id }]
        }
      },
      streamVersion: characterRow.play.streamVersion,
      updatedAt: characterRow.updatedAt
    })
    await ctx.db.patch(characterRow.play._id, {
      state: encoded.play.state,
      checksum: encoded.play.checksum
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
    actorEffects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (query) =>
        query.eq('encounterId', fixture.run.id)
      )
      .collect(),
    character: await readCharacterRow(ctx, fixture.character.id),
    receipts: await (
      await readEncounterHistory(ctx)
    )
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (query) => query.eq('encounterId', fixture.run.id))
      .collect(),
    characterReceipts: await readReceiptHeaders(
      ctx,
      'characterCommandReceipts',
      await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (query) =>
          query.eq('characterId', fixture.character.id)
        )
        .collect()
    ),
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
