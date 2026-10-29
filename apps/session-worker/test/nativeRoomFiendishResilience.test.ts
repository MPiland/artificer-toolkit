import { characterActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { theFiend } from '@artificer-toolkit/source-data/srd/classes/the-fiend.js'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T5k: Fiendish Resilience picks a damage type at use and holds resistance to it, except
 * from magical or silvered weapons, until its next use replaces it (a SAME_EFFECT END_EFFECTS).
 */

const WARLOCK_ACTOR_ID = testUuid(0x9f0)
const WARLOCK_ID = testUuid(0x9f1)
const FIENDISH_RESILIENCE = theFiend.features?.find(({ label }) => label === 'Fiendish Resilience')
if (!FIENDISH_RESILIENCE) throw new Error('The SRD Fiend authors Fiendish Resilience.')
const damageTypeId = (label: string) => SRD_DAMAGE_TYPES.find((each) => each.label === label)!.id
// Its one use between rests is spent by the first pick, so the second is the GM's override.
const AGAIN: EncounterRuleWarningCodeDto[] = ['RESOURCE_UNAVAILABLE']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const room = () =>
  actionRoom({
    actors: [characterActor({ id: WARLOCK_ACTOR_ID, characterId: WARLOCK_ID })],
    characterClassFeatures: [FIENDISH_RESILIENCE],
    characterAction: (action) => action.label.startsWith('Fiendish Resilience')
  })

type Room = Awaited<ReturnType<typeof room>>

async function pick(fixture: Room, label: string, acknowledgedWarnings: typeof AGAIN = []) {
  const choices = await fixture.actionChoices()
  const target = choices.actions.find(({ id }) => id === fixture.actionId)?.target
  const option =
    target && 'choiceOptions' in target
      ? target.choiceOptions?.find((each) => each.label === label)
      : undefined
  if (!option) throw new Error(`The room offers no ${label} option.`)
  const { answer } = await fixture.startAction(
    WARLOCK_ACTOR_ID,
    acknowledgedWarnings,
    null,
    null,
    fixture.actionId,
    WARLOCK_ACTOR_ID,
    option.id
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The resistances the Warlock's held effects grant, one entry per held effect. */
async function heldResistances(fixture: Room) {
  const { characterEffects } = await readRoomHistory(fixture.room.base.stub)
  return characterEffects.map(({ definitionJson }) =>
    (
      JSON.parse(definitionJson).stateContributions as {
        modifiers?: { valueDomainCode: string; payload: unknown }[]
      }[]
    ).flatMap(({ modifiers = [] }) =>
      modifiers.map(({ valueDomainCode, payload }) => ({ valueDomainCode, payload }))
    )
  )
}

const resistance = (label: string) => [
  {
    valueDomainCode: 'DAMAGE_RESISTANCE',
    payload: { damageTypeId: damageTypeId(label), bypassedBy: ['MAGICAL', 'SILVERED'] }
  }
]

describe('room Fiendish Resilience (SPELLS-31.T5k)', () => {
  it('offers a pick on the user alone and holds resistance to the picked type', async () => {
    const fixture = await room()
    const action = (await fixture.actionChoices()).actions.find(({ id }) => id === fixture.actionId)
    expect(action?.target).toMatchObject({
      kind: 'SELF',
      choiceOptions: SRD_DAMAGE_TYPES.map(({ label }) => ({ label }))
    })

    await pick(fixture, 'Fire')
    expect(await heldResistances(fixture)).toEqual([resistance('Fire')])
  }, 120000)

  it('replaces the earlier resistance on its next use, and one undo restores it', async () => {
    const fixture = await room()
    await pick(fixture, 'Fire')
    const before = await readRoomHistory(fixture.room.base.stub)

    await pick(fixture, 'Cold', AGAIN)
    expect(await heldResistances(fixture)).toEqual([resistance('Cold')])

    const undone = await fixture.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect((await readRoomHistory(fixture.room.base.stub)).characterEffects).toEqual(
      before.characterEffects
    )
  }, 120000)
})
