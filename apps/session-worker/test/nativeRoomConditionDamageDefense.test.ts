import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const SOURCE_ID = testUuid(0x7a0)
const CHARACTER_ACTOR_ID = testUuid(0x7a1)
const CHARACTER_ID = testUuid(0x7a2)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function srdEntry<T extends { code: string }>(entries: readonly T[], code: string): T {
  const entry = entries.find((candidate) => candidate.code === code)
  if (!entry) throw new Error(`The SRD ${code} is missing.`)
  return entry
}

/**
 * The seeded Hell Hound bites the player's Character, holding `conditionCodes` on its Sheet. The GM
 * auto-rolls the Hound's dice: a natural 19 to hit (twice for an advantaged roll), the d8 at 8 and
 * both d6 at 6, so the Bite deals 11 piercing and 12 fire.
 */
async function biteDamage(conditionCodes: readonly string[], advantaged: boolean) {
  const hound = seededSrdCreature('Hell Hound')
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: hound }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(hound, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [...(advantaged ? [18, 18] : [18]), 7, 5, 5],
    characterPlay: {
      conditions: conditionCodes.map((code) => {
        const condition = srdEntry(SRD_CONDITION_TYPES, code)
        return { conditionTypeId: condition.id, label: condition.label }
      })
    }
  })
  // A printed reach can't be measured without a Scene context, so the GM acknowledges it (D11).
  const { command, answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.find((row) => row.commandId === command.commandId)
  if (!receipt) throw new Error('The Bite receipt is missing.')
  const result = parseReceiptExecution(receipt)
  if (
    result.status !== 'COMPLETE' ||
    result.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH'
  )
    throw new Error('Expected a Character mechanics receipt.')
  return result.applicationOutputs.applications.flatMap((application) =>
    application.kind === 'DAMAGE'
      ? [
          {
            damageTypeId: application.damageTypeId,
            requestedAmount: application.requestedAmount,
            damageDisposition: application.damageDisposition,
            resolvedAmount: application.resolvedAmount
          }
        ]
      : []
  )
}

const PIERCING = srdEntry(SRD_DAMAGE_TYPES, 'PIERCING').id
const FIRE = srdEntry(SRD_DAMAGE_TYPES, 'FIRE').id

describe('a condition’s authored damage defense in the room (SPELLS-10.1)', () => {
  it('a Petrified Character resists every damage type of a hit: the Hell Hound’s Bite deals half', async () => {
    expect(await biteDamage(['PETRIFIED'], true)).toEqual([
      {
        damageTypeId: PIERCING,
        requestedAmount: 11,
        damageDisposition: 'RESISTANT',
        resolvedAmount: 5
      },
      { damageTypeId: FIRE, requestedAmount: 12, damageDisposition: 'RESISTANT', resolvedAmount: 6 }
    ])
  })

  it('a Character without the condition takes the Bite in full', async () => {
    expect(await biteDamage([], false)).toEqual([
      {
        damageTypeId: PIERCING,
        requestedAmount: 11,
        damageDisposition: 'NORMAL',
        resolvedAmount: 11
      },
      { damageTypeId: FIRE, requestedAmount: 12, damageDisposition: 'NORMAL', resolvedAmount: 12 }
    ])
  })
})
