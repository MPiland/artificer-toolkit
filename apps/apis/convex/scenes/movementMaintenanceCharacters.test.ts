// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { expect, it } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  createDnd5eReactionChoiceDefinition,
  createDnd5eMovementReactionEligibilityDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import {
  SRD_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { joinCharacterPlay, readCharacterRecord } from '../characters/stateDocuments'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import {
  setupReactionMovementScene,
  useMovementReactionsInRoom
} from '../../tests/fixtures/automaticSceneMovement'
import {
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { maintenanceDefinitionFixture } from '../../tests/fixtures/maintenanceDefinition'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { api, internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readRunState, writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from '../encounters/encounterReadPorts'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

useLocalRoomWorker()

const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')

async function setup() {
  const base = await setupCharacterRun()
  // The detached owner is assigned to the Campaign but not in the Run.
  const party = await createPartyPlayer(base.t, base.campaign)
  await party.join()
  const detachedDraft = await base.createCharacter(undefined, party.caller)
  await party.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: detachedDraft.draft.id,
    mode: 'create',
    character: detachedDraft.character
  })
  const policies = createEncounterLifecyclePolicyFixture(base.owner.userId)
  const maintenanceDefinitionId = policies.scenarios[0]?.definitionId
  if (!maintenanceDefinitionId) throw new Error('Missing maintenance definition.')
  const maintenanceDefinition = maintenanceDefinitionFixture({ id: maintenanceDefinitionId })
  await base.t.mutation(internal.content.import.bootstrap, policies.bootstrap)
  await base.t.mutation(internal.content.import.importDefinitions, {
    ...policies.imported,
    definitions: policies.imported.definitions.map((definition) =>
      definition.id === maintenanceDefinitionId ? maintenanceDefinition : definition
    )
  })

  const eligibilityDefinitions = [0, 1].map(() => {
    const id = crypto.randomUUID()
    const published = createDnd5eMovementReactionEligibilityDefinition({
      definitionId: id,
      stage: 'BEFORE_LEAVE_REACH'
    })
    const definition = structuredClone(published.definition)
    const outputs = { ...definition.outputs }
    delete outputs.choiceDefinitionId
    outputs.selectionPolicy = { kind: 'LITERAL' as const, value: 'AUTOMATIC' }
    definition.outputs = outputs
    return { ...published, id, definition: { ...definition, id } }
  })
  const choice = createDnd5eReactionChoiceDefinition()
  for (const batch of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...[...eligibilityDefinitions, choice].map((entry) => ({
      id: entry.id,
      definitionFamilyKey: entry.definitionFamilyKey,
      label: 'Maintained Character movement reaction',
      description: 'Fixture',
      document: entry.definition,
      checksum: checksumRuleDocument(entry.definition)
    }))
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: batch
    })

  const creatures = eligibilityDefinitions.map((eligibility) => {
    const document = creatureAuthoredDtoSchema.parse({
      ...wolf,
      id: crypto.randomUUID(),
      features: wolf.features?.map((feature) => ({
        ...feature,
        effects: feature.effects?.map((effect) => ({
          ...effect,
          invocation: {
            ...effect.invocation,
            triggerCode: 'SAVING_THROW' as const,
            activation: { code: 'REACTION' as const, amount: 1 },
            savingThrow: {
              id: crypto.randomUUID(),
              dcMethod: 'FIXED_DC' as const,
              baseDc: 30,
              abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
            },
            reactionTrigger: {
              kind: 'MOVEMENT' as const,
              stage: 'BEFORE_LEAVE_REACH' as const,
              perceptionRequirement: null,
              eligibilityDefinitionId: eligibility.id,
              movementInterruption: null
            }
          },
          paths: effect.paths
            ?.filter(
              (path) =>
                'resultBlock' in path &&
                path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'DAMAGE')
            )
            .slice(0, 1)
            .map((path) =>
              'resultBlock' in path
                ? {
                    ...path,
                    pathCode: 'ON_SAVE_FAIL' as const,
                    resultBlock: {
                      ...path.resultBlock,
                      id: crypto.randomUUID(),
                      maintenanceDefinitionId,
                      duration: {
                        id: crypto.randomUUID(),
                        durationKind: 'ROUND' as const,
                        amount: 3
                      },
                      lifecycle: { recurringKind: 'START_OF_TURN' as const },
                      outcomes: path.resultBlock.outcomes.map((outcome) =>
                        outcome.effectKind === 'DAMAGE'
                          ? {
                              ...outcome,
                              valueKind: 'FIXED' as const,
                              scalingKind: 'NONE' as const,
                              bonuses: [],
                              amount: 1
                            }
                          : outcome
                      )
                    }
                  }
                : path
            )
        }))
      }))
    })
    return document
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: creatures.map((document) =>
      importedSubject({ ...document, subjectKind: 'CREATURE', document })
    )
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Maintained Character movement',
    commandId: crypto.randomUUID(),
    enemies: creatures.map((creature) => ({ kind: 'CREATURE' as const, sourceId: creature.id }))
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const mover = run.actors.find((actor) => actor.kind === 'CHARACTER')
  const reactors = creatures.map((creature) =>
    run.actors.find((actor) => actor.kind === 'CREATURE' && actor.sourceId === creature.id)
  )
  if (!mover || reactors.some((actor) => !actor)) throw new Error('Missing movement actors.')
  await party.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: base.campaign.id,
    characterId: detachedDraft.character.id
  })
  await base.t.run((ctx) =>
    activateFixtureRun(ctx, run.id, {
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: reactors[0]!.id
    })
  )
  return {
    ...base,
    run,
    mover,
    reactors: reactors as [
      NonNullable<(typeof reactors)[number]>,
      NonNullable<(typeof reactors)[number]>
    ],
    detached: detachedDraft.character,
    party,
    maintenanceDefinitionId
  }
}

async function resetAndDetachScene(value: Awaited<ReturnType<typeof setup>>) {
  return value.t.run(async (ctx) => {
    for (const reactor of value.reactors) {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', value.run.id).eq('id', reactor.id)
        )
        .unique()
      if (!row) throw new Error('Missing reactor.')
      const actor = await readTestActor(ctx, row)
      const available = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(actor, SRD_REACTION_ALLOWANCE_DEFINITION_ID, 0)
      })
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, available)
    }
    for (const row of await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', value.run.id))
      .collect())
      await ctx.db.delete(row._id)
    const binding = await ctx.db
      .query('encounterSceneBindings')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', value.run.id))
      .unique()
    if (binding) await ctx.db.delete(binding._id)
    for (const row of await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', value.campaign.id))
      .collect())
      await ctx.db.delete(row._id)
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.run.id))
      .unique()
    if (!run) throw new Error('Missing reset Run.')
    return readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(run))
  })
}

/** Convex's rows after the room checkpoints what it holds (a Run's history is the room's until then, D85). */
async function snapshot(value: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(value.campaign.id)
  return value.t.run(async (ctx) => ({
    characters: await Promise.all(
      (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
    ),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.run.id))
      .collect(),
    states: await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (q) => q.eq('encounterId', value.run.id))
      .collect(),
    actorEffects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', value.run.id))
      .collect(),
    characterEffects: await ctx.db.query('characterActiveRuleEffects').collect(),
    characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
    scenes: await ctx.db.query('sceneLiveStates').collect()
  }))
}

/**
 * Publishes the first reaction, then gives each Character a dependent of its maintained state and
 * an independent effect, with BLINDED owned by the dependent and POISONED by both.
 */
async function seedCharacterDependents(
  value: Awaited<ReturnType<typeof setup>>,
  firstScene: Awaited<ReturnType<typeof setupReactionMovementScene>>
) {
  await queueRoomRolls(value.campaign.id, { rolls: [], repeat: 0 })
  expect((await useMovementReactionsInRoom(firstScene)).occurrence?.status).toBe('COMPLETE')
  // The Run is the room's until it closes; the seeds below write it in Convex and hydrate into the next command.
  await closeRoom(value.campaign.id)
  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')!
  const poisoned = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'POISONED'
  )!
  const seeded = await value.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const states = await store.listMaintainedStatesByOwner({
      encounterId: value.run.id,
      ownerActorId: value.reactors[0].id
    })
    const state = states[0]
    if (!state) throw new Error('Missing created maintained state.')
    const dependents = await store.listDependentEffects({
      encounterId: value.run.id,
      stateId: state.id
    })
    const template = dependents[0]
    if (!template) throw new Error('Missing created maintained dependent.')
    const definition = {
      ...template.definition,
      schemaVersion: 2 as const,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: blinded.id, baselinePresent: false },
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: poisoned.id, baselinePresent: false }
      ]
    }
    const removedIds: string[] = dependents.map((effect) => effect.id)
    const independentIds: string[] = []
    for (const characterId of [value.character.id, value.detached.id]) {
      const dependent = await store.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId },
        definition,
        lifecycle: template.lifecycle,
        maintainedEffectStateId: state.id
      })
      removedIds.push(dependent.id)
      const independent = await store.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId },
        definition: {
          ...definition,
          stateContributions: [
            {
              kind: 'CONDITION_OWNERSHIP' as const,
              conditionId: poisoned.id,
              baselinePresent: false
            }
          ]
        },
        lifecycle: template.lifecycle
      })
      independentIds.push(independent.id)
      await editCharacterRecord(ctx, characterId, (character) =>
        characterAuthoredDtoSchema.parse({
          ...character,
          state: {
            ...character.state,
            conditions: [{ conditionTypeId: blinded.id }, { conditionTypeId: poisoned.id }]
          }
        })
      )
    }
    return { removedIds, independentIds }
  })
  return { ...seeded, blinded, poisoned }
}

it('settles present and detached Character maintenance once per used automatic contact', async () => {
  const value = await setup()
  const firstScene = await setupReactionMovementScene(
    value,
    [value.reactors[0], value.mover, value.reactors[1]],
    [50, 1000]
  )
  const seeded = await seedCharacterDependents(value, firstScene)
  const projection = await resetAndDetachScene(value)
  const next = await setupReactionMovementScene(
    { ...value, run: projection },
    [value.reactors[0], value.mover, value.reactors[1]],
    [50, 250],
    [
      { x: 150, y: 50 },
      { x: 700, y: 50 }
    ]
  )
  const origin = await snapshot(value)
  const presentBefore = origin.characters.find((row) => row.id === value.character.id)!
  const detachedBefore = origin.characters.find((row) => row.id === value.detached.id)!
  // Assisted play offers both authored automatic reactions as Use/Decline. The GM uses them, so the
  // first reaction publishes at the second choice and the totals below span both publications.
  await queueRoomRolls(value.campaign.id, { rolls: [], repeat: 0 })
  const firstUse = await useMovementReactionsInRoom(next, 1)
  const secondChoice = firstUse.occurrence?.pending
  if (secondChoice?.kind !== 'MOVEMENT_REACTION' || !secondChoice.choice.options[0])
    throw new Error('Expected the second Use/Decline reaction choice.')
  const lastUse = {
    type: 'RESOLVE_RULE_OCCURRENCE' as const,
    commandId: crypto.randomUUID(),
    encounterId: value.run.id,
    expectedVersion: secondChoice.encounterVersion,
    occurrenceId: secondChoice.occurrenceId,
    expectedOccurrenceVersion: secondChoice.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'OPTION' as const, optionId: secondChoice.choice.options[0].optionId }
  }
  // The planner's two ordered reaction executions (both for the moving Character) are covered by the
  // producer test "retains each used reaction in order and ends at the destination" in
  // apps/session-worker/test/nativeMovementPlanning.test.ts; the transitions they carry read as the
  // Characters' stream versions and hit points below.
  const published = await executeInRoom(value.owner.caller, { command: lastUse })
  expect(published.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const after = await snapshot(value)
  const presentAfter = after.characters.find((row) => row.id === value.character.id)!
  const detachedAfter = after.characters.find((row) => row.id === value.detached.id)!
  expect.soft(presentAfter.play.streamVersion).toBe(presentBefore.play.streamVersion + 2)
  expect.soft(detachedAfter.play.streamVersion).toBe(detachedBefore.play.streamVersion + 1)
  const finalEffectIds = after.characterEffects.map((effect) => effect.id)
  expect(finalEffectIds.filter((id) => seeded.removedIds.includes(id))).toEqual([])
  expect(finalEffectIds).toEqual(expect.arrayContaining(seeded.independentIds))
  for (const row of [presentAfter, detachedAfter]) {
    const character = readCharacterRecord(row)
    expect(character.state.conditions?.map((condition) => condition.conditionTypeId)).toEqual([
      seeded.poisoned.id
    ])
  }
  expect(readCharacterRecord(presentAfter).state.hitpoints.current).toBe(
    readCharacterRecord(presentBefore).state.hitpoints.current - 2
  )
  const actor = after.actors.find((row) => row.id === value.mover.id)!
  const actorState = readStoredRunActor(actor)
  expect(actorState).toMatchObject({ kind: 'CHARACTER', sourceId: value.character.id })
  expect(actorState).not.toHaveProperty('conditions')
  expect(after.characterReceipts.length).toBe(origin.characterReceipts.length)
  // A retry is answered from the room's journal with the Run as it now stands, and changes nothing.
  const retry = await executeInRoom(value.owner.caller, { command: lastUse })
  expect(retry.projection.version).toBe(published.projection.version)
  expect(await snapshot(value)).toEqual(after)
}, 60_000)

it('ends the Run effects on a Character that leaves the Campaign (D81)', async () => {
  const value = await setup()
  const firstScene = await setupReactionMovementScene(
    value,
    [value.reactors[0], value.mover, value.reactors[1]],
    [50, 1000]
  )
  await seedCharacterDependents(value, firstScene)
  const before = await snapshot(value)
  const detachedBefore = before.characters.find((row) => row.id === value.detached.id)!
  await value.party.caller.mutation(api.campaigns.assignments.unassign, {
    campaignId: value.campaign.id
  })
  const after = await snapshot(value)
  const detachedAfter = after.characters.find((row) => row.id === value.detached.id)!
  const remaining = after.characterEffects.filter((row) => row.characterId === value.detached.id)
  expect(remaining).toEqual([])
  expect(readCharacterRecord(detachedAfter).state.conditions ?? []).toEqual([])
  expect(detachedAfter.play.streamVersion).toBeGreaterThan(detachedBefore.play.streamVersion)
  // The present Character's dependents keep the maintained state alive.
  expect(after.states).toEqual(before.states)
  expect(after.characterEffects.map((row) => row.id)).toEqual(
    expect.arrayContaining(
      before.characterEffects
        .filter((row) => row.characterId === value.character.id)
        .map((row) => row.id)
    )
  )
}, 60_000)
