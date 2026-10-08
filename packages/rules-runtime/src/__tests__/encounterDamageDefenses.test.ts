import { describe, expect, it } from 'vitest'

import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const SOURCE_ID = '00000000-0000-4000-8000-0000000d0001'
const TARGET_ID = '00000000-0000-4000-8000-0000000d0002'
const piercing = srdDamageTypeId('PIERCING')

/** Quill Volley deals a fixed 3 piercing damage to an 11 HP Wolf with the given defenses. */
async function quillVolleyDamage(defenses: {
  damageResistanceIds?: readonly string[]
  damageVulnerabilityIds?: readonly string[]
}) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({
      id: SOURCE_ID,
      label: 'Quill Beast',
      features: [quillVolley({ charges: 3, cost: 1 })]
    }),
    target: creatureActor({ id: TARGET_ID, label: 'Wolf', features: [], ...defenses }),
    featureId: QUILL_VOLLEY_ID,
    overridable: true
  })
  const { execution, mechanics } = await settleCreatureAction({ prepared, rolls: [] })
  const [damage] = execution.applications
  if (damage?.kind !== 'DAMAGE') throw new Error('Expected one damage application.')
  return {
    disposition: damage.damageDisposition,
    resolvedAmount: damage.resolvedAmount,
    currentHitPoints: mechanics.mechanics.targetTransition.after.currentHitPoints
  }
}

/**
 * A Quill Volley against a Wolf immune to piercing "from nonmagical attacks". As a ranged weapon
 * attack (natural 11 hits AC 13) it is such an attack; without a range it is not an attack at all.
 */
async function quillVolleyAgainstNonmagicalImmunity(asAttack: boolean) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({
      id: SOURCE_ID,
      label: 'Quill Beast',
      features: [quillVolley({ charges: 3, cost: 1, ...(asAttack ? { rangeFeet: 60 } : {}) })]
    }),
    target: creatureActor({
      id: TARGET_ID,
      label: 'Wolf',
      features: [],
      qualifiedDamageDefenses: [
        { kind: 'IMMUNITY', damageTypeIds: [piercing], bypassedBy: ['MAGICAL', 'SILVERED'] }
      ]
    }),
    featureId: QUILL_VOLLEY_ID,
    overridable: true
  })
  const { mechanics } = await settleCreatureAction({ prepared, rolls: asAttack ? [10] : [] })
  return mechanics.mechanics.targetTransition.after.currentHitPoints
}

describe('qualified damage defenses', () => {
  it('shrug off a nonmagical Creature attack', async () => {
    expect(await quillVolleyAgainstNonmagicalImmunity(true)).toBe(11)
  })

  it('do not reduce damage that is not from an attack', async () => {
    expect(await quillVolleyAgainstNonmagicalImmunity(false)).toBe(8)
  })
})

describe('damage resistance and vulnerability', () => {
  it('halves (rounding down) and then doubles when both apply, rather than cancelling', async () => {
    expect(
      await quillVolleyDamage({
        damageResistanceIds: [piercing],
        damageVulnerabilityIds: [piercing]
      })
    ).toEqual({
      disposition: 'RESISTANT_AND_VULNERABLE',
      resolvedAmount: 2,
      currentHitPoints: 9
    })
  })

  it('halves for resistance alone and doubles for vulnerability alone', async () => {
    expect(await quillVolleyDamage({ damageResistanceIds: [piercing] })).toEqual({
      disposition: 'RESISTANT',
      resolvedAmount: 1,
      currentHitPoints: 10
    })
    expect(await quillVolleyDamage({ damageVulnerabilityIds: [piercing] })).toEqual({
      disposition: 'VULNERABLE',
      resolvedAmount: 6,
      currentHitPoints: 5
    })
  })
})
