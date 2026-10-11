import { type CreatureAuthored } from '@artificer-toolkit/shared'

import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const gibberingMouther: CreatureAuthored = {
  id: S.CREATURE_IDS.GIBBERING_MOUTHER,
  label: 'Gibbering Mouther',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ABERRATION,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 8,
    CONSTITUTION: 16,
    INTELLIGENCE: 3,
    WISDOM: 10,
    CHARISMA: 6
  },
  naturalArmorBonus: 0,
  hitPoints: 67,
  hitDice: {
    count: 9,
    die: 8,
    modifier: 27
  },
  speeds: [...S.walk(10), ...S.swim(10)],
  conditionImmunities: ['prone'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(141, 1),
      label: 'Aberrant Ground',
      description:
        'Aberrant Ground. The ground in a 10-foot radius around the mouther is doughlike difficult terrain. Each creature that starts its turn in that area must succeed on a DC 10 Strength saving throw or have its speed reduced to 0 until the start of its next turn.',
      order: 1
    },
    {
      id: S.featureId(141, 2),
      label: 'Gibbering',
      description:
        "Gibbering. The mouther babbles incoherently while it can see any creature and isn't incapacitated. Each creature that starts its turn within 20 feet of the mouther and can hear the gibbering must succeed on a DC 10 Wisdom saving throw. On a failure, the creature can't take reactions until the start of its next turn and rolls a d8 to determine what it does during its turn. On a 1 to 4, the creature does nothing. On a 5 or 6, the creature takes no action or bonus action and uses all its movement to move in a randomly determined direction. On a 7 or 8, the creature makes a melee attack against a randomly determined creature within its reach or does nothing if it can't make such an attack.",
      order: 2
    },
    {
      id: S.featureId(141, 3),
      label: 'Multiattack',
      description:
        'Multiattack. The gibbering mouther makes one bite attack and, if it can, uses its Blinding Spittle.',
      order: 3
    },
    {
      id: S.featureId(141, 4),
      label: 'Bites',
      description:
        'Bites. Melee Weapon Attack: +2 to hit, reach 5 ft., one creature. Hit: 17 (5d6) piercing damage. If the target is Medium or smaller, it must succeed on a DC 10 Strength saving throw or be knocked prone. If the target is killed by this damage, it is absorbed into the mouther.',
      effects: [
        S.weaponAttack({
          creatureIndex: 141,
          localIndex: 1,
          kind: 'MELEE',
          feet: 5,
          damageType: 'PIERCING',
          diceConfig: '5d6',
          ability: null,
          followUpSave: S.conditionSave({
            id: S.actionId(141, 7),
            savingThrowId: S.actionId(141, 8),
            ability: 'STRENGTH',
            dc: 10,
            conditionOutcomeId: S.actionId(141, 9),
            conditionId: conditionTypeId('PRONE'),
            repeatsAtTurnEnd: false
          })
        })
      ],
      order: 4
    },
    {
      id: S.featureId(141, 5),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(141, 5)),
      label: 'Blinding Spittle (Recharge 5-6)',
      description:
        "Blinding Spittle (Recharge 5-6). The mouther spits a chemical glob at a point it can see within 15 feet of it. The glob explodes in a blinding flash of light on impact. Each creature within 5 feet of the flash must succeed on a DC 13 Dexterity saving throw or be blinded until the end of the mouther's next turn.",
      order: 5
    }
  ]
}
