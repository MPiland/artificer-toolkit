import { describe, expect, it } from 'vitest'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { SRD, srdByLabel } from './dnd5eSrdCharacter.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction,
  srdConditionId,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xd1)
const TARGET_ID = testUuid(0xd2)
const PARALYZED = srdConditionId('PARALYZED')
const PRONE = srdConditionId('PRONE')

function damage(execution: Awaited<ReturnType<typeof executeNativeActionGraphs>>) {
  return execution.applications.flatMap((application) =>
    application.kind === 'DAMAGE'
      ? [[application.requestedAmount, application.damageTypeId] as const]
      : []
  )
}

/** The seeded Giant Spider's Bite (+5, 1d8 + 3, then DC 11 Constitution or 2d8 poison) at the Ogre (AC 11). */
async function spiderBite(input: {
  attackerConditionIds?: readonly string[]
  targetConditionIds?: readonly string[]
  rolls: number[]
}) {
  const spider = srdByLabel(SRD.creatures, 'Giant Spider')
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({
      id: ATTACKER_ID,
      creature: spider,
      conditionIds: input.attackerConditionIds ?? []
    }),
    target: srdCreatureActor({
      id: TARGET_ID,
      creature: srdByLabel(SRD.creatures, 'Ogre'),
      conditionIds: input.targetConditionIds ?? []
    }),
    featureId: creatureFeature(spider, 'Bite').id,
    overridable: true
  })
  return (await settleCreatureAction({ prepared, rolls: input.rolls })).execution
}

/** A +5 ranged Quill Volley (3 piercing on a hit) at the Ogre (AC 11). */
async function quillShot(input: { targetConditionIds: readonly string[]; rolls: number[] }) {
  const volley = quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })
  const prepared = await prepareCreatureAction({
    actor: creatureActor({ id: ATTACKER_ID, label: 'Quill Beast', features: [volley] }),
    target: srdCreatureActor({
      id: TARGET_ID,
      creature: srdByLabel(SRD.creatures, 'Ogre'),
      conditionIds: input.targetConditionIds
    }),
    featureId: QUILL_VOLLEY_ID,
    overridable: true
  })
  return (await settleCreatureAction({ prepared, rolls: input.rolls })).execution
}

describe('conditions change a resolved attack (D94)', () => {
  it('a melee hit on a Paralyzed target rolls with advantage and is a critical hit', async () => {
    // Natural 6 and 10 keep 10: 10 + 5 = 15 hits AC 11, and the Paralyzed Ogre makes it critical,
    // so the Bite rolls 2d8 + 3 piercing. The Constitution save (natural 1 + 3) still fails.
    const execution = await spiderBite({
      targetConditionIds: [PARALYZED],
      rolls: [5, 9, 3, 4, 0, 2, 4]
    })
    expect(execution.d20).toMatchObject({
      derivedRollMode: 'ADVANTAGE',
      rawFaces: [6, 10],
      selectedNatural: 10,
      total: 15,
      resultPath: 'ON_CRIT'
    })
    expect(damage(execution)).toEqual([
      [4 + 5 + 3, srdDamageTypeId('PIERCING')],
      [3 + 5, srdDamageTypeId('POISON')]
    ])
  })

  it('a ranged hit on a Paralyzed target has advantage but is not critical beyond 5 feet', async () => {
    const execution = await quillShot({ targetConditionIds: [PARALYZED], rolls: [5, 9] })
    expect(execution.d20).toMatchObject({
      derivedRollMode: 'ADVANTAGE',
      selectedNatural: 10,
      resultPath: 'ON_HIT'
    })
    expect(damage(execution)).toEqual([[3, srdDamageTypeId('PIERCING')]])
  })

  it('a Prone attacker rolls with disadvantage', async () => {
    // Natural 16 and 3 keep 3: 3 + 5 = 8 misses AC 11.
    const execution = await spiderBite({ attackerConditionIds: [PRONE], rolls: [15, 2] })
    expect(execution.d20).toMatchObject({
      derivedRollMode: 'DISADVANTAGE',
      rawFaces: [16, 3],
      selectedNatural: 3,
      resultPath: 'ON_MISS'
    })
    expect(damage(execution)).toEqual([])
  })

  it('a ranged attack on a Prone target beyond 5 feet rolls with disadvantage', async () => {
    const execution = await quillShot({ targetConditionIds: [PRONE], rolls: [15, 2] })
    expect(execution.d20).toMatchObject({
      derivedRollMode: 'DISADVANTAGE',
      selectedNatural: 3,
      resultPath: 'ON_MISS'
    })
  })
})
