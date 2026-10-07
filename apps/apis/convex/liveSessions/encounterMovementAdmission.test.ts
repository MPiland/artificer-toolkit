import { expect, it } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createSpatialPreparationFixture,
  grantFixtureActorControl
} from '../../tests/fixtures/spatialPreparation'
import {
  attachFixtureRoom,
  executeSceneInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

type Fixture = Awaited<ReturnType<typeof createSpatialPreparationFixture>>

/** Rewrites the fixture Scene's tokens with lowercase ids, as the room's checkpoint orders them. */
function patchTokens(
  { base }: Pick<Fixture, 'base'>,
  patch: (ordinal: number) => {
    controlledByUserIds?: string[]
    locked?: boolean
  }
) {
  return base.t.run(async (ctx) => {
    const rows = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', base.saveId).eq('value.collection', 'tokens')
      )
      .collect()
    for (const row of rows) {
      if (row.value.collection !== 'tokens') throw new Error('Missing fixture token.')
      const entity = {
        ...row.value.entity,
        id: row.value.entity.id.toLowerCase(),
        ...patch(row.ordinal)
      }
      const value = { ...row.value, entity }
      await ctx.db.patch(row._id, {
        entityId: entity.id,
        value,
        checksum: checksumCanonicalJson(value)
      })
    }
  })
}

/** A bound two-actor Scene in which the player (`owner`) controls only the first actor's token. */
async function setup() {
  const fixture = await createSpatialPreparationFixture()
  const { base } = fixture
  const actorIds = base.run.actors.slice(0, 2).map((actor) => actor.id)
  if (actorIds.length !== 2) throw new Error('Missing fixture Encounter actors.')
  await base.t.run(async (ctx) => {
    for (const [index, actorId] of actorIds.entries())
      await ctx.db.insert('encounterActorTokenBindings', {
        encounterId: base.run.id,
        actorId,
        sceneId: base.sceneId,
        tokenId: base.tokens[index]!.id.toLowerCase()
      })
    // A bound token moves for its actor's controllers; grant the player the first actor.
    await grantFixtureActorControl(ctx, {
      encounterId: base.run.id,
      actorId: actorIds[0]!,
      controllerUserIds: [base.owner.userId]
    })
  })
  await patchTokens(fixture, (ordinal) =>
    ordinal === 0 ? { controlledByUserIds: [base.owner.userId] } : {}
  )
  await attachFixtureRoom(base.t, base.campaign.id)
  return fixture
}

it('lets a controlling player move their bound token but refuses a token bound to another actor', async () => {
  const { base, input } = await setup()
  await expect(
    executeSceneInRoom(base.owner.caller, {
      ...input,
      commandId: crypto.randomUUID(),
      tokenId: base.tokens[1]!.id.toLowerCase(),
      path: [base.tokens[1]!.position, { x: 10, y: 0 }]
    })
  ).rejects.toThrow('NOT_ACTOR_CONTROLLER')
  const move = await executeSceneInRoom(base.owner.caller, input)
  expect(move.version).toBe(1)
  // The baseline's UNINTERRUPTED plan outcome: no occurrence opened, a plain token move.
  expect(move.result).toMatchObject({ occurrence: null, replayed: false })
  expect(move.result?.delta).toMatchObject({ kind: 'TOKEN_MOVED' })
})

it('refuses a player move of a locked token', async () => {
  const fixture = await setup()
  await patchTokens(fixture, (ordinal) => (ordinal === 0 ? { locked: true } : {}))
  await expect(executeSceneInRoom(fixture.base.owner.caller, fixture.input)).rejects.toThrow(
    'The token is missing or locked.'
  )
})

it('refuses a move whose path starts away from the token, committing nothing', async () => {
  const { base, input } = await setup()
  await expect(
    executeSceneInRoom(base.owner.caller, {
      ...input,
      path: [
        { x: 1, y: 0 },
        { x: 10, y: 0 }
      ]
    })
  ).rejects.toThrow('Token movement must follow a path from its current position.')
})

it('refuses a move against a stale Scene version', async () => {
  const { base, input } = await setup()
  expect((await executeSceneInRoom(base.owner.caller, input)).version).toBe(1)
  // A client sends only once the room's Scene has caught up, so a stale version is an older one.
  await expect(
    executeSceneInRoom(base.owner.caller, {
      ...input,
      commandId: crypto.randomUUID(),
      path: [
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ]
    })
  ).rejects.toThrow('STALE_STATE')
})
