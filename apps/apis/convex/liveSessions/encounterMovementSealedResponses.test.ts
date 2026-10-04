import { readReceiptHeaders } from '../lib/receiptLedgers'
// @vitest-environment node
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import {
  planMovementDecisionInRoom,
  planMovementInRoom,
  readEncounterHistory
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

it('settles sealed movement responses through the room without replaying the crossed prefix', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 450, y: 50 }
    ]
  })
  const effect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 275, y: 50 },
    5
  )
  const records = () =>
    value.base.t.run(async (ctx) => ({
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
        .unique(),
      actors: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect(),
      effects: await ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_encounterId_sceneId_id', (q) =>
          q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
        )
        .collect(),
      receipts: await (await readEncounterHistory(ctx))
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', value.base.run.id))
        .collect(),
      commands: await (await readEncounterHistory(ctx))
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', value.base.campaign.id))
        .collect()
    }))
  const initialPreparation = await planMovementInRoom(value.owner.caller, value.rootInput)
  expect(initialPreparation.outcome.kind).toBe('PENDING')
  if (initialPreparation.outcome.kind !== 'PENDING')
    throw new Error('Expected movement choice pause.')
  const prefix = initialPreparation.outcome.pendingSnapshot.applicationContext
  if (
    prefix.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    prefix.appliedSpatialPrefix?.status !== 'BATCH_COMPLETE'
  )
    throw new Error('Expected a crossed spatial prefix before the choice.')
  const crossedEffects = prefix.appliedSpatialPrefix.executions.filter(
    (entry) => 'candidate' in entry
  )
  expect(crossedEffects.map((entry) => entry.candidate.candidate.effectId)).toContain(effect.id)
  const initial = await initialPreparation.publish()
  const choice = initial.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected a published movement choice.')
  expect((await records()).effects.map((entry) => entry.id)).not.toContain(effect.id)

  const baseline = await records()
  const appliedEffect = crossedEffects.find(
    (entry) => entry.candidate.candidate.effectId === effect.id
  )
  const baselineMover = baseline.actors.find((actor) => actor.id === value.base.mover.id)
  if (!appliedEffect || !baselineMover) throw new Error('Crossed movement effect is unavailable.')
  const baselineMoverState = encounterRunActorStateSchema.parse(JSON.parse(baselineMover.stateJson))
  if (baselineMoverState.kind === 'CHARACTER') throw new Error('Expected a non-Character mover.')
  expect(baselineMoverState.currentHitPoints).toBe(
    appliedEffect.targetTransition.after.currentHitPoints
  )
  const command: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
  }
  const used = await planMovementDecisionInRoom(value.owner.caller, command)
  expect(used.outcome.kind).toBe('PENDING')
  expect(await records()).toEqual(baseline)
  const committed = await used.publish()
  const after = await records()
  expect(committed.replayed).toBe(false)
  expect(committed.occurrence).toMatchObject({ status: 'PENDING' })
  expect(committed.delta).toBeNull()
  expect(after.run?.version).toBe(baseline.run!.version + 1)
  expect(after.effects).toEqual(baseline.effects)
  expect(after.receipts.length).toBeGreaterThan(baseline.receipts.length)
  expect(after.commands.length).toBeGreaterThan(baseline.commands.length)
  const secondChoice = committed.occurrence?.pending
  if (!secondChoice || secondChoice.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected the next issued movement choice.')
  const declined = await planMovementDecisionInRoom(value.owner.caller, {
    ...command,
    commandId: crypto.randomUUID(),
    expectedVersion: secondChoice.encounterVersion,
    occurrenceId: secondChoice.occurrenceId,
    expectedOccurrenceVersion: secondChoice.occurrenceVersion,
    resolution: { kind: 'DECLINE' }
  })
  expect(declined.outcome.kind).toBe('TERMINAL')
  expect(await records()).toEqual(after)
  const terminal = await declined.publish()
  const terminalRecords = await records()
  expect(terminal.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect(terminal.delta).toMatchObject({ kind: 'TOKEN_MOVED', tokenId: value.moverTokenId })
  expect(terminalRecords.effects).toEqual(after.effects)
  const moverHitPoints = (actors: typeof after.actors) => {
    const mover = actors.find((actor) => actor.id === value.base.mover.id)
    if (!mover) throw new Error('Movement target actor is unavailable.')
    const state = encounterRunActorStateSchema.parse(JSON.parse(mover.stateJson))
    if (state.kind === 'CHARACTER') throw new Error('Expected a non-Character mover.')
    return state.currentHitPoints
  }
  expect(moverHitPoints(terminalRecords.actors)).toBe(moverHitPoints(after.actors))
}, 120_000)
