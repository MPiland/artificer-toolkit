import { describe, expect, it } from 'vitest'

import { equipmentAuthoredDtoSchema } from '../subjects/equipment.js'

function effect(
  order: number,
  grip: 'ONE_HANDED' | 'TWO_HANDED' | null,
  invocation: { kind: 'ACTION' | 'PASSIVE'; triggerCode: string }
) {
  const id = `00000000-0000-4000-8000-00000000000${order}`
  return {
    id,
    order,
    grip,
    invocation: {
      ...invocation,
      ...(invocation.kind === 'ACTION' ? { activation: { code: 'ACTION', amount: 1 } } : {}),
      range: { id: `${id}-range`, rangeKind: 'SELF' }
    },
    paths: [
      {
        id: `00000000-0000-4000-8000-00000000010${order}`,
        order: 1,
        pathCode: 'ON_HIT',
        groupType: 'SINGLE',
        selectionKind: 'FIXED',
        resultBlock: { id: `${id}-result`, resultKind: 'SINGLE', outcomes: [] }
      }
    ]
  }
}

const meleeAttack = { kind: 'ACTION', triggerCode: 'MELEE_WEAPON_ATTACK' } as const
const rangedAttack = { kind: 'ACTION', triggerCode: 'RANGED_WEAPON_ATTACK' } as const

function weapon(properties: string[], effects: ReturnType<typeof effect>[]) {
  return {
    kind: 'EQUIPMENT',
    id: 'weapon',
    label: 'Weapon',
    description: null,
    rarityId: 'common',
    userId: 'user-1',
    systemId: 'system-1',
    category: 'WEAPON',
    properties,
    effects
  }
}

function gripIssues(value: unknown) {
  const result = equipmentAuthoredDtoSchema.safeParse(value)
  return result.success
    ? []
    : result.error.issues
        .filter((issue) => issue.path.at(-1) === 'grip')
        .map((issue) => issue.message)
}

describe('equipment effect grips', () => {
  it('accepts one- and two-hand versatile attacks and grip-less non-attack effects', () => {
    expect(
      gripIssues(
        weapon(
          ['MELEE', 'VERSATILE'],
          [
            effect(1, 'ONE_HANDED', meleeAttack),
            effect(2, 'TWO_HANDED', meleeAttack),
            effect(3, null, { kind: 'ACTION', triggerCode: 'ACTIVATED' }),
            effect(4, null, { kind: 'PASSIVE', triggerCode: 'RANGED_WEAPON_ATTACK' })
          ]
        )
      )
    ).toEqual([])
    expect(
      gripIssues(weapon(['RANGED', 'TWO_HANDED'], [effect(1, 'TWO_HANDED', rangedAttack)]))
    ).toEqual([])
  })

  it('requires a grip exactly on non-passive weapon attack effects', () => {
    expect(gripIssues(weapon(['MELEE'], [effect(1, null, meleeAttack)]))).toEqual([
      'A weapon attack effect requires a grip.'
    ])
    expect(
      gripIssues(
        weapon(['MELEE'], [effect(1, 'ONE_HANDED', { kind: 'ACTION', triggerCode: 'ACTIVATED' })])
      )
    ).toEqual(['Only weapon attack effects have a grip.'])
    expect(
      gripIssues(
        weapon(
          ['RANGED'],
          [effect(1, 'ONE_HANDED', { kind: 'PASSIVE', triggerCode: 'RANGED_WEAPON_ATTACK' })]
        )
      )
    ).toEqual(['Only weapon attack effects have a grip.'])
  })

  it('bounds grips by the weapon handedness', () => {
    expect(
      gripIssues(weapon(['MELEE', 'TWO_HANDED'], [effect(1, 'ONE_HANDED', meleeAttack)]))
    ).toEqual(['A two-handed weapon attacks with two hands.'])
    expect(gripIssues(weapon(['MELEE'], [effect(1, 'TWO_HANDED', meleeAttack)]))).toEqual([
      'Only a versatile or two-handed weapon attacks with two hands.'
    ])
  })
})
