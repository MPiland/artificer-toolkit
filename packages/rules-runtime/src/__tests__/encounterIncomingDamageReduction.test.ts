import { describe, expect, it } from 'vitest'

import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'

import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedGrantEffect } from './antitoxinEffectFixture.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xf1)
const TARGET_ID = testUuid(0xf2)
const DEFLECT_ID = testUuid(0xf3)

const deflectMissiles = monk.features?.find(({ label }) => label === 'Deflect Missiles')

/**
 * A +5 ranged Quill Volley (3 piercing on a hit) at an Ogre (AC 11, Dexterity 8) holding the grant
 * the real compiler plans for Deflect Missiles: a 1d10 reduction whose Dexterity and monk-level
 * bonus a Creature folds to 0 (-1, and no class levels).
 */
async function quillShotAtDeflectingOgre(rolls: number[]) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({
      id: ATTACKER_ID,
      label: 'Quill Beast',
      features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })]
    }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    targetActiveEffects: [
      plannedGrantEffect({
        id: DEFLECT_ID,
        holderActorId: TARGET_ID,
        effect: deflectMissiles?.effects?.[0],
        sourceLabel: 'Deflect Missiles'
      })
    ],
    featureId: QUILL_VOLLEY_ID,
    overridable: true
  })
  return (await settleCreatureAction({ prepared, rolls })).execution
}

const damageDealt = (execution: Awaited<ReturnType<typeof quillShotAtDeflectingOgre>>) =>
  execution.applications.reduce(
    (sum, application) => sum + (application.kind === 'DAMAGE' ? application.requestedAmount : 0),
    0
  )

describe('incoming damage reduction on an attack (SPELLS-31.T5b)', () => {
  it('takes the rolled reduction off the hit: 3 - 1 = 2', async () => {
    // A natural 10 + 5 hits AC 11; the reduction's d10 rolls a 1.
    expect(damageDealt(await quillShotAtDeflectingOgre([9, 0]))).toBe(2)
  })

  it('rolls the reduction once on a critical hit, never doubling it', async () => {
    // A natural 20; one reduction d10 of 1 is the only die left to roll.
    expect(damageDealt(await quillShotAtDeflectingOgre([19, 0]))).toBe(2)
  })

  it('reduces the hit to no less than 0', async () => {
    expect(damageDealt(await quillShotAtDeflectingOgre([9, 8]))).toBe(0)
  })
})
