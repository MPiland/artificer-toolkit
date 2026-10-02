import {
  createConvexEncounterStore,
  createConvexEncounterStoreReader
} from '../lib/convexEncounterStore'
import { readReceiptHeaders } from '../lib/receiptLedgers'
// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  type ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterMaintainedEffectDescriptorDtoSchema,
  type ActiveRuleEffectDefinitionDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { encounterActionCurrentnessChecksum } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { planNativeEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { maintenanceDefinitionFixture } from '../../tests/fixtures/maintenanceDefinition'
import {
  commitNativeLiveEncounterAction,
  planNativeLiveEncounterAction
} from '../../../session-worker/src/nativeEncounterRules'
import { api, internal } from '../_generated/api'
import { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'
import { prepareNativeActionEconomy } from './actionEconomy'
import {
  readRunActors,
  readRunState,
  writeRunActor
} from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from './encounterPorts'
import { loadMovementTargets } from './movementTargets'
import { readCharacterRow } from '../characters/stateDocuments'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { sourceImportBatches } from '../content/importBatches'
import { withSceneVisionTracking } from '../lib/mutations'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment,
  executeInRoom,
  expectRedactedRoomRefusal,
  replayInRoom,
  RoomCommandRefusal
} from '../../tests/fixtures/liveSessionWorker'

const creatureId = '00000000-0000-4000-8000-0000000008e0'
const featureId = '00000000-0000-4000-8000-0000000008e1'
const effectId = '00000000-0000-4000-8000-0000000008e2'
const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')
const workerSecret = 'private-maintenance-preflight-test-secret-at-least-32-bytes'
const planningOptions = {
  runtime: createPlatformRulesRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        throw new Error('Definitions are resolved by sealed action graphs.')
      }
    }
  }),
  random: (maximum: number) => maximum - 1
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function maintainedCreature(
  kind: 'HEAL' | 'SAVE_DAMAGE',
  maintenanceDefinitionId: string,
  healTarget: 'SELF' | 'CHARACTER' = 'SELF'
) {
  const bite = wolf.features?.find((feature) => feature.label === 'Bite')
  const dexterity = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')
  const slashing = srdSystemRecord.damageTypes?.find((damageType) => damageType.code === 'SLASHING')
  if (!bite || !dexterity || !slashing)
    throw new Error('Maintained action fixture requires Wolf Bite, Dexterity, and Slashing.')
  return {
    ...wolf,
    id: creatureId,
    label: `Maintained ${kind} creature`,
    features: wolf.features?.map((feature) =>
      feature.id !== bite.id
        ? feature
        : {
            ...feature,
            id: featureId,
            effects: feature.effects?.slice(0, 1).map((effect) => ({
              ...effect,
              id: effectId,
              invocation:
                kind === 'HEAL'
                  ? {
                      ...effect.invocation,
                      triggerCode: 'ACTIVATED' as const,
                      range:
                        healTarget === 'SELF'
                          ? { id: effect.invocation.range.id, rangeKind: 'SELF' as const }
                          : { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
                      targeting:
                        healTarget === 'SELF'
                          ? { selectionKind: 'SELF' as const }
                          : {
                              selectionKind: 'SINGLE_TARGET' as const,
                              dispositionKind: 'ANY' as const
                            }
                    }
                  : {
                      ...effect.invocation,
                      triggerCode: 'SAVING_THROW' as const,
                      savingThrow: {
                        id: '00000000-0000-4000-8000-0000000008e3',
                        dcMethod: 'FIXED_DC' as const,
                        abilityDefinitionId: dexterity.id,
                        baseDc: 30
                      },
                      range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
                      targeting: {
                        selectionKind: 'SINGLE_TARGET' as const,
                        dispositionKind: 'ANY' as const
                      }
                    },
              paths: effect.paths?.slice(0, 1).map((path) =>
                !('resultBlock' in path)
                  ? path
                  : {
                      ...path,
                      pathCode: kind === 'HEAL' ? ('ON_USE' as const) : ('ON_SAVE_FAIL' as const),
                      resultBlock: {
                        ...path.resultBlock,
                        id: '00000000-0000-4000-8000-0000000008e4',
                        maintenanceDefinitionId,
                        duration: {
                          id: '00000000-0000-4000-8000-0000000008e5',
                          durationKind: 'ROUND' as const,
                          amount: 3
                        },
                        lifecycle: { recurringKind: 'START_OF_TURN' as const },
                        outcomes:
                          kind === 'HEAL'
                            ? [
                                {
                                  id: '00000000-0000-4000-8000-0000000008e6',
                                  effectKind: 'HEAL' as const,
                                  valueKind: 'FIXED' as const,
                                  scalingKind: 'NONE' as const,
                                  amount: 1
                                }
                              ]
                            : [
                                {
                                  id: '00000000-0000-4000-8000-0000000008e7',
                                  effectKind: 'DAMAGE' as const,
                                  damageTypeId: slashing.id,
                                  valueKind: 'FIXED' as const,
                                  scalingKind: 'NONE' as const,
                                  amount: 1
                                }
                              ]
                      }
                    }
              )
            }))
          }
    )
  }
}

async function settleStart(
  base: Awaited<ReturnType<typeof setupCharacterRun>>,
  result: EncounterCommandResultDto
) {
  let current = result
  for (let resolutions = 0; current.occurrence?.status === 'PENDING'; resolutions++) {
    expect(resolutions).toBeLessThan(20)
    const pending = current.occurrence.pending
    const resolution =
      pending?.kind === 'INITIATIVE_EVIDENCE'
        ? {
            kind: 'ENTER_INTEGER' as const,
            requestId: pending.request.requestId,
            value: pending.request.max
          }
        : pending?.kind === 'INITIATIVE_ORDER'
          ? {
              kind: 'INITIATIVE_ENTITY' as const,
              requestId: pending.requestId,
              entityId: pending.optionIds[0]!
            }
          : (() => {
              throw new Error('Maintained action fixture requested an unsupported continuation.')
            })()
    current = encounterCommandResultDtoSchema.parse(
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: current.projection.id,
          commandId: crypto.randomUUID(),
          expectedVersion: current.projection.version,
          correlationId: null,
          occurrenceId: current.occurrence.occurrenceId,
          expectedOccurrenceVersion: current.occurrence.occurrenceVersion,
          resolution
        }
      })
    )
  }
  return current
}

async function setup(
  kind: 'HEAL' | 'SAVE_DAMAGE',
  rolls: FixtureRolls,
  healTarget: 'SELF' | 'CHARACTER' = 'SELF'
) {
  const base = await setupCharacterRun()
  for (const user of [base.owner, base.player])
    await setAutoRollDice(base.t, user.userId, rolls === 'AUTO_ROLL')
  const policies = createEncounterLifecyclePolicyFixture(base.owner.userId)
  const maintenanceDefinitionId = policies.scenarios[1]!.definitionId
  const maintenanceDefinition = maintenanceDefinitionFixture({ id: maintenanceDefinitionId })
  await base.t.mutation(internal.content.import.bootstrap, policies.bootstrap)
  await base.t.mutation(internal.content.import.importDefinitions, {
    ...policies.imported,
    definitions: policies.imported.definitions.map((definition) =>
      definition.id === maintenanceDefinitionId ? maintenanceDefinition : definition
    )
  })
  for (const definitions of sourceImportBatches(SRD_RULE_STATE_DEFINITIONS))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  const creature = maintainedCreature(kind, maintenanceDefinitionId, healTarget)
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  const campaign = await base.owner.caller.mutation(api.campaigns.update.update, {
    campaignId: base.campaign.id,
    expectedVersion: base.campaign.version,
    additionalRulesCatalogueIds: [policies.bootstrap.catalogue.id]
  })
  const settings = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: campaign.id
  })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: campaign.gameSystemId,
    name: 'Maintained action fixture',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: 2 }, () => ({
      kind: 'CREATURE' as const,
      sourceId: creatureId
    }))
  })
  let run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  run = encounterGmProjectionDtoSchema.parse(
    (
      await settleStart(
        base,
        encounterCommandResultDtoSchema.parse(
          await executeInRoom(base.owner.caller, {
            command: {
              type: 'START',
              encounterId: run.id,
              commandId: crypto.randomUUID(),
              expectedVersion: run.version
            }
          })
        )
      )
    ).projection
  )
  const creatures = run.actors.filter(
    (actor) => actor.kind === 'CREATURE' && actor.sourceId === creatureId
  )
  const actor = creatures[0]
  const secondActor = creatures[1]
  const characterTarget = run.actors.find((actor) => actor.kind === 'CHARACTER')
  if (!actor || !secondActor || !characterTarget)
    throw new Error('Maintained action fixture actors are unavailable.')
  if (run.currentActorId !== actor.id)
    run = encounterGmProjectionDtoSchema.parse(
      (
        await executeInRoom(base.owner.caller, {
          command: {
            type: 'SET_CURRENT_ACTOR',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version,
            actorId: actor.id
          }
        })
      ).projection
    )
  return { ...base, campaign, run, actor, secondActor, characterTarget, maintenanceDefinitionId }
}

function action(
  base: Awaited<ReturnType<typeof setup>>,
  expectedVersion: number,
  targetActorId: string
): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion,
    actorId: base.actor.id,
    targetActorId,
    actionId: `${base.actor.id}:FEATURE:${featureId}:EFFECT:${effectId}`,
    optionalCombatIntent: null,
    sceneContext: null
  }
}

function diceResponse(input: unknown, face = 1): EncounterExecuteInput {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected maintained action d20 evidence.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: result.projection.id,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      correlationId: null,
      occurrenceId: result.occurrence!.occurrenceId,
      expectedOccurrenceVersion: result.occurrence!.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
        rollMode: pending.request.rollMode
      }
    }
  }
}

async function records(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .take(8),
    actorEffects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', base.run.id))
      .take(16),
    characterEffects: await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', base.character.id))
      .take(16),
    maintainedStates: await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (q) => q.eq('encounterId', base.run.id))
      .take(16),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .take(32)
      .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .take(32)
      .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers)),
    pendingOccurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) =>
        q.eq('encounterId', base.run.id).eq('state', 'PENDING')
      )
      .take(4),
    completedOccurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) =>
        q.eq('encounterId', base.run.id).eq('state', 'COMPLETED')
      )
      .take(32),
    character: await readCharacterRow(ctx, base.character.id),
    characterReceipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
      .take(32)
      .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers)),
    campaignCharacterState: await ctx.db
      .query('campaignCharacterStates')
      .withIndex('by_campaignId_characterId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('characterId', base.character.id)
      )
      .unique()
  }))
}

function executionFor(snapshot: Awaited<ReturnType<typeof records>>, commandId: string) {
  const receipt = snapshot.receipts.find((candidate) => candidate.commandId === commandId)
  if (!receipt) throw new Error('Maintained action receipt is missing.')
  const execution = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (execution.status !== 'COMPLETE') throw new Error('Maintained action did not complete.')
  return execution
}

async function resetActionAllowance(base: Awaited<ReturnType<typeof setup>>) {
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.actor.id)
      )
      .unique()
    if (!row) throw new Error('Maintained action source is unavailable.')
    const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
    const reset = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withEncounterRuleUsageUsed(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 0)
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, reset)
  })
}

it('creates and replaces Automatic maintenance atomically while preserving retained conditions', async () => {
  const base = await setup('HEAL', 'AUTO_ROLL')
  const first = action(base, base.run.version, base.actor.id)
  const before = await records(base)
  expect(await records(base)).toEqual(before)

  const created = await executeInRoom(base.owner.caller, {
    command: first
  })
  expect(created.occurrence?.status).toBe('COMPLETE')
  const afterCreated = await records(base)
  expect(afterCreated.maintainedStates).toHaveLength(1)
  expect(afterCreated.actorEffects).toHaveLength(1)
  expect(afterCreated.actorEffects[0]?.maintainedEffectStateId).toBe(
    afterCreated.maintainedStates[0]?.id
  )
  const firstExecution = executionFor(afterCreated, first.commandId)
  expect(firstExecution).toMatchObject({
    status: 'COMPLETE',
    applicationOutputs: {
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      activeEffectTransitions: [
        expect.objectContaining({
          kind: 'CREATE',
          maintainedEffectStateId: afterCreated.maintainedStates[0]!.id
        })
      ],
      maintenanceTransition: {
        kind: 'REPLACE_SAME_DEFINITION',
        priorState: null,
        createdState: {
          id: afterCreated.maintainedStates[0]!.id,
          maintenanceDefinitionId: base.maintenanceDefinitionId,
          sourceActionId: first.actionId,
          sourceActorId: base.actor.id
        }
      }
    }
  })
  await expect(replayInRoom(base.owner.caller, { command: first })).resolves.toEqual(created)
  expect(await records(base)).toEqual(afterCreated)

  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  const poisoned = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'POISONED')
  if (!blinded || !frightened || !poisoned)
    throw new Error('Maintained condition fixture requires three System conditions.')
  const seeded = await base.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const owner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: base.run.id,
      targetActorId: base.actor.id
    }
    const current = await store.list(owner)
    const dependent = current[0]
    const maintained = await store.findMaintainedState({
      encounterId: base.run.id,
      ownerActorId: base.actor.id,
      maintenanceDefinitionId: base.maintenanceDefinitionId
    })
    if (!dependent || !maintained)
      throw new Error('Created maintained action records are unavailable.')
    const ownedConditions = {
      ...dependent.definition,
      schemaVersion: 2 as const,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: frightened.id, baselinePresent: true },
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: poisoned.id, baselinePresent: false },
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: blinded.id, baselinePresent: false }
      ]
    } satisfies ActiveRuleEffectDefinitionDto
    const conditionDependent = await store.create({
      id: crypto.randomUUID(),
      owner,
      definition: ownedConditions,
      lifecycle: dependent.lifecycle,
      maintainedEffectStateId: maintained.id
    })
    const independent = await store.create({
      id: crypto.randomUUID(),
      owner,
      definition: {
        ...ownedConditions,
        stateContributions: [
          {
            kind: 'CONDITION_OWNERSHIP',
            conditionId: poisoned.id,
            baselinePresent: false
          }
        ]
      },
      lifecycle: dependent.lifecycle
    })
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.actor.id)
      )
      .unique()
    if (!row) throw new Error('Maintained condition owner is unavailable.')
    const actor = encounterRunActorStateSchema.parse({
      ...JSON.parse(row.stateJson),
      conditions: [frightened.id, poisoned.id, blinded.id]
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, actor)
    return {
      priorStateId: maintained.id,
      priorEffectIds: [dependent.id, conditionDependent.id],
      independentEffectId: independent.id
    }
  })
  await resetActionAllowance(base)
  let projection = encounterGmProjectionDtoSchema.parse(created.projection)
  const replacement = action(base, projection.version, base.actor.id)
  const beforeReplacement = await records(base)
  expect(await records(base)).toEqual(beforeReplacement)

  const replaced = await executeInRoom(base.owner.caller, {
    command: replacement
  })
  projection = encounterGmProjectionDtoSchema.parse(replaced.projection)
  const afterReplacement = await records(base)
  expect(afterReplacement.maintainedStates).toHaveLength(1)
  expect(afterReplacement.maintainedStates[0]?.id).not.toBe(seeded.priorStateId)
  expect(afterReplacement.actorEffects.map((effect) => effect.id)).toEqual(
    expect.arrayContaining([seeded.independentEffectId])
  )
  expect(afterReplacement.actorEffects.map((effect) => effect.id)).toEqual(
    expect.not.arrayContaining(seeded.priorEffectIds)
  )
  const replacementDependent = afterReplacement.actorEffects.find(
    (effect) => effect.maintainedEffectStateId === afterReplacement.maintainedStates[0]?.id
  )
  expect(replacementDependent).toBeDefined()
  const source = projection.actors.find((actor) => actor.id === base.actor.id)
  expect(source?.conditions).toEqual(expect.arrayContaining([frightened.id, poisoned.id]))
  expect(source?.conditions).not.toEqual(expect.arrayContaining([blinded.id]))
  const replacementExecution = executionFor(afterReplacement, replacement.commandId)
  expect(replacementExecution.applicationOutputs).toMatchObject({
    maintenanceTransition: {
      priorState: { id: seeded.priorStateId },
      removedDependentEffects: expect.arrayContaining(
        seeded.priorEffectIds.map((activeEffectId) => expect.objectContaining({ activeEffectId }))
      ),
      createdState: { id: afterReplacement.maintainedStates[0]!.id },
      createdDependentEffectIds: [replacementDependent!.id]
    }
  })

  const emptyPrior = await base.t.run(async (ctx) => {
    const state = await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition', (q) =>
        q
          .eq('encounterId', base.run.id)
          .eq('ownerActorId', base.actor.id)
          .eq('maintenanceDefinitionId', base.maintenanceDefinitionId)
      )
      .unique()
    if (!state || !replacementDependent)
      throw new Error('Replacement maintenance fixture is unavailable.')
    const descriptor = encounterMaintainedEffectDescriptorDtoSchema.parse({
      ...JSON.parse(state.descriptorJson),
      schemaVersion: 2,
      emptyDependentPolicy: 'RETAIN_UNTIL_TERMINAL'
    })
    await ctx.db.patch(state._id, {
      descriptorJson: JSON.stringify(descriptor),
      descriptorChecksum: checksumCanonicalJson(descriptor)
    })
    await createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).deleteCas({
      id: replacementDependent.id,
      owner: {
        kind: 'ENCOUNTER_ACTOR',
        encounterId: base.run.id,
        targetActorId: base.actor.id
      },
      expectedVersion: replacementDependent.version
    })
    return state.id
  })
  await resetActionAllowance(base)
  const retainedRoot = action(base, projection.version, base.actor.id)
  const retainedReplacement = await executeInRoom(base.owner.caller, {
    command: retainedRoot
  })
  const retainedComplete = await records(base)
  expect(retainedComplete.maintainedStates).toHaveLength(1)
  expect(retainedComplete.maintainedStates[0]?.id).not.toBe(emptyPrior)
  expect(retainedComplete.actorEffects.map((effect) => effect.id)).toEqual(
    expect.arrayContaining([seeded.independentEffectId])
  )
  expect(executionFor(retainedComplete, retainedRoot.commandId).applicationOutputs).toMatchObject({
    maintenanceTransition: {
      priorState: { id: emptyPrior },
      removedDependentEffects: [],
      createdState: { id: retainedComplete.maintainedStates[0]!.id }
    }
  })
  expect(retainedReplacement.occurrence?.status).toBe('COMPLETE')
}, 60000)

it('settles Assisted maintenance only at terminal response and cleans a removed Character owner once', async () => {
  const base = await setup('SAVE_DAMAGE', 'PROMPT')
  const dmCondition = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!dmCondition) throw new Error('Maintained Character fixture requires Frightened.')
  await base.owner.caller.mutation(api.campaigns.gmWrites.saveCondition, {
    campaignId: base.campaign.id,
    characterId: base.character.id,
    conditionTypeId: dmCondition.id,
    visibility: 'SECRET',
    expectedVersion: 0,
    notes: 'independent GM condition'
  })
  const root = action(base, base.run.version, base.characterTarget.id)
  const before = await records(base)
  const issued = await executeInRoom(base.owner.caller, {
    command: root
  })
  expect(issued.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const staged = await records(base)
  expect(staged).toMatchObject({
    run: before.run,
    actors: before.actors,
    actorEffects: before.actorEffects,
    characterEffects: before.characterEffects,
    maintainedStates: before.maintainedStates,
    receipts: before.receipts,
    commands: before.commands,
    character: before.character,
    characterReceipts: before.characterReceipts,
    campaignCharacterState: before.campaignCharacterState
  })
  expect(staged.pendingOccurrences).toHaveLength(before.pendingOccurrences.length + 1)
  const response = diceResponse(issued)

  expect(await records(base)).toEqual(staged)

  const settled = await executeInRoom(base.owner.caller, response)
  expect(settled.occurrence?.status).toBe('COMPLETE')
  const firstComplete = await records(base)
  expect(firstComplete.maintainedStates).toHaveLength(1)
  expect(firstComplete.characterEffects).toHaveLength(1)
  expect(firstComplete.characterEffects[0]?.maintainedEffectStateId).toBe(
    firstComplete.maintainedStates[0]?.id
  )
  const execution = executionFor(firstComplete, root.commandId)
  expect(execution.applicationOutputs).toMatchObject({
    kind: 'CHARACTER_MECHANICS_BATCH',
    activeEffectTransitions: [
      expect.objectContaining({
        maintainedEffectStateId: firstComplete.maintainedStates[0]!.id
      })
    ],
    maintenanceTransition: {
      priorState: null,
      createdState: {
        id: firstComplete.maintainedStates[0]!.id,
        sourceActionId: root.actionId
      },
      createdDependentEffectIds: [firstComplete.characterEffects[0]!.id]
    }
  })
  // The room journal replays each command's own receipt, shown over the current Run.
  await expect(replayInRoom(base.owner.caller, { command: root })).resolves.toEqual({
    ...issued,
    projection: settled.projection
  })
  await expect(replayInRoom(base.owner.caller, response)).resolves.toEqual(settled)
  expect(await records(base)).toEqual(firstComplete)

  await resetActionAllowance(base)
  const sameTargetRoot = action(base, settled.projection.version, base.characterTarget.id)
  const sameTargetIssued = await executeInRoom(base.owner.caller, {
    command: sameTargetRoot
  })
  expect(sameTargetIssued.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const sameTargetStaged = await records(base)
  const sameTargetResponse = diceResponse(sameTargetIssued)
  const maintainedVersion = await base.t.run(async (ctx) => {
    const state = await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition', (q) =>
        q
          .eq('encounterId', base.run.id)
          .eq('ownerActorId', base.actor.id)
          .eq('maintenanceDefinitionId', base.maintenanceDefinitionId)
      )
      .unique()
    if (!state) throw new Error('Maintained state fixture is unavailable.')
    await ctx.db.patch(state._id, { version: state.version + 1 })
    return state.version
  })
  await expectRedactedRoomRefusal(
    executeInRoom(base.owner.caller, sameTargetResponse),
    'pending action source or target changed'
  )
  await base.t.run(async (ctx) => {
    const state = await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition', (q) =>
        q
          .eq('encounterId', base.run.id)
          .eq('ownerActorId', base.actor.id)
          .eq('maintenanceDefinitionId', base.maintenanceDefinitionId)
      )
      .unique()
    if (!state) throw new Error('Maintained state fixture is unavailable.')
    await ctx.db.patch(state._id, { version: maintainedVersion })
  })
  expect(await records(base)).toEqual(sameTargetStaged)
  await base.t.run(async (ctx) => {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
    if (!character) throw new Error('Maintained Character fixture is unavailable.')
    await ctx.db.patch(character._id, { status: 'DRAFT' })
  })
  await expect(executeInRoom(base.owner.caller, sameTargetResponse)).rejects.toThrow(
    RoomCommandRefusal
  )
  await base.t.run(async (ctx) => {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
    if (!character) throw new Error('Maintained Character fixture is unavailable.')
    await ctx.db.patch(character._id, { status: 'ACTIVE' })
  })
  expect(await records(base)).toEqual(sameTargetStaged)

  const beforeSameTargetVersion = sameTargetStaged.character!.play.streamVersion
  const beforeDmState = sameTargetStaged.campaignCharacterState
  const sameTargetReplaced = await executeInRoom(base.owner.caller, sameTargetResponse)
  const sameTargetComplete = await records(base)
  expect(sameTargetComplete.characterEffects).toHaveLength(1)
  expect(sameTargetComplete.characterEffects[0]?.id).not.toBe(firstComplete.characterEffects[0]?.id)
  expect(sameTargetComplete.character?.play.streamVersion).toBe(beforeSameTargetVersion + 1)
  expect(sameTargetComplete.campaignCharacterState).toEqual(beforeDmState)
  expect(sameTargetComplete.maintainedStates[0]?.id).not.toBe(firstComplete.maintainedStates[0]?.id)
  expect(
    executionFor(sameTargetComplete, sameTargetRoot.commandId).applicationOutputs
  ).toMatchObject({
    maintenanceTransition: {
      priorState: { id: firstComplete.maintainedStates[0]!.id },
      removedDependentEffects: [
        expect.objectContaining({ activeEffectId: firstComplete.characterEffects[0]!.id })
      ],
      characterOwnerTransitions: [
        {
          characterId: base.character.id,
          beforeStreamVersion: beforeSameTargetVersion,
          afterStreamVersion: beforeSameTargetVersion + 1
        }
      ],
      createdDependentEffectIds: [sameTargetComplete.characterEffects[0]!.id]
    }
  })
  await expect(replayInRoom(base.owner.caller, { command: sameTargetRoot })).resolves.toEqual({
    ...sameTargetIssued,
    projection: sameTargetReplaced.projection
  })
  await expect(replayInRoom(base.owner.caller, sameTargetResponse)).resolves.toEqual(
    sameTargetReplaced
  )
  expect(await records(base)).toEqual(sameTargetComplete)

  const removed = await executeInRoom(base.owner.caller, {
    command: {
      type: 'REMOVE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: sameTargetReplaced.projection.version,
      actorId: base.characterTarget.id
    }
  })
  const afterRemoval = await records(base)
  expect(afterRemoval.actors.some((actor) => actor.id === base.characterTarget.id)).toBe(false)
  expect(afterRemoval.characterEffects).toHaveLength(1)
  expect(afterRemoval.maintainedStates).toHaveLength(1)
  await resetActionAllowance(base)
  let projection = encounterGmProjectionDtoSchema.parse(removed.projection)
  const detachedRoot = action(base, projection.version, base.secondActor.id)
  const detachedIssued = await executeInRoom(base.owner.caller, {
    command: detachedRoot
  })
  expect(detachedIssued.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const detachedStaged = await records(base)
  const detachedResponse = diceResponse(detachedIssued)
  await base.t.run(async (ctx) => {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
    if (!character) throw new Error('Detached maintained Character fixture is unavailable.')
    await ctx.db.patch(character._id, { status: 'DRAFT' })
  })
  await expect(executeInRoom(base.owner.caller, detachedResponse)).rejects.toThrow(
    RoomCommandRefusal
  )
  await base.t.run(async (ctx) => {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
    if (!character) throw new Error('Detached maintained Character fixture is unavailable.')
    await ctx.db.patch(character._id, { status: 'ACTIVE' })
  })
  expect(await records(base)).toEqual(detachedStaged)
  const beforeDetachedVersion = detachedStaged.character!.play.streamVersion
  const detachedReplaced = await executeInRoom(base.owner.caller, detachedResponse)
  projection = encounterGmProjectionDtoSchema.parse(detachedReplaced.projection)
  const detachedComplete = await records(base)
  expect(detachedComplete.characterEffects).toEqual([])
  expect(detachedComplete.character?.play.streamVersion).toBe(beforeDetachedVersion + 1)
  expect(detachedComplete.campaignCharacterState).toEqual(beforeDmState)
  expect(detachedComplete.maintainedStates).toHaveLength(1)
  expect(detachedComplete.maintainedStates[0]?.id).not.toBe(
    sameTargetComplete.maintainedStates[0]?.id
  )
  expect(detachedComplete.actorEffects).toHaveLength(1)
  expect(detachedComplete.actorEffects[0]?.targetActorId).toBe(base.secondActor.id)
  expect(detachedComplete.actorEffects[0]?.maintainedEffectStateId).toBe(
    detachedComplete.maintainedStates[0]?.id
  )
  const detachedExecution = executionFor(detachedComplete, detachedRoot.commandId)
  expect(detachedExecution.applicationOutputs).toMatchObject({
    maintenanceTransition: {
      priorState: { id: sameTargetComplete.maintainedStates[0]!.id },
      removedDependentEffects: [
        expect.objectContaining({
          kind: 'CHARACTER',
          characterId: base.character.id,
          activeEffectId: sameTargetComplete.characterEffects[0]!.id
        })
      ],
      characterOwnerTransitions: [
        {
          characterId: base.character.id,
          beforeStreamVersion: beforeDetachedVersion,
          afterStreamVersion: beforeDetachedVersion + 1
        }
      ],
      createdState: { id: detachedComplete.maintainedStates[0]!.id },
      createdDependentEffectIds: [detachedComplete.actorEffects[0]!.id]
    }
  })
  await expect(replayInRoom(base.owner.caller, { command: detachedRoot })).resolves.toEqual({
    ...detachedIssued,
    projection: detachedReplaced.projection
  })
  await expect(replayInRoom(base.owner.caller, detachedResponse)).resolves.toEqual(detachedReplaced)
  expect(await records(base)).toEqual(detachedComplete)
  expect(projection.version).toBe(detachedComplete.run?.version)
}, 60000)

it('rejects a missing current maintenance definition while an Assisted action is paused', async () => {
  const base = await setup('SAVE_DAMAGE', 'PROMPT')
  const root = action(base, base.run.version, base.characterTarget.id)
  const issued = await executeInRoom(base.owner.caller, {
    command: root
  })

  expect(issued.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const staged = await records(base)
  await base.t.run(async (ctx) => {
    const definition = await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', base.maintenanceDefinitionId))
      .unique()
    if (!definition) throw new Error('Maintenance definition fixture is unavailable.')
    await ctx.db.delete(definition._id)
  })
  await expectRedactedRoomRefusal(
    executeInRoom(base.owner.caller, diceResponse(issued)),
    'maintenance definition is no longer current'
  )
  expect(await records(base)).toEqual(staged)
}, 60000)

async function setupMaintenanceCapture(
  dependentCount: number,
  healTarget: 'SELF' | 'CHARACTER' = 'SELF'
) {
  const base = await setup('HEAL', 'AUTO_ROLL', healTarget)
  const created = await executeInRoom(base.owner.caller, {
    command: action(
      base,
      base.run.version,
      healTarget === 'SELF' ? base.actor.id : base.characterTarget.id
    )
  })
  expect(created.occurrence?.status).toBe('COMPLETE')
  const state = await base.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const state = await store.findMaintainedState({
      encounterId: base.run.id,
      ownerActorId: base.actor.id,
      maintenanceDefinitionId: base.maintenanceDefinitionId
    })
    if (!state) throw new Error('Missing maintained state fixture.')
    const dependents = await store.listDependentEffects({
      encounterId: base.run.id,
      stateId: state.id
    })
    const source = dependents[0]
    if (!source) throw new Error('Missing maintained dependent fixture.')
    for (let index = dependents.length; index < dependentCount; index++)
      await store.create({
        id: crypto.randomUUID(),
        owner: source.owner,
        definition: source.definition,
        lifecycle: source.lifecycle,
        maintainedEffectStateId: state.id
      })
    return state
  })
  await resetActionAllowance(base)
  const authorityEpoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch: authorityEpoch,
      createdAt: base.campaign.createdAt
    })
  )
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  const scope = {
    campaignId: base.campaign.id,
    authorityEpoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER' as const,
    encounterId: base.run.id,
    expectedVersion: created.projection.version
  }
  return { base, state, scope }
}

it('commits a maintained Character action from the Worker plan with one atomic replacement', async () => {
  const { base, state, scope } = await setupMaintenanceCapture(5, 'CHARACTER')
  const command = action(base, scope.expectedVersion, base.characterTarget.id)
  const environment = workerEnvironment(workerSecret)
  stubLiveSessionFetch((pathname, init) => base.owner.caller.fetch(pathname, init))
  const before = await records(base)
  const plan = await planNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    scope,
    command,
    planningOptions
  )
  if (plan.kind !== 'PLANNED' || !plan.settlement.maintainedState)
    throw new Error('Expected completed maintained Character action plan.')
  expect(await records(base)).toEqual(before)
  expect(plan.maintenance?.removed).toHaveLength(5)
  expect(plan.settlement.createdEffects).toHaveLength(1)
  const committed = await commitNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    scope,
    plan
  )
  expect(
    await commitNativeLiveEncounterAction(environment, 'fixture-access-token', scope, plan)
  ).toEqual(committed)
  const after = await records(base)
  expect(after.run?.version).toBe(before.run!.version + 1)
  expect(committed.projection.version).toBe(after.run?.version)
  expect(
    await base.t.run((ctx) =>
      readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(after.run!))
    )
  ).toEqual(committed.projection)
  expect(after.actors.map((actor) => checksumCanonicalJson(JSON.parse(actor.stateJson)))).toEqual(
    plan.settlement.actors.map((actor) => checksumCanonicalJson(actor))
  )
  expect(after.character?.play.streamVersion).toBe(before.character!.play.streamVersion + 1)
  expect(after.maintainedStates.map((entry) => entry.id)).not.toContain(state.id)
  expect(after.maintainedStates.map((entry) => entry.id)).toContain(
    plan.settlement.maintainedState.id
  )
  expect(after.characterEffects.map((effect) => effect.id)).toEqual(
    plan.settlement.createdEffects.map((effect) => effect.id)
  )
  const rootReceipt = after.receipts.find((entry) => entry.commandId === command.commandId)
  expect(
    rootReceipt && storedRuleExecutionResultDtoSchema.parse(JSON.parse(rootReceipt.resultJson))
  ).toEqual(plan.storedExecution)
  expect(after.completedOccurrences.map((entry) => entry.id)).toContain(plan.occurrenceId)
}, 60_000)

it('captures five real maintained dependents and matches the Convex action preflight', async () => {
  const { base, state, scope } = await setupMaintenanceCapture(5)
  await base.t.run(async (rawCtx) => {
    const ctx = withSceneVisionTracking(rawCtx)
    const character = await readCharacterRow(ctx, base.character.id)
    if (!character) throw new Error('Missing unrelated Character fixture.')
    await ctx.db.patch(character.play._id, { streamVersion: character.play.streamVersion + 1 })
  })
  const command = action(base, scope.expectedVersion, base.actor.id)
  const slotRequest = {
    actorId: base.actor.id,
    definitionId: base.maintenanceDefinitionId
  }
  const slot = await base.owner.caller.query(capture, {
    ...scope,
    request: { kind: 'MAINTENANCE_SLOT', ...slotRequest }
  })
  expect(slot).toMatchObject({ kind: 'MAINTENANCE_SLOT', state: { id: state.id } })
  const first = await base.owner.caller.query(capture, {
    ...scope,
    request: {
      ...slotRequest,
      kind: 'MAINTENANCE_DEPENDENTS',
      stateId: state.id,
      ownerKind: 'ENCOUNTER_ACTOR',
      cursor: null
    }
  })
  if (first.kind !== 'MAINTENANCE_DEPENDENTS') throw new Error('Missing first dependent page.')
  expect(first.effects).toHaveLength(4)
  expect(first.continueCursor).not.toBeNull()
  const second = await base.owner.caller.query(capture, {
    ...scope,
    request: {
      ...slotRequest,
      kind: 'MAINTENANCE_DEPENDENTS',
      stateId: state.id,
      ownerKind: 'ENCOUNTER_ACTOR',
      cursor: first.continueCursor
    }
  })
  if (second.kind !== 'MAINTENANCE_DEPENDENTS') throw new Error('Missing second dependent page.')
  expect(second.effects).toHaveLength(1)
  expect(second.continueCursor).toBeNull()
  const requests: string[] = []
  stubLiveSessionFetch((pathname, init) => {
    requests.push(pathname)
    return base.owner.caller.fetch(pathname, init)
  })
  const beforePlanning = await records(base)
  const actual = await planNativeLiveEncounterAction(
    workerEnvironment(workerSecret),
    'fixture-access-token',
    scope,
    command,
    planningOptions
  )
  if (actual.kind !== 'PLANNED') throw new Error('Expected complete maintained action plan.')
  expect(await records(base)).toEqual(beforePlanning)
  expect(requests.every((request) => request === '/live-sessions/encounter-rules')).toBe(true)
  expect(
    actual.dependencies.filter(
      (dependency) =>
        dependency.request.kind === 'MAINTENANCE_DEPENDENTS' &&
        dependency.request.ownerKind === 'ENCOUNTER_ACTOR'
    )
  ).toHaveLength(2)
  await base.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing maintained Run.')
    const current = readRunState(row)
    const actors = await readRunActors({ db: createConvexEncounterStoreReader(ctx) }, current)
    const source = actors.find((actor) => actor.id === base.actor.id)
    if (!source) throw new Error('Missing maintained actor.')
    const prepared = await prepareNativeEncounterActionMechanics(ctx, {
      state: current,
      actors,
      actor: source,
      target: source,
      actionId: command.actionId,
      wieldConflictAcceptance: { kind: 'UNPROMPTED' },
      overridable: true,
      campaignOwnerUserId: base.owner.userId
    })
    const activation =
      prepared.source.kind === 'CHARACTER_ACTION'
        ? prepared.source.candidate.mechanicFacts.invocation.activation
        : prepared.source.capability.mechanicFacts.invocation.activation
    if (!activation || activation.amount === null)
      throw new Error('Missing normalized maintained action activation.')
    const actionEconomy = await prepareNativeActionEconomy(ctx, {
      actor: source,
      state: current,
      userId: base.owner.userId,
      activation: { code: activation.code, amount: activation.amount },
      target: prepared.movementTargets.get(source.id)
    })
    expect(actual.prepared).toEqual(prepared)
    expect(actual.actionEconomy).toEqual(actionEconomy)
    expect(actual.maintenance?.removed).toHaveLength(5)
    expect(actual.sceneContext).toBeNull()
    expect(actual.currentnessChecksum).toBe(
      encounterActionCurrentnessChecksum({
        prepared,
        actionEconomy,
        maintenance: actual.maintenance,
        sceneContext: null
      })
    )
    const expectedEffects = actual.preparedEffects
    expect(actual.execution.applications).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'HEAL', targetActorId: source.id })])
    )
    expect(actual.actionEconomy).toMatchObject({
      definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
      beforeUsed: 0,
      afterUsed: 1
    })
    expect(actual.mechanics).toEqual(
      planNativeEncounterActionMechanics(
        {
          prepared,
          encounterId: current.id,
          expectedEncounterVersion: current.version,
          occurrenceId: actual.occurrenceId,
          sourceCommandId: command.commandId,
          commandId: command.commandId,
          occurredAt: actual.occurredAt,
          applications: [
            ...actual.execution.applications,
            ...expectedEffects.relationshipConditionApplications
          ],
          forceTargetVersionAdvance:
            prepared.target.kind === 'CHARACTER' &&
            (expectedEffects.stateEffect !== null || expectedEffects.recurringEffect !== null)
        },
        base.owner.userId
      )
    )
  })
}, 60000)

it('commits the post-mechanics maintenance settlement the Worker projects', async () => {
  const { base, state, scope } = await setupMaintenanceCapture(1, 'CHARACTER')
  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  const poisoned = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'POISONED')
  if (!blinded || !frightened || !poisoned)
    throw new Error('Projected maintenance fixture requires three System conditions.')
  const seeded = await base.t.run(async (rawCtx) => {
    const ctx = withSceneVisionTracking(rawCtx)
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const dependents = await store.listDependentEffects({
      encounterId: base.run.id,
      stateId: state.id
    })
    const characterDependent = dependents[0]
    if (!characterDependent || characterDependent.owner.kind !== 'CHARACTER')
      throw new Error('Projected maintenance Character dependent is unavailable.')
    const owner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: base.run.id,
      targetActorId: base.actor.id
    }
    const definition = {
      ...characterDependent.definition,
      schemaVersion: 2 as const,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: frightened.id, baselinePresent: true },
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: poisoned.id, baselinePresent: false },
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: blinded.id, baselinePresent: false }
      ]
    } satisfies ActiveRuleEffectDefinitionDto
    const actorDependent = await store.create({
      id: crypto.randomUUID(),
      owner,
      definition,
      lifecycle: characterDependent.lifecycle,
      maintainedEffectStateId: state.id
    })
    const independent = await store.create({
      id: crypto.randomUUID(),
      owner,
      definition: {
        ...definition,
        stateContributions: [
          { kind: 'CONDITION_OWNERSHIP', conditionId: poisoned.id, baselinePresent: false }
        ]
      },
      lifecycle: characterDependent.lifecycle
    })
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.actor.id)
      )
      .unique()
    if (!row) throw new Error('Projected maintenance actor is unavailable.')
    const actor = encounterRunActorStateSchema.parse({
      ...JSON.parse(row.stateJson),
      conditions: [frightened.id, poisoned.id, blinded.id]
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, actor)
    return { characterDependent, actorDependent, independent }
  })
  const command = action(base, scope.expectedVersion, base.characterTarget.id)
  stubLiveSessionFetch((pathname, init) => base.owner.caller.fetch(pathname, init))
  const beforePlanning = await records(base)
  const planned = await planNativeLiveEncounterAction(
    workerEnvironment(workerSecret),
    'fixture-access-token',
    scope,
    command,
    planningOptions
  )
  if (planned.kind !== 'PLANNED' || !planned.settlement.maintainedState)
    throw new Error('Expected complete maintained Character settlement plan.')
  expect(await records(base)).toEqual(beforePlanning)
  expect(planned.maintenance?.removed.map((effect) => effect.id)).toEqual(
    expect.arrayContaining([seeded.characterDependent.id, seeded.actorDependent.id])
  )
  expect(planned.settlement.createdEffects).toHaveLength(1)
  await commitNativeLiveEncounterAction(
    workerEnvironment(workerSecret),
    'fixture-access-token',
    scope,
    planned
  )
  const committed = await records(base)
  await base.owner.caller.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    expect(
      await store.list({
        kind: 'ENCOUNTER_ACTOR',
        encounterId: base.run.id,
        targetActorId: base.actor.id
      })
    ).toEqual(planned.settlement.activeEffectsByActorId.get(base.actor.id))
    expect(await store.list({ kind: 'CHARACTER', characterId: base.character.id })).toEqual(
      planned.settlement.activeEffectsByActorId.get(base.characterTarget.id)
    )
    const character = await readCharacterRow(ctx, base.character.id)
    expect(character).toEqual(
      planned.settlement.maintenanceOwners.find((entry) => entry.owner.kind === 'CHARACTER')
        ?.character
    )
    expect(character?.play.streamVersion).toBe(beforePlanning.character!.play.streamVersion + 1)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Projected maintenance Run is unavailable.')
    const actualTargets = await loadMovementTargets(ctx, {
      encounterId: base.run.id,
      expectedEncounterVersion: readRunState(row).version,
      targetActorIds: [base.actor.id, base.characterTarget.id],
      includeReactionSources: true
    })
    for (const [actorId, projected] of planned.settlement.projectedTargets) {
      const actual = actualTargets.get(actorId)
      expect({ ...actual, characterFacts: null }).toEqual({ ...projected, characterFacts: null })
      expect(actual?.characterFacts?.character).toEqual(projected.characterFacts?.character)
      expect(actual?.characterFacts?.sheetState).toEqual(projected.characterFacts?.sheetState)
      expect(actual?.characterFacts?.active?.checksum).toEqual(
        projected.characterFacts?.active?.checksum
      )
    }
  })
  expect(committed.actorEffects.map((effect) => effect.id)).toContain(seeded.independent.id)
  expect(committed.actorEffects.map((effect) => effect.id)).not.toContain(seeded.actorDependent.id)
  expect(committed.characterEffects.map((effect) => effect.id)).not.toContain(
    seeded.characterDependent.id
  )
  const updatedActor = committed.actors.find((actor) => actor.id === base.actor.id)
  if (!updatedActor) throw new Error('Projected maintenance actor write is unavailable.')
  const updatedState = encounterRunActorStateSchema.parse(JSON.parse(updatedActor.stateJson))
  if (updatedState.kind === 'CHARACTER') throw new Error('Expected a Creature maintenance actor.')
  const updatedConditions = updatedState.conditions
  expect(updatedConditions).toEqual(expect.arrayContaining([frightened.id, poisoned.id]))
  expect(updatedConditions).not.toContain(blinded.id)
}, 60000)

it('keeps maintenance owner reads behind a current slot and real dependent link', async () => {
  const { base, state, scope } = await setupMaintenanceCapture(1)
  const slot = {
    actorId: base.actor.id,
    definitionId: base.maintenanceDefinitionId,
    stateId: state.id
  }
  const dependent = (await records(base)).actorEffects.find(
    (effect) => effect.maintainedEffectStateId === state.id
  )
  if (!dependent) throw new Error('Missing linked dependent.')
  const ownerScope = {
    kind: 'ENCOUNTER_ACTOR' as const,
    encounterId: base.run.id,
    targetActorId: base.actor.id
  }
  const owner = await base.owner.caller.query(capture, {
    ...scope,
    request: { kind: 'MAINTENANCE_OWNER', ...slot, owner: ownerScope }
  })
  expect(owner).toMatchObject({ kind: 'MAINTENANCE_OWNER', owner: ownerScope })
  await expect(
    base.owner.caller.query(capture, {
      ...scope,
      request: {
        kind: 'MAINTENANCE_OWNER',
        ...slot,
        owner: { kind: 'CHARACTER', characterId: crypto.randomUUID() }
      }
    })
  ).rejects.toThrow()
  await expect(
    base.owner.caller.query(capture, {
      ...scope,
      request: {
        kind: 'MAINTENANCE_OWNER',
        ...slot,
        stateId: crypto.randomUUID(),
        owner: ownerScope
      }
    })
  ).rejects.toThrow()
  await expect(
    base.owner.caller.query(capture, {
      ...scope,
      request: {
        kind: 'MAINTENANCE_DEPENDENTS',
        actorId: base.secondActor.id,
        definitionId: base.maintenanceDefinitionId,
        stateId: state.id,
        ownerKind: 'ENCOUNTER_ACTOR',
        cursor: null
      }
    })
  ).rejects.toThrow()
  await base.t.run(async (rawCtx) => {
    const ctx = withSceneVisionTracking(rawCtx)
    const row = await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('targetActorId', base.actor.id).eq('id', dependent.id)
      )
      .unique()
    if (!row) throw new Error('Missing linked dependent row.')
    await ctx.db.patch(row._id, { maintainedEffectStateId: null })
  })
  await expect(
    base.owner.caller.query(capture, {
      ...scope,
      request: { kind: 'MAINTENANCE_OWNER', ...slot, owner: ownerScope }
    })
  ).rejects.toThrow()
}, 60000)

it('refuses a maintained action when a dependent link changes between capture pages', async () => {
  const { base, state, scope } = await setupMaintenanceCapture(5)
  const command = action(base, scope.expectedVersion, base.actor.id)
  let changed = false
  stubLiveSessionFetch(async (pathname, init) => {
    if (typeof init?.body !== 'string') throw new Error('Missing capture request.')
    const input = JSON.parse(init.body) as LiveSessionEncounterRulesInput
    const response = await base.owner.caller.fetch(pathname, init)
    if (
      input.request.kind === 'MAINTENANCE_DEPENDENTS' &&
      input.request.cursor === null &&
      !changed
    ) {
      changed = true
      await base.t.run(async (rawCtx) => {
        const ctx = withSceneVisionTracking(rawCtx)
        const row = (
          await ctx.db
            .query('encounterActiveRuleEffects')
            .withIndex('by_encounterId_targetActorId_id', (q) =>
              q.eq('encounterId', base.run.id).eq('targetActorId', base.actor.id)
            )
            .collect()
        ).find((effect) => effect.maintainedEffectStateId === state.id)
        if (!row) throw new Error('Missing linked dependent page row.')
        await ctx.db.patch(row._id, { maintainedEffectStateId: null })
      })
    }
    return response
  })
  await expect(
    planNativeLiveEncounterAction(
      workerEnvironment(workerSecret),
      'fixture-access-token',
      scope,
      command,
      planningOptions
    )
  ).rejects.toThrow(/revision|changed|maintenance/i)
  expect(changed).toBe(true)
}, 60000)

it('reads a detached Character owner only through its live maintained dependent', async () => {
  const base = await setup('SAVE_DAMAGE', 'PROMPT')
  const issued = await executeInRoom(base.owner.caller, {
    command: action(base, base.run.version, base.characterTarget.id)
  })
  expect(issued.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const settled = await executeInRoom(base.owner.caller, diceResponse(issued))
  expect(settled.occurrence?.status).toBe('COMPLETE')
  const beforeRemoval = await records(base)
  const state = beforeRemoval.maintainedStates[0]
  const dependent = beforeRemoval.characterEffects[0]
  if (!state || !dependent || dependent.maintainedEffectStateId !== state.id)
    throw new Error('Missing maintained Character link.')
  const removed = await executeInRoom(base.owner.caller, {
    command: {
      type: 'REMOVE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: settled.projection.version,
      actorId: base.characterTarget.id
    }
  })
  expect(removed.projection.actors.some((actor) => actor.id === base.characterTarget.id)).toBe(
    false
  )
  const authorityEpoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch: authorityEpoch,
      createdAt: base.campaign.createdAt
    })
  )
  const scope = {
    campaignId: base.campaign.id,
    authorityEpoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER' as const,
    encounterId: base.run.id,
    expectedVersion: removed.projection.version
  }
  const slot = {
    actorId: base.actor.id,
    definitionId: base.maintenanceDefinitionId,
    stateId: state.id
  }
  const owner = { kind: 'CHARACTER' as const, characterId: base.character.id }
  const captured = await base.owner.caller.query(capture, {
    ...scope,
    request: { kind: 'MAINTENANCE_OWNER', ...slot, owner }
  })
  if (captured.kind !== 'MAINTENANCE_OWNER') throw new Error('Missing detached owner capture.')
  expect(captured.character).toMatchObject({
    id: base.character.id,
    _id: expect.any(String),
    _creationTime: expect.any(Number)
  })
  const effects = await base.owner.caller.query(capture, {
    ...scope,
    request: { kind: 'MAINTENANCE_OWNER_EFFECTS', ...slot, owner, afterEffectId: null }
  })
  expect(effects).toMatchObject({
    kind: 'MAINTENANCE_OWNER_EFFECTS',
    effects: [expect.objectContaining({ id: dependent.id })]
  })
  await expect(
    base.owner.caller.query(capture, {
      ...scope,
      request: {
        kind: 'MAINTENANCE_OWNER',
        ...slot,
        owner: { kind: 'CHARACTER', characterId: crypto.randomUUID() }
      }
    })
  ).rejects.toThrow()
  await base.t.run(async (rawCtx) => {
    const ctx = withSceneVisionTracking(rawCtx)
    const row = await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_id', (q) =>
        q.eq('characterId', base.character.id).eq('id', dependent.id)
      )
      .unique()
    if (!row) throw new Error('Missing detached dependent row.')
    await ctx.db.patch(row._id, { maintainedEffectStateId: null })
  })
  await expect(
    base.owner.caller.query(capture, {
      ...scope,
      request: { kind: 'MAINTENANCE_OWNER', ...slot, owner }
    })
  ).rejects.toThrow()
}, 60000)
