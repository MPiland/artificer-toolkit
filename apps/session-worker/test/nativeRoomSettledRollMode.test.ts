import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  gatedSneakAttack,
  riderGate,
  withFixedRiderDice
} from '@artificer-toolkit/rules-runtime/testing/unconditionalSneakAttack'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * D119(d) / D124: a rider's roll-mode gate follows the mode the d20 was settled in, not the mode
 * the rules derived. The roller may enter or roll in another mode (a GM-adjudicated advantage the
 * app has no contributor for, or a deliberately flat roll).
 */

const FIGHTER_ACTOR_ID = testUuid(0xd00)
const FIGHTER_ID = testUuid(0xd01)
const WOLF_ID = testUuid(0xd02)

/** The 1d6 the rider adds when the roll fallback shows its minimum. */
const RIDER_DAMAGE = 1

const conditionId = (code: 'BLINDED' | 'PRONE') => {
  const condition = srdSystemRecord.conditionTypes.find((type) => type.code === code)
  if (!condition) throw new Error(`The SRD has no ${code} Condition.`)
  return condition.id
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A homebrew Feature adding 1d6 of the weapon's type to a hit made with advantage. */
const advantageRider = (): ClassFeature =>
  withFixedRiderDice(
    gatedSneakAttack(
      testUuid(0xd10),
      riderGate([{ predicateCode: 'ATTACK_ROLL_MODE', rollMode: 'ADVANTAGE' }])
    ),
    testUuid(0xd11),
    '1d6'
  )

/**
 * The Fighter hand-rolls a Club hit on the Wolf: the app rolls the d20 the roller asks for, in the
 * mode the roller chooses (the rules derive Advantage when the Wolf is Prone or Blinded). Returns the hit
 * points the Wolf lost.
 */
async function wolfHitPointsLost(input: {
  withRider: boolean
  wolfCondition: 'BLINDED' | 'PRONE' | null
  rolledMode: 'NORMAL' | 'ADVANTAGE'
}) {
  const room = await actionRoom({
    // The d20 faces the app rolls (15, then 4 under advantage); every later die shows its minimum.
    rolls: input.rolledMode === 'ADVANTAGE' ? [14, 3] : [14],
    fallbackRoll: 0,
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({
        id: WOLF_ID,
        creature: plainWolf,
        conditionIds: input.wolfCondition ? [conditionId(input.wolfCondition)] : undefined
      })
    ],
    characterPlay: { equipped: true },
    characterClassFeatures: input.withRider ? [advantageRider()] : [],
    characterAction: (action) => action.label.includes('Club')
  })
  const hitPoints = async () => {
    const wolf = vitalsOf(await readRoomHistory(room.room.base.stub)).find(
      ({ id }) => id === WOLF_ID
    )
    if (wolf?.currentHitPoints === undefined) throw new Error('The Wolf holds no hit points.')
    return wolf.currentHitPoints
  }
  const before = await hitPoints()
  const { answer } = await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const firstPrompt = await room.pendingDecision()
  if (firstPrompt.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 roll prompt.')
  expect(firstPrompt.pending.request.rollMode).toBe(input.wolfCondition ? 'ADVANTAGE' : 'NORMAL')
  // The roller takes the d20 in the chosen mode, then rolls every damage die the hit asks for.
  let mode: 'NORMAL' | 'ADVANTAGE' | null = input.rolledMode
  for (let decision = firstPrompt; ; ) {
    expect((await room.rollDice(decision, mode)).type).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(room.room.base.stub)).evidenceRolls.at(-1)
    if (!held || !('request' in decision.pending)) throw new Error('The roll was not held.')
    const settled = await room.resolve(decision, {
      kind: 'SYSTEM_ROLL',
      requestId: decision.pending.request.requestId,
      rollId: held.id
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    const next = await readPendingActionDecision(room.room.base.stub)
    if (!next) break
    decision = next
    mode = null
  }
  return before - (await hitPoints())
}

const riderDamage = async (input: { wolfCondition: 'BLINDED' | 'PRONE' | null; rolledMode: 'NORMAL' | 'ADVANTAGE' }) =>
  (await wolfHitPointsLost({ ...input, withRider: true })) -
  (await wolfHitPointsLost({ ...input, withRider: false }))

describe('a roll-mode gated rider follows the settled d20, in the room (D119 d)', () => {
  it('adds the rider to a hit the roller made with advantage the rules did not derive', async () => {
    expect(await riderDamage({ wolfCondition: null, rolledMode: 'ADVANTAGE' })).toBe(RIDER_DAMAGE)
  })

  it('withholds the rider from a hit the roller flattened though the rules derived advantage', async () => {
    expect(await riderDamage({ wolfCondition: 'PRONE', rolledMode: 'NORMAL' })).toBe(0)
  })

  it('adds the rider when the roller keeps the derived advantage', async () => {
    expect(await riderDamage({ wolfCondition: 'PRONE', rolledMode: 'ADVANTAGE' })).toBe(
      RIDER_DAMAGE
    )
  })

  it('adds the rider when sight settles the d20 in advantage the roller did not roll', async () => {
    // A Blinded target's advantage is sight-governed: the room settles the true mode.
    expect(await riderDamage({ wolfCondition: 'BLINDED', rolledMode: 'NORMAL' })).toBe(RIDER_DAMAGE)
  })
})
