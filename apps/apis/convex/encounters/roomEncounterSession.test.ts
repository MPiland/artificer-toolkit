import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import { playerControlFixture, setActorControllers } from '../../tests/fixtures/playerControl'
import { executeInRoom, readEncounterSessionInRoom } from '../../tests/fixtures/liveSessionWorker'

/**
 * The Encounter session the room pushes a subscribed member is the same read the Convex queries
 * serve (ADR 0035): built by the shared `encounter-persistence` readers, so projection, privacy and
 * the timeline cannot drift between the two transports.
 */
describe('Room-pushed Encounter session', () => {
  async function pausedAction() {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.player.userId])
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await base.version(),
        actorId: base.enemy.id,
        currentHitPoints: 7
      }
    })
    await executeInRoom(base.player.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    return base
  }

  it('matches the Convex reads for the GM, a controlling player and a bystander', async () => {
    const base = await pausedAction()
    const campaignId = base.campaign.id
    const encounterId = base.run.id
    for (const member of [base.owner, base.player, base.other]) {
      const frame = await readEncounterSessionInRoom(member.caller, encounterId, { timeline: true })
      if (!frame.held) throw new Error('The room should hold the active Run.')
      expect(frame.state).toEqual(
        await member.caller.query(api.encounters.activeReads.active, { campaignId })
      )
      expect(frame.preparedPending).toEqual(
        await member.caller.query(api.encounters.projectionReads.pendingPrepared, { campaignId })
      )
      expect(frame.timeline).toEqual(
        await member.caller.query(api.encounters.timelineReads.timeline, {
          encounterId,
          limit: 50
        })
      )
      expect(frame.actorSides).toEqual(
        member === base.owner
          ? await member.caller.query(api.encounters.projectionReads.actorSides, {
              encounterId,
              expectedVersion: frame.version
            })
          : null
      )
      expect(frame.version).toBe(await base.version())
    }
  })

  it('shows a player only the table timeline', async () => {
    const base = await pausedAction()
    const gm = await readEncounterSessionInRoom(base.owner.caller, base.run.id, { timeline: true })
    const bystander = await readEncounterSessionInRoom(base.other.caller, base.run.id, {
      timeline: true
    })
    if (!gm.held || !bystander.held) throw new Error('The room should hold the active Run.')
    expect(gm.timeline?.entries.length).toBeGreaterThan(0)
    expect(bystander.timeline?.entries.every((entry) => entry.visibility === 'TABLE')).toBe(true)
  })

  it('omits the timeline unless the socket asked for it', async () => {
    const base = await playerControlFixture()
    const frame = await readEncounterSessionInRoom(base.owner.caller, base.run.id, {
      timeline: false
    })
    if (!frame.held) throw new Error('The room should hold the active Run.')
    expect(frame.timeline).toBeNull()
  })
})
