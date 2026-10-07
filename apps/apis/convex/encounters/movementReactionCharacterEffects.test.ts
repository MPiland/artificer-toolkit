import { expect, it } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { campaignCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID as UNCONSCIOUS } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { setupMovementReactionCharacterEffects } from '../../tests/fixtures/movementReactionCharacterEffects'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

/** A natural 20, then 1s: the reaction hits and every later die stays minimal (queued values are zero-based). */
const hitThenMinimumDice = { rolls: [19], repeat: 0 }

function response(
  encounterId: string,
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  optionId: string
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId,
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'OPTION', optionId }
  }
}

/** Convex's rows after the room checkpoints what it holds (a Run's state and history are the room's until then, D85). */
async function snapshot(value: Awaited<ReturnType<typeof setupMovementReactionCharacterEffects>>) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    character: await readCharacterRow(ctx, value.base.character.id),
    campaignState: await ctx.db
      .query('campaignCharacterStates')
      .withIndex('by_campaignId_characterId', (q) =>
        q.eq('campaignId', value.base.campaign.id).eq('characterId', value.base.character.id)
      )
      .unique(),
    effects: await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) =>
        q.eq('characterId', value.base.character.id)
      )
      .collect(),
    characterReceipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', value.base.character.id))
      .collect(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', value.base.run.id))
      .collect()
    // The Run's command rows and rule receipts are held by the room (D85), so Convex has none to
    // compare; they are asserted room-side in `apps/session-worker/test`.
  }))
}

function conditionSources(value: Awaited<ReturnType<typeof snapshot>>) {
  if (!value.character || !value.campaignState)
    throw new Error('Character condition source records are unavailable.')
  return {
    sheet: readCharacterRecord(value.character).state.conditions,
    campaign: campaignCharacterStateSchema.parse(JSON.parse(value.campaignState.documentJson))
      .conditions
  }
}

it('creates one Character reaction effect after the public choice and preserves Sheet and Campaign condition sources', async () => {
  const value = await setupMovementReactionCharacterEffects()

  const beforeRoot = await snapshot(value)
  expect(conditionSources(beforeRoot)).toEqual({
    sheet: [expect.objectContaining({ notes: 'Sheet condition survives reaction effect' })],
    campaign: [expect.objectContaining({ notes: 'Campaign condition survives reaction effect' })]
  })
  await queueRoomRolls(value.base.campaign.id, hitThenMinimumDice)
  // The real room plans and commits a move in one step: the root's result is the pending choice
  // (the planner's PENDING outcome), and the reaction's result below is its terminal outcome.
  const pendingRoot = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
  const pending = pendingRoot?.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION' || !pending.choice.options[0])
    throw new Error('Expected public movement reaction choice.')
  const afterPending = await snapshot(value)
  expect(afterPending.effects).toEqual([])
  expect(conditionSources(afterPending)).toEqual(conditionSources(beforeRoot))

  const reaction = response(value.base.run.id, pending, pending.choice.options[0].optionId)
  const beforeSettlement = afterPending
  const settled = await executeInRoom(value.owner.caller, { command: reaction })
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const afterSettlement = await snapshot(value)
  if (
    !beforeSettlement.character ||
    !afterSettlement.character ||
    !beforeSettlement.run ||
    !afterSettlement.run
  )
    throw new Error('Character reaction settlement records are unavailable.')
  expect(afterSettlement.effects).toHaveLength(1)
  expect(afterSettlement.effects[0]).toMatchObject({
    characterId: value.base.character.id,
    sourceEncounterId: value.base.run.id,
    createdOrdinal: 1
  })
  expect(afterSettlement.character.play.streamVersion).toBe(
    beforeSettlement.character.play.streamVersion + 1
  )
  expect(afterSettlement.characterReceipts).toHaveLength(beforeSettlement.characterReceipts.length)
  expect(afterSettlement.run.version).toBe(beforeSettlement.run.version + 1)
  expect(conditionSources(afterSettlement)).toEqual(conditionSources(beforeSettlement))

  const retried = await executeInRoom(value.owner.caller, { command: reaction })
  expect(retried.occurrence).toMatchObject({
    occurrenceId: settled.occurrence?.occurrenceId,
    status: 'COMPLETE',
    pending: null
  })
  expect(await snapshot(value)).toEqual(afterSettlement)
}, 30_000)

it('projects the first used automatic Character reaction into the second reaction ordinal', async () => {
  const value = await setupMovementReactionCharacterEffects(true)
  // Assisted play offers the authored automatic reaction as Use/Decline; the GM uses it.
  const automatic = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
    ?.occurrence?.pending
  if (!automatic || automatic.kind !== 'MOVEMENT_REACTION' || !automatic.choice.options[0])
    throw new Error('Expected the automatic reaction Use/Decline choice.')
  const first = response(value.base.run.id, automatic, automatic.choice.options[0].optionId)
  const beforeRoot = await snapshot(value)
  // Each Use draws its own attack: a natural 20, then minimal damage dice.
  await queueRoomRolls(value.base.campaign.id, hitThenMinimumDice)
  // The first Use's result is the second reaction's pending choice (the planner's PENDING outcome).
  const pendingRoot = await executeInRoom(value.owner.caller, { command: first })
  const pending = pendingRoot.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION' || !pending.choice.options[0])
    throw new Error('Expected second movement reaction choice.')
  const afterFirstReaction = await snapshot(value)
  if (
    !beforeRoot.character ||
    !afterFirstReaction.character ||
    !beforeRoot.run ||
    !afterFirstReaction.run
  )
    throw new Error('First Character reaction records are unavailable.')
  expect(afterFirstReaction.effects).toMatchObject([{ createdOrdinal: 1 }])
  expect(afterFirstReaction.character.play.streamVersion).toBe(
    beforeRoot.character.play.streamVersion + 1
  )
  expect(afterFirstReaction.characterReceipts).toHaveLength(beforeRoot.characterReceipts.length)
  expect(afterFirstReaction.run.version).toBe(beforeRoot.run.version + 1)
  expect(conditionSources(afterFirstReaction)).toEqual(conditionSources(beforeRoot))
  const retriedFirst = await executeInRoom(value.owner.caller, { command: first })
  expect(retriedFirst.occurrence).toMatchObject({
    occurrenceId: pendingRoot.occurrence?.occurrenceId,
    status: 'PENDING'
  })
  expect(await snapshot(value)).toEqual(afterFirstReaction)

  const second = response(value.base.run.id, pending, pending.choice.options[0].optionId)
  await queueRoomRolls(value.base.campaign.id, hitThenMinimumDice)
  const settled = await executeInRoom(value.owner.caller, { command: second })
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const afterSecondReaction = await snapshot(value)
  if (!afterSecondReaction.character || !afterSecondReaction.run)
    throw new Error('Second Character reaction records are unavailable.')
  expect(afterSecondReaction.effects).toMatchObject([
    { characterId: value.base.character.id, createdOrdinal: 1 },
    { characterId: value.base.character.id, createdOrdinal: 2 }
  ])
  expect(afterSecondReaction.character.play.streamVersion).toBe(
    beforeRoot.character.play.streamVersion + 2
  )
  expect(afterSecondReaction.characterReceipts).toHaveLength(beforeRoot.characterReceipts.length)
  expect(afterSecondReaction.run.version).toBe(afterFirstReaction.run.version + 1)
  // The second hit drops the Character to 0, so it falls unconscious (D63).
  const beforeSources = conditionSources(beforeRoot)
  expect(conditionSources(afterSecondReaction)).toEqual({
    ...beforeSources,
    sheet: [...(beforeSources.sheet ?? []), { conditionTypeId: UNCONSCIOUS }]
  })
  const retriedSecond = await executeInRoom(value.owner.caller, { command: second })
  expect(retriedSecond.occurrence).toMatchObject({
    occurrenceId: settled.occurrence?.occurrenceId,
    status: 'COMPLETE',
    pending: null
  })
  expect(await snapshot(value)).toEqual(afterSecondReaction)
}, 30_000)
