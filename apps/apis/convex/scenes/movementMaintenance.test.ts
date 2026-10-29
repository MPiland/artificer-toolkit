// @vitest-environment node
import { expect, it } from 'vitest'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  setupReactionMovementScene,
  useMovementReactionsInRoom
} from '../../tests/fixtures/automaticSceneMovement'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readRunState, writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from '../encounters/encounterReadPorts'
import {
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { readRoomPendingSnapshot } from '../../tests/fixtures/roomPendingSnapshots'
import { api } from '../_generated/api'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

useLocalRoomWorker()

type MaintainedBase = Awaited<ReturnType<typeof setupCreatureReactionRun>>

/** A natural 14 for each used reaction's attack roll, then its two damage dice at their minimum. */
function queueReactionRolls(base: MaintainedBase, reactions: number) {
  return queueRoomRolls(base.campaign.id, {
    rolls: Array.from({ length: reactions }, () => [14, 0, 0]).flat(),
    repeat: 0
  })
}

async function setupMaintainedBase() {
  const base = await setupCreatureReactionRun(null, true, true, 'AUTOMATIC', 'AUTOMATIC', false, {
    maintainedRecurring: true
  })
  if (!base.additionalReactorActor || !base.maintenanceDefinitionId)
    throw new Error('Maintained movement fixture is incomplete.')
  return base
}

/** Convex's rows after the room checkpoints what it holds (a Run's history is the room's until then, D85). */
async function gameplay(base: MaintainedBase) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    effects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    maintainedStates: await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (q) => q.eq('encounterId', base.run.id))
      .collect()
  }))
}

async function encounterMechanics(base: MaintainedBase) {
  const snapshot = await gameplay(base)
  return {
    run: snapshot.run,
    actors: snapshot.actors,
    effects: snapshot.effects,
    maintainedStates: snapshot.maintainedStates
  }
}

async function resetReactionAndDetachScene(base: MaintainedBase) {
  const reactorIds = [
    base.reactor.id,
    ...(base.additionalReactorActor ? [base.additionalReactorActor.id] : [])
  ]
  return base.t.run(async (ctx) => {
    for (const reactorId of reactorIds) {
      const reactor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', reactorId))
        .unique()
      if (!reactor) throw new Error('Maintained movement reactor is unavailable.')
      const actor = await readTestActor(ctx, reactor)
      const available = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(actor, SRD_REACTION_ALLOWANCE_DEFINITION_ID, 0)
      })
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, reactor._id, available)
    }
    const tokenBindings = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', base.run.id))
      .collect()
    for (const binding of tokenBindings) await ctx.db.delete(binding._id)
    const sceneBinding = await ctx.db
      .query('encounterSceneBindings')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .unique()
    if (sceneBinding) await ctx.db.delete(sceneBinding._id)
    const presentations = await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
    for (const presentation of presentations) await ctx.db.delete(presentation._id)
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Maintained movement Run projection is unavailable.')
    return readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(run))
  })
}

/** Commits a Character in the Run's deployment without assigning it to the Run's Campaign. */
/** A party member's Character, assigned to the Campaign but not in the Run. */
async function createDetachedCharacter(base: MaintainedBase) {
  const party = await createPartyPlayer(base.t, base.campaign)
  await party.join()
  const { draft, character } = await (
    await readyCharacterFixture({}, undefined, base)
  ).createCharacter(undefined, party.caller)
  await party.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  await party.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: base.campaign.id,
    characterId: character.id
  })
  const stored = await base.t.run((ctx) => readCharacterRow(ctx, character.id))
  if (!stored) throw new Error('Detached Character fixture is unavailable.')
  return { id: stored.id, streamVersion: stored.play.streamVersion }
}

async function seedDetachedPassageDependents(
  base: MaintainedBase,
  character: Awaited<ReturnType<typeof createDetachedCharacter>>
) {
  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  const poisoned = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'POISONED')
  const additionalReactor = base.additionalReactorActor
  if (!blinded || !poisoned || !additionalReactor || !base.maintenanceDefinitionId)
    throw new Error('Detached passage maintenance fixture is unavailable.')
  return base.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const states = await Promise.all(
      [base.reactor.id, additionalReactor.id].map((ownerActorId) =>
        store.findMaintainedState({
          encounterId: base.run.id,
          ownerActorId,
          maintenanceDefinitionId: base.maintenanceDefinitionId!
        })
      )
    )
    const primaryState = states[0]
    const laterState = states[1]
    if (!primaryState || !laterState)
      throw new Error('Public passage maintained slots are unavailable.')
    const primaryDependents = await store.listDependentEffects({
      encounterId: base.run.id,
      stateId: primaryState.id
    })
    const laterDependents = await store.listDependentEffects({
      encounterId: base.run.id,
      stateId: laterState.id
    })
    const primaryTemplate = primaryDependents[0]
    const laterTemplate = laterDependents[0]
    if (!primaryTemplate || !laterTemplate)
      throw new Error('Public passage maintained dependents are unavailable.')
    const definition = (template: typeof primaryTemplate.definition, conditionId: string) => ({
      ...template,
      schemaVersion: 2 as const,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId, baselinePresent: false }
      ]
    })
    const primaryCondition = await store.create({
      id: crypto.randomUUID(),
      owner: { kind: 'CHARACTER', characterId: character.id },
      definition: definition(primaryTemplate.definition, blinded.id),
      lifecycle: primaryTemplate.lifecycle,
      maintainedEffectStateId: primaryState.id
    })
    const laterCondition = await store.create({
      id: crypto.randomUUID(),
      owner: { kind: 'CHARACTER', characterId: character.id },
      definition: definition(laterTemplate.definition, poisoned.id),
      lifecycle: laterTemplate.lifecycle,
      maintainedEffectStateId: laterState.id
    })
    await editCharacterRecord(ctx, character.id, (document) =>
      characterAuthoredDtoSchema.parse({
        ...document,
        state: {
          ...document.state,
          conditions: [{ conditionTypeId: blinded.id }, { conditionTypeId: poisoned.id }]
        }
      })
    )
    return {
      primaryStateId: primaryState.id,
      laterStateId: laterState.id,
      primaryOldEffectIds: [...primaryDependents.map((effect) => effect.id), primaryCondition.id],
      laterOldEffectIds: [...laterDependents.map((effect) => effect.id), laterCondition.id],
      blindedId: blinded.id,
      poisonedId: poisoned.id
    }
  })
}

async function passageRecords(base: MaintainedBase, characterId: string) {
  const encounter = await gameplay(base)
  return base.t.run(async (ctx) => ({
    encounter,
    character: await readCharacterRow(ctx, characterId),
    characterEffects: await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', characterId))
      .collect()
  }))
}

async function seedPriorDependents(base: MaintainedBase) {
  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  const poisoned = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'POISONED')
  if (!blinded || !frightened || !poisoned || !base.additionalReactorActor)
    throw new Error('Maintained movement condition fixture is unavailable.')
  const additionalReactor = base.additionalReactorActor
  return base.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const state = await store.findMaintainedState({
      encounterId: base.run.id,
      ownerActorId: base.reactor.id,
      maintenanceDefinitionId: base.maintenanceDefinitionId!
    })
    if (!state) throw new Error('Publicly created maintained state is unavailable.')
    const dependents = await store.listDependentEffects({
      encounterId: base.run.id,
      stateId: state.id
    })
    const template = dependents[0]
    if (!template) throw new Error('Publicly created maintained dependent is unavailable.')
    const definition = (conditionId: string) => ({
      ...template.definition,
      schemaVersion: 2 as const,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId, baselinePresent: false }
      ]
    })
    const moverOwner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: base.run.id,
      targetActorId: base.mover.id
    }
    const thirdOwner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: base.run.id,
      targetActorId: additionalReactor.id
    }
    const conditionDependent = await store.create({
      id: crypto.randomUUID(),
      owner: moverOwner,
      definition: definition(blinded.id),
      lifecycle: template.lifecycle,
      maintainedEffectStateId: state.id
    })
    const thirdOwnerDependent = await store.create({
      id: crypto.randomUUID(),
      owner: thirdOwner,
      definition: definition(frightened.id),
      lifecycle: template.lifecycle,
      maintainedEffectStateId: state.id
    })
    const independent = await store.create({
      id: crypto.randomUUID(),
      owner: moverOwner,
      definition: definition(poisoned.id),
      lifecycle: template.lifecycle
    })
    for (const [actorId, conditions] of [
      [base.mover.id, [blinded.id, poisoned.id]],
      [additionalReactor.id, [frightened.id]]
    ] as const) {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', actorId))
        .unique()
      if (!row) throw new Error('Maintained dependent owner is unavailable.')
      const actor = encounterRunActorStateSchema.parse({
        ...(await readTestActor(ctx, row)),
        conditions
      })
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, actor)
    }
    return {
      stateId: state.id,
      oldEffectIds: [
        ...dependents.map((effect) => effect.id),
        conditionDependent.id,
        thirdOwnerDependent.id
      ],
      independentEffectId: independent.id,
      blindedId: blinded.id,
      frightenedId: frightened.id,
      poisonedId: poisoned.id
    }
  })
}

function response(input: {
  encounterId: string
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number }
  resolution: ResolveRuleOccurrenceInputDto['resolution']
}): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: input.encounterId,
    expectedVersion: input.pending.encounterVersion,
    occurrenceId: input.pending.occurrenceId,
    expectedOccurrenceVersion: input.pending.occurrenceVersion,
    correlationId: null,
    resolution: input.resolution
  }
}

// Assisted play offers each authored automatic reaction as Use/Decline; the GM uses them here.
it('forecasts and atomically publishes maintained replacement across ordered used automatic contacts', async () => {
  const base = await setupMaintainedBase()
  const firstScene = await setupReactionMovementScene(
    base,
    [base.reactor, base.mover, base.additionalReactorActor!],
    [50, 1000]
  )
  await queueReactionRolls(base, 1)
  const created = await useMovementReactionsInRoom(firstScene)
  expect(created.occurrence?.status).toBe('COMPLETE')
  const afterCreation = await gameplay(base)
  expect(afterCreation.maintainedStates).toHaveLength(1)
  expect(
    afterCreation.effects.filter(
      (effect) => effect.maintainedEffectStateId === afterCreation.maintainedStates[0]!.id
    )
  ).not.toHaveLength(0)

  // The Run is the room's until it closes; the seeds below write it in Convex and hydrate into the next command.
  await closeRoom(base.campaign.id)
  const seeded = await seedPriorDependents(base)
  const currentRun = await resetReactionAndDetachScene(base)
  const secondBase = { ...base, run: currentRun }
  const secondScene = await setupReactionMovementScene(
    secondBase,
    [base.reactor, base.mover, base.additionalReactorActor!],
    [50, 250],
    [
      { x: 150, y: 50 },
      { x: 700, y: 50 }
    ]
  )
  await queueReactionRolls(base, 2)
  // The per-reaction maintenance transitions (prior state, removed dependents, owner condition cleanup)
  // are room-held history (D85) with no room-side assertion yet; the maintained states, effects and
  // conditions the committed answers leave are the member-visible proof here.
  const replacement = await useMovementReactionsInRoom(secondScene)
  expect(replacement.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const afterReplacement = await gameplay(base)
  expect(afterReplacement.maintainedStates).toHaveLength(2)
  expect(afterReplacement.maintainedStates.map((state) => state.id)).not.toContain(seeded.stateId)
  expect(afterReplacement.maintainedStates.map((state) => state.ownerActorId).sort()).toEqual(
    [base.reactor.id, base.additionalReactorActor!.id].sort()
  )
  expect(afterReplacement.effects.map((effect) => effect.id)).toEqual(
    expect.arrayContaining([seeded.independentEffectId])
  )
  expect(afterReplacement.effects.map((effect) => effect.id)).toEqual(
    expect.not.arrayContaining(seeded.oldEffectIds)
  )
  const mover = afterReplacement.actors.find((actor) => actor.id === base.mover.id)
  const thirdOwner = afterReplacement.actors.find(
    (actor) => actor.id === base.additionalReactorActor!.id
  )
  const moverState = readStoredRunActor(mover!)
  const thirdOwnerState = readStoredRunActor(thirdOwner!)
  if (moverState.kind === 'CHARACTER' || thirdOwnerState.kind === 'CHARACTER')
    throw new Error('Expected Creature maintenance owners.')
  expect(moverState.conditions).toEqual([seeded.poisonedId])
  expect(thirdOwnerState.conditions).toEqual([])
}, 60_000)

it('carries detached Character maintenance through a non-pausing passage to the later contact', async () => {
  const base = await setupMaintainedBase()
  const initialScene = await setupReactionMovementScene(
    base,
    [base.reactor, base.mover, base.additionalReactorActor!],
    [50, 550],
    [
      { x: 150, y: 50 },
      { x: 850, y: 50 }
    ]
  )
  await queueReactionRolls(base, 1)
  expect((await useMovementReactionsInRoom(initialScene)).occurrence?.status).toBe('COMPLETE')
  // The Run is the room's until it closes; the seeds below write it in Convex and hydrate into the next command.
  await closeRoom(base.campaign.id)
  const character = await createDetachedCharacter(base)
  const seeded = await seedDetachedPassageDependents(base, character)
  const currentRun = await resetReactionAndDetachScene(base)
  const passageScene = await setupReactionMovementScene(
    { ...base, run: currentRun },
    [base.reactor, base.mover, base.additionalReactorActor!],
    [50, 550],
    [
      { x: 150, y: 50 },
      { x: 850, y: 50 }
    ]
  )
  await queueReactionRolls(base, 2)
  // The per-reaction maintenance transitions and Character stream transitions are room-held history
  // (D85) with no room-side assertion yet; the committed result reads as the Character's stream
  // advancing once per replaced slot, below.
  const passage = await useMovementReactionsInRoom(passageScene)
  expect(passage.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const after = await passageRecords(base, character.id)
  if (!after.character) throw new Error('Published detached Character is unavailable.')
  expect(after.character.play.streamVersion).toBe(character.streamVersion + 2)
  const document = readCharacterRecord(after.character)
  expect(document.state.conditions).toEqual([])
  expect(after.characterEffects).toEqual([])
  expect(after.encounter.maintainedStates).toHaveLength(2)
  expect(after.encounter.maintainedStates.map((state) => state.id)).toEqual(
    expect.not.arrayContaining([seeded.primaryStateId, seeded.laterStateId])
  )
  const newStateIds = new Set(after.encounter.maintainedStates.map((state) => state.id))
  expect(
    after.encounter.effects.filter((effect) =>
      effect.maintainedEffectStateId ? newStateIds.has(effect.maintainedEffectStateId) : false
    )
  ).not.toHaveLength(0)
  expect(after.encounter.effects.map((effect) => effect.id)).toEqual(
    expect.not.arrayContaining([...seeded.primaryOldEffectIds, ...seeded.laterOldEffectIds])
  )
}, 60_000)

it('keeps Assisted maintenance pending writes staged and rejects changed slot and dependent owner', async () => {
  const base = await setupMaintainedBase()
  const firstScene = await setupReactionMovementScene(
    base,
    [base.reactor, base.mover, base.additionalReactorActor!],
    [50, 1000]
  )
  await queueReactionRolls(base, 1)
  await useMovementReactionsInRoom(firstScene)
  await setAutoRollDice(base.t, base.owner.userId, false)
  // The Run is the room's until it closes; the reset below writes it in Convex and hydrates into the next command.
  await closeRoom(base.campaign.id)
  const currentRun = await resetReactionAndDetachScene(base)
  const assistedScene = await setupReactionMovementScene(
    { ...base, run: currentRun },
    [base.reactor, base.mover, base.additionalReactorActor!],
    [50, 1000]
  )
  // The GM uses the authored automatic reaction; its d20 pauses as evidence.
  await queueReactionRolls(base, 1)
  const used = await useMovementReactionsInRoom(assistedScene, 1)
  const evidence = used.occurrence?.pending
  if (!evidence || evidence.kind !== 'D20_EVIDENCE')
    throw new Error('Expected Assisted maintained d20 evidence after the reaction Use.')
  // The pending write stays staged: the Run's mechanics are as the Use left them until the evidence settles.
  const pendingGameplay = await encounterMechanics(base)
  const pendingSnapshot = await readRoomPendingSnapshot(base.t, {
    campaignId: base.campaign.id,
    encounterId: base.run.id,
    rootCommandId: assistedScene.rootInput.commandId
  })
  if (pendingSnapshot?.snapshotKind !== 'KERNEL_EVIDENCE')
    throw new Error('Maintained movement pending snapshot is unavailable.')
  if (
    pendingSnapshot.applicationContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    pendingSnapshot.applicationContext.phase.kind !== 'ACTION_EVIDENCE'
  )
    throw new Error('Maintained movement pending phase is unavailable.')
  expect(pendingSnapshot.applicationContext.phase.maintenanceCurrentnessChecksum).toMatch(
    /^[a-f0-9]{64}$/
  )
  const enterDice = response({
    encounterId: base.run.id,
    pending: evidence,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: evidence.request.requestId,
      rawFaces: evidence.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: evidence.request.rollMode
    }
  })
  // The room holds the Run until it closes. Closing checkpoints the pending state, so the edits below
  // are what the next command hydrates from; a changed slot or dependent owner must refuse it.
  await closeRoom(base.campaign.id)
  const current = await base.t.run(async (ctx) => {
    const state = await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition', (q) =>
        q
          .eq('encounterId', base.run.id)
          .eq('ownerActorId', base.reactor.id)
          .eq('maintenanceDefinitionId', base.maintenanceDefinitionId!)
      )
      .unique()
    if (!state) throw new Error('Maintained slot is unavailable.')
    const effect = await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_state_encounter_owner_order', (q) =>
        q.eq('maintainedEffectStateId', state.id).eq('encounterId', base.run.id)
      )
      .first()
    if (!effect) throw new Error('Maintained dependent is unavailable.')
    return { state, effect }
  })
  await base.t.run(async (ctx) =>
    ctx.db.patch(current.state._id, { version: current.state.version + 1 })
  )
  await expect(executeInRoom(base.owner.caller, { command: enterDice })).rejects.toThrow()
  await closeRoom(base.campaign.id)
  await base.t.run(async (ctx) =>
    ctx.db.patch(current.state._id, { version: current.state.version })
  )
  expect(await encounterMechanics(base)).toEqual(pendingGameplay)

  await base.t.run(async (ctx) =>
    ctx.db.patch(current.effect._id, { targetActorId: base.additionalReactorActor!.id })
  )
  await expect(executeInRoom(base.owner.caller, { command: enterDice })).rejects.toThrow()
  await closeRoom(base.campaign.id)
  await base.t.run(async (ctx) =>
    ctx.db.patch(current.effect._id, { targetActorId: current.effect.targetActorId })
  )
  expect(await encounterMechanics(base)).toEqual(pendingGameplay)

  const resumed = await executeInRoom(base.owner.caller, { command: enterDice })
  expect(resumed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const after = await gameplay(base)
  expect(after.maintainedStates).toHaveLength(1)
  expect(after.maintainedStates[0]?.id).not.toBe(current.state.id)
  expect(after.effects.map((effect) => effect.id)).not.toContain(current.effect.id)
  const replacementDependents = after.effects.filter(
    (effect) => effect.maintainedEffectStateId === after.maintainedStates[0]?.id
  )
  expect(replacementDependents).not.toHaveLength(0)
}, 60_000)
