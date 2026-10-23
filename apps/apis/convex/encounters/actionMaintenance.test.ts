import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
// @vitest-environment node
import { expect, it } from 'vitest'
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
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { maintenanceDefinitionFixture } from '../../tests/fixtures/maintenanceDefinition'
import { api, internal } from '../_generated/api'
import { readRunState, writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from './encounterPorts'
import { readCharacterRow } from '../characters/stateDocuments'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { sourceImportBatches } from '../content/importBatches'
import { withSceneVisionTracking } from '../lib/mutations'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  expectRedactedRoomRefusal,
  invalidateRoomInputs,
  roomErrorLogs,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

const creatureId = '00000000-0000-4000-8000-0000000008e0'
const featureId = '00000000-0000-4000-8000-0000000008e1'
const effectId = '00000000-0000-4000-8000-0000000008e2'

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
  await importSeededSubjects(base.t, {
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
  await attachFixtureRoom(base.t, campaign.id)
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
    target: { kind: 'ACTOR', actorId: targetActorId },
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

// The room holds the Run's commands and receipts until it ends (D85), so Convex is read after the
// room publishes what it holds.
async function records(base: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(base.campaign.id)
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
      .take(32),
    campaignCharacterState: await ctx.db
      .query('campaignCharacterStates')
      .withIndex('by_campaignId_characterId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('characterId', base.character.id)
      )
      .unique()
  }))
}

/** The maintained state's descriptor, as the room published it. */
function descriptorOf(state: Awaited<ReturnType<typeof records>>['maintainedStates'][number]) {
  return encounterMaintainedEffectDescriptorDtoSchema.parse(JSON.parse(state.descriptorJson))
}

/** Releases the room so the direct write below is what its next command hydrates. */
async function resetActionAllowance(base: Awaited<ReturnType<typeof setup>>) {
  await closeRoom(base.campaign.id)
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.actor.id)
      )
      .unique()
    if (!row) throw new Error('Maintained action source is unavailable.')
    const actor = await readTestActor(ctx, row)
    const reset = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withEncounterRuleUsageUsed(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 0)
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, reset)
  })
}

// Receipt-level maintenance outputs live in the room's history:
// see apps/session-worker/test/nativeRoomCharacterSources.test.ts.
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
  // The room's held receipt is not sent to members; the maintained state and its descriptor are.
  expect(before.maintainedStates).toEqual([])
  expect(afterCreated.maintainedStates[0]).toMatchObject({
    ownerActorId: base.actor.id,
    maintenanceDefinitionId: base.maintenanceDefinitionId
  })
  expect(descriptorOf(afterCreated.maintainedStates[0]!)).toMatchObject({
    provenance: { kind: 'ACTION', sourceActionId: first.actionId },
    sourceActorId: base.actor.id
  })
  await expect(executeInRoom(base.owner.caller, { command: first })).resolves.toEqual(created)
  expect(await records(base)).toEqual(afterCreated)

  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  const poisoned = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'POISONED')
  if (!blinded || !frightened || !poisoned)
    throw new Error('Maintained condition fixture requires three System conditions.')
  await closeRoom(base.campaign.id)
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
      ...(await readTestActor(ctx, row)),
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
  const sourceConditionIds = source?.conditions.map((condition) => condition.conditionTypeId)
  expect(sourceConditionIds).toEqual(expect.arrayContaining([frightened.id, poisoned.id]))
  expect(sourceConditionIds).not.toContain(blinded.id)
  expect(
    afterReplacement.actorEffects.filter(
      (effect) => effect.maintainedEffectStateId === afterReplacement.maintainedStates[0]?.id
    )
  ).toEqual([replacementDependent])
  expect(descriptorOf(afterReplacement.maintainedStates[0]!)).toMatchObject({
    provenance: { kind: 'ACTION', sourceActionId: replacement.actionId }
  })

  await closeRoom(base.campaign.id)
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
      expectedVersion: replacementDependent.version,
      removal: 'REMOVED'
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
  expect(
    retainedComplete.actorEffects.filter(
      (effect) => effect.maintainedEffectStateId === retainedComplete.maintainedStates[0]?.id
    )
  ).toHaveLength(1)
  expect(retainedReplacement.occurrence?.status).toBe('COMPLETE')
}, 60000)

it('settles Assisted maintenance only at terminal response and cleans a removed Character owner once', async () => {
  const base = await setup('SAVE_DAMAGE', 'PROMPT')
  const dmCondition = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!dmCondition) throw new Error('Maintained Character fixture requires Frightened.')
  await closeRoom(base.campaign.id)
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
  expect(before.maintainedStates).toEqual([])
  expect(descriptorOf(firstComplete.maintainedStates[0]!)).toMatchObject({
    provenance: { kind: 'ACTION', sourceActionId: root.actionId }
  })
  // The room journal replays each command's own receipt, shown over the current Run.
  await expect(executeInRoom(base.owner.caller, { command: root })).resolves.toEqual({
    ...issued,
    projection: settled.projection
  })
  await expect(executeInRoom(base.owner.caller, response)).resolves.toEqual(settled)
  expect(await records(base)).toEqual(firstComplete)

  await resetActionAllowance(base)
  const sameTargetRoot = action(base, settled.projection.version, base.characterTarget.id)
  const sameTargetIssued = await executeInRoom(base.owner.caller, {
    command: sameTargetRoot
  })
  expect(sameTargetIssued.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const sameTargetStaged = await records(base)
  const sameTargetResponse = diceResponse(sameTargetIssued)
  await closeRoom(base.campaign.id)
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
    'The Encounter command could not be completed.'
  )
  expect(roomErrorLogs().join('\n')).toMatch(/pending action source or target changed/)
  await closeRoom(base.campaign.id)
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
  await expectRedactedRoomRefusal(
    executeInRoom(base.owner.caller, sameTargetResponse),
    'The Encounter changed; review the current state and try again.',
    'STALE_STATE'
  )
  await base.t.run(async (ctx) => {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
    if (!character) throw new Error('Maintained Character fixture is unavailable.')
    await ctx.db.patch(character._id, { status: 'ACTIVE' })
  })
  await invalidateRoomInputs(base.campaign.id, ['CHARACTER'])
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
  expect(descriptorOf(sameTargetComplete.maintainedStates[0]!)).toMatchObject({
    provenance: { kind: 'ACTION', sourceActionId: sameTargetRoot.actionId }
  })
  // The root was issued before the room was released (D85/D88), so its replay answers with the
  // occurrence's current state.
  await expect(executeInRoom(base.owner.caller, { command: sameTargetRoot })).resolves.toEqual({
    ...sameTargetIssued,
    occurrence: sameTargetReplaced.occurrence,
    projection: sameTargetReplaced.projection
  })
  await expect(executeInRoom(base.owner.caller, sameTargetResponse)).resolves.toEqual(
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
  // D82: a GM removal leaves initiative but keeps the Character's actor and effects.
  expect(afterRemoval.actors.some((actor) => actor.id === base.characterTarget.id)).toBe(true)
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
  // A direct status write is not a revision change the room observes, so it hydrates the DRAFT.
  await closeRoom(base.campaign.id)
  await base.t.run(async (ctx) => {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
    if (!character) throw new Error('Detached maintained Character fixture is unavailable.')
    await ctx.db.patch(character._id, { status: 'DRAFT' })
  })
  await expectRedactedRoomRefusal(
    executeInRoom(base.owner.caller, detachedResponse),
    'The Encounter changed; review the current state and try again.',
    'STALE_STATE'
  )
  await base.t.run(async (ctx) => {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
    if (!character) throw new Error('Detached maintained Character fixture is unavailable.')
    await ctx.db.patch(character._id, { status: 'ACTIVE' })
  })
  await invalidateRoomInputs(base.campaign.id, ['CHARACTER'])
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
  expect(descriptorOf(detachedComplete.maintainedStates[0]!)).toMatchObject({
    provenance: { kind: 'ACTION', sourceActionId: detachedRoot.actionId }
  })
  await expect(executeInRoom(base.owner.caller, { command: detachedRoot })).resolves.toEqual({
    ...detachedIssued,
    occurrence: detachedReplaced.occurrence,
    projection: detachedReplaced.projection
  })
  await expect(executeInRoom(base.owner.caller, detachedResponse)).resolves.toEqual(
    detachedReplaced
  )
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
  await closeRoom(base.campaign.id)
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
    'The Encounter command could not be completed.'
  )
  expect(roomErrorLogs().join('\n')).toMatch(/maintenance definition is no longer current/)
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
  await closeRoom(base.campaign.id)
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
  return { base, state, expectedVersion: created.projection.version }
}

it('commits a maintained Character action from the Worker plan with one atomic replacement', async () => {
  const { base, state, expectedVersion } = await setupMaintenanceCapture(5, 'CHARACTER')
  const command = action(base, expectedVersion, base.characterTarget.id)
  const before = await records(base)
  const priorEffectIds = new Set(before.characterEffects.map((effect) => effect.id))
  expect(priorEffectIds.size).toBeGreaterThanOrEqual(5)
  const committed = await executeInRoom(base.owner.caller, { command })
  expect(committed.occurrence?.status).toBe('COMPLETE')
  const after = await records(base)
  expect(after.run?.version).toBe(before.run!.version + 1)
  expect(committed.projection.version).toBe(after.run?.version)
  expect(
    await base.t.run((ctx) =>
      readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(after.run!))
    )
  ).toEqual(committed.projection)
  expect(after.character?.play.streamVersion).toBe(before.character!.play.streamVersion + 1)
  // One state replaces the old one, and its single new dependent replaces all five old ones.
  expect(after.maintainedStates.map((entry) => entry.id)).not.toContain(state.id)
  expect(after.maintainedStates).toHaveLength(1)
  expect(after.characterEffects).toHaveLength(1)
  expect(after.characterEffects[0]?.maintainedEffectStateId).toBe(after.maintainedStates[0]?.id)
  expect(after.characterEffects.filter((effect) => priorEffectIds.has(effect.id))).toEqual([])
  expect(after.completedOccurrences.map((entry) => entry.id)).toContain(
    committed.occurrence?.occurrenceId
  )
  // A retried acknowledgement replays the original result without committing again.
  expect(await executeInRoom(base.owner.caller, { command })).toEqual(committed)
  expect(await records(base)).toEqual(after)
}, 60_000)

it('commits the post-mechanics maintenance settlement the Worker projects', async () => {
  const { base, state, expectedVersion } = await setupMaintenanceCapture(1, 'CHARACTER')
  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  const poisoned = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'POISONED')
  if (!blinded || !frightened || !poisoned)
    throw new Error('Projected maintenance fixture requires three System conditions.')
  await closeRoom(base.campaign.id)
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
      ...(await readTestActor(ctx, row)),
      conditions: [frightened.id, poisoned.id, blinded.id]
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, actor)
    return { characterDependent, actorDependent, independent }
  })
  const command = action(base, expectedVersion, base.characterTarget.id)
  const beforeCommit = await records(base)
  const result = await executeInRoom(base.owner.caller, { command })
  expect(result.occurrence?.status).toBe('COMPLETE')
  const committed = await records(base)
  expect(committed.character?.play.streamVersion).toBe(
    beforeCommit.character!.play.streamVersion + 1
  )
  expect(committed.actorEffects.map((effect) => effect.id)).toContain(seeded.independent.id)
  expect(committed.actorEffects.map((effect) => effect.id)).not.toContain(seeded.actorDependent.id)
  expect(committed.characterEffects.map((effect) => effect.id)).not.toContain(
    seeded.characterDependent.id
  )
  const updatedActor = committed.actors.find((actor) => actor.id === base.actor.id)
  if (!updatedActor) throw new Error('Projected maintenance actor write is unavailable.')
  const updatedState = readStoredRunActor(updatedActor)
  if (updatedState.kind === 'CHARACTER') throw new Error('Expected a Creature maintenance actor.')
  const updatedConditions = updatedState.conditions
  expect(updatedConditions).toEqual(expect.arrayContaining([frightened.id, poisoned.id]))
  expect(updatedConditions).not.toContain(blinded.id)
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
  expect(
    removed.projection.actors.find((actor) => actor.id === base.characterTarget.id)
  ).toMatchObject({
    absence: 'GM_REMOVED'
  })
  await resetActionAllowance(base)
  const replacement = await executeInRoom(base.owner.caller, {
    command: action(base, removed.projection.version, base.secondActor.id)
  })
  expect(replacement.occurrence?.pending?.kind).toBe('D20_EVIDENCE')
  const replaced = await executeInRoom(base.owner.caller, diceResponse(replacement))
  expect(replaced.occurrence?.status).toBe('COMPLETE')
  const afterReplacement = await records(base)
  expect(afterReplacement.characterEffects.map((effect) => effect.id)).not.toContain(dependent.id)
  expect(afterReplacement.maintainedStates.map((entry) => entry.id)).not.toContain(state.id)
  expect(afterReplacement.maintainedStates).toHaveLength(1)
}, 60000)
