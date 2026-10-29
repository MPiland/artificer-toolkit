import {
  createConvexEncounterStore,
  createConvexEncounterStoreReader
} from '../lib/convexEncounterStore'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod/mini'
import type { leaveCampaignInputSchema } from '@artificer-toolkit/schema/api/campaignCore'
import {
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  domainRejection,
  playerControlFixture,
  setActorControllers,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import {
  readEncounterActorControl,
  readEncounterControlledActorIds,
  requireBoundTokenMoveControl
} from '@artificer-toolkit/encounter-persistence/actorController'
import {
  readRunActor,
  readRunState,
  replaceRunActor
} from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import {
  checkpointLiveRoom,
  executeInRoom,
  invalidateRoomInputs,
  RoomCommandRefusal,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { encounterReadTransaction } from './encounterReadPorts'

const leaveCampaign = makeFunctionReference<
  'mutation',
  z.input<typeof leaveCampaignInputSchema>,
  { ok: true }
>('campaigns/membershipDeparture:leave')

type Member = { userId: string }

const readProjection = makeFunctionReference<
  'query',
  { encounterId: string },
  EncounterCommandResultDto['projection']
>('encounters/projectionReads:get')

/** Each member's control of each actor, read through the one predicate. */
async function controlMatrix(base: PlayerControlFixture, members: Record<string, Member>) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!campaign || !row) throw new Error('Missing player control Campaign or Run.')
    const state = readRunState(row)
    const matrix: Record<string, Record<string, string | null>> = {}
    for (const [name, member] of Object.entries(members)) {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', member.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing player control membership.')
      matrix[name] = {}
      for (const [label, actorId] of [
        ['character', base.character.id],
        ['companion', base.companion.id],
        ['enemy', base.enemy.id]
      ] as const) {
        const actor = await readRunActor(
          { db: createConvexEncounterStoreReader(ctx) },
          state,
          actorId
        )
        matrix[name]![label] = await readEncounterActorControl(encounterReadTransaction(ctx), {
          campaign,
          membership,
          actor
        })
      }
      const controlled = await readEncounterControlledActorIds(encounterReadTransaction(ctx), {
        campaign,
        membership,
        actors: await Promise.all(
          state.actorIds.map((id) =>
            readRunActor({ db: createConvexEncounterStoreReader(ctx) }, state, id)
          )
        )
      })
      expect(
        Object.entries(matrix[name]!)
          .filter(([, control]) => control !== null)
          .map(([label]) => base[label as 'character' | 'companion' | 'enemy'].id)
          .sort()
      ).toEqual([...controlled].filter((id) => id !== base.lurker.id).sort())
    }
    return matrix
  })
}

function gmProjection(result: EncounterCommandResultDto) {
  return encounterGmProjectionDtoSchema.parse(result.projection)
}

function expectPlayerProjection(result: EncounterCommandResultDto, hiddenActorId: string) {
  const projection = encounterPlayerProjectionDtoSchema.parse(result.projection)
  expect(projection).toEqual(result.projection)
  expect(projection.actors.map((actor) => actor.id)).not.toContain(hiddenActorId)
  for (const actor of projection.actors) {
    expect(actor).not.toHaveProperty('healthBand')
    expect(actor).not.toHaveProperty('gmNotes')
    expect(actor).not.toHaveProperty('statBlock')
    expect(actor).not.toHaveProperty('resources')
    expect(actor).not.toHaveProperty('currentHitPoints')
  }
  return projection
}

async function hide(base: PlayerControlFixture, actorId: string) {
  await base.gm({
    type: 'UPDATE_ACTOR',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version(),
    actorId,
    public: false
  })
}

describe('Encounter actor control', () => {
  useLocalRoomWorker()

  it('answers GM, assigned player, granted controller, other player and departed member', async () => {
    const base = await playerControlFixture()
    const members = { gm: base.owner, player: base.player, other: base.other }
    expect(await controlMatrix(base, members)).toEqual({
      gm: { character: 'GM', companion: 'GM', enemy: 'GM' },
      player: { character: 'CONTROLLER', companion: null, enemy: null },
      other: { character: null, companion: null, enemy: null }
    })

    // Only current players may be granted control, as a sorted list of unique user IDs.
    await expect(setActorControllers(base, base.companion.id, [base.owner.userId])).rejects.toThrow(
      RoomCommandRefusal
    )
    await expect(
      setActorControllers(base, base.companion.id, [crypto.randomUUID()])
    ).rejects.toThrow(RoomCommandRefusal)
    const controllers = [base.other.userId, base.player.userId].sort()
    await expect(
      setActorControllers(base, base.companion.id, [...controllers].reverse())
    ).rejects.toThrow('Actor controllers must be unique and sorted.')
    const granted = await setActorControllers(base, base.companion.id, controllers)
    expect(
      gmProjection(granted).actors.find((actor) => actor.id === base.companion.id)
        ?.controllerUserIds
    ).toEqual(controllers)
    await expect(
      executeInRoom(base.other.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: await base.version(),
          actorId: base.enemy.id,
          controllerUserIds: [base.other.userId]
        }
      })
    ).rejects.toThrow()
    expect(await controlMatrix(base, members)).toEqual({
      gm: { character: 'GM', companion: 'GM', enemy: 'GM' },
      player: { character: 'CONTROLLER', companion: 'CONTROLLER', enemy: null },
      other: { character: null, companion: 'CONTROLLER', enemy: null }
    })

    // A departing member stops controlling every open Run actor.
    const campaign = await base.t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
    )
    if (!campaign) throw new Error('Missing player control Campaign.')
    await base.other.caller.mutation(leaveCampaign, {
      campaignId: base.campaign.id,
      expectedCampaignVersion: campaign.version,
      expectedMembershipAccessStartedAt: base.campaign.createdAt,
      commandId: crypto.randomUUID()
    })
    // Convex's scheduler sends the room this notice; convex-test runs none.
    await invalidateRoomInputs(base.campaign.id, ['CAMPAIGN'])
    await checkpointLiveRoom(base.campaign.id)
    const projection = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!row) throw new Error('Missing player control Run.')
      return {
        projection: await readEncounterGmProjection(
          encounterReadTransaction(ctx),
          readRunState(row)
        ),
        companion: await readRunActor(
          { db: createConvexEncounterStoreReader(ctx) },
          readRunState(row),
          base.companion.id
        )
      }
    })
    expect(projection.companion.controllerUserIds).toEqual([base.player.userId])
    expect(
      projection.projection.actors.find((actor) => actor.id === base.companion.id)
        ?.controllerUserIds
    ).toEqual([base.player.userId])
  })

  it("derives an owned actor's control from its owner, never from its own controller list", async () => {
    const base = await playerControlFixture()
    // The enemy is owned by the player's Character; no controller list names the player.
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!row) throw new Error('Missing player control Run.')
      const enemy = await readRunActor(
        { db: createConvexEncounterStoreReader(ctx) },
        readRunState(row),
        base.enemy.id
      )
      await replaceRunActor({ db: createConvexEncounterStore(ctx) }, enemy, {
        ...enemy,
        owner: { ownerActorId: base.character.id }
      })
    })
    const controlOf = (member: Member) =>
      base.t.run(async (ctx) => {
        const [campaign, row, membership] = await Promise.all([
          ctx.db
            .query('campaigns')
            .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
            .unique(),
          ctx.db
            .query('encounterRuns')
            .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
            .unique(),
          ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_userId', (q) =>
              q.eq('campaignId', base.campaign.id).eq('userId', member.userId)
            )
            .unique()
        ])
        if (!campaign || !row || !membership) throw new Error('Missing player control setup.')
        const actor = await readRunActor(
          { db: createConvexEncounterStoreReader(ctx) },
          readRunState(row),
          base.enemy.id
        )
        expect(actor.controllerUserIds).toEqual([])
        return readEncounterActorControl(encounterReadTransaction(ctx), {
          campaign,
          membership,
          actor
        })
      })
    expect(await controlOf(base.owner)).toBe('GM')
    expect(await controlOf(base.player)).toBe('CONTROLLER')
    expect(await controlOf(base.other)).toBeNull()
  })

  it('refuses a point-origin target for an action that does not take a point', async () => {
    const base = await playerControlFixture()
    const command = await base.bite(base.companion.id, base.enemy.id, {
      target: {
        kind: 'POINT',
        sceneId: crypto.randomUUID(),
        expectedSceneVersion: 0,
        point: { x: 100, y: 100 }
      }
    })
    await expect(
      domainRejection(executeInRoom(base.owner.caller, { command }))
    ).resolves.toMatchObject({ reason: 'TARGET_UNAVAILABLE' })
  })

  it('lets a granted player act for the companion only on its turn against visible targets', async () => {
    const base = await playerControlFixture()
    await hide(base, base.lurker.id)
    const bite = (overrides = {}) => base.bite(base.companion.id, base.enemy.id, overrides)
    const act = (
      member: Pick<PlayerControlFixture['owner'], 'caller'>,
      command: Awaited<ReturnType<typeof bite>>
    ) => executeInRoom(member.caller, { command })

    // Nobody but the GM controls the companion yet.
    for (const member of [base.player, base.other])
      await expect(domainRejection(act(member, await bite()))).resolves.toMatchObject({
        reason: 'NOT_ACTOR_CONTROLLER'
      })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    await expect(
      domainRejection(act(base.other, await base.bite(base.companion.id, base.lurker.id)))
    ).resolves.toMatchObject({ reason: 'TARGET_UNAVAILABLE' })
    await expect(
      domainRejection(act(base.other, await base.bite(base.character.id, base.enemy.id)))
    ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })

    const command = await bite()
    const result = await act(base.other, command)
    expect(result.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
    const projection = expectPlayerProjection(result, base.lurker.id)
    expect(projection.actors.find((actor) => actor.id === base.companion.id)).toMatchObject({
      controllerUserIds: [base.other.userId],
      disposition: 'HOSTILE'
    })
    // The GM projection keeps health; the companion's fixed Bite dealt 1 damage.
    await checkpointLiveRoom(base.campaign.id)
    const enemy = encounterGmProjectionDtoSchema
      .parse(await base.owner.caller.query(readProjection, { encounterId: base.run.id }))
      .actors.find((actor) => actor.id === base.enemy.id)
    expect(enemy?.healthBand).toBeDefined()
    expect(enemy?.currentHitPoints).toBe(base.enemy.currentHitPoints - 1)

    // The issuer's retry replays its player projection; nobody else may reuse the command ID.
    await expect(act(base.other, command)).resolves.toEqual(result)
    await expect(act(base.owner, command)).rejects.toThrow(
      'The command ID was already used for different input.'
    )

    // The player ends the companion's turn, and then it is no longer theirs to act or end.
    const advanced = await executeInRoom(base.other.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await base.version()
      }
    })
    expectPlayerProjection(advanced, base.lurker.id)
    expect(advanced.projection.currentActorId).toBe(base.character.id)
    await expect(
      domainRejection(
        executeInRoom(base.other.caller, {
          command: {
            type: 'ADVANCE_TURN',
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: await base.version()
          }
        })
      )
    ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
    await expect(domainRejection(act(base.other, await bite()))).resolves.toMatchObject({
      reason: 'NOT_CURRENT_ACTOR'
    })

    // Revoking control refuses the next action even on the companion's turn.
    await setActorControllers(base, base.companion.id, [])
    await expect(domainRejection(act(base.other, await bite()))).resolves.toMatchObject({
      reason: 'NOT_ACTOR_CONTROLLER'
    })
  })

  it('lets the assigned player end their Character turn but not the GM-only commands', async () => {
    const base = await playerControlFixture()
    await hide(base, base.lurker.id)
    const advance = async (member: PlayerControlFixture['player']) =>
      executeInRoom(member.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: await base.version()
        }
      })
    await expect(domainRejection(advance(base.player))).resolves.toMatchObject({
      reason: 'NOT_ACTOR_CONTROLLER'
    })
    await advance(base.owner)
    const ended = await advance(base.player)
    expectPlayerProjection(ended, base.lurker.id)
    expect(ended.projection.currentActorId).toBe(base.enemy.id)
    await expect(
      executeInRoom(base.player.caller, {
        command: {
          type: 'SET_ROUND',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: await base.version(),
          round: 3
        }
      })
    ).rejects.toMatchObject({
      data: { reason: 'GM_ONLY', message: 'Only the GM can do that.' }
    })
  })

  it('defaults dispositions by actor kind and lets only the GM change them', async () => {
    const base = await playerControlFixture()
    const update = async (member: Pick<PlayerControlFixture['owner'], 'caller'>) =>
      executeInRoom(member.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: await base.version(),
          actorId: base.enemy.id,
          disposition: 'NEUTRAL'
        }
      })
    expect(
      Object.fromEntries(base.run.actors.map((actor) => [actor.id, actor.disposition]))
    ).toEqual({
      [base.character.id]: 'FRIENDLY',
      [base.companion.id]: 'HOSTILE',
      [base.enemy.id]: 'HOSTILE',
      [base.lurker.id]: 'HOSTILE'
    })
    await expect(update(base.player)).rejects.toMatchObject({
      data: { reason: 'GM_ONLY' }
    })
    expect(
      gmProjection(await update(base.owner)).actors.find((actor) => actor.id === base.enemy.id)
        ?.disposition
    ).toBe('NEUTRAL')
  })

  it('moves an Encounter-bound token only for the bound actor controllers', async () => {
    const base = await playerControlFixture()
    const tokenId = crypto.randomUUID()
    await base.t.run((ctx) =>
      ctx.db.insert('encounterActorTokenBindings', {
        encounterId: base.run.id,
        sceneId: crypto.randomUUID(),
        actorId: base.companion.id,
        tokenId
      })
    )
    const canMove = async (member: Member) => {
      await checkpointLiveRoom(base.campaign.id)
      return base.t.run(async (ctx) => {
        const campaign = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique()
        const membership = await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('userId', member.userId)
          )
          .unique()
        if (!campaign || !membership) throw new Error('Missing token control membership.')
        return requireBoundTokenMoveControl(encounterReadTransaction(ctx), {
          campaign,
          membership,
          encounterId: base.run.id,
          tokenId
        }).then(
          () => true,
          (error: unknown) => {
            if (!(error instanceof Error) || !error.message.includes('NOT_ACTOR_CONTROLLER'))
              throw error
            return false
          }
        )
      })
    }
    expect([
      await canMove(base.owner),
      await canMove(base.player),
      await canMove(base.other)
    ]).toEqual([true, false, false])
    await setActorControllers(base, base.companion.id, [base.other.userId])
    expect([
      await canMove(base.owner),
      await canMove(base.player),
      await canMove(base.other)
    ]).toEqual([true, false, true])
    await setActorControllers(base, base.companion.id, [])
    expect(await canMove(base.other)).toBe(false)
  })
})
