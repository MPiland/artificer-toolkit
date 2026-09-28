import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type {
  SceneGeometryBeginResult,
  SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { api } from '../_generated/api'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  executeInRoom,
  insertActiveLiveAuthority,
  planMovementDecisionInRoom,
  planMovementInRoom,
  planStagedMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: (sides: number) => (sides === 20 ? 14 : 0) }))

const activeState = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSessionStateDto
>('encounters/activeReads:active')
const begin = makeFunctionReference<
  'mutation',
  SceneGeometryExecuteInput,
  SceneGeometryBeginResult
>('scenes/geometryStaging:begin')

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
        characters: await ctx.db.query('characters').collect(),
        characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        commands: await ctx.db.query('encounterRunCommands').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        scenes: await ctx.db.query('campaignScenes').collect(),
        liveStates: await ctx.db.query('sceneLiveStates').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
        fog: await ctx.db.query('sceneFogLayers').collect()
      }))
    let commandId = value.rootInput.commandId
    const root = await planStagedMovementInRoom(value.owner.caller, value.saveId)
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
    expect(after.characters.find((row) => row.id === value.base.character.id)?.streamVersion).toBe(
      beforeCharacter.streamVersion + 1
    )
    expect(after.characterReceipts.length).toBe(before.characterReceipts.length + 1)
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
        beforeStreamVersion: beforeCharacter.streamVersion,
        afterStreamVersion: beforeCharacter.streamVersion + 1
      }
    ])
    await expect(publish()).resolves.toMatchObject({
      replayed: true
    })
    await expect(root.publish()).resolves.toMatchObject({
      occurrence: { status: 'PENDING' },
      replayed: true
    })
    const readRootSave = () =>
      value.owner.caller.run((ctx) =>
        ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
          .unique()
      )
    const rootSave = await readRootSave()
    const vision = rootSave?.sessionVision
    if (!vision) throw new Error('Expected retained root presentation vision.')
    // With no room live, Convex refuses the bound move even as a retry (D43).
    await expect(
      value.owner.caller.mutation(begin, {
        input: value.rootInput,
        presentation: { expectedPresentationVersion: vision.expectedPresentationVersion }
      })
    ).rejects.toMatchObject({ data: { reason: 'SCENE_NOT_PRESENTED' } })
    expect(await readRootSave()).toEqual(rootSave)
    expect(await snapshot()).toEqual(after)
  },
  30_000
)

it('replays player movement with the original private projection before and after GM resolution', async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'])
  const rootInput = { ...value.rootInput, commandId: crypto.randomUUID() }
  const move = await planMovementInRoom(value.player.caller, rootInput)
  const initial = await move.publish()
  expect(initial.occurrence).toMatchObject({ status: 'PENDING', pending: null })
  const receipt = await value.owner.caller.run((ctx) =>
    ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', value.base.run.id).eq('commandId', rootInput.commandId)
      )
      .unique()
  )
  if (!receipt) throw new Error('Expected retained owner movement receipt.')
  const retained = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (retained.status !== 'ENCOUNTER_OCCURRENCE_PENDING')
    throw new Error('Expected retained pending movement.')
  const pending = retained.occurrence.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected private GM reaction choice.')
  await expect(move.publish()).resolves.toEqual({ ...initial, replayed: true })
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
      characters: await ctx.db.query('characters').collect(),
      characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
      runs: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      commands: await ctx.db.query('encounterRunCommands').collect(),
      occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
      receipts: await ctx.db.query('encounterRuleReceipts').collect(),
      scenes: await ctx.db.query('campaignScenes').collect(),
      liveStates: await ctx.db.query('sceneLiveStates').collect(),
      entities: await ctx.db.query('sceneLiveEntities').collect(),
      sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
      geometrySaves: await ctx.db.query('sceneGeometrySaves').collect(),
      fog: await ctx.db.query('sceneFogLayers').collect()
    }))
  const beforeReplay = await snapshot()
  const expected = { ...initial, occurrence: completed.occurrence, replayed: true }
  await expect(move.publish()).resolves.toEqual(expected)
  expect(await snapshot()).toEqual(beforeReplay)
}, 30_000)

it('refuses a bound move on a live Campaign Scene that is not presented (D42)', async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'])
  const rootSave = await value.owner.caller.run((ctx) =>
    ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
      .unique()
  )
  const vision = rootSave?.sessionVision
  if (!vision) throw new Error('Expected fixture presentation vision.')
  // The room is live and presents another Scene.
  await value.base.t.run(async (ctx) => {
    await insertActiveLiveAuthority(ctx, {
      campaignId: value.base.campaign.id,
      epoch: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    })
    const presented = await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', value.base.campaign.id))
      .unique()
    if (!presented) throw new Error('Expected the fixture Scene presentation.')
    await ctx.db.patch(presented._id, { sceneId: crypto.randomUUID() })
  })
  await expect(
    value.player.caller.mutation(begin, {
      input: { ...value.rootInput, commandId: crypto.randomUUID() },
      presentation: { expectedPresentationVersion: vision.expectedPresentationVersion }
    })
  ).rejects.toMatchObject({
    data: {
      code: 'DOMAIN_REJECTED',
      reason: 'SCENE_NOT_PRESENTED',
      message: 'Present this Scene to move Encounter tokens.'
    }
  })
}, 30_000)

it('refuses a bound move with no room live and still publishes an unbound move natively (D43)', async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'])
  const presentation = { expectedPresentationVersion: 0 }
  const reactorTokenId = value.reactorTokenIds[0]
  const reactorToken = value.tokens.find((token) => token.id === reactorTokenId)
  if (!reactorToken) throw new Error('Expected the fixture reactor token.')
  // Unbinding the reactor's token makes it a standalone Scene token.
  await value.base.t.run(async (ctx) => {
    const binding = await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_sceneId_tokenId', (q) =>
        q.eq('sceneId', value.sceneId).eq('tokenId', reactorToken.id)
      )
      .unique()
    if (!binding) throw new Error('Expected the reactor token binding.')
    await ctx.db.delete(binding._id)
  })
  const scene = () =>
    value.base.t.run(async (ctx) => ({
      saves: await ctx.db.query('sceneGeometrySaves').collect(),
      liveStates: await ctx.db.query('sceneLiveStates').collect(),
      entities: await ctx.db.query('sceneLiveEntities').collect(),
      commands: await ctx.db.query('sceneLiveCommands').collect()
    }))
  const before = await scene()
  await expect(
    value.player.caller.action(api.scenes.geometryActions.execute, {
      input: { ...value.rootInput, commandId: crypto.randomUUID() },
      presentation
    })
  ).rejects.toMatchObject({
    data: {
      code: 'DOMAIN_REJECTED',
      reason: 'SCENE_NOT_PRESENTED',
      message: 'Present this Scene to move Encounter tokens.'
    }
  })
  expect(await scene()).toEqual(before)
  const destination = { x: reactorToken.position.x, y: reactorToken.position.y + 300 }
  await expect(
    value.owner.caller.action(api.scenes.geometryActions.execute, {
      input: {
        ...value.rootInput,
        commandId: crypto.randomUUID(),
        expectedEncounterVersion: null,
        tokenId: reactorToken.id,
        path: [reactorToken.position, destination]
      },
      presentation
    })
  ).resolves.toMatchObject({
    version: 1,
    occurrence: null,
    delta: { kind: 'TOKEN_MOVED', tokenId: reactorToken.id, position: destination }
  })
}, 30_000)

it("shows a player their own actor's turn movement against its Character walking speed (V07.5)", async () => {
  const value = await setupAutomaticCharacterMovement(['CHOICE'])
  const moverId = value.base.mover.id
  const walkingSpeed = await value.base.t.run(
    async (ctx) =>
      (
        await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', value.base.character.id))
          .unique()
      )?.walkingSpeed
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
    const row = await ctx.db
      .query('sceneDefinitionEntities')
      .filter((q) => q.eq(q.field('entityId'), reactorToken.id))
      .unique()
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
