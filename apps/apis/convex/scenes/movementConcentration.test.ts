import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  concentrationEndOccurrenceId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { useMovementReactionsInRoom } from '../../tests/fixtures/automaticSceneMovement'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import { api, internal } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { sourceImportBatches } from '../content/importBatches'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  executeSceneInRoom,
  deliverQueuedRoomControl,
  queueRoomRolls,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import {
  createConvexEncounterStoreReader,
  createConvexEncounterStore
} from '../lib/convexEncounterStore'

useLocalRoomWorker()

type MovementFixture = Awaited<ReturnType<typeof setupAutomaticCharacterMovement>>

const pendingOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

const concentrationAdvantageFeature = {
  id: '00000000-0000-4000-8000-000000000c30',
  label: 'Focused Concentration',
  description: 'You have advantage on Constitution saving throws to maintain Concentration.',
  availableAtLevel: 1,
  order: 0,
  grants: {
    modifiers: [
      {
        id: '00000000-0000-4000-8000-000000000c31',
        grantKind: 'MODIFIER_GRANT' as const,
        valueDomainCode: 'SAVING_THROW_MODIFIER' as const,
        domain: {
          ability: 'CONSTITUTION' as const,
          ruleDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
        },
        modifierKind: 'ROLL_INFLUENCE' as const,
        payload: { influence: 'ADVANTAGE' },
        scope: 'GLOBAL' as const,
        selectionKind: 'GRANTED' as const,
        order: 0
      }
    ]
  }
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

async function installConcentration(
  value: MovementFixture,
  target: { id: string } = value.base.mover,
  character: { id: string } = value.base.character,
  characterHitPoints?: number
) {
  for (const definitions of sourceImportBatches(SRD_CONCENTRATION_DEFINITIONS))
    await value.base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  // The room reads the definitions from its content snapshots, which were seeded before the import.
  await attachFixtureRoom(value.base.t, value.base.campaign.id)
  return seedConcentration({
    t: value.base.t,
    run: value.base.run,
    target,
    character,
    characterHitPoints
  })
}

async function seedMovingSpatialEffect(
  value: MovementFixture,
  input: { activation: 'ONE_SHOT' | 'REPEATABLE'; hidden: boolean }
) {
  const seeded = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 900, y: 900 }
  )
  return value.base.t.run(async (ctx) => {
    const scope = await createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope(
      {
        encounterId: value.base.run.id,
        sceneId: value.sceneId
      }
    )
    const current = await scope?.get(seeded.id)
    if (!scope || !current) throw new Error('Movement Concentration spatial effect is unavailable.')
    await scope.deleteCas({ id: current.id, expectedVersion: current.version })
    return scope.create({
      id: current.id,
      definition: current.definition,
      lifecycle: current.lifecycle,
      spatialState: { schemaVersion: 1, revealed: !input.hidden },
      placement: {
        schemaVersion: 1,
        anchorKind: 'TOKEN',
        sourceTokenId: value.moverTokenId,
        geometry: {
          frame: 'TOKEN_LOCAL',
          // Wide enough to reach a target standing one cell off the mover's path.
          shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 55 }
        },
        triggerModes: ['CROSS'],
        movementKinds: ['VOLUNTARY'],
        activation: input.activation,
        visibility: input.hidden ? 'HIDDEN' : 'PUBLIC',
        revealOnTrigger: input.hidden
      }
    })
  })
}

type SpatialScope = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createSpatialRuleEffectStore>['scope']>>
>

function withSpatialScope(
  value: MovementFixture,
  write: (scope: SpatialScope) => Promise<unknown>
) {
  return value.base.t.run(async (ctx) => {
    const scope = await createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope(
      { encounterId: value.base.run.id, sceneId: value.sceneId }
    )
    if (!scope) throw new Error('Movement Concentration spatial scope is unavailable.')
    await write(scope)
  })
}

/**
 * Convex's rows after the room checkpoints what it holds (a Run's state is the room's until then,
 * D85), with the room's own command timeline: its receipts are held history that Convex never sees.
 */
async function records(value: MovementFixture) {
  await checkpointLiveRoom(value.base.campaign.id)
  const timeline = await readRoomTimeline(value.owner.caller, value.base.campaign.id)
  return value.base.t.run(async (ctx) => ({
    timeline,
    character: await readCharacterRow(ctx, value.base.character.id),
    characterEffects: await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) =>
        q.eq('characterId', value.base.character.id)
      )
      .collect(),
    allCharacterEffects: await ctx.db.query('characterActiveRuleEffects').collect(),
    maintained: await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (q) =>
        q.eq('encounterId', value.base.run.id)
      )
      .collect(),
    spatialEffects: await ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_createdOrdinal_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
      )
      .collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    sceneStates: await ctx.db.query('sceneLiveStates').collect()
  }))
}

it('settles a used automatic reaction Concentration check once with its damage receipt', async () => {
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC'], false, {
    features: [concentrationAdvantageFeature]
  })
  const seeded = await installConcentration(value)
  // The reaction's attack roll is 15; every later die (damage, Concentration advantage) lands on 1.
  await queueRoomRolls(value.base.campaign.id, { rolls: [14], repeat: 0 })
  const before = await records(value)
  if (!before.character) throw new Error('Concentrating Character is unavailable.')

  const { occurrence, responseCommandId } = await useMovementReactionsInRoom(value)

  expect(responseCommandId).not.toBeNull()
  expect(occurrence?.status).toBe('COMPLETE')
  const after = await records(value)
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.characterEffects.map((effect) => effect.id)).toEqual([seeded.independent.id])
  // The damage and the Concentration cleanup reach Convex in one checkpoint as two ordered stream
  // bumps: the damage settles first, and the check's cleanup then advances the damaged version.
  expect(after.character?.play.streamVersion).toBe(before.character.play.streamVersion + 2)
  // The Concentration child's receipt (sourceCommandId, the d20 faces, the cleanup and owner
  // transitions) is room-held history: apps/session-worker/test/nativeMovementEvidence.test.ts
  // ("a used automatic reaction followed by a failed Concentration save") pins those fields.
  // The one Use is the GM's only decision answer on the room's timeline.
  expect(
    after.timeline.filter((entry) => entry.commandType === 'RESOLVE_RULE_OCCURRENCE')
  ).toMatchObject([{ actorUserId: value.owner.userId }])
}, 60_000)

it('consumes a moving one-shot effect once across a Concentration pause and later target', async () => {
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC', 'AUTOMATIC'], false, {}, true)
  if (!value.additionalCharacter || !value.additionalCharacterActor)
    throw new Error('Expected the stationary Concentration Character.')
  const seeded = await installConcentration(
    value,
    value.additionalCharacterActor,
    value.additionalCharacter
  )
  await seedMovingSpatialEffect(value, { activation: 'ONE_SHOT', hidden: false })
  await queueRoomRolls(value.base.campaign.id, { rolls: [], repeat: 0 })

  const { occurrence } = await useMovementReactionsInRoom(value)

  // Which target's execution carries the Concentration check (the damaged Character's, never the
  // later Creature's) and the executions' count are room-held receipt history, pinned in
  // apps/session-worker/test/nativeMovementEvidence.test.ts ("a moving spatial effect shared by a Concentration Character and a later target"). Only the net state reaches Convex.
  expect(occurrence?.status).toBe('COMPLETE')
  const after = await records(value)
  expect(after.spatialEffects).toEqual([])
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.allCharacterEffects.map((entry) => entry.id)).not.toContain(seeded.dependent.id)
  expect(JSON.stringify(occurrence)).not.toContain('consumedSpatialEffects')
  expect(JSON.stringify(occurrence)).not.toContain('frozenGraph')
}, 60_000)

it('reveals a moving hidden repeatable effect once across several targets', async () => {
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC', 'AUTOMATIC'], false, {}, true)
  if (!value.additionalCharacter || !value.additionalCharacterActor)
    throw new Error('Expected the stationary Concentration Character.')
  const seeded = await installConcentration(
    value,
    value.additionalCharacterActor,
    value.additionalCharacter
  )
  const effect = await seedMovingSpatialEffect(value, { activation: 'REPEATABLE', hidden: true })
  await queueRoomRolls(value.base.campaign.id, { rolls: [], repeat: 0 })
  const hidden = await records(value)

  const { occurrence } = await useMovementReactionsInRoom(value)

  // The executions' count (two targets of the one effect) is room-held receipt history, pinned in
  // apps/session-worker/test/nativeMovementEvidence.test.ts ("a moving spatial effect shared by a Concentration Character and a later target").
  expect(occurrence?.status).toBe('COMPLETE')
  const after = await records(value)
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  // The first crossing, before the reactions paused the movement, revealed the effect once.
  expect(after.spatialEffects).toMatchObject([
    { id: effect.id, version: effect.version + 1, spatialState: { revealed: true } }
  ])
  expect(JSON.stringify(occurrence)).not.toContain('consumedSpatialEffects')
  expect(JSON.stringify(occurrence)).not.toContain('frozenGraph')
  expect(hidden.spatialEffects).toMatchObject([
    { id: effect.id, spatialState: { revealed: false } }
  ])
}, 60_000)

it('resumes an Assisted moving one-shot effect only from the damaged Character controller', async () => {
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC', 'AUTOMATIC'], false, {}, true)
  if (!value.additionalCharacter || !value.additionalCharacterActor || !value.additionalPlayer)
    throw new Error('Expected the stationary Concentration Character controller.')
  const seeded = await installConcentration(
    value,
    value.additionalCharacterActor,
    value.additionalCharacter
  )
  const effect = await seedMovingSpatialEffect(value, { activation: 'ONE_SHOT', hidden: false })
  const hazard = await seedSpatialSaveEffect(value, {
    center: { x: 500, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  // Each roll pauses for its actor's controller: the stationary Character's Concentration check for
  // its player, the mover's hazard save for the mover's player, and Creature dice for the GM.
  await setAutoRollDice(value.base.t, value.base.owner.userId, false)
  await setAutoRollDice(value.base.t, value.additionalPlayer.userId, false)
  await setAutoRollDice(value.base.t, value.player.userId, false)

  const initial = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
  const pending = initial?.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected the shared-effect Concentration evidence.')
  const answer = response({
    encounterId: value.base.run.id,
    pending,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: pending.request.rollMode
    }
  })
  await expect(executeInRoom(value.player.caller, { command: answer })).rejects.toThrow()
  await checkpointLiveRoom(value.base.campaign.id)
  expect(
    await value.player.caller.query(pendingOccurrence, { encounterId: value.base.run.id })
  ).toBeNull()
  const visible = await value.additionalPlayer.caller.query(pendingOccurrence, {
    encounterId: value.base.run.id
  })
  expect(visible).toMatchObject({
    kind: 'D20_EVIDENCE',
    occurrenceId: pending.occurrenceId,
    occurrenceVersion: pending.occurrenceVersion
  })
  const wire = JSON.stringify(visible)
  expect(wire).not.toContain('consumedSpatialEffects')
  expect(wire).not.toContain('frozenGraph')

  let completed = await executeInRoom(value.additionalPlayer.caller, { command: answer })
  let lastAnswer = answer
  let sawHazardPause = false
  for (let index = 0; completed.occurrence?.status === 'PENDING'; index += 1) {
    if (index >= 20) throw new Error('Shared-effect continuation did not settle.')
    const next =
      completed.occurrence.pending ??
      (await checkpointLiveRoom(value.base.campaign.id).then(() =>
        value.owner.caller.query(pendingOccurrence, {
          encounterId: value.base.run.id
        })
      ))
    if (!next) throw new Error('Shared-effect continuation pending summary is unavailable.')
    // Reactions now pause for Use and their rolls, so find the hazard save by its sealed context.
    let respondingToHazard = false
    if (next.kind === 'D20_EVIDENCE') {
      const staged = await records(value)
      const root = staged.occurrences.find((occurrence) => occurrence.id === next.occurrenceId)
      if (!root) throw new Error('Expected retained E/H pending snapshot.')
      const snapshot = await value.base.t.run((ctx) =>
        readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, root)
      )
      if (snapshot?.snapshotKind !== 'KERNEL_EVIDENCE')
        throw new Error('Expected retained E/H pending snapshot.')
      const context = snapshot.applicationContext
      if (
        context.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
        context.phase.kind === 'SPATIAL_EVIDENCE' &&
        context.phase.currentCandidate.effect.effectId === hazard.id
      ) {
        respondingToHazard = true
        if (
          context.appliedSpatialPrefix?.status !== 'BATCH_COMPLETE' ||
          context.appliedSpatialPrefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT'
        )
          throw new Error('Expected spatial evidence after the committed E prefix.')
        expect(
          context.completedSpatialExecutions.filter(
            (entry) => entry.candidate.effect.effectId === effect.id
          )
        ).toHaveLength(2)
        expect(
          context.appliedSpatialPrefix.executions.filter(
            (entry) => entry.candidate.effect.effectId === effect.id
          )
        ).toHaveLength(1)
        const wire = JSON.stringify(snapshot.applicationContext)
        expect(wire).toContain(effect.id)
        expect(wire).toContain(hazard.id)
        expect(staged.spatialEffects.map((entry) => entry.id)).toEqual([hazard.id])
        sawHazardPause = true
      }
    }
    const resolution =
      next.kind === 'MOVEMENT_REACTION'
        ? next.choice.options[0]
          ? { kind: 'OPTION' as const, optionId: next.choice.options[0].optionId }
          : null
        : next.kind === 'D20_EVIDENCE'
          ? {
              kind: 'ENTER_DICE' as const,
              requestId: next.request.requestId,
              rawFaces: Array.from({ length: next.request.rollMode === 'NORMAL' ? 1 : 2 }, () =>
                respondingToHazard ? 1 : 20
              ),
              rollMode: next.request.rollMode
            }
          : next.kind === 'ACTION_OUTCOME_EVIDENCE'
            ? {
                kind: 'ENTER_INTEGER' as const,
                requestId: next.request.requestId,
                value: next.request.min
              }
            : null
    if (!resolution) throw new Error('Unexpected shared-effect continuation request.')
    const nextAnswer = response({ encounterId: value.base.run.id, pending: next, resolution })
    if (respondingToHazard) {
      // E, consumed by the committed prefix, reappears in the Scene: the owner's answer to the
      // hazard must refuse and write nothing. The room holds the Run, so it closes (checkpointing)
      // before each write to Convex and re-hydrates with the next command.
      await closeRoom(value.base.campaign.id)
      await withSpatialScope(value, (scope) =>
        scope.create({
          id: effect.id,
          definition: effect.definition,
          lifecycle: effect.lifecycle,
          placement: effect.placement,
          spatialState: effect.spatialState
        })
      )
      const beforeRejection = await records(value)
      await expect(executeInRoom(value.owner.caller, { command: nextAnswer })).rejects.toThrow()
      await closeRoom(value.base.campaign.id)
      expect(await records(value)).toEqual(beforeRejection)
      // Reading the room re-hydrates it, so it closes again before the next write to Convex.
      await closeRoom(value.base.campaign.id)
      await withSpatialScope(value, async (scope) => {
        const recreated = await scope.get(effect.id)
        if (!recreated) throw new Error('Recreated E spatial effect is unavailable.')
        await scope.deleteCas({ id: recreated.id, expectedVersion: recreated.version })
      })
    }
    completed = await executeInRoom(value.owner.caller, { command: nextAnswer })
    lastAnswer = nextAnswer
  }
  if (completed.occurrence?.status !== 'COMPLETE')
    throw new Error('Expected the shared-effect suffix to settle after Concentration.')
  expect(sawHazardPause).toBe(true)
  const after = await records(value)
  // The completed spatial history (two executions of the effect, one of the hazard) is room-held
  // receipt history; the retained snapshot assertions at the hazard pause pin its prefix. The effect's
  // two executions are pinned room-side by the shared-effect test in nativeMovementEvidence.test.ts;
  // the hazard's own execution has no room-side assertion yet.
  expect(after.spatialEffects).toEqual([])
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(JSON.stringify(completed)).not.toContain('consumedSpatialEffects')
  expect(JSON.stringify(completed)).not.toContain('frozenGraph')
  // A retried decision is answered from the room's journal, identical and without rolling again.
  await expect(executeInRoom(value.owner.caller, { command: lastAnswer })).resolves.toEqual(
    completed
  )
  // Settled decisions are no longer routable.
  await expect(
    executeInRoom(value.additionalPlayer.caller, {
      command: { ...answer, commandId: crypto.randomUUID() }
    })
  ).rejects.toThrow()
  expect(await records(value)).toEqual(after)
}, 60_000)

it('continues Automatic same-contact hazards after a failed Concentration cleanup', async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'])
  const seeded = await installConcentration(value)
  const firstHazard = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 230, y: 50 },
    5
  )
  const secondHazard = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 230, y: 50 },
    5
  )
  await queueRoomRolls(value.base.campaign.id, { rolls: [], repeat: 0 })
  const move = await executeSceneInRoom(value.owner.caller, value.rootInput)
  const published = move.result
  expect(published?.occurrence?.pending).toMatchObject({ kind: 'MOVEMENT_REACTION' })
  const staged = await records(value)
  const root = staged.occurrences.find(
    (occurrence) => occurrence.id === published?.occurrence?.pending?.occurrenceId
  )
  if (!root) throw new Error('Expected the retained reaction-choice occurrence.')
  const snapshot = await value.base.t.run((ctx) =>
    readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, root)
  )
  if (snapshot?.snapshotKind !== 'KERNEL_EVIDENCE')
    throw new Error('Expected the retained reaction-choice snapshot.')
  const context = snapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' || context.phase.kind !== 'CHOICE')
    throw new Error('Expected hazards to continue to the reaction choice.')
  const executions = [...context.completedSpatialExecutions].sort(
    (left, right) => left.ordinal - right.ordinal
  )
  expect(executions).toHaveLength(2)
  expect(executions.map((entry) => entry.candidate.candidate.effectId).sort()).toEqual(
    [firstHazard.id, secondHazard.id].sort()
  )
  expect(executions[0]?.concentrationChecks).toMatchObject([
    {
      result: {
        applicationOutputs: {
          outcome: 'SAVE_FAILURE',
          cleanup: { maintainedStateId: seeded.state.id },
          d20: { rawFaces: [1] }
        }
      }
    }
  ])
  expect(executions[1]?.concentrationChecks).toBeUndefined()

  const after = await records(value)
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.characterEffects.map((effect) => effect.id)).toEqual([seeded.independent.id])
  // A retried root move is answered from the room's journal and rolls nothing again.
  await expect(
    executeSceneInRoom(value.owner.caller, value.rootInput, move.expectedSessionSequence)
  ).resolves.toEqual({ ...move, result: { ...published, replayed: true } })
  expect(await records(value)).toEqual(after)
}, 60_000)

it('keeps the Assisted Concentration child sealed under one movement root', async () => {
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC'])
  const seeded = await installConcentration(value)
  await setAutoRollDice(value.base.t, value.base.owner.userId, false)
  // The mover's Concentration check is its controller's roll.
  await setAutoRollDice(value.base.t, value.player.userId, false)
  // The GM uses the authored automatic reaction; its dice pause as evidence.
  const used = await useMovementReactionsInRoom(value)
  const actionEvidence = used.occurrence?.pending
  if (!actionEvidence || actionEvidence.kind !== 'D20_EVIDENCE')
    throw new Error('Expected reaction d20 evidence after its Use.')
  const action = response({
    encounterId: value.base.run.id,
    pending: actionEvidence,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: actionEvidence.request.requestId,
      rawFaces: actionEvidence.request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: actionEvidence.request.rollMode
    }
  })
  await expect(executeInRoom(value.player.caller, { command: action })).rejects.toThrow()
  let answer = action
  let pending: PendingEncounterRuleOccurrenceSummaryDto | null | undefined
  for (;;) {
    pending = (await executeInRoom(value.owner.caller, { command: answer })).occurrence?.pending
    // The GM enters the reaction's damage before its target's Concentration check.
    if (pending?.kind !== 'ACTION_OUTCOME_EVIDENCE') break
    answer = response({
      encounterId: value.base.run.id,
      pending,
      resolution: {
        kind: 'ENTER_INTEGER',
        requestId: pending.request.requestId,
        value: pending.request.min
      }
    })
  }
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected the sealed Concentration evidence.')
  const staged = await records(value)
  expect(staged.occurrences).toHaveLength(1)
  const root = staged.occurrences[0]
  if (!root) throw new Error('Movement Concentration root is unavailable.')
  const snapshot = await value.base.t.run((ctx) =>
    readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, root)
  )
  if (snapshot?.snapshotKind !== 'KERNEL_EVIDENCE')
    throw new Error('Movement Concentration root is unavailable.')
  const context = snapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    context.phase.kind !== 'CONCENTRATION_EVIDENCE'
  )
    throw new Error('Expected a movement-root Concentration phase.')
  expect(root.id).toBe(pending.occurrenceId)
  expect(root.version).toBe(pending.occurrenceVersion)
  expect(context.root.commandId).toBe(value.rootInput.commandId)
  expect(context.phase.concentration).toMatchObject({
    maintainedState: { id: seeded.state.id },
    application: { targetActorId: value.base.mover.id }
  })

  const concentration = response({
    encounterId: value.base.run.id,
    pending,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: pending.request.rollMode
    }
  })
  const moverHitPoints = async () =>
    value.base.t.run(async (ctx) => {
      const character = await readCharacterRow(ctx, value.base.character.id)
      if (!character) throw new Error('Movement Concentration target Character is unavailable.')
      return readCharacterRecord(character).state.hitpoints.current
    })
  const damagedHitPoints = await moverHitPoints()
  // The controller leaves the Campaign through the real mutation (D81). A Run the room holds
  // keeps its actors in the room (D74), so the notice the mutation queues reaches the room first.
  await value.player.caller.mutation(api.campaigns.assignments.unassign, {
    campaignId: value.base.campaign.id
  })
  await deliverQueuedRoomControl(value.base.t)
  // The room reloads authorization before it admits the answer, so the departed player is no
  // longer the actor's controller; the Character-unavailable refusal is for commands that read it.
  await expect(
    executeInRoom(value.player.caller, { command: concentration })
  ).rejects.toMatchObject({
    data: {
      code: 'DOMAIN_REJECTED',
      reason: 'NOT_ACTOR_CONTROLLER',
      message: "This decision isn't yours to answer."
    }
  })
  const departed = await records(value)
  // The room froze the departed actor (the only write besides the departure itself); the refused
  // answer wrote nothing: no child, no settlement, no Concentration outcome.
  const actors = await value.base.t.run(async (ctx) =>
    (
      await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect()
    ).map(readStoredRunActor)
  )
  const departedActor = actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === value.base.character.id
  )
  expect(departedActor?.kind === 'CHARACTER' && departedActor.frozenState).toBeTruthy()
  expect(await moverHitPoints()).toBe(damagedHitPoints)
  expect(departed.occurrences).toEqual(staged.occurrences)
  expect(departed.occurrences.map((occurrence) => occurrence.id)).not.toContain(
    concentrationOccurrenceId(root.id, context.phase.concentration.application)
  )
  expect(departed.maintained).toEqual(staged.maintained)
  expect(departed.receiptLedgers).toEqual(staged.receiptLedgers)
  expect(departed.receiptLedgerParts).toEqual(staged.receiptLedgerParts)
  expect(departed.sceneStates).toEqual(staged.sceneStates)
}, 120_000)

it('ends Concentration without a check when a movement reaction defeats the holder (D95)', async () => {
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC'], false, {
    features: [concentrationAdvantageFeature]
  })
  const seeded = await installConcentration(value, undefined, undefined, 1)
  // The reaction's attack roll is 15; its damage lands on the minimum, which is enough at 1 hit point.
  await queueRoomRolls(value.base.campaign.id, { rolls: [14], repeat: 0 })

  const { occurrence } = await useMovementReactionsInRoom(value)

  expect(occurrence?.status).toBe('COMPLETE')
  const after = await records(value)
  // The slot and its dependent effect end; the independent effect stays.
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.characterEffects.map((effect) => effect.id)).toEqual([seeded.independent.id])
  if (!after.character) throw new Error('Defeated Character is unavailable.')
  expect(readCharacterRecord(after.character).state.hitpoints.current).toBe(0)
  // The end is a durable child of the movement root and no check is rolled. Its receipt is
  // room-held history: apps/session-worker/test/nativeMovementConcentrationEnd.test.ts pins it.
  const root = after.occurrences.find((entry) => entry.id === occurrence?.occurrenceId)
  expect(
    after.occurrences.find(
      (entry) => entry.id === concentrationEndOccurrenceId(root!.id, seeded.state.id)
    )
  ).toMatchObject({ state: 'COMPLETED' })
  // The GM controls this Character, so the end's chat entry is private and posts nothing; the
  // table-visible entry is pinned in apps/session-worker/test/nativeMovementConcentrationEnd.test.ts.
  await expect(
    value.owner.caller.query(api.campaigns.chat.list, {
      campaignId: value.base.campaign.id,
      room: 'TABLE',
      limit: 100
    })
  ).rejects.toThrow('Conversation not found.')
}, 60_000)
