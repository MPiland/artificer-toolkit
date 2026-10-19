import { describe, expect, it } from 'vitest'

import { featureEffectDtoSchema } from '../effects/effect.js'

const id = '00000000-0000-4000-8000-000000000001'
const path = {
  id: '00000000-0000-4000-8000-000000000101',
  order: 1,
  pathCode: 'ON_HIT',
  groupType: 'SINGLE',
  selectionKind: 'FIXED',
  resultBlock: { id: `${id}-result`, resultKind: 'SINGLE', outcomes: [] }
}

function effect(triggerCode: string, extra: Record<string, unknown>, paths: unknown[] = []) {
  return {
    id,
    order: 1,
    ...extra,
    invocation: {
      kind: 'ACTION',
      triggerCode,
      activation: { code: 'ACTION', amount: 1 },
      range: { id: `${id}-range`, rangeKind: 'SPECIAL' }
    },
    paths
  }
}

function issues(value: unknown) {
  const result = featureEffectDtoSchema.safeParse(value)
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
}

describe('Feature effect weaponAttack (SPELLS-31.T5s, D156)', () => {
  it('accepts a weapon attack with no paths of its own, narrowed to weapon properties', () => {
    const result = featureEffectDtoSchema.safeParse(
      effect('RANGED_WEAPON_ATTACK', { weaponAttack: { requiredPropertyCodes: ['AMMUNITION'] } })
    )
    expect(result.error?.issues).toBeUndefined()
    expect(result.data?.weaponAttack).toEqual({ requiredPropertyCodes: ['AMMUNITION'] })
  })

  it('still requires a path on an effect that is not made with the wielded weapons', () => {
    expect(issues(effect('MELEE_WEAPON_ATTACK', {}))).toEqual([
      { path: ['paths'], message: 'An effect needs at least one outcome path.' }
    ])
    expect(issues(effect('MELEE_WEAPON_ATTACK', {}, [path]))).toEqual([])
  })

  it('refuses it on an effect that is not a weapon attack', () => {
    expect(issues(effect('ACTIVATED', { weaponAttack: {} }))).toEqual([
      {
        path: ['weaponAttack'],
        message: 'Only a weapon attack action attacks with the wielded weapons.'
      }
    ])
  })

  it('refuses a grip beside it, since each weapon brings its own', () => {
    expect(issues(effect('MELEE_WEAPON_ATTACK', { weaponAttack: {}, grip: 'ONE_HANDED' }))).toEqual(
      [
        {
          path: ['grip'],
          message: "An attack with the wielded weapons uses each weapon's own grip."
        }
      ]
    )
  })

  it('refuses a property that is not an equipment property', () => {
    expect(
      issues(effect('MELEE_WEAPON_ATTACK', { weaponAttack: { requiredPropertyCodes: ['WINGED'] } }))
        .length
    ).toBeGreaterThan(0)
  })
})
