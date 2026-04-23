import {
  ABILITY_CODE,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_CONDITION_TYPES, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

function conditionTypeId(code: string): string {
  const entry = SRD_CONDITION_TYPES.find((c) => c.code === code)
  if (!entry) throw new Error(`SRD condition type vocabulary entry for ${code} required.`)
  return entry.id
}

const RA = 8

export const hunterConclave: ClassAuthored = {
  id: SUBCLASS_IDS.HUNTER,
  label: 'Hunter',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.RANGER,
  description: 'Emulating the Hunter archetype means accepting your place as a bulwark between civilization and the terrors of the wilderness.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(RA, 11, 1),
      label: 'Hunter\'s Prey',
      description: 'At 3rd level, you gain one of the following features of your choice: Colossus Slayer, Giant Killer, or Horde Breaker.',
      availableAtLevel: 3,
      order: 0,
      optionChoices: [{ level: 3, count: 1 }],
      options: [
        { id: classRowId(RA, 12, 1), label: 'Colossus Slayer', description: 'Your tenacity can wear down the most potent foes. When you hit a creature with a weapon attack, the creature takes an extra 1d8 damage if it\'s below its hit point maximum.', order: 0 },
        { id: classRowId(RA, 12, 2), label: 'Giant Killer', description: 'When a Large or larger creature within 5 feet of you hits or misses you with an attack, you can use your reaction to attack that creature immediately after its attack, provided that you can see the creature.', order: 1 },
        { id: classRowId(RA, 12, 3), label: 'Horde Breaker', description: 'Once on each of your turns when you make a weapon attack, you can make another attack with the same weapon against a different creature that is within 5 feet of the original target and within range of your weapon.', order: 2 }
      ]
    },
    {
      id: classRowId(RA, 11, 2),
      label: 'Defensive Tactics',
      description: 'At 7th level, you gain one of the following features of your choice: Escape the Horde, Multiattack Defense, or Steel Will.',
      availableAtLevel: 7,
      order: 1,
      optionChoices: [{ level: 7, count: 1 }],
      options: [
        { id: classRowId(RA, 13, 1), label: 'Escape the Horde', description: 'Opportunity attacks against you are made with disadvantage.', order: 0 },
        { id: classRowId(RA, 13, 2), label: 'Multiattack Defense', description: 'When a creature hits you with an attack, you gain a +4 bonus to AC against all subsequent attacks made by that creature for the rest of the turn.', order: 1 },
        {
          id: classRowId(RA, 13, 3),
          label: 'Steel Will',
          description: 'You have advantage on saving throws against being frightened.',
          order: 2,
          grants: {
            modifiers: [
              {
                id: classRowId(RA, 13, 4),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                domain: {
                  ability: ABILITY_CODE.WISDOM,
                  conditionTypeId: conditionTypeId('FRIGHTENED')
                },
                modifierKind: MODIFIER_KIND.ADVANTAGE,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: undefined,
                order: 0
              }
            ]
          }
        }
      ]
    },
    {
      id: classRowId(RA, 11, 3),
      label: 'Hunter\'s Multiattack',
      description: 'At 11th level, you gain one of the following features of your choice: Volley or Whirlwind Attack.',
      availableAtLevel: 11,
      order: 2,
      optionChoices: [{ level: 11, count: 1 }],
      options: [
        { id: classRowId(RA, 14, 1), label: 'Volley', description: 'You can use your action to make a ranged attack against any number of creatures within 10 feet of a point you can see within your weapon\'s range. You must have ammunition for each target, and you must make a separate attack roll for each target.', order: 0 },
        { id: classRowId(RA, 14, 2), label: 'Whirlwind Attack', description: 'You can use your action to make a melee attack against any number of creatures within 5 feet of you, with a separate attack roll for each target.', order: 1 }
      ]
    },
    {
      id: classRowId(RA, 11, 4),
      label: 'Superior Hunter\'s Defense',
      description: 'At 15th level, you gain one of the following features of your choice: Evasion, Stand Against the Tide, or Uncanny Dodge.',
      availableAtLevel: 15,
      order: 3,
      optionChoices: [{ level: 15, count: 1 }],
      options: [
        { id: classRowId(RA, 15, 1), label: 'Evasion', description: 'When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed, and only half damage if you fail.', order: 0 },
        { id: classRowId(RA, 15, 2), label: 'Stand Against the Tide', description: 'When a hostile creature misses you with a melee attack, you can use your reaction to force that creature to repeat the same attack against another creature (other than itself) of your choice.', order: 1 },
        { id: classRowId(RA, 15, 3), label: 'Uncanny Dodge', description: 'When an attacker that you can see hits you with an attack, you can use your reaction to halve the attack\'s damage against you.', order: 2 }
      ]
    }
  ]
}

