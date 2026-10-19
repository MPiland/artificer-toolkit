import { describe, expect, it } from 'vitest'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'

import { activeAttackCriticalRules } from '../character/activeEffectGrantTotals.js'
import { DIVINE_FAVOR_EFFECT, criticalThresholdEffect } from '../testing/criticalThresholdEffect.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedGrantEffect } from './antitoxinEffectFixture.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xe1)
const TARGET_ID = testUuid(0xe2)

const PIERCING = srdDamageTypeId('PIERCING')
const RADIANT = srdDamageTypeId('RADIANT')

const heldEffect = (effect: EffectAuthored) =>
  plannedGrantEffect({
    id: testUuid(0xe3),
    holderActorId: ATTACKER_ID,
    effect,
    sourceLabel: 'Critical Focus'
  })

/** A +5 ranged Quill Volley (3 piercing on a hit) at the Ogre (AC 11) under the holder's effects. */
async function quillShot(actorActiveEffects: readonly ActiveRuleEffectRecord[], rolls: number[]) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({
      id: ATTACKER_ID,
      label: 'Quill Beast',
      features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })]
    }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    actorActiveEffects,
    targetActiveEffects: [],
    featureId: QUILL_VOLLEY_ID,
    overridable: true
  })
  return settleCreatureAction({ prepared, rolls })
}

describe('Creature critical rules from active grants (D158)', () => {
  const focus = heldEffect(criticalThresholdEffect(19))

  it('reads the lowest threshold a holder has for an attack domain, 20 for the others', () => {
    expect(activeAttackCriticalRules([focus], 'RANGED')).toEqual({ threshold: 19, extraDice: 0 })
    expect(activeAttackCriticalRules([focus], 'SPELL')).toEqual({ threshold: 20, extraDice: 0 })
    expect(activeAttackCriticalRules([], 'RANGED')).toEqual({ threshold: 20, extraDice: 0 })
  })

  it('crits on a natural 19 while its holder has a threshold of 19', async () => {
    const { execution } = await quillShot([focus], [18, 1, 2])
    expect(execution.applications).toMatchObject([
      { requestedAmount: 3, damageTypeId: PIERCING },
      { requestedAmount: 5, damageTypeId: RADIANT }
    ])
  })

  it('does not crit on a natural 19 without the threshold grant', async () => {
    const { execution } = await quillShot([heldEffect(DIVINE_FAVOR_EFFECT)], [18, 1])
    expect(execution.applications).toMatchObject([
      { requestedAmount: 3, damageTypeId: PIERCING },
      { requestedAmount: 2, damageTypeId: RADIANT }
    ])
  })

  it('still only doubles the dice another grant adds on a lowered-threshold crit', async () => {
    const { execution } = await quillShot([focus], [18, 3, 3])
    expect(execution.applications).toMatchObject([
      { damageTypeId: PIERCING },
      { requestedAmount: 8, damageTypeId: RADIANT }
    ])
  })
})
