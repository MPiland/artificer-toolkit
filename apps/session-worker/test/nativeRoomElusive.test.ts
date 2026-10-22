import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-31.T4k2a (D156): the Rogue's Elusive, authored as `SUPPRESS_ROLL_INFLUENCE` `ADVANTAGE`
 * grants on attacks against its holder, leaves no attack at the holder with advantage while it can act.
 */

const CHARACTER_ACTOR_ID = testUuid(0xe10)
const CHARACTER_ID = testUuid(0xe11)
const WOLF_ID = testUuid(0xe12)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const condition = (code: string) => {
  const found = srdSystemRecord.conditionTypes.find((entry) => entry.code === code)
  if (!found) throw new Error(`Missing ${code} condition fixture.`)
  return found
}

/** The SRD Elusive feature, acquired by the fixture Character at its first level. */
const elusive = () => {
  const found = rogue.features?.find((feature) => feature.label === 'Elusive')
  if (!found) throw new Error('The SRD Rogue must author Elusive.')
  return { ...found, availableAtLevel: 1 }
}

/** The mode an Invisible Wolf's Bite at the Character rolls in, which its unseen attack makes advantage. */
async function biteRollMode(input: { elusive: boolean; incapacitated?: boolean }) {
  const wolf = biteWolf('ATTACK')
  const invisible = condition('INVISIBLE')
  const wolfActor = srdCreatureActor({
    id: WOLF_ID,
    creature: wolf,
    disposition: 'HOSTILE',
    conditionIds: [invisible.id]
  })
  const incapacitated = condition('INCAPACITATED')
  const room = await actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // A turn change reads the Character's frozen identity.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      wolfActor
    ],
    // The room needs an action source; the Wolf's Bite is the action under test.
    characterAction: () => true,
    characterClassFeatures: input.elusive ? [elusive()] : [],
    ...(input.incapacitated
      ? {
          characterPlay: {
            conditions: [{ conditionTypeId: incapacitated.id, label: incapacitated.label }]
          }
        }
      : {})
  })
  const biteActionId = room.featureActionId(wolfActor, creatureFeature(wolf, 'Bite').id)
  await room.advanceTurn()
  const bite = await room.startAction(CHARACTER_ACTOR_ID, [], null, null, biteActionId, WOLF_ID)
  expect(bite.answer.type, JSON.stringify(bite.answer)).toBe('COMMAND_COMMITTED')
  const prompt = await room.pendingDecision()
  if (prompt.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the Bite d20.')
  return prompt.pending.request.rollMode
}

describe('room Elusive (SPELLS-31.T4k2a)', () => {
  it('rolls an unseen Wolf’s Bite at a Character without Elusive with advantage', async () => {
    expect(await biteRollMode({ elusive: false })).toBe('ADVANTAGE')
  }, 120000)

  it('leaves the Bite no advantage against a Character with Elusive', async () => {
    expect(await biteRollMode({ elusive: true })).toBe('NORMAL')
  }, 120000)

  it('gives the advantage back while the Character is incapacitated', async () => {
    expect(await biteRollMode({ elusive: true, incapacitated: true })).toBe('ADVANTAGE')
  }, 120000)
})
