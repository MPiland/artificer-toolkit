import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { joinCharacterPlay, readCharacterRow } from '../characters/stateDocuments'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  executeInRoom,
  planMovementDecisionInRoom,
  planMovementInRoom,
  readEncounterHistory
} from '../../tests/fixtures/liveSessionWorker'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import { readReceiptHeader, readReceiptHeaders } from '../lib/receiptLedgers'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: (sides: number) => (sides === 20 ? 14 : 0) }))

const activeState = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSessionStateDto
>('encounters/activeReads:active')

it.each(['ROOT', 'RESPONSE'] as const)(
  // Assisted play offers each authored automatic reaction as Use/Decline, so a used reaction's
  // Character mutation publishes with the response that continues the movement to the next choice.
  'publishes a used automatic Character mutation at the next choice after a %s choice, atomically and once',
  async (stage) => {
    const value = await setupAutomaticCharacterMovement(
      stage === 'ROOT' ? ['AUTOMATIC', 'CHOICE'] : ['CHOICE', 'AUTOMATIC', 'CHOICE']
    )
    const snapshot = () =>
      value.base.t.run(async (ctx) => ({
        characters: await Promise.all(
          (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
        ),
        characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        commands: await (await readEncounterHistory(ctx)).query('encounterRunCommands').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        receiptHeaders: await (await readEncounterHistory(ctx)).query('encounterRuleReceipts').collect(),
        receipts: await (await readEncounterHistory(ctx)).query('encounterRuleReceipts').collect(),
        scenes: await ctx.db.query('campaignScenes').collect(),
        liveStates: await ctx.db.query('sceneLiveStates').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
        fog: await ctx.db.query('sceneFogLayers').collect()
      }))
    let commandId = value.rootInput.commandId
    const root = await planMovementInRoom(value.owner.caller, value.rootInput)
    let publish = root.publish
    const respond = async (resolution: 'DECLINE' | 'USE') => {
      const current = await publish()
      const pending = current.occurrence?.pending
      if (!pending || pending.kind !== 'MOVEMENT_REACTION' || !pending.choice.options[0])
        throw new Error('Expected a controller reaction choice.')
      commandId = crypto.randomUUID()
      const plan = await planMovementDecisionInRoom(value.owner.caller, {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId,
        encounterId: value.base.run.id,
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution:
          resolution === 'DECLINE'
            ? { kind: 'DECLINE' }
            : { kind: 'OPTION', optionId: pending.choice.options[0].optionId }
      })
      publish = plan.publish
      return plan
    }
    if (stage === 'RESPONSE') await respond('DECLINE')
    const plan = await respond('USE')
    const before = await snapshot()
    const beforeCharacter = before.characters.find((row) => row.id === value.base.character.id)!
    const beforeRun = before.runs.find((row) => row.id === value.base.run.id)!
    expect(plan.outcome.kind).toBe('PENDING')
    const result = await publish()
    expect(result.occurrence?.pending?.kind).toBe('MOVEMENT_REACTION')
    const after = await snapshot()
    expect(
      after.characters.find((row) => row.id === value.base.character.id)?.play.streamVersion
    ).toBe(beforeCharacter.play.streamVersion + 1)
    expect(after.characterReceipts.length).toBe(before.characterReceipts.length)
    expect(after.runs.find((row) => row.id === value.base.run.id)?.version).toBe(
      beforeRun.version + 1
    )
    expect(after.commands.length).toBe(before.commands.length + 1)
    const receipt = after.receipts.find((row) => row.commandId === commandId)!
    const stored = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (!('characterTransitions' in stored))
      throw new Error('Expected pending command transitions.')
    expect(stored.characterTransitions).toEqual([
      {
        characterId: value.base.character.id,
        beforeStreamVersion: beforeCharacter.play.streamVersion,
        afterStreamVersion: beforeCharacter.play.streamVersion + 1
      }
    ])
  },
  30_000
)

it('replays player movement with the original private projection before and after GM resolution', async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'])
  const rootInput = { ...value.rootInput, commandId: crypto.randomUUID() }
  const move = await planMovementInRoom(value.player.caller, rootInput)
  const initial = await move.publish()
  expect(initial.occurrence).toMatchObject({ status: 'PENDING', pending: null })
  const receipt = await value.owner.caller.run(async (ctx) => {
    const header = await (await readEncounterHistory(ctx))
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', value.base.run.id).eq('commandId', rootInput.commandId)
      )
      .unique()
    return header
  })
  if (!receipt) throw new Error('Expected retained owner movement receipt.')
  const retained = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (retained.status !== 'ENCOUNTER_OCCURRENCE_PENDING')
    throw new Error('Expected retained pending movement.')
  const pending = retained.occurrence.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected private GM reaction choice.')
  const replayMove = async () => (await planMovementInRoom(value.player.caller, rootInput)).publish()
  await expect(replayMove()).resolves.toEqual({ ...initial, replayed: true })
  const responseRequest = await planMovementDecisionInRoom(value.owner.caller, {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'DECLINE' }
  })
  const completed = await responseRequest.publish()
  expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const snapshot = () =>
    value.base.t.run(async (ctx) => ({
      characters: await Promise.all(
        (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
      ),
      characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
      runs: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      commands: await (await readEncounterHistory(ctx)).query('encounterRunCommands').collect(),
      occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      receiptHeaders: await (await readEncounterHistory(ctx)).query('encounterRuleReceipts').collect(),
      receipts: await (await readEncounterHistory(ctx)).query('encounterRuleReceipts').collect(),
      scenes: await ctx.db.query('campaignScenes').collect(),
      liveStates: await ctx.db.query('sceneLiveStates').collect(),
      entities: await ctx.db.query('sceneLiveEntities').collect(),
      sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
      geometrySaves: await ctx.db.query('sceneGeometrySaves').collect(),
      fog: await ctx.db.query('sceneFogLayers').collect()
    }))
  const beforeReplay = await snapshot()
  // The room replays the move's journaled result, not the decision's later settlement (D78).
  await expect(replayMove()).resolves.toEqual({ ...initial, replayed: true })
  expect(await snapshot()).toEqual(beforeReplay)
}, 30_000)

it("shows a player their own actor's turn movement against its Character walking speed (V07.5)", async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'])
  const moverId = value.base.mover.id
  const walkingSpeed = await value.base.t.run(
    async (ctx) => (await readCharacterRow(ctx, value.base.character.id))?.play.walkingSpeed
  )
  // The budget is the Character's stored walking speed.
  expect(walkingSpeed).toBeGreaterThan(0)
  // It is the player's Character's turn.
  const turn = await executeInRoom(value.owner.caller, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: value.base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: value.rootInput.expectedEncounterVersion
    }
  })
  expect(turn.projection.currentActorId).toBe(moverId)
  // One cell down stays in the reactor's reach, so no reaction interrupts the move.
  const move = await planMovementInRoom(value.player.caller, {
    ...value.rootInput,
    commandId: crypto.randomUUID(),
    expectedEncounterVersion: turn.projection.version,
    path: [
      { x: 150, y: 50 },
      { x: 150, y: 150 }
    ]
  })
  expect(move.outcome.kind).toBe('UNINTERRUPTED')
  await move.publish()
  const readout = async (member: typeof value.player) =>
    (await member.caller.query(activeState, { campaignId: value.base.campaign.id })).turnMovement
  // The player sees only the actor they control: one 5 ft cell against its walking speed.
  const mover = { actorId: moverId, used: 5, budget: walkingSpeed }
  expect(await readout(value.player)).toEqual([mover])
  const gm = await readout(value.owner)
  expect(gm).toContainEqual(mover)
  expect(gm.length).toBeGreaterThan(1)
}, 30_000)

it('moves an Encounter-bound token for its actor controllers, not its Scene token controllers', async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'], false, {}, true)
  const grantee = value.additionalPlayer
  const reactor = value.base.reactors[0]
  const reactorToken = value.tokens.find((token) => token.id === value.reactorTokenIds[0])
  if (!grantee || !reactor || !reactorToken) throw new Error('Expected the bound reactor token.')
  // The Scene lists the mover's player on the Creature token; they do not control its actor.
  await value.base.t.run(async (ctx) => {
    const row = (await ctx.db.query('sceneDefinitionEntities').collect()).find(
      (entity) => entity.entityId === reactorToken.id
    )
    if (!row || row.value.collection !== 'tokens') throw new Error('Missing reactor token entity.')
    const tokenValue = {
      ...row.value,
      entity: { ...row.value.entity, controlledByUserIds: [value.player.userId] }
    }
    await ctx.db.patch(row._id, { value: tokenValue, checksum: checksumCanonicalJson(tokenValue) })
  })
  const prepareMove = (
    member: { caller: typeof value.player.caller },
    expectedEncounterVersion: number
  ) =>
    planMovementInRoom(member.caller, {
      ...value.rootInput,
      commandId: crypto.randomUUID(),
      expectedEncounterVersion,
      tokenId: reactorToken.id,
      path: [reactorToken.position, { x: reactorToken.position.x, y: 450 }]
    })
  const setControllers = async (expectedVersion: number, controllerUserIds: string[]) =>
    (
      await executeInRoom(value.owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: value.base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion,
          actorId: reactor.id,
          controllerUserIds
        }
      })
    ).projection.version
  const refused = 'NOT_ACTOR_CONTROLLER'

  await expect(prepareMove(value.player, value.rootInput.expectedEncounterVersion)).rejects.toThrow(
    refused
  )
  const granted = await setControllers(value.rootInput.expectedEncounterVersion, [grantee.userId])
  expect((await prepareMove(grantee, granted)).outcome.kind).toBe('UNINTERRUPTED')
  const revoked = await setControllers(granted, [])
  await expect(prepareMove(grantee, revoked)).rejects.toThrow(refused)
}, 30_000)
