import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
import * as S from './shared.js'

export const priest: CreatureAuthored = {
  id: CREATURE_IDS.PRIEST,
  label: 'Priest',
  description: 'Medium humanoid (any race), any alignment',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 12,
    INTELLIGENCE: 13,
    WISDOM: 16,
    CHARISMA: 13
  },
  naturalArmorBonus: 0,
  hitPoints: 27,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 5,
    die: 8,
    modifier: 5
  },
  speeds: [...S.walk(25)],
  proficiencies: [
    S.grantedSkillProficiency(225, 1, 'PERSUASION', 'RELIGION'),
    S.grantedSkillExpertise(225, 2, 'MEDICINE')
  ],
  passivePerception: 13,
  challengeRatingId: CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(225, 1),
      label: 'Divine Eminence',
      description:
        'Divine Eminence. As a bonus action, the priest can expend a spell slot to cause its melee weapon attacks to magically deal an extra 10 (3d6) radiant damage to a target on a hit. This benefit lasts until the end of the turn. If the priest expends a spell slot of 2nd level or higher, the extra damage increases by 1d6 for each level above 1st.',
      effects: [
        // A creature action cannot spend a spell slot, so the slot and the extra damage are a GM ruling (D187a).
        S.manualAdjudicationEffect({
          id: S.bonusActionId(225, 501),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
            range: { id: S.bonusActionId(225, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Divine Eminence',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          instructions:
            'The priest expends a spell slot. Until the end of the turn, its melee weapon attacks deal an extra 3d6 radiant damage on a hit, plus 1d6 for each slot level above 1st. The GM spends the slot and adds the damage.'
        })
      ],
      order: 1
    },
    {
      id: S.featureId(225, 2),
      label: 'Spellcasting',
      description:
        'Spellcasting. The priest is a 5th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 13, +5 to hit with spell attacks). The priest has the following cleric spells prepared: Cantrips (at will): light, sacred flame, thaumaturgy 1st level (4 slots): cure wounds, guiding bolt, sanctuary 2nd level (3 slots): lesser restoration, spiritual weapon 3rd level (2 slots): dispel magic, spirit guardians',
      grants: S.slottedSpellcastingGrants(
        225,
        S.ABILITY_CODE.WISDOM,
        [S.SPELL_IDS.LIGHT, S.SPELL_IDS.SACRED_FLAME, S.SPELL_IDS.THAUMATURGY],
        [
          {
            level: 1,
            slots: 4,
            spellIds: [S.SPELL_IDS.CURE_WOUNDS, S.SPELL_IDS.GUIDING_BOLT, S.SPELL_IDS.SANCTUARY]
          },
          {
            level: 2,
            slots: 3,
            spellIds: [S.SPELL_IDS.LESSER_RESTORATION, S.SPELL_IDS.SPIRITUAL_WEAPON]
          },
          { level: 3, slots: 2, spellIds: [S.SPELL_IDS.DISPEL_MAGIC, S.SPELL_IDS.SPIRIT_GUARDIANS] }
        ]
      ),
      order: 2
    },
    {
      id: S.featureId(225, 3),
      label: 'Mace',
      description:
        'Mace. Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 3 (1d6) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(225, 501),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(225, 601),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(225, 801),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(225, 801) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(225, 910),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    }
  ]
}
