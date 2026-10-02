// @vitest-environment node
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  setupReactionMovementScene,
  useMovementReactions
} from '../../tests/fixtures/automaticSceneMovement'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readRunState, writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from '../encounters/encounterPorts'
import { planMovementDecisionInRoom } from '../../tests/fixtures/liveSessionWorker'
import { readReceiptHeaders } from '../lib/receiptLedgers'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

vi.mock('../lib/rollRandom', () => ({
  nextRollInt: (sides: number) => (sides === 20 ? 14 : 0)
}))

type MaintainedBase = Awaited<ReturnType<typeof setupCreatureReactionRun>>

async function setupMaintainedBase() {
  const base = await setupCreatureReactionRun(null, true, true, 'AUTOMATIC', 'AUTOMATIC', false, {
    maintainedRecurring: true
  })
  if (!base.additionalReactorActor || !base.maintenanceDefinitionId)
    throw new Error('Maintained movement fixture is incomplete.')
  return base
}

async function gameplay(base: MaintainedBase) {
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
      .collect(),
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    receiptHeaders: await ctx.db.query('encounterRuleReceipts').collect(),
    receipts: await readReceiptHeaders(
      ctx,
      'encounterRuleReceipts',
      await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
        .collect()
    ),
    sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
    sceneStates: await ctx.db.query('sceneLiveStates').collect()
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
      const actor = encounterRunActorStateSchema.parse(JSON.parse(reactor.stateJson))
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
async function createDetachedCharacter(base: MaintainedBase) {
  const { readState } = await readySheetFixture({}, undefined, base)
  const stored = (await readState()).character
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
      .collect(),
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    characterReceipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
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
        ...JSON.parse(row.stateJson),
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
  const creation = await useMovementReactions(firstScene)
  const beforeCreation = await gameplay(base)
  const createdPreparation = creation.prepared
  expect(createdPreparation.outcome.kind).toBe('TERMINAL')
  expect(await gameplay(base)).toEqual(beforeCreation)
  const created = await creation.publish()
  expect(created.occurrence?.status).toBe('COMPLETE')
  const afterCreation = await gameplay(base)
  expect(afterCreation.maintainedStates).toHaveLength(1)
  expect(
    afterCreation.effects.filter(
      (effect) => effect.maintainedEffectStateId === afterCreation.maintainedStates[0]!.id
    )
  ).not.toHaveLength(0)

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
  const replacement = await useMovementReactions(secondScene)
  const beforeReplacement = await gameplay(base)
  const prepared = replacement.prepared
  expect(prepared.outcome.kind).toBe('TERMINAL')
  if (prepared.outcome.kind !== 'TERMINAL') throw new Error('Maintained movement did not prepare.')
  expect(await gameplay(base)).toEqual(beforeReplacement)
  expect(prepared.outcome.result.reactionExecutions).toHaveLength(2)
  const first = prepared.outcome.result.reactionExecutions.find(
    (entry) => entry.option.candidate.reactorActorId === base.reactor.id
  )
  const second = prepared.outcome.result.reactionExecutions.find(
    (entry) => entry.option.candidate.reactorActorId === base.additionalReactorActor!.id
  )
  if (!first || !second) throw new Error('Ordered maintained reactions are unavailable.')
  expect(first.ordinal).toBeLessThan(second.ordinal)
  if (
    (first.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
      first.application.kind !== 'CHARACTER_MECHANICS_BATCH') ||
    !first.application.maintenanceTransition
  )
    throw new Error('Maintained replacement receipt is unavailable.')
  expect(first.application.maintenanceTransition.priorState?.id).toBe(seeded.stateId)
  expect(
    first.application.maintenanceTransition.removedDependentEffects.map(
      (effect) => effect.activeEffectId
    )
  ).toEqual(expect.arrayContaining(seeded.oldEffectIds))
  const moverCleanup = first.maintenanceOwnerTransitions?.find(
    (transition) => transition.targetActorId === base.mover.id
  )
  const thirdOwnerCleanup = first.maintenanceOwnerTransitions?.find(
    (transition) => transition.targetActorId === base.additionalReactorActor!.id
  )
  expect(moverCleanup?.before.conditionIds).toEqual(
    expect.arrayContaining([seeded.blindedId, seeded.poisonedId])
  )
  expect(moverCleanup?.after.conditionIds).toEqual([seeded.poisonedId])
  expect(thirdOwnerCleanup?.before.conditionIds).toEqual([seeded.frightenedId])
  expect(thirdOwnerCleanup?.after.conditionIds).toEqual([])
  if (
    first.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ||
    second.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error('Expected Encounter actor reaction mechanics.')
  const firstDamage = first.application.applications.find((entry) => entry.kind === 'DAMAGE')
  const secondDamage = second.application.applications.find((entry) => entry.kind === 'DAMAGE')
  if (!firstDamage || !secondDamage) throw new Error('Expected both maintained reaction damages.')
  expect(secondDamage.beforeCurrentHitPoints).toBe(firstDamage.afterCurrentHitPoints)

  await replacement.publish()
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
  const moverState = encounterRunActorStateSchema.parse(JSON.parse(mover!.stateJson))
  const thirdOwnerState = encounterRunActorStateSchema.parse(JSON.parse(thirdOwner!.stateJson))
  if (moverState.kind === 'CHARACTER' || thirdOwnerState.kind === 'CHARACTER')
    throw new Error('Expected Creature maintenance owners.')
  expect(moverState.conditions).toEqual([seeded.poisonedId])
  expect(thirdOwnerState.conditions).toEqual([])
  const receipt = afterReplacement.receipts.find(
    (entry) => entry.commandId === replacement.responseCommandId
  )
  expect(receipt && JSON.parse(receipt.resultJson)).toEqual(prepared.outcome.result)
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
  const initial = await useMovementReactions(initialScene)
  expect(initial.prepared.outcome.kind).toBe('TERMINAL')
  await initial.publish()
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
  const passage = await useMovementReactions(passageScene)
  const before = await passageRecords(base, character.id)
  const prepared = passage.prepared
  expect(prepared.outcome.kind).toBe('TERMINAL')
  if (prepared.outcome.kind !== 'TERMINAL')
    throw new Error('Passage maintenance did not prepare terminally.')
  expect(await passageRecords(base, character.id)).toEqual(before)
  expect(prepared.outcome.result.reactionExecutions).toHaveLength(2)
  const first = prepared.outcome.result.reactionExecutions.find(
    (entry) => entry.option.candidate.reactorActorId === base.reactor.id
  )
  const later = prepared.outcome.result.reactionExecutions.find(
    (entry) => entry.option.candidate.reactorActorId === base.additionalReactorActor!.id
  )
  if (!first || !later || first.ordinal >= later.ordinal)
    throw new Error('Passage-separated maintained reactions are unavailable.')
  expect(first.option.candidate.pathDistance).toBeLessThan(300)
  expect(later.option.candidate.pathDistance).toBeGreaterThan(300)
  if (
    (first.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
      first.application.kind !== 'CHARACTER_MECHANICS_BATCH') ||
    !first.application.maintenanceTransition ||
    (later.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
      later.application.kind !== 'CHARACTER_MECHANICS_BATCH') ||
    !later.application.maintenanceTransition
  )
    throw new Error('Passage maintenance receipts are unavailable.')
  expect(first.application.maintenanceTransition).toMatchObject({
    priorState: { id: seeded.primaryStateId },
    characterOwnerTransitions: [
      {
        characterId: character.id,
        beforeStreamVersion: character.streamVersion,
        afterStreamVersion: character.streamVersion + 1
      }
    ]
  })
  expect(later.application.maintenanceTransition).toMatchObject({
    priorState: { id: seeded.laterStateId },
    characterOwnerTransitions: [
      {
        characterId: character.id,
        beforeStreamVersion: character.streamVersion + 1,
        afterStreamVersion: character.streamVersion + 2
      }
    ]
  })
  expect(first.characterTransitions).toContainEqual({
    characterId: character.id,
    beforeStreamVersion: character.streamVersion,
    afterStreamVersion: character.streamVersion + 1
  })
  expect(later.characterTransitions).toContainEqual({
    characterId: character.id,
    beforeStreamVersion: character.streamVersion + 1,
    afterStreamVersion: character.streamVersion + 2
  })
  expect(
    first.application.maintenanceTransition.removedDependentEffects.map(
      (effect) => effect.activeEffectId
    )
  ).toEqual(expect.arrayContaining(seeded.primaryOldEffectIds))
  expect(
    later.application.maintenanceTransition.removedDependentEffects.map(
      (effect) => effect.activeEffectId
    )
  ).toEqual(expect.arrayContaining(seeded.laterOldEffectIds))

  await passage.publish()
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
  const receipt = after.encounter.receipts.find(
    (entry) => entry.commandId === passage.responseCommandId
  )
  expect(receipt && JSON.parse(receipt.resultJson)).toEqual(prepared.outcome.result)
}, 60_000)

it('keeps Assisted maintenance pending writes staged and rejects changed slot and dependent owner', async () => {
  const base = await setupMaintainedBase()
  const firstScene = await setupReactionMovementScene(
    base,
    [base.reactor, base.mover, base.additionalReactorActor!],
    [50, 1000]
  )
  await (await useMovementReactions(firstScene)).publish()
  await setAutoRollDice(base.t, base.owner.userId, false)
  const currentRun = await resetReactionAndDetachScene(base)
  const assistedScene = await setupReactionMovementScene(
    { ...base, run: currentRun },
    [base.reactor, base.mover, base.additionalReactorActor!],
    [50, 1000]
  )
  // The GM uses the authored automatic reaction; its d20 pauses as evidence.
  const used = await useMovementReactions(assistedScene, 1)
  const beforeEvidence = await encounterMechanics(base)
  expect(used.prepared.outcome.kind).toBe('PENDING')
  const evidence = (await used.publish()).occurrence?.pending
  expect(await encounterMechanics(base)).toEqual(beforeEvidence)
  if (!evidence || evidence.kind !== 'D20_EVIDENCE')
    throw new Error('Expected Assisted maintained d20 evidence after the reaction Use.')
  const pendingGameplay = await encounterMechanics(base)
  const pendingSnapshot = await base.t.run(async (ctx) => {
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) =>
        q.eq('encounterId', base.run.id).eq('state', 'PENDING')
      )
      .unique()
    if (!occurrence) throw new Error('Maintained movement pending snapshot is unavailable.')
    const snapshot = await readPendingSnapshot(encounterReadTransaction(ctx), occurrence)
    if (snapshot?.snapshotKind !== 'KERNEL_EVIDENCE')
      throw new Error('Maintained movement pending snapshot is unavailable.')
    return snapshot
  })
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
  await expect(planMovementDecisionInRoom(base.owner.caller, enterDice)).rejects.toThrow()
  await base.t.run(async (ctx) =>
    ctx.db.patch(current.state._id, { version: current.state.version })
  )
  expect(await encounterMechanics(base)).toEqual(pendingGameplay)

  await base.t.run(async (ctx) =>
    ctx.db.patch(current.effect._id, { targetActorId: base.additionalReactorActor!.id })
  )
  await expect(planMovementDecisionInRoom(base.owner.caller, enterDice)).rejects.toThrow()
  await base.t.run(async (ctx) =>
    ctx.db.patch(current.effect._id, { targetActorId: current.effect.targetActorId })
  )
  expect(await encounterMechanics(base)).toEqual(pendingGameplay)

  const resumedRequest = await planMovementDecisionInRoom(base.owner.caller, enterDice)
  expect(resumedRequest.outcome.kind).toBe('TERMINAL')
  expect(await encounterMechanics(base)).toEqual(pendingGameplay)
  await resumedRequest.publish()
  const after = await gameplay(base)
  expect(after.maintainedStates).toHaveLength(1)
  expect(after.maintainedStates[0]?.id).not.toBe(current.state.id)
  expect(after.effects.map((effect) => effect.id)).not.toContain(current.effect.id)
  const replacementDependents = after.effects.filter(
    (effect) => effect.maintainedEffectStateId === after.maintainedStates[0]?.id
  )
  expect(replacementDependents).not.toHaveLength(0)
}, 60_000)
