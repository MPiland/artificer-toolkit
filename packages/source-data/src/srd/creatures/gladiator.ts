import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const gladiator: CreatureAuthored = {
  id: S.CREATURE_IDS.GLADIATOR,
  label: 'Gladiator',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.NPC,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 15,
    CONSTITUTION: 16,
    INTELLIGENCE: 10,
    WISDOM: 12,
    CHARISMA: 15
  },
  armorClass: 16,
  armorClassNote: 'studded leather, shield',
  hitPoints: 112,
  hitDice: {
    count: 15,
    die: 8,
    modifier: 45
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillExpertise(8895, 4, 'ATHLETICS'),
    S.grantedSaveProficiency(8895, 1, 'STRENGTH', 'DEXTERITY', 'CONSTITUTION'),
    S.grantedSkillProficiency(8895, 2, 'INTIMIDATION'),
    S.grantedLanguageProficiency(8895, 3, 'COMMON')
  ],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(143, 1),
      label: 'Brave',
      description: 'Brave. The gladiator has advantage on saving throws against being frightened.',
      order: 1
    },
    {
      id: S.featureId(143, 2),
      label: 'Brute',
      description:
        'Brute. A melee weapon deals one extra die of its damage when the gladiator hits with it (included in the attack).',
      order: 2
    },
    {
      id: S.featureId(143, 3),
      label: 'Multiattack',
      description: 'Multiattack. The gladiator makes three melee attacks or two ranged attacks.',
      order: 3
    },
    {
      id: S.featureId(143, 4),
      label: 'Spear',
      description:
        'Spear. Melee or Ranged Weapon Attack: +7 to hit, reach 5 ft. and range 20/60 ft., one target. Hit: 11 (2d6 + 4) piercing damage, or 13 (2d8 + 4) piercing damage if used with two hands to make a melee attack.',
      effects: [
        S.weaponAttack({
          creatureIndex: 143,
          localIndex: 1,
          kind: 'MELEE',
          feet: 5,
          damageType: 'PIERCING',
          diceConfig: '2d6',
          ability: 'STRENGTH'
        }),
        S.weaponAttack({
          creatureIndex: 143,
          localIndex: 11,
          kind: 'RANGED',
          feet: 20,
          longFeet: 60,
          damageType: 'PIERCING',
          diceConfig: '2d6',
          ability: 'STRENGTH'
        })
      ],
      order: 4
    },
    {
      id: S.featureId(143, 5),
      label: 'Shield Bash',
      description:
        'Shield Bash. Melee Weapon Attack: +7 to hit, reach 5 ft., one creature. Hit: 9 (2d4 + 4) bludgeoning damage. If the target is a Medium or smaller creature, it must succeed on a DC 15 Strength saving throw or be knocked prone.',
      effects: [
        S.weaponAttack({
          creatureIndex: 143,
          localIndex: 21,
          kind: 'MELEE',
          feet: 5,
          damageType: 'BLUDGEONING',
          diceConfig: '2d4',
          ability: 'STRENGTH',
          followUpSave: S.conditionSave({
            id: S.actionId(143, 27),
            savingThrowId: S.actionId(143, 28),
            ability: 'STRENGTH',
            dc: 15,
            conditionOutcomeId: S.actionId(143, 29),
            conditionId: conditionTypeId('PRONE'),
            repeatsAtTurnEnd: false
          })
        })
      ],
      order: 5
    },
    {
      id: S.featureId(143, 6),
      label: 'Parry',
      description:
        'Parry. The gladiator adds 3 to its AC against one melee attack that would hit it. To do so, the gladiator must see the attacker and be wielding a melee weapon.',
      effects: [
        S.closedRuleEffect({
          id: S.reactionId(143, 101),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.REACTION, amount: 1 },
            range: { id: S.reactionId(143, 102), rangeKind: S.RANGE_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_PARRY
        })
      ],
      order: 6
    }
  ]
}
