import { describe, expect, it } from 'vitest'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  domainRejection,
  playerControlFixture,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import { checkpointLiveRoom, useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { api } from '../_generated/api'

/** The stored actor Convex holds, which is current only after the room checkpoints (D85). */
async function storedActor(base: PlayerControlFixture, actorId: string) {
  await checkpointLiveRoom(base.campaign.id)
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', actorId))
      .unique()
  )
  if (!row) throw new Error('Missing Encounter actor.')
  return readStoredRunActor(row)
}

async function setHitPoints(base: PlayerControlFixture, actorId: string, currentHitPoints: number) {
  return base.gm({
    type: 'UPDATE_ACTOR',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version(),
    actorId,
    currentHitPoints
  })
}

async function advanceTurn(base: PlayerControlFixture) {
  return base.gm({
    type: 'ADVANCE_TURN',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version()
  })
}

async function setCurrentActor(base: PlayerControlFixture, actorId: string) {
  return base.gm({
    type: 'SET_CURRENT_ACTOR',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version(),
    actorId
  })
}

describe('0 hit points in the room (D63)', () => {
  useLocalRoomWorker()

  it('defeats a Creature in the commit whose damage drops it to 0, then skips its turns', async () => {
    // Turn order: companion, Character, enemy, hidden lurker.
    const base = await playerControlFixture()
    await setHitPoints(base, base.enemy.id, 1)
    const killed = await base.gm(await base.bite(base.companion.id, base.enemy.id))
    expect(killed.projection.actors.find((actor) => actor.id === base.enemy.id)).toMatchObject({
      currentHitPoints: 0,
      defeated: true
    })
    expect(await storedActor(base, base.enemy.id)).toMatchObject({ defeated: true })
    // Players see it fall too.
    await checkpointLiveRoom(base.campaign.id)
    const seen = await base.player.caller.query(api.encounters.projectionReads.get, {
      encounterId: base.run.id
    })
    expect(seen.actors.find((actor) => actor.id === base.enemy.id)).toMatchObject({
      defeated: true
    })

    expect((await advanceTurn(base)).projection.currentActorId).toBe(base.character.id)
    // The defeated enemy keeps its place, but its turn passes straight to the lurker.
    const skipped = await advanceTurn(base)
    expect(skipped.projection.currentActorId).toBe(base.lurker.id)
    expect(skipped.projection.actors.map((actor) => actor.id)).toContain(base.enemy.id)
  }, 60000)

  it('lets no one act for a defeated actor until the GM revives it by editing its hit points', async () => {
    const base = await playerControlFixture()
    await setHitPoints(base, base.enemy.id, 1)
    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    // The GM may still put its turn marker on it, but it has no choices and can't act.
    const current = await setCurrentActor(base, base.enemy.id)
    await checkpointLiveRoom(base.campaign.id)
    await expect(
      base.owner.caller.query(api.encounters.actionChoices.get, {
        encounterId: base.run.id,
        expectedVersion: current.projection.version,
        actorId: base.enemy.id
      })
    ).resolves.toBeNull()
    expect(
      await domainRejection(base.gm(await base.bite(base.enemy.id, base.companion.id)))
    ).toMatchObject({ reason: 'ACTOR_DEFEATED' })

    const revived = await setHitPoints(base, base.enemy.id, 4)
    expect(revived.projection.actors.find((actor) => actor.id === base.enemy.id)).toMatchObject({
      currentHitPoints: 4,
      defeated: false
    })
    await checkpointLiveRoom(base.campaign.id)
    const choices = await base.owner.caller.query(api.encounters.actionChoices.get, {
      encounterId: base.run.id,
      expectedVersion: revived.projection.version,
      actorId: base.enemy.id
    })
    expect(choices?.actions.map((action) => action.label)).toContain('Bite')
  }, 60000)

  it('undoing the killing blow revives the Creature', async () => {
    const base = await playerControlFixture()
    await setHitPoints(base, base.enemy.id, 1)
    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    const undone = await base.gm({
      type: 'REVERT_LAST_ACTION',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version()
    })
    expect(undone.projection.actors.find((actor) => actor.id === base.enemy.id)).toMatchObject({
      currentHitPoints: 1,
      defeated: false
    })
  }, 60000)

  it('defeats a Creature the GM sets to 0 hit points', async () => {
    const base = await playerControlFixture()
    const edited = await setHitPoints(base, base.enemy.id, 0)
    expect(edited.projection.actors.find((actor) => actor.id === base.enemy.id)).toMatchObject({
      defeated: true
    })
    expect(await storedActor(base, base.enemy.id)).toMatchObject({ defeated: true })
  }, 60000)
})
