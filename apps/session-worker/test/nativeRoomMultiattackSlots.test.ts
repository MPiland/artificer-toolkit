import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

const BEAR_ID = testUuid(0xe00)
const WOLF_ID = testUuid(0xe01)

/** No Scene measures the attacks' reach (D11); every attack acknowledges that. */
const RANGE: ['TARGET_RANGE_UNCHECKED'] = ['TARGET_RANGE_UNCHECKED']

const bite = (() => {
  const feature = brownBear.features.find(({ label }) => label === 'Bite')
  if (!feature) throw new Error('The SRD Brown Bear has no Bite.')
  return feature
})()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('a Brown Bear’s Multiattack in the room (D93)', () => {
  it('offers only the attack that fills its remaining slot and returns the slot when an attack is undone', async () => {
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 14 : 1)),
      actors: [
        srdCreatureActor({ id: BEAR_ID, creature: brownBear }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      ownerFeatureId: bite.id
    })
    const labels = async () => (await room.actionChoices()).actions.map(({ label }) => label)
    const claws = (await room.actionChoices()).actions.find(({ label }) => label.includes('Claws'))
    if (!claws)
      throw new Error(
        `The Brown Bear offers no Claws: ${JSON.stringify((await room.actionChoices()).unavailableActions)}.`
      )

    // Before any attack both are offered, each the first of the Multiattack's two.
    expect(await labels()).toEqual(expect.arrayContaining(['Bite', claws.label]))
    expect((await room.actionChoices()).openAttackAction).toBeNull()

    const first = await room.startAction(WOLF_ID, RANGE)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')

    // The bite has taken its slot: the bear can't bite twice, only claw.
    expect(await labels()).not.toContain('Bite')
    expect(await labels()).toContain(claws.label)
    expect((await room.actionChoices()).openAttackAction).toMatchObject({ made: 1, total: 2 })

    const second = await room.startAction(WOLF_ID, RANGE, null, null, claws.id)
    expect(second.answer.type, JSON.stringify(second.answer)).toBe('COMMAND_COMMITTED')
    expect((await room.actionChoices()).openAttackAction).toMatchObject({ made: 2, total: 2 })

    // Undoing the claws returns its slot; undoing the bite returns both.
    for (const expected of [
      { made: 1, bite: false },
      { made: 0, bite: true }
    ]) {
      const undone = await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
      expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
      const choices = await room.actionChoices()
      expect(choices.openAttackAction?.made ?? 0).toBe(expected.made)
      expect(choices.actions.some(({ label }) => label === 'Bite')).toBe(expected.bite)
      expect(choices.actions.some(({ label }) => label.includes('Claws'))).toBe(true)
    }
  })
})
