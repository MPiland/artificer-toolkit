import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import {
  refreshMovementSaveVision,
  useMovementReactions
} from '../../tests/fixtures/automaticSceneMovement'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import {
  preparePrivateMovementResponse,
  privateMovementEnvironment,
  privateMovementWorkerSecret
} from '../../tests/fixtures/liveMovementResponse'
import { internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'
import * as rollRandom from '../lib/rollRandom'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  insertActiveLiveAuthority,
  planMovementDecisionInRoom,
  planStagedMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: vi.fn() }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

type MovementFixture = Awaited<ReturnType<typeof setupAutomaticCharacterMovement>>

const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
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
        modifierKind: 'ADVANTAGE' as const,
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
  character: { id: string } = value.base.character
) {
  for (const definitions of sourceImportBatches(SRD_CONCENTRATION_DEFINITIONS))
    await value.base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  return seedConcentration({
    t: value.base.t,
    run: value.base.run,
    target,
    character
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
    const scope = await createSpatialRuleEffectStore(ctx).scope({
      encounterId: value.base.run.id,
      sceneId: value.sceneId
    })
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
          shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 5 }
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

async function records(value: MovementFixture) {
  return value.base.t.run(async (ctx) => ({
    character: await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.character.id))
      .unique(),
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
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
    sceneStates: await ctx.db.query('sceneLiveStates').collect()
  }))
}

it('settles a used automatic reaction Concentration check once with its damage receipt', async () => {
  const random = vi.mocked(rollRandom.nextRollInt)
  random.mockReset()
  random.mockReturnValueOnce(14).mockReturnValue(0)
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC'], false, {
    features: [concentrationAdvantageFeature]
  })
  const seeded = await installConcentration(value)
  await refreshMovementSaveVision(value)
  const { publish, prepared, responseCommandId } = await useMovementReactions(value)
  const before = await records(value)
  if (!before.character) throw new Error('Concentrating Character is unavailable.')

  expect(prepared.outcome.kind).toBe('TERMINAL')
  if (prepared.outcome.kind !== 'TERMINAL') throw new Error('Expected Automatic terminal movement.')
  const reaction = prepared.outcome.result.reactionExecutions[0]
  const concentration = reaction?.concentrationChecks?.[0]
  if (!reaction || !concentration) throw new Error('Expected the reaction Concentration child.')
  // The Use response continues the movement and sources its mechanics.
  expect(concentration.sourceCommandId).toBe(responseCommandId)
  expect(concentration.result.applicationOutputs).toMatchObject({
    parentOccurrenceId: prepared.outcome.result.occurrenceId,
    application: { targetActorId: value.base.mover.id },
    outcome: 'SAVE_FAILURE',
    d20: { rawFaces: [1, 1], rollMode: 'ADVANTAGE', dc: 10, modifier: 1 },
    cleanup: {
      maintainedStateId: seeded.state.id,
      removedDependentEffectIds: expect.arrayContaining([seeded.dependent.id])
    }
  })
  expect(concentration.ownerTransitions).toMatchObject([
    { characterId: value.base.character.id, targetActorId: value.base.mover.id }
  ])
  expect(random).toHaveBeenCalledTimes(3)
  expect(await records(value)).toEqual(before)

  const published = await publish()
  const after = await records(value)
  expect(random).toHaveBeenCalledTimes(3)
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.characterEffects.map((effect) => effect.id)).toEqual([seeded.independent.id])
  expect(after.character?.streamVersion).toBe(before.character.streamVersion + 2)
  // The Use response continues the paused movement, so its receipt holds the terminal result.
  const receipt = after.receipts.find((entry) => entry.commandId === responseCommandId)
  if (!receipt) throw new Error('Movement Concentration receipt is unavailable.')
  expect(storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))).toEqual(
    prepared.outcome.result
  )
  await expect(publish()).resolves.toEqual({
    ...published,
    replayed: true
  })
  expect(random).toHaveBeenCalledTimes(3)
  expect(await records(value)).toEqual(after)
}, 60_000)

it('consumes a moving one-shot effect once across a Concentration pause and later target', async () => {
  const random = vi.mocked(rollRandom.nextRollInt)
  random.mockReset()
  random.mockReturnValue(0)
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC', 'AUTOMATIC'], false, {}, true)
  if (!value.additionalCharacter || !value.additionalCharacterActor)
    throw new Error('Expected the stationary Concentration Character.')
  const seeded = await installConcentration(
    value,
    value.additionalCharacterActor,
    value.additionalCharacter
  )
  const effect = await seedMovingSpatialEffect(value, { activation: 'ONE_SHOT', hidden: false })
  await refreshMovementSaveVision(value)
  const { publish, prepared } = await useMovementReactions(value)
  const before = await records(value)

  expect(prepared.outcome.kind).toBe('TERMINAL')
  if (
    prepared.outcome.kind !== 'TERMINAL' ||
    prepared.outcome.result.status !== 'BATCH_COMPLETE' ||
    prepared.outcome.result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT'
  )
    throw new Error('Expected automatic shared-effect spatial terminal.')
  const executions = prepared.outcome.result.executions.filter(
    (execution) => execution.candidate.candidate.effectId === effect.id
  )
  expect(executions).toHaveLength(2)
  const concentrationTarget = executions.find(
    (execution) =>
      execution.candidate.candidate.targetActorId === value.additionalCharacterActor!.id
  )
  const laterTarget = executions.find(
    (execution) => execution.candidate.candidate.targetActorId === value.base.reactors[1]!.id
  )
  expect(concentrationTarget?.concentrationChecks).toMatchObject([
    {
      result: {
        applicationOutputs: {
          outcome: 'SAVE_FAILURE',
          cleanup: { maintainedStateId: seeded.state.id }
        }
      }
    }
  ])
  expect(laterTarget?.concentrationChecks).toBeUndefined()
  expect(await records(value)).toEqual(before)

  const published = await publish()
  const after = await records(value)
  expect(after.spatialEffects).toEqual([])
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.allCharacterEffects.map((entry) => entry.id)).not.toContain(seeded.dependent.id)
  expect(JSON.stringify(published)).not.toContain('consumedSpatialEffects')
  expect(JSON.stringify(published)).not.toContain('frozenGraph')
  await expect(publish()).resolves.toEqual({
    ...published,
    replayed: true
  })
  expect(await records(value)).toEqual(after)
}, 60_000)

it('reveals a moving hidden repeatable effect once across several targets', async () => {
  const random = vi.mocked(rollRandom.nextRollInt)
  random.mockReset()
  random.mockReturnValue(0)
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC', 'AUTOMATIC'], false, {}, true)
  if (!value.additionalCharacter || !value.additionalCharacterActor)
    throw new Error('Expected the stationary Concentration Character.')
  const seeded = await installConcentration(
    value,
    value.additionalCharacterActor,
    value.additionalCharacter
  )
  const effect = await seedMovingSpatialEffect(value, { activation: 'REPEATABLE', hidden: true })
  await refreshMovementSaveVision(value)
  const hidden = await records(value)
  const { publish, prepared } = await useMovementReactions(value)

  if (
    prepared.outcome.kind !== 'TERMINAL' ||
    prepared.outcome.result.status !== 'BATCH_COMPLETE' ||
    prepared.outcome.result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT'
  )
    throw new Error('Expected hidden repeatable shared-effect spatial terminal.')
  expect(
    prepared.outcome.result.executions.filter(
      (execution) => execution.candidate.candidate.effectId === effect.id
    )
  ).toHaveLength(2)
  const published = await publish()
  const after = await records(value)
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  // The first crossing, before the reactions paused the movement, revealed the effect once.
  expect(after.spatialEffects).toMatchObject([
    { id: effect.id, version: effect.version + 1, spatialState: { revealed: true } }
  ])
  expect(JSON.stringify(published)).not.toContain('consumedSpatialEffects')
  expect(JSON.stringify(published)).not.toContain('frozenGraph')
  await expect(publish()).resolves.toEqual({
    ...published,
    replayed: true
  })
  expect(await records(value)).toEqual(after)
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
  await refreshMovementSaveVision(value)
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })

  const prepared = await planStagedMovementInRoom(value.owner.caller, value.saveId)
  expect(prepared.outcome.kind).toBe('PENDING')
  const initial = await prepared.publish()
  const pending = initial.occurrence?.pending
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
  await expect(planMovementDecisionInRoom(value.player.caller, answer)).rejects.toThrow()
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

  let plan = await planMovementDecisionInRoom(value.additionalPlayer.caller, answer)
  const concentrationResponse = await plan.publish()
  let completed = concentrationResponse
  let sawHazardPause = false
  for (let index = 0; completed.occurrence?.status === 'PENDING'; index += 1) {
    if (index >= 20) throw new Error('Shared-effect continuation did not settle.')
    const next =
      completed.occurrence.pending ??
      (await value.owner.caller.query(pendingOccurrence, {
        encounterId: value.base.run.id
      }))
    if (!next) throw new Error('Shared-effect continuation pending summary is unavailable.')
    // Reactions now pause for Use and their rolls, so find the hazard save by its sealed context.
    let respondingToHazard = false
    if (next.kind === 'D20_EVIDENCE') {
      const staged = await records(value)
      const root = staged.occurrences.find((occurrence) => occurrence.id === next.occurrenceId)
      if (!root?.pendingSnapshotJson) throw new Error('Expected retained E/H pending snapshot.')
      const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(
        JSON.parse(root.pendingSnapshotJson)
      )
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
      await value.base.t.run(async (ctx) => {
        const scope = await createSpatialRuleEffectStore(ctx).scope({
          encounterId: value.base.run.id,
          sceneId: value.sceneId
        })
        if (!scope) throw new Error('E/H spatial effect scope is unavailable.')
        await scope.create({
          id: effect.id,
          definition: effect.definition,
          lifecycle: effect.lifecycle,
          placement: effect.placement,
          spatialState: effect.spatialState
        })
      })
      const beforeRejectedPreparation = await records(value)
      await expect(planMovementDecisionInRoom(value.owner.caller, nextAnswer)).rejects.toThrow()
      expect(await records(value)).toEqual(beforeRejectedPreparation)
      await value.base.t.run(async (ctx) => {
        const scope = await createSpatialRuleEffectStore(ctx).scope({
          encounterId: value.base.run.id,
          sceneId: value.sceneId
        })
        const recreated = await scope?.get(effect.id)
        if (!scope || !recreated) throw new Error('Recreated E spatial effect is unavailable.')
        await scope.deleteCas({ id: recreated.id, expectedVersion: recreated.version })
      })
    }
    plan = await planMovementDecisionInRoom(value.owner.caller, nextAnswer)
    completed = await plan.publish()
  }
  if (completed.occurrence?.status !== 'COMPLETE')
    throw new Error('Expected the shared-effect suffix to settle after Concentration.')
  expect(sawHazardPause).toBe(true)
  const after = await records(value)
  const receipt = after.receipts.find((entry) => {
    const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(entry.resultJson))
    return result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
  })
  if (!receipt) throw new Error('Assisted shared-effect movement receipt is unavailable.')
  const stored = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (stored.status !== 'BATCH_COMPLETE' || stored.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
    throw new Error('Expected the completed shared-effect spatial history.')
  expect(
    stored.executions.filter((execution) => execution.candidate.candidate.effectId === effect.id)
  ).toHaveLength(2)
  expect(
    stored.executions.filter((execution) => execution.candidate.candidate.effectId === hazard.id)
  ).toHaveLength(1)
  expect(after.spatialEffects).toEqual([])
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(JSON.stringify(completed)).not.toContain('consumedSpatialEffects')
  expect(JSON.stringify(completed)).not.toContain('frozenGraph')
  await expect(plan.publish()).resolves.toEqual({
    ...completed,
    replayed: true
  })
  // Settled decisions are no longer routable.
  await expect(
    planMovementDecisionInRoom(value.additionalPlayer.caller, {
      ...answer,
      commandId: crypto.randomUUID()
    })
  ).rejects.toThrow()
  expect(await records(value)).toEqual(after)
}, 60_000)

it('continues Automatic same-contact hazards after a failed Concentration cleanup', async () => {
  const random = vi.mocked(rollRandom.nextRollInt)
  random.mockReset()
  random.mockReturnValue(0)
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
  await refreshMovementSaveVision(value)
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  const before = await records(value)
  const prepared = await planStagedMovementInRoom(value.owner.caller, value.saveId)
  expect(prepared.outcome.kind).toBe('PENDING')
  if (prepared.outcome.kind !== 'PENDING') throw new Error('Expected the later reaction choice.')
  const context = prepared.outcome.pendingSnapshot.applicationContext
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
  expect(random).toHaveBeenCalledTimes(1)
  expect(await records(value)).toEqual(before)

  const published = await prepared.publish()
  const after = await records(value)
  expect(published.occurrence?.pending).toMatchObject({ kind: 'MOVEMENT_REACTION' })
  expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
  expect(after.characterEffects.map((effect) => effect.id)).toEqual([seeded.independent.id])
  expect(random).toHaveBeenCalledTimes(1)
  await expect(prepared.publish()).resolves.toEqual({
    ...published,
    replayed: true
  })
  expect(random).toHaveBeenCalledTimes(1)
  expect(await records(value)).toEqual(after)
}, 60_000)

it.each(['room', 'private'] as const)(
  'keeps the Assisted Concentration child sealed under one movement root via %s',
  async (route) => {
    const authSecret = 'private-concentration-child-continuation-secret-at-least-32-bytes'
    if (route === 'private') vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
    const value = await setupAutomaticCharacterMovement(['AUTOMATIC'])
    const seeded = await installConcentration(value)
    await setAutoRollDice(value.base.t, value.base.owner.userId, false)
    // The mover's Concentration check is its controller's roll.
    await setAutoRollDice(value.base.t, value.player.userId, false)
    await refreshMovementSaveVision(value)
    // The GM uses the authored automatic reaction; its dice pause as evidence.
    const used = await useMovementReactions(value)
    const actionEvidence = (await used.publish()).occurrence?.pending
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
    await expect(planMovementDecisionInRoom(value.player.caller, action)).rejects.toThrow()
    let answer = action
    let pending: PendingEncounterRuleOccurrenceSummaryDto | null | undefined
    for (;;) {
      pending = (await (await planMovementDecisionInRoom(value.owner.caller, answer)).publish())
        .occurrence?.pending
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
    if (!root?.pendingSnapshotJson) throw new Error('Movement Concentration root is unavailable.')
    const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(
      JSON.parse(root.pendingSnapshotJson)
    )
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
    let completed: SceneGeometryCommandResult
    let beforeFinish: Awaited<ReturnType<typeof records>>
    let republish: (() => Promise<SceneGeometryCommandResult>) | null = null
    let privateCommit:
      | Awaited<ReturnType<typeof preparePrivateMovementResponse>>['commitInput']
      | null = null
    const moverHitPoints = async () =>
      value.base.t.run(async (ctx) => {
        const character = await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', value.base.character.id))
          .unique()
        if (!character) throw new Error('Movement Concentration target Character is unavailable.')
        return characterAuthoredDtoSchema.parse(JSON.parse(character.documentJson)).state.hitpoints
          .current
      })
    const damagedHitPoints = await moverHitPoints()
    if (route === 'private') {
      vi.stubEnv('LIVE_SESSION_WORKER_SECRET', privateMovementWorkerSecret)
      const epoch = crypto.randomUUID()
      await value.base.t.run((ctx) =>
        insertActiveLiveAuthority(ctx, {
          campaignId: value.base.campaign.id,
          epoch,
          createdAt: value.base.campaign.createdAt
        })
      )
      const denied = await value.owner.caller.fetch('/live-sessions/encounter-movement-stage', {
        method: 'POST',
        headers: { 'x-artificer-live-session-secret': privateMovementWorkerSecret },
        body: JSON.stringify({
          campaignId: value.base.campaign.id,
          authorityEpoch: epoch,
          expectedUserId: value.player.userId,
          expectedRole: 'PLAYER',
          command: concentration,
          characterRevisions: [],
          tokenOrdinals: [],
          maintenanceDefinitionIds: [],
          cachedSystem: null
        })
      })
      expect(denied.status).toBe(409)
      expect(await records(value)).toEqual(staged)
      const assignment = await value.base.t.run(async (ctx) =>
        ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', value.base.campaign.id).eq('userId', value.player.userId)
          )
          .unique()
      )
      if (!assignment) throw new Error('Concentration controller assignment is unavailable.')
      await value.base.t.run((ctx) => ctx.db.delete(assignment._id))
      const revoked = await value.player.caller.fetch('/live-sessions/encounter-movement-stage', {
        method: 'POST',
        headers: { 'x-artificer-live-session-secret': privateMovementWorkerSecret },
        body: JSON.stringify({
          campaignId: value.base.campaign.id,
          authorityEpoch: epoch,
          expectedUserId: value.player.userId,
          expectedRole: 'PLAYER',
          command: concentration,
          characterRevisions: [],
          tokenOrdinals: [],
          maintenanceDefinitionIds: [],
          cachedSystem: null
        })
      })
      expect(revoked.status).toBe(422)
      expect(await revoked.json()).toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
      expect(await records(value)).toEqual(staged)
      await value.base.t.run((ctx) => {
        const { _id: _assignmentId, _creationTime: _assignmentTime, ...saved } = assignment
        return ctx.db.insert('campaignCharacterAssignments', saved)
      })
      const prepared = await preparePrivateMovementResponse({
        value,
        caller: value.player.caller,
        userId: value.player.userId,
        role: 'PLAYER',
        epoch,
        authSecret,
        command: concentration
      })
      expect(prepared.planned.outcome.kind).toBe('TERMINAL')
      expect(prepared.planned.settlementInputs.map((step) => step.kind)).toEqual(['CONCENTRATION'])
      privateCommit = prepared.commitInput
      beforeFinish = await records(value)
      expect(beforeFinish).toEqual(staged)
      const committed = await callLiveSessionRoute(
        privateMovementEnvironment,
        'fixture-access-token',
        'encounterMovementCommit',
        privateCommit
      )
      completed = committed.scene
    } else {
      beforeFinish = await records(value)
      const plan = await planMovementDecisionInRoom(value.player.caller, concentration)
      expect(plan.outcome.kind).toBe('TERMINAL')
      expect(await records(value)).toEqual(beforeFinish)
      republish = plan.publish
      completed = await plan.publish()
    }
    const after = await records(value)
    expect(await moverHitPoints()).toBe(damagedHitPoints)
    const childOccurrenceId = concentrationOccurrenceId(
      root.id,
      context.phase.concentration.application
    )
    expect(after.occurrences.map((occurrence) => occurrence.id).sort()).toEqual(
      [root.id, childOccurrenceId].sort()
    )
    expect(
      after.occurrences.find((occurrence) => occurrence.id === childOccurrenceId)
    ).toMatchObject({
      state: 'COMPLETED',
      pendingSnapshotJson: null,
      rootCommandId: concentrationCommandId(childOccurrenceId)
    })
    expect(after.receipts).toEqual(expect.arrayContaining(staged.receipts))
    const child = after.receipts.find(
      (entry) => entry.commandId === concentrationCommandId(childOccurrenceId)
    )
    if (!child) throw new Error('Movement Concentration child receipt is unavailable.')
    expect(child.actorUserId).toBe(value.player.userId)
    expect(staged.receipts.some((entry) => entry.commandId === child.commandId)).toBe(false)
    expect(after.receipts.filter((entry) => entry.commandId === child.commandId)).toHaveLength(1)
    expect(after.maintained.map((state) => state.id)).not.toContain(seeded.state.id)
    expect(after.characterEffects.map((effect) => effect.id)).toEqual([seeded.independent.id])
    expect(after.occurrences.find((occurrence) => occurrence.id === root.id)).toMatchObject({
      state: 'COMPLETED'
    })
    if (privateCommit)
      await expect(
        callLiveSessionRoute(
          privateMovementEnvironment,
          'fixture-access-token',
          'encounterMovementCommit',
          privateCommit
        )
      ).resolves.toMatchObject({ scene: { ...completed, replayed: true } })
    else
      await expect(republish?.()).resolves.toEqual({
        ...completed,
        replayed: true
      })
    expect(await records(value)).toEqual(after)
  },
  120_000
)
