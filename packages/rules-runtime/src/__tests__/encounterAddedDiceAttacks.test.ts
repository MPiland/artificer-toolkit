import { describe, expect, it } from 'vitest'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { baneEffect, blessEffect } from './antitoxinEffectFixture.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xe1)
const TARGET_ID = testUuid(0xe2)
const BLESS_ID = testUuid(0xe3)
const BANE_ID = testUuid(0xe4)

/** A +5 ranged Quill Volley (3 piercing on a hit) at the Ogre (AC 11), under the attacker's effects. */
async function quillShot(input: {
  actorActiveEffects: readonly ActiveRuleEffectRecord[]
  rolls: number[]
}) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({
      id: ATTACKER_ID,
      label: 'Quill Beast',
      features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })]
    }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    actorActiveEffects: input.actorActiveEffects,
    featureId: QUILL_VOLLEY_ID,
    overridable: true
  })
  return (await settleCreatureAction({ prepared, rolls: input.rolls })).execution
}

describe('attack rolls under rolled-die grants (D156)', () => {
  it('rolls the plain d20 without a grant: a natural 4 + 5 = 9 misses AC 11', async () => {
    const execution = await quillShot({ actorActiveEffects: [], rolls: [3] })
    expect(execution.d20).toMatchObject({ rawFaces: [4], total: 9 })
    expect(execution.d20).not.toHaveProperty('addedDice')
    expect(execution.applications).toEqual([])
  })

  it("adds Bless's d4 after the d20: a natural 4 + 5 + 3 = 12 hits AC 11", async () => {
    const execution = await quillShot({
      actorActiveEffects: [blessEffect({ id: BLESS_ID, holderActorId: ATTACKER_ID })],
      rolls: [3, 2]
    })
    expect(execution.d20).toMatchObject({
      rawFaces: [4],
      total: 12,
      addedDice: [{ label: 'Bless', count: 1, faces: 4, sign: 'ADD', rolledFaces: [3] }]
    })
    expect(execution.applications).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 3 }])
  })

  it("subtracts Bane's d4 beside Bless's: a natural 7 + 5 - 4 + 1 = 9 misses AC 11", async () => {
    const execution = await quillShot({
      actorActiveEffects: [
        blessEffect({ id: BLESS_ID, holderActorId: ATTACKER_ID }),
        baneEffect({ id: BANE_ID, holderActorId: ATTACKER_ID })
      ],
      rolls: [6, 3, 0]
    })
    expect(execution.d20).toMatchObject({
      rawFaces: [7],
      total: 9,
      addedDice: [
        { label: 'Bane', sign: 'SUBTRACT', rolledFaces: [4] },
        { label: 'Bless', sign: 'ADD', rolledFaces: [1] }
      ]
    })
    expect(execution.applications).toEqual([])
  })
})
