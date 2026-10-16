import { describe, expect, it } from 'vitest'

import { ACTIVATION_CODE, EQUIPMENT_PROPERTY_CODE, TRIGGER } from '@artificer-toolkit/shared/core'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { srdBaselineContent } from './index.js'

const { equipment } = srdBaselineContent.subjects

const isLightMeleeWeapon = (item: EquipmentAuthored) =>
  item.category === 'WEAPON' &&
  (item.properties ?? []).includes(EQUIPMENT_PROPERTY_CODE.LIGHT) &&
  (item.properties ?? []).includes(EQUIPMENT_PROPERTY_CODE.MELEE)

const lightMeleeWeapons = equipment.filter(isLightMeleeWeapon)
const bonusActionAttacks = (item: EquipmentAuthored) =>
  (item.effects ?? []).filter(
    (effect) =>
      effect.invocation.kind === 'ACTION' &&
      effect.invocation.triggerCode === TRIGGER.MELEE_WEAPON_ATTACK &&
      effect.invocation.activation?.code === ACTIVATION_CODE.BONUS_ACTION
  )

describe('the off-hand attack of the SRD Light melee weapons (two-weapon fighting)', () => {
  it('covers exactly the seven Light melee weapons', () => {
    expect(lightMeleeWeapons.map(({ label }) => label).sort()).toEqual([
      'Club',
      'Dagger',
      'Handaxe',
      'Light Hammer',
      'Scimitar',
      'Shortsword',
      'Sickle'
    ])
  })

  it.each(lightMeleeWeapons.map((item) => [item.label, item] as const))(
    'gives the %s one bonus-action melee attack, offered after another Light melee weapon attack',
    (_label, item) => {
      const [bonus, ...extra] = bonusActionAttacks(item)
      expect(extra).toEqual([])
      expect(bonus?.requirements?.groups).toHaveLength(1)
      const [condition] = bonus?.requirements?.groups[0]?.contexts[0]?.conditions ?? []
      expect(condition).toMatchObject({
        kind: 'PREDICATE',
        constraint: 'INCLUDE',
        predicateCode: 'ATTACK_ACTION_OTHER_WEAPON',
        properties: [EQUIPMENT_PROPERTY_CODE.LIGHT, EQUIPMENT_PROPERTY_CODE.MELEE]
      })
    }
  )

  it.each(lightMeleeWeapons.map((item) => [item.label, item] as const))(
    'splits the %s melee damage ability modifier into the Action attack and a negative-only bonus attack',
    (_label, item) => {
      const meleeDamage = (item.modifiers ?? []).filter(
        (modifier) =>
          modifier.valueDomainCode === 'DAMAGE' &&
          'attackDomain' in modifier.domain &&
          modifier.domain.attackDomain === 'MELEE'
      )
      expect(meleeDamage).toHaveLength(2)
      const [action, bonus] = meleeDamage
      expect(action?.payload).not.toHaveProperty('max')
      expect(bonus?.payload).toMatchObject({ max: 0 })
      const activationConstraint = (modifier: typeof action) =>
        modifier?.restrictions?.groups
          .flatMap((group) => group.contexts)
          .flatMap((context) => context.conditions ?? [])
          .find(
            (condition) =>
              condition.kind === 'PREDICATE' && condition.predicateCode === 'ATTACK_ACTIVATION'
          )
      expect(activationConstraint(action)).toMatchObject({
        constraint: 'EXCLUDE',
        activation: ACTIVATION_CODE.BONUS_ACTION
      })
      expect(activationConstraint(bonus)).toMatchObject({
        constraint: 'INCLUDE',
        activation: ACTIVATION_CODE.BONUS_ACTION
      })
    }
  )

  it('leaves every other SRD weapon without a bonus-action attack', () => {
    const others = equipment.filter((item) => !isLightMeleeWeapon(item))
    expect(others.filter((item) => bonusActionAttacks(item).length > 0)).toEqual([])
  })

  it('authors the node ids of every Light melee weapon once', () => {
    const ids: string[] = []
    const collect = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(collect)
      if (typeof node !== 'object' || node === null) return
      for (const [key, value] of Object.entries(node)) {
        if (key === 'id' && typeof value === 'string') ids.push(value)
        else collect(value)
      }
    }
    for (const item of lightMeleeWeapons)
      collect({ effects: item.effects, modifiers: item.modifiers })
    expect(new Set(ids).size).toBe(ids.length)
  })
})
