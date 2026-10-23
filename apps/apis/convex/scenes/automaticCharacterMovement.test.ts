import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import { joinCharacterPlay, readCharacterRow } from '../characters/stateDocuments'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'

useLocalRoomWorker()

const activeState = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSessionStateDto
>('encounters/activeReads:active')

const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

type Setup = Awaited<ReturnType<typeof setupAutomaticCharacterMovement>>

/** Convex's rows, after the room checkpoints what it holds (a Run's history is the room's until then, D85). */
async function snapshot(value: Setup) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.t.run(async (ctx) => ({
    characters: await Promise.all(
      (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
    ),
    characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    scenes: await ctx.db.query('campaignScenes').collect(),
    liveStates: await ctx.db.query('sceneLiveStates').collect(),
    entities: await ctx.db.query('sceneLiveEntities').collect(),
    fog: await ctx.db.query('sceneFogLayers').collect()
  }))
}

async function readRunVersion(value: Setup) {
  const runs = (await snapshot(value)).runs
  const run = runs.find((row) => row.id === value.base.run.id)
  if (!run) throw new Error('Missing Run.')
  return run.version
}

it.each(['ROOT', 'RESPONSE'] as const)(
  // Assisted play offers each authored automatic reaction as Use/Decline, so a used reaction's
  // Character mutation commits with the response that continues the movement to the next choice.
  // The command's stored `characterTransitions` receipt is room-held history (D85), pinned in
  // apps/session-worker/test/nativeMovementEvidence.test.ts ("a used automatic Character mutation
  // at the next choice"). Here: the Character's stream version, the Run version and the room's
  // command rows, which are what a member sees.
  'commits a used automatic Character mutation at the next choice after a %s choice, atomically and once',
  async (stage) => {
    const value = await setupAutomaticCharacterMovement(
      stage === 'ROOT' ? ['AUTOMATIC', 'CHOICE'] : ['CHOICE', 'AUTOMATIC', 'CHOICE']
    )
    // The one Use draws an attack d20 (a 15) and two bite dice (the minimum); a Decline draws none.
    await queueRoomRolls(value.base.campaign.id, { rolls: [14, 0, 0], repeat: 0 })
    let current: Pick<Awaited<ReturnType<typeof executeInRoom>>, 'occurrence'> | null = (
      await executeSceneInRoom(value.owner.caller, value.rootInput)
    ).result
    const respond = async (resolution: 'DECLINE' | 'USE') => {
      const pending = current?.occurrence?.pending
      if (!pending || pending.kind !== 'MOVEMENT_REACTION' || !pending.choice.options[0])
        throw new Error('Expected a controller reaction choice.')
      return executeInRoom(value.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          commandId: crypto.randomUUID(),
          encounterId: value.base.run.id,
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          correlationId: null,
          resolution:
            resolution === 'DECLINE'
              ? { kind: 'DECLINE' }
              : { kind: 'OPTION', optionId: pending.choice.options[0].optionId }
        }
      })
    }
    if (stage === 'RESPONSE') current = await respond('DECLINE')
    const before = await snapshot(value)
    const beforeCharacter = before.characters.find((row) => row.id === value.base.character.id)!
    const beforeRun = before.runs.find((row) => row.id === value.base.run.id)!
    const commandsBefore = (await readRoomTimeline(value.owner.caller, value.base.campaign.id))
      .length
    const result = await respond('USE')
    expect(result.occurrence?.pending?.kind).toBe('MOVEMENT_REACTION')
    const after = await snapshot(value)
    // The Use is exactly one more command on the room's timeline.
    expect((await readRoomTimeline(value.owner.caller, value.base.campaign.id)).length).toBe(
      commandsBefore + 1
    )
    expect(
      after.characters.find((row) => row.id === value.base.character.id)?.play.streamVersion
    ).toBe(beforeCharacter.play.streamVersion + 1)
    expect(after.characterReceipts.length).toBe(before.characterReceipts.length)
    expect(after.runs.find((row) => row.id === value.base.run.id)?.version).toBe(
      beforeRun.version + 1
    )
  },
  30_000
)

it('replays player movement with the original private projection before and after GM resolution', async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'])
  // The GM declines the one reaction, so no die is drawn.
  await queueRoomRolls(value.base.campaign.id, { rolls: [], repeat: 0 })
  const rootInput = { ...value.rootInput, commandId: crypto.randomUUID() }
  const initial = await executeSceneInRoom(value.player.caller, rootInput)
  // The player sees the move pending, never the GM's reaction choice.
  expect(initial.result?.occurrence).toMatchObject({ status: 'PENDING', pending: null })
  await checkpointLiveRoom(value.base.campaign.id)
  const pending = await value.owner.caller.query(pendingRuleOccurrence, {
    encounterId: value.base.run.id
  })
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected private GM reaction choice.')
  const replayMove = () =>
    executeSceneInRoom(value.player.caller, rootInput, initial.expectedSessionSequence)
  const replayed = { ...initial, result: { ...initial.result, replayed: true } }
  await expect(replayMove()).resolves.toEqual(replayed)
  const completed = await executeInRoom(value.owner.caller, {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'DECLINE' }
    }
  })
  expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const beforeReplay = await snapshot(value)
  // The room replays the move's journaled result, not the decision's later settlement (D78).
  await expect(replayMove()).resolves.toEqual(replayed)
  expect(await snapshot(value)).toEqual(beforeReplay)
}, 30_000)

it("shows a player their own actor's turn movement against its Character walking speed (V07.5)", async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'])
  const moverId = value.base.mover.id
  const walk = SRD_SPEEDS.find((speed) => speed.code === 'WALK')!
  const walkingSpeed = await value.base.t.run(
    async (ctx) =>
      (await readCharacterRow(ctx, value.base.character.id))?.play.speeds.find(
        (speed) => speed.speedId === walk.id
      )?.amount
  )
  // The allowance is the Character's stored walking speed.
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
  const move = await executeSceneInRoom(value.player.caller, {
    ...value.rootInput,
    commandId: crypto.randomUUID(),
    expectedEncounterVersion: turn.projection.version,
    speedId: walk.id,
    path: [
      { x: 150, y: 50 },
      { x: 150, y: 150 }
    ]
  })
  expect(move.result?.occurrence ?? null).toBeNull()
  expect(move.result?.delta).toMatchObject({ kind: 'TOKEN_MOVED', position: { x: 150, y: 150 } })
  await checkpointLiveRoom(value.base.campaign.id)
  const readout = async (member: typeof value.player) =>
    (await member.caller.query(activeState, { campaignId: value.base.campaign.id })).turnMovement
  // The player sees only the actor they control: one 5 ft cell moved at its walking speed, which
  // is the allowance of its one speed type.
  const mover = {
    actorId: moverId,
    used: 5,
    speedId: walk.id,
    allowances: [
      { speedId: walk.id, code: 'WALK', isDefault: true, label: walk.label, budget: walkingSpeed }
    ],
    teleport: [],
    fleeSourceActorIds: []
  }
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
  let sceneVersion = value.rootInput.expectedSceneVersion
  let position = reactorToken.position
  const move = (member: { caller: typeof value.player.caller }, expectedEncounterVersion: number) =>
    executeSceneInRoom(member.caller, {
      ...value.rootInput,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: sceneVersion,
      expectedEncounterVersion,
      tokenId: reactorToken.id,
      path: [position, { x: position.x, y: position.y + 100 }]
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

  await expect(move(value.player, value.rootInput.expectedEncounterVersion)).rejects.toThrow(
    refused
  )
  const granted = await setControllers(value.rootInput.expectedEncounterVersion, [grantee.userId])
  const moved = await move(grantee, granted)
  // A Creature token's move by a non-Scene controller commits without a scene delta; the Scene
  // version advancing is what shows it moved.
  expect(moved.version).toBe(sceneVersion + 1)
  sceneVersion = moved.version
  position = { x: position.x, y: position.y + 100 }
  const revoked = await setControllers(await readRunVersion(value), [])
  await expect(move(grantee, revoked)).rejects.toThrow(refused)
}, 30_000)
