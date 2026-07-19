import { describe, expect, it } from 'vitest'
import {
  ATTACK_DOMAIN_CODE,
  SUBJECT,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE
} from '#core'
import {
  compileResolvedEquipment,
  resolveEquipmentAuthored
} from '#compilers'
import type {
  EquipmentAuthored,
  EquipmentVariantAuthored
} from '#authored'

describe('resolveEquipmentAuthored', () => {
  it('inherits parent rules and merges variant enhancements', () => {
    const parent: EquipmentAuthored = {
      kind: SUBJECT.EQUIPMENT,
      id: 'equipment-parent-1',
      label: 'Longsword',
      description: 'A martial blade.',
      weight: { amount: 3, unit: 'POUNDS' },
      rarityId: 'common',
      properties: [
        EQUIPMENT_PROPERTY_CODE.MARTIAL,
        EQUIPMENT_PROPERTY_CODE.VERSATILE
      ],
      category: EQUIPMENT_CATEGORY_CODE.WEAPON,
      attributes: ['LIMITED_USE'],
      requiresAttunement: true,
      effects: [
        {
          id: 'parent-effect',
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: 'MELEE_WEAPON_ATTACK',
            activation: { code: 'FREE' },
            range: {
              id: 'parent-range-1',
              rangeKind: 'SELF'
            }
          },
          paths: [
            {
              id: 'parent-path-1',
              order: 1,
              pathCode: 'ON_HIT',
              groupType: 'SINGLE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: 'parent-path-1__result',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'parent-outcome-1',
                    effectKind: 'DAMAGE',
                    damageTypeId: 'slashing',
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: 8
                  }
                ]
              }
            }
          ]
        }
      ],
      modifiers: [
        {
          id: 'parent-modifier',
          grantKind: GRANT_KIND.MODIFIER_GRANT,
          order: 1,
          selectionKind: 'GRANTED',
          valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
          domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
          modifierKind: MODIFIER_KIND.BONUS,
          scope: MODIFIER_SCOPE_KIND.SOURCE,
          payload: {
            valueKind: 'FIXED',
            amount: 1
          }
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }

    const variant: EquipmentVariantAuthored = {
      kind: SUBJECT.EQUIPMENT,
      id: 'equipment-variant-1',
      label: 'Longsword +1',
      description: null,
      rarityId: 'uncommon',
      properties: [EQUIPMENT_PROPERTY_CODE.MAGIC],
      category: EQUIPMENT_CATEGORY_CODE.VARIANT,
      parentEquipmentId: parent.id,
      status: 'DRAFT',
      modifiers: [
        {
          id: 'variant-modifier',
          grantKind: GRANT_KIND.MODIFIER_GRANT,
          order: 1,
          selectionKind: 'GRANTED',
          valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
          domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
          modifierKind: MODIFIER_KIND.BONUS,
          scope: MODIFIER_SCOPE_KIND.SOURCE,
          payload: {
            valueKind: 'FIXED',
            amount: 1
          }
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }

    const resolved = resolveEquipmentAuthored(
      variant,
      (id) => id === parent.id ? parent : null
    )

    expect(resolved.category).toBe(EQUIPMENT_CATEGORY_CODE.WEAPON)
    expect(resolved.status).toBe('DRAFT')
    expect(resolved.description).toBe(parent.description)
    expect(resolved.properties).toEqual([
      EQUIPMENT_PROPERTY_CODE.MARTIAL,
      EQUIPMENT_PROPERTY_CODE.VERSATILE,
      EQUIPMENT_PROPERTY_CODE.MAGIC
    ])
    expect(resolved.effects?.map((effect) => effect.id)).toEqual(['parent-effect'])
    expect(resolved.requiresAttunement).toBe(true)
    expect(resolved.variant?.inherited.requiresAttunement).toBe(true)
    expect(resolved.modifiers?.map((modifier) => modifier.id)).toEqual([
      'parent-modifier',
      'variant-modifier'
    ])
    expect(resolved.variant).toMatchObject({
      parentEquipmentId: parent.id,
      parentLabel: parent.label,
      inherited: {
        category: EQUIPMENT_CATEGORY_CODE.WEAPON,
        properties: [
          EQUIPMENT_PROPERTY_CODE.MARTIAL,
          EQUIPMENT_PROPERTY_CODE.VERSATILE
        ]
      }
    })

    const compiled = compileResolvedEquipment(resolved)

    expect(compiled.category).toBe(EQUIPMENT_CATEGORY_CODE.WEAPON)
    expect(compiled.properties).toEqual([
      EQUIPMENT_PROPERTY_CODE.MARTIAL,
      EQUIPMENT_PROPERTY_CODE.VERSATILE,
      EQUIPMENT_PROPERTY_CODE.MAGIC
    ])
    expect(compiled.modifiers?.map((modifier) => modifier.id)).toEqual([
      'parent-modifier',
      'variant-modifier'
    ])
    expect(compiled.requiresAttunement).toBe(true)

    const explicitlyUnattuned = resolveEquipmentAuthored(
      { ...variant, requiresAttunement: false },
      (id) => id === parent.id ? parent : null
    )
    expect(explicitlyUnattuned.requiresAttunement).toBe(false)
  })
})
