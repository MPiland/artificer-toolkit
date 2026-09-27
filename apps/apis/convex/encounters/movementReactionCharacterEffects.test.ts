import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { campaignCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID as UNCONSCIOUS } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { setupMovementReactionCharacterEffects } from '../../tests/fixtures/movementReactionCharacterEffects'
import {
  planMovementDecisionInRoom,
  planStagedMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({
  nextRollInt: (sides: number) => (sides === 20 ? 19 : 0)
}))

const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
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

async function snapshot(value: Awaited<ReturnType<typeof setupMovementReactionCharacterEffects>>) {
  return value.base.t.run(async (ctx) => ({
    character: await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.character.id))
      .unique(),
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
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId_version', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', value.base.run.id))
      .collect()
  }))
}

function conditionSources(value: Awaited<ReturnType<typeof snapshot>>) {
  if (!value.character || !value.campaignState)
    throw new Error('Character condition source records are unavailable.')
  return {
    sheet: characterAuthoredDtoSchema.parse(JSON.parse(value.character.documentJson)).state
      .conditions,
    campaign: campaignCharacterStateSchema.parse(JSON.parse(value.campaignState.documentJson))
      .conditions
  }
}

it('creates one Character reaction effect after the public choice and preserves Sheet and Campaign condition sources', async () => {
  const value = await setupMovementReactionCharacterEffects()

  await value.owner.caller.mutation(observe, {
    saveId: value.request.saveId,
    characterRevisions: []
  })
  const beforeRoot = await snapshot(value)
  expect(conditionSources(beforeRoot)).toEqual({
    sheet: [expect.objectContaining({ notes: 'Sheet condition survives reaction effect' })],
    campaign: [expect.objectContaining({ notes: 'Campaign condition survives reaction effect' })]
  })
  const preparedRoot = await planStagedMovementInRoom(value.owner.caller, value.saveId)
  expect(preparedRoot.outcome.kind).toBe('PENDING')
  expect(await snapshot(value)).toEqual(beforeRoot)

  const pendingRoot = await preparedRoot.publish()
  const pending = pendingRoot.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION' || !pending.choice.options[0])
    throw new Error('Expected public movement reaction choice.')
  const afterPending = await snapshot(value)
  expect(afterPending.effects).toEqual([])
  expect(conditionSources(afterPending)).toEqual(conditionSources(beforeRoot))
  await expect(preparedRoot.publish()).resolves.toEqual({
    ...pendingRoot,
    replayed: true
  })
  expect(await snapshot(value)).toEqual(afterPending)

  const reactionRequest = await planMovementDecisionInRoom(
    value.owner.caller,
    response(value.base.run.id, pending, pending.choice.options[0].optionId)
  )
  const beforeSettlement = await snapshot(value)
  const preparedReaction = { outcome: reactionRequest.outcome }
  expect(preparedReaction.outcome.kind).toBe('TERMINAL')
  expect(await snapshot(value)).toEqual(beforeSettlement)

  const settled = await reactionRequest.publish()
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
  expect(afterSettlement.character.streamVersion).toBe(beforeSettlement.character.streamVersion + 1)
  expect(afterSettlement.characterReceipts).toHaveLength(
    beforeSettlement.characterReceipts.length + 1
  )
  expect(afterSettlement.run.version).toBe(beforeSettlement.run.version + 1)
  expect(conditionSources(afterSettlement)).toEqual(conditionSources(beforeSettlement))

  await expect(reactionRequest.publish()).resolves.toEqual({
    ...settled,
    replayed: true
  })
  expect(await snapshot(value)).toEqual(afterSettlement)
}, 30_000)

it('projects the first used automatic Character reaction into the second reaction ordinal', async () => {
  const value = await setupMovementReactionCharacterEffects(true)
  await value.owner.caller.mutation(observe, {
    saveId: value.request.saveId,
    characterRevisions: []
  })
  const root = await planStagedMovementInRoom(value.owner.caller, value.saveId)
  // Assisted play offers the authored automatic reaction as Use/Decline; the GM uses it.
  const automatic = (await root.publish()).occurrence?.pending
  if (!automatic || automatic.kind !== 'MOVEMENT_REACTION' || !automatic.choice.options[0])
    throw new Error('Expected the automatic reaction Use/Decline choice.')
  const firstRequest = await planMovementDecisionInRoom(
    value.owner.caller,
    response(value.base.run.id, automatic, automatic.choice.options[0].optionId)
  )
  const beforeRoot = await snapshot(value)
  const preparedRoot = { outcome: firstRequest.outcome }
  expect(preparedRoot.outcome.kind).toBe('PENDING')
  expect(await snapshot(value)).toEqual(beforeRoot)

  const pendingRoot = await firstRequest.publish()
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
  expect(afterFirstReaction.character.streamVersion).toBe(beforeRoot.character.streamVersion + 1)
  expect(afterFirstReaction.characterReceipts).toHaveLength(beforeRoot.characterReceipts.length + 1)
  expect(afterFirstReaction.run.version).toBe(beforeRoot.run.version + 1)
  expect(conditionSources(afterFirstReaction)).toEqual(conditionSources(beforeRoot))
  await expect(firstRequest.publish()).resolves.toEqual({
    ...pendingRoot,
    replayed: true
  })
  expect(await snapshot(value)).toEqual(afterFirstReaction)

  const secondRequest = await planMovementDecisionInRoom(
    value.owner.caller,
    response(value.base.run.id, pending, pending.choice.options[0].optionId)
  )
  const beforeSecondReaction = await snapshot(value)
  const preparedSecond = { outcome: secondRequest.outcome }
  expect(preparedSecond.outcome.kind).toBe('TERMINAL')
  expect(await snapshot(value)).toEqual(beforeSecondReaction)

  const settled = await secondRequest.publish()
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const afterSecondReaction = await snapshot(value)
  if (!afterSecondReaction.character || !afterSecondReaction.run)
    throw new Error('Second Character reaction records are unavailable.')
  expect(afterSecondReaction.effects).toMatchObject([
    { characterId: value.base.character.id, createdOrdinal: 1 },
    { characterId: value.base.character.id, createdOrdinal: 2 }
  ])
  expect(afterSecondReaction.character.streamVersion).toBe(beforeRoot.character.streamVersion + 2)
  expect(afterSecondReaction.characterReceipts).toHaveLength(
    beforeRoot.characterReceipts.length + 2
  )
  expect(afterSecondReaction.run.version).toBe(afterFirstReaction.run.version + 1)
  // The second hit drops the Character to 0, so it falls unconscious (D63).
  const beforeSources = conditionSources(beforeRoot)
  expect(conditionSources(afterSecondReaction)).toEqual({
    ...beforeSources,
    sheet: [...(beforeSources.sheet ?? []), { conditionTypeId: UNCONSCIOUS }]
  })
  await expect(secondRequest.publish()).resolves.toEqual({
    ...settled,
    replayed: true
  })
  expect(await snapshot(value)).toEqual(afterSecondReaction)
}, 30_000)
