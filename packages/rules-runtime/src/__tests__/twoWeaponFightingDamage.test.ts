import { describe, expect, it } from 'vitest'

import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import { ACTIVATION_CODE, EQUIPMENT_GRIP } from '@artificer-toolkit/shared/core'
import type {
  EquipmentAuthored,
  EquipmentEffectAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import {
  equipId,
  finesseWeaponModifiers,
  meleeWeaponAbilityModifiers,
  meleeWeaponEffects
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { shortsword } from '@artificer-toolkit/source-data/srd/equipment/shortsword.js'

import {
  damageExpression,
  evaluateSrdCharacter,
  itemAction,
  srdFeature,
  type SrdCharacter
} from './dnd5eSrdCharacter.js'

let nextNodeId = 0x4000
const nodeId = () => equipId(nextNodeId++)

/** "Took the Attack action this turn with another Light melee weapon" gates the off-hand attack. */
const otherLightMeleeAttack: FacetAuthored<'CHARACTER'> = {
  id: nodeId(),
  groups: [
    {
      id: nodeId(),
      order: 0,
      contexts: [
        {
          id: nodeId(),
          order: 0,
          subject: 'CHARACTER',
          conditions: [
            {
              id: nodeId(),
              order: 0,
              kind: 'PREDICATE',
              constraint: 'INCLUDE',
              predicateCode: 'ATTACK_ACTION_OTHER_WEAPON',
              authoringModeKind: 'SELECTED',
              properties: ['LIGHT', 'MELEE']
            }
          ]
        }
      ]
    }
  ]
}

/** A copy of `restriction` that also requires, or (EXCLUDE) forbids, the attack to be a bonus action. */
function onBonusAction(
  restriction: FacetAuthored,
  constraint: 'INCLUDE' | 'EXCLUDE'
): FacetAuthored {
  return {
    id: nodeId(),
    groups: restriction.groups.map((group) => ({
      id: nodeId(),
      order: group.order,
      contexts: [
        ...group.contexts.map((context) => ({
          ...context,
          id: nodeId(),
          conditions: (context.conditions ?? []).map((condition) => ({
            ...condition,
            id: nodeId()
          }))
        })),
        {
          id: nodeId(),
          order: group.contexts.length,
          subject: 'EQUIPMENT' as const,
          authoringModeKind: 'ALL' as const,
          conditions: [
            {
              id: nodeId(),
              order: 0,
              kind: 'PREDICATE' as const,
              constraint,
              predicateCode: 'ATTACK_ACTIVATION' as const,
              activation: ACTIVATION_CODE.BONUS_ACTION
            }
          ]
        }
      ]
    })) as FacetAuthored['groups']
  }
}

/**
 * The weapon `base` with an off-hand bonus attack authored from core options only: its damage
 * ability modifier applies to the Action attack in full and to the bonus attack only while
 * negative (`max: 0`).
 */
function offHandWeapon(
  base: EquipmentAuthored,
  index: number,
  modifiers: EquipmentAuthored['modifiers'],
  properties = base.properties ?? []
): EquipmentAuthored {
  const [attack] = meleeWeaponEffects(equipId(index), 'PIERCING', '1d6', EQUIPMENT_GRIP.ONE_HANDED)
  const [bonus] = meleeWeaponEffects(
    equipId(index + 0x100),
    'PIERCING',
    '1d6',
    EQUIPMENT_GRIP.ONE_HANDED
  )
  if (!attack || !bonus || bonus.invocation.kind !== 'ACTION')
    throw new Error('The melee weapon builder authors no action effect.')
  const bonusAttack: EquipmentEffectAuthored = {
    ...bonus,
    invocation: {
      ...bonus.invocation,
      activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 }
    },
    requirements: otherLightMeleeAttack
  } as EquipmentEffectAuthored
  // Narrowed to the damage variants: spreading the whole modifier union is too complex to type.
  const damage = (modifiers ?? []).find(
    (
      modifier
    ): modifier is Extract<NonNullable<typeof modifiers>[number], { valueDomainCode: 'DAMAGE' }> =>
      modifier.valueDomainCode === 'DAMAGE'
  )
  if (!damage?.restrictions) throw new Error('The weapon builder authors no damage modifier.')
  return {
    ...base,
    id: equipId(index),
    label: `Off-hand ${base.label}`,
    properties,
    effects: [attack, bonusAttack],
    modifiers: [
      ...(modifiers ?? []).filter((modifier) => modifier !== damage),
      { ...damage, restrictions: onBonusAction(damage.restrictions, 'EXCLUDE') },
      {
        ...damage,
        id: equipId(index + 0x200),
        order: 3,
        payload: { ...damage.payload, max: 0 },
        restrictions: onBonusAction(damage.restrictions, 'INCLUDE')
      }
    ] as EquipmentAuthored['modifiers']
  }
}

const finesseBlade = offHandWeapon(shortsword, 0x900, finesseWeaponModifiers(equipId(0x900)))
const strengthClub = offHandWeapon(club, 0xa00, meleeWeaponAbilityModifiers(equipId(0xa00)))
const heavyClub = offHandWeapon(
  club,
  0xb00,
  meleeWeaponAbilityModifiers(equipId(0xb00)),
  club.properties?.filter((property) => property !== 'LIGHT')
)

const twoWeaponFighting = srdFeature({
  owner: 'CLASS',
  classLabel: 'Fighter',
  featureLabel: 'Fighting Style',
  level: 1,
  optionLabels: ['Two-Weapon Fighting']
})

function fighter(input: {
  abilities: Parameters<typeof evaluateSrdCharacter>[0]['abilities']
  weapon: EquipmentAuthored
  style?: boolean
}) {
  return evaluateSrdCharacter({
    abilities: input.abilities,
    classes: [{ label: 'Fighter', level: 1 }],
    features: input.style ? [twoWeaponFighting] : [],
    items: [{ label: input.weapon.label, equipped: true }],
    extraEquipment: [input.weapon]
  })
}

/** The weapon's damage expression when attacking as the Action (main hand) or the bonus action (off hand). */
const damage = (
  character: SrdCharacter,
  weapon: EquipmentAuthored,
  activation: 'ACTION' | 'BONUS_ACTION'
) =>
  damageExpression(
    itemAction(character, weapon.label, { attackKind: 'MELEE', activation }).decision
  )

describe('the off-hand attack’s damage ability modifier (two-weapon fighting)', () => {
  it('adds a positive modifier only to the Action attack, and a negative one to both', () => {
    const strong = fighter({ abilities: { STRENGTH: 16 }, weapon: strengthClub })
    expect(damage(strong, strengthClub, 'ACTION')).toBe('1d6 + 3')
    expect(damage(strong, strengthClub, 'BONUS_ACTION')).toBe('1d6')

    const weak = fighter({ abilities: { STRENGTH: 8 }, weapon: strengthClub })
    expect(damage(weak, strengthClub, 'ACTION')).toBe('1d6 - 1')
    expect(damage(weak, strengthClub, 'BONUS_ACTION')).toBe('1d6 - 1')
  })

  it('does the same for a finesse weapon, whichever ability it attacks with', () => {
    const dexterous = fighter({ abilities: { STRENGTH: 8, DEXTERITY: 16 }, weapon: finesseBlade })
    expect(damage(dexterous, finesseBlade, 'ACTION')).toBe('1d6 + 3')
    expect(damage(dexterous, finesseBlade, 'BONUS_ACTION')).toBe('1d6')

    const clumsy = fighter({ abilities: { STRENGTH: 8, DEXTERITY: 8 }, weapon: finesseBlade })
    expect(damage(clumsy, finesseBlade, 'BONUS_ACTION')).toBe('1d6 - 1')
  })

  it('is restored in full by the Two-Weapon Fighting style, for the ability the attack uses', () => {
    const strong = fighter({ abilities: { STRENGTH: 16 }, weapon: strengthClub, style: true })
    expect(damage(strong, strengthClub, 'BONUS_ACTION')).toBe('1d6 + 3')
    // The Action attack is unchanged: the style does not add the modifier a second time.
    expect(damage(strong, strengthClub, 'ACTION')).toBe('1d6 + 3')

    const dexterous = fighter({
      abilities: { STRENGTH: 8, DEXTERITY: 16 },
      weapon: finesseBlade,
      style: true
    })
    expect(damage(dexterous, finesseBlade, 'BONUS_ACTION')).toBe('1d6 + 3')
    expect(damage(dexterous, finesseBlade, 'ACTION')).toBe('1d6 + 3')

    // A Strength weapon is restored by Strength, not by the Fighter's higher Dexterity.
    const dexterousClubber = fighter({
      abilities: { STRENGTH: 12, DEXTERITY: 18 },
      weapon: strengthClub,
      style: true
    })
    expect(damage(dexterousClubber, strengthClub, 'BONUS_ACTION')).toBe('1d6 + 1')
  })

  it('leaves a negative modifier as it is under the style', () => {
    const weak = fighter({ abilities: { STRENGTH: 8 }, weapon: strengthClub, style: true })
    expect(damage(weak, strengthClub, 'BONUS_ACTION')).toBe('1d6 - 1')
  })

  it('restores the modifier only to a Light weapon’s bonus attack', () => {
    const heavy = fighter({ abilities: { STRENGTH: 16 }, weapon: heavyClub, style: true })
    expect(damage(heavy, heavyClub, 'BONUS_ACTION')).toBe('1d6')
    expect(damage(heavy, heavyClub, 'ACTION')).toBe('1d6 + 3')
  })
})
