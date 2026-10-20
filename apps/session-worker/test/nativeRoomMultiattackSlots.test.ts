import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { brownBear as authoredBrownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

const BEAR_ID = testUuid(0xe00)
const WOLF_ID = testUuid(0xe01)

/** No Scene measures the attacks' reach (D11); every attack acknowledges that. */
const RANGE: ['TARGET_RANGE_UNCHECKED'] = ['TARGET_RANGE_UNCHECKED']

/** The Brown Bear as the corpus seeds it, with its attack rolls. */
const brownBear = (() => {
  const record = srdCreatureRecords.find(({ id }) => id === authoredBrownBear.id)
  if (!record) throw new Error('The SRD Brown Bear is missing.')
  return record
})()

const bite = (() => {
  const feature = brownBear.features.find(({ label }) => label === 'Bite')
  if (!feature) throw new Error('The SRD Brown Bear has no Bite.')
  return feature
})()

/** The Bite again as a Bonus Action attack ("Nip"): the fixtures have no non-Action attack to hold beside the Multiattack. */
const bearWithNip = (() => {
  const ids = new Map<string, string>()
  const remapped = JSON.stringify(bite).replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
    (id) => {
      if (!ids.has(id)) ids.set(id, testUuid(0xe10 + ids.size))
      return ids.get(id) as string
    }
  )
  const nip: typeof bite = JSON.parse(remapped)
  return {
    ...brownBear,
    features: [
      ...brownBear.features,
      {
        ...nip,
        label: 'Nip',
        effects: nip.effects?.map((effect) =>
          effect.invocation.kind === 'ACTION'
            ? {
                ...effect,
                invocation: {
                  ...effect.invocation,
                  activation: { code: 'BONUS_ACTION', amount: 1 }
                }
              }
            : effect
        )
      }
    ]
  } as typeof brownBear
})()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

describe('a Brown Bear’s Multiattack in the room (D93)', () => {
  it('offers only the attack that fills its remaining slot and returns the slot when the last attack is undone', async () => {
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
    if (!claws) throw new Error('The Brown Bear offers no Claws.')

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

    // Undoing the claws returns its slot: the bite stays spent, the claws are offered again.
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect((await room.actionChoices()).openAttackAction).toMatchObject({ made: 1, total: 2 })
    expect(await labels()).not.toContain('Bite')
    expect(await labels()).toContain(claws.label)
  })

  it('keeps a Bonus Action attack offered and undoable while the Multiattack is left open (ended early in the drawer)', async () => {
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 14 : 1)),
      actors: [
        srdCreatureActor({ id: BEAR_ID, creature: bearWithNip }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      ownerFeatureId: bite.id
    })
    const choices = async () => (await room.actionChoices()).actions
    const nip = (await choices()).find(({ label }) => label === 'Nip')
    if (!nip) throw new Error('The Brown Bear offers no Nip.')
    expect(nip.attackSlot).toBeNull()

    expect((await room.startAction(WOLF_ID, RANGE)).answer.type).toBe('COMMAND_COMMITTED')
    // One of two attacks made. Ending the Multiattack is the drawer's own "Done": the server still has it open.
    expect((await room.actionChoices()).openAttackAction).toMatchObject({
      made: 1,
      total: 2,
      complete: false
    })
    // The Bonus Action attack spends no slot, so the open Attack action does not hide it.
    expect((await choices()).map(({ label }) => label)).toContain('Nip')

    const nipped = await room.startAction(WOLF_ID, RANGE, null, null, nip.id)
    expect(nipped.answer.type, JSON.stringify(nipped.answer)).toBe('COMMAND_COMMITTED')
    expect((await room.actionChoices()).openAttackAction).toMatchObject({ made: 1, total: 2 })

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect((await room.actionChoices()).openAttackAction).toMatchObject({ made: 1, total: 2 })
  })
})
