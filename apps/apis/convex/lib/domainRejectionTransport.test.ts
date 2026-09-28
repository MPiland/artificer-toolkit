import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { domainRejection, playerControlFixture } from '../../tests/fixtures/playerControl'
import { executeInRoom } from '../../tests/fixtures/liveSessionWorker'
import { api } from '../_generated/api'

/** Exactly the data a Convex domain rejection has always carried to clients. */
const expected = (reason: keyof typeof DOMAIN_REJECTION_MESSAGES) => ({
  code: 'DOMAIN_REJECTED',
  reason,
  message: DOMAIN_REJECTION_MESSAGES[reason]
})

describe('Encounter domain rejections at the Convex boundary', () => {
  it('reach a query caller as the same ConvexError', async () => {
    const base = await playerControlFixture()
    // The companion acts first and only the GM controls it.
    const rejection = await domainRejection(
      base.player.caller.query(api.encounters.actionChoices.get, {
        encounterId: base.run.id,
        expectedVersion: await base.version(),
        actorId: base.companion.id
      })
    )
    expect(rejection).toStrictEqual(expected('NOT_ACTOR_CONTROLLER'))
  })

  it('reach a mutation caller as the same ConvexError', async () => {
    const base = await playerControlFixture()
    const rejection = await domainRejection(
      base.owner.caller.mutation(api.encounters.runs.deletePrepared, {
        campaignId: base.campaign.id,
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: (await base.version()) + 1
      })
    )
    expect(rejection).toStrictEqual(expected('VERSION_STALE'))
  })

  it('reach the room through the live internal mutation route unchanged', async () => {
    const base = await playerControlFixture()
    // A player cannot use a GM tool; the internal route returns the rejection to the room.
    await expect(
      executeInRoom(base.player.caller, {
        command: {
          type: 'SET_ROUND',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: await base.version(),
          round: 2
        }
      })
    ).rejects.toMatchObject({ data: expected('GM_ONLY') })
  })

  it('leave other failures untouched', async () => {
    const base = await playerControlFixture()
    const failure = await base.owner.caller
      .query(api.encounters.actionChoices.get, {
        encounterId: crypto.randomUUID(),
        expectedVersion: await base.version(),
        actorId: base.companion.id
      })
      .then(
        () => null,
        (caught: unknown) => caught
      )
    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(ConvexError)
  })
})
