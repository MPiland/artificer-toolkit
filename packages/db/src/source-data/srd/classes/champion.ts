import {
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const F = 5

export const championMartialArchetype: ClassAuthored = {
  id: SUBCLASS_IDS.CHAMPION,
  label: 'Champion',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.FIGHTER,
  description: 'The archetypal Champion focuses on the development of raw physical power honed to deadly perfection.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(F, 11, 1),
      label: 'Improved Critical',
      description: 'Beginning when you choose this archetype at 3rd level, your weapon attacks score a critical hit on a roll of 19 or 20.',
      availableAtLevel: 3,
      order: 0
    },
    {
      id: classRowId(F, 11, 2),
      label: 'Remarkable Athlete',
      description: 'Starting at 7th level, you can add half your proficiency bonus (round up) to any Strength, Dexterity, or Constitution check you make that doesn\'t already use your proficiency bonus.',
      availableAtLevel: 7,
      order: 1
    },
    {
      id: classRowId(F, 11, 3),
      label: 'Additional Fighting Style',
      description: 'At 10th level, you can choose a second option from the Fighting Style class feature.',
      availableAtLevel: 10,
      order: 2,
      optionChoices: [{ level: 10, count: 1 }],
      options: [
        {
          id: classRowId(F, 12, 1),
          label: 'Archery',
          description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 12, 10),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                domain: { attackDomain: 'RANGED' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.SOURCE,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0
              }
            ]
          },
          order: 0
        },
        {
          id: classRowId(F, 12, 2),
          label: 'Defense',
          description: 'While you are wearing armor, you gain a +1 bonus to AC.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 12, 11),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                domain: {},
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.SOURCE,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 1 },
                order: 0
              }
            ]
          },
          order: 1
        },
        {
          id: classRowId(F, 12, 3),
          label: 'Dueling',
          description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 12, 12),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                domain: { attackDomain: 'MELEE' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.SOURCE,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0
              }
            ]
          },
          order: 2
        },
        {
          id: classRowId(F, 12, 4),
          label: 'Great Weapon Fighting',
          description: 'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll.',
          order: 3
        },
        {
          id: classRowId(F, 12, 5),
          label: 'Protection',
          description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.',
          order: 4
        },
        {
          id: classRowId(F, 12, 6),
          label: 'Two-Weapon Fighting',
          description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
          order: 5
        }
      ]
    },
    {
      id: classRowId(F, 11, 4),
      label: 'Superior Critical',
      description: 'Starting at 15th level, your weapon attacks score a critical hit on a roll of 18-20.',
      availableAtLevel: 15,
      order: 3
    },
    {
      id: classRowId(F, 11, 5),
      label: 'Survivor',
      description: 'At 18th level, you attain the pinnacle of resilience in battle. At the start of each of your turns, you regain hit points equal to 5 + your Constitution modifier if you have no more than half of your hit points left.',
      availableAtLevel: 18,
      order: 4
    }
  ]
}

